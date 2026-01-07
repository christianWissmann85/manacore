/**
 * Centralized Output Path Manager
 *
 * All output files go under PROJECT_ROOT/output/ with organized subdirectories:
 *
 * output/
 * ├── simulations/           # simulate command
 * │   ├── {name}-{seed}.json
 * │   └── logs/
 * ├── benchmarks/            # benchmark command
 * ├── tuning/                # tune-weights, tune-mcts, pipeline
 * │   ├── weights.json       # Copy of current best
 * │   ├── weights-history/
 * │   └── TUNING_LOG.md
 * ├── training-data/         # collect-training command
 * │   └── {name}-{timestamp}/
 * ├── replays/               # Saved game replays
 * └── errors/                # Error snapshots for debugging
 */

import * as fs from 'fs';
import * as path from 'path';

// Project root is 4 levels up from this file
const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const OUTPUT_ROOT = path.join(PROJECT_ROOT, 'output');

/**
 * Output directory types
 */
export type OutputCategory =
  | 'simulations'
  | 'benchmarks'
  | 'tuning'
  | 'training-data'
  | 'replays'
  | 'errors';

/**
 * Get the root output directory
 */
export function getOutputRoot(): string {
  return OUTPUT_ROOT;
}

/**
 * Get a category subdirectory path
 */
export function getCategoryDir(category: OutputCategory): string {
  return path.join(OUTPUT_ROOT, category);
}

/**
 * Ensure a directory exists, creating it if needed
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Format a timestamp for use in filenames
 * Output: 2026-01-06T14-30-45
 */
export function formatTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/**
 * Generate a simulation results filename
 * Format: {name}-{seed}.json or {name}-{seed}-{timestamp}.json
 */
export function getSimulationResultPath(
  name: string,
  seed: number,
  format: 'json' | 'csv' = 'json',
  includeTimestamp: boolean = false,
): string {
  const dir = getCategoryDir('simulations');
  ensureDir(dir);

  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestamp = includeTimestamp ? `-${formatTimestamp()}` : '';
  const filename = `${safeName}-${seed}${timestamp}.${format}`;

  return path.join(dir, filename);
}

/**
 * Get simulation log directory and file path
 */
export function getSimulationLogPath(name: string, seed: number): string {
  const dir = path.join(getCategoryDir('simulations'), 'logs');
  ensureDir(dir);

  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestamp = formatTimestamp();
  const filename = `${safeName}-${seed}-${timestamp}.log`;

  return path.join(dir, filename);
}

/**
 * Get benchmark output path
 */
export function getBenchmarkPath(name: string, format: 'json' | 'md' = 'json'): string {
  const dir = getCategoryDir('benchmarks');
  ensureDir(dir);

  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestamp = formatTimestamp();
  const filename = `${safeName}-${timestamp}.${format}`;

  return path.join(dir, filename);
}

/**
 * Get training data collection directory
 */
export function getTrainingDataDir(name: string): string {
  const timestamp = formatTimestamp();
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir = path.join(getCategoryDir('training-data'), `${safeName}-${timestamp}`);
  ensureDir(path.join(dir, 'games'));
  return dir;
}

/**
 * Get tuning output paths
 */
export function getTuningPaths(): {
  weightsJson: string;
  historyDir: string;
  tuningLog: string;
  aiWeightsJson: string; // Also save to packages/ai/data/
} {
  const tuningDir = getCategoryDir('tuning');
  ensureDir(tuningDir);

  const historyDir = path.join(tuningDir, 'weights-history');
  ensureDir(historyDir);

  // Also need the AI package weights location
  const aiDataDir = path.join(PROJECT_ROOT, 'packages', 'ai', 'data');
  ensureDir(aiDataDir);

  return {
    weightsJson: path.join(tuningDir, 'weights.json'),
    historyDir,
    tuningLog: path.join(tuningDir, 'TUNING_LOG.md'),
    aiWeightsJson: path.join(aiDataDir, 'weights.json'),
  };
}

/**
 * Get error snapshot directory
 */
export function getErrorSnapshotPath(
  gameNumber: number,
  seed: number | undefined,
  format: 'json' | 'txt' = 'json',
): string {
  const dir = getCategoryDir('errors');
  ensureDir(dir);

  const timestamp = formatTimestamp();
  const seedStr = seed ?? 'random';
  const filename = `game-${gameNumber}-seed-${seedStr}-${timestamp}.${format}`;

  return path.join(dir, filename);
}

/**
 * Get replay file path
 */
export function getReplayPath(name: string, seed: number): string {
  const dir = getCategoryDir('replays');
  ensureDir(dir);

  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeName}-${seed}.replay.json`;

  return path.join(dir, filename);
}

/**
 * Get relative path from current working directory
 */
export function getRelativePath(absolutePath: string): string {
  return path.relative(process.cwd(), absolutePath);
}

/**
 * Get project root
 */
export function getProjectRoot(): string {
  return PROJECT_ROOT;
}
