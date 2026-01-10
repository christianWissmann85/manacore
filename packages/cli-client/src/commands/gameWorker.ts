import { parentPort } from 'worker_threads';
import type { BotType } from '../botFactory';

// Suppress initialization logs from engine and ai packages
process.env.MANACORE_SILENT_INIT = 'true';

interface WorkerMessage {
  gameIndex: number;
  seed: number;
  p1Type: BotType;
  p2Type: BotType;
  maxTurns: number;
  debug: boolean;
}

if (!parentPort) {
  throw new Error('This script must be run as a worker thread');
}

parentPort.on('message', (msg: WorkerMessage) => {
  // Wrap in async IIFE to satisfy @typescript-eslint/no-misused-promises
  void (async () => {
    try {
      // Dynamic imports to ensure env var is set before modules load
      const { runSingleGame } = await import('./gameRunner');
      const { createBot } = await import('../botFactory');
      const { Profiler } = await import('../profiling/Profiler');

      const { gameIndex, seed, p1Type, p2Type, maxTurns, debug } = msg;

      // Always use detailed profiling in workers
      const profiler = new Profiler(true);
      profiler.startSimulation(); // Mark start of worker execution
      profiler.startGame();

      // Create bots with seeds derived from the game seed to ensure
      // reproducibility while maintaining independence between games.
      // This replaces the sequential behavior where one bot instance
      // carried its RNG state across all games.
      const playerBot = createBot(p1Type, seed + 1000, debug);
      const opponentBot = createBot(p2Type, seed + 2000, debug);

      // Run the game
      // We suppress verbose output in workers to avoid interleaved console spam
      const result = await runSingleGame(playerBot, opponentBot, {
        maxTurns,
        verbose: false,
        debugVerbose: false,
        seed,
        profiler,
      });

      // Add duration and profile to result
      result.durationMs = profiler.endGame();
      result.profile = profiler.getProfileData(1);

      parentPort!.postMessage({
        type: 'success',
        gameIndex,
        seed,
        result,
      });
    } catch (error) {
      parentPort!.postMessage({
        type: 'error',
        gameIndex: msg.gameIndex,
        seed: msg.seed,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  })();
});
