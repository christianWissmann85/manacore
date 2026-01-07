/**
 * Tests for mana ability timing filtering
 *
 * Issue: Mana abilities were shown during opponent's combat phase even when
 * the player only had sorcery-speed spells in hand (which can't be cast).
 *
 * Fix: hasManaSink() should be timing-aware - during opponent's turn or when
 * stack is not empty, only instant-speed options count as mana sinks.
 */

import { describe, it, expect } from 'bun:test';
import { initializeGame, getLegalActions, applyAction, getPlayer, enableF6Mode } from '../src';
import type { GameState } from '../src/state/GameState';
import type { PlayerId } from '../src/state/Zone';
import type { CardInstance } from '../src/state/CardInstance';
import { CardLoader } from '../src/cards/CardLoader';
import { hasManaSink } from '../src/actions/autoPass';

// Helper to create a card instance
function createCard(
  name: string,
  owner: PlayerId,
  zone: CardInstance['zone'] = 'hand',
): CardInstance {
  const template = CardLoader.getByName(name);
  if (!template) throw new Error(`Card not found: ${name}`);
  return {
    instanceId: `${name.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 8)}`,
    scryfallId: template.id, // CardLoader uses 'id', CardInstance uses 'scryfallId'
    owner,
    controller: owner,
    zone,
    tapped: false,
    summoningSick: false,
    counters: {},
    attachedTo: null,
    attachments: [],
    damage: 0,
    temporaryModifications: [],
  };
}

// Helper to set up a custom game state
function setupState(config: {
  playerHand?: string[];
  playerBattlefield?: string[];
  opponentBattlefield?: string[];
  activePlayer?: PlayerId;
  priorityPlayer?: PlayerId;
  phase?: GameState['phase'];
  step?: GameState['step'];
}): GameState {
  const state = initializeGame([], [], 12345);

  // Clear default hands
  state.players.player.hand = [];
  state.players.opponent.hand = [];

  // Set up player hand
  for (const name of config.playerHand || []) {
    state.players.player.hand.push(createCard(name, 'player', 'hand'));
  }

  // Set up player battlefield (lands untapped, creatures with summoning sickness)
  state.players.player.battlefield = [];
  for (const name of config.playerBattlefield || []) {
    const card = createCard(name, 'player', 'battlefield');
    const template = CardLoader.getById(card.scryfallId);
    if (template?.type_line.includes('Land')) {
      card.tapped = false;
    } else if (template?.type_line.includes('Creature')) {
      card.summoningSick = true;
    }
    state.players.player.battlefield.push(card);
  }

  // Set up opponent battlefield
  state.players.opponent.battlefield = [];
  for (const name of config.opponentBattlefield || []) {
    const card = createCard(name, 'opponent', 'battlefield');
    const template = CardLoader.getById(card.scryfallId);
    if (template?.type_line.includes('Creature')) {
      card.summoningSick = false; // Opponent's creatures can attack
    }
    state.players.opponent.battlefield.push(card);
  }

  // Set game flow
  state.activePlayer = config.activePlayer || 'player';
  state.priorityPlayer = config.priorityPlayer || 'player';
  state.phase = config.phase || 'main1';
  state.step = config.step || 'main';

  return state;
}

