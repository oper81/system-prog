'use strict';

const { AppliedDiscount } = require('./context');
const { roundMoney } = require('./money');

/** Базовая абстракция. */
class Discount {
  get name() { throw new Error('not implemented'); }
  /** Возвращает AppliedDiscount или null. */
  apply(context) { throw new Error('not implemented'); }
}

// ---------- 1. Процентная ----------
class PercentDiscount extends Discount {
  constructor({ name, percent }) {
    super();
    if (percent < 0 || percent > 100) throw new Error('percent вне диапазона');
    this._name = name;
    this.percent = percent;
  }
  get name() { return this._name; }
  apply(ctx) {
    if (ctx.itemsTotal <= 0) return null;
    const raw = ctx.itemsTotal * (this.percent / 100);
    const amount = roundMoney(raw);
    const actual = roundMoney(ctx.reduceItems(amount));
    if (actual <= 0) return null;
    return new AppliedDiscount({
      name: this._name,
      amount: actual,
      reason: `Скидка ${this.percent}% от текущей суммы товаров`,
    });
  }
}

// ---------- 2. Фиксированная ----------
class FixedDiscount extends Discount {
  constructor({ name, value, threshold = 0 }) {
    super();
    if (value < 0) throw new Error('value < 0');
    this._name = name;
    this.value = value;
    this.threshold = threshold;
  }
  get name() { return this._name; }
  apply(ctx) {
    if (ctx.itemsTotal < this.threshold) return null;
    if (ctx.itemsTotal <= 0) return null;
    const amount = roundMoney(Math.min(this.value, ctx.itemsTotal));
    const actual = roundMoney(ctx.reduceItems(amount));
    if (actual <= 0) return null;
    return new AppliedDiscount({
      name: this._name,
      amount: actual,
      reason: `Фиксированная скидка ${this.value} (порог ${this.threshold})`,
    });
  }
}

// ---------- 3. 3 по цене 2 ----------
class ThreeForTwoDiscount extends Discount {
  constructor({ name, category }) {
    super();
    this._name = name;
    this.category = category;
  }
  get name() { return this._name; }

  apply(ctx) {
    // Собираем единицы нужной категории: [unitPrice, ...]
    const units = [];
    for (const item of ctx.order.items) {
      if (item.product.category !== this.category) continue;
      for (let i = 0; i < item.quantity; i++) {
        units.push(item.product.basePrice);
      }
    }
    if (units.length < 3) return null;

    const freeCount = Math.floor(units.length / 3);
    // Бесплатными становятся самые дешёвые единицы
    units.sort((a, b) => a - b);
    const freeUnits = units.slice(0, freeCount);
    const rawSum = freeUnits.reduce((s, p) => s + p, 0);
    const amount = roundMoney(rawSum);
    const actual = roundMoney(ctx.reduceItems(amount));
    if (actual <= 0) return null;

    return new AppliedDiscount({
      name: this._name,
      amount: actual,
      reason: `Категория ${this.category}: ${units.length} единиц, ${freeCount} бесплатно`,
    });
  }
}

// ---------- 4. Промокод ----------
class PromoCodeDiscount extends Discount {
  /**
   * @param {object} cfg { code, kind: 'percent'|'fixed', value, validUntil?, active? }
   */
  constructor({ code, kind, value, validUntil = null, active = true, name }) {
    super();
    if (!code) throw new Error('promo code обязателен');
    if (kind !== 'percent' && kind !== 'fixed') {
      throw new Error("kind должен быть 'percent' или 'fixed'");
    }
    this.code = code;
    this.kind = kind;
    this.value = value;
    this.validUntil = validUntil ? new Date(validUntil) : null;
    this.active = active;
    this._name = name || `Промокод ${code}`;
  }
  get name() { return this._name; }

  /** Применим ли промокод к данному заказу (без изменения контекста). */
  isApplicable(ctx) {
    if (!this.active) return false;
    if (ctx.order.promoCode !== this.code) return false;
    if (ctx.appliedPromo) return false; // одноразово в рамках заказа
    if (this.validUntil) {
      // Срок включителен: validUntil — конец дня.
      const until = new Date(this.validUntil);
      until.setHours(23, 59, 59, 999);
      if (ctx.order.createdAt.getTime() > until.getTime()) return false;
    }
    return true;
  }

