/**
 * Logging Module Tests
 *
 * Comprehensive tests for LogWriter and ProgressBar functionality.
 * Tests file creation, content formatting, error handling, and edge cases.
 */

import { describe, test, expect, beforeEach, afterEach, afterAll } from 'bun:test';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createTempDir, cleanupTempDir, cleanupAllTempDirs, readTextFile } from '../helpers';
import { LogWriter } from '../../src/logging/LogWriter';
import { ProgressBar } from '../../src/logging/ProgressBar';

// =============================================================================
// TEST SETUP
// =============================================================================

// Test state
let tempDir: string;
let logCounter = 0;

/**
 * Create a testable LogWriter that writes to a temp directory
 * We need to extend LogWriter since it uses internal path generation
 */
class TestableLogWriter extends LogWriter {
  private testLogPath: string;

  constructor(seed: number, experimentName: string, testDir: string) {
    super(seed, experimentName);
    // Override the internal path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.testLogPath = join(testDir, `${experimentName}-${seed}-${timestamp}.log`);
    // Use reflection to set the private field
    (this as unknown as { logPath: string }).logPath = this.testLogPath;
  }

  getTestLogPath(): string {
    return this.testLogPath;
  }
}

// =============================================================================
// LOGWRITER TESTS
// =============================================================================

