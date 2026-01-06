/**
 * Replay System Demo
 *
 * This script demonstrates the full replay workflow:
 * 1. Play a game between two bots
 * 2. Record it to a replay file
 * 3. Load and replay it to verify determinism
 */

import {
  initializeGame,
  applyAction,
  getLegalActions,
  createRedDeck,
  createGreenDeck,
  _resetInstanceCounter,
  _resetModificationCounter,
} from '@manacore/engine';
import type { GameState, Action } from '@manacore/engine';
import {
  ReplayRecorder,
  saveReplay,
  loadReplay,
  replayGame,
  getReplaySummary,
  verifyReplay,
} from '../src/replay';

// Simple seeded RNG for bot decisions
function createSeededRandom(seed: number): () => number {
  let state = seed;
  return function () {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

async function main() {
  console.log('🎮 ManaCore Replay System Demo\n');
  console.log('='.repeat(50));

  // =========================================================================
  // STEP 1: Play a game and record it
  // =========================================================================
  console.log('\n📹 STEP 1: Playing and recording a game...\n');

  const GAME_SEED = 42;
  const BOT_SEED = 99;
  const MAX_TURNS = 30;

  // Reset counters for determinism
  _resetInstanceCounter();
  _resetModificationCounter();

  // Initialize game
  const playerDeck = createRedDeck();
  const opponentDeck = createGreenDeck();
  let state = initializeGame(playerDeck, opponentDeck, GAME_SEED);

  // Create recorder
  const recorder = new ReplayRecorder({
    gameSeed: GAME_SEED,
    decks: {
      player: { name: 'red' },
      opponent: { name: 'green' },
    },
    bots: {
      player: { type: 'RandomBot', seed: BOT_SEED },
      opponent: { type: 'RandomBot', seed: BOT_SEED },
    },
    description: 'Demo game for replay system',
  });

  // Play the game with random bot decisions
  const rng = createSeededRandom(BOT_SEED);
  let actionCount = 0;

  console.log(`  Game seed: ${GAME_SEED}`);
  console.log(`  Bot seed: ${BOT_SEED}`);
  console.log(`  Decks: Red vs Green`);
  console.log('');

  while (!state.gameOver && state.turnCount <= MAX_TURNS) {
    const legalActions = getLegalActions(state, state.priorityPlayer);
    if (legalActions.length === 0) break;

    const index = Math.floor(rng() * legalActions.length);
    const action = legalActions[index]!;

    // Record the action
    recorder.recordAction(action);
    actionCount++;

    // Apply the action
    state = applyAction(state, action);
  }

  // Set the outcome
  recorder.setOutcomeFromState(state);

  console.log(`  ✅ Game completed!`);
  console.log(`  Winner: ${state.winner || 'draw'}`);
  console.log(`  Turns: ${state.turnCount}`);
  console.log(`  Actions: ${actionCount}`);
  console.log(`  Final life: Player ${state.players.player.life}, Opponent ${state.players.opponent.life}`);

  // =========================================================================
  // STEP 2: Save the replay to a file
  // =========================================================================
  console.log('\n💾 STEP 2: Saving replay to file...\n');

  const replayPath = '/tmp/manacore-demo.replay.json';
  recorder.save(replayPath);

  console.log(`  ✅ Saved to: ${replayPath}`);

  // =========================================================================
  // STEP 3: Load and display replay summary
  // =========================================================================
  console.log('\n📂 STEP 3: Loading replay and showing summary...\n');

  const loaded = loadReplay(replayPath);
  const summary = getReplaySummary(loaded);

  console.log('  Replay Summary:');
  console.log(`    Version:     ${summary.version}`);
  console.log(`    Timestamp:   ${new Date(summary.timestamp).toLocaleString()}`);
  console.log(`    Seed:        ${summary.seed}`);
  console.log(`    Decks:       ${summary.playerDeck} vs ${summary.opponentDeck}`);
  console.log(`    Winner:      ${summary.winner}`);
  console.log(`    Turns:       ${summary.turns}`);
  console.log(`    Actions:     ${summary.actionCount}`);
  console.log(`    End reason:  ${summary.reason}`);

  // =========================================================================
  // STEP 4: Verify the replay
  // =========================================================================
  console.log('\n🔍 STEP 4: Verifying replay integrity...\n');

  const verification = verifyReplay(loaded);

  if (verification.valid) {
    console.log('  ✅ Replay verified! Game can be perfectly reproduced.');
  } else {
    console.log('  ❌ Verification failed:');
    for (const error of verification.errors) {
      console.log(`    - ${error}`);
    }
  }

  // =========================================================================
  // STEP 5: Replay the game and compare
  // =========================================================================
  console.log('\n🔄 STEP 5: Replaying the game...\n');

  const replayResult = replayGame(loaded);

  console.log(`  Replay outcome matched: ${replayResult.outcomeMatched ? '✅ Yes' : '❌ No'}`);
  console.log(`  Final state matches:`);
  console.log(`    Winner: ${replayResult.finalState.winner} (expected: ${state.winner})`);
  console.log(`    Turns: ${replayResult.finalState.turnCount} (expected: ${state.turnCount})`);
  console.log(`    Player life: ${replayResult.finalState.players.player.life} (expected: ${state.players.player.life})`);
  console.log(`    Opponent life: ${replayResult.finalState.players.opponent.life} (expected: ${state.players.opponent.life})`);

  if (replayResult.errors.length > 0) {
    console.log('\n  Errors:');
    for (const error of replayResult.errors) {
      console.log(`    - ${error}`);
    }
  }

  // =========================================================================
  // DONE
  // =========================================================================
  console.log('\n' + '='.repeat(50));
  console.log('🎉 Demo complete!\n');
  console.log('You can now replay this game using the CLI:');
  console.log(`  bun src/index.ts replay ${replayPath}`);
  console.log(`  bun src/index.ts replay ${replayPath} --summary`);
  console.log(`  bun src/index.ts replay ${replayPath} --verify`);
  console.log(`  bun src/index.ts replay ${replayPath} --turn 5`);
}

main().catch(console.error);
