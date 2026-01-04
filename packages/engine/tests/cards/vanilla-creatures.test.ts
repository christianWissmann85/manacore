/**
 * Vanilla Creature Tests
 *
 * Tests for creatures with no abilities (just power/toughness).
 * These should work out of the box with no special implementation.
 */

import { describe, test, expect } from 'bun:test';
import { CardLoader, createCardInstance, applyAction } from '../../src/index';
import { setupGameWithMana, castAndResolve } from './helpers';

describe('Vanilla Creatures', () => {
  describe('Goblin Hero', () => {
    test('card exists with correct data', () => {
      const card = CardLoader.getByName('Goblin Hero');
      expect(card).toBeDefined();
      expect(card?.id).toBe('b39f3d36-6648-4e3c-bd9d-336479d1ad72');
      expect(card?.power).toBe('2');
      expect(card?.toughness).toBe('2');
      expect(card?.mana_cost).toBe('{2}{R}');
      expect(card?.cmc).toBe(3);
      expect(card?.type_line).toBe('Creature — Goblin');
      expect(card?.keywords).toEqual([]);
    });

    test('can be cast', () => {
      const goblin = CardLoader.getByName('Goblin Hero')!;
      const state = setupGameWithMana({ R: 3 });

      const goblinCard = createCardInstance(goblin.id, 'player', 'hand');
      state.players.player.hand.push(goblinCard);

      const newState = castAndResolve(state, 'player', goblinCard.instanceId);

      const creature = newState.players.player.battlefield.find(
        c => c.instanceId === goblinCard.instanceId
      );
      expect(creature).toBeDefined();
      expect(creature?.zone).toBe('battlefield');
      expect(creature?.summoningSick).toBe(true);
    });

    test('can attack after summoning sickness', () => {
      const goblin = CardLoader.getByName('Goblin Hero')!;
      const state = setupGameWithMana({ R: 3 });

      const goblinCard = createCardInstance(goblin.id, 'player', 'battlefield');
      goblinCard.summoningSick = false;
      state.players.player.battlefield.push(goblinCard);

      const newState = applyAction(state, {
        type: 'DECLARE_ATTACKERS',
        playerId: 'player',
        payload: { attackers: [goblinCard.instanceId] },
      });

      const attacker = newState.players.player.battlefield.find(
        c => c.instanceId === goblinCard.instanceId
      );
      expect(attacker?.attacking).toBe(true);
    });

    test('deals correct combat damage', () => {
      const goblin = CardLoader.getByName('Goblin Hero')!;
      const state = setupGameWithMana({ R: 3 });
      state.players.opponent.life = 20;

      const goblinCard = createCardInstance(goblin.id, 'player', 'battlefield');
      goblinCard.summoningSick = false;
      state.players.player.battlefield.push(goblinCard);

      let newState = applyAction(state, {
        type: 'DECLARE_ATTACKERS',
        playerId: 'player',
        payload: { attackers: [goblinCard.instanceId] },
      });

      newState = applyAction(newState, {
        type: 'DECLARE_BLOCKERS',
        playerId: 'opponent',
        payload: { blocks: [] },
      });

      expect(newState.players.opponent.life).toBe(18); // 20 - 2
    });
  });

  describe('Grizzly Bears', () => {
    test('card has correct stats', () => {
      const card = CardLoader.getByName('Grizzly Bears');
      expect(card).toBeDefined();
      expect(card?.power).toBe('2');
      expect(card?.toughness).toBe('2');
      expect(card?.mana_cost).toBe('{1}{G}');
    });

    test('can be cast', () => {
      const bears = CardLoader.getByName('Grizzly Bears')!;
      const state = setupGameWithMana({ G: 2 });

      const bearsCard = createCardInstance(bears.id, 'player', 'hand');
      state.players.player.hand.push(bearsCard);

      const newState = castAndResolve(state, 'player', bearsCard.instanceId);

      const creature = newState.players.player.battlefield.find(
        c => c.instanceId === bearsCard.instanceId
      );
      expect(creature).toBeDefined();
    });
  });

  describe('Balduvian Barbarians', () => {
    test('card has correct stats', () => {
      const card = CardLoader.getByName('Balduvian Barbarians');
      expect(card).toBeDefined();
      expect(card?.power).toBe('3');
      expect(card?.toughness).toBe('2');
      expect(card?.mana_cost).toBe('{1}{R}{R}');
    });
  });

  describe('Fire Elemental', () => {
    test('card has correct stats', () => {
      const card = CardLoader.getByName('Fire Elemental');
      expect(card).toBeDefined();
      expect(card?.power).toBe('5');
      expect(card?.toughness).toBe('4');
    });
  });

  describe('Horned Turtle', () => {
    test('card has correct stats', () => {
      const card = CardLoader.getByName('Horned Turtle');
      expect(card).toBeDefined();
      expect(card?.power).toBe('1');
      expect(card?.toughness).toBe('4');
    });
  });
});
