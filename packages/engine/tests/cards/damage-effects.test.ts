/**
 * Damage Effect Tests
 *
 * Tests for spells and abilities that deal damage.
 */

import { describe, test, expect } from 'bun:test';
import {
  CardLoader,
  createCardInstance,
  applyAction,
  type ActivateAbilityAction,
} from '../../src/index';
import { setupGameWithMana, castAndResolve } from './helpers';

describe('Burn Spells', () => {
  describe('Shock', () => {
    test('card exists with correct cost', () => {
      const card = CardLoader.getByName('Shock');
      expect(card).toBeDefined();
      expect(card?.mana_cost).toBe('{R}');
      expect(card?.cmc).toBe(1);
      expect(card?.oracle_text?.toLowerCase()).toContain('2 damage');
    });

    test('deals 2 damage to opponent', () => {
      const shock = CardLoader.getByName('Shock')!;
      const state = setupGameWithMana({ R: 1 });
      state.players.opponent.life = 20;

      const shockCard = createCardInstance(shock.id, 'player', 'hand');
      state.players.player.hand.push(shockCard);

      const newState = castAndResolve(state, 'player', shockCard.instanceId, ['opponent']);

      expect(newState.players.opponent.life).toBe(18); // 20 - 2
    });

    test('deals 2 damage to creature', () => {
      const shock = CardLoader.getByName('Shock')!;
      const bears = CardLoader.getByName('Grizzly Bears')!;
      const state = setupGameWithMana({ R: 1 });

      const bearsCard = createCardInstance(bears.id, 'opponent', 'battlefield');
      state.players.opponent.battlefield.push(bearsCard);

      const shockCard = createCardInstance(shock.id, 'player', 'hand');
      state.players.player.hand.push(shockCard);

      const newState = castAndResolve(state, 'player', shockCard.instanceId, [
        bearsCard.instanceId,
      ]);

      // 2/2 creature dies to 2 damage
      expect(
        newState.players.opponent.graveyard.some((c) => c.instanceId === bearsCard.instanceId),
      ).toBe(true);
    });
  });

  describe('Lightning Blast', () => {
    test('card exists with correct cost', () => {
      const card = CardLoader.getByName('Lightning Blast');
      expect(card).toBeDefined();
      expect(card?.mana_cost).toBe('{3}{R}');
      expect(card?.cmc).toBe(4);
      expect(card?.oracle_text?.toLowerCase()).toContain('4 damage');
    });

    test('deals 4 damage to opponent', () => {
      const blast = CardLoader.getByName('Lightning Blast')!;
      const state = setupGameWithMana({ R: 4 });
      state.players.opponent.life = 20;

      const blastCard = createCardInstance(blast.id, 'player', 'hand');
      state.players.player.hand.push(blastCard);

      const newState = castAndResolve(state, 'player', blastCard.instanceId, ['opponent']);

      expect(newState.players.opponent.life).toBe(16); // 20 - 4
    });

    test('kills a 4/4 creature', () => {
      const blast = CardLoader.getByName('Lightning Blast')!;
      const elemental = CardLoader.getByName('Air Elemental')!;
      const state = setupGameWithMana({ R: 4 });

      const creatureCard = createCardInstance(elemental.id, 'opponent', 'battlefield');
      state.players.opponent.battlefield.push(creatureCard);

      const blastCard = createCardInstance(blast.id, 'player', 'hand');
      state.players.player.hand.push(blastCard);

      const newState = castAndResolve(state, 'player', blastCard.instanceId, [
        creatureCard.instanceId,
      ]);

      expect(
        newState.players.opponent.graveyard.some((c) => c.instanceId === creatureCard.instanceId),
      ).toBe(true);
    });

    test('does not kill a 5/5 creature', () => {
      const blast = CardLoader.getByName('Lightning Blast')!;
      const archangel = CardLoader.getByName('Archangel')!;
      const state = setupGameWithMana({ R: 4 });

      const creatureCard = createCardInstance(archangel.id, 'opponent', 'battlefield');
      state.players.opponent.battlefield.push(creatureCard);

      const blastCard = createCardInstance(blast.id, 'player', 'hand');
      state.players.player.hand.push(blastCard);

      const newState = castAndResolve(state, 'player', blastCard.instanceId, [
        creatureCard.instanceId,
      ]);

      // 5/5 survives 4 damage
      const creature = newState.players.opponent.battlefield.find(
        (c) => c.instanceId === creatureCard.instanceId,
      );
      expect(creature).toBeDefined();
      expect(creature!.damage).toBe(4);
    });
  });
});

describe('Damage Abilities', () => {
  describe('Anaba Shaman', () => {
    test('card exists with tap damage ability', () => {
      const card = CardLoader.getByName('Anaba Shaman');
      expect(card).toBeDefined();
      expect(card?.power).toBe('2');
      expect(card?.toughness).toBe('2');
      expect(card?.oracle_text?.toLowerCase()).toContain('{r}');
      expect(card?.oracle_text?.toLowerCase()).toContain('{t}');
      expect(card?.oracle_text?.toLowerCase()).toContain('1 damage');
    });

    test('tap ability deals 1 damage', () => {
      const shaman = CardLoader.getByName('Anaba Shaman')!;
      const state = setupGameWithMana({ R: 1 });
      state.players.opponent.life = 20;

      const shamanCard = createCardInstance(shaman.id, 'player', 'battlefield');
      shamanCard.summoningSick = false;
      state.players.player.battlefield.push(shamanCard);

      // Tap Mountain for mana
      const mountain = state.players.player.battlefield.find(
        (c) => CardLoader.getById(c.scryfallId)?.name === 'Mountain',
      )!;

      let newState = applyAction(state, {
        type: 'ACTIVATE_ABILITY',
        playerId: 'player',
        payload: {
          sourceId: mountain.instanceId,
          abilityId: mountain.instanceId + '_tap_mana',
          manaColorChoice: 'R',
        },
      } as ActivateAbilityAction);

      // Activate Shaman's ability
      newState = applyAction(newState, {
        type: 'ACTIVATE_ABILITY',
        playerId: 'player',
        payload: {
          sourceId: shamanCard.instanceId,
          abilityId: shamanCard.instanceId + '_tap_damage',
          targets: ['opponent'],
        },
      } as ActivateAbilityAction);

      expect(newState.players.opponent.life).toBe(19); // 20 - 1

      const tappedShaman = newState.players.player.battlefield.find(
        (c) => c.instanceId === shamanCard.instanceId,
      );
      expect(tappedShaman?.tapped).toBe(true);
    });
  });
});
