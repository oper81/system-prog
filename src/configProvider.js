'use strict';

/**
 * Синглтон — хранит конфигурацию акций и промокодов.
 * НЕ хранит состояние конкретного заказа.
 */
class ConfigProvider {
  static #instance = null;

  static getInstance() {
    if (!ConfigProvider.#instance) {
      ConfigProvider.#instance = new ConfigProvider();
    }
    return ConfigProvider.#instance;
  }

  constructor() {
    if (ConfigProvider.#instance) return ConfigProvider.#instance;
    this._discountConfigs = [];
    this._promoConfigs = [];
    ConfigProvider.#instance = this;
  }

  setDiscounts(configs) {
    this._discountConfigs = configs.slice();
    return this;
  }

  setPromos(configs) {
    this._promoConfigs = configs.slice();
    return this;
  }

  getDiscounts() { return this._discountConfigs.slice(); }
  getPromos() { return this._promoConfigs.slice(); }

  reset() {
    this._discountConfigs = [];
    this._promoConfigs = [];
  }
}

module.exports = { ConfigProvider };