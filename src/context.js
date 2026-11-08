'use strict';

class AppliedDiscount {
  constructor({ name, amount, reason }) {
    this.name = name;
    this.amount = amount;
    this.reason = reason;
  }
  toJSON() {
    return { name: this.name, amount: this.amount, reason: this.reason };
  }
}

/**
 * Единственный изменяемый объект одного расчёта.
 */
class DiscountContext {
  constructor(order) {
    this.order = order;
    this.itemsTotal = order.items.reduce((s, it) => s + it.total, 0);
    this.deliveryCost = order.deliveryCost;
    this.appliedDiscounts = [];
    this.promoCode = order.promoCode;
    this.appliedPromo = null;
  }

  addDiscount(discount) {
    if (discount && discount.amount > 0) {
      this.appliedDiscounts.push(discount);
    }
  }

  /** Уменьшение суммы товаров с защитой от ухода ниже 0. */
  reduceItems(amount) {
    const actual = Math.min(amount, this.itemsTotal);
    this.itemsTotal = Math.max(0, this.itemsTotal - actual);
    return actual;
  }

  /** Уменьшение стоимости доставки. */
  reduceDelivery(amount) {
    const actual = Math.min(amount, this.deliveryCost);
    this.deliveryCost -= actual;
    return actual;
  }
}

class PricingResult {
  constructor({ baseTotal, appliedDiscounts, finalTotal }) {
    this.baseTotal = baseTotal;
    this.appliedDiscounts = appliedDiscounts;
    this.finalTotal = finalTotal;
  }
  toJSON() {
    return {
      baseTotal: this.baseTotal,
      appliedDiscounts: this.appliedDiscounts.map(d => d.toJSON()),
      finalTotal: this.finalTotal,
    };
  }
}

module.exports = { AppliedDiscount, DiscountContext, PricingResult };