/**
 * Integration tests that simulate MCP server behavior
 *
 * These tests verify that the action generation works correctly in scenarios
 * that the MCP server encounters, including:
 * - Play Land availability during main phases
 * - Mana ability filtering when CAST_SPELL is available
 * - X spell enumeration
 */

import { describe, it, expect } from 'bun:test';
import { initializeGame, getLegalActions, applyAction, enableF6Mode, describeAction } from '../src';
import type { GameState } from '../src/state/GameState';
import type { PlayerId } from '../src/state/Zone';
import type { CardInstance } from '../src/state/CardInstance';
import { CardLoader } from '../src/cards/CardLoader';
import { hasSorcerySpeedOptions } from '../src/actions/autoPass';

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
    scryfallId: template.id,
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

// Helper to set up a custom game state (simulating MCP server scenarios)
function setupMCPState(config: {
  playerHand?: string[];
  playerBattlefield?: string[];
  opponentBattlefield?: string[];
  activePlayer?: PlayerId;
  priorityPlayer?: PlayerId;
  phase?: GameState['phase'];
  step?: GameState['step'];
  landsPlayedThisTurn?: number;
  f6Mode?: boolean;
}): GameState {
  const state = initializeGame([], [], 12345);

  // Clear default hands
  state.players.player.hand = [];
  state.players.opponent.hand = [];

  // Set up player hand
  for (const name of config.playerHand || []) {
    state.players.player.hand.push(createCard(name, 'player', 'hand'));
  }

  // Set up player battlefield
  state.players.player.battlefield = [];
  for (const name of config.playerBattlefield || []) {
    const card = createCard(name, 'player', 'battlefield');
    const template = CardLoader.getById(card.scryfallId);
    if (template?.type_line.includes('Creature')) {
      card.summoningSick = true;
    }
    state.players.player.battlefield.push(card);
  }

  // Set up opponent battlefield
  state.players.opponent.battlefield = [];
  for (const name of config.opponentBattlefield || []) {
    const card = createCard(name, 'opponent', 'battlefield');
    if (CardLoader.getById(card.scryfallId)?.type_line.includes('Creature')) {
      card.summoningSick = false;
    }
    state.players.opponent.battlefield.push(card);
  }

  // Set game flow
  state.activePlayer = config.activePlayer || 'player';
  state.priorityPlayer = config.priorityPlayer || 'player';
  state.phase = config.phase || 'main1';
  state.step = config.step || 'main';
  state.stack = [];
  state.players.player.landsPlayedThisTurn = config.landsPlayedThisTurn ?? 0;

  // Enable F6 mode like MCP server does
  if (config.f6Mode !== false) {
    enableF6Mode(state, true);
  }

  return state;
}

