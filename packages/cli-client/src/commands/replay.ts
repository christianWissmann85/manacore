/**
 * Replay Command - Play back recorded games
 *
 * Load and replay games from .replay.json files, with options for:
 * - Stepping through turn by turn
 * - Jumping to specific turns
 * - Watching the game unfold
 * - Verifying replay integrity
 */

import type { Action } from '@manacore/engine';
import {
  loadReplay,
  replayGame,
  replayToTurn,
  getReplaySummary,
  verifyReplay,
} from '../replay';
import { renderGameState } from '../display/board';
import type { ReplaySnapshot } from '../types';

/**
 * Options for the replay command
 */
export interface ReplayCommandOptions {
  /** Path to replay file */
  filepath: string;

  /** Stop at specific turn */
  turn?: number;

  /** Stop at specific action */
  action?: number;

  /** Watch mode - show board after each action */
  watch?: boolean;

  /** Delay between actions in watch mode (ms) */
  delay?: number;

  /** Just verify the replay without output */
  verify?: boolean;

  /** Show summary only */
  summary?: boolean;

  /** Verbose output */
  verbose?: boolean;
}

/**
 * Sleep helper for watch mode
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run the replay command
 */
export async function runReplayCommand(options: ReplayCommandOptions): Promise<void> {
  const { filepath, turn, action, watch, delay = 500, verify, summary, verbose } = options;

  // Load replay file
  console.log(`📂 Loading replay: ${filepath}\n`);
  let replay;
  try {
    replay = loadReplay(filepath);
  } catch (e) {
    console.error(`❌ Failed to load replay: ${e}`);
    return;
  }

  // Show summary
  const replaySummary = getReplaySummary(replay);
  console.log('📋 Replay Summary:');
  console.log(`   Version:  ${replaySummary.version}`);
  console.log(`   Date:     ${new Date(replaySummary.timestamp).toLocaleString()}`);
  console.log(`   Seed:     ${replaySummary.seed}`);
  console.log(`   Decks:    ${replaySummary.playerDeck} vs ${replaySummary.opponentDeck}`);
  console.log(`   Winner:   ${replaySummary.winner}`);
  console.log(`   Turns:    ${replaySummary.turns}`);
  console.log(`   Actions:  ${replaySummary.actionCount}`);
  console.log(`   Reason:   ${replaySummary.reason}`);
  console.log('');

  // Summary only mode
  if (summary) {
    return;
  }

  // Verify mode
  if (verify) {
    console.log('🔍 Verifying replay...');
    const verifyResult = verifyReplay(replay);
    if (verifyResult.valid) {
      console.log('✅ Replay is valid!');
    } else {
      console.log('❌ Replay verification failed:');
      for (const error of verifyResult.errors) {
        console.log(`   - ${error}`);
      }
    }
    return;
  }

  // Stop at specific turn
  if (turn !== undefined && !watch) {
    console.log(`⏩ Replaying to turn ${turn}...\n`);
    const state = replayToTurn(replay, turn);
    console.log(renderGameState(state));
    console.log(`\n📍 Stopped at turn ${state.turnCount}, phase: ${state.phase}`);
    return;
  }

  // Watch mode - show game progressing
  if (watch) {
    console.log('🎬 Watch mode - replaying game...\n');
    console.log('Press Ctrl+C to stop\n');

    let lastTurn = 0;

    const result = await new Promise<ReturnType<typeof replayGame>>((resolve) => {
      const resultPromise = replayGame(replay, {
        stopAtTurn: turn,
        stopAtAction: action,
        onAction: async (actionIndex: number, actionObj: unknown, snapshot: ReplaySnapshot) => {
          // Show turn header when turn changes
          if (snapshot.turn !== lastTurn) {
            lastTurn = snapshot.turn;
            console.log(`\n${'='.repeat(60)}`);
            console.log(`📅 TURN ${snapshot.turn}`);
            console.log(`${'='.repeat(60)}\n`);
          }

          // Describe the action
          const actionDesc = describeActionSimple(actionObj as Action);
          console.log(`[${actionIndex + 1}] ${actionDesc}`);

          if (verbose) {
            console.log(
              `    Life: P${snapshot.playerLife} / O${snapshot.opponentLife} | ` +
                `Hand: P${snapshot.playerHandSize} / O${snapshot.opponentHandSize} | ` +
                `Board: P${snapshot.playerBoardSize} / O${snapshot.opponentBoardSize}`,
            );
          }
        },
      });

      // Add delays between actions for watch effect
      (async () => {
        const actions = replay.actions as Action[];
        for (let i = 0; i < actions.length; i++) {
          if (turn !== undefined && i >= turn * 20) break; // Rough estimate
          await sleep(delay);
        }
        resolve(resultPromise);
      })();
    });

    // Show final board
    console.log(`\n${'='.repeat(60)}`);
    console.log('🏁 FINAL STATE');
    console.log(`${'='.repeat(60)}\n`);
    console.log(renderGameState(result.finalState));

    if (result.outcomeMatched) {
      console.log('\n✅ Replay completed successfully!');
    } else {
      console.log('\n⚠️ Replay completed with differences:');
      for (const error of result.errors) {
        console.log(`   - ${error}`);
      }
    }
    return;
  }

  // Default: quick replay and show final state
  console.log('⏩ Replaying game...\n');
  const result = replayGame(replay, { validateActions: verbose });

  console.log(renderGameState(result.finalState));

  if (result.outcomeMatched) {
    console.log('\n✅ Replay matched expected outcome!');
  } else {
    console.log('\n⚠️ Replay outcome mismatch:');
    for (const error of result.errors) {
      console.log(`   - ${error}`);
    }
  }

  if (verbose && result.snapshots) {
    console.log(`\n📊 Replay Statistics:`);
    console.log(`   Total actions: ${result.snapshots.length}`);
    const finalSnapshot = result.snapshots[result.snapshots.length - 1];
    if (finalSnapshot) {
      console.log(`   Final turn: ${finalSnapshot.turn}`);
      console.log(`   Final life: Player ${finalSnapshot.playerLife}, Opponent ${finalSnapshot.opponentLife}`);
    }
  }
}

