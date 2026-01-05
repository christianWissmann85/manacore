/**
 * SnapshotWriter - Handles writing error snapshots for debugging
 *
 * Responsible for:
 * - Generating detailed state snapshots
 * - Writing snapshots to disk (JSON and text formats)
 * - Managing snapshot storage location
 */

import type { GameState, Action } from '@manacore/engine';
import { CardLoader, describeAction, getLegalActions } from '@manacore/engine';
import * as fs from 'fs';
import * as path from 'path';

// Default snapshot directory: results/error-snapshots/ in project root
const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const DEFAULT_SNAPSHOT_DIR = path.join(PROJECT_ROOT, 'results', 'error-snapshots');

/**
 * Custom error class with game context
 */
export class GameError extends Error {
  constructor(
    message: string,
    public readonly state: GameState,
    public readonly recentActions: Action[],
    public readonly seed: number | undefined,
  ) {
    super(message);
    this.name = 'GameError';
  }
}

/**
 * Structured snapshot format for JSON export
 */
export interface GameSnapshot {
  version: string;
  metadata: {
    seed: number | undefined;
    gameNumber: number;
    timestamp: string;
  };
  error: {
    message: string;
    stack?: string;
  };
  gameState: {
    turn: number;
    phase: string;
    step: string | undefined;
    activePlayer: string;
    priorityPlayer: string;
    gameOver: boolean;
    winner: string | null;
  };
  players: {
    playerId: string;
    life: number;
    handSize: number;
    librarySize: number;
    graveyardSize: number;
    battlefieldSize: number;
    manaPool: Record<string, number>;
  }[];
  recentActions: string[];
  legalActions: string[];
}

export class SnapshotWriter {
  private snapshotDir: string;

  constructor(snapshotDir?: string) {
    this.snapshotDir = snapshotDir || DEFAULT_SNAPSHOT_DIR;
  }

  /**
   * Write error snapshot in both text and JSON formats
   */
  async writeSnapshot(
    gameNumber: number,
    error: GameError,
    verbose: boolean = false,
  ): Promise<{ textFile?: string; jsonFile?: string }> {
    // Ensure directory exists
    this.ensureSnapshotDir();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = `game-${gameNumber}-seed-${error.seed ?? 'random'}-${timestamp}`;

    const results: { textFile?: string; jsonFile?: string } = {};

    // Always write JSON (structured, for automation)
    try {
      const jsonPath = path.join(this.snapshotDir, `${baseName}.json`);
      const jsonSnapshot = this.generateJsonSnapshot(gameNumber, error);
      await Bun.write(jsonPath, JSON.stringify(jsonSnapshot, null, 2));
      results.jsonFile = jsonPath;
    } catch (err) {
      console.error('Failed to write JSON snapshot:', err);
    }

    // Write text format if verbose
    if (verbose) {
      try {
        const textPath = path.join(this.snapshotDir, `${baseName}.txt`);
        const textSnapshot = this.generateTextSnapshot(error.state, error.recentActions, error);
        const header = this.generateHeader(gameNumber, error.seed);
        await Bun.write(textPath, header + textSnapshot);
        results.textFile = textPath;
      } catch (err) {
        console.error('Failed to write text snapshot:', err);
      }
    }

    return results;
  }

  /**
   * Generate header with metadata
   */
  private generateHeader(gameNumber: number, seed: number | undefined): string {
    return [
      `Seed: ${seed ?? 'random'}`,
      `Game Number: ${gameNumber}`,
      `Timestamp: ${new Date().toISOString()}`,
      '',
    ].join('\n');
  }

  /**
   * Generate structured JSON snapshot
   */
  private generateJsonSnapshot(gameNumber: number, error: GameError): GameSnapshot {
    const state = error.state;

    return {
      version: '1.0',
      metadata: {
        seed: error.seed,
        gameNumber,
        timestamp: new Date().toISOString(),
      },
      error: {
        message: error.message,
        stack: error.stack,
      },
      gameState: {
        turn: state.turnCount,
        phase: state.phase,
        step: state.step,
        activePlayer: state.activePlayer,
        priorityPlayer: state.priorityPlayer,
        gameOver: state.gameOver,
        winner: state.winner,
      },
      players: ['player', 'opponent'].map((playerId) => {
        const player = state.players[playerId as 'player' | 'opponent'];
        return {
          playerId,
          life: player.life,
          handSize: player.hand.length,
          librarySize: player.library.length,
          graveyardSize: player.graveyard.length,
          battlefieldSize: player.battlefield.length,
          manaPool: {
            white: player.manaPool.white,
            blue: player.manaPool.blue,
            black: player.manaPool.black,
            red: player.manaPool.red,
            green: player.manaPool.green,
            colorless: player.manaPool.colorless,
          },
        };
      }),
      recentActions: error.recentActions.slice(-10).map((action) => describeAction(action, state)),
      legalActions: getLegalActions(state, state.priorityPlayer)
        .slice(0, 10)
        .map((action) => describeAction(action, state)),
    };
  }

