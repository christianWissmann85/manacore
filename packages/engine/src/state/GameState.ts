/**
 * Complete game state - the single source of truth
 *
 * This is the root of all game data. Everything flows through
 * transformations of this immutable state.
 */

import type { PlayerState } from './PlayerState';
import type { CardInstance } from './CardInstance';
import type { PlayerId, GamePhase, GameStep } from './Zone';

/**
 * Object on the stack (spell or ability)
 */
export interface StackObject {
  id: string;
  controller: PlayerId;
  card: CardInstance;      // The spell being cast
  targets: string[];       // Instance IDs of targets
  resolved: boolean;       // Has this resolved?
  countered: boolean;      // Was this countered?
  xValue?: number;         // For spells with {X} in cost (e.g., Fireball)
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
  exile: CardInstance[];  // Shared exile zone

  // Game flow
  activePlayer: PlayerId;      // Whose turn it is
  priorityPlayer: PlayerId;    // Who has priority
  turnCount: number;
  phase: GamePhase;
  step: GameStep;

  // Game status
  gameOver: boolean;
  winner: PlayerId | null;

  // Determinism (for replays and AI)
  rngSeed: number;

  // History (for undo/debugging)
  actionHistory: string[];  // JSON of actions applied

  // Prevention effects (Phase 1.5.1)
  preventAllCombatDamage?: boolean;  // Fog effect
}

/**
 * Create initial game state
 */
export function createGameState(
  playerLibrary: CardInstance[],
  opponentLibrary: CardInstance[],
  seed: number = Date.now(),
): GameState {
  const { createPlayerState } = require('./PlayerState');

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
      const card = zone.find(c => c.instanceId === instanceId);
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
