/**
 * Global Enchantment Tests
 *
 * Tests for non-aura enchantments that affect the game globally.
 * Phase 1.5.5: Week 1.5.5 Global Enchantments
 */

import { describe, test, expect } from 'bun:test';
import { CardLoader, createCardInstance, applyAction, validateAction } from '../../src/index';
import { setupGameWithMana } from './helpers';
import { registerTrigger, resolveTriggers } from '../../src/rules/triggers';
import { getFromRegistry } from '../../src/rules/abilities/registry';
import type { CardInstance } from '../../src/state/CardInstance';
import type { GameState } from '../../src/state/GameState';

// Helper to get abilities for a card
function getAbilities(state: GameState, card: CardInstance) {
  const template = CardLoader.getById(card.scryfallId);
  if (!template) return [];
  return getFromRegistry(template.name, card, state) || [];
}

describe('Global Enchantments (Phase 1.5.5)', () => {
  // ==========================================
  // COMBAT RESTRICTION ENCHANTMENTS
  // ==========================================

  describe('Light of Day - Black creatures cannot attack or block', () => {
    test('prevents black creatures from attacking', () => {
      const state = setupGameWithMana({});
      const abyssalSpecter = CardLoader.getByName('Abyssal Specter')!; // Black creature in 6ed
      const lightOfDay = CardLoader.getByName('Light of Day')!;

      // Put Abyssal Specter on battlefield
      const bkCard = createCardInstance(abyssalSpecter.id, 'player', 'battlefield');
      bkCard.summoningSick = false;
      state.players.player.battlefield.push(bkCard);

      // Put Light of Day on battlefield
      const lodCard = createCardInstance(lightOfDay.id, 'opponent', 'battlefield');
      state.players.opponent.battlefield.push(lodCard);

      // Set combat phase
      state.phase = 'combat';
      state.step = 'declare_attackers';
      state.activePlayer = 'player';

      // Try to attack with Black Knight
      const errors = validateAction(state, {
        type: 'DECLARE_ATTACKERS',
        playerId: 'player',
        payload: { attackers: [bkCard.instanceId] },
      });

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes("can't attack"))).toBe(true);
    });

    test('allows non-black creatures to attack', () => {
      const state = setupGameWithMana({});
      const bears = CardLoader.getByName('Grizzly Bears')!; // Green creature
      const lightOfDay = CardLoader.getByName('Light of Day')!;

      // Put Bears on battlefield
      const bearsCard = createCardInstance(bears.id, 'player', 'battlefield');
      bearsCard.summoningSick = false;
      state.players.player.battlefield.push(bearsCard);

      // Put Light of Day on battlefield
      const lodCard = createCardInstance(lightOfDay.id, 'opponent', 'battlefield');
      state.players.opponent.battlefield.push(lodCard);

      // Set combat phase
      state.phase = 'combat';
      state.step = 'declare_attackers';
      state.activePlayer = 'player';

      // Try to attack with Bears
      const errors = validateAction(state, {
        type: 'DECLARE_ATTACKERS',
        playerId: 'player',
        payload: { attackers: [bearsCard.instanceId] },
      });

      // Should be allowed (no combat restriction errors)
      expect(errors.every((e) => !e.includes("can't attack"))).toBe(true);
    });
  });

  // ==========================================
  // ETB TRIGGERED ENCHANTMENTS
  // ==========================================

  describe('Aether Flash - Deals 2 damage to entering creatures', () => {
    test('deals 2 damage when creature enters', () => {
      const state = setupGameWithMana({});
      const aetherFlash = CardLoader.getByName('Aether Flash')!;
      const bears = CardLoader.getByName('Grizzly Bears')!;

      // Put Aether Flash on battlefield
      const afCard = createCardInstance(aetherFlash.id, 'player', 'battlefield');
      state.players.player.battlefield.push(afCard);

      // Create Bears on battlefield (simulating ETB)
      const bearsCard = createCardInstance(bears.id, 'opponent', 'battlefield');
      bearsCard.damage = 0;
      state.players.opponent.battlefield.push(bearsCard);

      // Register ETB trigger
      registerTrigger(state, {
        type: 'ENTERS_BATTLEFIELD',
        cardId: bearsCard.instanceId,
        controller: 'opponent',
      });

      // Resolve triggers
      resolveTriggers(state);

      // Bears should have 2 damage
      expect(bearsCard.damage).toBe(2);
    });

    test('kills 1-toughness creatures', () => {
      const state = setupGameWithMana({});
      const aetherFlash = CardLoader.getByName('Aether Flash')!;
      const elves = CardLoader.getByName('Llanowar Elves')!; // 1/1

      // Put Aether Flash on battlefield
      const afCard = createCardInstance(aetherFlash.id, 'player', 'battlefield');
      state.players.player.battlefield.push(afCard);

      // Create Elves on battlefield (simulating ETB)
      const elvesCard = createCardInstance(elves.id, 'opponent', 'battlefield');
      elvesCard.damage = 0;
      state.players.opponent.battlefield.push(elvesCard);

      // Register ETB trigger
      registerTrigger(state, {
        type: 'ENTERS_BATTLEFIELD',
        cardId: elvesCard.instanceId,
        controller: 'opponent',
      });

      // Resolve triggers
      resolveTriggers(state);

      // Elves should have 2 damage (will die to SBA)
      expect(elvesCard.damage).toBe(2);
    });
  });

  // ==========================================
  // LAND TAP TRIGGERED ENCHANTMENTS
  // ==========================================

  describe('Manabarbs - Deals 1 damage when land tapped', () => {
    test('deals 1 damage when land is tapped', () => {
      const state = setupGameWithMana({});
      const manabarbs = CardLoader.getByName('Manabarbs')!;
      const forest = CardLoader.getByName('Forest')!;

      // Put Manabarbs on battlefield
      const mbCard = createCardInstance(manabarbs.id, 'player', 'battlefield');
      state.players.player.battlefield.push(mbCard);

      // Put Forest on opponent's battlefield
      const forestCard = createCardInstance(forest.id, 'opponent', 'battlefield');
      forestCard.tapped = false;
      state.players.opponent.battlefield.push(forestCard);

      // Set starting life
      state.players.opponent.life = 20;

      // Register BECOMES_TAPPED trigger
      registerTrigger(state, {
        type: 'BECOMES_TAPPED',
        cardId: forestCard.instanceId,
        controller: 'opponent',
      });

      // Resolve triggers
      resolveTriggers(state);

      // Opponent should have taken 1 damage
      expect(state.players.opponent.life).toBe(19);
    });

    test('both players take damage from their own lands', () => {
      const state = setupGameWithMana({});
      const manabarbs = CardLoader.getByName('Manabarbs')!;
      const forest = CardLoader.getByName('Forest')!;

      // Put Manabarbs on battlefield
      const mbCard = createCardInstance(manabarbs.id, 'opponent', 'battlefield');
      state.players.opponent.battlefield.push(mbCard);

      // Put Forest on player's battlefield
      const forestCard = createCardInstance(forest.id, 'player', 'battlefield');
      forestCard.tapped = false;
      state.players.player.battlefield.push(forestCard);

      // Set starting life
      state.players.player.life = 20;

      // Register BECOMES_TAPPED trigger
      registerTrigger(state, {
        type: 'BECOMES_TAPPED',
        cardId: forestCard.instanceId,
        controller: 'player',
      });

      // Resolve triggers
      resolveTriggers(state);

      // Player should have taken 1 damage
      expect(state.players.player.life).toBe(19);
    });
  });

  // ==========================================
  // ACTIVATED ABILITY ENCHANTMENTS
  // ==========================================

  describe('Greed - {B}, Pay 2 life: Draw a card', () => {
    test('has activated ability registered', () => {
      const state = setupGameWithMana({});
      const greed = CardLoader.getByName('Greed')!;

      const greedCard = createCardInstance(greed.id, 'player', 'battlefield');
      state.players.player.battlefield.push(greedCard);

      const abilities = getAbilities(state, greedCard);
      expect(abilities.length).toBe(1);
      expect(abilities[0].name).toContain('Draw a card');
    });

    test('canActivate returns false with insufficient life', () => {
      const state = setupGameWithMana({ B: 1 });
      const greed = CardLoader.getByName('Greed')!;

      const greedCard = createCardInstance(greed.id, 'player', 'battlefield');
      state.players.player.battlefield.push(greedCard);
      state.players.player.life = 2; // Only 2 life, can't pay 2 more

      const abilities = getAbilities(state, greedCard);
      const canActivate = abilities[0].canActivate(state, greedCard.instanceId, 'player');
      expect(canActivate).toBe(false);
    });

    test('canActivate returns true with sufficient life and mana', () => {
      const state = setupGameWithMana({ B: 1 });
      const greed = CardLoader.getByName('Greed')!;

      const greedCard = createCardInstance(greed.id, 'player', 'battlefield');
      state.players.player.battlefield.push(greedCard);
      state.players.player.life = 20;

      const abilities = getAbilities(state, greedCard);
      const canActivate = abilities[0].canActivate(state, greedCard.instanceId, 'player');
      expect(canActivate).toBe(true);
    });
  });

  describe('Tranquil Grove - {1}{G}{G}: Destroy all other enchantments', () => {
    test('has activated ability registered', () => {
      const state = setupGameWithMana({});
      const grove = CardLoader.getByName('Tranquil Grove')!;

      const groveCard = createCardInstance(grove.id, 'player', 'battlefield');
      state.players.player.battlefield.push(groveCard);

      const abilities = getAbilities(state, groveCard);
      expect(abilities.length).toBe(1);
      expect(abilities[0].name).toContain('Destroy all other enchantments');
    });

    test('effect destroys other enchantments but not itself', () => {
      const state = setupGameWithMana({});
      const grove = CardLoader.getByName('Tranquil Grove')!;
      const greed = CardLoader.getByName('Greed')!;
      const lightOfDay = CardLoader.getByName('Light of Day')!;

      // Put Tranquil Grove on player battlefield
      const groveCard = createCardInstance(grove.id, 'player', 'battlefield');
      state.players.player.battlefield.push(groveCard);

      // Put Greed on player battlefield
      const greedCard = createCardInstance(greed.id, 'player', 'battlefield');
      state.players.player.battlefield.push(greedCard);

      // Put Light of Day on opponent battlefield
      const lodCard = createCardInstance(lightOfDay.id, 'opponent', 'battlefield');
      state.players.opponent.battlefield.push(lodCard);

      // Get ability and execute effect
      const abilities = getAbilities(state, groveCard);
      const effect = abilities[0].effect;
      if (effect.type === 'CUSTOM' && effect.custom) {
        effect.custom(state);
      }

      // Tranquil Grove should still exist
      expect(
        state.players.player.battlefield.some((c) => c.instanceId === groveCard.instanceId),
      ).toBe(true);
      // Greed should be destroyed
      expect(
        state.players.player.battlefield.some((c) => c.instanceId === greedCard.instanceId),
      ).toBe(false);
      expect(
        state.players.player.graveyard.some((c) => c.instanceId === greedCard.instanceId),
      ).toBe(true);
      // Light of Day should be destroyed
      expect(
        state.players.opponent.battlefield.some((c) => c.instanceId === lodCard.instanceId),
      ).toBe(false);
      expect(
        state.players.opponent.graveyard.some((c) => c.instanceId === lodCard.instanceId),
      ).toBe(true);
    });
  });

  describe('Circle of Protection: Red', () => {
    test('has activated ability registered', () => {
      const state = setupGameWithMana({});
      const cop = CardLoader.getByName('Circle of Protection: Red')!;

      const copCard = createCardInstance(cop.id, 'player', 'battlefield');
      state.players.player.battlefield.push(copCard);

      const abilities = getAbilities(state, copCard);
      expect(abilities.length).toBe(1);
      expect(abilities[0].name).toContain('Prevent next red damage');
    });

    test('effect adds prevention shield', () => {
      const state = setupGameWithMana({});
      const cop = CardLoader.getByName('Circle of Protection: Red')!;

      const copCard = createCardInstance(cop.id, 'player', 'battlefield');
      state.players.player.battlefield.push(copCard);

      // Get ability and execute effect
      const abilities = getAbilities(state, copCard);
      const effect = abilities[0].effect;
      if (effect.type === 'CUSTOM' && effect.custom) {
        effect.custom(state);
      }

      // Player should have a prevention shield
      expect(
        (
          state.players.player as unknown as {
            preventionShields?: Array<{ color: string; amount: string }>;
          }
        ).preventionShields,
      ).toBeDefined();
      const shields = (
        state.players.player as unknown as {
          preventionShields?: Array<{ color: string; amount: string }>;
        }
      ).preventionShields!;
      expect(shields.length).toBe(1);
      expect(shields[0].color).toBe('R');
    });
  });

  // ==========================================
  // TOKEN GENERATION ENCHANTMENTS
  // ==========================================

  describe('Goblin Warrens - Create Goblin tokens', () => {
    test('has activated ability registered', () => {
      const state = setupGameWithMana({});
      const warrens = CardLoader.getByName('Goblin Warrens')!;

      const warrensCard = createCardInstance(warrens.id, 'player', 'battlefield');
      state.players.player.battlefield.push(warrensCard);

      const abilities = getAbilities(state, warrensCard);
      expect(abilities.length).toBe(1);
      expect(abilities[0].name).toContain('Goblin tokens');
    });

    test('cannot activate without 2 Goblins to sacrifice', () => {
      const state = setupGameWithMana({ R: 3 });
      const warrens = CardLoader.getByName('Goblin Warrens')!;

      const warrensCard = createCardInstance(warrens.id, 'player', 'battlefield');
      state.players.player.battlefield.push(warrensCard);

      // Only 1 goblin token
      const goblinToken = createCardInstance('token_goblin', 'player', 'battlefield');
      goblinToken.isToken = true;
      goblinToken.tokenType = 'Goblin';
      state.players.player.battlefield.push(goblinToken);

      const abilities = getAbilities(state, warrensCard);
      const canActivate = abilities[0].canActivate(state, warrensCard.instanceId, 'player');
      expect(canActivate).toBe(false);
    });

    test('can activate with 2+ Goblins and sufficient mana', () => {
      const state = setupGameWithMana({ R: 3 });
      const warrens = CardLoader.getByName('Goblin Warrens')!;

      const warrensCard = createCardInstance(warrens.id, 'player', 'battlefield');
      state.players.player.battlefield.push(warrensCard);

      // Add 2 goblin tokens
      for (let i = 0; i < 2; i++) {
        const goblinToken = createCardInstance('token_goblin', 'player', 'battlefield');
        goblinToken.isToken = true;
        goblinToken.tokenType = 'Goblin';
        state.players.player.battlefield.push(goblinToken);
      }

      const abilities = getAbilities(state, warrensCard);
      const canActivate = abilities[0].canActivate(state, warrensCard.instanceId, 'player');
      expect(canActivate).toBe(true);
    });

    test('effect sacrifices 2 goblins and creates 3 goblin tokens', () => {
      const state = setupGameWithMana({ R: 3 });
      const warrens = CardLoader.getByName('Goblin Warrens')!;

      const warrensCard = createCardInstance(warrens.id, 'player', 'battlefield');
      state.players.player.battlefield.push(warrensCard);

      // Add 2 goblin tokens
      for (let i = 0; i < 2; i++) {
        const goblinToken = createCardInstance('token_goblin', 'player', 'battlefield');
        goblinToken.isToken = true;
        goblinToken.tokenType = 'Goblin';
        state.players.player.battlefield.push(goblinToken);
      }

      // Count goblins before
      const goblinsBefore = state.players.player.battlefield.filter(
        (c) => c.isToken && c.tokenType === 'Goblin',
      ).length;
      expect(goblinsBefore).toBe(2);

      // Execute ability
      const abilities = getAbilities(state, warrensCard);
      const effect = abilities[0].effect;
      if (effect.type === 'CUSTOM' && effect.custom) {
        effect.custom(state);
      }

      // Count goblins after (2 sacrificed, 3 created = net +1)
      const goblinsAfter = state.players.player.battlefield.filter(
        (c) => c.isToken && c.tokenType === 'Goblin',
      ).length;
      expect(goblinsAfter).toBe(3);
    });
  });

  // ==========================================
  // DAMAGE ENCHANTMENTS
  // ==========================================

  describe('Pestilence - Deal damage to all', () => {
    test('has activated ability registered', () => {
      const state = setupGameWithMana({});
      const pestilence = CardLoader.getByName('Pestilence')!;

      const pestCard = createCardInstance(pestilence.id, 'player', 'battlefield');
      state.players.player.battlefield.push(pestCard);

      const abilities = getAbilities(state, pestCard);
      expect(abilities.length).toBe(1);
      expect(abilities[0].name).toContain('damage');
    });

    test('effect deals 1 damage to each player', () => {
      const state = setupGameWithMana({});
      const pestilence = CardLoader.getByName('Pestilence')!;

      const pestCard = createCardInstance(pestilence.id, 'player', 'battlefield');
      state.players.player.battlefield.push(pestCard);

      state.players.player.life = 20;
      state.players.opponent.life = 20;

      // Execute ability
      const abilities = getAbilities(state, pestCard);
      const effect = abilities[0].effect;
      if (effect.type === 'CUSTOM' && effect.custom) {
        effect.custom(state);
      }

      expect(state.players.player.life).toBe(19);
      expect(state.players.opponent.life).toBe(19);
    });

    test('effect deals 1 damage to each creature', () => {
      const state = setupGameWithMana({});
      const pestilence = CardLoader.getByName('Pestilence')!;
      const bears = CardLoader.getByName('Grizzly Bears')!;

      const pestCard = createCardInstance(pestilence.id, 'player', 'battlefield');
      state.players.player.battlefield.push(pestCard);

      const bearsCard = createCardInstance(bears.id, 'player', 'battlefield');
      bearsCard.damage = 0;
      state.players.player.battlefield.push(bearsCard);

      const opponentBears = createCardInstance(bears.id, 'opponent', 'battlefield');
      opponentBears.damage = 0;
      state.players.opponent.battlefield.push(opponentBears);

      // Execute ability
      const abilities = getAbilities(state, pestCard);
      const effect = abilities[0].effect;
      if (effect.type === 'CUSTOM' && effect.custom) {
        effect.custom(state);
      }

      expect(bearsCard.damage).toBe(1);
      expect(opponentBears.damage).toBe(1);
    });
  });

  // ==========================================
  // COMPLEX AURAS (Phase 8)
  // ==========================================

  describe('Animate Wall - Allows Wall to attack', () => {
    test('Wall cannot attack normally', () => {
      const state = setupGameWithMana({});
      const wall = CardLoader.getByName('Wall of Air')!;

      const wallCard = createCardInstance(wall.id, 'player', 'battlefield');
      wallCard.summoningSick = false;
      state.players.player.battlefield.push(wallCard);

      state.phase = 'combat';
      state.step = 'declare_attackers';
      state.activePlayer = 'player';

      const errors = validateAction(state, {
        type: 'DECLARE_ATTACKERS',
        playerId: 'player',
        payload: { attackers: [wallCard.instanceId] },
      });

      expect(errors.some((e) => e.includes('Defender'))).toBe(true);
    });

    test('Wall can attack with Animate Wall attached', () => {
      const state = setupGameWithMana({});
      const wall = CardLoader.getByName('Wall of Air')!;
      const animateWall = CardLoader.getByName('Animate Wall')!;

      // Put Wall on battlefield
      const wallCard = createCardInstance(wall.id, 'player', 'battlefield');
      wallCard.summoningSick = false;
      state.players.player.battlefield.push(wallCard);

      // Attach Animate Wall
      const auraCard = createCardInstance(animateWall.id, 'player', 'battlefield');
      auraCard.attachedTo = wallCard.instanceId;
      state.players.player.battlefield.push(auraCard);
      wallCard.attachments = [auraCard.instanceId];

      state.phase = 'combat';
      state.step = 'declare_attackers';
      state.activePlayer = 'player';

      const errors = validateAction(state, {
        type: 'DECLARE_ATTACKERS',
        playerId: 'player',
        payload: { attackers: [wallCard.instanceId] },
      });

      // Should be allowed (no Defender errors)
      expect(errors.every((e) => !e.includes('Defender'))).toBe(true);
    });
  });

  describe('Spirit Link - Gain life when creature deals damage', () => {
    test('controller gains life when enchanted creature deals damage', () => {
      const state = setupGameWithMana({});
      const bears = CardLoader.getByName('Grizzly Bears')!;
      const spiritLink = CardLoader.getByName('Spirit Link')!;

      // Put creature on battlefield
      const bearsCard = createCardInstance(bears.id, 'player', 'battlefield');
      bearsCard.summoningSick = false;
      state.players.player.battlefield.push(bearsCard);

      // Attach Spirit Link (controlled by player)
      const slCard = createCardInstance(spiritLink.id, 'player', 'battlefield');
      slCard.attachedTo = bearsCard.instanceId;
      state.players.player.battlefield.push(slCard);
      bearsCard.attachments = [slCard.instanceId];

      state.players.player.life = 15;

      // Register damage trigger
      registerTrigger(state, {
        type: 'DEALS_DAMAGE',
        sourceId: bearsCard.instanceId,
        targetId: 'opponent',
        amount: 2,
      });

      // Resolve triggers
      resolveTriggers(state);

      // Player should have gained 2 life
      expect(state.players.player.life).toBe(17);
    });
  });
});
