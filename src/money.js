'use strict';

/**
 * Банковское округление (round half to even) до копеек.
 * Работаем в целых копейках, чтобы избежать ошибок плавающей точки.
 */
function roundHalfToEven(value) {
  const kopecks = value * 100;
  const rounded = roundIntHalfToEven(kopecks);
  return rounded / 100;
}

function roundIntHalfToEven(x) {
  const sign = Math.sign(x);
  const abs = Math.abs(x);
  const floor = Math.floor(abs);
  const diff = abs - floor;

  if (diff > 0.5) return sign * (floor + 1);
  if (diff < 0.5) return sign * floor;

  // ровно .5 — к чётному
  return sign * (floor % 2 === 0 ? floor : floor + 1);
}

function roundMoney(value) {
  return roundHalfToEven(value);
}

module.exports = { roundMoney, roundHalfToEven, roundIntHalfToEven };