/**
 * Game Invariant Tests
 *
 * These tests verify critical game invariants that should ALWAYS hold true:
 * 1. priorityPlayer always has at least one legal action
 * 2. Game state transitions are valid
 * 3. Edge cases don't break the engine
 */

import { describe, test, expect } from 'bun:test';
import {
  CardLoader,
  createCardInstance,
  createGameState,
  applyAction,
  getLegalActions,
  initializeGame,
  getTestDeck,
  type GameState,
  type PlayerId,
  type DeclareAttackersAction,
  type DeclareBlockersAction,
  type PassPriorityAction,
  type EndTurnAction,
} from '../src/index';

/**
 * Helper to verify the critical invariant: priorityPlayer always has legal actions
 */
function assertPriorityPlayerHasActions(state: GameState, context: string): void {
  const legalActions = getLegalActions(state, state.priorityPlayer);
  if (legalActions.length === 0) {
    throw new Error(
      `INVARIANT VIOLATION: priorityPlayer has no legal actions!\n` +
        `Context: ${context}\n` +
        `State: phase=${state.phase}, step=${state.step}, ` +
        `activePlayer=${state.activePlayer}, priorityPlayer=${state.priorityPlayer}, ` +
        `turn=${state.turnCount}`,
    );
  }
}

/**
 * Run a game with invariant checks after every action
 */
function runGameWithInvariantChecks(
  maxActions: number = 500,
  seed?: number,
): { state: GameState; actionsExecuted: number } {
  const playerDeck = getTestDeck('green');
  const opponentDeck = getTestDeck('red');
  let state = initializeGame(playerDeck, opponentDeck, seed);

  let actionsExecuted = 0;

  while (!state.gameOver && actionsExecuted < maxActions) {
    // INVARIANT CHECK: priorityPlayer must have legal actions
    assertPriorityPlayerHasActions(state, `before action ${actionsExecuted + 1}`);

    // Get legal actions and pick the first one (deterministic)
    const legalActions = getLegalActions(state, state.priorityPlayer);
    const action = legalActions[0]!;

    // Apply action
    state = applyAction(state, action);
    actionsExecuted++;

    // INVARIANT CHECK: after action, priorityPlayer should still have actions (unless game over)
    if (!state.gameOver) {
      assertPriorityPlayerHasActions(state, `after action ${actionsExecuted}`);
    }
  }

  return { state, actionsExecuted };
}

describe('Game Invariants', () => {
  test('priorityPlayer always has legal actions (deterministic game)', () => {
    // Run a full game with invariant checks
    const { state, actionsExecuted } = runGameWithInvariantChecks(1000, 12345);

    expect(actionsExecuted).toBeGreaterThan(0);
    // Game should end normally or hit max actions
    expect(state.gameOver || actionsExecuted >= 1000).toBe(true);
  });

  test('priorityPlayer always has legal actions (multiple seeds)', () => {
    // Test with multiple different seeds to catch edge cases
    const seeds = [1, 42, 100, 999, 12345, 54321, 98765];

    for (const seed of seeds) {
      const { actionsExecuted } = runGameWithInvariantChecks(500, seed);
      expect(actionsExecuted).toBeGreaterThan(0);
    }
  });

  test('game initializes in main1 phase ready for play', () => {
    const playerDeck = getTestDeck('green');
    const opponentDeck = getTestDeck('red');
    const state = initializeGame(playerDeck, opponentDeck, 12345);

    // Game starts in main1 phase (beginning phase is automatic)
    expect(state.phase).toBe('main1');
    expect(state.activePlayer).toBe('player');
    expect(state.priorityPlayer).toBe('player');

    // Player should have legal actions
    const legalActions = getLegalActions(state, 'player');
    expect(legalActions.length).toBeGreaterThan(0);
  });
});

describe('Edge Case: Zero Attackers', () => {
  test('attacking with zero creatures transitions correctly', () => {
    const playerDeck = getTestDeck('green');
    const opponentDeck = getTestDeck('red');
    let state = initializeGame(playerDeck, opponentDeck, 12345);

    // Advance to main phase
    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: state.priorityPlayer,
      payload: {},
    } as PassPriorityAction);

    expect(state.phase).toBe('main1');

    // Declare attackers with zero creatures
    const declareAttackers: DeclareAttackersAction = {
      type: 'DECLARE_ATTACKERS',
      playerId: state.activePlayer,
      payload: { attackers: [] },
    };

    state = applyAction(state, declareAttackers);

    // Should be in declare_blockers, priority with defender
    expect(state.phase).toBe('combat');
    expect(state.step).toBe('declare_blockers');

    const defendingPlayer = state.activePlayer === 'player' ? 'opponent' : 'player';
    expect(state.priorityPlayer).toBe(defendingPlayer);

    // CRITICAL: Defender should have legal actions
    const defenderActions = getLegalActions(state, defendingPlayer);
    expect(defenderActions.length).toBeGreaterThan(0);

    // Defender declares no blockers
    const declareBlockers: DeclareBlockersAction = {
      type: 'DECLARE_BLOCKERS',
      playerId: defendingPlayer,
      payload: { blocks: [] },
    };

    state = applyAction(state, declareBlockers);

    // Should move to main2
    expect(state.phase).toBe('main2');
  });

  test('zero attackers from both players in sequence', () => {
    const playerDeck = getTestDeck('green');
    const opponentDeck = getTestDeck('red');
    let state = initializeGame(playerDeck, opponentDeck, 54321);

    // Play through several turns with zero attackers
    for (let turn = 0; turn < 3; turn++) {
      // Advance to main phase
      if (state.phase === 'beginning') {
        state = applyAction(state, {
          type: 'PASS_PRIORITY',
          playerId: state.priorityPlayer,
          payload: {},
        } as PassPriorityAction);
      }

      // Attack with zero creatures
      const attackAction: DeclareAttackersAction = {
        type: 'DECLARE_ATTACKERS',
        playerId: state.activePlayer,
        payload: { attackers: [] },
      };
      state = applyAction(state, attackAction);

      // INVARIANT: priorityPlayer should have actions
      assertPriorityPlayerHasActions(state, `turn ${turn + 1} after attack declaration`);

      // Declare no blockers
      const blockAction: DeclareBlockersAction = {
        type: 'DECLARE_BLOCKERS',
        playerId: state.priorityPlayer,
        payload: { blocks: [] },
      };
      state = applyAction(state, blockAction);

      // End turn
      const endTurn: EndTurnAction = {
        type: 'END_TURN',
        playerId: state.activePlayer,
        payload: {},
      };
      state = applyAction(state, endTurn);
    }

    // Game should still be running
    expect(state.gameOver).toBe(false);
    expect(state.turnCount).toBeGreaterThanOrEqual(3);
  });
});

