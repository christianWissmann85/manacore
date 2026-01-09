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
 *
 * v2.0: Enhanced with 11 new features based on diagnostic analysis
 * comparing PPO observation space with GreedyBot/MCTSBot evaluation.
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

  // ============================================================================
  // PHASE 1: Critical Missing Features (from diagnostic analysis)
  // ============================================================================

  // Stack awareness (GreedyBot gives 8.0x weight to creatures on stack!)
  playerStackPower: number; // Power of pending creatures about to resolve
  opponentStackPower: number;

  // Non-linear life scaling (GreedyBot uses quadratic below 20)
  playerLifeScaled: number; // lifeValue(life) - low life is disproportionately bad
  opponentLifeScaled: number;

  // Attacking bonus (GreedyBot gives 1.5x to attacking creatures)
  attackingCreaturePower: number; // Total power of creatures currently attacking

  // ============================================================================
  // PHASE 2: Extended Features
  // ============================================================================

  // Untapped creature tracking (MCTSBot values at +2 each)
  untappedCreaturePower: number; // Power of creatures ready to attack/block

  // Stack composition
  spellsOnStack: number; // Non-creature spells pending (combat tricks, removal)

  // Hand composition (enables better planning)
  creaturesInHand: number; // How many creatures can we cast?
  spellsInHand: number; // How many non-creature spells?

  // ============================================================================
  // PHASE 3: Strategic Features
  // ============================================================================

  // Combat prediction
  canWinCombat: number; // Heuristic: would attacking be favorable? (0-1)

  // Mana efficiency
  unusedMana: number; // Mana left in pool this turn (normalized)
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
 * Non-linear life value - low life is disproportionately bad
 * Matches GreedyBot's lifeValue function exactly
 * 20 life = 20, 10 life = 8, 5 life = 3, 1 life = 0.5
 */
function lifeValue(life: number): number {
  if (life <= 0) return -10; // Dead or about to die
  if (life >= 20) return life; // Above starting life is linear
  // Quadratic scaling below 20: life^1.5 / sqrt(20)
  return Math.pow(life, 1.5) / Math.sqrt(20);
}

/**
 * Calculate power of creatures on the stack (will resolve soon)
 * Matches GreedyBot's getStackPower function
 */
function getStackPower(state: GameState, playerId: PlayerId): number {
  let totalPower = 0;

  for (const stackItem of state.stack) {
    // Check if this is an unresolved item controlled by the player
    const isUnresolved = !stackItem.resolved && !(stackItem as { countered?: boolean }).countered;
    if (stackItem.controller === playerId && isUnresolved) {
      const template = CardLoader.getById(stackItem.card.scryfallId);
      if (template && isCreature(template)) {
        const basePower = parseInt(template.power || '0', 10) || 0;
        const baseToughness = parseInt(template.toughness || '0', 10) || 0;
        // Value at full power since it will resolve
        totalPower += basePower + baseToughness * 0.3;
      }
    }
  }

  return totalPower;
}

/**
 * Count non-creature spells on the stack
 */