/**
 * Simple action description without needing full game state
 */
function describeActionSimple(action: Action): string {
  switch (action.type) {
    case 'PLAY_LAND':
      return `${action.playerId} plays a land`;
    case 'CAST_SPELL':
      return `${action.playerId} casts a spell`;
    case 'DECLARE_ATTACKERS': {
      const payload = action.payload as { attackers?: string[]; attackerIds?: string[] };
      const count = payload.attackers?.length || payload.attackerIds?.length || 0;
      return `${action.playerId} declares ${count} attackers`;
    }
    case 'DECLARE_BLOCKERS':
      return `${action.playerId} declares blockers`;
    case 'ACTIVATE_ABILITY':
      return `${action.playerId} activates an ability`;
    case 'PASS_PRIORITY':
      return `${action.playerId} passes priority`;
    case 'END_TURN':
      return `${action.playerId} ends turn`;
    default:
      return `${action.playerId}: ${action.type}`;
  }
}

/**
 * Parse replay command arguments
 */
export function parseReplayArgs(args: string[]): ReplayCommandOptions {
  const filepath = args[0];
  if (!filepath) {
    throw new Error('Replay file path required');
  }

  // Parse flags
  const turnIndex = args.indexOf('--turn');
  const turn = turnIndex !== -1 ? parseInt(args[turnIndex + 1] || '', 10) : undefined;

  const actionIndex = args.indexOf('--action');
  const action = actionIndex !== -1 ? parseInt(args[actionIndex + 1] || '', 10) : undefined;

  const delayIndex = args.indexOf('--delay');
  const delay = delayIndex !== -1 ? parseInt(args[delayIndex + 1] || '500', 10) : 500;

  return {
    filepath,
    turn: isNaN(turn!) ? undefined : turn,
    action: isNaN(action!) ? undefined : action,
    watch: args.includes('--watch') || args.includes('-w'),
    delay,
    verify: args.includes('--verify'),
    summary: args.includes('--summary') || args.includes('-s'),
    verbose: args.includes('--verbose') || args.includes('-v'),
  };
}
