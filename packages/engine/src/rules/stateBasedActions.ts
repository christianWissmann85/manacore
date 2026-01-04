/**
 * State-Based Actions (SBAs)
 *
 * These are automatic game rules that are checked whenever a player
 * would receive priority. They happen immediately and don't use the stack.
 *
 * Phase 1 SBAs:
 * - Creatures with damage >= toughness die
 * - Creatures with toughness <= 0 die
 * - Players with life <= 0 lose the game
 */

import type { GameState } from '../state/GameState';
import { CardLoader } from '../cards/CardLoader';
import { isCreature } from '../cards/CardTemplate';

/**
 * Check and perform all state-based actions
 * Returns true if any SBAs were performed (may need to check again)
 */
export function checkStateBasedActions(state: GameState): boolean {
  let actionsPerformed = false;

  // Check for player death
  actionsPerformed = checkPlayerDeath(state) || actionsPerformed;

  // Check for creature death
  actionsPerformed = checkCreatureDeath(state) || actionsPerformed;

  return actionsPerformed;
}

/**
 * Check if any player has lost the game
 */
function checkPlayerDeath(state: GameState): boolean {
  let actionsPerformed = false;

  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];

    if (player.life <= 0 && !state.gameOver) {
      state.gameOver = true;
      state.winner = playerId === 'player' ? 'opponent' : 'player';
      actionsPerformed = true;
    }
  }

  return actionsPerformed;
}

/**
 * Check for creatures that should die
 * Returns true if any creatures died
 */
function checkCreatureDeath(state: GameState): boolean {
  let actionsPerformed = false;

  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];

    // Check each creature on battlefield (iterate backwards for safe removal)
    for (let i = player.battlefield.length - 1; i >= 0; i--) {
      const creature = player.battlefield[i]!;
      const template = CardLoader.getById(creature.scryfallId);

      if (!template) continue;

      // Only check creature death for actual creatures
      if (!isCreature(template)) continue;

      const toughness = parseInt(template.toughness || '0', 10);

      // SBA: Creature dies if damage >= toughness
      // SBA: Creature dies if toughness <= 0 (from effects)
      if (creature.damage >= toughness || toughness <= 0) {
        // Remove from battlefield
        player.battlefield.splice(i, 1);

        // Put in graveyard
        creature.zone = 'graveyard';
        creature.damage = 0;
        creature.tapped = false;
        creature.attacking = false;
        creature.blocking = undefined;
        creature.blockedBy = undefined;
        player.graveyard.push(creature);

        actionsPerformed = true;

        // TODO Phase 1: Trigger death triggers here
      }
    }
  }

  return actionsPerformed;
}
