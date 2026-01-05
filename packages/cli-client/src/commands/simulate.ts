/**
 * Game simulation - run bot vs bot games
 *
 * Refactored to use modular architecture:
 * - ResultsRecorder for tracking results
 * - SnapshotWriter for error debugging
 * - ExporterManager for flexible output
 * - Profiler for performance tracking
 * - LogWriter for automatic logging (Phase 2.5)
 * - ProgressBar for visual feedback (Phase 2.5)
 */

import type { Bot } from '@manacore/ai';
import type { SimulationOptions, SimulationOutput, SimulationResults, OutputLevel } from '../types';
import { ResultsRecorder, SnapshotWriter, GameError } from '../recording';
import { ExporterManager, type ExportConfig } from '../export';
import { Profiler } from '../profiling';
import { LogWriter, ProgressBar } from '../logging';
import { runSingleGame } from './gameRunner';
import * as path from 'path';

/**
 * Run multiple games between two bots
 */
export async function runSimulation(
  playerBot: Bot,
  opponentBot: Bot,
  options: SimulationOptions,
): Promise<SimulationOutput> {
  const baseSeed = options.seed ?? Date.now();
  const outputLevel: OutputLevel = options.outputLevel ?? 1; // Default MINIMAL
  const autoExport = options.autoExport ?? true; // Default: always export
  
  const recorder = new ResultsRecorder(baseSeed, options.gameCount);
  const snapshotWriter = new SnapshotWriter();
  const profiler = options.profile ? new Profiler(options.profile === 'detailed') : undefined;
  
  // Initialize log writer
  const logWriter = new LogWriter(baseSeed);
  logWriter.start({
    command: process.argv.join(' '),
    seed: baseSeed,
    gameCount: options.gameCount,
    playerBot: playerBot.getName(),
    opponentBot: opponentBot.getName(),
  });

  if (profiler) {
    profiler.startSimulation();
  }

  // Only show header in non-quiet mode
  if (outputLevel > 0) {
    console.log(`\n🎮 Running ${options.gameCount} games: ${playerBot.getName()} vs ${opponentBot.getName()}\n`);
  }

  // Initialize progress bar for minimal/normal mode
  let progressBar: ProgressBar | undefined;
  if (outputLevel <= 2 && !options.debugVerbose) {
    progressBar = new ProgressBar(options.gameCount);
    progressBar.start();
  } else if (outputLevel >= 2) {
    // Show periodic progress updates in normal/verbose without debug-verbose
    console.log(`  Progress: 0/${options.gameCount} games`);
  }

  for (let i = 0; i < options.gameCount; i++) {
    // Show progress for verbose mode without debugVerbose
    if (outputLevel >= 3 && !options.debugVerbose && i % 10 === 0 && i > 0) {
      console.log(`  Progress: ${i}/${options.gameCount} games`);
    }

    // Show detailed game start for debugVerbose
    if (options.debugVerbose) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`🎲 Game ${i + 1}/${options.gameCount}`);
      console.log('─'.repeat(60));
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

      // Log game completion
      logWriter.writeGameComplete(
        i + 1,
        gameResult.winner || 'draw',
        gameResult.turns,
        gameResult.playerDeck,
        gameResult.opponentDeck,
        gameResult.durationMs || 0,
      );

      if (options.debugVerbose && !progressBar) {
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
      
      // Update progress bar
      if (progressBar) {
        progressBar.update(i + 1);
      }
    } catch (error) {
      // Handle game errors
      if (error instanceof GameError) {
        // Log error to file
        logWriter.writeError(i + 1, seed, error.message);

        // Only show in console for verbose mode or if not using progress bar
        if (outputLevel >= 2 || !progressBar) {
          console.error(`\n  Error in game ${i + 1}:`);
          console.error(`    ${error.message}`);
        }

        if (options.verbose) {
          // Write snapshot
          const files = await snapshotWriter.writeSnapshot(i + 1, error, true);

          if (outputLevel >= 2) {
            if (files.jsonFile) {
              console.error(`    JSON snapshot: ${files.jsonFile}`);
            }
            if (files.textFile) {
              console.error(`    Text snapshot: ${files.textFile}`);
            }
          }

          // Only print full snapshot in verbose mode
          if (outputLevel >= 3) {
            console.error(snapshotWriter.generateTextSnapshot(error.state, error.recentActions, error));
          }
        } else if (outputLevel >= 2) {
          // Minimal error info
          console.error(
            `    State: turn=${error.state.turnCount}, phase=${error.state.phase}, step=${error.state.step}`,
          );
          console.error(`    Seed: ${seed} (use --verbose for full snapshot)`);
        }

        recorder.recordError(i + 1, seed, error);
      } else {
        logWriter.writeError(i + 1, seed, error instanceof Error ? error.message : String(error));
        
        if (outputLevel >= 1 || !progressBar) {
          console.error(`  Error in game ${i + 1}:`, error);
        }
        
        recorder.recordError(i + 1, seed, error instanceof Error ? error : new Error(String(error)));
      }
      
      // Update progress bar even on error
      if (progressBar) {
        progressBar.update(i + 1);
      }
    }
  }

  // Complete progress bar
  if (progressBar) {
    progressBar.complete();
  }

  // Finalize results
  const results = recorder.finalize();

  // Add profile data
  if (profiler) {
    results.profile = profiler.getProfileData(results.gamesCompleted);
  }

  // Complete log file
  logWriter.finish({
    totalDuration: profiler ? profiler.getProfileData(results.gamesCompleted).totalMs : 0,
  });

  // Store log path for export
  const logPath = logWriter.getRelativePath();

  return { results, logPath };
}

/**
 * Print simulation results (legacy interface - now uses ConsoleExporter)
 */
export async function printResults(
  results: SimulationResults,
  playerName: string,
  opponentName: string,
  outputLevel: OutputLevel,
  logPath: string,
): Promise<void> {
  const exporterManager = new ExporterManager();
  await exporterManager.exportResults(results, playerName, opponentName, {
    formats: ['console'],
    outputLevel,
    logPath,
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
  logPath: string,
): Promise<void> {
  const exporterManager = new ExporterManager();
  await exporterManager.exportResults(results, playerName, opponentName, {
    ...config,
    logPath,
  });
}
