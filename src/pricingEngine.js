'use strict';

const { DiscountContext, PricingResult } = require('./context');
const { roundMoney } = require('./money');
const {
  PercentDiscount,
  FixedDiscount,
  PromoCodeDiscount,
  FreeDeliveryDiscount,
  ThreeForTwoDiscount,
  LoyaltyDiscount,
  FirstOrderDiscount,
} = require('./discounts');

/**
 * Движок знает только абстракцию Discount и контекст.
 * Порядок этапов:
 *  1) 3 по цене 2
 *  2) процентные: обычные + процентный промокод (конфликт решается по выгоде),
 *     затем лояльность и первый заказ — в порядке конфигурации
 *  3) фиксированные + фиксированный промокод
 *  4) бесплатная доставка
 */
class PricingEngine {
  constructor(discounts) {
    if (!Array.isArray(discounts)) throw new Error('discounts должен быть массивом');
    this.discounts = discounts;
  }

  calculate(order) {
    const ctx = new DiscountContext(order);
    const baseTotal = roundMoney(ctx.itemsTotal + order.deliveryCost);

    // Разбиваем стратегии по этапам.
    const threeForTwo = [];
    const percentCommon = [];
    const fixedCommon = [];
    const promos = [];
    const loyalties = [];
    const firstOrders = [];
    const freeDeliveries = [];

    for (const d of this.discounts) {
      if (d instanceof ThreeForTwoDiscount) threeForTwo.push(d);
      else if (d instanceof PromoCodeDiscount) promos.push(d);
      else if (d instanceof LoyaltyDiscount) loyalties.push(d);
      else if (d instanceof FirstOrderDiscount) firstOrders.push(d);
      else if (d instanceof FreeDeliveryDiscount) freeDeliveries.push(d);
      else if (d instanceof PercentDiscount) percentCommon.push(d);
      else if (d instanceof FixedDiscount) fixedCommon.push(d);
      else throw new Error('Неизвестная стратегия: ' + d.constructor.name);
    }

    // ---- Этап 1: 3 по цене 2 ----
    for (const d of threeForTwo) {
      ctx.addDiscount(d.apply(ctx));
    }

    // ---- Этап 2: процентные ----
    // Победитель пары "обычная процентная vs процентный промокод"
    // определяется по выгоде на текущей сумме товаров.
    const activePercentPromo = promos.find(p =>
      p.kind === 'percent' && p.isApplicable(ctx)
    );

    let bestCommon = null;
    let bestCommonAmount = 0;
    for (const d of percentCommon) {
      if (ctx.itemsTotal <= 0) break;
      const amt = roundMoney(ctx.itemsTotal * (d.percent / 100));
      if (amt > bestCommonAmount) {
        bestCommonAmount = amt;
        bestCommon = d;
      }
    }

    let promoPercentAmount = 0;
    if (activePercentPromo) {
      promoPercentAmount = activePercentPromo.potentialAmount(ctx);
    }

    // При равенстве — выигрывает промокод.
    const winnerIsPromo = !!activePercentPromo && promoPercentAmount >= bestCommonAmount;

    if (winnerIsPromo) {
      ctx.addDiscount(activePercentPromo.apply(ctx));
    } else if (bestCommon) {
      ctx.addDiscount(bestCommon.apply(ctx));
    }

    // Остальные обычные процентные — в порядке конфигурации.
    for (const d of percentCommon) {
      if (d === bestCommon) continue;
      ctx.addDiscount(d.apply(ctx));
    }

    // Лояльность и первый заказ — отдельные процентные скидки.
    for (const d of loyalties) ctx.addDiscount(d.apply(ctx));
    for (const d of firstOrders) ctx.addDiscount(d.apply(ctx));

    // ---- Этап 3: фиксированные ----
    // Сначала обычные фиксированные из конфигурации.
    for (const d of fixedCommon) ctx.addDiscount(d.apply(ctx));

    // Затем фиксированный промокод (не конфликтует с процентными).
    const activeFixedPromo = promos.find(p =>
      p.kind === 'fixed' && p.isApplicable(ctx)
    );
    if (activeFixedPromo) ctx.addDiscount(activeFixedPromo.apply(ctx));

    // ---- Этап 4: бесплатная доставка ----
    for (const d of freeDeliveries) ctx.addDiscount(d.apply(ctx));

    const finalTotal = roundMoney(ctx.itemsTotal + ctx.deliveryCost);

    return new PricingResult({
      baseTotal,
      appliedDiscounts: ctx.appliedDiscounts,
      finalTotal,
    });
  }
}

module.exports = { PricingEngine };