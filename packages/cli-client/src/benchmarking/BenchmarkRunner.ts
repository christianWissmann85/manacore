/**
 * BenchmarkRunner - Orchestrates bot comparison benchmarks
 *
 * Runs all matchups between specified bots and collects results.
 */

import type { BotType } from '../botFactory';
import { createBot } from '../botFactory';
import { runSingleGame } from '../commands/gameRunner';
import { MatchupRecorder } from './MatchupRecorder';
import type {
  BenchmarkConfig,
  BenchmarkResults,
  BenchmarkProgress,
  BenchmarkProgressCallback,
} from './types';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: BenchmarkConfig = {
  bots: ['random', 'greedy'],
  gamesPerMatchup: 50,
  maxTurns: 100,
  seed: Date.now(),
  parallel: false,
  outputLevel: 1,
};

export class BenchmarkRunner {
  private config: BenchmarkConfig;
  private recorder: MatchupRecorder;
  private startTime: number = 0;
  private totalGamesToRun: number = 0;
  private gamesCompleted: number = 0;

  constructor(config: Partial<BenchmarkConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.recorder = new MatchupRecorder(this.config);

    // Calculate total games
    const numBots = this.config.bots.length;
    const numMatchups = numBots * numBots; // Including mirrors
    this.totalGamesToRun = numMatchups * this.config.gamesPerMatchup;
  }

  /**
   * Run the complete benchmark suite
   */
  async run(onProgress?: BenchmarkProgressCallback, preset?: string): Promise<BenchmarkResults> {
    this.startTime = Date.now();
    this.gamesCompleted = 0;

    const { bots, gamesPerMatchup, maxTurns, seed } = this.config;
    const numBots = bots.length;
    const totalMatchups = numBots * numBots;

    let matchupIndex = 0;

    // Iterate through all bot pairs (including A vs A mirrors)
    for (const bot1Type of bots) {
      for (const bot2Type of bots) {
        matchupIndex++;

        // Run games for this matchup
        await this.runMatchup(
          bot1Type,
          bot2Type,
          gamesPerMatchup,
          maxTurns,
          seed + matchupIndex * 10000, // Different seed range per matchup
          matchupIndex,
          totalMatchups,
          onProgress,
        );
      }
    }

    return this.recorder.finalize(preset);
  }

  /**
   * Run a single matchup (N games between two bot types)
   */
  private async runMatchup(
    bot1Type: BotType,
    bot2Type: BotType,
    gameCount: number,
    maxTurns: number,
    baseSeed: number,
    matchupIndex: number,
    totalMatchups: number,
    onProgress?: BenchmarkProgressCallback,
  ): Promise<void> {
    // Create fresh bot instances for this matchup
    const bot1 = createBot(bot1Type, baseSeed, false);
    const bot2 = createBot(bot2Type, baseSeed + 1, false);

    for (let gameNum = 0; gameNum < gameCount; gameNum++) {
      const gameSeed = baseSeed + gameNum * 2;
      const gameStartTime = Date.now();

      try {
        const result = await runSingleGame(bot1, bot2, {
          maxTurns,
          verbose: false,
          debugVerbose: false,
          seed: gameSeed,
        });

        const durationMs = Date.now() - gameStartTime;

        // Determine winner type
        let winner: 'bot1' | 'bot2' | 'draw';
        if (result.winner === 'player') {
          winner = 'bot1';
        } else if (result.winner === 'opponent') {
          winner = 'bot2';
        } else {
          winner = 'draw';
        }

        // Record result
        this.recorder.recordGame(bot1Type, bot2Type, winner, result.turns, durationMs);
      } catch {
        // On error, record as draw to avoid skewing results
        const durationMs = Date.now() - gameStartTime;
        this.recorder.recordGame(bot1Type, bot2Type, 'draw', maxTurns, durationMs);
      }

      this.gamesCompleted++;

      // Report progress
      if (onProgress) {
        const elapsed = Date.now() - this.startTime;
        const gamesPerSecond = elapsed > 0 ? (this.gamesCompleted / elapsed) * 1000 : 0;
        const remainingGames = this.totalGamesToRun - this.gamesCompleted;
        const estimatedRemainingMs =
          gamesPerSecond > 0 ? (remainingGames / gamesPerSecond) * 1000 : 0;

        const progress: BenchmarkProgress = {
          currentMatchup: matchupIndex,
          totalMatchups,
          currentGame: gameNum + 1,
          totalGamesInMatchup: gameCount,
          totalGamesCompleted: this.gamesCompleted,
          totalGames: this.totalGamesToRun,
          bot1: bot1Type,
          bot2: bot2Type,
          currentWinRate: this.recorder.getCurrentWinRate(bot1Type, bot2Type),
          elapsedMs: elapsed,
          estimatedRemainingMs,
          gamesPerSecond,
        };

        onProgress(progress);
      }
    }
  }

  /**
   * Get configuration
   */
  getConfig(): BenchmarkConfig {
    return { ...this.config };
  }

  /**
   * Get total games to run
   */
  getTotalGames(): number {
    return this.totalGamesToRun;
  }

  /**
   * Get total matchups
   */
  getTotalMatchups(): number {
    return this.config.bots.length * this.config.bots.length;
  }
}

/**
 * Convenience function to run a benchmark
 */
export async function runBenchmark(
  config: Partial<BenchmarkConfig>,
  onProgress?: BenchmarkProgressCallback,
  preset?: string,
): Promise<BenchmarkResults> {
  const runner = new BenchmarkRunner(config);
  return runner.run(onProgress, preset);
}
