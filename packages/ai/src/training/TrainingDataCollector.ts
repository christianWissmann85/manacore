/**
 * Training Data Collector
 *
 * Captures (state, action, outcome) tuples for ML training.
 * Designed for Phase 4+ neural network training.
 *
 * Data Format:
 * - State features: Normalized numerical representation of game state
 * - Action: Index of chosen action among legal actions
 * - Legal actions: List of all valid actions at this state
 * - Outcome: Final game result (1 for win, 0 for draw, -1 for loss)
 */

import type { GameState, Action, PlayerId, CardInstance } from '@manacore/engine';
import {
  CardLoader,
  getEffectivePower,
  getEffectiveToughness,
  isCreature,
  isLand,
} from '@manacore/engine';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

/**
 * Features extracted from a game state
 *
 * All values are normalized to [0, 1] or [-1, 1] range
 * for neural network compatibility.
 */
export interface StateFeatures {
  // Life totals (normalized to [0, 1] where 20 = 1.0)
  playerLife: number;
  opponentLife: number;
  lifeDelta: number; // (player - opponent) / 40, in [-1, 1]

  // Board presence
  playerCreatureCount: number;
  opponentCreatureCount: number;
  playerTotalPower: number;
  opponentTotalPower: number;
  playerTotalToughness: number;
  opponentTotalToughness: number;
  boardAdvantage: number; // Normalized creature count difference

  // Card advantage
  playerHandSize: number;
  opponentHandSize: number;
  cardAdvantage: number; // Normalized hand size difference

  // Library
  playerLibrarySize: number;
  opponentLibrarySize: number;

  // Mana
  playerLandsTotal: number;
  playerLandsUntapped: number;
  opponentLandsTotal: number;
  opponentLandsUntapped: number;

  // Game state
  turnNumber: number;
  isPlayerTurn: boolean;
  phase: number; // Encoded phase (0-6)

  // Combat potential
  canAttack: boolean;
  attackersAvailable: number;
  blockersAvailable: number;
}

/**
 * A single training sample
 */
export interface TrainingSample {
  // Features at decision point
  features: StateFeatures;

  // Action taken (as index among legal actions)
  actionIndex: number;

  // Total number of legal actions
  legalActionCount: number;

  // The action type (for debugging/analysis)
  actionType: string;

  // Turn and phase for context
  turn: number;
  phase: string;

  // Player making the decision
  playerId: PlayerId;

  // Optional: Reasoning behind the decision (for human/LLM players)
  reasoning?: string;
}

/**
 * Complete training data for a game
 */
export interface GameTrainingData {
  // Game metadata
  gameId: string;
  timestamp: string;
  seed: number;

  // Bot information
  playerBot: string;
  opponentBot: string;

  // Outcome (from player perspective)
  outcome: 1 | 0 | -1; // 1 = win, 0 = draw, -1 = loss

  // Game length
  turns: number;
  totalActions: number;

  // Samples for each decision point
  samples: TrainingSample[];
}

/**
 * Configuration for training data collection
 */
export interface CollectorConfig {
  // Which player's decisions to record
  recordPlayer: 'player' | 'opponent' | 'both';

  // Skip PASS_PRIORITY actions (less interesting for training)
  skipPassPriority: boolean;

  // Sample rate (1.0 = all decisions, 0.5 = 50% of decisions)
  sampleRate: number;

  // Maximum samples per game (0 = unlimited)
  maxSamplesPerGame: number;
}

/**
 * Default configuration
 */
export const DEFAULT_COLLECTOR_CONFIG: CollectorConfig = {
  recordPlayer: 'player',
  skipPassPriority: true,
  sampleRate: 1.0,
  maxSamplesPerGame: 0,
};

/**
 * Phase name to number encoding
 */
const PHASE_ENCODING: Record<string, number> = {
  untap: 0,
  upkeep: 1,
  draw: 2,
  main1: 3,
  combat: 4,
  main2: 5,
  end: 6,
};

/**
 * Extract normalized features from a game state
 */
