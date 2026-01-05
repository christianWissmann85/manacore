/**
 * MatchupRecorder - Tracks results for bot-vs-bot matchups
 *
 * Records game outcomes and computes win rate matrices and rankings.
 */

import type { BotType } from '../botFactory';
import type {
  BenchmarkConfig,
  BenchmarkResults,
  MatchupResult,
  BotRanking,
  BenchmarkSummary,
  BenchmarkMetadata,
} from './types';

/**
 * Internal matchup tracking data
 */
interface MatchupData {
  bot1Wins: number;
  bot2Wins: number;
  draws: number;
  totalTurns: number;
  totalMs: number;
  gameCount: number;
}

/**
 * Get matchup key for consistent ordering
 */
function getMatchupKey(bot1: BotType, bot2: BotType): string {
  return `${bot1}:${bot2}`;
}

export class MatchupRecorder {
  private config: BenchmarkConfig;
  private matchups: Map<string, MatchupData>;
  private startTime: number;

  constructor(config: BenchmarkConfig) {
    this.config = config;
    this.matchups = new Map();
    this.startTime = Date.now();

    // Initialize all matchup slots (including mirrors)
    for (const bot1 of config.bots) {
      for (const bot2 of config.bots) {
        const key = getMatchupKey(bot1, bot2);
        this.matchups.set(key, {
          bot1Wins: 0,
          bot2Wins: 0,
          draws: 0,
          totalTurns: 0,
          totalMs: 0,
          gameCount: 0,
        });
      }
    }
  }

  /**
   * Record a game result
   */
  recordGame(
    bot1: BotType,
    bot2: BotType,
    winner: 'bot1' | 'bot2' | 'draw',
    turns: number,
    durationMs: number,
  ): void {
    const key = getMatchupKey(bot1, bot2);
    const data = this.matchups.get(key);

    if (!data) {
      throw new Error(`Unknown matchup: ${bot1} vs ${bot2}`);
    }

    data.gameCount++;
    data.totalTurns += turns;
    data.totalMs += durationMs;

    switch (winner) {
      case 'bot1':
        data.bot1Wins++;
        break;
      case 'bot2':
        data.bot2Wins++;
        break;
      case 'draw':
        data.draws++;
        break;
    }
  }

  /**
   * Get results for a specific matchup
   */
  getMatchupResult(bot1: BotType, bot2: BotType): MatchupResult {
    const key = getMatchupKey(bot1, bot2);
    const data = this.matchups.get(key);

    if (!data) {
      throw new Error(`Unknown matchup: ${bot1} vs ${bot2}`);
    }

    const totalGames = data.gameCount;
    const winRate = totalGames > 0 ? data.bot1Wins / totalGames : 0;
    const avgTurns = totalGames > 0 ? data.totalTurns / totalGames : 0;

    return {
      bot1,
      bot2,
      bot1Wins: data.bot1Wins,
      bot2Wins: data.bot2Wins,
      draws: data.draws,
      totalGames,
      winRate,
      avgTurns,
      totalMs: data.totalMs,
    };
  }

  /**
   * Build the win rate matrix
   * matrix[bot1][bot2] = bot1's win rate when playing against bot2
   */
  buildMatrix(): Record<string, Record<string, number>> {
    const matrix: Record<string, Record<string, number>> = {};

    for (const bot1 of this.config.bots) {
      matrix[bot1] = {};
      for (const bot2 of this.config.bots) {
        const result = this.getMatchupResult(bot1, bot2);
        matrix[bot1][bot2] = result.winRate;
      }
    }

    return matrix;
  }

  /**
   * Calculate bot rankings by average win rate
   */
  calculateRankings(): BotRanking[] {
    const rankings: BotRanking[] = [];

    for (const bot of this.config.bots) {
      let totalWins = 0;
      let totalLosses = 0;
      let totalDraws = 0;
      let totalGames = 0;

      // Sum up results from all matchups where this bot was player 1
      for (const opponent of this.config.bots) {
        const result = this.getMatchupResult(bot, opponent);
        totalWins += result.bot1Wins;
        totalLosses += result.bot2Wins;
        totalDraws += result.draws;
        totalGames += result.totalGames;
      }

      const avgWinRate = totalGames > 0 ? totalWins / totalGames : 0;

      rankings.push({
        bot,
        avgWinRate,
        gamesPlayed: totalGames,
        wins: totalWins,
        losses: totalLosses,
        draws: totalDraws,
      });
    }

    // Sort by average win rate (descending)
    rankings.sort((a, b) => b.avgWinRate - a.avgWinRate);

    return rankings;
  }

  /**
   * Get all matchup results
   */
  getAllMatchups(): MatchupResult[] {
    const results: MatchupResult[] = [];

    for (const bot1 of this.config.bots) {
      for (const bot2 of this.config.bots) {
        results.push(this.getMatchupResult(bot1, bot2));
      }
    }

    return results;
  }

  /**
   * Calculate summary statistics
   */
  calculateSummary(): BenchmarkSummary {
    const matchups = this.getAllMatchups();
    const totalGames = matchups.reduce((sum, m) => sum + m.totalGames, 0);
    const totalDurationMs = Date.now() - this.startTime;
    const gamesPerSecond = totalDurationMs > 0 ? (totalGames / totalDurationMs) * 1000 : 0;

    return {
      totalGames,
      totalMatchups: matchups.length,
      totalDurationMs,
      gamesPerSecond,
      botsCompared: this.config.bots.length,
    };
  }

  /**
   * Finalize and return complete benchmark results
   */
  finalize(preset?: string): BenchmarkResults {
    const endTime = new Date().toISOString();
    const startTimeStr = new Date(this.startTime).toISOString();

    const metadata: BenchmarkMetadata = {
      startTime: startTimeStr,
      endTime,
      seed: this.config.seed,
      preset,
      version: '0.1.0', // Benchmark suite version
    };

    return {
      config: this.config,
      matchups: this.getAllMatchups(),
      matrix: this.buildMatrix(),
      rankings: this.calculateRankings(),
      summary: this.calculateSummary(),
      metadata,
    };
  }

  /**
   * Get total games completed so far
   */
  getTotalGamesCompleted(): number {
    let total = 0;
    for (const data of this.matchups.values()) {
      total += data.gameCount;
    }
    return total;
  }

  /**
   * Get current win rate for a matchup in progress
   */
  getCurrentWinRate(bot1: BotType, bot2: BotType): number {
    const key = getMatchupKey(bot1, bot2);
    const data = this.matchups.get(key);
    if (!data || data.gameCount === 0) return 0;
    return data.bot1Wins / data.gameCount;
  }
}
