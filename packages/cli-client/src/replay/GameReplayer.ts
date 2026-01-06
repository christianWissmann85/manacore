/**
 * GameReplayer - Replays recorded games
 *
 * Loads replay files and steps through games action by action,
 * reconstructing the exact game state at any point.
 */

import { readFileSync, existsSync } from 'fs';
import type { GameState, Action, CardTemplate } from '@manacore/engine';
import {
  initializeGame,
  applyAction,
  validateAction,
  getTestDeck,
  CardLoader,
  _resetInstanceCounter,
  _resetModificationCounter,
  ALL_TEST_DECKS,
} from '@manacore/engine';
import type { ReplayFile, ReplayOptions, ReplaySnapshot } from '../types';
import { REPLAY_VERSION } from './ReplayRecorder';

/**
 * Result of replaying a game
 */
export interface ReplayResult {
  /** Final game state after replay */
  finalState: GameState;

  /** All intermediate states (if requested) */
  states?: GameState[];

  /** Snapshots at each action */
  snapshots?: ReplaySnapshot[];

  /** Whether replay matched expected outcome */
  outcomeMatched: boolean;

  /** Any errors encountered */
  errors: string[];
}

/**
 * Loads a replay file from disk
 */
export function loadReplay(filepath: string): ReplayFile {
  if (!existsSync(filepath)) {
    throw new Error(`Replay file not found: ${filepath}`);
  }

  const content = readFileSync(filepath, 'utf-8');
  const replay = JSON.parse(content) as ReplayFile;

  // Version check
  if (replay.version !== REPLAY_VERSION) {
    console.warn(
      `Replay version mismatch: file is v${replay.version}, current is v${REPLAY_VERSION}`,
    );
  }

  return replay;
}

/**
 * Get deck cards from a replay deck specification
 */
function getDeckFromSpec(spec: { name: string; cards?: string[] }): CardTemplate[] {
  // If custom cards are provided, load them by ID
  if (spec.cards && spec.cards.length > 0) {
    return spec.cards.map((cardId) => {
      const card = CardLoader.getById(cardId);
      if (!card) {
        throw new Error(`Card not found: ${cardId}`);
      }
      return card;
    });
  }

  // Otherwise, try to load by deck name
  const deckName = spec.name as keyof typeof ALL_TEST_DECKS;
  if (deckName in ALL_TEST_DECKS) {
    return getTestDeck(deckName);
  }

  throw new Error(`Unknown deck: ${spec.name}. Provide card IDs or use a known test deck name.`);
}

/**
 * Create a snapshot of the current game state
 */
function createSnapshot(state: GameState, actionIndex: number): ReplaySnapshot {
  return {
    turn: state.turnCount,
    phase: state.phase,
    actionIndex,
    playerLife: state.players.player.life,
    opponentLife: state.players.opponent.life,
    playerHandSize: state.players.player.hand.length,
    opponentHandSize: state.players.opponent.hand.length,
    playerBoardSize: state.players.player.battlefield.length,
    opponentBoardSize: state.players.opponent.battlefield.length,
  };
}

/**
 * Replay a game from a replay file
 */
