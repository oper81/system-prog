'use strict';

const {
  PercentDiscount,
  FixedDiscount,
  ThreeForTwoDiscount,
  PromoCodeDiscount,
  LoyaltyDiscount,
  FreeDeliveryDiscount,
  FirstOrderDiscount,
} = require('./discounts');

/**
 * Синглтон-реестр. Хранит только фабричные функции,
 * никакого состояния конкретного заказа.
 */
class DiscountRegistry {
  static #instance = null;

  static getInstance() {
    if (!DiscountRegistry.#instance) {
      DiscountRegistry.#instance = new DiscountRegistry();
    }
    return DiscountRegistry.#instance;
  }

  constructor() {
    if (DiscountRegistry.#instance) {
      return DiscountRegistry.#instance;
    }
    this._creators = new Map();
    DiscountRegistry.#instance = this;
  }

  register(type, creatorFn) {
    if (typeof creatorFn !== 'function') throw new Error('creatorFn должен быть функцией');
    this._creators.set(type, creatorFn);
    return this;
  }

  has(type) { return this._creators.has(type); }

  create(type, config) {
    const creator = this._creators.get(type);
    if (!creator) throw new Error(`Неизвестный тип скидки: ${type}`);
    return creator(config);
  }
}

/** Заполняем стандартными создателями. */
const registry = DiscountRegistry.getInstance();
registry
  .register('percent', (c) => new PercentDiscount({ name: c.name, percent: c.value }))
  .register('fixed', (c) => new FixedDiscount({ name: c.name, value: c.value, threshold: c.threshold ?? 0 }))
  .register('threeForTwo', (c) => new ThreeForTwoDiscount({ name: c.name, category: c.category }))
  .register('loyalty', (c) => new LoyaltyDiscount({ name: c.name, percent: c.percent ?? 5, days: c.days ?? 30 }))
  .register('freeDelivery', (c) => new FreeDeliveryDiscount({ name: c.name, threshold: c.threshold }))
  .register('firstOrder', (c) => new FirstOrderDiscount({ name: c.name, percent: c.percent ?? 10 }))
  .register('promo', (c) => new PromoCodeDiscount(c));

module.exports = { DiscountRegistry, registry };