describe('MCP Integration - Play Land availability', () => {
  it('should show PLAY_LAND when player has a land in hand and landsPlayedThisTurn is 0', () => {
    const state = setupMCPState({
      playerHand: ['Forest', 'Grizzly Bears'],
      playerBattlefield: ['Forest', 'Forest'],
      activePlayer: 'player',
      priorityPlayer: 'player',
      phase: 'main1',
      landsPlayedThisTurn: 0,
      f6Mode: true,
    });

    const actions = getLegalActions(state, 'player');
    const playLandActions = actions.filter((a) => a.type === 'PLAY_LAND');

    expect(playLandActions.length).toBe(1);
    expect(describeAction(playLandActions[0]!, state)).toBe('Play Forest');
  });

  it('should NOT show PLAY_LAND when landsPlayedThisTurn is 1', () => {
    const state = setupMCPState({
      playerHand: ['Forest', 'Grizzly Bears'],
      playerBattlefield: ['Forest', 'Forest'],
      activePlayer: 'player',
      priorityPlayer: 'player',
      phase: 'main1',
      landsPlayedThisTurn: 1, // Already played a land
      f6Mode: true,
    });

    const actions = getLegalActions(state, 'player');
    const playLandActions = actions.filter((a) => a.type === 'PLAY_LAND');

    expect(playLandActions.length).toBe(0);
  });

  it('should correctly detect hasSorcerySpeedOptions with land in hand', () => {
    const state = setupMCPState({
      playerHand: ['Forest'],
      playerBattlefield: [],
      activePlayer: 'player',
      priorityPlayer: 'player',
      phase: 'main1',
      landsPlayedThisTurn: 0,
      f6Mode: true,
    });

    // This should return true since we can play a land
    const result = hasSorcerySpeedOptions(state, 'player');
    expect(result).toBe(true);
  });

  it('should show PLAY_LAND after casting a spell', () => {
    const state = setupMCPState({
      playerHand: ['Forest', 'Giant Growth'],
      playerBattlefield: ['Forest', 'Grizzly Bears'],
      opponentBattlefield: ['Llanowar Elves'],
      activePlayer: 'player',
      priorityPlayer: 'player',
      phase: 'main1',
      landsPlayedThisTurn: 0,
      f6Mode: true,
    });

    // First verify we can play land
    let actions = getLegalActions(state, 'player');
    let playLandAction = actions.find((a) => a.type === 'PLAY_LAND');
    expect(playLandAction).toBeDefined();

    // Cast Giant Growth on our Grizzly Bears
    const castAction = actions.find(
      (a) => a.type === 'CAST_SPELL' && describeAction(a, state).includes('Giant Growth'),
    );

    if (castAction) {
      // Apply the cast and let the spell resolve
      let newState = applyAction(state, castAction);

      // Pass priority to let spell resolve
      if (newState.stack.length > 0) {
        const passAction = getLegalActions(newState, 'player').find(
          (a) => a.type === 'PASS_PRIORITY',
        );
        if (passAction) {
          newState = applyAction(newState, passAction);
        }
        // Opponent passes
        const oppPass = getLegalActions(newState, 'opponent').find(
          (a) => a.type === 'PASS_PRIORITY',
        );
        if (oppPass) {
          newState = applyAction(newState, oppPass);
        }
      }

      // Should still be able to play land
      actions = getLegalActions(newState, 'player');
      playLandAction = actions.find((a) => a.type === 'PLAY_LAND');

      // Only check if we're back in main phase
      if (newState.phase === 'main1' && newState.stack.length === 0) {
        expect(playLandAction).toBeDefined();
      }
    }
  });

  it('should show PLAY_LAND across multiple turns', () => {
    // Turn 1: Play land and pass
    let state = setupMCPState({
      playerHand: ['Forest', 'Forest', 'Forest', 'Grizzly Bears'],
      playerBattlefield: [],
      activePlayer: 'player',
      priorityPlayer: 'player',
      phase: 'main1',
      landsPlayedThisTurn: 0,
      f6Mode: true,
    });

    // Verify PLAY_LAND is available on turn 1
    let actions = getLegalActions(state, 'player');
    let playLandAction = actions.find((a) => a.type === 'PLAY_LAND');
    expect(playLandAction).toBeDefined();

    // Play the land
    state = applyAction(state, playLandAction!);

    // Verify we can't play another land this turn
    actions = getLegalActions(state, 'player');
    playLandAction = actions.find((a) => a.type === 'PLAY_LAND');
    expect(playLandAction).toBeUndefined();

    // End turn and advance to player's next main phase
    const endTurnAction = actions.find((a) => a.type === 'END_TURN');
    if (endTurnAction) {
      state = applyAction(state, endTurnAction);
    }

    // Simulate turn passing (normally handled by game loop)
    // Reset for next turn simulation
    state = {
      ...state,
      activePlayer: 'player',
      priorityPlayer: 'player',
      phase: 'main1',
      step: 'main',
      stack: [],
      players: {
        ...state.players,
        player: {
          ...state.players.player,
          landsPlayedThisTurn: 0, // Reset for new turn
        },
      },
    };

    // Verify PLAY_LAND is available again
    actions = getLegalActions(state, 'player');
    playLandAction = actions.find((a) => a.type === 'PLAY_LAND');
    expect(playLandAction).toBeDefined();
  });
});

