/**
 * Game simulation - run bot vs bot games
 *
 * Refactored to use modular architecture:
 * - ResultsRecorder for tracking results
 * - SnapshotWriter for error debugging
 * - ExporterManager for flexible output
 * - Profiler for performance tracking
 */

import type { Bot } from '@manacore/ai';
import type { SimulationOptions, SimulationResults } from '../types';
import { ResultsRecorder, SnapshotWriter, GameError } from '../recording';
import { ExporterManager, type ExportConfig } from '../export';
import { Profiler } from '../profiling';
import { runSingleGame } from './gameRunner';

/**
 * Run multiple games between two bots
 */
export async function runSimulation(
  playerBot: Bot,
  opponentBot: Bot,
  options: SimulationOptions,
): Promise<SimulationResults> {
  const baseSeed = options.seed ?? Date.now();
  const recorder = new ResultsRecorder(baseSeed, options.gameCount);
  const snapshotWriter = new SnapshotWriter();
  const profiler = options.profile ? new Profiler(options.profile === 'detailed') : undefined;

  if (profiler) {
    profiler.startSimulation();
  }

  console.log(
    `\n🎮 Running ${options.gameCount} games: ${playerBot.getName()} vs ${opponentBot.getName()}\n`,
  );

  for (let i = 0; i < options.gameCount; i++) {
    if (options.debugVerbose) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`🎲 Game ${i + 1}/${options.gameCount}`);
      console.log('─'.repeat(60));
    } else if (i % 10 === 0) {
      console.log(`  Progress: ${i}/${options.gameCount} games`);
    }

    const seed = baseSeed + i;

    try {
      if (profiler) profiler.startGame();

      const gameResult = await runSingleGame(playerBot, opponentBot, {
        maxTurns: options.maxTurns || 100,
        verbose: options.verbose || false,
        debugVerbose: options.debugVerbose || false,
        seed,
      });

      if (profiler) {
        gameResult.durationMs = profiler.endGame();
      }

      if (options.debugVerbose) {
        const winnerName =
          gameResult.winner === 'player'
            ? playerBot.getName()
            : gameResult.winner === 'opponent'
              ? opponentBot.getName()
              : 'Draw';
        console.log(`\n✅ Game completed in ${gameResult.turns} turns`);
        console.log(`🏆 Winner: ${winnerName}`);
        console.log(`🎨 Decks: ${gameResult.playerDeck} vs ${gameResult.opponentDeck}`);
      }

      recorder.recordGame(i + 1, seed, gameResult);
    } catch (error) {
      // Handle game errors
      if (error instanceof GameError) {
        console.error(`\n  Error in game ${i + 1}:`);
        console.error(`    ${error.message}`);

        if (options.verbose) {
          // Write snapshot
          const files = await snapshotWriter.writeSnapshot(i + 1, error, true);

          if (files.jsonFile) {
            console.error(`    JSON snapshot: ${files.jsonFile}`);
          }
          if (files.textFile) {
            console.error(`    Text snapshot: ${files.textFile}`);
          }

          // Print to console
          console.error(snapshotWriter.generateTextSnapshot(error.state, error.recentActions, error));
        } else {
          // Even in non-verbose mode, provide useful debugging hints
          console.error(
            `    State: turn=${error.state.turnCount}, phase=${error.state.phase}, step=${error.state.step}`,
          );
          console.error(`    Seed: ${seed} (use --verbose for full snapshot)`);
        }

        recorder.recordError(i + 1, seed, error);
      } else {
        console.error(`  Error in game ${i + 1}:`, error);
        recorder.recordError(i + 1, seed, error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  // Finalize results
  const results = recorder.finalize();

  // Add profile data
  if (profiler) {
    results.profile = profiler.getProfileData(results.gamesCompleted);
  }

  return results;
}

/**
 * Print simulation results (legacy interface - now uses ConsoleExporter)
 */
export async function printResults(
  results: SimulationResults,
  playerName: string,
  opponentName: string,
): Promise<void> {
  const exporterManager = new ExporterManager();
  await exporterManager.exportResults(results, playerName, opponentName, {
    formats: ['console'],
  });
}

/**
 * Export simulation results in multiple formats
 */
export async function exportResults(
  results: SimulationResults,
  playerName: string,
  opponentName: string,
  config: ExportConfig,
): Promise<void> {
  const exporterManager = new ExporterManager();
  await exporterManager.exportResults(results, playerName, opponentName, config);
}
