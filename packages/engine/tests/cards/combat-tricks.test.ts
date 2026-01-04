/**
 * Combat Trick Tests
 *
 * Tests for instant-speed spells that modify creatures (pump spells, etc.).
 */

import { describe, test, expect } from 'bun:test';
import { CardLoader, createCardInstance, applyAction } from '../../src/index';
import { setupGameWithMana, castAndResolve } from './helpers';

describe('Pump Spells', () => {
  describe('Giant Growth', () => {
    test('card exists with correct text', () => {
      const card = CardLoader.getByName('Giant Growth');
      expect(card).toBeDefined();
      expect(card?.mana_cost).toBe('{G}');
      expect(card?.type_line).toBe('Instant');
      expect(card?.oracle_text?.toLowerCase()).toContain('+3/+3');
      expect(card?.oracle_text?.toLowerCase()).toContain('until end of turn');
    });

    test('gives +3/+3 until end of turn', () => {
      const growth = CardLoader.getByName('Giant Growth')!;
      const bears = CardLoader.getByName('Grizzly Bears')!;
      const state = setupGameWithMana({ G: 3 });

      const bearsCard = createCardInstance(bears.id, 'player', 'battlefield');
      bearsCard.summoningSick = false;
      bearsCard.temporaryModifications = [];
      state.players.player.battlefield.push(bearsCard);

      const growthCard = createCardInstance(growth.id, 'player', 'hand');
      state.players.player.hand.push(growthCard);

      const newState = castAndResolve(state, 'player', growthCard.instanceId, [
        bearsCard.instanceId,
      ]);

      const pumpedCreature = newState.players.player.battlefield.find(
        (c) => c.instanceId === bearsCard.instanceId,
      );

      expect(pumpedCreature).toBeDefined();
      expect(pumpedCreature!.temporaryModifications.length).toBe(1);
      expect(pumpedCreature!.temporaryModifications[0]!.powerChange).toBe(3);
      expect(pumpedCreature!.temporaryModifications[0]!.toughnessChange).toBe(3);
    });

    test('effect wears off at end of turn', () => {
      const growth = CardLoader.getByName('Giant Growth')!;
      const bears = CardLoader.getByName('Grizzly Bears')!;
      const state = setupGameWithMana({ G: 3 });

      const bearsCard = createCardInstance(bears.id, 'player', 'battlefield');
      bearsCard.summoningSick = false;
      bearsCard.temporaryModifications = [];
      state.players.player.battlefield.push(bearsCard);

      const growthCard = createCardInstance(growth.id, 'player', 'hand');
      state.players.player.hand.push(growthCard);

      let newState = castAndResolve(state, 'player', growthCard.instanceId, [bearsCard.instanceId]);

      // Confirm pump was applied
      let pumpedCreature = newState.players.player.battlefield.find(
        (c) => c.instanceId === bearsCard.instanceId,
      );
      expect(pumpedCreature!.temporaryModifications.length).toBe(1);

      // End the turn
      newState = applyAction(newState, {
        type: 'END_TURN',
        playerId: 'player',
        payload: {},
      });

      // Pump should be gone
      pumpedCreature = newState.players.player.battlefield.find(
        (c) => c.instanceId === bearsCard.instanceId,
      );
      expect(pumpedCreature).toBeDefined();
      expect(pumpedCreature!.temporaryModifications.length).toBe(0);
    });

    test('pumped creature survives lethal damage', () => {
      const growth = CardLoader.getByName('Giant Growth')!;
      const bears = CardLoader.getByName('Grizzly Bears')!;
      const blast = CardLoader.getByName('Lightning Blast')!;
      const state = setupGameWithMana({ G: 1, R: 4 });

      // 2/2 creature
      const bearsCard = createCardInstance(bears.id, 'player', 'battlefield');
      bearsCard.summoningSick = false;
      bearsCard.temporaryModifications = [];
      state.players.player.battlefield.push(bearsCard);

      const growthCard = createCardInstance(growth.id, 'player', 'hand');
      const blastCard = createCardInstance(blast.id, 'player', 'hand');
      state.players.player.hand.push(growthCard);
      state.players.player.hand.push(blastCard);

      // Cast Giant Growth (now 5/5)
      let newState = castAndResolve(state, 'player', growthCard.instanceId, [bearsCard.instanceId]);

      // Cast Lightning Blast (4 damage)
      newState = castAndResolve(newState, 'player', blastCard.instanceId, [bearsCard.instanceId]);

      // Bears survives with 4 damage (5 toughness - 4 damage = 1 remaining)
      const creature = newState.players.player.battlefield.find(
        (c) => c.instanceId === bearsCard.instanceId,
      );
      expect(creature).toBeDefined();
      expect(creature!.damage).toBe(4);
      expect(creature!.temporaryModifications.length).toBe(1);
    });

    test('pump wears off at end of turn (damage cleared too)', () => {
      const growth = CardLoader.getByName('Giant Growth')!;
      const bears = CardLoader.getByName('Grizzly Bears')!;
      const shock = CardLoader.getByName('Shock')!;
      const state = setupGameWithMana({ G: 1, R: 1 });

      const bearsCard = createCardInstance(bears.id, 'player', 'battlefield');
      bearsCard.summoningSick = false;
      bearsCard.temporaryModifications = [];
      state.players.player.battlefield.push(bearsCard);

      const growthCard = createCardInstance(growth.id, 'player', 'hand');
      const shockCard = createCardInstance(shock.id, 'player', 'hand');
      state.players.player.hand.push(growthCard);
      state.players.player.hand.push(shockCard);

      // Cast Giant Growth (now 5/5)
      let newState = castAndResolve(state, 'player', growthCard.instanceId, [bearsCard.instanceId]);

      // Cast Shock (2 damage) - survives as 5/5 with 2 damage
      newState = castAndResolve(newState, 'player', shockCard.instanceId, [bearsCard.instanceId]);

      // Verify creature has 2 damage and pump
      let creature = newState.players.player.battlefield.find(
        (c) => c.instanceId === bearsCard.instanceId,
      );
      expect(creature).toBeDefined();
      expect(creature!.damage).toBe(2);

      // End turn - pump wears off AND damage is cleared (cleanup step)
      newState = applyAction(newState, {
        type: 'END_TURN',
        playerId: 'player',
        payload: {},
      });

      // Creature survives because damage is also cleared at end of turn
      creature = newState.players.player.battlefield.find(
        (c) => c.instanceId === bearsCard.instanceId,
      );
      expect(creature).toBeDefined();
      expect(creature!.temporaryModifications.length).toBe(0); // Pump gone
      expect(creature!.damage).toBe(0); // Damage also cleared
    });
  });
});