  /** Потенциальная выгода на текущей сумме товаров. */
  potentialAmount(ctx) {
    if (this.kind === 'percent') {
      return roundMoney(ctx.itemsTotal * (this.value / 100));
    }
    return roundMoney(Math.min(this.value, ctx.itemsTotal));
  }

  apply(ctx) {
    if (!this.isApplicable(ctx)) return null;
    const amount = this.potentialAmount(ctx);
    const actual = roundMoney(ctx.reduceItems(amount));
    ctx.appliedPromo = this.code;
    if (actual <= 0) return null;
    const reason = this.kind === 'percent'
      ? `Промокод ${this.code}: ${this.value}%`
      : `Промокод ${this.code}: фиксированная ${this.value}`;
    return new AppliedDiscount({ name: this._name, amount: actual, reason });
  }
}

// ---------- 5. Лояльность ----------
class LoyaltyDiscount extends Discount {
  constructor({ name, percent = 5, days = 30 }) {
    super();
    this._name = name;
    this.percent = percent;
    this.days = days;
  }
  get name() { return this._name; }

  isApplicable(ctx) {
    const last = ctx.order.customer.lastPurchaseDate;
    if (!last) return false;
    const lastDate = last instanceof Date ? last : new Date(last);
    if (Number.isNaN(lastDate.getTime())) return false;
    const created = ctx.order.createdAt;
    if (lastDate.getTime() > created.getTime()) return false; // будущая дата некорректна

    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    // Сравниваем календарные дни (обрезаем время).
    const a = Date.UTC(created.getFullYear(), created.getMonth(), created.getDate());
    const b = Date.UTC(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
    const days = Math.round((a - b) / MS_PER_DAY);
    return days <= this.days; // граница включительна
  }

  apply(ctx) {
    if (!this.isApplicable(ctx)) return null;
    if (ctx.itemsTotal <= 0) return null;
    const amount = roundMoney(ctx.itemsTotal * (this.percent / 100));
    const actual = roundMoney(ctx.reduceItems(amount));
    if (actual <= 0) return null;
    return new AppliedDiscount({
      name: this._name,
      amount: actual,
      reason: `Последняя покупка была не более ${this.days} дней назад`,
    });
  }
}

// ---------- 6. Бесплатная доставка ----------
class FreeDeliveryDiscount extends Discount {
  constructor({ name, threshold }) {
    super();
    this._name = name;
    this.threshold = threshold;
  }
  get name() { return this._name; }

  apply(ctx) {
    if (!(ctx.itemsTotal > this.threshold)) return null; // строго больше
    if (ctx.deliveryCost <= 0) return null;
    const previous = ctx.deliveryCost;
    const actual = roundMoney(ctx.reduceDelivery(previous));
    if (actual <= 0) return null;
    return new AppliedDiscount({
      name: this._name,
      amount: actual,
      reason: `Сумма товаров (${ctx.itemsTotal}) > ${this.threshold}: доставка бесплатна`,
    });
  }
}

// ---------- 7. Первый заказ ----------
class FirstOrderDiscount extends Discount {
  constructor({ name, percent = 10 }) {
    super();
    this._name = name;
    this.percent = percent;
  }
  get name() { return this._name; }
  apply(ctx) {
    if (!ctx.order.customer.isFirstOrder) return null;
    if (ctx.itemsTotal <= 0) return null;
    const amount = roundMoney(ctx.itemsTotal * (this.percent / 100));
    const actual = roundMoney(ctx.reduceItems(amount));
    if (actual <= 0) return null;
    return new AppliedDiscount({
      name: this._name,
      amount: actual,
      reason: `Первый заказ: ${this.percent}%`,
    });
  }
}

module.exports = {
  Discount,
  PercentDiscount,
  FixedDiscount,
  ThreeForTwoDiscount,
  PromoCodeDiscount,
  LoyaltyDiscount,
  FreeDeliveryDiscount,
  FirstOrderDiscount,
};