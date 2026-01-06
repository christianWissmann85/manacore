/**
 * LogWriter - Manages log file creation and writing
 *
 * Captures all simulation output to a log file for later reference.
 * Logs are stored in output/simulations/logs/
 */

import * as fs from 'fs';
import * as path from 'path';
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
   * Write game completion
   */
  writeGameComplete(
    gameNumber: number,
    winner: string,
    turns: number,
    playerDeck: string,
    opponentDeck: string,
    durationMs: number,
  ): void {
    this.writeLine(
      `Game ${gameNumber}: ${winner} wins in ${turns} turns (${playerDeck} vs ${opponentDeck}) [${durationMs.toFixed(1)}ms]`,
    );
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
   * Complete the log and close the stream
   */
  finish(results: { totalDuration: number }): void {
    this.writeLine('');
    this.writeLine('═'.repeat(80));
    this.writeLine(`Simulation completed at: ${new Date().toISOString()}`);
    this.writeLine(`Total duration: ${(results.totalDuration / 1000).toFixed(3)}s`);
    this.writeLine('═'.repeat(80));

    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
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
