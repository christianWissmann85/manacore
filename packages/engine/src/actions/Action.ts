/**
 * Game Actions - all game progression happens through these
 *
 * Phase 0 actions (simplified rules):
 * - PLAY_LAND: Put a land onto the battlefield
 * - CAST_SPELL: Cast a creature (sorcery speed only)
 * - DECLARE_ATTACKERS: Choose creatures to attack
 * - DECLARE_BLOCKERS: Attacker chooses blockers (simplified for Phase 0)
 * - PASS_PRIORITY: Pass priority to opponent
 * - END_TURN: End the current turn
 */

import type { PlayerId } from '../state/Zone';

/**
 * Base action interface
 */
export interface GameAction {
  type: string;
  playerId: PlayerId;
}

/**
 * Play a land from hand
 */
export interface PlayLandAction extends GameAction {
  type: 'PLAY_LAND';
  payload: {
    cardInstanceId: string; // Card in hand to play
  };
}

/**
 * Cast a spell from hand
 * Phase 0: Only sorcery-speed spells (creatures, sorceries)
 */
export interface CastSpellAction extends GameAction {
  type: 'CAST_SPELL';
  payload: {
    cardInstanceId: string; // Card in hand to cast
    targets?: string[]; // Target instance IDs (for targeted spells)
    xValue?: number; // For spells with {X} in cost (e.g., Fireball)
  };
}

/**
 * Declare attackers
 */
export interface DeclareAttackersAction extends GameAction {
  type: 'DECLARE_ATTACKERS';
  payload: {
    attackers: string[]; // Instance IDs of creatures attacking
  };
}

/**
 * Declare blockers
 * Phase 0: Simplified - attacker chooses which creatures block
 */
export interface DeclareBlockersAction extends GameAction {
  type: 'DECLARE_BLOCKERS';
  payload: {
    blocks: Array<{
      blockerId: string; // Creature doing the blocking
      attackerId: string; // Creature being blocked
    }>;
  };
}

/**
 * Pass priority to opponent
 */
export interface PassPriorityAction extends GameAction {
  type: 'PASS_PRIORITY';
  payload: {};
}

/**
 * End the turn
 */
export interface EndTurnAction extends GameAction {
  type: 'END_TURN';
  payload: {};
}

/**
 * Draw a card (automatic, triggered by game rules)
 */
export interface DrawCardAction extends GameAction {
  type: 'DRAW_CARD';
  payload: {
    count?: number; // Default 1
  };
}

/**
 * Untap permanents (automatic)
 */
export interface UntapAction extends GameAction {
  type: 'UNTAP';
  payload: {};
}

/**
 * Activate an ability
 */
export interface ActivateAbilityAction extends GameAction {
  type: 'ACTIVATE_ABILITY';
  payload: {
    sourceId: string; // Card with the ability
    abilityId: string; // Which ability to activate
    targets?: string[]; // Targets for the ability
    manaColorChoice?: 'W' | 'U' | 'B' | 'R' | 'G' | 'C'; // For multi-color mana abilities
    xValue?: number; // For abilities with X in cost
  };
}

/**
 * Sacrifice a permanent (as a cost or effect)
 */
export interface SacrificePermanentAction extends GameAction {
  type: 'SACRIFICE_PERMANENT';
  payload: {
    permanentId: string; // Permanent to sacrifice
    reason?: 'cost' | 'effect' | 'state_based'; // Why it's being sacrificed
  };
}

/**
 * Union of all action types
 */
export type Action =
  | PlayLandAction
  | CastSpellAction
  | DeclareAttackersAction
  | DeclareBlockersAction
  | PassPriorityAction
  | EndTurnAction
  | DrawCardAction
  | UntapAction
  | ActivateAbilityAction
  | SacrificePermanentAction;

/**
 * Type guard helpers
 */
export function isPlayLandAction(action: Action): action is PlayLandAction {
  return action.type === 'PLAY_LAND';
}

export function isCastSpellAction(action: Action): action is CastSpellAction {
  return action.type === 'CAST_SPELL';
}

export function isDeclareAttackersAction(action: Action): action is DeclareAttackersAction {
  return action.type === 'DECLARE_ATTACKERS';
}

export function isDeclareBlockersAction(action: Action): action is DeclareBlockersAction {
  return action.type === 'DECLARE_BLOCKERS';
}

export function isSacrificePermanentAction(action: Action): action is SacrificePermanentAction {
  return action.type === 'SACRIFICE_PERMANENT';
}
