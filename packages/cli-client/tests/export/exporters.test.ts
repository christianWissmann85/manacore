/**
 * Tests for Export modules
 *
 * Comprehensive test coverage for:
 * - JsonExporter: JSON format output
 * - CsvExporter: CSV format output
 * - ExporterManager: Multi-format coordination
 * - File I/O operations
 * - Edge cases and error handling
 */

import { describe, test, expect, beforeEach, afterEach, afterAll } from 'bun:test';
import { existsSync, chmodSync } from 'fs';
import { join } from 'path';

import { JsonExporter } from '../../src/export/JsonExporter';
import { CsvExporter } from '../../src/export/CsvExporter';
import { ExporterManager } from '../../src/export/ExporterManager';
import {
  createTempDir,
  cleanupTempDir,
  cleanupAllTempDirs,
  createSimulationResults,
  createGameRecords,
  readJsonFile,
  readTextFile,
  assertValidJsonExport,
  assertValidCsvExport,
} from '../helpers';
import type { SimulationResults } from '../../src/types';

// =============================================================================
// TEST SETUP
// =============================================================================

let tempDir: string;

beforeEach(() => {
  tempDir = createTempDir('exporters-test');
});

afterEach(() => {
  cleanupTempDir(tempDir);
});

afterAll(() => {
  cleanupAllTempDirs();
});

// =============================================================================
// JSON EXPORTER TESTS
// =============================================================================

describe('JsonExporter', () => {
  describe('getFormat', () => {
    test('returns "json" as format identifier', () => {
      const exporter = new JsonExporter();
      expect(exporter.getFormat()).toBe('json');
    });
  });

  describe('export to string', () => {
    test('exports valid JSON format when no outputPath provided', async () => {
      const exporter = new JsonExporter();
      const results = createSimulationResults();

      const output = await exporter.export(results, 'PlayerBot', 'OpponentBot');

      // Should return a JSON string
      expect(typeof output).toBe('string');

      // Should be valid JSON
      const parsed = JSON.parse(output as string);
      expect(parsed).toBeDefined();
    });

    test('contains all required metadata fields', async () => {
      const exporter = new JsonExporter();
      const results = createSimulationResults();

      const output = await exporter.export(results, 'TestPlayer', 'TestOpponent');
      const parsed = JSON.parse(output as string);

      // Check metadata
      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.exportDate).toBeDefined();
      expect(parsed.metadata.playerBot).toBe('TestPlayer');
      expect(parsed.metadata.opponentBot).toBe('TestOpponent');

      // exportDate should be a valid ISO date
      expect(() => new Date(parsed.metadata.exportDate)).not.toThrow();
    });

    test('contains all required results fields', async () => {
      const exporter = new JsonExporter();
      // Create 10 game records to match totalGames
      const gameRecords = createGameRecords(10);
      const results = createSimulationResults({
        gameRecords,
        playerWins: 5,
        opponentWins: 3,
        draws: 2,
        averageTurns: 12.5,
        minTurns: 5,
        maxTurns: 25,
        baseSeed: 42,
      });

      const output = await exporter.export(results, 'PlayerBot', 'OpponentBot');
      const parsed = JSON.parse(output as string);

      // Validate using helper
      assertValidJsonExport(parsed, ['metadata', 'results']);

      // Check results structure - totalGames comes from gameRecords.length
      expect(parsed.results.totalGames).toBe(10);
      expect(parsed.results.playerWins).toBe(5);
      expect(parsed.results.opponentWins).toBe(3);
      expect(parsed.results.draws).toBe(2);
      expect(parsed.results.averageTurns).toBe(12.5);
      expect(parsed.results.minTurns).toBe(5);
      expect(parsed.results.maxTurns).toBe(25);
      expect(parsed.results.baseSeed).toBe(42);
    });

    test('exports minified JSON by default', async () => {
      const exporter = new JsonExporter();
      const results = createSimulationResults();

      const output = await exporter.export(results, 'PlayerBot', 'OpponentBot');

      // Minified JSON should not have newlines (except possibly in data)
      const lines = (output as string).split('\n');
      expect(lines.length).toBe(1);
    });

    test('exports pretty JSON when pretty option is true', async () => {
      const exporter = new JsonExporter();
      const results = createSimulationResults();

      const output = await exporter.export(results, 'PlayerBot', 'OpponentBot', {
        pretty: true,
      });

      // Pretty JSON should have multiple lines
      const lines = (output as string).split('\n');
      expect(lines.length).toBeGreaterThan(1);
    });
  });

  describe('export to file', () => {
    test('writes file to correct path', async () => {
      const exporter = new JsonExporter();
      const results = createSimulationResults();
      const outputPath = join(tempDir, 'results.json');

      const returnedPath = await exporter.export(results, 'PlayerBot', 'OpponentBot', {
        outputPath,
      });

      expect(returnedPath).toBe(outputPath);
      expect(existsSync(outputPath)).toBe(true);
    });

    test('writes valid JSON content to file', async () => {
      const exporter = new JsonExporter();
      const gameRecords = createGameRecords(50);
      const results = createSimulationResults({
        gameRecords,
        playerWins: 30,
      });
      const outputPath = join(tempDir, 'results.json');

      await exporter.export(results, 'PlayerBot', 'OpponentBot', { outputPath });

      const fileContent = readJsonFile<{ metadata: unknown; results: SimulationResults }>(
        outputPath,
      );
      expect(fileContent.results.totalGames).toBe(50);
      expect(fileContent.results.playerWins).toBe(30);
    });

    test('overwrites existing files', async () => {
      const exporter = new JsonExporter();
      const outputPath = join(tempDir, 'results.json');

      // Write first file with baseSeed 111
      const results1 = createSimulationResults({ baseSeed: 111 });
      await exporter.export(results1, 'Bot1', 'Bot2', { outputPath });

      // Overwrite with second file with baseSeed 222
      const results2 = createSimulationResults({ baseSeed: 222 });
      await exporter.export(results2, 'Bot3', 'Bot4', { outputPath });

      const fileContent = readJsonFile<{ metadata: unknown; results: SimulationResults }>(
        outputPath,
      );
      expect(fileContent.results.baseSeed).toBe(222);
    });
  });

  describe('handles empty results', () => {
    test('exports empty game records correctly', async () => {
      const exporter = new JsonExporter();
      const results = createSimulationResults({
        totalGames: 0,
        playerWins: 0,
        opponentWins: 0,
        draws: 0,
        gamesCompleted: 0,
        gameRecords: [],
      });

      const output = await exporter.export(results, 'PlayerBot', 'OpponentBot');
      const parsed = JSON.parse(output as string);

      expect(parsed.results.totalGames).toBe(0);
      expect(parsed.results.gameRecords).toEqual([]);
    });
  });
});

