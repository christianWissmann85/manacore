/**
 * Bot interface - all AI bots must implement this
 */

import type { GameState, Action, PlayerId } from '@manacore/engine';

export interface Bot {
  /**
   * Choose an action for the current game state
   *
   * @param state - Current game state
   * @param playerId - Which player this bot is playing as
   * @returns The action to take
   */
  chooseAction(state: GameState, playerId: PlayerId): Action;

  /**
   * Bot name (for display)
   */
  getName(): string;

  /**
   * Bot description
   */
  getDescription(): string;
}
