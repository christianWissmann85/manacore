/**
 * Type definitions for the spell implementation system
 *
 * This module defines the interface for spell implementations,
 * allowing card-specific spell effects to be registered and
 * looked up efficiently.
 */

import type { GameState, StackObject } from '../state/GameState';

/**
 * Spell implementation for a specific card
 *
 * Each spell implementation provides a resolve function that
 * applies the spell's effects when it resolves from the stack.
 */
export interface SpellImplementation {
  /**
   * Card name (must match CardTemplate.name exactly)
   */
  cardName: string;

  /**
   * Resolve the spell's effects
   *
   * This function is called when the spell resolves from the stack.
   * It receives the current game state (mutable) and the stack object
   * containing targeting information.
   *
   * @param state - Current game state (mutable - apply effects directly)
   * @param stackObj - The stack object being resolved (contains targets, xValue, etc.)
   */
  resolve: (state: GameState, stackObj: StackObject) => void;

  /**
   * Optional: Custom fizzle logic
   *
   * If provided, this function determines whether the spell should fizzle
   * instead of resolving. If omitted, uses default targeting-based fizzle check.
   *
   * @param state - Current game state
   * @param stackObj - The stack object to check
   * @returns true if the spell should fizzle, false otherwise
   */
  shouldFizzle?: (state: GameState, stackObj: StackObject) => boolean;
}

/**
 * Factory function type for creating spell implementations
 *
 * Used for spells that need dynamic behavior based on game state.
 */
export type SpellFactory = (state: GameState, stackObj: StackObject) => SpellImplementation;
