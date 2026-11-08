'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Product, CartItem, Customer, Order } = require('../src/models');
const { DiscountContext } = require('../src/context');
const {
  PercentDiscount,
  FixedDiscount,
  ThreeForTwoDiscount,
  PromoCodeDiscount,
  LoyaltyDiscount,
  FreeDeliveryDiscount,
  FirstOrderDiscount,
} = require('../src/discounts');

function makeOrder({ items = [], customer = {}, createdAt = '2026-11-08', deliveryCost = 0, promoCode = null } = {}) {
  return new Order({
    id: 'o',
    customer: new Customer({ id: 'c', ...customer }),
    items,
    promoCode,
    createdAt: new Date(createdAt),
    deliveryCost,
  });
}

function item(price, qty = 1, category = 'cat') {
  return new CartItem({ product: new Product({ id: 'p', name: 'n', basePrice: price, category }), quantity: qty });
}

test('PercentDiscount: применяется', () => {
  const ctx = new DiscountContext(makeOrder({ items: [item(1000)] }));
  const d = new PercentDiscount({ name: '10%', percent: 10 });
  const applied = d.apply(ctx);
  assert.equal(applied.amount, 100);
  assert.equal(ctx.itemsTotal, 900);
});

test('PercentDiscount: не применяется на пустой корзине', () => {
  const ctx = new DiscountContext(makeOrder({ items: [] }));
  const d = new PercentDiscount({ name: '10%', percent: 10 });
  assert.equal(d.apply(ctx), null);
});

test('FixedDiscount: применяется при достижении порога', () => {
  const ctx = new DiscountContext(makeOrder({ items: [item(3000)] }));
  const d = new FixedDiscount({ name: '500', value: 500, threshold: 3000 });
  const applied = d.apply(ctx);
  assert.equal(applied.amount, 500);
});

test('FixedDiscount: не применяется ниже порога', () => {
  const ctx = new DiscountContext(makeOrder({ items: [item(2999)] }));
  const d = new FixedDiscount({ name: '500', value: 500, threshold: 3000 });
  assert.equal(d.apply(ctx), null);
});

test('ThreeForTwo: 3 книги с разными ценами — бесплатна самая дешёвая', () => {
  const ctx = new DiscountContext(makeOrder({
    items: [item(500, 1, 'Книги'), item(300, 1, 'Книги'), item(100, 1, 'Книги')],
  }));
  const d = new ThreeForTwoDiscount({ name: '3x2', category: 'Книги' });
  const applied = d.apply(ctx);
  assert.equal(applied.amount, 100);
});

test('ThreeForTwo: 7 книг — 2 бесплатные (самые дешёвые)', () => {
  // цены: 100,100,200,200,300,300,400 -> free: 100,100
  const ctx = new DiscountContext(makeOrder({
    items: [item(100, 2, 'Книги'), item(200, 2, 'Книги'), item(300, 2, 'Книги'), item(400, 1, 'Книги')],
  }));
  const d = new ThreeForTwoDiscount({ name: '3x2', category: 'Книги' });
  const applied = d.apply(ctx);
  assert.equal(applied.amount, 200);
});

test('ThreeForTwo: менее 3 единиц — не применяется', () => {
  const ctx = new DiscountContext(makeOrder({ items: [item(500, 2, 'Книги')] }));
  const d = new ThreeForTwoDiscount({ name: '3x2', category: 'Книги' });
  assert.equal(d.apply(ctx), null);
});

test('PromoCode: процентный применяется', () => {
  const ctx = new DiscountContext(makeOrder({ items: [item(1000)], promoCode: 'X' }));
  const d = new PromoCodeDiscount({ code: 'X', kind: 'percent', value: 20, name: 'X' });
  const applied = d.apply(ctx);
  assert.equal(applied.amount, 200);
});

test('PromoCode: неизвестный код не применяется', () => {
  const ctx = new DiscountContext(makeOrder({ items: [item(1000)], promoCode: 'Y' }));
  const d = new PromoCodeDiscount({ code: 'X', kind: 'percent', value: 20, name: 'X' });
  assert.equal(d.apply(ctx), null);
});

test('PromoCode: просроченный не применяется', () => {
  const ctx = new DiscountContext(makeOrder({
    items: [item(1000)], promoCode: 'X', createdAt: '2026-11-08',
  }));
  const d = new PromoCodeDiscount({ code: 'X', kind: 'percent', value: 20, validUntil: '2026-11-07', name: 'X' });
  assert.equal(d.apply(ctx), null);
});

test('PromoCode: граница срока включительна (тот же день)', () => {
  const ctx = new DiscountContext(makeOrder({
    items: [item(1000)], promoCode: 'X', createdAt: '2026-11-08T10:00:00',
  }));
  const d = new PromoCodeDiscount({ code: 'X', kind: 'percent', value: 10, validUntil: '2026-11-08', name: 'X' });
  assert.notEqual(d.apply(ctx), null);
});

test('Loyalty: ровно 30 дней — применяется', () => {
  const ctx = new DiscountContext(makeOrder({
    items: [item(1000)],
    createdAt: '2026-11-08',
    customer: { lastPurchaseDate: new Date('2026-10-09') },
  }));
  const d = new LoyaltyDiscount({ name: 'L', percent: 5, days: 30 });
  const applied = d.apply(ctx);
  assert.equal(applied.amount, 50);
});

test('Loyalty: 31 день — не применяется', () => {
  const ctx = new DiscountContext(makeOrder({
    items: [item(1000)],
    createdAt: '2026-11-08',
    customer: { lastPurchaseDate: new Date('2026-10-08') },
  }));
  const d = new LoyaltyDiscount({ name: 'L', percent: 5, days: 30 });
  assert.equal(d.apply(ctx), null);
});

test('Loyalty: будущая дата — не применяется', () => {
  const ctx = new DiscountContext(makeOrder({
    items: [item(1000)],
    createdAt: '2026-11-08',
    customer: { lastPurchaseDate: new Date('2026-12-01') },
  }));
  const d = new LoyaltyDiscount({ name: 'L', percent: 5, days: 30 });
  assert.equal(d.apply(ctx), null);
});

test('FreeDelivery: строго больше порога', () => {
  const ctx = new DiscountContext(makeOrder({ items: [item(5001)], deliveryCost: 300 }));
  const d = new FreeDeliveryDiscount({ name: 'FD', threshold: 5000 });
  const applied = d.apply(ctx);
  assert.equal(applied.amount, 300);
  assert.equal(ctx.deliveryCost, 0);
});

test('FreeDelivery: ровно порог — не применяется', () => {
  const ctx = new DiscountContext(makeOrder({ items: [item(5000)], deliveryCost: 300 }));
  const d = new FreeDeliveryDiscount({ name: 'FD', threshold: 5000 });
  assert.equal(d.apply(ctx), null);
});

test('FirstOrder: применяется только при isFirstOrder', () => {
  const ctx1 = new DiscountContext(makeOrder({ items: [item(1000)], customer: { isFirstOrder: true } }));
  const d = new FirstOrderDiscount({ name: 'FO', percent: 10 });
  assert.equal(d.apply(ctx1).amount, 100);

  const ctx2 = new DiscountContext(makeOrder({ items: [item(1000)], customer: { isFirstOrder: false } }));
  assert.equal(d.apply(ctx2), null);
});