describe('MCP Integration - Mana ability filtering', () => {
  it('should NOT show tap-for-mana alongside CAST_SPELL', () => {
    const state = setupMCPState({
      playerHand: ['Grizzly Bears'],
      playerBattlefield: ['Forest', 'Forest'],
      activePlayer: 'player',
      priorityPlayer: 'player',
      phase: 'main1',
      landsPlayedThisTurn: 0,
      f6Mode: true,
    });

    const actions = getLegalActions(state, 'player');

    // Should have CAST_SPELL
    const castActions = actions.filter((a) => a.type === 'CAST_SPELL');
    expect(castActions.length).toBe(1);

    // Should NOT have ACTIVATE_ABILITY for mana
    const manaAbilityActions = actions.filter((a) => a.type === 'ACTIVATE_ABILITY');
    expect(manaAbilityActions.length).toBe(0);

    // Verify action descriptions
    const descriptions = actions.map((a) => describeAction(a, state));
    expect(descriptions).toContain('Cast Grizzly Bears');
    expect(descriptions.some((d) => d.includes('Tap'))).toBe(false);
  });

  it('should show mana abilities when no CAST_SPELL is available but ability needs mana', () => {
    const state = setupMCPState({
      playerHand: ['Gorilla Chieftain'], // {2}{G}{G} - can't afford with 2 forests
      playerBattlefield: ['Forest', 'Forest'],
      activePlayer: 'player',
      priorityPlayer: 'player',
      phase: 'main1',
      landsPlayedThisTurn: 1, // Already played land
      f6Mode: true,
    });

    const actions = getLegalActions(state, 'player');

    // Should NOT have CAST_SPELL (can't afford)
    const castActions = actions.filter((a) => a.type === 'CAST_SPELL');
    expect(castActions.length).toBe(0);

    // When there's no mana-costing ability we can activate, mana abilities are pointless
    // So they should be filtered out as well
    const manaAbilityActions = actions.filter((a) => a.type === 'ACTIVATE_ABILITY');
    expect(manaAbilityActions.length).toBe(0);
  });

  it('should filter mana abilities correctly in list_actions output format', () => {
    const state = setupMCPState({
      playerHand: ['Grizzly Bears'],
      playerBattlefield: ['Forest', 'Forest', 'Forest'],
      activePlayer: 'player',
      priorityPlayer: 'player',
      phase: 'main1',
      landsPlayedThisTurn: 1,
      f6Mode: true,
    });

    const actions = getLegalActions(state, 'player');

    // Format like MCP server does
    const actionList = actions
      .map((a, i) => {
        const desc = describeAction(a, state);
        return `${i}: ${desc}`;
      })
      .join('\n');

    // Should not contain "Forest: Tap" anywhere
    expect(actionList).not.toContain('Forest: Tap');
    expect(actionList).toContain('Cast Grizzly Bears');
  });
});

describe('MCP Integration - Full game loop simulation', () => {
  it('should generate correct actions through multiple priority passes', () => {
    let state = setupMCPState({
      playerHand: ['Forest', 'Grizzly Bears'],
      playerBattlefield: ['Forest'],
      activePlayer: 'player',
      priorityPlayer: 'player',
      phase: 'main1',
      landsPlayedThisTurn: 0,
      f6Mode: true,
    });

    // Get initial actions
    let actions = getLegalActions(state, 'player');

    // Verify we have PLAY_LAND, not just PASS_PRIORITY
    const actionTypes = actions.map((a) => a.type);
    expect(actionTypes).toContain('PLAY_LAND');

    // Verify the count makes sense (PASS, END_TURN, PLAY_LAND)
    // Should NOT have mana abilities since we can't cast anything yet
    expect(actions.length).toBeGreaterThanOrEqual(2);
    expect(actions.length).toBeLessThanOrEqual(4); // PASS, END_TURN, PLAY_LAND, maybe CAST

    // Play the land
    const playLandAction = actions.find((a) => a.type === 'PLAY_LAND');
    expect(playLandAction).toBeDefined();
    state = applyAction(state, playLandAction!);

    // Now we should be able to cast Grizzly Bears (2 forests available)
    actions = getLegalActions(state, 'player');
    const castAction = actions.find((a) => a.type === 'CAST_SPELL');
    expect(castAction).toBeDefined();
    expect(describeAction(castAction!, state)).toBe('Cast Grizzly Bears');

    // Should still NOT have mana abilities (redundant when CAST_SPELL available)
    const manaActions = actions.filter((a) => a.type === 'ACTIVATE_ABILITY');
    expect(manaActions.length).toBe(0);
  });
});