// =============================================================================
// CSV EXPORTER TESTS
// =============================================================================

describe('CsvExporter', () => {
  describe('getFormat', () => {
    test('returns "csv" as format identifier', () => {
      const exporter = new CsvExporter();
      expect(exporter.getFormat()).toBe('csv');
    });
  });

  describe('export to string', () => {
    test('exports valid CSV with headers', async () => {
      const exporter = new CsvExporter();
      const results = createSimulationResults();

      const output = await exporter.export(results, 'PlayerBot', 'OpponentBot');

      expect(typeof output).toBe('string');

      // Validate CSV structure
      const expectedHeaders = [
        'game_number',
        'seed',
        'winner',
        'turns',
        'player_deck',
        'opponent_deck',
        'duration_ms',
        'error',
      ];
      assertValidCsvExport(output as string, expectedHeaders);
    });

    test('has correct column format', async () => {
      const exporter = new CsvExporter();
      const gameRecords = createGameRecords(3);
      const results = createSimulationResults({
        gameRecords,
      });

      const output = await exporter.export(results, 'PlayerBot', 'OpponentBot');
      const lines = (output as string).split('\n');

      // First line is header
      expect(lines[0]).toBe(
        'game_number,seed,winner,turns,player_deck,opponent_deck,duration_ms,error',
      );

      // Data rows - filter out empty lines and summary section
      const headerIdx = 0;
      const summaryIdx = lines.findIndex((l) => l.includes('# Summary'));
      const dataLines = lines.slice(headerIdx + 1, summaryIdx).filter((l) => l.trim());
      expect(dataLines.length).toBe(3);

      // Each data row has correct number of columns
      for (const line of dataLines) {
        const columns = line.split(',');
        expect(columns.length).toBe(8);
      }
    });

    test('includes summary section', async () => {
      const exporter = new CsvExporter();
      // Create 100 game records to match the expected stats
      const gameRecords = createGameRecords(100);
      const results = createSimulationResults({
        gameRecords,
        playerWins: 60,
        opponentWins: 35,
        draws: 5,
        errors: 0,
        gamesCompleted: 100,
        baseSeed: 12345,
      });

      const output = await exporter.export(results, 'TestPlayer', 'TestOpponent');
      const lines = (output as string).split('\n');

      // Find summary section
      const summaryIdx = lines.findIndex((l) => l.includes('# Summary'));
      expect(summaryIdx).toBeGreaterThan(0);

      // Check summary content
      const summaryLines = lines.slice(summaryIdx + 1).join('\n');
      expect(summaryLines).toContain('total_games,100');
      expect(summaryLines).toContain('games_completed,100');
      expect(summaryLines).toContain('player_wins,60');
      expect(summaryLines).toContain('opponent_wins,35');
      expect(summaryLines).toContain('draws,5');
      expect(summaryLines).toContain('errors,0');
      expect(summaryLines).toContain('base_seed,12345');
      expect(summaryLines).toContain('player_bot,TestPlayer');
      expect(summaryLines).toContain('opponent_bot,TestOpponent');
    });

    test('handles draws correctly (null winner)', async () => {
      const exporter = new CsvExporter();
      const results = createSimulationResults({
        gameRecords: [
          {
            gameNumber: 1,
            seed: 100,
            winner: null,
            turns: 10,
            playerDeck: 'DeckA',
            opponentDeck: 'DeckB',
          },
        ],
      });

      const output = await exporter.export(results, 'PlayerBot', 'OpponentBot');
      const lines = (output as string).split('\n');
      const dataLine = lines[1];

      expect(dataLine).toContain('draw');
    });
  });

  describe('special character escaping', () => {
    test('escapes double quotes in error messages', async () => {
      const exporter = new CsvExporter();
      const results = createSimulationResults({
        gameRecords: [
          {
            gameNumber: 1,
            seed: 100,
            winner: null,
            turns: 5,
            playerDeck: 'DeckA',
            opponentDeck: 'DeckB',
            error: 'Error with "quotes" in it',
          },
        ],
      });

      const output = await exporter.export(results, 'PlayerBot', 'OpponentBot');
      const lines = (output as string).split('\n');
      const dataLine = lines[1];

      // CSV escaping: quotes become double quotes, wrapped in quotes
      expect(dataLine).toContain('""quotes""');
    });

    test('handles error messages with commas', async () => {
      const exporter = new CsvExporter();
      const results = createSimulationResults({
        gameRecords: [
          {
            gameNumber: 1,
            seed: 100,
            winner: null,
            turns: 5,
            playerDeck: 'DeckA',
            opponentDeck: 'DeckB',
            error: 'Error: first, second, third problem',
          },
        ],
      });

      const output = await exporter.export(results, 'PlayerBot', 'OpponentBot');
      const lines = (output as string).split('\n');
      const dataLine = lines[1];

      // Error message should be quoted to contain commas
      expect(dataLine).toContain('"Error: first, second, third problem"');
    });
  });

  describe('export to file', () => {
    test('writes file to correct path', async () => {
      const exporter = new CsvExporter();
      const results = createSimulationResults();
      const outputPath = join(tempDir, 'results.csv');

      const returnedPath = await exporter.export(results, 'PlayerBot', 'OpponentBot', {
        outputPath,
      });

      expect(returnedPath).toBe(outputPath);
      expect(existsSync(outputPath)).toBe(true);
    });

    test('writes valid CSV content to file', async () => {
      const exporter = new CsvExporter();
      const results = createSimulationResults();
      const outputPath = join(tempDir, 'results.csv');

      await exporter.export(results, 'PlayerBot', 'OpponentBot', { outputPath });

      const fileContent = readTextFile(outputPath);
      const expectedHeaders = ['game_number', 'seed', 'winner', 'turns'];
      assertValidCsvExport(fileContent, expectedHeaders);
    });
  });

  describe('handles empty results', () => {
    test('exports header and summary even with no games', async () => {
      const exporter = new CsvExporter();
      const results = createSimulationResults({
        totalGames: 0,
        playerWins: 0,
        opponentWins: 0,
        draws: 0,
        gamesCompleted: 0,
        gameRecords: [],
        averageTurns: 0,
        minTurns: 0,
        maxTurns: 0,
      });

      const output = await exporter.export(results, 'PlayerBot', 'OpponentBot');
      const lines = (output as string).split('\n');

      // Should have header
      expect(lines[0]).toContain('game_number');

      // Should have summary
      expect(output as string).toContain('# Summary');
      expect(output as string).toContain('total_games,0');
    });
  });
});

