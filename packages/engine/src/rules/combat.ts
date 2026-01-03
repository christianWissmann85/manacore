/**
 * Combat damage assignment and resolution
 *
 * Handles:
 * - First Strike damage
 * - Normal combat damage
 * - Multiple blockers
 * - Trample
 * - State-based actions (creature death)
 */

import type { GameState, CardInstance } from '../state/GameState';
import type { CardTemplate } from '../cards/CardTemplate';
import { getPlayer } from '../state/GameState';
import { CardLoader } from '../cards/CardLoader';
import { hasFirstStrike, hasDoubleStrike, hasTrample } from '../cards/CardTemplate';

/**
 * Resolve all combat damage for the current combat
 */
export function resolveCombatDamage(state: GameState): void {
  // First Strike damage step
  assignCombatDamage(state, true);  // onlyFirstStrike = true
  checkCreatureDeath(state);

  // Normal damage step
  assignCombatDamage(state, false); // onlyFirstStrike = false
  checkCreatureDeath(state);
}

/**
 * Assign damage for one damage step
 */
function assignCombatDamage(state: GameState, onlyFirstStrike: boolean): void {
  const activePlayer = getPlayer(state, state.activePlayer);
  const defendingPlayerId = state.activePlayer === 'player' ? 'opponent' : 'player';
  const defendingPlayer = getPlayer(state, defendingPlayerId);

  // Process each attacker
  for (const attacker of activePlayer.battlefield) {
    if (!attacker.attacking) continue;

    const attackerTemplate = CardLoader.getById(attacker.scryfallId);
    if (!attackerTemplate) continue;

    const hasFirst = hasFirstStrike(attackerTemplate);
    const hasDouble = hasDoubleStrike(attackerTemplate);

    // Skip if this creature doesn't deal damage in this step
    if (onlyFirstStrike && !hasFirst && !hasDouble) continue;
    if (!onlyFirstStrike && hasFirst && !hasDouble) continue; // Already dealt damage

    const attackerPower = parseInt(attackerTemplate.power || '0', 10);

    // Check if blocked
    if (attacker.blockedBy && attacker.blockedBy.length > 0) {
      // Blocked - assign damage to blockers
      assignDamageToBlockers(state, attacker, attacker.blockedBy, attackerPower, attackerTemplate);
    } else {
      // Unblocked - damage goes to defending player
      defendingPlayer.life -= attackerPower;

      // Check for game over
      if (defendingPlayer.life <= 0) {
        state.gameOver = true;
        state.winner = state.activePlayer;
      }
    }
  }

  // Process each blocker dealing damage back
  for (const blocker of defendingPlayer.battlefield) {
    if (!blocker.blocking) continue;

    const blockerTemplate = CardLoader.getById(blocker.scryfallId);
    if (!blockerTemplate) continue;

    const hasFirst = hasFirstStrike(blockerTemplate);
    const hasDouble = hasDoubleStrike(blockerTemplate);

    // Skip if this creature doesn't deal damage in this step
    if (onlyFirstStrike && !hasFirst && !hasDouble) continue;
    if (!onlyFirstStrike && hasFirst && !hasDouble) continue;

    const blockerPower = parseInt(blockerTemplate.power || '0', 10);

    // Find the attacker being blocked
    const attacker = activePlayer.battlefield.find(c => c.instanceId === blocker.blocking);
    if (attacker) {
      attacker.damage += blockerPower;
    }
  }
}

/**
 * Assign attacker's damage to blockers (with Trample)
 */
function assignDamageToBlockers(
  state: GameState,
  attacker: CardInstance,
  blockerIds: string[],
  totalDamage: number,
  attackerTemplate: CardTemplate
): void {
  const defendingPlayerId = state.activePlayer === 'player' ? 'opponent' : 'player';
  const defendingPlayer = getPlayer(state, defendingPlayerId);

  let remainingDamage = totalDamage;

  // Assign damage to each blocker in order
  for (const blockerId of blockerIds) {
    const blocker = defendingPlayer.battlefield.find(c => c.instanceId === blockerId);
    if (!blocker) continue;

    const blockerTemplate = CardLoader.getById(blocker.scryfallId);
    if (!blockerTemplate) continue;

    const blockerToughness = parseInt(blockerTemplate.toughness || '0', 10);
    const lethalDamage = Math.max(0, blockerToughness - blocker.damage);

    // Assign at least lethal damage to this blocker
    const damageToAssign = Math.min(remainingDamage, lethalDamage);
    blocker.damage += damageToAssign;
    remainingDamage -= damageToAssign;

    if (remainingDamage <= 0) break;
  }

  // If attacker has Trample, excess damage goes to defending player
  if (hasTrample(attackerTemplate) && remainingDamage > 0) {
    defendingPlayer.life -= remainingDamage;

    // Check for game over
    if (defendingPlayer.life <= 0) {
      state.gameOver = true;
      state.winner = state.activePlayer;
    }
  }
}

/**
 * Check for creatures that should die (state-based action)
 */
function checkCreatureDeath(state: GameState): void {
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];

    // Check each creature on battlefield
    for (let i = player.battlefield.length - 1; i >= 0; i--) {
      const creature = player.battlefield[i]!;
      const template = CardLoader.getById(creature.scryfallId);

      if (template) {
        const toughness = parseInt(template.toughness || '0', 10);

        // Creature dies if damage >= toughness
        if (creature.damage >= toughness) {
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
        }
      }
    }
  }
}

/**
 * Clean up combat state at end of combat
 */
export function cleanupCombat(state: GameState): void {
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];

    for (const creature of player.battlefield) {
      creature.attacking = false;
      creature.blocking = undefined;
      creature.blockedBy = undefined;
    }
  }
}