export function extractFeatures(state: GameState, perspectivePlayer: PlayerId): StateFeatures {
  const player = state.players[perspectivePlayer];
  const opponent = state.players[perspectivePlayer === 'player' ? 'opponent' : 'player'];

  // Count creatures and their stats
  const countCreatureStats = (battlefield: CardInstance[]) => {
    let count = 0;
    let power = 0;
    let toughness = 0;

    for (const card of battlefield) {
      const template = CardLoader.getById(card.scryfallId);
      if (template && isCreature(template)) {
        count++;
        const basePower = parseInt(template.power || '0', 10) || 0;
        const baseToughness = parseInt(template.toughness || '0', 10) || 0;
        power += getEffectivePower(card, basePower);
        toughness += getEffectiveToughness(card, baseToughness);
      }
    }

    return { count, power, toughness };
  };

  const playerStats = countCreatureStats(player.battlefield);
  const opponentStats = countCreatureStats(opponent.battlefield);

  // Count lands
  const countLands = (battlefield: CardInstance[]) => {
    let total = 0;
    let untapped = 0;

    for (const card of battlefield) {
      const template = CardLoader.getById(card.scryfallId);
      if (template && isLand(template)) {
        total++;
        if (!card.tapped) untapped++;
      }
    }

    return { total, untapped };
  };

  const playerLands = countLands(player.battlefield);
  const opponentLands = countLands(opponent.battlefield);

  // Count attackers available (untapped creatures without summoning sickness)
  const attackersAvailable = player.battlefield.filter((c) => {
    const template = CardLoader.getById(c.scryfallId);
    return template && isCreature(template) && !c.tapped && !c.summoningSick;
  }).length;

  // Count blockers (untapped creatures)
  const blockersAvailable = opponent.battlefield.filter((c) => {
    const template = CardLoader.getById(c.scryfallId);
    return template && isCreature(template) && !c.tapped;
  }).length;

  return {
    // Life (normalized to [0, 1] where 20 = 1.0, capped at 2.0)
    playerLife: Math.min(player.life / 20, 2.0),
    opponentLife: Math.min(opponent.life / 20, 2.0),
    lifeDelta: (player.life - opponent.life) / 40,

    // Board presence (normalized, capped at reasonable max)
    playerCreatureCount: Math.min(playerStats.count / 10, 1.0),
    opponentCreatureCount: Math.min(opponentStats.count / 10, 1.0),
    playerTotalPower: Math.min(playerStats.power / 30, 1.0),
    opponentTotalPower: Math.min(opponentStats.power / 30, 1.0),
    playerTotalToughness: Math.min(playerStats.toughness / 30, 1.0),
    opponentTotalToughness: Math.min(opponentStats.toughness / 30, 1.0),
    boardAdvantage: (playerStats.count - opponentStats.count) / 10,

    // Cards
    playerHandSize: Math.min(player.hand.length / 7, 1.0),
    opponentHandSize: Math.min(opponent.hand.length / 7, 1.0),
    cardAdvantage: (player.hand.length - opponent.hand.length) / 7,

    // Library
    playerLibrarySize: Math.min(player.library.length / 60, 1.0),
    opponentLibrarySize: Math.min(opponent.library.length / 60, 1.0),

    // Mana
    playerLandsTotal: Math.min(playerLands.total / 10, 1.0),
    playerLandsUntapped: Math.min(playerLands.untapped / 10, 1.0),
    opponentLandsTotal: Math.min(opponentLands.total / 10, 1.0),
    opponentLandsUntapped: Math.min(opponentLands.untapped / 10, 1.0),

    // Game state
    turnNumber: Math.min(state.turnCount / 50, 1.0),
    isPlayerTurn: state.activePlayer === perspectivePlayer,
    phase: PHASE_ENCODING[state.phase] ?? 3,

    // Combat
    canAttack: state.phase === 'combat' && state.activePlayer === perspectivePlayer,
    attackersAvailable: Math.min(attackersAvailable / 10, 1.0),
    blockersAvailable: Math.min(blockersAvailable / 10, 1.0),
  };
}

/**
 * Convert features to a flat array for neural network input
 */
export function featuresToArray(features: StateFeatures): number[] {
  return [
    features.playerLife,
    features.opponentLife,
    features.lifeDelta,
    features.playerCreatureCount,
    features.opponentCreatureCount,
    features.playerTotalPower,
    features.opponentTotalPower,
    features.playerTotalToughness,
    features.opponentTotalToughness,
    features.boardAdvantage,
    features.playerHandSize,
    features.opponentHandSize,
    features.cardAdvantage,
    features.playerLibrarySize,
    features.opponentLibrarySize,
    features.playerLandsTotal,
    features.playerLandsUntapped,
    features.opponentLandsTotal,
    features.opponentLandsUntapped,
    features.turnNumber,
    features.isPlayerTurn ? 1 : 0,
    features.phase / 6,
    features.canAttack ? 1 : 0,
    features.attackersAvailable,
    features.blockersAvailable,
  ];
}

/**
 * Feature vector size (for neural network input layer)
 */
export const FEATURE_VECTOR_SIZE = 25;

/**
 * Training Data Collector
 *
 * Collects (state, action, outcome) tuples during game play.
 */
export class TrainingDataCollector {
  private config: CollectorConfig;
  private samples: TrainingSample[] = [];
  private gameId: string;
  private startTime: Date;
  private seed: number;
  private playerBot: string;
  private opponentBot: string;
  private rng: () => number;

