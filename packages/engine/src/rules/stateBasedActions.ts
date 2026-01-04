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
import type { CardInstance } from '../state/CardInstance';
import { getEffectiveToughness } from '../state/CardInstance';
import { CardLoader } from '../cards/CardLoader';
import { isCreature, isAura } from '../cards/CardTemplate';

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

  // Check for unattached auras
  actionsPerformed = checkUnattachedAuras(state) || actionsPerformed;

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

      const baseToughness = parseInt(template.toughness || '0', 10);
      const effectiveToughness = getEffectiveToughness(creature, baseToughness);

      // SBA: Creature dies if damage >= toughness
      // SBA: Creature dies if toughness <= 0 (from effects)
      if (creature.damage >= effectiveToughness || effectiveToughness <= 0) {
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

/**
 * Check for auras that are no longer attached to a valid permanent
 * Returns true if any auras went to graveyard
 */
function checkUnattachedAuras(state: GameState): boolean {
  let actionsPerformed = false;

  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];

    // Check each permanent on battlefield (iterate backwards for safe removal)
    for (let i = player.battlefield.length - 1; i >= 0; i--) {
      const permanent = player.battlefield[i]!;
      const template = CardLoader.getById(permanent.scryfallId);

      if (!template) continue;

      // Only check auras
      if (!isAura(template)) continue;

      // Check if aura is attached to something that's still on the battlefield
      const attachedToId = permanent.attachedTo;
      if (!attachedToId) {
        // Aura has no attachment - shouldn't happen, but handle it
        moveAuraToGraveyard(player, permanent, i);
        actionsPerformed = true;
        continue;
      }

      // Find the enchanted permanent
      let enchantedCreatureExists = false;
      for (const pid of ['player', 'opponent'] as const) {
        const battlefieldHasIt = state.players[pid].battlefield.some(
          c => c.instanceId === attachedToId
        );
        if (battlefieldHasIt) {
          enchantedCreatureExists = true;
          break;
        }
      }

      if (!enchantedCreatureExists) {
        // Enchanted creature is gone - aura goes to graveyard
        moveAuraToGraveyard(player, permanent, i);
        actionsPerformed = true;
      }
    }
  }

  return actionsPerformed;
}

/**
 * Helper to move an aura to graveyard
 */
function moveAuraToGraveyard(
  player: { battlefield: CardInstance[]; graveyard: CardInstance[] },
  aura: CardInstance,
  index: number
): void {
  player.battlefield.splice(index, 1);
  aura.zone = 'graveyard';
  aura.attachedTo = undefined;
  player.graveyard.push(aura);
}
