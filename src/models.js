'use strict';

class Product {
  constructor({ id, name, basePrice, category }) {
    if (!id) throw new Error('Product.id обязателен');
    if (basePrice < 0) throw new Error('basePrice не может быть отрицательной');
    this.id = id;
    this.name = name;
    this.basePrice = basePrice;
    this.category = category;
  }
}

class CartItem {
  constructor({ product, quantity }) {
    if (!(product instanceof Product)) throw new Error('CartItem требует Product');
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('quantity должно быть целым > 0');
    }
    this.product = product;
    this.quantity = quantity;
  }

  get total() {
    return this.product.basePrice * this.quantity;
  }
}

class Customer {
  constructor({ id, lastPurchaseDate = null, isFirstOrder = false }) {
    this.id = id;
    this.lastPurchaseDate = lastPurchaseDate; // Date | null
    this.isFirstOrder = !!isFirstOrder;
  }
}

class Order {
  constructor({ id, customer, items, promoCode = null, createdAt, deliveryCost = 0 }) {
    if (!(customer instanceof Customer)) throw new Error('Order требует Customer');
    if (!Array.isArray(items)) throw new Error('items должен быть массивом');
    if (deliveryCost < 0) throw new Error('deliveryCost не может быть отрицательной');
    this.id = id;
    this.customer = customer;
    this.items = items;
    this.promoCode = promoCode;
    this.createdAt = createdAt instanceof Date ? createdAt : new Date(createdAt);
    this.deliveryCost = deliveryCost;
  }
}

module.exports = { Product, CartItem, Customer, Order };