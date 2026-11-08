'use strict';

const { registry } = require('./registry');

class DiscountFactory {
  /** Создать одну стратегию по конфигу. */
  static create(type, config) {
    return registry.create(type, config);
  }

  /** Создать массив стратегий из массива конфигов. */
  static createMany(configs) {
    if (!Array.isArray(configs)) throw new Error('configs должен быть массивом');
    return configs.map(cfg => {
      const type = cfg.type;
      if (!type) throw new Error('В конфиге отсутствует type');
      return DiscountFactory.create(type, cfg);
    });
  }
}

module.exports = { DiscountFactory };