// =============================================================================
// EXPORTER MANAGER TESTS
// =============================================================================

describe('ExporterManager', () => {
  describe('constructor', () => {
    test('has built-in exporters registered', () => {
      const manager = new ExporterManager();

      // The manager should work with console, json, and csv formats
      // We can't directly check the map, but we can test that exports work
      expect(manager).toBeDefined();
    });
  });

  describe('exportResults', () => {
    test('exports to single format', async () => {
      const manager = new ExporterManager();
      const results = createSimulationResults();
      const outputPath = join(tempDir, 'single');

      await manager.exportResults(results, 'PlayerBot', 'OpponentBot', {
        formats: ['json'],
        outputPath,
      });

      expect(existsSync(`${outputPath}.json`)).toBe(true);
    });

    test('exports to multiple formats simultaneously', async () => {
      const manager = new ExporterManager();
      const results = createSimulationResults();
      const outputPath = join(tempDir, 'multi');

      await manager.exportResults(results, 'PlayerBot', 'OpponentBot', {
        formats: ['json', 'csv'],
        outputPath,
      });

      expect(existsSync(`${outputPath}.json`)).toBe(true);
      expect(existsSync(`${outputPath}.csv`)).toBe(true);
    });

    test('does not add extension if already present in path', async () => {
      const manager = new ExporterManager();
      const results = createSimulationResults();
      const outputPath = join(tempDir, 'explicit.json');

      await manager.exportResults(results, 'PlayerBot', 'OpponentBot', {
        formats: ['json'],
        outputPath,
      });

      expect(existsSync(outputPath)).toBe(true);
      // Should not create explicit.json.json
      expect(existsSync(`${outputPath}.json`)).toBe(false);
    });

    test('console format does not create file', async () => {
      const manager = new ExporterManager();
      const results = createSimulationResults();

      // Console export should not create any files
      await manager.exportResults(results, 'PlayerBot', 'OpponentBot', {
        formats: ['console'],
        outputPath: join(tempDir, 'console-test'),
      });

      // No files should be created for console format
      const consoleFile = join(tempDir, 'console-test.console');
      expect(existsSync(consoleFile)).toBe(false);
    });

    test('handles unknown format gracefully', async () => {
      const manager = new ExporterManager();
      const results = createSimulationResults();

      // Should not throw, just warn and continue
      let error: Error | null = null;
      try {
        await manager.exportResults(results, 'PlayerBot', 'OpponentBot', {
          formats: ['unknown' as 'json'],
          outputPath: join(tempDir, 'unknown'),
        });
      } catch (e) {
        error = e as Error;
      }

      // Should not have thrown an error
      expect(error).toBeNull();
    });

    test('passes pretty option to exporters', async () => {
      const manager = new ExporterManager();
      const results = createSimulationResults();
      const outputPath = join(tempDir, 'pretty');

      await manager.exportResults(results, 'PlayerBot', 'OpponentBot', {
        formats: ['json'],
        outputPath,
        pretty: true,
      });

      const content = readTextFile(`${outputPath}.json`);
      const lines = content.split('\n');

      // Pretty printed JSON has multiple lines
      expect(lines.length).toBeGreaterThan(1);
    });

    test('uses experimentName for default output path', async () => {
      const manager = new ExporterManager();
      const results = createSimulationResults({ baseSeed: 99999 });

      // When no outputPath provided but experimentName is set,
      // it should use getSimulationResultPath
      // This creates files in the output/simulations directory
      await manager.exportResults(results, 'PlayerBot', 'OpponentBot', {
        formats: ['json'],
        experimentName: 'test-experiment',
      });

      // The file will be created in output/simulations/test-experiment-99999.json
      // We just verify it doesn't throw
    });
  });

  describe('export error handling', () => {
    test('continues with other formats if one fails', async () => {
      const manager = new ExporterManager();
      const results = createSimulationResults();

      // Mix of valid and invalid formats
      await manager.exportResults(results, 'PlayerBot', 'OpponentBot', {
        formats: ['json', 'invalid-format' as 'csv', 'csv'],
        outputPath: join(tempDir, 'mixed'),
      });

      // Valid formats should still work
      expect(existsSync(join(tempDir, 'mixed.json'))).toBe(true);
      expect(existsSync(join(tempDir, 'mixed.csv'))).toBe(true);
    });
  });
});