export function replayGame(replay: ReplayFile, options: ReplayOptions = {}): ReplayResult {
  const errors: string[] = [];
  const states: GameState[] = [];
  const snapshots: ReplaySnapshot[] = [];

  // Reset counters for determinism
  _resetInstanceCounter();
  _resetModificationCounter();

  // Load decks
  let playerDeck: CardTemplate[];
  let opponentDeck: CardTemplate[];

  try {
    playerDeck = getDeckFromSpec(replay.decks.player);
    opponentDeck = getDeckFromSpec(replay.decks.opponent);
  } catch (e) {
    return {
      finalState: null as unknown as GameState,
      outcomeMatched: false,
      errors: [`Failed to load decks: ${e instanceof Error ? e.message : String(e)}`],
    };
  }

  // Initialize game with the recorded seed
  let state = initializeGame(playerDeck, opponentDeck, replay.seeds.game);

  // Record initial state
  if (options.onAction) {
    snapshots.push(createSnapshot(state, -1));
  }

  // Apply each action
  const actions = replay.actions as Action[];
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]!;

    // Check stop conditions
    if (options.stopAtAction !== undefined && i >= options.stopAtAction) {
      break;
    }
    if (options.stopAtTurn !== undefined && state.turnCount > options.stopAtTurn) {
      break;
    }

    // Validate action if requested
    if (options.validateActions) {
      const validationErrors = validateAction(state, action);
      if (validationErrors.length > 0) {
        errors.push(`Action ${i}: ${validationErrors.join(', ')}`);
        // Continue anyway to see how far we get
      }
    }

    // Apply action
    try {
      state = applyAction(state, action);
    } catch (e) {
      errors.push(`Action ${i} failed: ${e instanceof Error ? e.message : String(e)}`);
      break;
    }

    // Record snapshot
    const snapshot = createSnapshot(state, i);
    snapshots.push(snapshot);

    // Callback
    if (options.onAction) {
      options.onAction(i, action, snapshot);
    }

    // Check if game ended
    if (state.gameOver) {
      break;
    }
  }

  // Check if outcome matches
  const outcomeMatched =
    state.winner === replay.outcome.winner && state.turnCount === replay.outcome.turns;

  if (!outcomeMatched && errors.length === 0) {
    errors.push(
      `Outcome mismatch: expected ${replay.outcome.winner} to win in ${replay.outcome.turns} turns, ` +
        `got ${state.winner} in ${state.turnCount} turns`,
    );
  }

  return {
    finalState: state,
    states: states.length > 0 ? states : undefined,
    snapshots: snapshots.length > 0 ? snapshots : undefined,
    outcomeMatched,
    errors,
  };
}

/**
 * Replay to a specific turn and return the state
 */
export function replayToTurn(replay: ReplayFile, targetTurn: number): GameState {
  const result = replayGame(replay, { stopAtTurn: targetTurn });
  return result.finalState;
}

/**
 * Replay to a specific action index and return the state
 */
export function replayToAction(replay: ReplayFile, actionIndex: number): GameState {
  const result = replayGame(replay, { stopAtAction: actionIndex });
  return result.finalState;
}

/**
 * Get all states from a replay (memory intensive for long games)
 */
export function getReplayStates(replay: ReplayFile): GameState[] {
  const allStates: GameState[] = [];

  // Reset counters for determinism
  _resetInstanceCounter();
  _resetModificationCounter();

  // Load decks
  const playerDeck = getDeckFromSpec(replay.decks.player);
  const opponentDeck = getDeckFromSpec(replay.decks.opponent);

  // Initialize and record initial state
  let state = initializeGame(playerDeck, opponentDeck, replay.seeds.game);
  allStates.push(structuredClone(state));

  // Apply each action and record state
  const actions = replay.actions as Action[];
  for (const action of actions) {
    try {
      state = applyAction(state, action);
      allStates.push(structuredClone(state));
    } catch {
      break;
    }

    if (state.gameOver) {
      break;
    }
  }

  return allStates;
}

/**
 * Verify a replay file is valid and can be replayed
 */
export function verifyReplay(replay: ReplayFile): { valid: boolean; errors: string[] } {
  const result = replayGame(replay, { validateActions: true });

  return {
    valid: result.outcomeMatched && result.errors.length === 0,
    errors: result.errors,
  };
}

/**
 * Get summary information about a replay
 */
export function getReplaySummary(replay: ReplayFile): {
  version: string;
  timestamp: string;
  seed: number;
  playerDeck: string;
  opponentDeck: string;
  winner: string;
  turns: number;
  actionCount: number;
  reason: string;
} {
  return {
    version: replay.version,
    timestamp: replay.metadata.timestamp,
    seed: replay.seeds.game,
    playerDeck: replay.decks.player.name,
    opponentDeck: replay.decks.opponent.name,
    winner: replay.outcome.winner ?? 'draw',
    turns: replay.outcome.turns,
    actionCount: replay.actions.length,
    reason: replay.outcome.reason,
  };
}