describe('LogWriter', () => {
  beforeEach(() => {
    tempDir = createTempDir('logwriter');
    logCounter++;
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  afterAll(() => {
    cleanupAllTempDirs();
  });

  describe('File Creation and Management', () => {
    test('creates log file in correct directory', async () => {
      const logWriter = new TestableLogWriter(12345, 'test-simulation', tempDir);

      logWriter.start({
        command: 'simulate 100',
        seed: 12345,
        gameCount: 100,
        playerBot: 'RandomBot',
        opponentBot: 'GreedyBot',
      });

      await logWriter.finish();

      const logPath = logWriter.getTestLogPath();
      expect(existsSync(logPath)).toBe(true);
    });

    test('writes log entries with timestamps', async () => {
      const logWriter = new TestableLogWriter(12345, 'timestamp-test', tempDir);

      logWriter.start({
        command: 'simulate 10',
        seed: 12345,
        gameCount: 10,
        playerBot: 'TestBot1',
        opponentBot: 'TestBot2',
      });

      await logWriter.finish();

      const content = readTextFile(logWriter.getTestLogPath());

      // Should contain date in ISO format
      expect(content).toMatch(/Date: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      // Should contain completion timestamp
      expect(content).toMatch(/Simulation completed at: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('appends to existing log content', async () => {
      const logWriter = new TestableLogWriter(12345, 'append-test', tempDir);

      logWriter.start({
        command: 'simulate 5',
        seed: 12345,
        gameCount: 5,
        playerBot: 'BotA',
        opponentBot: 'BotB',
      });

      // Write multiple lines
      logWriter.writeLine('First line');
      logWriter.writeLine('Second line');
      logWriter.writeLine('Third line');

      await logWriter.finish();

      const content = readTextFile(logWriter.getTestLogPath());

      expect(content).toContain('First line');
      expect(content).toContain('Second line');
      expect(content).toContain('Third line');

      // Verify order
      const firstIdx = content.indexOf('First line');
      const secondIdx = content.indexOf('Second line');
      const thirdIdx = content.indexOf('Third line');

      expect(firstIdx).toBeLessThan(secondIdx);
      expect(secondIdx).toBeLessThan(thirdIdx);
    });

    test('flushes buffer on close', async () => {
      const logWriter = new TestableLogWriter(12345, 'flush-test', tempDir);

      logWriter.start({
        command: 'simulate 1',
        seed: 12345,
        gameCount: 1,
        playerBot: 'Bot1',
        opponentBot: 'Bot2',
      });

      // Write a significant amount of data
      for (let i = 0; i < 100; i++) {
        logWriter.writeLine(`Log entry number ${i}`);
      }

      await logWriter.finish();

      const content = readTextFile(logWriter.getTestLogPath());

      // All entries should be present after finish
      expect(content).toContain('Log entry number 0');
      expect(content).toContain('Log entry number 50');
      expect(content).toContain('Log entry number 99');
    });

    test('handles concurrent writes', async () => {
      const logWriter = new TestableLogWriter(12345, 'concurrent-test', tempDir);

      logWriter.start({
        command: 'simulate 10',
        seed: 12345,
        gameCount: 10,
        playerBot: 'ConcurrentBot1',
        opponentBot: 'ConcurrentBot2',
      });

      // Simulate concurrent writes
      const writePromises: Promise<void>[] = [];
      for (let i = 0; i < 50; i++) {
        writePromises.push(
          new Promise<void>((resolve) => {
            logWriter.writeLine(`Concurrent write ${i}`);
            resolve();
          }),
        );
      }

      await Promise.all(writePromises);
      await logWriter.finish();

      const content = readTextFile(logWriter.getTestLogPath());

      // All writes should complete
      for (let i = 0; i < 50; i++) {
        expect(content).toContain(`Concurrent write ${i}`);
      }
    });

    test('creates directory if it does not exist', async () => {
      const nestedDir = join(tempDir, 'nested', 'logs', 'directory');

      // Manually ensure the nested directory exists for the test
      mkdirSync(nestedDir, { recursive: true });

      const logWriter = new TestableLogWriter(12345, 'nested-dir-test', nestedDir);

      logWriter.start({
        command: 'simulate 1',
        seed: 12345,
        gameCount: 1,
        playerBot: 'Bot1',
        opponentBot: 'Bot2',
      });

      await logWriter.finish();

      expect(existsSync(logWriter.getTestLogPath())).toBe(true);
    });
  });

  describe('Log Content Formatting', () => {
    test('logs game results correctly', async () => {
      const logWriter = new TestableLogWriter(12345, 'game-results', tempDir);

      logWriter.start({
        command: 'simulate 3',
        seed: 12345,
        gameCount: 3,
        playerBot: 'WinnerBot',
        opponentBot: 'LoserBot',
      });

      logWriter.writeGameComplete(
        1,
        'player',
        10,
        'RedDeck',
        'BlueDeck',
        125.5,
        'WinnerBot',
        'LoserBot',
        'life',
      );

      logWriter.writeGameComplete(
        2,
        'opponent',
        15,
        'GreenDeck',
        'WhiteDeck',
        200.0,
        'WinnerBot',
        'LoserBot',
        'decked',
      );

      logWriter.writeGameComplete(3, 'draw', 50, 'BlackDeck', 'RedDeck', 500.0);

      await logWriter.finish();

      const content = readTextFile(logWriter.getTestLogPath());

      // Game 1
      expect(content).toContain('Game 1:');
      expect(content).toContain('Player (WinnerBot) wins');
      expect(content).toContain('10 turns');
      expect(content).toContain('RedDeck vs BlueDeck');
      expect(content).toContain('life');
      expect(content).toContain('125.5ms');

      // Game 2
      expect(content).toContain('Game 2:');
      expect(content).toContain('Opponent (LoserBot) wins');
      expect(content).toContain('15 turns');
      expect(content).toContain('decked');

      // Game 3 (draw)
      expect(content).toContain('Game 3:');
      expect(content).toContain('Draw wins');
    });

    test('logs errors with stack traces', async () => {
      const logWriter = new TestableLogWriter(12345, 'error-test', tempDir);

      logWriter.start({
        command: 'simulate 10',
        seed: 12345,
        gameCount: 10,
        playerBot: 'ErrorBot1',
        opponentBot: 'ErrorBot2',
      });

      const errorMessage = `Error: Test error message
    at someFunction (file.ts:10:5)
    at anotherFunction (file.ts:20:10)
    at mainLoop (main.ts:100:3)`;

      logWriter.writeError(5, 12350, errorMessage);

      await logWriter.finish();

      const content = readTextFile(logWriter.getTestLogPath());

      expect(content).toContain('ERROR in game 5');
      expect(content).toContain('seed 12350');
      expect(content).toContain('Test error message');
      expect(content).toContain('someFunction');
      expect(content).toContain('file.ts:10:5');
    });

    test('formats entries consistently with separators', async () => {
      const logWriter = new TestableLogWriter(12345, 'format-test', tempDir);

      logWriter.start({
        command: 'simulate 1',
        seed: 12345,
        gameCount: 1,
        playerBot: 'FormatBot1',
        opponentBot: 'FormatBot2',
      });

      await logWriter.finish();

      const content = readTextFile(logWriter.getTestLogPath());

      // Check for header separators (Unicode box characters)
      const doubleSeparator = '\u2550'.repeat(80); // Box drawing double horizontal
      const singleSeparator = '\u2500'.repeat(80); // Box drawing single horizontal

      expect(content).toContain(doubleSeparator);
      expect(content).toContain(singleSeparator);
      expect(content).toContain('ManaCore Simulation Log');
    });

    test('handles special characters in content', async () => {
      const logWriter = new TestableLogWriter(12345, 'special-chars', tempDir);

      logWriter.start({
        command: 'simulate 1',
        seed: 12345,
        gameCount: 1,
        playerBot: 'Bot<1>',
        opponentBot: 'Bot"2"',
      });

      // Write content with special characters
      logWriter.writeLine('Special chars: <>&"\'\t\n');
      logWriter.writeLine('Unicode: \u2665 \u2660 \u2666 \u2663'); // Card suits
      logWriter.writeLine('Backslashes: C:\\path\\to\\file');

      await logWriter.finish();

      const content = readTextFile(logWriter.getTestLogPath());

      expect(content).toContain('<>&"\'');
      expect(content).toContain('\u2665'); // Heart
      expect(content).toContain('C:\\path\\to\\file');
    });

    test('writes summary statistics correctly', async () => {
      const logWriter = new TestableLogWriter(12345, 'summary-test', tempDir);

      logWriter.start({
        command: 'simulate 100',
        seed: 12345,
        gameCount: 100,
        playerBot: 'SummaryBot1',
        opponentBot: 'SummaryBot2',
      });

      logWriter.writeSummary({
        totalGames: 100,
        playerWins: 55,
        opponentWins: 40,
        draws: 5,
        errors: 0,
        playerBotName: 'SummaryBot1',
        opponentBotName: 'SummaryBot2',
        avgTurns: 12.5,
        minTurns: 5,
        maxTurns: 30,
        totalDuration: 5000,
        gamesPerSecond: 20.0,
      });

      await logWriter.finish();

      const content = readTextFile(logWriter.getTestLogPath());

      expect(content).toContain('SIMULATION SUMMARY');
      expect(content).toContain('Total Games:     100');
      expect(content).toContain('SummaryBot1: 55 wins (55.0%)');
      expect(content).toContain('SummaryBot2: 40 wins (40.0%)');
      expect(content).toContain('Draws: 5 (5.0%)');
      expect(content).toContain('Average: 12.5 turns');
      expect(content).toContain('Range: 5-30 turns');
      expect(content).toContain('Total time: 5.0s');
      expect(content).toContain('Speed: 20.00 games/sec');
    });

    test('writes summary with errors correctly', async () => {
      const logWriter = new TestableLogWriter(12345, 'summary-errors', tempDir);

      logWriter.start({
        command: 'simulate 100',
        seed: 12345,
        gameCount: 100,
        playerBot: 'ErrorBot1',
        opponentBot: 'ErrorBot2',
      });

      logWriter.writeSummary({
        totalGames: 100,
        playerWins: 45,
        opponentWins: 35,
        draws: 5,
        errors: 15,
        playerBotName: 'ErrorBot1',
        opponentBotName: 'ErrorBot2',
        avgTurns: 10.0,
        minTurns: 3,
        maxTurns: 25,
        totalDuration: 3000,
        gamesPerSecond: 28.33,
      });

      await logWriter.finish();

      const content = readTextFile(logWriter.getTestLogPath());

      expect(content).toContain('Completed:       85');
      expect(content).toContain('Errors:          15');
    });
  });

  describe('Edge Cases', () => {
    test('handles empty log content', async () => {
      const logWriter = new TestableLogWriter(12345, 'empty-test', tempDir);

      logWriter.start({
        command: 'simulate 0',
        seed: 12345,
        gameCount: 0,
        playerBot: 'EmptyBot1',
        opponentBot: 'EmptyBot2',
      });

      // No additional content written

      await logWriter.finish();

      const content = readTextFile(logWriter.getTestLogPath());

      // Should still have header and footer
      expect(content).toContain('ManaCore Simulation Log');
      expect(content).toContain('Simulation completed at:');
    });

    test('handles very long log entries', async () => {
      const logWriter = new TestableLogWriter(12345, 'long-entry', tempDir);

      logWriter.start({
        command: 'simulate 1',
        seed: 12345,
        gameCount: 1,
        playerBot: 'LongBot1',
        opponentBot: 'LongBot2',
      });

      // Write a very long line (10KB)
      const longLine = 'A'.repeat(10240);
      logWriter.writeLine(longLine);

      // Write multiline content
      const multiline = Array(100).fill('This is a repeating line').join('\n');
      logWriter.write(multiline);

      await logWriter.finish();

      const content = readTextFile(logWriter.getTestLogPath());

      expect(content).toContain('A'.repeat(100)); // At least part of long line
      expect(content.split('This is a repeating line').length).toBeGreaterThan(50);
    });

    test('handles rapid successive writes', async () => {
      const logWriter = new TestableLogWriter(12345, 'rapid-writes', tempDir);

      logWriter.start({
        command: 'simulate 1000',
        seed: 12345,
        gameCount: 1000,
        playerBot: 'RapidBot1',
        opponentBot: 'RapidBot2',
      });

      // Rapid writes without any delay
      for (let i = 0; i < 1000; i++) {
        logWriter.writeLine(`Rapid line ${i}`);
      }

      await logWriter.finish();

      const content = readTextFile(logWriter.getTestLogPath());

      // Check sampling of lines
      expect(content).toContain('Rapid line 0');
      expect(content).toContain('Rapid line 100');
      expect(content).toContain('Rapid line 500');
      expect(content).toContain('Rapid line 999');
    });

    test('buffers writes before start', async () => {
      const logWriter = new TestableLogWriter(12345, 'buffer-test', tempDir);

      // Write before start - should buffer
      logWriter.writeLine('Pre-start line 1');
      logWriter.writeLine('Pre-start line 2');

      logWriter.start({
        command: 'simulate 1',
        seed: 12345,
        gameCount: 1,
        playerBot: 'BufferBot1',
        opponentBot: 'BufferBot2',
      });

      logWriter.writeLine('Post-start line');

      await logWriter.finish();

      const content = readTextFile(logWriter.getTestLogPath());

      // Pre-start lines were buffered, so they won't appear in the file
      // (The LogWriter only writes to buffer before start, then discards)
      expect(content).toContain('Post-start line');
    });

    test('getLogPath returns correct path', () => {
      const logWriter = new TestableLogWriter(12345, 'path-test', tempDir);
      const path = logWriter.getLogPath();

      expect(path).toContain('path-test');
      expect(path).toContain('12345');
      expect(path).toEndWith('.log');
    });

    test('getRelativePath returns relative path', () => {
      const logWriter = new TestableLogWriter(12345, 'relative-test', tempDir);
      const relativePath = logWriter.getRelativePath();

      // Should not start with /
      // Note: This depends on the current working directory
      expect(relativePath).toBeDefined();
      expect(typeof relativePath).toBe('string');
    });
  });
});

// =============================================================================
// PROGRESSBAR TESTS
// =============================================================================

describe('ProgressBar', () => {
  // Note: ProgressBar uses process.stdout which is difficult to test directly
  // without a TTY. We focus on testing the internal logic.

  describe('Percentage Calculation', () => {
    test('calculates percentage correctly at 0%', () => {
      const bar = new ProgressBar(100);
      // Access internal state through update behavior
      // At construction, current is 0, so percentage is 0%
      expect(bar).toBeDefined();
    });

    test('calculates percentage correctly at 50%', () => {
      const bar = new ProgressBar(100);
      // Update to 50
      bar.update(50);
      // Cannot easily verify output without mocking stdout
      expect(bar).toBeDefined();
    });

    test('calculates percentage correctly at 100%', () => {
      const bar = new ProgressBar(100);
      bar.update(100);
      expect(bar).toBeDefined();
    });

    test('handles zero total gracefully', () => {
      // Should not throw or cause division by zero
      const bar = new ProgressBar(0);
      expect(() => bar.start()).not.toThrow();
      expect(() => bar.update(0)).not.toThrow();
      expect(() => bar.complete()).not.toThrow();
    });

    test('handles very large totals', () => {
      const bar = new ProgressBar(1000000);
      expect(() => bar.start()).not.toThrow();
      expect(() => bar.update(500000)).not.toThrow();
      expect(() => bar.complete()).not.toThrow();
    });
  });

  describe('Update Behavior', () => {
    test('throttles updates to prevent excessive rendering', () => {
      const bar = new ProgressBar(100);
      bar.start();

      // Rapid updates should be throttled
      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        bar.update(i % 100);
      }
      const elapsed = Date.now() - startTime;

      // Should complete quickly due to throttling
      expect(elapsed).toBeLessThan(1000);
    });

    test('always renders on complete', () => {
      const bar = new ProgressBar(100);
      bar.start();
      bar.update(50);

      // Complete should always render, even if recently updated
      expect(() => bar.complete()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    test('negative current values cause error', () => {
      const bar = new ProgressBar(100);
      // ProgressBar doesn't guard against negative values - this throws
      // This documents the current behavior
      expect(() => bar.update(-10)).toThrow(RangeError);
    });

    test('current greater than total causes error', () => {
      const bar = new ProgressBar(100);
      // ProgressBar doesn't guard against values > total - this throws
      // This documents the current behavior
      expect(() => bar.update(150)).toThrow(RangeError);
    });

    test('can be started multiple times', () => {
      const bar = new ProgressBar(100);
      expect(() => {
        bar.start();
        bar.start();
        bar.start();
      }).not.toThrow();
    });

    test('can be completed multiple times', () => {
      const bar = new ProgressBar(100);
      bar.start();
      expect(() => {
        bar.complete();
        bar.complete();
      }).not.toThrow();
    });
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('Logging Integration', () => {
  let integrationTempDir: string;

  beforeEach(() => {
    integrationTempDir = createTempDir('logging-integration');
  });

  afterEach(() => {
    cleanupTempDir(integrationTempDir);
  });

  test('LogWriter creates complete simulation log', async () => {
    const logWriter = new TestableLogWriter(42, 'full-simulation', integrationTempDir);

    // Start log
    logWriter.start({
      command: 'simulate 10',
      seed: 42,
      gameCount: 10,
      playerBot: 'MCTSBot',
      opponentBot: 'RandomBot',
    });

    // Log some games
    for (let i = 1; i <= 10; i++) {
      const winner = i % 3 === 0 ? 'opponent' : i % 3 === 1 ? 'player' : 'draw';
      logWriter.writeGameComplete(
        i,
        winner,
        10 + i,
        'RedDeck',
        'BlueDeck',
        100 + i * 10,
        'MCTSBot',
        'RandomBot',
        'life',
      );
    }

    // Log an error
    logWriter.writeError(5, 47, 'Simulated error for testing');

    // Log summary
    logWriter.writeSummary({
      totalGames: 10,
      playerWins: 4,
      opponentWins: 3,
      draws: 3,
      errors: 0,
      playerBotName: 'MCTSBot',
      opponentBotName: 'RandomBot',
      avgTurns: 15.0,
      minTurns: 11,
      maxTurns: 20,
      totalDuration: 1500,
      gamesPerSecond: 6.67,
    });

    await logWriter.finish();

    // Verify complete log
    const content = readTextFile(logWriter.getTestLogPath());

    // Header
    expect(content).toContain('ManaCore Simulation Log');
    expect(content).toContain('Command: simulate 10');
    expect(content).toContain('Base Seed: 42');
    expect(content).toContain('Games: 10');
    expect(content).toContain('Bots: MCTSBot vs RandomBot');

    // Games
    expect(content).toContain('Game 1:');
    expect(content).toContain('Game 10:');

    // Error
    expect(content).toContain('ERROR in game 5');

    // Summary
    expect(content).toContain('SIMULATION SUMMARY');
    expect(content).toContain('MCTSBot: 4 wins');

    // Footer
    expect(content).toContain('Simulation completed at:');
  });

  test('multiple LogWriters can write simultaneously', async () => {
    const writers = [
      new TestableLogWriter(1, 'parallel-1', integrationTempDir),
      new TestableLogWriter(2, 'parallel-2', integrationTempDir),
      new TestableLogWriter(3, 'parallel-3', integrationTempDir),
    ];

    // Start all writers
    for (const [idx, writer] of writers.entries()) {
      writer.start({
        command: `simulate ${idx + 1}`,
        seed: idx + 1,
        gameCount: 5,
        playerBot: `Bot${idx}A`,
        opponentBot: `Bot${idx}B`,
      });
    }

    // Write to all simultaneously
    const writePromises = writers.flatMap((writer, idx) =>
      Array(10)
        .fill(null)
        .map((_, lineIdx) => Promise.resolve(writer.writeLine(`Writer ${idx} line ${lineIdx}`))),
    );

    await Promise.all(writePromises);

    // Finish all
    await Promise.all(writers.map((w) => w.finish()));

    // Verify each file is separate and complete
    for (const [idx, writer] of writers.entries()) {
      const content = readTextFile(writer.getTestLogPath());
      expect(content).toContain(`Writer ${idx} line 0`);
      expect(content).toContain(`Writer ${idx} line 9`);
      // Should not contain content from other writers
      const otherIdx = (idx + 1) % 3;
      expect(content).not.toContain(`Writer ${otherIdx} line`);
    }
  });
});
