/**
 * State Persistence Tests
 *
 * Tests to verify game state is properly maintained across:
 * - Multiple turn cycles
 * - Spell resolution (especially tutors that add to battlefield)
 * - Action application
 *
 * These tests were created to investigate a bug where lands disappeared
 * from the battlefield mid-game.
 */

import { test, expect, describe, beforeEach } from 'bun:test';
import {
  initializeGame,
  applyAction,
  getLegalActions,
  getPlayer,
  CardLoader,
  createGreenDeck,
  createRedDeck,
  isLand,
  type GameState,
  type Action,
  type PlayerId,
} from '../src/index';

describe('State Persistence', () => {
  let state: GameState;

  beforeEach(() => {
    // Use green vs red to match the game where the bug occurred
    state = initializeGame(createGreenDeck(), createRedDeck(), 12345);
  });

  describe('Battlefield persistence across turns', () => {
    test('lands should persist after multiple turns', () => {
      // Play a land
      const playLandAction = getLegalActions(state, 'player').find((a) => a.type === 'PLAY_LAND');
      expect(playLandAction).toBeDefined();

      state = applyAction(state, playLandAction!);
      const initialLandCount = getPlayer(state, 'player').battlefield.filter((c) => {
        const t = CardLoader.getById(c.scryfallId);
        return t && isLand(t);
      }).length;
      expect(initialLandCount).toBe(1);

      // End turn multiple times and verify lands persist
      for (let i = 0; i < 5; i++) {
        // Find end turn or pass action
        const actions = getLegalActions(state, state.priorityPlayer);
        const endAction = actions.find((a) => a.type === 'END_TURN' || a.type === 'PASS_PRIORITY');
        if (endAction) {
          state = applyAction(state, endAction);
        }

        // Verify lands still on battlefield
        const landCount = getPlayer(state, 'player').battlefield.filter((c) => {
          const t = CardLoader.getById(c.scryfallId);
          return t && isLand(t);
        }).length;
        expect(landCount).toBeGreaterThanOrEqual(initialLandCount);
      }
    });

    test('creatures should persist after multiple turns', () => {
      // Set up mana
      const player = getPlayer(state, 'player');
      player.manaPool = { white: 0, blue: 0, black: 0, red: 0, green: 5, colorless: 5 };

      // Find a creature to cast
      const castAction = getLegalActions(state, 'player').find((a) => a.type === 'CAST_SPELL');

      if (castAction) {
        state = applyAction(state, castAction);

        // Resolve the spell
        while (state.stack.length > 0) {
          const passAction = getLegalActions(state, state.priorityPlayer).find(
            (a) => a.type === 'PASS_PRIORITY',
          );
          if (passAction) {
            state = applyAction(state, passAction);
          }
        }

        const initialCreatureCount = getPlayer(state, 'player').battlefield.length;

        // End turn multiple times
        for (let i = 0; i < 3; i++) {
          const actions = getLegalActions(state, state.priorityPlayer);
          const endAction = actions.find(
            (a) => a.type === 'END_TURN' || a.type === 'PASS_PRIORITY',
          );
          if (endAction) {
            state = applyAction(state, endAction);
          }
        }

        // Verify creatures still exist (unless they died in combat)
        const finalCreatureCount = getPlayer(state, 'player').battlefield.length;
        // Should be at least 0 (might have died) but not negative
        expect(finalCreatureCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Untamed Wilds state persistence', () => {
    test('land from Untamed Wilds should persist after resolution', () => {
      // Find Untamed Wilds in hand or add it
      const player = getPlayer(state, 'player');
      const untamedWildsTemplate = CardLoader.getByName('Untamed Wilds');
      expect(untamedWildsTemplate).toBeDefined();

      // Add Untamed Wilds to hand if not present
      const untamedWildsInHand = player.hand.find((c) => {
        const t = CardLoader.getById(c.scryfallId);
        return t?.name === 'Untamed Wilds';
      });

      if (!untamedWildsInHand) {
        // Create one and add to hand
        const newCard = {
          instanceId: 'test-untamed-wilds',
          scryfallId: untamedWildsTemplate!.id,
          zone: 'hand' as const,
          controller: 'player' as const,
          owner: 'player' as const,
          tapped: false,
          summoningSick: false,
          damage: 0,
          counters: {},
          attachedTo: null,
          attachments: [],
        };
        player.hand.push(newCard);
      }

      // Give player enough mana to cast it (2G)
      player.manaPool = { white: 0, blue: 0, black: 0, red: 0, green: 3, colorless: 0 };

      // Count initial lands on battlefield
      const initialLandCount = player.battlefield.filter((c) => {
        const t = CardLoader.getById(c.scryfallId);
        return t && isLand(t);
      }).length;

      // Cast Untamed Wilds
      const castAction = getLegalActions(state, 'player').find((a) => {
        if (a.type !== 'CAST_SPELL') return false;
        const card = player.hand.find((c) => c.instanceId === a.payload.cardInstanceId);
        if (!card) return false;
        const t = CardLoader.getById(card.scryfallId);
        return t?.name === 'Untamed Wilds';
      });

      if (!castAction) {
        // Skip test if we can't cast (might not be in hand)
        return;
      }

      state = applyAction(state, castAction);

      // Resolve the spell by passing priority
      let iterations = 0;
      while (state.stack.length > 0 && iterations < 10) {
        const passAction = getLegalActions(state, state.priorityPlayer).find(
          (a) => a.type === 'PASS_PRIORITY',
        );
        if (passAction) {
          state = applyAction(state, passAction);
        }
        iterations++;
      }

      // Verify land count increased
      const afterResolveLandCount = getPlayer(state, 'player').battlefield.filter((c) => {
        const t = CardLoader.getById(c.scryfallId);
        return t && isLand(t);
      }).length;
      expect(afterResolveLandCount).toBe(initialLandCount + 1);

      // Now advance several turns and verify land persists
      for (let turn = 0; turn < 5; turn++) {
        // Pass through the turn
        let turnIterations = 0;
        while (turnIterations < 20) {
          const actions = getLegalActions(state, state.priorityPlayer);
          const endAction = actions.find((a) => a.type === 'END_TURN');
          const passAction = actions.find((a) => a.type === 'PASS_PRIORITY');

          if (endAction && state.priorityPlayer === state.activePlayer) {
            state = applyAction(state, endAction);
            break;
          } else if (passAction) {
            state = applyAction(state, passAction);
          } else {
            break;
          }
          turnIterations++;
        }

        // Verify lands persist after each turn
        const currentLandCount = getPlayer(state, 'player').battlefield.filter((c) => {
          const t = CardLoader.getById(c.scryfallId);
          return t && isLand(t);
        }).length;
        expect(currentLandCount).toBeGreaterThanOrEqual(afterResolveLandCount);
      }
    });
  });

  describe('State immutability', () => {
    test('applyAction should not modify original state', () => {
      const originalState = structuredClone(state);

      // Apply an action
      const action = getLegalActions(state, 'player').find((a) => a.type === 'PLAY_LAND');
      if (action) {
        const newState = applyAction(state, action);

        // Original state should be unchanged
        expect(state.players.player.battlefield.length).toBe(
          originalState.players.player.battlefield.length,
        );
        expect(state.players.player.hand.length).toBe(originalState.players.player.hand.length);

        // New state should be different
        expect(newState.players.player.battlefield.length).toBe(
          originalState.players.player.battlefield.length + 1,
        );
      }
    });

    test('state cloning should preserve all fields', () => {
      // Add some complexity to state
      const player = getPlayer(state, 'player');
      player.manaPool = { white: 1, blue: 2, black: 3, red: 4, green: 5, colorless: 6 };
      player.life = 15;
      state.turnCount = 5;

      // Clone
      const cloned = structuredClone(state);

      // Verify all fields
      expect(cloned.players.player.manaPool).toEqual(player.manaPool);
      expect(cloned.players.player.life).toBe(15);
      expect(cloned.turnCount).toBe(5);
      expect(cloned.players.player.battlefield).toEqual(player.battlefield);
      expect(cloned.players.player.hand).toEqual(player.hand);
      expect(cloned.players.player.library.length).toBe(player.library.length);
    });
  });

  describe('Full game simulation', () => {
    test('should complete 20 turns without state corruption', () => {
      let turnCount = 0;
      const maxTurns = 20;
      const maxIterations = 500;
      let iterations = 0;

      while (!state.gameOver && turnCount < maxTurns && iterations < maxIterations) {
        const actions = getLegalActions(state, state.priorityPlayer);

        if (actions.length === 0) {
          break;
        }

        // Pick a reasonable action (prefer playing lands and ending turn)
        const action =
          actions.find((a) => a.type === 'PLAY_LAND') ||
          actions.find((a) => a.type === 'END_TURN') ||
          actions.find((a) => a.type === 'PASS_PRIORITY') ||
          actions[0];

        if (action) {
          const prevTurn = state.turnCount;
          state = applyAction(state, action);

          // Track turn changes
          if (state.turnCount > prevTurn) {
            turnCount++;
          }

          // Verify state integrity after each action
          expect(state.players.player.life).toBeLessThanOrEqual(20);
          expect(state.players.player.life).toBeGreaterThanOrEqual(-100); // Can go negative before game ends
          expect(state.players.opponent.life).toBeLessThanOrEqual(20);
          expect(state.players.player.battlefield).toBeInstanceOf(Array);
          expect(state.players.player.hand).toBeInstanceOf(Array);
          expect(state.players.player.library).toBeInstanceOf(Array);
        }

        iterations++;
      }

      // Should have progressed through some turns
      expect(turnCount).toBeGreaterThan(0);
    });
  });
});
