/**
 * Shared types for CLI client
 *
 * Core data structures used across simulation, recording, and export modules.
 */

import type { PlayerId, CardTemplate } from '@manacore/engine';

/**
 * Configuration for running simulations
 */
export interface SimulationOptions {
  gameCount: number;
  maxTurns?: number;
  verbose?: boolean;
  debugVerbose?: boolean;
  seed?: number;
  exportJson?: boolean;
  exportCsv?: boolean;
  exportPath?: string;
  profile?: boolean | 'detailed';
  logErrors?: boolean;
}

/**
 * Record of a single game's outcome
 */
export interface GameRecord {
  gameNumber: number;
  seed: number;
  winner: PlayerId | null;
  turns: number;
  playerDeck: string;
  opponentDeck: string;
  error?: string;
  durationMs?: number;
}

/**
 * Statistics for a specific deck
 */
export interface DeckStats {
  wins: number;
  losses: number;
  draws: number;
  games: number;
  avgCmc?: number;
  cmcDistribution?: Record<number, number>;
}

/**
 * Head-to-head matchup statistics
 */
export interface MatchupStats {
  wins: number;
  losses: number;
  draws: number;
}

/**
 * Complete simulation results
 */
export interface SimulationResults {
  totalGames: number;
  playerWins: number;
  opponentWins: number;
  draws: number;
  averageTurns: number;
  minTurns: number;
  maxTurns: number;
  errors: number;
  gamesCompleted: number;
  deckStats: Record<string, DeckStats>;
  matchups: Record<string, MatchupStats>;
  gameRecords: GameRecord[];
  baseSeed: number;
  failedSeeds: number[];
  profile?: ProfileData;
}

/**
 * Performance profiling data
 */
export interface ProfileData {
  totalMs: number;
  avgGameMs: number;
  gamesPerSecond: number;
  detailed?: {
    phases: Record<string, number>;
    actions: {
      total: number;
      byType: Record<string, number>;
      avgPerTurn: number;
    };
  };
}

/**
 * Result of a single game execution
 */
export interface GameResult {
  winner: PlayerId | null;
  turns: number;
  playerDeck: string;
  opponentDeck: string;
  playerDeckCards?: CardTemplate[];
  opponentDeckCards?: CardTemplate[];
  durationMs?: number;
}

/**
 * Export format options
 */
export type ExportFormat = 'console' | 'json' | 'csv';

/**
 * Export configuration
 */
export interface ExportConfig {
  formats: ExportFormat[];
  outputPath?: string;
  pretty?: boolean;
}
