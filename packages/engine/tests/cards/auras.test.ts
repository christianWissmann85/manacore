/**
 * Aura Tests
 *
 * Tests for enchantment auras that attach to permanents.
 */

import { describe, test, expect } from 'bun:test';
import { CardLoader, createCardInstance, applyAction } from '../../src/index';
import { setupGameWithMana, castAndResolve } from './helpers';

describe('Aura Attachment', () => {
  describe('Pacifism', () => {
    test('card exists with correct type', () => {
      const card = CardLoader.getByName('Pacifism');
      expect(card).toBeDefined();
      expect(card?.type_line?.toLowerCase()).toContain('enchantment');
      expect(card?.type_line?.toLowerCase()).toContain('aura');
      expect(card?.oracle_text?.toLowerCase()).toContain("can't attack or block");
    });

    test('attaches to creature when cast', () => {
      const pacifism = CardLoader.getByName('Pacifism')!;
      const bears = CardLoader.getByName('Grizzly Bears')!;
      const state = setupGameWithMana({ W: 2 });

      const bearsCard = createCardInstance(bears.id, 'opponent', 'battlefield');
      bearsCard.summoningSick = false;
      state.players.opponent.battlefield.push(bearsCard);

      const pacifismCard = createCardInstance(pacifism.id, 'player', 'hand');
      state.players.player.hand.push(pacifismCard);

      const newState = castAndResolve(state, 'player', pacifismCard.instanceId, [bearsCard.instanceId]);

      // Pacifism should be on battlefield attached to Bears
      const attachedPacifism = newState.players.player.battlefield.find(
        c => c.instanceId === pacifismCard.instanceId
      );
      expect(attachedPacifism).toBeDefined();
      expect(attachedPacifism?.attachedTo).toBe(bearsCard.instanceId);

      // Bears should have Pacifism in its attachments
      const enchantedBears = newState.players.opponent.battlefield.find(
        c => c.instanceId === bearsCard.instanceId
      );
      expect(enchantedBears?.attachments).toContain(pacifismCard.instanceId);
    });
  });
});

describe('Aura Effects', () => {
  describe('Pacifism - Combat Prevention', () => {
    test('prevents creature from attacking', () => {
      const pacifism = CardLoader.getByName('Pacifism')!;
      const bears = CardLoader.getByName('Grizzly Bears')!;
      const state = setupGameWithMana({ W: 2 });

      const bearsCard = createCardInstance(bears.id, 'player', 'battlefield');
      bearsCard.summoningSick = false;
      state.players.player.battlefield.push(bearsCard);

      const pacifismCard = createCardInstance(pacifism.id, 'player', 'hand');
      state.players.player.hand.push(pacifismCard);

      const newState = castAndResolve(state, 'player', pacifismCard.instanceId, [bearsCard.instanceId]);

      // Try to declare Bears as attacker - should fail
      expect(() => {
        applyAction(newState, {
          type: 'DECLARE_ATTACKERS',
          playerId: 'player',
          payload: { attackers: [bearsCard.instanceId] },
        });
      }).toThrow("can't attack");
    });
  });
});

describe('Aura State-Based Actions', () => {
  describe('Pacifism - Falls off when creature dies', () => {
    test('goes to graveyard when enchanted creature dies', () => {
      const pacifism = CardLoader.getByName('Pacifism')!;
      const terror = CardLoader.getByName('Terror')!;
      const bears = CardLoader.getByName('Grizzly Bears')!;
      const state = setupGameWithMana({ W: 2, B: 2 });

      // Put creature on battlefield
      const bearsCard = createCardInstance(bears.id, 'opponent', 'battlefield');
      bearsCard.summoningSick = false;
      state.players.opponent.battlefield.push(bearsCard);

      // Attach Pacifism to creature
      const pacifismCard = createCardInstance(pacifism.id, 'player', 'battlefield');
      pacifismCard.attachedTo = bearsCard.instanceId;
      bearsCard.attachments.push(pacifismCard.instanceId);
      state.players.player.battlefield.push(pacifismCard);

      // Put Terror in hand
      const terrorCard = createCardInstance(terror.id, 'player', 'hand');
      state.players.player.hand.push(terrorCard);

      // Kill creature with Terror
      const newState = castAndResolve(state, 'player', terrorCard.instanceId, [bearsCard.instanceId]);

      // Bears should be in graveyard
      expect(newState.players.opponent.graveyard.some(c => c.instanceId === bearsCard.instanceId)).toBe(true);

      // Pacifism should also be in graveyard (SBA)
      expect(newState.players.player.graveyard.some(c => c.instanceId === pacifismCard.instanceId)).toBe(true);

      // Neither on battlefield
      expect(newState.players.opponent.battlefield.some(c => c.instanceId === bearsCard.instanceId)).toBe(false);
      expect(newState.players.player.battlefield.some(c => c.instanceId === pacifismCard.instanceId)).toBe(false);
    });
  });
});
