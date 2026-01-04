/**
 * 6th Edition Expansion Tests
 *
 * Validates that all expected cards from 6th Edition are present and correct.
 */

import { describe, test, expect } from 'bun:test';
import { CardLoader } from '../../src/index';

describe('6th Edition Data Validation', () => {
  test('contains expected number of cards', () => {
    const allCards = CardLoader.getAllCards();
    expect(allCards.length).toBeGreaterThan(300);
    expect(allCards.length).toBeLessThan(400);
  });

  test('all non-token cards have set code "6ed"', () => {
    const allCards = CardLoader.getAllCards();
    // Exclude tokens which have set "TOKEN"
    const realCards = allCards.filter(card => card.set !== 'TOKEN');
    for (const card of realCards) {
      expect(card.set).toBe('6ed');
    }
  });
});

describe('6th Edition Core Cards', () => {
  // Key cards that should definitely exist in 6th Edition
  const coreCards = [
    // White
    'Archangel', 'Disenchant', 'Pacifism', 'Exile', 'Wrath of God',
    // Blue
    'Air Elemental', 'Counterspell', 'Unsummon', 'Fog Elemental',
    // Black
    'Abyssal Specter', 'Terror', 'Coercion', 'Gravedigger',
    // Red
    'Lightning Blast', 'Shock', 'Anaba Shaman', 'Balduvian Barbarians',
    // Green
    'Giant Growth', 'Llanowar Elves', 'Grizzly Bears', 'Birds of Paradise',
    // Lands
    'Plains', 'Island', 'Swamp', 'Mountain', 'Forest',
  ];

  for (const cardName of coreCards) {
    test(`${cardName} exists`, () => {
      const card = CardLoader.getByName(cardName);
      expect(card).toBeDefined();
    });
  }
});

describe('6th Edition Implemented Cards', () => {
  // Cards with full implementations (abilities work)
  const implementedCards = [
    // Mana dorks
    { name: 'Llanowar Elves', check: (c: any) => c.oracle_text?.includes('{T}: Add {G}') },
    { name: 'Birds of Paradise', check: (c: any) => c.keywords?.includes('Flying') },
    // Burn
    { name: 'Shock', check: (c: any) => c.oracle_text?.includes('2 damage') },
    { name: 'Lightning Blast', check: (c: any) => c.oracle_text?.includes('4 damage') },
    // Removal
    { name: 'Terror', check: (c: any) => c.oracle_text?.toLowerCase().includes('destroy') },
    { name: 'Unsummon', check: (c: any) => c.oracle_text?.toLowerCase().includes('return') },
    { name: 'Disenchant', check: (c: any) => c.oracle_text?.toLowerCase().includes('artifact or enchantment') },
    // Auras
    { name: 'Pacifism', check: (c: any) => c.type_line?.includes('Aura') },
    // Combat tricks
    { name: 'Giant Growth', check: (c: any) => c.oracle_text?.includes('+3/+3') },
    // Counter
    { name: 'Counterspell', check: (c: any) => c.oracle_text?.toLowerCase().includes('counter') },
    // Triggers
    { name: 'Gravedigger', check: (c: any) => c.oracle_text?.toLowerCase().includes('when') },
    { name: 'Abyssal Specter', check: (c: any) => c.oracle_text?.toLowerCase().includes('whenever') },
  ];

  for (const { name, check } of implementedCards) {
    test(`${name} has expected text`, () => {
      const card = CardLoader.getByName(name);
      expect(card).toBeDefined();
      expect(check(card)).toBe(true);
    });
  }
});

describe('6th Edition Type Distribution', () => {
  test('has creatures', () => {
    const creatures = CardLoader.getCardsByType('Creature');
    expect(creatures.length).toBeGreaterThan(100);
  });

  test('has instants', () => {
    const instants = CardLoader.getCardsByType('Instant');
    expect(instants.length).toBeGreaterThan(30);
  });

  test('has sorceries', () => {
    const sorceries = CardLoader.getCardsByType('Sorcery');
    expect(sorceries.length).toBeGreaterThan(40);
  });

  test('has enchantments', () => {
    const enchantments = CardLoader.getCardsByType('Enchantment');
    expect(enchantments.length).toBeGreaterThan(40);
  });

  test('has artifacts', () => {
    const artifacts = CardLoader.getCardsByType('Artifact');
    expect(artifacts.length).toBeGreaterThan(30);
  });

  test('has lands', () => {
    const lands = CardLoader.getCardsByType('Land');
    expect(lands.length).toBeGreaterThan(10);
  });
});

describe('6th Edition Color Distribution', () => {
  const colors = [
    { code: 'W', name: 'White' },
    { code: 'U', name: 'Blue' },
    { code: 'B', name: 'Black' },
    { code: 'R', name: 'Red' },
    { code: 'G', name: 'Green' },
  ];

  for (const { code, name } of colors) {
    test(`has ${name} cards`, () => {
      const cards = CardLoader.getCardsByColor(code);
      expect(cards.length).toBeGreaterThan(40);
    });
  }

  test('has colorless cards', () => {
    const allCards = CardLoader.getAllCards();
    const colorless = allCards.filter(c => c.colors.length === 0);
    expect(colorless.length).toBeGreaterThan(50); // Artifacts + Lands
  });
});