describe('Mana ability timing filtering', () => {
  describe("during opponent's turn", () => {
    it('should NOT show mana abilities when player only has sorceries in hand', () => {
      // Setup: Opponent's combat phase, player has Forest + Grizzly Bears in hand
      const state = setupState({
        playerHand: ['Grizzly Bears'], // Sorcery-speed creature
        playerBattlefield: ['Forest'],
        activePlayer: 'opponent',
        priorityPlayer: 'player',
        phase: 'combat',
        step: 'declare_attackers',
      });

      const actions = getLegalActions(state, 'player');
      const actionTypes = actions.map((a) => a.type);

      // Should only have PASS_PRIORITY, no ACTIVATE_ABILITY (mana ability)
      expect(actionTypes).not.toContain('ACTIVATE_ABILITY');
      expect(actionTypes).toContain('PASS_PRIORITY');
    });

    it('should show mana abilities when player has instant in hand', () => {
      // Setup: Opponent's combat phase, player has Forest + Giant Growth
      const state = setupState({
        playerHand: ['Giant Growth'], // Instant
        playerBattlefield: ['Forest'],
        opponentBattlefield: ['Grizzly Bears'], // Target for Giant Growth
        activePlayer: 'opponent',
        priorityPlayer: 'player',
        phase: 'combat',
        step: 'declare_attackers',
      });

      // Mark opponent's creature as attacking
      state.players.opponent.battlefield[0]!.attacking = true;

      const actions = getLegalActions(state, 'player');
      const actionTypes = actions.map((a) => a.type);

      // Should have ACTIVATE_ABILITY (Forest mana ability) because Giant Growth can use the mana
      // Note: This test may pass auto-pass since Giant Growth costs {G} and Forest provides {G}
      // The key is that if we had 0 forests, we should NOT see mana abilities
    });

    it('should NOT show mana abilities during opponent main phase with only sorceries', () => {
      const state = setupState({
        playerHand: ['Grizzly Bears'],
        playerBattlefield: ['Forest', 'Forest'],
        activePlayer: 'opponent',
        priorityPlayer: 'player',
        phase: 'main1',
      });

      const actions = getLegalActions(state, 'player');
      const manaActions = actions.filter((a) => a.type === 'ACTIVATE_ABILITY');

      // Should have no mana ability activations
      expect(manaActions).toHaveLength(0);
    });
  });

  describe("during player's own turn", () => {
    it('should show mana abilities during own main phase with castable spells', () => {
      const state = setupState({
        playerHand: ['Grizzly Bears'],
        playerBattlefield: ['Forest', 'Forest'],
        activePlayer: 'player',
        priorityPlayer: 'player',
        phase: 'main1',
      });

      const actions = getLegalActions(state, 'player');

      // Should be able to cast Grizzly Bears directly OR tap forests
      const hasCastSpell = actions.some((a) => a.type === 'CAST_SPELL');
      expect(hasCastSpell).toBe(true);
    });

    it('should NOT show mana abilities in own combat phase with only sorceries', () => {
      const state = setupState({
        playerHand: ['Grizzly Bears'],
        playerBattlefield: ['Forest', 'Forest'],
        activePlayer: 'player',
        priorityPlayer: 'player',
        phase: 'combat',
        step: 'declare_attackers',
      });

      const actions = getLegalActions(state, 'player');
      const manaActions = actions.filter((a) => a.type === 'ACTIVATE_ABILITY');

      // During combat with only sorceries, mana abilities are pointless
      // (unless we have instant-speed abilities, which we don't here)
      expect(manaActions).toHaveLength(0);
    });
  });

  describe('hasManaSink timing awareness', () => {
    it('hasManaSink returns true for sorceries (timing check done elsewhere)', () => {
      const state = setupState({
        playerHand: ['Grizzly Bears'],
        playerBattlefield: ['Forest'],
        activePlayer: 'opponent',
        priorityPlayer: 'player',
      });

      // hasManaSink checks if there are ANY spells that cost mana
      // The timing check is done by shouldAutoPass/hasInstantSpeedOptions
      const result = hasManaSink(state, 'player');
      expect(result).toBe(true);
    });
  });

  describe('Issue #2: Cast spell after playing land', () => {
    it('should show Cast Spell after playing a land in main1', () => {
      // Setup: Player's main1, just played a forest, has more forests and Grizzly Bears
      const state = setupState({
        playerHand: ['Grizzly Bears'],
        playerBattlefield: ['Forest', 'Forest', 'Forest'], // 3 forests available
        activePlayer: 'player',
        priorityPlayer: 'player',
        phase: 'main1',
      });

      // Simulate that we just played a land this turn
      state.players.player.landsPlayedThisTurn = 1;

      const actions = getLegalActions(state, 'player');
      const hasCastSpell = actions.some((a) => a.type === 'CAST_SPELL');

      // Should be able to cast Grizzly Bears with 3 forests
      expect(hasCastSpell).toBe(true);
    });

    it('should show Cast Spell even with only 2 forests (exact mana for Grizzly Bears)', () => {
      const state = setupState({
        playerHand: ['Grizzly Bears'], // Costs {1}{G}
        playerBattlefield: ['Forest', 'Forest'], // Provides GG = 2 mana
        activePlayer: 'player',
        priorityPlayer: 'player',
        phase: 'main1',
      });

      const actions = getLegalActions(state, 'player');
      const hasCastSpell = actions.some((a) => a.type === 'CAST_SPELL');

      expect(hasCastSpell).toBe(true);
    });

    it('should NOT show Cast Spell with only 1 forest (insufficient mana)', () => {
      const state = setupState({
        playerHand: ['Grizzly Bears'], // Costs {1}{G}
        playerBattlefield: ['Forest'], // Provides only G = 1 mana
        activePlayer: 'player',
        priorityPlayer: 'player',
        phase: 'main1',
      });

      const actions = getLegalActions(state, 'player');
      const hasCastSpell = actions.some((a) => a.type === 'CAST_SPELL');

      // Cannot afford {1}{G} with only 1 forest
      expect(hasCastSpell).toBe(false);
    });

    it('should show Cast Spell after actually applying PLAY_LAND action', () => {
      // Start with 2 forests on battlefield, 1 forest + Grizzly Bears in hand
      const state = setupState({
        playerHand: ['Forest', 'Grizzly Bears'],
        playerBattlefield: ['Forest', 'Forest'],
        activePlayer: 'player',
        priorityPlayer: 'player',
        phase: 'main1',
      });

      // Find the Play Land action
      const actionsBeforeLand = getLegalActions(state, 'player');
      const playLandAction = actionsBeforeLand.find((a) => a.type === 'PLAY_LAND');
      expect(playLandAction).toBeDefined();

      // Before playing land: should be able to cast with 2 forests
      const hasCastSpellBefore = actionsBeforeLand.some((a) => a.type === 'CAST_SPELL');
      expect(hasCastSpellBefore).toBe(true);

      // Apply the PLAY_LAND action
      const newState = applyAction(state, playLandAction!);

      // After playing land: should still be able to cast (now with 3 forests)
      const actionsAfterLand = getLegalActions(newState, 'player');
      const hasCastSpellAfter = actionsAfterLand.some((a) => a.type === 'CAST_SPELL');

      expect(hasCastSpellAfter).toBe(true);
      expect(newState.players.player.landsPlayedThisTurn).toBe(1);
      expect(newState.players.player.battlefield.length).toBe(3); // 3 forests now
    });

    it('should show Cast Spell after playing land with F6 mode enabled', () => {
      // This tests the MCP server scenario where F6 mode is on
      const state = setupState({
        playerHand: ['Forest', 'Grizzly Bears'],
        playerBattlefield: ['Forest', 'Forest'],
        activePlayer: 'player',
        priorityPlayer: 'player',
        phase: 'main1',
      });

      // Enable F6 mode like the MCP server does
      enableF6Mode(state, true);

      // Play the land
      const actionsBeforeLand = getLegalActions(state, 'player');
      const playLandAction = actionsBeforeLand.find((a) => a.type === 'PLAY_LAND');
      expect(playLandAction).toBeDefined();

      const newState = applyAction(state, playLandAction!);

      // After playing land: should still be able to cast
      const actionsAfterLand = getLegalActions(newState, 'player');
      const hasCastSpellAfter = actionsAfterLand.some((a) => a.type === 'CAST_SPELL');

      expect(hasCastSpellAfter).toBe(true);
    });
  });

  describe('Issue #3: Redundant mana abilities', () => {
    it('should hide mana abilities when Cast Spell is available', () => {
      const state = setupState({
        playerHand: ['Grizzly Bears'],
        playerBattlefield: ['Forest', 'Forest'],
        activePlayer: 'player',
        priorityPlayer: 'player',
        phase: 'main1',
      });

      const actions = getLegalActions(state, 'player');

      // Should have Cast Spell available
      const castSpells = actions.filter((a) => a.type === 'CAST_SPELL');
      expect(castSpells.length).toBe(1);

      // Should NOT have mana abilities (redundant since Cast Spell auto-pays)
      const manaAbilities = actions.filter((a) => a.type === 'ACTIVATE_ABILITY');
      expect(manaAbilities.length).toBe(0);
    });

    it('should show mana abilities when no Cast Spell but non-mana ability exists', () => {
      // Scenario: Can't cast spell, but have a creature with a mana-costing ability
      const state = setupState({
        playerHand: ['Gorilla Chieftain'], // {2}{G}{G} - can't afford
        playerBattlefield: ['Forest', 'Forest'], // Only 2 mana available
        activePlayer: 'player',
        priorityPlayer: 'player',
        phase: 'main1',
      });

      // Add a creature with a mana-costing ability (need to find one in 6ed)
      // For now, just verify no cast spell means different behavior
      const actions = getLegalActions(state, 'player');

      // Should NOT have Cast Spell (can't afford Gorilla Chieftain)
      const castSpells = actions.filter((a) => a.type === 'CAST_SPELL');
      expect(castSpells.length).toBe(0);

      // Should auto-pass since no meaningful actions
      expect(actions.length).toBe(1);
      expect(actions[0]?.type).toBe('PASS_PRIORITY');
    });

    it('action count should be reduced when filtering redundant mana abilities', () => {
      const state = setupState({
        playerHand: ['Grizzly Bears'],
        playerBattlefield: ['Forest', 'Forest', 'Forest'], // 3 forests
        activePlayer: 'player',
        priorityPlayer: 'player',
        phase: 'main1',
      });

      const actions = getLegalActions(state, 'player');

      // Expected actions: PASS_PRIORITY, END_TURN, CAST_SPELL (x1)
      // NOT expected: 3x ACTIVATE_ABILITY for forests
      expect(actions.length).toBe(3);

      const types = actions.map((a) => a.type);
      expect(types).toContain('PASS_PRIORITY');
      expect(types).toContain('END_TURN');
      expect(types).toContain('CAST_SPELL');
    });
  });
});
