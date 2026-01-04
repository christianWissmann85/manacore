/**
 * Removal Spell Tests
 *
 * Tests for spells that remove permanents (destroy, exile, bounce).
 */

import { describe, test, expect } from 'bun:test';
import { CardLoader, createCardInstance } from '../../src/index';
import { setupGameWithMana, castAndResolve } from './helpers';

describe('Destroy Effects', () => {
  describe('Terror', () => {
    test('card exists with correct text', () => {
      const card = CardLoader.getByName('Terror');
      expect(card).toBeDefined();
      expect(card?.mana_cost).toBe('{1}{B}');
      expect(card?.oracle_text?.toLowerCase()).toContain('destroy');
      expect(card?.oracle_text?.toLowerCase()).toContain('nonartifact');
      expect(card?.oracle_text?.toLowerCase()).toContain('nonblack');
    });

    test('destroys a nonblack creature', () => {
      const terror = CardLoader.getByName('Terror')!;
      const bears = CardLoader.getByName('Grizzly Bears')!;
      const state = setupGameWithMana({ B: 2 });

      const bearsCard = createCardInstance(bears.id, 'opponent', 'battlefield');
      state.players.opponent.battlefield.push(bearsCard);

      const terrorCard = createCardInstance(terror.id, 'player', 'hand');
      state.players.player.hand.push(terrorCard);

      const newState = castAndResolve(state, 'player', terrorCard.instanceId, [bearsCard.instanceId]);

      expect(newState.players.opponent.graveyard.some(c => c.instanceId === bearsCard.instanceId)).toBe(true);
      expect(newState.players.opponent.battlefield.some(c => c.instanceId === bearsCard.instanceId)).toBe(false);
    });
  });

  describe('Disenchant', () => {
    test('card exists with correct text', () => {
      const card = CardLoader.getByName('Disenchant');
      expect(card).toBeDefined();
      expect(card?.mana_cost).toBe('{1}{W}');
      expect(card?.oracle_text?.toLowerCase()).toContain('destroy target artifact or enchantment');
    });

    test('destroys an enchantment', () => {
      const disenchant = CardLoader.getByName('Disenchant')!;
      const pacifism = CardLoader.getByName('Pacifism')!;
      const state = setupGameWithMana({ W: 2 });

      const pacifismCard = createCardInstance(pacifism.id, 'opponent', 'battlefield');
      state.players.opponent.battlefield.push(pacifismCard);

      const disenchantCard = createCardInstance(disenchant.id, 'player', 'hand');
      state.players.player.hand.push(disenchantCard);

      const newState = castAndResolve(state, 'player', disenchantCard.instanceId, [pacifismCard.instanceId]);

      expect(newState.players.opponent.graveyard.some(c => c.instanceId === pacifismCard.instanceId)).toBe(true);
      expect(newState.players.opponent.battlefield.some(c => c.instanceId === pacifismCard.instanceId)).toBe(false);
    });
  });
});

describe('Exile Effects', () => {
  describe('Exile', () => {
    test('card exists with correct text', () => {
      const card = CardLoader.getByName('Exile');
      expect(card).toBeDefined();
      expect(card?.oracle_text?.toLowerCase()).toContain('exile');
      expect(card?.oracle_text?.toLowerCase()).toContain('gain');
    });

    test('exiles attacking creature and gains life', () => {
      const exile = CardLoader.getByName('Exile')!;
      const bears = CardLoader.getByName('Grizzly Bears')!;
      const state = setupGameWithMana({ W: 3 });
      state.players.player.life = 20;

      const bearsCard = createCardInstance(bears.id, 'opponent', 'battlefield');
      bearsCard.summoningSick = false;
      bearsCard.attacking = true;
      state.players.opponent.battlefield.push(bearsCard);

      const exileCard = createCardInstance(exile.id, 'player', 'hand');
      state.players.player.hand.push(exileCard);

      const newState = castAndResolve(state, 'player', exileCard.instanceId, [bearsCard.instanceId]);

      expect(newState.players.opponent.battlefield.some(c => c.instanceId === bearsCard.instanceId)).toBe(false);
      expect(newState.players.player.life).toBe(22); // 20 + 2 (Bears toughness)
    });
  });
});

describe('Bounce Effects', () => {
  describe('Unsummon', () => {
    test('card exists with correct text', () => {
      const card = CardLoader.getByName('Unsummon');
      expect(card).toBeDefined();
      expect(card?.mana_cost).toBe('{U}');
      expect(card?.oracle_text?.toLowerCase()).toContain('return target creature');
      expect(card?.oracle_text?.toLowerCase()).toContain("owner's hand");
    });

    test('returns a creature to hand', () => {
      const unsummon = CardLoader.getByName('Unsummon')!;
      const bears = CardLoader.getByName('Grizzly Bears')!;
      const state = setupGameWithMana({ U: 1 });

      const bearsCard = createCardInstance(bears.id, 'opponent', 'battlefield');
      bearsCard.summoningSick = false;
      state.players.opponent.battlefield.push(bearsCard);

      const unsummonCard = createCardInstance(unsummon.id, 'player', 'hand');
      state.players.player.hand.push(unsummonCard);

      const newState = castAndResolve(state, 'player', unsummonCard.instanceId, [bearsCard.instanceId]);

      expect(newState.players.opponent.hand.some(c => c.instanceId === bearsCard.instanceId)).toBe(true);
      expect(newState.players.opponent.battlefield.some(c => c.instanceId === bearsCard.instanceId)).toBe(false);
    });
  });
});

describe('Discard Effects', () => {
  describe('Coercion', () => {
    test('card exists with correct text', () => {
      const card = CardLoader.getByName('Coercion');
      expect(card).toBeDefined();
      expect(card?.mana_cost).toBe('{2}{B}');
      expect(card?.oracle_text?.toLowerCase()).toContain('reveals');
      expect(card?.oracle_text?.toLowerCase()).toContain('choose');
    });

    test('makes opponent discard a card', () => {
      const coercion = CardLoader.getByName('Coercion')!;
      const bears = CardLoader.getByName('Grizzly Bears')!;
      const state = setupGameWithMana({ B: 3 });

      const opponentCard1 = createCardInstance(bears.id, 'opponent', 'hand');
      const opponentCard2 = createCardInstance(bears.id, 'opponent', 'hand');
      state.players.opponent.hand = [opponentCard1, opponentCard2];
      const initialHandSize = state.players.opponent.hand.length;

      const coercionCard = createCardInstance(coercion.id, 'player', 'hand');
      state.players.player.hand.push(coercionCard);

      const newState = castAndResolve(state, 'player', coercionCard.instanceId, ['opponent']);

      expect(newState.players.opponent.hand.length).toBe(initialHandSize - 1);
      expect(newState.players.opponent.graveyard.length).toBe(1);
    });
  });
});