function countSpellsOnStack(state: GameState): number {
  let count = 0;

  for (const stackItem of state.stack) {
    const isUnresolved = !stackItem.resolved && !(stackItem as { countered?: boolean }).countered;
    if (isUnresolved) {
      const template = CardLoader.getById(stackItem.card.scryfallId);
      if (template && !isCreature(template)) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Calculate total mana in a player's mana pool
 */
function getTotalMana(manaPool: {
  white: number;
  blue: number;
  black: number;
  red: number;
  green: number;
  colorless: number;
}): number {
  return (
    manaPool.white +
    manaPool.blue +
    manaPool.black +
    manaPool.red +
    manaPool.green +
    manaPool.colorless
  );
}

/**
 * Extract normalized features from a game state
 *
 * v2.0: Now includes 36 features (up from 25) based on diagnostic analysis
 */
export function extractFeatures(state: GameState, perspectivePlayer: PlayerId): StateFeatures {
  const player = state.players[perspectivePlayer];
  const opponentId = perspectivePlayer === 'player' ? 'opponent' : 'player';
  const opponent = state.players[opponentId];

  // Count creatures and their stats (extended to include attacking/untapped)
  const countCreatureStats = (battlefield: CardInstance[]) => {
    let count = 0;
    let power = 0;
    let toughness = 0;
    let attackingPower = 0;
    let untappedPower = 0;

    for (const card of battlefield) {
      const template = CardLoader.getById(card.scryfallId);
      if (template && isCreature(template)) {
        count++;
        const basePower = parseInt(template.power || '0', 10) || 0;
        const baseToughness = parseInt(template.toughness || '0', 10) || 0;
        const effectivePower = getEffectivePower(card, basePower);
        const effectiveToughness = getEffectiveToughness(card, baseToughness);

        power += effectivePower;
        toughness += effectiveToughness;

        // Track attacking creatures (GreedyBot gives 1.5x bonus)
        if (card.attacking) {
          attackingPower += effectivePower;
        }

        // Track untapped creatures (can attack/block)
        if (!card.tapped) {
          untappedPower += effectivePower;
        }
      }
    }

    return { count, power, toughness, attackingPower, untappedPower };
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

  // Count cards in hand by type
  const countHandByType = (hand: CardInstance[]) => {
    let creatures = 0;
    let spells = 0;

    for (const card of hand) {
      const template = CardLoader.getById(card.scryfallId);
      if (template) {
        if (isCreature(template)) {
          creatures++;
        } else if (!isLand(template)) {
          // Non-creature, non-land = spell
          spells++;
        }
      }
    }

    return { creatures, spells };
  };

  const playerHand = countHandByType(player.hand);

  // Stack power calculations
  const playerStackPower = getStackPower(state, perspectivePlayer);
  const opponentStackPower = getStackPower(state, opponentId);
  const spellsOnStack = countSpellsOnStack(state);

  // Combat prediction heuristic:
  // Can we win combat? Compare potential attack vs potential blocks
  // Simple heuristic: If we have more untapped power than they do, combat is favorable
  let canWinCombat = 0;
  if (playerStats.untappedPower > 0) {
    const ourAttackPotential = playerStats.untappedPower;
    const theirBlockPotential = opponentStats.untappedPower;

    if (ourAttackPotential > theirBlockPotential) {
      canWinCombat = Math.min((ourAttackPotential - theirBlockPotential) / 10, 1.0);
    } else if (theirBlockPotential > 0) {
      // Partial favorability based on ratio
      canWinCombat = Math.min(ourAttackPotential / (theirBlockPotential * 2), 0.5);
    }
  }

  // Unused mana in pool
  const unusedMana = getTotalMana(player.manaPool);

  return {
    // ========== Original 25 features ==========

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

    // ========== Phase 1: Critical Missing Features (5 new) ==========

    // Stack awareness (normalized to [0, 1], max expected ~20 power)
    playerStackPower: Math.min(playerStackPower / 20, 1.0),
    opponentStackPower: Math.min(opponentStackPower / 20, 1.0),

    // Non-linear life scaling (normalized: 20 life = 1.0, 5 life = 0.15)
    playerLifeScaled: Math.min(lifeValue(player.life) / 20, 2.0),
    opponentLifeScaled: Math.min(lifeValue(opponent.life) / 20, 2.0),

    // Attacking creature power (normalized)
    attackingCreaturePower: Math.min(playerStats.attackingPower / 20, 1.0),

    // ========== Phase 2: Extended Features (4 new) ==========

    // Untapped creature power (normalized)
    untappedCreaturePower: Math.min(playerStats.untappedPower / 20, 1.0),

    // Spells on stack (normalized, max expected ~5)
    spellsOnStack: Math.min(spellsOnStack / 5, 1.0),

    // Hand composition (normalized)
    creaturesInHand: Math.min(playerHand.creatures / 5, 1.0),
    spellsInHand: Math.min(playerHand.spells / 5, 1.0),

    // ========== Phase 3: Strategic Features (2 new) ==========

    // Combat prediction (0 = unfavorable, 1 = very favorable)
    canWinCombat,

    // Unused mana (normalized, max expected ~10)
    unusedMana: Math.min(unusedMana / 10, 1.0),
  };
}

/**
 * Convert features to a flat array for neural network input
 *
 * v2.0: Now returns 36 features (up from 25)
 */
export function featuresToArray(features: StateFeatures): number[] {
  return [
    // Original 25 features
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

    // Phase 1: Critical Missing Features (5 new)
    features.playerStackPower,
    features.opponentStackPower,
    features.playerLifeScaled,
    features.opponentLifeScaled,
    features.attackingCreaturePower,

    // Phase 2: Extended Features (4 new)
    features.untappedCreaturePower,
    features.spellsOnStack,
    features.creaturesInHand,
    features.spellsInHand,

    // Phase 3: Strategic Features (2 new)
    features.canWinCombat,
    features.unusedMana,
  ];
}

/**
 * Feature vector size (for neural network input layer)
 *
 * v2.0: Increased from 25 to 36 features
 */
export const FEATURE_VECTOR_SIZE = 36;

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
  recordDecision(
    state: GameState,
    action: Action,
    legalActions: Action[],
    reasoning?: string,
  ): void {
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

/**
 * JSONL format - one JSON object per line
 * Better for streaming, large datasets, and HuggingFace compatibility
 *
 * Each line contains:
 * - features: 25-dim array
 * - action: action index
 * - legal_count: number of legal actions
 * - action_type: string describing action
 * - outcome: game result (1=win, 0=draw, -1=loss)
 * - game_id: unique game identifier
 * - turn: turn number
 * - phase: game phase
 * - reasoning: optional reasoning text
 */
export interface JSONLSample {
  features: number[];
  action: number;
  legal_count: number;
  action_type: string;
  outcome: number;
  game_id: string;
  turn: number;
  phase: string;
  reasoning?: string;
}

/**
 * Save training data as JSONL (one JSON object per line)
 * This format is ideal for:
 * - HuggingFace datasets
 * - Streaming large files
 * - Line-by-line processing
 */
export function saveAsJSONL(data: GameTrainingData, filepath: string): void {
  const dir = dirname(filepath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const lines = data.samples.map((sample): string => {
    const jsonlSample: JSONLSample = {
      features: featuresToArray(sample.features),
      action: sample.actionIndex,
      legal_count: sample.legalActionCount,
      action_type: sample.actionType,
      outcome: data.outcome,
      game_id: data.gameId,
      turn: sample.turn,
      phase: sample.phase,
      reasoning: sample.reasoning,
    };
    return JSON.stringify(jsonlSample);
  });

  writeFileSync(filepath, lines.join('\n'), 'utf-8');
}

/**
 * Save multiple games as a single JSONL file
 */
export function saveMultipleAsJSONL(datasets: GameTrainingData[], filepath: string): void {
  const dir = dirname(filepath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const lines: string[] = [];

  for (const data of datasets) {
    for (const sample of data.samples) {
      const jsonlSample: JSONLSample = {
        features: featuresToArray(sample.features),
        action: sample.actionIndex,
        legal_count: sample.legalActionCount,
        action_type: sample.actionType,
        outcome: data.outcome,
        game_id: data.gameId,
        turn: sample.turn,
        phase: sample.phase,
        reasoning: sample.reasoning,
      };
      lines.push(JSON.stringify(jsonlSample));
    }
  }

  writeFileSync(filepath, lines.join('\n'), 'utf-8');
}

/**
 * Tensor format suitable for direct conversion to NumPy NPZ
 *
 * This creates a JSON file with typed arrays that Python can
 * easily convert to numpy arrays and save as NPZ.
 */
export interface TensorExport {
  // Metadata
  version: string;
  feature_dim: number;
  num_samples: number;
  num_games: number;

  // Data arrays (flattened for efficiency)
  features: number[]; // Flattened: [num_samples * feature_dim]
  actions: number[]; // [num_samples]
  legal_counts: number[]; // [num_samples]
  outcomes: number[]; // [num_samples]

  // Per-game metadata
  game_ids: string[];
  game_sample_counts: number[]; // Number of samples per game
}

/**
 * Export training data in a format optimized for Python/NumPy loading
 *
 * The exported JSON can be loaded in Python and converted to NPZ:
 * ```python
 * import json
 * import numpy as np
 *
 * with open('data.tensors.json') as f:
 *     data = json.load(f)
 *
 * features = np.array(data['features']).reshape(-1, data['feature_dim'])
 * actions = np.array(data['actions'])
 * outcomes = np.array(data['outcomes'])
 *
 * np.savez_compressed('data.npz', features=features, actions=actions, outcomes=outcomes)
 * ```
 */
export function exportForNumPy(datasets: GameTrainingData[], filepath: string): void {
  const dir = dirname(filepath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const features: number[] = [];
  const actions: number[] = [];
  const legalCounts: number[] = [];
  const outcomes: number[] = [];
  const gameIds: string[] = [];
  const gameSampleCounts: number[] = [];

  for (const data of datasets) {
    gameIds.push(data.gameId);
    gameSampleCounts.push(data.samples.length);

    for (const sample of data.samples) {
      features.push(...featuresToArray(sample.features));
      actions.push(sample.actionIndex);
      legalCounts.push(sample.legalActionCount);
      outcomes.push(data.outcome);
    }
  }

  const tensorExport: TensorExport = {
    version: '1.0',
    feature_dim: FEATURE_VECTOR_SIZE,
    num_samples: actions.length,
    num_games: datasets.length,
    features,
    actions,
    legal_counts: legalCounts,
    outcomes,
    game_ids: gameIds,
    game_sample_counts: gameSampleCounts,
  };

  writeFileSync(filepath, JSON.stringify(tensorExport), 'utf-8');
}