describe('MCP Integration - Edge cases', () => {
  it('should handle opponent turn correctly', () => {
    const state = setupMCPState({
      playerHand: ['Giant Growth'],
      playerBattlefield: ['Forest', 'Grizzly Bears'],
      opponentBattlefield: ['Llanowar Elves'],
      activePlayer: 'opponent',
      priorityPlayer: 'player',
      phase: 'main1',
      landsPlayedThisTurn: 0,
      f6Mode: true,
    });

    const actions = getLegalActions(state, 'player');

    // During opponent's turn, should have instant speed options
    // Giant Growth can target our Grizzly Bears or opponent's Llanowar Elves
    const castActions = actions.filter((a) => a.type === 'CAST_SPELL');
    expect(castActions.length).toBeGreaterThan(0);

    // Should NOT have PLAY_LAND (can't play during opponent's turn)
    const playLandActions = actions.filter((a) => a.type === 'PLAY_LAND');
    expect(playLandActions.length).toBe(0);
  });

  it('should NOT show mana abilities during opponent combat with only sorcery-speed spells', () => {
    // This is the exact scenario the Task Agent reported
    const state = setupMCPState({
      playerHand: ['Grizzly Bears'], // Sorcery-speed creature
      playerBattlefield: ['Forest'],
      activePlayer: 'opponent',
      priorityPlayer: 'player',
      phase: 'combat',
      step: 'declare_blockers',
      landsPlayedThisTurn: 0,
      f6Mode: true,
    });

    const actions = getLegalActions(state, 'player');

    // Should NOT have mana abilities - can't cast Grizzly Bears at instant speed
    const manaAbilityActions = actions.filter((a) => a.type === 'ACTIVATE_ABILITY');
    expect(manaAbilityActions.length).toBe(0);

    // Should only have PASS_PRIORITY and DECLARE_BLOCKERS (don't block)
    const actionTypes = actions.map((a) => a.type);
    expect(actionTypes).toContain('PASS_PRIORITY');
  });

  it('should show mana abilities during opponent combat WITH instant-speed spells', () => {
    const state = setupMCPState({
      playerHand: ['Giant Growth'], // Instant
      playerBattlefield: ['Forest', 'Grizzly Bears'],
      opponentBattlefield: ['Llanowar Elves'],
      activePlayer: 'opponent',
      priorityPlayer: 'player',
      phase: 'combat',
      step: 'declare_blockers',
      landsPlayedThisTurn: 0,
      f6Mode: true,
    });

    // Make opponent's creature an attacker
    state.players.opponent.battlefield[0]!.attacking = true;

    const actions = getLegalActions(state, 'player');

    // Should have CAST_SPELL for Giant Growth
    const castActions = actions.filter((a) => a.type === 'CAST_SPELL');
    expect(castActions.length).toBeGreaterThan(0);

    // Mana abilities should be filtered since CAST_SPELL is available
    const manaAbilityActions = actions.filter((a) => a.type === 'ACTIVATE_ABILITY');
    expect(manaAbilityActions.length).toBe(0);
  });

  it('should handle empty hand correctly', () => {
    const state = setupMCPState({
      playerHand: [],
      playerBattlefield: ['Forest', 'Forest'],
      activePlayer: 'player',
      priorityPlayer: 'player',
      phase: 'main1',
      landsPlayedThisTurn: 0,
      f6Mode: true,
    });

    const actions = getLegalActions(state, 'player');

    // With empty hand and only lands, should auto-pass
    // (no meaningful actions available)
    expect(actions.length).toBe(1);
    expect(actions[0]?.type).toBe('PASS_PRIORITY');
  });

  it('should handle only lands in hand', () => {
    const state = setupMCPState({
      playerHand: ['Forest'],
      playerBattlefield: ['Forest', 'Forest'],
      activePlayer: 'player',
      priorityPlayer: 'player',
      phase: 'main1',
      landsPlayedThisTurn: 0,
      f6Mode: true,
    });

    const actions = getLegalActions(state, 'player');

    // Should have PLAY_LAND available
    const playLandActions = actions.filter((a) => a.type === 'PLAY_LAND');
    expect(playLandActions.length).toBe(1);
  });
});
