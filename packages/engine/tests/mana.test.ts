/**
 * Mana System Tests
 *
 * Tests for:
 * - Mana cost parsing
 * - Mana pool operations
 * - Mana affordability checking
 * - Auto-tapping
 * - X costs
 * - Mana abilities
 */

import { test, expect, describe, beforeEach } from 'bun:test';
import {
  parseManaCost,
  canPayManaCost,
  payManaCost,
  addManaToPool,
  formatManaPool,
  formatManaCost,
  getLandManaColors,
  hasXInCost,
  getTotalMana,
  getConvertedManaCost,
  createEmptyManaPool,
  type ManaPool,
  type ManaCost,
} from '../src/index';

describe('Mana Cost Parsing', () => {
  test('parses empty cost (lands)', () => {
    const cost = parseManaCost('');
    expect(cost.generic).toBe(0);
    expect(cost.white).toBe(0);
    expect(cost.x).toBe(0);
  });

  test('parses single color cost', () => {
    const cost = parseManaCost('{R}');
    expect(cost.red).toBe(1);
    expect(cost.generic).toBe(0);
  });

  test('parses generic + color cost', () => {
    const cost = parseManaCost('{2}{R}{R}');
    expect(cost.generic).toBe(2);
    expect(cost.red).toBe(2);
  });

  test('parses multi-color cost', () => {
    const cost = parseManaCost('{1}{W}{U}{B}');
    expect(cost.generic).toBe(1);
    expect(cost.white).toBe(1);
    expect(cost.blue).toBe(1);
    expect(cost.black).toBe(1);
  });

  test('parses X cost', () => {
    const cost = parseManaCost('{X}{R}');
    expect(cost.x).toBe(1);
    expect(cost.red).toBe(1);
  });

  test('parses double X cost', () => {
    const cost = parseManaCost('{X}{X}{G}');
    expect(cost.x).toBe(2);
    expect(cost.green).toBe(1);
  });

  test('parses colorless cost', () => {
    const cost = parseManaCost('{2}{C}{C}');
    expect(cost.generic).toBe(2);
    expect(cost.colorless).toBe(2);
  });
});

describe('Mana Pool Operations', () => {
  test('creates empty mana pool', () => {
    const pool = createEmptyManaPool();
    expect(getTotalMana(pool)).toBe(0);
  });

  test('adds mana to pool', () => {
    let pool = createEmptyManaPool();
    pool = addManaToPool(pool, 'R', 1);
    expect(pool.red).toBe(1);
    expect(getTotalMana(pool)).toBe(1);
  });

  test('adds multiple mana to pool', () => {
    let pool = createEmptyManaPool();
    pool = addManaToPool(pool, 'G', 3);
    expect(pool.green).toBe(3);
  });

  test('formats mana pool', () => {
    let pool = createEmptyManaPool();
    pool = addManaToPool(pool, 'R', 2);
    pool = addManaToPool(pool, 'G', 1);
    expect(formatManaPool(pool)).toBe('{R}{R}{G}');
  });

  test('formats empty mana pool', () => {
    const pool = createEmptyManaPool();
    expect(formatManaPool(pool)).toBe('Empty');
  });
});

describe('Mana Affordability', () => {
  test('can pay simple cost with exact mana', () => {
    let pool = createEmptyManaPool();
    pool = addManaToPool(pool, 'R', 1);
    const cost = parseManaCost('{R}');
    expect(canPayManaCost(pool, cost)).toBe(true);
  });

  test('cannot pay cost with insufficient mana', () => {
    const pool = createEmptyManaPool();
    const cost = parseManaCost('{R}');
    expect(canPayManaCost(pool, cost)).toBe(false);
  });

  test('can pay generic with any color', () => {
    let pool = createEmptyManaPool();
    pool = addManaToPool(pool, 'G', 3);
    const cost = parseManaCost('{2}{G}');
    expect(canPayManaCost(pool, cost)).toBe(true);
  });

  test('cannot pay with wrong color', () => {
    let pool = createEmptyManaPool();
    pool = addManaToPool(pool, 'U', 2);
    const cost = parseManaCost('{R}{R}');
    expect(canPayManaCost(pool, cost)).toBe(false);
  });

  test('can pay X cost with X=0', () => {
    let pool = createEmptyManaPool();
    pool = addManaToPool(pool, 'R', 1);
    const cost = parseManaCost('{X}{R}');
    expect(canPayManaCost(pool, cost, 0)).toBe(true);
  });

  test('can pay X cost with X=3', () => {
    let pool = createEmptyManaPool();
    pool = addManaToPool(pool, 'R', 4);
    const cost = parseManaCost('{X}{R}');
    expect(canPayManaCost(pool, cost, 3)).toBe(true);
  });

  test('cannot pay X cost with insufficient mana', () => {
    let pool = createEmptyManaPool();
    pool = addManaToPool(pool, 'R', 2);
    const cost = parseManaCost('{X}{R}');
    expect(canPayManaCost(pool, cost, 5)).toBe(false);
  });
});

