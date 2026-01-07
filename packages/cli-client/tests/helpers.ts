/**
 * Shared test utilities for CLI-client package
 *
 * Provides helper functions for:
 * - File system operations (temp directories, cleanup)
 * - Game state and result fixtures
 * - Mock bot creation
 * - Simulation result fixtures
 * - Assertion helpers for validating output
 */

import { existsSync, mkdirSync, rmSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { GameState, Action, PlayerId, CardTemplate } from '@manacore/engine';
import type { Bot } from '@manacore/ai';
import type {
  SimulationResults,
  GameResult,
  GameRecord,
  DeckStats,
  MatchupStats,
  ProfileData,
  ReplayFile,
  ReplayOutcome,
} from '../src/types';

// =============================================================================
// FILE SYSTEM UTILITIES
// =============================================================================

/** Base directory for all test temporary files */
const TEST_BASE_DIR = '/tmp/manacore-cli-tests';

/**
 * Creates a unique temporary directory for test isolation
 * @param testName - Descriptive name for the test (used in directory name)
 * @returns The path to the created directory
 */
export function createTempDir(testName: string): string {
  const timestamp = Date.now();
  const dirPath = join(TEST_BASE_DIR, `${testName}-${timestamp}`);

  if (!existsSync(TEST_BASE_DIR)) {
    mkdirSync(TEST_BASE_DIR, { recursive: true });
  }

  mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

/**
 * Removes a temporary directory and all its contents
 * @param dirPath - Path to the directory to remove
 */
export function cleanupTempDir(dirPath: string): void {
  if (existsSync(dirPath)) {
    rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Cleans up all test temporary directories
 * Call this in afterAll() to ensure complete cleanup
 */
export function cleanupAllTempDirs(): void {
  if (existsSync(TEST_BASE_DIR)) {
    rmSync(TEST_BASE_DIR, { recursive: true, force: true });
  }
}

/**
 * Lists all files in a directory (non-recursive)
 * @param dirPath - Path to the directory
 * @returns Array of file names
 */
export function listFiles(dirPath: string): string[] {
  if (!existsSync(dirPath)) {
    return [];
  }
  return readdirSync(dirPath);
}

/**
 * Reads a JSON file and parses it
 * @param filePath - Path to the JSON file
 * @returns Parsed JSON object
 */
export function readJsonFile<T>(filePath: string): T {
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Reads a text file
 * @param filePath - Path to the file
 * @returns File content as string
 */
export function readTextFile(filePath: string): string {
  return readFileSync(filePath, 'utf-8');
}

// =============================================================================
// MOCK BOT FACTORY
// =============================================================================

/**
 * Creates a mock bot that returns a predetermined action
 * @param name - Bot name for display
 * @param actionToReturn - The action the bot will always return
 */
export function createMockBot(name: string, actionToReturn?: Action): Bot {
  return {
    getName: () => name,
    getDescription: () => `Mock bot: ${name}`,
    chooseAction: (_state: GameState, playerId: PlayerId): Action => {
      if (actionToReturn) {
        return actionToReturn;
      }
      // Default: return a pass priority action
      return {
        type: 'PASS_PRIORITY',
        playerId,
        payload: {},
      };
    },
  };
}

/**
 * Creates a mock bot that returns actions from a sequence
 * @param name - Bot name for display
 * @param actions - Array of actions to return in order
 */
export function createSequentialBot(name: string, actions: Action[]): Bot {
  let index = 0;
  return {
    getName: () => name,
    getDescription: () => `Sequential mock bot: ${name}`,
    chooseAction: (_state: GameState, playerId: PlayerId): Action => {
      if (index < actions.length) {
        return actions[index++];
      }
      // Default: return pass priority after sequence is exhausted
      return {
        type: 'PASS_PRIORITY',
        playerId,
        payload: {},
      };
    },
  };
}

/**
 * Creates a mock bot that tracks all calls for inspection
 * @param name - Bot name for display
 */
export function createSpyBot(
  name: string,
): Bot & { calls: Array<{ state: GameState; playerId: PlayerId }> } {
  const calls: Array<{ state: GameState; playerId: PlayerId }> = [];
  return {
    getName: () => name,
    getDescription: () => `Spy bot: ${name}`,
    chooseAction: (state: GameState, playerId: PlayerId): Action => {
      calls.push({ state, playerId });
      return {
        type: 'PASS_PRIORITY',
        playerId,
        payload: {},
      };
    },
    calls,
  };
}

// =============================================================================
// GAME RESULT FIXTURES
// =============================================================================

/**
 * Creates a mock GameResult with default values
 * @param overrides - Partial GameResult to override defaults
 */
export function createGameResult(overrides: Partial<GameResult> = {}): GameResult {
  return {
    winner: 'player',
    turns: 10,
    playerDeck: 'TestDeck1',
    opponentDeck: 'TestDeck2',
    durationMs: 100,
    endReason: 'life',
    ...overrides,
  };
}

/**
 * Creates a mock GameRecord with default values
 * @param overrides - Partial GameRecord to override defaults
 */
export function createGameRecord(overrides: Partial<GameRecord> = {}): GameRecord {
  return {
    gameNumber: 1,
    seed: 12345,
    winner: 'player',
    turns: 10,
    playerDeck: 'TestDeck1',
    opponentDeck: 'TestDeck2',
    durationMs: 100,
    ...overrides,
  };
}

/**
 * Creates multiple game records for batch testing
 * @param count - Number of records to create
 * @param baseOptions - Base options applied to all records
 */
export function createGameRecords(
  count: number,
  baseOptions: Partial<GameRecord> = {},
): GameRecord[] {
  const records: GameRecord[] = [];
  for (let i = 0; i < count; i++) {
    records.push(
      createGameRecord({
        gameNumber: i + 1,
        seed: 12345 + i,
        turns: 8 + (i % 5),
        winner: i % 3 === 0 ? 'opponent' : i % 3 === 1 ? null : 'player',
        ...baseOptions,
      }),
    );
  }
  return records;
}

// =============================================================================
// SIMULATION RESULT FIXTURES
// =============================================================================

/**
 * Creates mock DeckStats with default values
 * @param overrides - Partial DeckStats to override defaults
 */
export function createDeckStats(overrides: Partial<DeckStats> = {}): DeckStats {
  return {
    wins: 5,
    losses: 3,
    draws: 2,
    games: 10,
    avgCmc: 2.5,
    cmcDistribution: { 1: 4, 2: 8, 3: 6, 4: 4, 5: 2 },
    ...overrides,
  };
}

/**
 * Creates mock MatchupStats with default values
 * @param overrides - Partial MatchupStats to override defaults
 */
export function createMatchupStats(overrides: Partial<MatchupStats> = {}): MatchupStats {
  return {
    wins: 6,
    losses: 4,
    draws: 0,
    ...overrides,
  };
}

/**
 * Creates mock ProfileData with default values
 * @param overrides - Partial ProfileData to override defaults
 */
export function createProfileData(overrides: Partial<ProfileData> = {}): ProfileData {
  return {
    totalMs: 1000,
    avgGameMs: 100,
    gamesPerSecond: 10,
    ...overrides,
  };
}

/**
 * Creates a complete mock SimulationResults with default values
 * @param overrides - Partial SimulationResults to override defaults
 */
export function createSimulationResults(
  overrides: Partial<SimulationResults> = {},
): SimulationResults {
  const gameRecords = overrides.gameRecords ?? createGameRecords(10);

  // Calculate stats from records if not provided
  const playerWins = gameRecords.filter((r) => r.winner === 'player').length;
  const opponentWins = gameRecords.filter((r) => r.winner === 'opponent').length;
  const draws = gameRecords.filter((r) => r.winner === null).length;
  const totalTurns = gameRecords.reduce((sum, r) => sum + r.turns, 0);
  const avgTurns = gameRecords.length > 0 ? totalTurns / gameRecords.length : 0;

  return {
    totalGames: gameRecords.length,
    playerWins: overrides.playerWins ?? playerWins,
    opponentWins: overrides.opponentWins ?? opponentWins,
    draws: overrides.draws ?? draws,
    averageTurns: overrides.averageTurns ?? avgTurns,
    minTurns: overrides.minTurns ?? Math.min(...gameRecords.map((r) => r.turns)),
    maxTurns: overrides.maxTurns ?? Math.max(...gameRecords.map((r) => r.turns)),
    errors: overrides.errors ?? 0,
    gamesCompleted: overrides.gamesCompleted ?? gameRecords.length,
    deckStats: overrides.deckStats ?? {
      TestDeck1: createDeckStats({ wins: playerWins, losses: opponentWins }),
      TestDeck2: createDeckStats({ wins: opponentWins, losses: playerWins }),
    },
    matchups: overrides.matchups ?? {
      'TestDeck1 vs TestDeck2': createMatchupStats({ wins: playerWins, losses: opponentWins }),
    },
    gameRecords,
    baseSeed: overrides.baseSeed ?? 12345,
    failedSeeds: overrides.failedSeeds ?? [],
    profile: overrides.profile,
  };
}

/**
 * Creates a SimulationResults with errors for testing error handling
 * @param errorCount - Number of failed games
 * @param successCount - Number of successful games
 */
export function createSimulationResultsWithErrors(
  errorCount: number,
  successCount: number,
): SimulationResults {
  const successRecords = createGameRecords(successCount);
  const errorRecords: GameRecord[] = [];

  for (let i = 0; i < errorCount; i++) {
    errorRecords.push(
      createGameRecord({
        gameNumber: successCount + i + 1,
        seed: 99999 + i,
        winner: null,
        turns: 0,
        error: `Test error ${i + 1}`,
      }),
    );
  }

  const allRecords = [...successRecords, ...errorRecords];

  return createSimulationResults({
    totalGames: allRecords.length,
    gamesCompleted: successCount,
    errors: errorCount,
    failedSeeds: errorRecords.map((r) => r.seed),
    gameRecords: allRecords,
  });
}

// =============================================================================
// REPLAY FIXTURES
// =============================================================================

/**
 * Creates a mock ReplayOutcome with default values
 * @param overrides - Partial ReplayOutcome to override defaults
 */
export function createReplayOutcome(overrides: Partial<ReplayOutcome> = {}): ReplayOutcome {
  return {
    winner: 'player',
    turns: 15,
    reason: 'life',
    finalLife: {
      player: 12,
      opponent: 0,
    },
    ...overrides,
  };
}

/**
 * Creates a mock ReplayFile with default values
 * @param overrides - Partial fields to override defaults
 */
export function createReplayFile(overrides: Partial<ReplayFile> = {}): ReplayFile {
  return {
    version: '1.0.0',
    metadata: {
      timestamp: new Date().toISOString(),
      engineVersion: '1.0.0',
      description: 'Test replay',
      ...overrides.metadata,
    },
    seeds: {
      game: 12345,
      instanceCounter: 0,
      ...overrides.seeds,
    },
    decks: {
      player: { name: 'TestDeck1' },
      opponent: { name: 'TestDeck2' },
      ...overrides.decks,
    },
    bots: overrides.bots,
    actions: overrides.actions ?? [],
    outcome: overrides.outcome ?? createReplayOutcome(),
  };
}

// =============================================================================
// SEEDED RNG
// =============================================================================

/**
 * Creates a simple seeded random number generator for deterministic tests
 * @param seed - Initial seed value
 * @returns A function that returns random numbers between 0 and 1
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed;
  return function () {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

// =============================================================================
// ASSERTION HELPERS
// =============================================================================

/**
 * Validates that a CSV export contains expected headers and data
 * @param csvContent - The CSV content to validate
 * @param expectedHeaders - Array of expected header column names
 * @param expectedRowCount - Expected number of data rows (excluding header)
 */
export function assertValidCsvExport(
  csvContent: string,
  expectedHeaders: string[],
  expectedRowCount?: number,
): void {
  const lines = csvContent.split('\n').filter((line) => line.trim() && !line.startsWith('#'));

  if (lines.length === 0) {
    throw new Error('CSV export is empty');
  }

  const headerLine = lines[0];
  const headers = headerLine.split(',').map((h) => h.trim());

  for (const expected of expectedHeaders) {
    if (!headers.includes(expected)) {
      throw new Error(`Missing expected header: ${expected}. Found: ${headers.join(', ')}`);
    }
  }

  if (expectedRowCount !== undefined) {
    const dataRows = lines.slice(1).filter((line) => !line.includes('Summary'));
    if (dataRows.length !== expectedRowCount) {
      throw new Error(`Expected ${expectedRowCount} data rows, found ${dataRows.length}`);
    }
  }
}

/**
 * Validates that a JSON export has the expected structure
 * @param jsonContent - The parsed JSON object to validate
 * @param requiredFields - Array of required top-level field names
 */
export function assertValidJsonExport(
  jsonContent: Record<string, unknown>,
  requiredFields: string[],
): void {
  for (const field of requiredFields) {
    if (!(field in jsonContent)) {
      throw new Error(
        `Missing required field: ${field}. Found: ${Object.keys(jsonContent).join(', ')}`,
      );
    }
  }
}

/**
 * Validates that simulation results have consistent statistics
 * @param results - The SimulationResults to validate
 */
export function assertValidSimulationResults(results: SimulationResults): void {
  // Total outcomes should match completed games
  const totalOutcomes = results.playerWins + results.opponentWins + results.draws;
  if (totalOutcomes !== results.gamesCompleted) {
    throw new Error(
      `Win/loss/draw counts (${totalOutcomes}) don't match gamesCompleted (${results.gamesCompleted})`,
    );
  }

  // Errors + completed should equal total
  if (results.gamesCompleted + results.errors !== results.totalGames) {
    throw new Error(
      `gamesCompleted (${results.gamesCompleted}) + errors (${results.errors}) should equal totalGames (${results.totalGames})`,
    );
  }

  // Game records should match total games
  if (results.gameRecords.length !== results.totalGames) {
    throw new Error(
      `gameRecords length (${results.gameRecords.length}) should match totalGames (${results.totalGames})`,
    );
  }

  // Failed seeds should match error count
  if (results.failedSeeds.length !== results.errors) {
    throw new Error(
      `failedSeeds length (${results.failedSeeds.length}) should match errors (${results.errors})`,
    );
  }

  // Min/max turns should be sensible
  if (results.gamesCompleted > 0) {
    if (results.minTurns > results.maxTurns) {
      throw new Error(
        `minTurns (${results.minTurns}) cannot be greater than maxTurns (${results.maxTurns})`,
      );
    }
    if (results.averageTurns < results.minTurns || results.averageTurns > results.maxTurns) {
      throw new Error(
        `averageTurns (${results.averageTurns}) should be between min (${results.minTurns}) and max (${results.maxTurns})`,
      );
    }
  }
}

/**
 * Validates that a replay file has the expected structure
 * @param replay - The ReplayFile to validate
 */
export function assertValidReplayFile(replay: ReplayFile): void {
  if (!replay.version) {
    throw new Error('Replay file missing version');
  }

  if (!replay.metadata?.timestamp) {
    throw new Error('Replay file missing metadata.timestamp');
  }

  if (!replay.seeds || typeof replay.seeds.game !== 'number') {
    throw new Error('Replay file missing or invalid seeds.game');
  }

  if (!replay.decks?.player?.name || !replay.decks?.opponent?.name) {
    throw new Error('Replay file missing deck names');
  }

  if (!Array.isArray(replay.actions)) {
    throw new Error('Replay file missing actions array');
  }

  if (!replay.outcome) {
    throw new Error('Replay file missing outcome');
  }
}

/**
 * Asserts that two simulation results are statistically similar
 * Useful for comparing deterministic runs with same seed
 * @param a - First SimulationResults
 * @param b - Second SimulationResults
 */
export function assertResultsMatch(a: SimulationResults, b: SimulationResults): void {
  if (a.totalGames !== b.totalGames) {
    throw new Error(`totalGames mismatch: ${a.totalGames} vs ${b.totalGames}`);
  }
  if (a.playerWins !== b.playerWins) {
    throw new Error(`playerWins mismatch: ${a.playerWins} vs ${b.playerWins}`);
  }
  if (a.opponentWins !== b.opponentWins) {
    throw new Error(`opponentWins mismatch: ${a.opponentWins} vs ${b.opponentWins}`);
  }
  if (a.draws !== b.draws) {
    throw new Error(`draws mismatch: ${a.draws} vs ${b.draws}`);
  }
  if (a.baseSeed !== b.baseSeed) {
    throw new Error(`baseSeed mismatch: ${a.baseSeed} vs ${b.baseSeed}`);
  }
}
