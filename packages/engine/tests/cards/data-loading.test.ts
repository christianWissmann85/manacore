/**
 * Card Data Loading Tests
 *
 * Verifies that cards load correctly from the JSON data files.
 */

import { describe, test, expect } from 'bun:test';
import { CardLoader } from '../../src/index';

describe('CardLoader', () => {
  test('loads cards from 6th Edition', () => {
    const allCards = CardLoader.getAllCards();
    expect(allCards.length).toBeGreaterThan(300);
  });

  test('can retrieve cards by name', () => {
    const mountain = CardLoader.getByName('Mountain');
    expect(mountain).toBeDefined();
    expect(mountain?.type_line).toContain('Land');
  });

  test('can retrieve cards by ID', () => {
    const mountain = CardLoader.getByName('Mountain')!;
    const byId = CardLoader.getById(mountain.id);
    expect(byId).toBeDefined();
    expect(byId?.name).toBe('Mountain');
  });

  test('name lookup is case-insensitive', () => {
    const lower = CardLoader.getByName('grizzly bears');
    const upper = CardLoader.getByName('GRIZZLY BEARS');
    const mixed = CardLoader.getByName('Grizzly Bears');

    expect(lower).toBeDefined();
    expect(upper).toBeDefined();
    expect(mixed).toBeDefined();
    expect(lower?.id).toBe(upper?.id);
    expect(upper?.id).toBe(mixed?.id);
  });

  test('returns undefined for non-existent cards', () => {
    const fake = CardLoader.getByName('Not A Real Card');
    expect(fake).toBeUndefined();
  });
});

describe('Card Data Integrity', () => {
  test('all cards have required fields', () => {
    const allCards = CardLoader.getAllCards();

    for (const card of allCards) {
      expect(card.id).toBeDefined();
      expect(card.name).toBeDefined();
      expect(card.type_line).toBeDefined();
      expect(card.colors).toBeDefined();
      expect(Array.isArray(card.colors)).toBe(true);
    }
  });

  test('creatures have power and toughness', () => {
    const creatures = CardLoader.getCardsByType('Creature');
    expect(creatures.length).toBeGreaterThan(100);

    for (const creature of creatures) {
      expect(creature.power).toBeDefined();
      expect(creature.toughness).toBeDefined();
    }
  });

  test('non-land cards have mana costs', () => {
    const allCards = CardLoader.getAllCards();
    const nonLands = allCards.filter((c) => !c.type_line.includes('Land'));

    for (const card of nonLands) {
      expect(card.mana_cost).toBeDefined();
      expect(card.cmc).toBeDefined();
    }
  });
});