  /**
   * Generate detailed text snapshot for console/file
   */
  generateTextSnapshot(state: GameState, recentActions: Action[], error: Error): string {
    const lines: string[] = [];

    lines.push('');
    lines.push('═'.repeat(80));
    lines.push('  ERROR STATE SNAPSHOT');
    lines.push('═'.repeat(80));
    lines.push('');

    // Error details
    lines.push('ERROR:');
    lines.push(`  ${error.message}`);
    lines.push('');

    // Game state summary
    lines.push('GAME STATE:');
    lines.push(`  Turn: ${state.turnCount}`);
    lines.push(`  Phase: ${state.phase}`);
    lines.push(`  Step: ${state.step || 'N/A'}`);
    lines.push(`  Active Player: ${state.activePlayer}`);
    lines.push(`  Priority Player: ${state.priorityPlayer}`);
    lines.push(`  Game Over: ${state.gameOver}`);
    lines.push(`  Winner: ${state.winner || 'none'}`);
    lines.push('');

    // Player states
    for (const playerId of ['player', 'opponent'] as const) {
      const player = state.players[playerId];
      lines.push(`${playerId.toUpperCase()}:`);
      lines.push(`  Life: ${player.life}`);
      lines.push(`  Hand: ${player.hand.length} cards`);
      lines.push(`  Library: ${player.library.length} cards`);
      lines.push(`  Graveyard: ${player.graveyard.length} cards`);
      lines.push(`  Battlefield: ${player.battlefield.length} permanents`);

      // List battlefield permanents
      if (player.battlefield.length > 0) {
        lines.push('    Permanents:');
        for (const card of player.battlefield) {
          const template = CardLoader.getById(card.scryfallId);
          const name = template?.name || 'Unknown';
          const status: string[] = [];
          if (card.tapped) status.push('tapped');
          if (card.attacking) status.push('attacking');
          if (card.blocking) status.push('blocking');
          if (card.summoningSick) status.push('sick');
          const statusStr = status.length > 0 ? ` (${status.join(', ')})` : '';
          lines.push(`      - ${name}${statusStr}`);
        }
      }

      // Mana pool
      const mana = player.manaPool;
      const manaStr = [
        mana.white > 0 ? `${mana.white}W` : '',
        mana.blue > 0 ? `${mana.blue}U` : '',
        mana.black > 0 ? `${mana.black}B` : '',
        mana.red > 0 ? `${mana.red}R` : '',
        mana.green > 0 ? `${mana.green}G` : '',
        mana.colorless > 0 ? `${mana.colorless}C` : '',
      ]
        .filter(Boolean)
        .join(' ');
      lines.push(`  Mana Pool: ${manaStr || 'empty'}`);
      lines.push('');
    }

    // Stack
    if (state.stack.length > 0) {
      lines.push('STACK:');
      for (const item of state.stack) {
        const template = CardLoader.getById(item.card.scryfallId);
        lines.push(`  - ${template?.name || 'Unknown'} (controller: ${item.controller})`);
      }
      lines.push('');
    }

    // Recent actions
    if (recentActions.length > 0) {
      lines.push('RECENT ACTIONS (last 10):');
      const actionsToShow = recentActions.slice(-10);
      for (let i = 0; i < actionsToShow.length; i++) {
        const action = actionsToShow[i]!;
        const desc = describeAction(action, state);
        lines.push(`  ${i + 1}. [${action.playerId}] ${desc}`);
      }
      lines.push('');
    }

    // Legal actions at time of error
    lines.push('LEGAL ACTIONS FOR PRIORITY PLAYER:');
    const legalActions = getLegalActions(state, state.priorityPlayer);
    if (legalActions.length === 0) {
      lines.push('  (NONE - this is the problem!)');
    } else {
      for (const action of legalActions.slice(0, 10)) {
        lines.push(`  - ${describeAction(action, state)}`);
      }
      if (legalActions.length > 10) {
        lines.push(`  ... and ${legalActions.length - 10} more`);
      }
    }
    lines.push('');

    lines.push('═'.repeat(80));

    return lines.join('\n');
  }

  /**
   * Ensure snapshot directory exists
   */
  private ensureSnapshotDir(): void {
    try {
      if (!fs.existsSync(this.snapshotDir)) {
        fs.mkdirSync(this.snapshotDir, { recursive: true });
        console.log(`📁 Created snapshot directory: ${path.relative(process.cwd(), this.snapshotDir)}/`);
      }
    } catch (err) {
      console.error('Failed to create snapshot directory:', err);
    }
  }
}