  constructor(
    seed: number,
    playerBot: string,
    opponentBot: string,
    config: Partial<CollectorConfig> = {},
  ) {
    this.config = { ...DEFAULT_COLLECTOR_CONFIG, ...config };
    this.seed = seed;
    this.playerBot = playerBot;
    this.opponentBot = opponentBot;
    this.gameId = `game-${seed}-${Date.now()}`;
    this.startTime = new Date();

    // Simple seeded RNG for sampling
    let s = seed;
    this.rng = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  /**
   * Record a decision point
   *
   * @param state - Game state before action
   * @param action - Action that was chosen
   * @param legalActions - All legal actions at this point
   * @param reasoning - Optional reasoning text
   */
  recordDecision(state: GameState, action: Action, legalActions: Action[], reasoning?: string): void {
    const playerId = action.playerId;

    // Check if we should record this player
    if (this.config.recordPlayer !== 'both' && this.config.recordPlayer !== playerId) {
      return;
    }

    // Skip PASS_PRIORITY if configured
    if (this.config.skipPassPriority && action.type === 'PASS_PRIORITY') {
      return;
    }

    // Apply sample rate
    if (this.config.sampleRate < 1.0 && this.rng() > this.config.sampleRate) {
      return;
    }

    // Check max samples
    if (this.config.maxSamplesPerGame > 0 && this.samples.length >= this.config.maxSamplesPerGame) {
      return;
    }

    // Find action index among legal actions
    const actionJson = JSON.stringify(action);
    const actionIndex = legalActions.findIndex((a) => JSON.stringify(a) === actionJson);

    if (actionIndex === -1) {
      // Action not in legal actions - this shouldn't happen
      console.warn(`Action not found in legal actions: ${action.type}`);
      return;
    }

    // Extract features
    const features = extractFeatures(state, playerId);

    // Record sample
    this.samples.push({
      features,
      actionIndex,
      legalActionCount: legalActions.length,
      actionType: action.type,
      turn: state.turnCount,
      phase: state.phase,
      playerId,
      reasoning,
    });
  }

  /**
   * Finalize and build training data after game ends
   */
  finalize(finalState: GameState, perspectivePlayer: PlayerId = 'player'): GameTrainingData {
    // Determine outcome from perspective player's view
    let outcome: 1 | 0 | -1;
    if (finalState.winner === null) {
      outcome = 0; // Draw
    } else if (finalState.winner === perspectivePlayer) {
      outcome = 1; // Win
    } else {
      outcome = -1; // Loss
    }

    return {
      gameId: this.gameId,
      timestamp: this.startTime.toISOString(),
      seed: this.seed,
      playerBot: this.playerBot,
      opponentBot: this.opponentBot,
      outcome,
      turns: finalState.turnCount,
      totalActions: this.samples.length,
      samples: this.samples,
    };
  }

  /**
   * Get current sample count
   */
  getSampleCount(): number {
    return this.samples.length;
  }
}

/**
 * Save training data to a JSON file
 */
export function saveTrainingData(data: GameTrainingData, filepath: string): void {
  const dir = dirname(filepath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Save training data in compact binary-like format (JSON without pretty printing)
 * Better for large datasets
 */
export function saveTrainingDataCompact(data: GameTrainingData, filepath: string): void {
  const dir = dirname(filepath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(filepath, JSON.stringify(data), 'utf-8');
}

/**
 * Convert training data to tensor-friendly format
 * Returns arrays suitable for direct use with ML libraries
 */
export interface TensorData {
  features: number[][]; // [samples, feature_vector_size]
  actions: number[]; // [samples] - action indices
  actionCounts: number[]; // [samples] - number of legal actions
  outcomes: number[]; // [samples] - game outcomes
}

export function toTensorFormat(data: GameTrainingData): TensorData {
  const features: number[][] = [];
  const actions: number[] = [];
  const actionCounts: number[] = [];
  const outcomes: number[] = [];

  for (const sample of data.samples) {
    features.push(featuresToArray(sample.features));
    actions.push(sample.actionIndex);
    actionCounts.push(sample.legalActionCount);
    outcomes.push(data.outcome);
  }

  return { features, actions, actionCounts, outcomes };
}

/**
 * Merge multiple game training data files into a single dataset
 */
export function mergeTrainingData(datasets: GameTrainingData[]): {
  samples: TrainingSample[];
  outcomes: number[];
  metadata: {
    games: number;
    totalSamples: number;
    wins: number;
    losses: number;
    draws: number;
  };
} {
  const samples: TrainingSample[] = [];
  const outcomes: number[] = [];
  let wins = 0;
  let losses = 0;
  let draws = 0;

  for (const data of datasets) {
    for (const sample of data.samples) {
      samples.push(sample);
      outcomes.push(data.outcome);
    }

    if (data.outcome === 1) wins++;
    else if (data.outcome === -1) losses++;
    else draws++;
  }

  return {
    samples,
    outcomes,
    metadata: {
      games: datasets.length,
      totalSamples: samples.length,
      wins,
      losses,
      draws,
    },
  };
}
