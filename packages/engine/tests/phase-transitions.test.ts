import { createGameState } from '../src/state/GameState';
import { applyAction } from '../src/actions/reducer';
import type { GameState } from '../src/state/GameState';

describe('Priority Loop Bug', () => {
  let state: GameState;

  beforeEach(() => {
    // Setup a basic game state
    state = createGameState([], []);
  });

  test('Both players passing priority in Main Phase 1 should advance to Combat', () => {
    // Set to Main 1
    state.phase = 'main1';
    state.step = 'main';
    state.activePlayer = 'player';
    state.priorityPlayer = 'player';

    // Player passes
    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'player',
      payload: {},
    });

    expect(state.priorityPlayer).toBe('opponent');

    // Opponent passes
    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'opponent',
      payload: {},
    });

    // Should advance to Combat (Declare Attackers)
    expect(state.phase).toBe('combat');
    expect(state.step).toBe('declare_attackers');
    // Active player (player) should typically get priority in declare attackers
    // (though in declare blockers it goes to defender)
    expect(state.priorityPlayer).toBe('player');
  });

  test('Both players passing priority in Main Phase 2 should advance to End Turn / Next Turn', () => {
    // Set to Main 2
    state.phase = 'main2';
    state.step = 'main';
    state.activePlayer = 'player';
    state.priorityPlayer = 'player';

    // Player passes
    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'player',
      payload: {},
    });

    expect(state.priorityPlayer).toBe('opponent');

    // Opponent passes
    state = applyAction(state, {
      type: 'PASS_PRIORITY',
      playerId: 'opponent',
      payload: {},
    });

    // Should NOT be in main2 anymore
    expect(state.phase).not.toBe('main2');

    // In the current implementation's likely intended flow, it might go to 'ending' phase or
    // directly execute EndTurnAction logic if that's how it's wired.
    // Or it might loop back to beginning if EndTurn is auto-applied.
    // Based on `applyEndTurn` existing, there might be an implicit END_TURN action
    // or the phase should become 'ending'.
    // However, looking at `reducer.ts`, `applyEndTurn` resets to 'beginning'.

    // If the fix is implemented correctly, it should likely transition to the next turn
    // OR trigger the end step.

    // Ideally:
    // Main 2 -> End Step -> Cleanup -> Next Turn.

    // If the current engine skips End/Cleanup phases for simplicity and goes straight to Next Turn:
    // state.turnCount should increment OR state.phase should be 'beginning' of next turn.

    // Let's just check it left main2 for now.
  });
});