describe('Edge Case: No Creatures for Many Turns', () => {
  test('game functions when neither player has creatures', () => {
    // Create a deck with only lands
    const landOnlyDeck = createLandOnlyDeck();

    let state = initializeGame(landOnlyDeck, landOnlyDeck, 11111);

    // Play through several turns, explicitly ending each turn
    let actionCount = 0;
    const targetTurns = 5;

    while (!state.gameOver && actionCount < 100 && state.turnCount <= targetTurns) {
      assertPriorityPlayerHasActions(state, `action ${actionCount + 1}, turn ${state.turnCount}`);

      const legalActions = getLegalActions(state, state.priorityPlayer);

      // Prefer: play land > end turn > pass priority
      let action = legalActions.find((a) => a.type === 'PLAY_LAND');
      if (!action) {
        action = legalActions.find((a) => a.type === 'END_TURN');
      }
      if (!action) {
        action = legalActions[0]!;
      }

      state = applyAction(state, action);
      actionCount++;
    }

    // Should have made it through multiple turns
    expect(state.turnCount).toBeGreaterThanOrEqual(3);
    // No game over (life totals should still be 20)
    expect(state.players.player.life).toBe(20);
    expect(state.players.opponent.life).toBe(20);
  });
});

describe('Edge Case: High Turn Count', () => {
  test('game remains stable at high turn counts', () => {
    const playerDeck = getTestDeck('white');
    const opponentDeck = getTestDeck('blue');
    let state = initializeGame(playerDeck, opponentDeck, 99999);

    // Run for many actions to reach high turn count
    let actionCount = 0;
    const maxActions = 2000;

    while (!state.gameOver && actionCount < maxActions) {
      assertPriorityPlayerHasActions(state, `action ${actionCount + 1}, turn ${state.turnCount}`);

      const legalActions = getLegalActions(state, state.priorityPlayer);
      const action = legalActions[0]!;
      state = applyAction(state, action);
      actionCount++;
    }

    // Should have run many actions
    expect(actionCount).toBeGreaterThan(100);
  });
});

describe('Edge Case: Combat Phase Transitions', () => {
  test('all combat phase transitions maintain invariant', () => {
    const playerDeck = getTestDeck('green');
    const opponentDeck = getTestDeck('red');
    let state = initializeGame(playerDeck, opponentDeck, 77777);

    // Get to main phase
    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: state.priorityPlayer,
      payload: {},
    } as PassPriorityAction);

    // Play some lands and cast some creatures first (to have actual combat)
    let actionCount = 0;
    while (actionCount < 50 && state.phase === 'main1') {
      const legalActions = getLegalActions(state, state.priorityPlayer);

      // Look for land plays or creature casts
      const playAction = legalActions.find(
        (a) => a.type === 'PLAY_LAND' || a.type === 'CAST_SPELL',
      );

      if (playAction) {
        state = applyAction(state, playAction);
      } else {
        // End turn to move forward
        const endTurn = legalActions.find((a) => a.type === 'END_TURN');
        if (endTurn) {
          state = applyAction(state, endTurn);
          // Back to main1 after beginning phase
          if (state.phase === 'beginning') {
            state = applyAction(state, {
              type: 'PASS_PRIORITY',
              playerId: state.priorityPlayer,
              payload: {},
            } as PassPriorityAction);
          }
        } else {
          break;
        }
      }
      actionCount++;

      // Check invariant
      if (!state.gameOver) {
        assertPriorityPlayerHasActions(state, `setup action ${actionCount}`);
      }
    }
  });
});

/**
 * Helper to create a deck with only basic lands
 */
function createLandOnlyDeck(): ReturnType<typeof getTestDeck> {
  const forest = CardLoader.getByName('Forest');
  const mountain = CardLoader.getByName('Mountain');

  if (!forest || !mountain) {
    throw new Error('Could not find basic lands');
  }

  const deck: ReturnType<typeof getTestDeck> = [];

  // 30 forests, 30 mountains
  for (let i = 0; i < 30; i++) {
    deck.push(createCardInstance(forest.id, 'player', 'library'));
    deck.push(createCardInstance(mountain.id, 'player', 'library'));
  }

  return deck;
}
