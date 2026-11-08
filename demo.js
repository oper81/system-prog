'use strict';

const { Product, CartItem, Customer, Order } = require('./src/models');
const { DiscountFactory } = require('./src/factory');
const { PricingEngine } = require('./src/pricingEngine');
const { ConfigProvider } = require('./src/configProvider');

const cfg = ConfigProvider.getInstance();
cfg.setDiscounts([
  { type: 'percent', value: 10, name: 'Осенняя распродажа' },
  { type: 'fixed', value: 500, threshold: 3000, name: '500 рублей от 3000' },
  { type: 'threeForTwo', category: 'Книги', name: '3 по цене 2' },
  { type: 'loyalty', percent: 5, days: 30, name: 'Лояльность' },
  { type: 'freeDelivery', threshold: 5000, name: 'Бесплатная доставка' },
  { type: 'firstOrder', percent: 10, name: 'Первый заказ' },
]);
cfg.setPromos([
  { type: 'promo', code: 'SUMMER15', kind: 'percent', value: 15, validUntil: '2026-12-31', active: true },
]);

const book1 = new Product({ id: 'b1', name: 'Книга A', basePrice: 500, category: 'Книги' });
const book2 = new Product({ id: 'b2', name: 'Книга B', basePrice: 300, category: 'Книги' });
const pen = new Product({ id: 'p1', name: 'Ручка', basePrice: 100, category: 'Канцелярия' });

const order = new Order({
  id: 'ORD-1',
  customer: new Customer({
    id: 'c1',
    lastPurchaseDate: new Date('2026-10-27'),
    isFirstOrder: false,
  }),
  items: [
    new CartItem({ product: book1, quantity: 3 }),
    new CartItem({ product: book2, quantity: 2 }),
    new CartItem({ product: pen, quantity: 5 }),
  ],
  promoCode: 'SUMMER15',
  createdAt: new Date('2026-11-08'),
  deliveryCost: 300,
});

const discounts = DiscountFactory.createMany(cfg.getDiscounts());
const engine = new PricingEngine(discounts);
const result = engine.calculate(order);
console.log(JSON.stringify(result.toJSON(), null, 2));