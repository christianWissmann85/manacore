/**
 * ReplayRecorder - Records game actions for replay
 *
 * Captures all information needed to deterministically replay a game:
 * - Seeds for deck shuffling and card instance generation
 * - Deck configurations
 * - Complete action sequence
 * - Game outcome
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import type { GameState, Action, PlayerId } from '@manacore/engine';
import { ENGINE_VERSION } from '@manacore/engine';
import type { ReplayFile, ReplayDeckSpec, ReplayOutcome } from '../types';

/** Current replay file format version */
export const REPLAY_VERSION = '1.0';

/**
 * Configuration for recording a game
 */
export interface RecordingConfig {
  /** Game seed used for deck shuffling */
  gameSeed: number;

  /** Deck specifications */
  decks: {
    player: ReplayDeckSpec;
    opponent: ReplayDeckSpec;
  };

  /** Optional bot information */
  bots?: {
    player?: { type: string; seed?: number };
    opponent?: { type: string; seed?: number };
  };

  /** Optional description */
  description?: string;

  /** Instance counter starting value (default: 0) */
  instanceCounterStart?: number;
}

/**
 * Records a game for replay
 */
export class ReplayRecorder {
  private config: RecordingConfig;
  private actions: Action[] = [];
  private startTime: Date;
  private outcome: ReplayOutcome | null = null;

  constructor(config: RecordingConfig) {
    this.config = config;
    this.startTime = new Date();
  }

  /**
   * Record an action
   */
  recordAction(action: Action): void {
    this.actions.push(action);
  }

  /**
   * Record multiple actions (e.g., from GameState.actionHistory)
   */
  recordActions(actions: Action[]): void {
    this.actions.push(...actions);
  }

  /**
   * Record actions from a GameState's action history
   */
  recordFromState(state: GameState): void {
    // Parse JSON strings from action history
    for (const actionJson of state.actionHistory) {
      try {
        const action = JSON.parse(actionJson) as Action;
        this.actions.push(action);
      } catch {
        console.warn(`Failed to parse action: ${actionJson}`);
      }
    }
  }

  /**
   * Set the game outcome
   */
  setOutcome(
    winner: PlayerId | null,
    turns: number,
    reason: ReplayOutcome['reason'],
    finalLife?: { player: number; opponent: number },
  ): void {
    this.outcome = { winner, turns, reason, finalLife };
  }

  /**
   * Set outcome from final GameState
   */
  setOutcomeFromState(state: GameState): void {
    let reason: ReplayOutcome['reason'] = 'life';

    // Determine reason for game end
    if (state.players.player.life <= 0 || state.players.opponent.life <= 0) {
      reason = 'life';
    } else if (
      state.players.player.library.length === 0 ||
      state.players.opponent.library.length === 0
    ) {
      reason = 'decked';
    }

    this.outcome = {
      winner: state.winner,
      turns: state.turnCount,
      reason,
      finalLife: {
        player: state.players.player.life,
        opponent: state.players.opponent.life,
      },
    };
  }

  /**
   * Get the number of recorded actions
   */
  getActionCount(): number {
    return this.actions.length;
  }

  /**
   * Build the replay file object
   */
  build(): ReplayFile {
    if (!this.outcome) {
      throw new Error('Cannot build replay: outcome not set. Call setOutcome() first.');
    }

    return {
      version: REPLAY_VERSION,
      metadata: {
        timestamp: this.startTime.toISOString(),
        engineVersion: ENGINE_VERSION,
        description: this.config.description,
      },
      seeds: {
        game: this.config.gameSeed,
        instanceCounter: this.config.instanceCounterStart ?? 0,
      },
      decks: this.config.decks,
      bots: this.config.bots,
      actions: this.actions,
      outcome: this.outcome,
    };
  }

  /**
   * Save replay to a file
   */
  save(filepath: string): void {
    const replay = this.build();

    // Ensure directory exists
    const dir = dirname(filepath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Write with pretty formatting for readability
    writeFileSync(filepath, JSON.stringify(replay, null, 2), 'utf-8');
  }

  /**
   * Generate a default filename for this replay
   */
  generateFilename(): string {
    const timestamp = this.startTime.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const seed = this.config.gameSeed;
    const winner = this.outcome?.winner ?? 'draw';
    return `game-${seed}-${winner}-${timestamp}.replay.json`;
  }
}

/**
 * Quick helper to create a replay from a completed game
 */
export function createReplayFromGame(
  state: GameState,
  config: Omit<RecordingConfig, 'gameSeed'>,
): ReplayFile {
  const recorder = new ReplayRecorder({
    ...config,
    gameSeed: state.rngSeed,
  });

  recorder.recordFromState(state);
  recorder.setOutcomeFromState(state);

  return recorder.build();
}

/**
 * Save a replay file to disk
 */
export function saveReplay(replay: ReplayFile, filepath: string): void {
  const dir = dirname(filepath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(filepath, JSON.stringify(replay, null, 2), 'utf-8');
}
