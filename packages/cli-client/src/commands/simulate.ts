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
import type {
  SimulationOptions,
  SimulationOutput,
  SimulationResults,
  OutputLevel,
  GameResult,
} from '../types';
import { ResultsRecorder, SnapshotWriter, GameError } from '../recording';
import { ExporterManager, type ExportConfig } from '../export';
import { Profiler } from '../profiling';
import { LogWriter, ProgressBar } from '../logging';
import { runSingleGame } from './gameRunner';
import * as path from 'path';
import { Worker } from 'worker_threads';
import * as os from 'os';

/**
 * Message from worker to main thread
 */
type WorkerResponseMessage =
  | { type: 'success'; gameIndex: number; seed: number; result: GameResult }
  | { type: 'error'; gameIndex: number; seed: number; error: string; stack?: string };

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

  const recorder = new ResultsRecorder(baseSeed, options.gameCount);
  const snapshotWriter = new SnapshotWriter();
  // Always enable profiling
  const profiler = new Profiler(false);

  // Always track simulation start time for log file
  const simulationStartTime = performance.now();

  // Initialize log writer
  const logWriter = new LogWriter(baseSeed);
  logWriter.start({
    command: process.argv.join(' '),
    seed: baseSeed,
    gameCount: options.gameCount,
    playerBot: playerBot.getName(),
    opponentBot: opponentBot.getName(),
  });

  profiler.startSimulation();

  // Only show header in non-quiet mode
  if (outputLevel > 0) {
    console.log(
      `\n🎮 Running ${options.gameCount} games: ${playerBot.getName()} vs ${opponentBot.getName()}\n`,
    );
    if (options.parallel && options.botTypes) {
      const concurrency = Math.max(1, os.cpus().length - 1);
      console.log(`🚀 Parallel mode enabled: ${concurrency} workers`);
    }
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

  if (options.parallel && options.botTypes) {
    // Run in parallel using workers
    await runParallelSimulation(
      options.gameCount,
      baseSeed,
      options.botTypes,
      options.maxTurns || 100,
      options.debugVerbose || false,
      recorder,
      logWriter,
      snapshotWriter,
      progressBar,
      profiler,
      outputLevel,
    );
  } else {
    // Run serially in main thread
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
        profiler.startGame();

        const gameResult = await runSingleGame(playerBot, opponentBot, {
          maxTurns: options.maxTurns || 100,
          verbose: options.verbose || false,
          debugVerbose: options.debugVerbose || false,
          seed,
        });

        gameResult.durationMs = profiler.endGame();

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
        await handleGameError(
          error,
          i,
          seed,
          recorder,
          logWriter,
          snapshotWriter,
          outputLevel,
          options.verbose || false,
          progressBar,
        );
      }
    }
  }

  // Complete progress bar
  if (progressBar) {
    progressBar.complete();
  }

  // Finalize results
  const results = recorder.finalize();

  // Calculate total duration
  const totalDuration = performance.now() - simulationStartTime;

  // Add profile data (always included)
  results.profile = profiler.getProfileData(results.gamesCompleted);

  // Complete log file with actual duration
  logWriter.finish({
    totalDuration,
  });

  // Store log path for export
  const logPath = logWriter.getRelativePath();

  return { results, logPath };
}

/**
 * Run games in parallel using Worker Threads
 */
