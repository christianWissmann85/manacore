/**
 * WeightLoader - Dynamic weight loading from JSON files
 *
 * Loads evaluation weights and MCTS hyperparameters from weights.json,
 * with fallback to hardcoded defaults if the file is missing.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Evaluation weights - normalized to sum to 1.0
 */
export interface EvaluationWeights {
  life: number;
  board: number;
  cards: number;
  mana: number;
  tempo: number;
}

/**
 * Evaluation coefficients - raw multipliers for quick evaluation
 */
export interface EvaluationCoefficients {
  life: number;
  board: number;
  cards: number;
  mana: number;
  stack: number;
}

/**
 * MCTS hyperparameters
 */
export interface MCTSParams {
  explorationConstant: number;
  rolloutDepth: number;
  rolloutPolicy: 'random' | 'greedy' | 'epsilon';
  epsilon?: number;
}

/**
 * Performance metrics from tuning
 */
export interface PerformanceMetrics {
  vsRandom: number;
  vsGreedy: number;
  elo: number;
  gamesPlayed: number;
}

/**
 * Source information for how weights were derived
 */
export interface WeightSource {
  method: 'local' | 'evolutionary' | 'manual' | 'mcts-tuned';
  games: number;
  seed?: number;
}

/**
 * Complete weights file structure
 */
export interface WeightsFile {
  version: string;
  created: string;
  description?: string;
  source: WeightSource;
  evaluation: EvaluationWeights;
  coefficients: EvaluationCoefficients;
  mcts: MCTSParams;
  performance: PerformanceMetrics;
}

/**
 * Manifest entry for weight history
 */
export interface ManifestEntry {
  version: string;
  filename: string;
  created: string;
  description?: string;
  source: WeightSource;
  performance: {
    vsGreedy: number;
  };
}

/**
 * Manifest file structure
 */
export interface ManifestFile {
  entries: ManifestEntry[];
}

// Hardcoded defaults as fallback
const DEFAULT_WEIGHTS: EvaluationWeights = {
  life: 0.3,
  board: 0.45,
  cards: 0.1,
  mana: 0.1,
  tempo: 0.05,
};

const DEFAULT_COEFFICIENTS: EvaluationCoefficients = {
  life: 2.0,
  board: 5.0,
  cards: 0.1,
  mana: 1.5,
  stack: 8.0,
};

const DEFAULT_MCTS_PARAMS: MCTSParams = {
  explorationConstant: 1.41,
  rolloutDepth: 20,
  rolloutPolicy: 'greedy',
  epsilon: 0.1,
};

/**
 * Cached weights to avoid repeated file reads
 */
let cachedWeights: WeightsFile | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5000; // 5 second cache

/**
 * Get the path to the weights data directory
 */
function getWeightsDir(): string {
  return join(__dirname, '..', '..', 'data');
}

/**
 * Get the path to the weights.json file
 */
function getWeightsPath(): string {
  return join(getWeightsDir(), 'weights.json');
}

/**
 * Get the path to the weights history directory
 */
function getHistoryDir(): string {
  return join(getWeightsDir(), 'weights-history');
}

/**
 * Get the path to the manifest file
 */
function getManifestPath(): string {
  return join(getHistoryDir(), 'manifest.json');
}

/**
 * Load weights from JSON file with caching
 *
 * @param forceReload - Force reload from disk (ignore cache)
 * @returns Loaded weights or defaults if file missing
 */
export function loadWeights(forceReload = false): WeightsFile {
  const now = Date.now();

  // Return cached if valid
  if (!forceReload && cachedWeights && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedWeights;
  }

  const weightsPath = getWeightsPath();

  try {
    if (existsSync(weightsPath)) {
      const content = readFileSync(weightsPath, 'utf-8');
      cachedWeights = JSON.parse(content) as WeightsFile;
      cacheTimestamp = now;
      return cachedWeights;
    }
  } catch (error) {
    console.warn(`[WeightLoader] Failed to load weights.json: ${error}`);
  }

  // Return defaults if file doesn't exist or failed to load
  return getDefaultWeightsFile();
}

/**
 * Get default weights file structure
 */
function getDefaultWeightsFile(): WeightsFile {
  return {
    version: '0.0.0',
    created: new Date().toISOString(),
    description: 'Fallback defaults (weights.json not found)',
    source: {
      method: 'manual',
      games: 0,
    },
    evaluation: { ...DEFAULT_WEIGHTS },
    coefficients: { ...DEFAULT_COEFFICIENTS },
    mcts: { ...DEFAULT_MCTS_PARAMS },
    performance: {
      vsRandom: 0.5,
      vsGreedy: 0.5,
      elo: 1500,
      gamesPlayed: 0,
    },
  };
}

/**
 * Get current evaluation weights
 */
