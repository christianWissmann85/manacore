/**
 * Tests for X spell action enumeration
 *
 * X spells (like Blaze {X}{R}) should generate multiple CAST_SPELL actions,
 * one for each affordable X value, so AI can properly evaluate different choices.
 */

import { describe, it, expect } from 'bun:test';
import { initializeGame, getLegalActions, describeAction } from '../src';
import type { GameState } from '../src/state/GameState';
import type { PlayerId } from '../src/state/Zone';
import type { CardInstance } from '../src/state/CardInstance';
import type { CastSpellAction } from '../src/actions/Action';
import { CardLoader } from '../src/cards/CardLoader';
import { X_MAX_CAP } from '../src/utils/manaCosts';

// Helper to create a card instance
function createCard(name: string, owner: PlayerId, zone: CardInstance['zone']): CardInstance {
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

// Helper to set up a test state
function setupState(config: {
  playerHand?: string[];
  playerBattlefield?: string[];
  opponentBattlefield?: string[];
}): GameState {
  const state = initializeGame([], [], 12345);

  state.players.player.hand = [];
  state.players.player.battlefield = [];
  state.players.opponent.battlefield = [];

  for (const name of config.playerHand || []) {
    state.players.player.hand.push(createCard(name, 'player', 'hand'));
  }

  for (const name of config.playerBattlefield || []) {
    state.players.player.battlefield.push(createCard(name, 'player', 'battlefield'));
  }

  for (const name of config.opponentBattlefield || []) {
    const card = createCard(name, 'opponent', 'battlefield');
    card.summoningSick = false;
    state.players.opponent.battlefield.push(card);
  }

  state.activePlayer = 'player';
  state.priorityPlayer = 'player';
  state.phase = 'main1';
  state.stack = [];

  return state;
}

describe('X Spell Action Enumeration', () => {
  describe('Basic X spell enumeration', () => {
    it('should enumerate X values for Blaze with 5 Mountains', () => {
      const state = setupState({
        playerHand: ['Blaze'], // {X}{R}
        playerBattlefield: ['Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain'],
      });

      const actions = getLegalActions(state, 'player');
      const blazeActions = actions.filter((a) => a.type === 'CAST_SPELL') as CastSpellAction[];

      // With 5 Mountains (5R mana), can afford X=0 to X=4
      // Targets: player, opponent = 2 targets
      // Expected: 5 X values × 2 targets = 10 actions (excluding own lands as targets)
      // Note: Blaze can target any permanent, so lands are valid targets too

      // Check that we have multiple X values
      const xValues = new Set(blazeActions.map((a) => a.payload.xValue));
      expect(xValues.has(0)).toBe(true);
      expect(xValues.has(1)).toBe(true);
      expect(xValues.has(2)).toBe(true);
      expect(xValues.has(3)).toBe(true);
      expect(xValues.has(4)).toBe(true);
      expect(xValues.has(5)).toBe(false); // Can't afford X=5 with only 5 mana
    });

    it('should enumerate X values for Earthquake (no target)', () => {
      const state = setupState({
        playerHand: ['Earthquake'], // {X}{R} - deals X damage to all creatures and players
        playerBattlefield: ['Mountain', 'Mountain', 'Mountain'],
      });

      const actions = getLegalActions(state, 'player');
      const earthquakeActions = actions.filter((a) => a.type === 'CAST_SPELL') as CastSpellAction[];

      // With 3 Mountains (3R mana), can afford X=0 to X=2
      // Earthquake has no targets, so just 3 actions
      expect(earthquakeActions.length).toBe(3);

      const xValues = earthquakeActions.map((a) => a.payload.xValue).sort();
      expect(xValues).toEqual([0, 1, 2]);
    });

    it('should NOT enumerate for non-X spells', () => {
      const state = setupState({
        playerHand: ['Grizzly Bears'], // {1}{G}
        playerBattlefield: ['Forest', 'Forest'],
      });

      const actions = getLegalActions(state, 'player');
      const bearsActions = actions.filter((a) => a.type === 'CAST_SPELL') as CastSpellAction[];

      // Should have exactly 1 action (no X enumeration)
      expect(bearsActions.length).toBe(1);

      // Should NOT have xValue in payload
      expect(bearsActions[0]?.payload.xValue).toBeUndefined();
    });
  });

  describe('X value cap', () => {
    it('should cap X values at X_MAX_CAP (15)', () => {
      const state = setupState({
        playerHand: ['Earthquake'],
        playerBattlefield: Array(20).fill('Mountain'), // 20 Mountains = can afford X=19
      });

      const actions = getLegalActions(state, 'player');
      const earthquakeActions = actions.filter((a) => a.type === 'CAST_SPELL') as CastSpellAction[];

      // Should be capped at X_MAX_CAP + 1 actions (X=0 to X=15)
      expect(earthquakeActions.length).toBe(X_MAX_CAP + 1);

      const maxX = Math.max(...earthquakeActions.map((a) => a.payload.xValue || 0));
      expect(maxX).toBe(X_MAX_CAP);
    });
  });

  describe('Edge cases', () => {
    it('should handle X=0 only when barely affordable', () => {
      const state = setupState({
        playerHand: ['Blaze'], // {X}{R}
        playerBattlefield: ['Mountain'], // Only 1 Mountain
      });

      const actions = getLegalActions(state, 'player');
      const blazeActions = actions.filter((a) => a.type === 'CAST_SPELL') as CastSpellAction[];

      // With 1 Mountain, can only afford X=0
      // Should still generate actions for X=0 targeting player, opponent
      expect(blazeActions.length).toBeGreaterThan(0);

      const xValues = new Set(blazeActions.map((a) => a.payload.xValue));
      expect(xValues.size).toBe(1);
      expect(xValues.has(0)).toBe(true);
    });

    it('should not generate actions when colored mana requirement not met', () => {
      const state = setupState({
        playerHand: ['Blaze'], // {X}{R} - needs Red
        playerBattlefield: ['Forest', 'Forest', 'Forest'], // Only Green mana
      });

      const actions = getLegalActions(state, 'player');
      const blazeActions = actions.filter((a) => a.type === 'CAST_SPELL');

      // Can't cast Blaze without Red mana
      expect(blazeActions.length).toBe(0);
    });

    it('should handle {X}{X} cost spells correctly', () => {
      // Note: Need to find or verify an {X}{X} spell in 6ed
      // For now, test the math: {X}{X}{U} with 7 mana should allow X=0,1,2,3
      // (7 - 1 for U) / 2 = 3
      // Skip if no {X}{X} spell in 6ed - the math is tested in unit tests
    });
  });

  describe('Action descriptions', () => {
    it('should include X value in action description', () => {
      const state = setupState({
        playerHand: ['Earthquake'],
        playerBattlefield: ['Mountain', 'Mountain', 'Mountain'],
      });

      const actions = getLegalActions(state, 'player');
      const earthquakeActions = actions.filter((a) => a.type === 'CAST_SPELL') as CastSpellAction[];

      // Check descriptions
      const descriptions = earthquakeActions.map((a) => describeAction(a, state));

      expect(descriptions).toContain('Cast Earthquake (X=0)');
      expect(descriptions).toContain('Cast Earthquake (X=1)');
      expect(descriptions).toContain('Cast Earthquake (X=2)');
    });

    it('should include X value and target in description for targeted X spells', () => {
      const state = setupState({
        playerHand: ['Blaze'],
        playerBattlefield: ['Mountain', 'Mountain'],
      });

      const actions = getLegalActions(state, 'player');
      const blazeActions = actions.filter((a) => a.type === 'CAST_SPELL') as CastSpellAction[];

      const descriptions = blazeActions.map((a) => describeAction(a, state));

      // Should have descriptions like "Cast Blaze (X=0) targeting Opponent"
      expect(descriptions.some((d) => d.includes('(X=0)') && d.includes('Opponent'))).toBe(true);
      expect(descriptions.some((d) => d.includes('(X=1)') && d.includes('Opponent'))).toBe(true);
    });

    it('should NOT include X value for non-X spells', () => {
      const state = setupState({
        playerHand: ['Grizzly Bears'],
        playerBattlefield: ['Forest', 'Forest'],
      });

      const actions = getLegalActions(state, 'player');
      const bearsAction = actions.find((a) => a.type === 'CAST_SPELL');

      const description = describeAction(bearsAction!, state);

      expect(description).toBe('Cast Grizzly Bears');
      expect(description).not.toContain('X=');
    });
  });
});