async function runParallelSimulation(
  gameCount: number,
  baseSeed: number,
  botTypes: { p1: string; p2: string },
  maxTurns: number,
  debug: boolean,
  recorder: ResultsRecorder,
  logWriter: LogWriter,
  snapshotWriter: SnapshotWriter,
  progressBar: ProgressBar | undefined,
  profiler: Profiler,
  outputLevel: OutputLevel,
): Promise<void> {
  const workerCount = Math.max(1, os.cpus().length - 1);
  const workerPath = path.join(__dirname, 'gameWorker.ts');

  // Create worker pool
  const activeWorkers = new Set<Worker>();

  // Game queue
  let nextGameIndex = 0;
  let gamesCompleted = 0;

  return new Promise((resolve) => {
    // Helper to process next game
    const processNextGame = (worker: Worker) => {
      if (nextGameIndex >= gameCount) {
        // No more games, terminate worker
        void worker.terminate();
        activeWorkers.delete(worker);
        if (activeWorkers.size === 0) {
          resolve();
        }
        return;
      }

      const gameIndex = nextGameIndex++;
      const seed = baseSeed + gameIndex;

      profiler.startGame(); // Note: Profiling in parallel is approximate for individual games

      worker.postMessage({
        gameIndex,
        seed,
        p1Type: botTypes.p1,
        p2Type: botTypes.p2,
        maxTurns,
        debug,
      });
    };

    // Initialize workers
    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker(workerPath);
      activeWorkers.add(worker);

      worker.on('message', (msg: WorkerResponseMessage) => {
        void (async () => {
          if (msg.type === 'success') {
            const { gameIndex, seed, result } = msg;
            gamesCompleted++;

            // Profiling (approximate duration based on when we got the message)
            // Ideally the worker sends duration, but we can't easily profile across threads perfectly
            // We'll trust the worker's result duration if we added it, or just use 0

            logWriter.writeGameComplete(
              gameIndex + 1,
              result.winner || 'draw',
              result.turns,
              result.playerDeck,
              result.opponentDeck,
              result.durationMs || 0,
            );

            recorder.recordGame(gameIndex + 1, seed, result);
            if (progressBar) progressBar.update(gamesCompleted);

            processNextGame(worker);
          } else if (msg.type === 'error') {
            const { gameIndex, seed, error, stack } = msg;
            gamesCompleted++;
            // Reconstruct error object
            const errObj = new Error(error);
            errObj.stack = stack;

            // We don't have the full state for snapshotting in the main thread easily
            // unless the worker sends it back. For now, we log the error.
            // Parallel mode error handling is less detailed than serial mode.

            logWriter.writeError(gameIndex + 1, seed, error);
            if (outputLevel >= 1 || !progressBar) {
              console.error(`  Error in game ${gameIndex + 1}:`, error);
            }
            recorder.recordError(gameIndex + 1, seed, errObj);

            if (progressBar) progressBar.update(gamesCompleted);

            processNextGame(worker);
          }
        })();
      });

      worker.on('error', (err) => {
        console.error('Worker error:', err);
        // Try to replace worker or just fail?
        // Failing specific worker's current task is hard without tracking.
        // We'll just let the simulation continue with fewer workers if one crashes hard.
        activeWorkers.delete(worker);
        if (activeWorkers.size === 0 && nextGameIndex >= gameCount) {
          resolve();
        }
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`Worker stopped with exit code ${code}`);
        }
        activeWorkers.delete(worker);
        if (activeWorkers.size === 0 && nextGameIndex >= gameCount) {
          resolve();
        }
      });

      // Start working
      processNextGame(worker);
    }
  });
}

/**
 * Handle game errors (extracted from serial loop)
 */
async function handleGameError(
  error: unknown,
  i: number,
  seed: number,
  recorder: ResultsRecorder,
  logWriter: LogWriter,
  snapshotWriter: SnapshotWriter,
  outputLevel: OutputLevel,
  verbose: boolean,
  progressBar: ProgressBar | undefined,
) {
  if (error instanceof GameError) {
    // Log error to file
    logWriter.writeError(i + 1, seed, error.message);

    // Only show in console for verbose mode or if not using progress bar
    if (outputLevel >= 2 || !progressBar) {
      console.error(`\n  Error in game ${i + 1}:`);
      console.error(`    ${error.message}`);
    }

    if (verbose) {
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
    const errorMsg = error instanceof Error ? error.message : String(error);
    logWriter.writeError(i + 1, seed, errorMsg);

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
