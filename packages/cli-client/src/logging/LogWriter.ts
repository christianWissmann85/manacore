/**
 * LogWriter - Manages log file creation and writing
 *
 * Captures all simulation output to a log file for later reference.
 * Logs are stored in output/simulations/logs/
 */

import * as fs from 'fs';
import { getSimulationLogPath, getRelativePath } from '../output/paths';

export class LogWriter {
  private logPath: string;
  private logStream: fs.WriteStream | null = null;
  private buffer: string[] = [];

  constructor(seed: number, experimentName: string = 'simulation') {
    this.logPath = getSimulationLogPath(experimentName, seed);
  }

  /**
   * Start logging
   */
  start(metadata: {
    command: string;
    seed: number;
    gameCount: number;
    playerBot: string;
    opponentBot: string;
  }): void {
    this.logStream = fs.createWriteStream(this.logPath, { flags: 'w' });

    this.writeLine('═'.repeat(80));
    this.writeLine('ManaCore Simulation Log');
    this.writeLine('═'.repeat(80));
    this.writeLine(`Date: ${new Date().toISOString()}`);
    this.writeLine(`Command: ${metadata.command}`);
    this.writeLine(`Base Seed: ${metadata.seed}`);
    this.writeLine(`Games: ${metadata.gameCount}`);
    this.writeLine(`Bots: ${metadata.playerBot} vs ${metadata.opponentBot}`);
    this.writeLine('─'.repeat(80));
    this.writeLine('');
  }

  /**
   * Write a line to the log file
   */
  writeLine(line: string): void {
    if (this.logStream) {
      this.logStream.write(line + '\n');
    } else {
      this.buffer.push(line);
    }
  }

  /**
   * Write multiple lines
   */
  write(content: string): void {
    const lines = content.split('\n');
    lines.forEach((line) => this.writeLine(line));
  }

  /**
   * Write game completion with detailed information
   */
  writeGameComplete(
    gameNumber: number,
    winner: string,
    turns: number,
    playerDeck: string,
    opponentDeck: string,
    durationMs: number,
    playerBotName?: string,
    opponentBotName?: string,
    endReason?: string,
  ): void {
    // Format winner name
    let winnerDisplay = winner;
    if (winner === 'player' && playerBotName) {
      winnerDisplay = `Player (${playerBotName})`;
    } else if (winner === 'opponent' && opponentBotName) {
      winnerDisplay = `Opponent (${opponentBotName})`;
    } else if (winner === 'draw') {
      winnerDisplay = 'Draw';
    }

    // Build log line
    let logLine = `Game ${gameNumber}: ${winnerDisplay} wins in ${turns} turns | ${playerDeck} vs ${opponentDeck}`;

    if (endReason) {
      logLine += ` | ${endReason}`;
    }

    logLine += ` | ${durationMs.toFixed(1)}ms`;

    this.writeLine(logLine);
  }

  /**
   * Write error
   */
  writeError(gameNumber: number, seed: number, error: string): void {
    this.writeLine('');
    this.writeLine('═'.repeat(80));
    this.writeLine(`ERROR in game ${gameNumber} (seed ${seed})`);
    this.writeLine('═'.repeat(80));
    this.writeLine(error);
    this.writeLine('═'.repeat(80));
    this.writeLine('');
  }

  /**
   * Write summary statistics
   */
  writeSummary(summary: {
    totalGames: number;
    playerWins: number;
    opponentWins: number;
    draws: number;
    errors: number;
    playerBotName: string;
    opponentBotName: string;
    avgTurns: number;
    minTurns: number;
    maxTurns: number;
    totalDuration: number;
    gamesPerSecond: number;
  }): void {
    this.writeLine('');
    this.writeLine('═'.repeat(80));
    this.writeLine('SIMULATION SUMMARY');
    this.writeLine('═'.repeat(80));
    this.writeLine('');
    this.writeLine(`Total Games:     ${summary.totalGames}`);
    this.writeLine(`Completed:       ${summary.totalGames - summary.errors}`);
    if (summary.errors > 0) {
      this.writeLine(`Errors:          ${summary.errors}`);
    }
    this.writeLine('');
    this.writeLine('Results:');
    this.writeLine(
      `  ${summary.playerBotName}: ${summary.playerWins} wins (${((summary.playerWins / summary.totalGames) * 100).toFixed(1)}%)`,
    );
    this.writeLine(
      `  ${summary.opponentBotName}: ${summary.opponentWins} wins (${((summary.opponentWins / summary.totalGames) * 100).toFixed(1)}%)`,
    );
    this.writeLine(
      `  Draws: ${summary.draws} (${((summary.draws / summary.totalGames) * 100).toFixed(1)}%)`,
    );
    this.writeLine('');
    this.writeLine('Game Length:');
    this.writeLine(`  Average: ${summary.avgTurns.toFixed(1)} turns`);
    this.writeLine(`  Range: ${summary.minTurns}-${summary.maxTurns} turns`);
    this.writeLine('');
    this.writeLine('Performance:');
    this.writeLine(`  Total time: ${(summary.totalDuration / 1000).toFixed(1)}s`);
    this.writeLine(`  Speed: ${summary.gamesPerSecond.toFixed(2)} games/sec`);
    this.writeLine('');
  }

  /**
   * Complete the log and close the stream
   */
  finish(): Promise<void> {
    this.writeLine('═'.repeat(80));
    this.writeLine(`Simulation completed at: ${new Date().toISOString()}`);
    this.writeLine('═'.repeat(80));

    return new Promise((resolve) => {
      if (this.logStream) {
        this.logStream.end(() => {
          this.logStream = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get the log file path
   */
  getLogPath(): string {
    return this.logPath;
  }

  /**
   * Get relative path from current working directory
   */
  getRelativePath(): string {
    return getRelativePath(this.logPath);
  }
}
