/**
 * Shared types for CLI client
 *
 * Core data structures used across simulation, recording, and export modules.
 */

import type { PlayerId, CardTemplate } from '@manacore/engine';

/**
 * Output verbosity levels
 */
export enum OutputLevel {
  QUIET = 0, // Errors only
  MINIMAL = 1, // Summary + file references (default)
  NORMAL = 2, // Key stats + top performers
  VERBOSE = 3, // Full statistics (current behavior)
}

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
  outputLevel?: OutputLevel;
  autoExport?: boolean; // Auto-export JSON (default: true)
  botTypes?: { p1: string; p2: string };
  parallel?: boolean;
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
 * Return type for runSimulation - includes results and log file path
 */
export interface SimulationOutput {
  results: SimulationResults;
  logPath: string;
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

// =============================================================================
// REPLAY SYSTEM TYPES
// =============================================================================

/**
 * Deck specification for replay files
 */
export interface ReplayDeckSpec {
  name: string;
  cards?: string[]; // Card IDs (optional, for custom decks)
}

/**
 * Game outcome information
 */
export interface ReplayOutcome {
  winner: PlayerId | null;
  turns: number;
  reason: 'life' | 'decked' | 'concede' | 'timeout' | 'error';
  finalLife?: {
    player: number;
    opponent: number;
  };
}

/**
 * Replay file format - contains everything needed to replay a game
 */
export interface ReplayFile {
  /** Format version for backwards compatibility */
  version: string;

  /** Metadata */
  metadata: {
    timestamp: string; // ISO date
    engineVersion: string;
    description?: string;
  };

  /** Seeds for determinism */
  seeds: {
    game: number; // Seed for deck shuffling
    instanceCounter: number; // Starting value for card instance counter (usually 0)
  };

  /** Deck specifications */
  decks: {
    player: ReplayDeckSpec;
    opponent: ReplayDeckSpec;
  };

  /** Bot information (optional, for AI games) */
  bots?: {
    player?: { type: string; seed?: number };
    opponent?: { type: string; seed?: number };
  };

  /** Complete action sequence */
  actions: unknown[]; // Action[] - using unknown for JSON compatibility

  /** Game outcome */
  outcome: ReplayOutcome;
}

/**
 * State snapshot at a specific point in the game
 */
export interface ReplaySnapshot {
  turn: number;
  phase: string;
  actionIndex: number;
  playerLife: number;
  opponentLife: number;
  playerHandSize: number;
  opponentHandSize: number;
  playerBoardSize: number;
  opponentBoardSize: number;
}

/**
 * Options for replay playback
 */
export interface ReplayOptions {
  /** Stop at specific turn */
  stopAtTurn?: number;

  /** Stop at specific action index */
  stopAtAction?: number;

  /** Callback for each action */
  onAction?: (actionIndex: number, action: unknown, snapshot: ReplaySnapshot) => void;

  /** Validate each action (slower but catches issues) */
  validateActions?: boolean;
}