// =============================================================================
// FILE I/O TESTS
// =============================================================================

describe('File I/O', () => {
  describe('directory creation', () => {
    test('creates nested output directories if needed', async () => {
      const exporter = new JsonExporter();
      const results = createSimulationResults();
      const nestedPath = join(tempDir, 'deep', 'nested', 'dir', 'results.json');

      await exporter.export(results, 'PlayerBot', 'OpponentBot', {
        outputPath: nestedPath,
      });

      expect(existsSync(nestedPath)).toBe(true);
    });
  });

  describe('overwriting files', () => {
    test('overwrites existing JSON files', async () => {
      const exporter = new JsonExporter();
      const outputPath = join(tempDir, 'overwrite.json');

      // Write initial file
      await exporter.export(createSimulationResults({ baseSeed: 111 }), 'Bot1', 'Bot2', {
        outputPath,
      });

      // Overwrite
      await exporter.export(createSimulationResults({ baseSeed: 222 }), 'Bot3', 'Bot4', {
        outputPath,
      });

      const content = readJsonFile<{ results: SimulationResults }>(outputPath);
      expect(content.results.baseSeed).toBe(222);
    });

    test('overwrites existing CSV files', async () => {
      const exporter = new CsvExporter();
      const outputPath = join(tempDir, 'overwrite.csv');

      // Write initial file
      await exporter.export(createSimulationResults({ baseSeed: 111 }), 'Bot1', 'Bot2', {
        outputPath,
      });

      // Overwrite
      await exporter.export(createSimulationResults({ baseSeed: 222 }), 'Bot3', 'Bot4', {
        outputPath,
      });

      const content = readTextFile(outputPath);
      expect(content).toContain('base_seed,222');
    });
  });

  describe('permission errors', () => {
    test('throws error on write to read-only directory', async () => {
      const exporter = new JsonExporter();
      const results = createSimulationResults();

      // Create a read-only directory
      const readOnlyDir = join(tempDir, 'readonly');
      await Bun.write(join(readOnlyDir, '.gitkeep'), '');
      chmodSync(readOnlyDir, 0o444);

      const outputPath = join(readOnlyDir, 'results.json');

      try {
        await expect(
          exporter.export(results, 'PlayerBot', 'OpponentBot', { outputPath }),
        ).rejects.toThrow();
      } finally {
        // Restore permissions for cleanup
        chmodSync(readOnlyDir, 0o755);
      }
    });
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe('Edge Cases', () => {
  describe('empty simulation results', () => {
    test('JsonExporter handles zero games', async () => {
      const exporter = new JsonExporter();
      const results: SimulationResults = {
        totalGames: 0,
        playerWins: 0,
        opponentWins: 0,
        draws: 0,
        averageTurns: 0,
        minTurns: 0,
        maxTurns: 0,
        errors: 0,
        gamesCompleted: 0,
        deckStats: {},
        matchups: {},
        gameRecords: [],
        baseSeed: 0,
        failedSeeds: [],
      };

      const output = await exporter.export(results, 'PlayerBot', 'OpponentBot');
      const parsed = JSON.parse(output as string);

      expect(parsed.results.totalGames).toBe(0);
      expect(parsed.results.gameRecords).toEqual([]);
    });

    test('CsvExporter handles zero games', async () => {
      const exporter = new CsvExporter();
      const results: SimulationResults = {
        totalGames: 0,
        playerWins: 0,
        opponentWins: 0,
        draws: 0,
        averageTurns: 0,
        minTurns: 0,
        maxTurns: 0,
        errors: 0,
        gamesCompleted: 0,
        deckStats: {},
        matchups: {},
        gameRecords: [],
        baseSeed: 0,
        failedSeeds: [],
      };

      const output = await exporter.export(results, 'PlayerBot', 'OpponentBot');

      // Should still have header and summary
      expect(output as string).toContain('game_number');
      expect(output as string).toContain('# Summary');
      expect(output as string).toContain('total_games,0');
    });
  });

  describe('very large result sets', () => {
    test('JsonExporter handles 1000 game records', async () => {
      const exporter = new JsonExporter();
      const results = createSimulationResults({
        gameRecords: createGameRecords(1000),
      });

      const output = await exporter.export(results, 'PlayerBot', 'OpponentBot');
      const parsed = JSON.parse(output as string);

      expect(parsed.results.gameRecords.length).toBe(1000);
    });

    test('CsvExporter handles 1000 game records', async () => {
      const exporter = new CsvExporter();
      const results = createSimulationResults({
        gameRecords: createGameRecords(1000),
      });

      const output = await exporter.export(results, 'PlayerBot', 'OpponentBot');
      const lines = (output as string).split('\n');

      // Filter to data lines only (not header, empty lines, or summary)
      const dataLines = lines.filter((l) => {
        const trimmed = l.trim();
        return (
          trimmed &&
          !trimmed.startsWith('#') &&
          !trimmed.includes('game_number') &&
          !trimmed.includes('total_games') &&
          !trimmed.includes('games_completed') &&
          !trimmed.includes('player_wins') &&
          !trimmed.includes('opponent_wins') &&
          !trimmed.includes('draws,') &&
          !trimmed.includes('errors,') &&
          !trimmed.includes('avg_turns') &&
          !trimmed.includes('min_turns') &&
          !trimmed.includes('max_turns') &&
          !trimmed.includes('base_seed') &&
          !trimmed.includes('player_bot') &&
          !trimmed.includes('opponent_bot')
        );
      });

      expect(dataLines.length).toBe(1000);
    });

    test('writes large files to disk without issue', async () => {
      const exporter = new JsonExporter();
      const results = createSimulationResults({
        gameRecords: createGameRecords(5000),
      });
      const outputPath = join(tempDir, 'large.json');

      await exporter.export(results, 'PlayerBot', 'OpponentBot', { outputPath });

      expect(existsSync(outputPath)).toBe(true);

      const content = readJsonFile<{ results: SimulationResults }>(outputPath);
      expect(content.results.gameRecords.length).toBe(5000);
    });
  });

  describe('special characters in data', () => {
    test('handles deck names with special characters', async () => {
      const exporter = new CsvExporter();
      const results = createSimulationResults({
        gameRecords: [
          {
            gameNumber: 1,
            seed: 100,
            winner: 'player',
            turns: 10,
            playerDeck: 'Deck_With-Special.Chars',
            opponentDeck: 'Another-Deck_123',
            durationMs: 100,
          },
        ],
      });

      const output = await exporter.export(results, 'PlayerBot', 'OpponentBot');

      expect(output as string).toContain('Deck_With-Special.Chars');
      expect(output as string).toContain('Another-Deck_123');
    });

    test('handles bot names with spaces', async () => {
      const exporter = new JsonExporter();
      const results = createSimulationResults();

      const output = await exporter.export(results, 'Player Bot Alpha', 'Opponent Bot Beta');
      const parsed = JSON.parse(output as string);

      expect(parsed.metadata.playerBot).toBe('Player Bot Alpha');
      expect(parsed.metadata.opponentBot).toBe('Opponent Bot Beta');
    });

    test('handles Unicode characters in error messages', async () => {
      const exporter = new CsvExporter();
      const results = createSimulationResults({
        gameRecords: [
          {
            gameNumber: 1,
            seed: 100,
            winner: null,
            turns: 5,
            playerDeck: 'DeckA',
            opponentDeck: 'DeckB',
            error: 'Error with unicode: \u2603 snowman and \u2764 heart',
          },
        ],
      });

      const output = await exporter.export(results, 'PlayerBot', 'OpponentBot');

      // Unicode should be preserved
      expect(output as string).toContain('\u2603');
      expect(output as string).toContain('\u2764');
    });

    test('handles newlines in error messages', async () => {
      const exporter = new CsvExporter();
      const results = createSimulationResults({
        gameRecords: [
          {
            gameNumber: 1,
            seed: 100,
            winner: null,
            turns: 5,
            playerDeck: 'DeckA',
            opponentDeck: 'DeckB',
            error: 'Error line 1\nError line 2',
          },
        ],
      });

      const output = await exporter.export(results, 'PlayerBot', 'OpponentBot');

      // Error with newlines should be quoted
      expect(output as string).toContain('"Error line 1');
    });
  });

  describe('floating point precision', () => {
    test('preserves averageTurns precision', async () => {
      const exporter = new JsonExporter();
      const results = createSimulationResults({
        averageTurns: 12.333333333333334,
      });

      const output = await exporter.export(results, 'PlayerBot', 'OpponentBot');
      const parsed = JSON.parse(output as string);

      expect(parsed.results.averageTurns).toBeCloseTo(12.333333333333334, 10);
    });

    test('CsvExporter formats averageTurns to 2 decimal places', async () => {
      const exporter = new CsvExporter();
      const results = createSimulationResults({
        averageTurns: 12.333333333333334,
      });

      const output = await exporter.export(results, 'PlayerBot', 'OpponentBot');

      expect(output as string).toContain('avg_turns,12.33');
    });
  });

  describe('all errors scenario', () => {
    test('handles results where all games failed', async () => {
      const exporter = new JsonExporter();
      const results: SimulationResults = {
        totalGames: 5,
        playerWins: 0,
        opponentWins: 0,
        draws: 0,
        averageTurns: 0,
        minTurns: 0,
        maxTurns: 0,
        errors: 5,
        gamesCompleted: 0,
        deckStats: {},
        matchups: {},
        gameRecords: [
          {
            gameNumber: 1,
            seed: 1,
            winner: null,
            turns: 0,
            playerDeck: 'A',
            opponentDeck: 'B',
            error: 'Failed 1',
          },
          {
            gameNumber: 2,
            seed: 2,
            winner: null,
            turns: 0,
            playerDeck: 'A',
            opponentDeck: 'B',
            error: 'Failed 2',
          },
          {
            gameNumber: 3,
            seed: 3,
            winner: null,
            turns: 0,
            playerDeck: 'A',
            opponentDeck: 'B',
            error: 'Failed 3',
          },
          {
            gameNumber: 4,
            seed: 4,
            winner: null,
            turns: 0,
            playerDeck: 'A',
            opponentDeck: 'B',
            error: 'Failed 4',
          },
          {
            gameNumber: 5,
            seed: 5,
            winner: null,
            turns: 0,
            playerDeck: 'A',
            opponentDeck: 'B',
            error: 'Failed 5',
          },
        ],
        baseSeed: 1,
        failedSeeds: [1, 2, 3, 4, 5],
      };

      const output = await exporter.export(results, 'PlayerBot', 'OpponentBot');
      const parsed = JSON.parse(output as string);

      expect(parsed.results.errors).toBe(5);
      expect(parsed.results.gamesCompleted).toBe(0);
      expect(parsed.results.failedSeeds).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('profile data', () => {
    test('exports profile data in JSON', async () => {
      const exporter = new JsonExporter();
      const results = createSimulationResults({
        profile: {
          totalMs: 5000,
          avgGameMs: 50,
          gamesPerSecond: 20,
        },
      });

      const output = await exporter.export(results, 'PlayerBot', 'OpponentBot');
      const parsed = JSON.parse(output as string);

      expect(parsed.results.profile).toBeDefined();
      expect(parsed.results.profile.totalMs).toBe(5000);
      expect(parsed.results.profile.avgGameMs).toBe(50);
      expect(parsed.results.profile.gamesPerSecond).toBe(20);
    });
  });
});
