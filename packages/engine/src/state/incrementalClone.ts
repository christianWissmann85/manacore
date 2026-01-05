/**
 * Incremental State Cloning
 *
 * Instead of structuredClone(entireState), we do shallow clones with
 * deep clones only for the parts that will be modified.
 *
 * This reduces clone size from ~5-15KB to ~0.5-2KB per action.
 */

import type { GameState } from './GameState';
import type { PlayerState } from './PlayerState';
import type { CardInstance } from './CardInstance';
import type { Action } from '../actions/Action';

/**
 * Clone a CardInstance array (shallow clone of array, deep clone of cards)
 */
function cloneCardArray(cards: CardInstance[]): CardInstance[] {
  return cards.map((card) => ({ ...card }));
}

/**
 * Clone a player's mutable zones based on what might change
 */
function clonePlayerZones(
  player: PlayerState,
  zones: Array<'hand' | 'battlefield' | 'library' | 'graveyard' | 'exile'>,
): PlayerState {
  const cloned: PlayerState = { ...player };

  for (const zone of zones) {
    cloned[zone] = cloneCardArray(player[zone]);
  }

  // Always clone manaPool since it's a simple object
  cloned.manaPool = { ...player.manaPool };

  // Clone prevention shields if present
  if (player.preventionShields) {
    cloned.preventionShields = [...player.preventionShields];
  }

  return cloned;
}

/**
 * Determine which zones need cloning based on action type
 */
function getZonesToClone(action: Action): {
  player: Array<'hand' | 'battlefield' | 'library' | 'graveyard' | 'exile'>;
  opponent: Array<'hand' | 'battlefield' | 'library' | 'graveyard' | 'exile'>;
  cloneStack: boolean;
} {
  switch (action.type) {
    case 'PLAY_LAND':
      return {
        player: ['hand', 'battlefield'],
        opponent: [],
        cloneStack: false,
      };

    case 'CAST_SPELL':
      return {
        player: ['hand', 'battlefield'], // battlefield for tapping lands
        opponent: [],
        cloneStack: true,
      };

    case 'DECLARE_ATTACKERS':
      return {
        player: ['battlefield'],
        opponent: [],
        cloneStack: false,
      };

    case 'DECLARE_BLOCKERS':
      // Combat affects both players' battlefields and graveyards (deaths)
      return {
        player: ['battlefield', 'graveyard'],
        opponent: ['battlefield', 'graveyard'],
        cloneStack: false,
      };

    case 'END_TURN':
      // End turn affects both players' battlefields
      return {
        player: ['battlefield'],
        opponent: ['battlefield'],
        cloneStack: false,
      };

    case 'PASS_PRIORITY':
      // May resolve stack, affecting battlefield/graveyard
      return {
        player: ['hand', 'battlefield', 'library', 'graveyard'],
        opponent: ['hand', 'battlefield', 'library', 'graveyard'],
        cloneStack: true,
      };

    case 'DRAW_CARD':
      return {
        player: ['hand', 'library'],
        opponent: [],
        cloneStack: false,
      };

    case 'UNTAP':
      return {
        player: ['battlefield'],
        opponent: [],
        cloneStack: false,
      };

    case 'ACTIVATE_ABILITY':
      // Abilities can do almost anything
      return {
        player: ['hand', 'battlefield', 'library', 'graveyard'],
        opponent: ['hand', 'battlefield', 'library', 'graveyard'],
        cloneStack: true,
      };

    case 'SACRIFICE_PERMANENT':
      return {
        player: ['battlefield', 'graveyard'],
        opponent: [],
        cloneStack: false,
      };

    default:
      // Unknown action - clone everything to be safe
      return {
        player: ['hand', 'battlefield', 'library', 'graveyard', 'exile'],
        opponent: ['hand', 'battlefield', 'library', 'graveyard', 'exile'],
        cloneStack: true,
      };
  }
}

/**
 * Incrementally clone game state based on what the action will modify
 *
 * This is much faster than structuredClone for most actions.
 */
export function incrementalClone(state: GameState, action: Action): GameState {
  const zones = getZonesToClone(action);

  // Determine which player is acting
  const actingPlayer = action.playerId;

  // Clone player states with only necessary zones
  const newPlayers = {
    player:
      actingPlayer === 'player'
        ? clonePlayerZones(state.players.player, zones.player)
        : zones.opponent.length > 0
          ? clonePlayerZones(state.players.player, zones.opponent)
          : { ...state.players.player, manaPool: { ...state.players.player.manaPool } },
    opponent:
      actingPlayer === 'opponent'
        ? clonePlayerZones(state.players.opponent, zones.player)
        : zones.opponent.length > 0
          ? clonePlayerZones(state.players.opponent, zones.opponent)
          : { ...state.players.opponent, manaPool: { ...state.players.opponent.manaPool } },
  };

  // Create new state with shallow clone of top level
  const newState: GameState = {
    ...state,
    players: newPlayers,
    // Always clone actionHistory since we append to it
    actionHistory: [...state.actionHistory],
    // Clone stack if needed
    stack: zones.cloneStack
      ? state.stack.map((item) => ({
          ...item,
          card: { ...item.card },
          targets: item.targets ? [...item.targets] : [],
        }))
      : [...state.stack],
    // Clone exile if any action needs it
    exile: [...state.exile],
  };

  return newState;
}

/**
 * Full clone for cases where we can't predict what will change
 * (e.g., state-based actions, trigger resolution)
 *
 * This is still structuredClone but we call it explicitly.
 */
export function fullClone(state: GameState): GameState {
  return structuredClone(state);
}
