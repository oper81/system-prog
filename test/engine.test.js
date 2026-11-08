'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Product, CartItem, Customer, Order } = require('../src/models');
const { PricingEngine } = require('../src/pricingEngine');
const {
  PercentDiscount,
  FixedDiscount,
  ThreeForTwoDiscount,
  PromoCodeDiscount,
  FreeDeliveryDiscount,
} = require('../src/discounts');
const { roundMoney } = require('../src/money');

function item(price, qty = 1, category = 'cat') {
  return new CartItem({
    product: new Product({
      id: Math.random().toString(36),
      name: 'n',
      basePrice: price,
      category,
    }),
    quantity: qty,
  });
}

function order({ items, promoCode = null, createdAt = '2026-11-08', deliveryCost = 0, customer = {} }) {
  return new Order({
    id: 'o',
    customer: new Customer({ id: 'c', ...customer }),
    items,
    promoCode,
    createdAt: new Date(createdAt),
    deliveryCost,
  });
}

test('3 по цене 2 идёт до процента; процент считается от остатка', () => {
  const o = order({
    items: [
      item(500, 1, 'Книги'),
      item(300, 1, 'Книги'),
      item(100, 1, 'Книги'),
    ],
  });
  const engine = new PricingEngine([
    new ThreeForTwoDiscount({ name: '3x2', category: 'Книги' }),
    new PercentDiscount({ name: '10%', percent: 10 }),
  ]);
  const r = engine.calculate(o);
  // сумма 900, 3x2 убирает 100 -> 800, 10% -> 80 -> 720
  assert.equal(r.appliedDiscounts[0].name, '3x2');
  assert.equal(r.appliedDiscounts[0].amount, 100);
  assert.equal(r.appliedDiscounts[1].amount, 80);
  assert.equal(r.finalTotal, 720);
});

test('Промокод-процент выгоднее обычного процента — выбран промокод', () => {
  const o = order({ items: [item(1000)], promoCode: 'P' });
  const engine = new PricingEngine([
    new PercentDiscount({ name: '10%', percent: 10 }),
    new PromoCodeDiscount({ code: 'P', kind: 'percent', value: 20, name: 'P' }),
  ]);
  const r = engine.calculate(o);
  assert.equal(r.appliedDiscounts.length, 1);
  assert.equal(r.appliedDiscounts[0].amount, 200);
  assert.equal(r.finalTotal, 800);
});

test('При равенстве выгоды выбирается промокод', () => {
  const o = order({ items: [item(1000)], promoCode: 'P' });
  const engine = new PricingEngine([
    new PercentDiscount({ name: '10%', percent: 10 }),
    new PromoCodeDiscount({ code: 'P', kind: 'percent', value: 10, name: 'P' }),
  ]);
  const r = engine.calculate(o);
  assert.equal(r.appliedDiscounts.length, 1);
  assert.equal(r.appliedDiscounts[0].name, 'P');
});

test('Большая фиксированная скидка не уводит итог ниже 0', () => {
  const o = order({ items: [item(100)], deliveryCost: 0 });
  const engine = new PricingEngine([
    new FixedDiscount({ name: 'F', value: 9999, threshold: 0 }),
  ]);
  const r = engine.calculate(o);
  assert.equal(r.finalTotal, 0);
  assert.equal(r.appliedDiscounts[0].amount, 100);
});

test('Округление half to even (до копеек)', () => {
  // Прямая проверка "ровно .5 копейки" — на целых копейках, где нет IEEE-погрешности.
  const { roundIntHalfToEven } = require('../src/money');
  assert.equal(roundIntHalfToEven(2.5), 2);   // к чётному
  assert.equal(roundIntHalfToEven(3.5), 4);   // к чётному
  assert.equal(roundIntHalfToEven(234.5), 234);
  assert.equal(roundIntHalfToEven(235.5), 236);
  assert.equal(roundIntHalfToEven(12.4), 12);
  assert.equal(roundIntHalfToEven(12.6), 13);

  // roundMoney возвращает рубли с копейками — проверяем на точно представимых значениях.
  assert.equal(roundMoney(0.125), 0.12); // .125 = 1/8 — точно в double
  assert.equal(roundMoney(0.375), 0.38); // .375 = 3/8
  assert.equal(roundMoney(0.625), 0.62); // .625 = 5/8
  assert.equal(roundMoney(0.875), 0.88); // .875 = 7/8
  assert.equal(roundMoney(2.5), 2.5);    // уже ровно до копеек
});

test('Breakdown: порядок, названия, суммы, причины', () => {
  const o = order({
    items: [item(1000, 1, 'Книги'), item(200, 2, 'Книги')],
    deliveryCost: 100,
  });
  const engine = new PricingEngine([
    new ThreeForTwoDiscount({ name: '3x2', category: 'Книги' }),
    new PercentDiscount({ name: '10%', percent: 10 }),
    new FreeDeliveryDiscount({ name: 'FD', threshold: 1000 }),
  ]);
  const r = engine.calculate(o);
  const names = r.appliedDiscounts.map(d => d.name);
  assert.deepEqual(names, ['3x2', '10%', 'FD']);
  assert.ok(r.appliedDiscounts.every(d => d.amount > 0 && d.reason));
  const sum = r.baseTotal - r.appliedDiscounts.reduce((s, d) => s + d.amount, 0);
  assert.equal(r.finalTotal, roundMoney(sum));
});

test('Пустая корзина — базовая сумма = доставка, итог = доставка', () => {
  const o = order({ items: [], deliveryCost: 300 });
  const engine = new PricingEngine([
    new PercentDiscount({ name: '10%', percent: 10 }),
    new FreeDeliveryDiscount({ name: 'FD', threshold: 0 }), // 0 не > 0 -> не применится
  ]);
  const r = engine.calculate(o);
  assert.equal(r.baseTotal, 300);
  assert.equal(r.finalTotal, 300);
  assert.equal(r.appliedDiscounts.length, 0);
});