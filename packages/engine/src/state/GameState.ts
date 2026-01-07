/**
 * Complete game state - the single source of truth
 *
 * This is the root of all game data. Everything flows through
 * transformations of this immutable state.
 */

import type { PlayerState } from './PlayerState';
import type { CardInstance } from './CardInstance';
import type { PlayerId, GamePhase, GameStep } from './Zone';
import { createPlayerState } from './PlayerState';

/**
 * Object on the stack (spell or ability)
 */
export interface StackObject {
  id: string;
  controller: PlayerId;
  card: CardInstance; // The spell being cast
  targets: string[]; // Instance IDs of targets
  resolved: boolean; // Has this resolved?
  countered: boolean; // Was this countered?
  xValue?: number; // For spells with {X} in cost (e.g., Fireball)
}

/**
 * The complete game state
 */
export interface GameState {
  // Players
  players: {
    player: PlayerState;
    opponent: PlayerState;
  };

  // Shared zones
  stack: StackObject[];
  exile: CardInstance[]; // Shared exile zone

  // Game flow
  activePlayer: PlayerId; // Whose turn it is
  priorityPlayer: PlayerId; // Who has priority
  turnCount: number;
  phase: GamePhase;
  step: GameStep;

  // Game status
  gameOver: boolean;
  winner: PlayerId | null;

  // Determinism (for replays and AI)
  rngSeed: number;

  // History (for undo/debugging)
  actionHistory: string[]; // JSON of actions applied

  // Prevention effects (Phase 1.5.1)
  preventAllCombatDamage?: boolean; // Fog effect

  // F6 Auto-Pass (Phase 2.5)
  // When enabled, the engine automatically passes priority for players with no meaningful actions.
  // This eliminates forced non-decisions and speeds up AI simulations (MCTS, GreedyBot).
  // Disabled by default to maintain backward compatibility with tests.
  enableF6AutoPass?: boolean;
}

/**
 * Create initial game state
 */
export function createGameState(
  playerLibrary: CardInstance[],
  opponentLibrary: CardInstance[],
  seed: number = Date.now(),
): GameState {
  // Import is at top of file
  return {
    players: {
      player: createPlayerState('player', playerLibrary),
      opponent: createPlayerState('opponent', opponentLibrary),
    },
    stack: [],
    exile: [],
    activePlayer: 'player',
    priorityPlayer: 'player',
    turnCount: 1,
    phase: 'beginning',
    step: 'untap',
    gameOver: false,
    winner: null,
    rngSeed: seed,
    actionHistory: [],
  };
}

/**
 * Get a player's state
 */
export function getPlayer(state: GameState, playerId: PlayerId): PlayerState {
  return state.players[playerId];
}

/**
 * Get the opponent of a player
 */
export function getOpponent(state: GameState, playerId: PlayerId): PlayerState {
  return playerId === 'player' ? state.players.opponent : state.players.player;
}

/**
 * Enable F6 Auto-Pass mode for AI efficiency
 *
 * When enabled, the engine automatically passes priority for players with no meaningful actions.
 * This eliminates forced non-decisions (70% of total actions in typical games) and speeds up:
 * - MCTS simulations (smaller game trees)
 * - GreedyBot evaluation (fewer decisions to evaluate)
 * - General gameplay (less waiting for "pass priority")
 *
 * @param state - Game state to modify
 * @param enabled - Whether to enable F6 mode (default: true)
 */
export function enableF6Mode(state: GameState, enabled: boolean = true): void {
  state.enableF6AutoPass = enabled;
}

/**
 * Find a card instance by ID across all zones
 */
export function findCard(state: GameState, instanceId: string): CardInstance | null {
  for (const player of Object.values(state.players)) {
    for (const zone of [
      player.library,
      player.hand,
      player.battlefield,
      player.graveyard,
      player.exile,
    ]) {
      const card = zone.find((c) => c.instanceId === instanceId);
      if (card) return card;
    }
  }

  // Check stack
  for (const stackObj of state.stack) {
    if (stackObj.card?.instanceId === instanceId) {
      return stackObj.card;
    }
  }

  return null;
}
