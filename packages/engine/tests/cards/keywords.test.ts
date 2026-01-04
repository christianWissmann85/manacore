/**
 * Keyword Ability Tests
 *
 * Tests for creatures with keyword abilities (Flying, First Strike, etc.).
 * Keywords are handled automatically by the combat system.
 */

import { describe, test, expect } from 'bun:test';
import { CardLoader, createCardInstance, applyAction } from '../../src/index';
import { setupGameWithMana, castAndResolve } from './helpers';

describe('Flying', () => {
  describe('Air Elemental', () => {
    test('card has Flying keyword', () => {
      const card = CardLoader.getByName('Air Elemental');
      expect(card).toBeDefined();
      expect(card?.power).toBe('4');
      expect(card?.toughness).toBe('4');
      expect(card?.keywords).toContain('Flying');
    });
  });

  describe('Fog Elemental', () => {
    test('card has Flying keyword', () => {
      const card = CardLoader.getByName('Fog Elemental');
      expect(card).toBeDefined();
      expect(card?.power).toBe('4');
      expect(card?.toughness).toBe('4');
      expect(card?.keywords).toContain('Flying');
    });
  });

  describe('Birds of Paradise', () => {
    test('card has Flying keyword', () => {
      const card = CardLoader.getByName('Birds of Paradise');
      expect(card).toBeDefined();
      expect(card?.power).toBe('0');
      expect(card?.toughness).toBe('1');
      expect(card?.keywords).toContain('Flying');
    });
  });

  describe('Abyssal Specter', () => {
    test('card has Flying keyword', () => {
      const card = CardLoader.getByName('Abyssal Specter');
      expect(card).toBeDefined();
      expect(card?.keywords).toContain('Flying');
    });
  });
});

describe('Flying + Vigilance', () => {
  describe('Archangel', () => {
    test('card has correct stats and keywords', () => {
      const card = CardLoader.getByName('Archangel');
      expect(card).toBeDefined();
      expect(card?.power).toBe('5');
      expect(card?.toughness).toBe('5');
      expect(card?.keywords).toContain('Flying');
      expect(card?.keywords).toContain('Vigilance');
    });

    test('can be cast', () => {
      const archangel = CardLoader.getByName('Archangel')!;
      const state = setupGameWithMana({ W: 7 }); // {5}{W}{W}

      const card = createCardInstance(archangel.id, 'player', 'hand');
      state.players.player.hand.push(card);

      const newState = castAndResolve(state, 'player', card.instanceId);

      const creature = newState.players.player.battlefield.find(
        c => c.instanceId === card.instanceId
      );
      expect(creature).toBeDefined();
      expect(creature?.summoningSick).toBe(true);
    });

    test('does not tap when attacking (Vigilance)', () => {
      const archangel = CardLoader.getByName('Archangel')!;
      const state = setupGameWithMana({ W: 7 });

      const card = createCardInstance(archangel.id, 'player', 'battlefield');
      card.summoningSick = false;
      state.players.player.battlefield.push(card);

      const newState = applyAction(state, {
        type: 'DECLARE_ATTACKERS',
        playerId: 'player',
        payload: { attackers: [card.instanceId] },
      });

      const attacker = newState.players.player.battlefield.find(
        c => c.instanceId === card.instanceId
      );
      expect(attacker?.attacking).toBe(true);
      expect(attacker?.tapped).toBe(false); // Vigilance!
    });
  });
});

describe('First Strike', () => {
  describe('Anaba Bodyguard', () => {
    test('card has First Strike keyword', () => {
      const card = CardLoader.getByName('Anaba Bodyguard');
      expect(card).toBeDefined();
      expect(card?.keywords).toContain('First strike');
    });
  });
});

describe('Keyword Helper Functions', () => {
  test('hasFlying returns true for flying creatures', () => {
    const { hasFlying } = require('../../src/cards/CardTemplate');
    const airElemental = CardLoader.getByName('Air Elemental')!;
    const bears = CardLoader.getByName('Grizzly Bears')!;

    expect(hasFlying(airElemental)).toBe(true);
    expect(hasFlying(bears)).toBe(false);
  });

  test('hasVigilance returns true for vigilant creatures', () => {
    const { hasVigilance } = require('../../src/cards/CardTemplate');
    const archangel = CardLoader.getByName('Archangel')!;
    const bears = CardLoader.getByName('Grizzly Bears')!;

    expect(hasVigilance(archangel)).toBe(true);
    expect(hasVigilance(bears)).toBe(false);
  });

  test('hasFirstStrike returns true for first strikers', () => {
    const { hasFirstStrike } = require('../../src/cards/CardTemplate');
    const bodyguard = CardLoader.getByName('Anaba Bodyguard')!;
    const bears = CardLoader.getByName('Grizzly Bears')!;

    expect(hasFirstStrike(bodyguard)).toBe(true);
    expect(hasFirstStrike(bears)).toBe(false);
  });
});