export function getEvaluationWeights(): EvaluationWeights {
  return loadWeights().evaluation;
}

/**
 * Get current evaluation coefficients
 */
export function getEvaluationCoefficients(): EvaluationCoefficients {
  return loadWeights().coefficients;
}

/**
 * Get current MCTS parameters
 */
export function getMCTSParams(): MCTSParams {
  return loadWeights().mcts;
}

/**
 * Get current performance metrics
 */
export function getPerformanceMetrics(): PerformanceMetrics {
  return loadWeights().performance;
}

/**
 * Get the current weights version
 */
export function getWeightsVersion(): string {
  return loadWeights().version;
}

/**
 * Save new weights to file
 *
 * @param weights - New weights to save
 * @param archive - Whether to archive the old weights first
 */
export function saveWeights(weights: WeightsFile, archive = true): void {
  const weightsPath = getWeightsPath();

  // Archive old weights if requested
  if (archive) {
    try {
      const oldWeights = loadWeights(true);
      if (oldWeights.version !== '0.0.0') {
        archiveWeights(oldWeights);
      }
    } catch {
      // No old weights to archive
    }
  }

  // Ensure directory exists
  const dir = dirname(weightsPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Write new weights
  writeFileSync(weightsPath, JSON.stringify(weights, null, 2));

  // Invalidate cache
  cachedWeights = null;
  cacheTimestamp = 0;
}

/**
 * Archive weights to history directory
 */
export function archiveWeights(weights: WeightsFile): void {
  const historyDir = getHistoryDir();
  const manifestPath = getManifestPath();

  // Ensure history directory exists
  if (!existsSync(historyDir)) {
    mkdirSync(historyDir, { recursive: true });
  }

  // Generate filename
  const date = new Date().toISOString().split('T')[0];
  const filename = `${date}-v${weights.version}.json`;
  const filePath = join(historyDir, filename);

  // Write archived weights
  writeFileSync(filePath, JSON.stringify(weights, null, 2));

  // Update manifest
  let manifest: ManifestFile = { entries: [] };
  try {
    if (existsSync(manifestPath)) {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as ManifestFile;
    }
  } catch {
    // Start fresh manifest
  }

  // Add new entry
  const entry: ManifestEntry = {
    version: weights.version,
    filename,
    created: weights.created,
    description: weights.description,
    source: weights.source,
    performance: {
      vsGreedy: weights.performance.vsGreedy,
    },
  };

  manifest.entries.push(entry);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Get weight history from manifest
 */
export function getWeightHistory(): ManifestEntry[] {
  const manifestPath = getManifestPath();

  try {
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as ManifestFile;
      return manifest.entries;
    }
  } catch {
    // No manifest
  }

  return [];
}

/**
 * Load a specific historical weight configuration
 *
 * @param version - Version string to load
 */
export function loadHistoricalWeights(version: string): WeightsFile | null {
  const history = getWeightHistory();
  const entry = history.find((e) => e.version === version);

  if (!entry) {
    return null;
  }

  const filePath = join(getHistoryDir(), entry.filename);

  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as WeightsFile;
  } catch {
    return null;
  }
}

/**
 * Convert evaluation weights to coefficients
 *
 * Scaling factors are empirically derived to maintain similar
 * score magnitudes as the original default coefficients.
 */
export function weightsToCoefficients(weights: EvaluationWeights): EvaluationCoefficients {
  // Base scaling factors (from default weights -> default coefficients)
  const lifeScale = 2.0 / 0.3; // ~6.67
  const boardScale = 5.0 / 0.45; // ~11.11
  const cardsScale = 0.1 / 0.1; // 1.0
  const manaScale = 1.5 / 0.1; // 15.0

  return {
    life: weights.life * lifeScale,
    board: weights.board * boardScale,
    cards: weights.cards * cardsScale,
    mana: weights.mana * manaScale,
    stack: 8.0, // Stack weight not derived from evaluation weights
  };
}

/**
 * Normalize weights to sum to 1.0
 */
export function normalizeWeights(weights: EvaluationWeights): EvaluationWeights {
  const sum = weights.life + weights.board + weights.cards + weights.mana + weights.tempo;

  if (sum === 0) {
    return { ...DEFAULT_WEIGHTS };
  }

  return {
    life: weights.life / sum,
    board: weights.board / sum,
    cards: weights.cards / sum,
    mana: weights.mana / sum,
    tempo: weights.tempo / sum,
  };
}

/**
 * Increment version string (semver patch bump)
 */
export function bumpVersion(version: string): string {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3) {
    return '1.0.0';
  }
  parts[2]! += 1;
  return parts.join('.');
}

/**
 * Clear the weights cache (useful for testing)
 */
export function clearCache(): void {
  cachedWeights = null;
  cacheTimestamp = 0;
}