describe('Mana Payment', () => {
  test('pays exact color cost', () => {
    let pool = createEmptyManaPool();
    pool = addManaToPool(pool, 'R', 2);
    const cost = parseManaCost('{R}{R}');
    const newPool = payManaCost(pool, cost);
    expect(newPool.red).toBe(0);
  });

  test('pays generic with colored mana', () => {
    let pool = createEmptyManaPool();
    pool = addManaToPool(pool, 'G', 3);
    const cost = parseManaCost('{2}{G}');
    const newPool = payManaCost(pool, cost);
    expect(newPool.green).toBe(0);
  });

  test('leaves excess mana in pool', () => {
    let pool = createEmptyManaPool();
    pool = addManaToPool(pool, 'R', 5);
    const cost = parseManaCost('{R}{R}');
    const newPool = payManaCost(pool, cost);
    expect(newPool.red).toBe(3);
  });

  test('throws on insufficient mana', () => {
    const pool = createEmptyManaPool();
    const cost = parseManaCost('{R}');
    expect(() => payManaCost(pool, cost)).toThrow();
  });

  test('pays X cost correctly', () => {
    let pool = createEmptyManaPool();
    pool = addManaToPool(pool, 'R', 4);
    const cost = parseManaCost('{X}{R}');
    const newPool = payManaCost(pool, cost, 3);
    expect(newPool.red).toBe(0);
  });
});

describe('Land Mana Colors', () => {
  test('Mountain produces red', () => {
    const colors = getLandManaColors('Basic Land — Mountain');
    expect(colors).toContain('R');
  });

  test('Island produces blue', () => {
    const colors = getLandManaColors('Basic Land — Island');
    expect(colors).toContain('U');
  });

  test('Plains produces white', () => {
    const colors = getLandManaColors('Basic Land — Plains');
    expect(colors).toContain('W');
  });

  test('Swamp produces black', () => {
    const colors = getLandManaColors('Basic Land — Swamp');
    expect(colors).toContain('B');
  });

  test('Forest produces green', () => {
    const colors = getLandManaColors('Basic Land — Forest');
    expect(colors).toContain('G');
  });

  test('Dual land produces multiple colors', () => {
    const colors = getLandManaColors('Land — Plains Island');
    expect(colors).toContain('W');
    expect(colors).toContain('U');
  });

  test('Non-basic land returns empty for generic type', () => {
    const colors = getLandManaColors('Land');
    expect(colors.length).toBe(0);
  });
});

describe('X Cost Detection', () => {
  test('detects X in cost', () => {
    expect(hasXInCost('{X}{R}')).toBe(true);
  });

  test('detects multiple X in cost', () => {
    expect(hasXInCost('{X}{X}{G}')).toBe(true);
  });

  test('no X in regular cost', () => {
    expect(hasXInCost('{2}{R}{R}')).toBe(false);
  });

  test('handles undefined cost', () => {
    expect(hasXInCost(undefined)).toBe(false);
  });
});

describe('Converted Mana Cost', () => {
  test('calculates CMC for simple cost', () => {
    const cost = parseManaCost('{R}');
    expect(getConvertedManaCost(cost)).toBe(1);
  });

  test('calculates CMC for complex cost', () => {
    const cost = parseManaCost('{2}{R}{R}');
    expect(getConvertedManaCost(cost)).toBe(4);
  });

  test('X is not included in CMC', () => {
    const cost = parseManaCost('{X}{R}');
    expect(getConvertedManaCost(cost)).toBe(1);
  });
});

describe('Mana Cost Formatting', () => {
  test('formats simple cost', () => {
    const cost = parseManaCost('{R}');
    expect(formatManaCost(cost)).toBe('{R}');
  });

  test('formats generic + color cost', () => {
    const cost = parseManaCost('{2}{R}');
    expect(formatManaCost(cost)).toBe('{2}{R}');
  });

  test('formats X cost', () => {
    const cost = parseManaCost('{X}{R}');
    expect(formatManaCost(cost)).toBe('{X}{R}');
  });

  test('formats zero cost', () => {
    const cost = parseManaCost('');
    expect(formatManaCost(cost)).toBe('{0}');
  });
});
