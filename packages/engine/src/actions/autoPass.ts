/**
 * Auto-pass optimizations for AI training efficiency
 *
 * These helpers detect situations where a player has no meaningful decisions
 * and should automatically pass priority. This reduces the action space for
 * AI bots (GreedyBot, MCTSBot) by eliminating forced non-decisions.
 *
 * Key optimizations:
 * - P1: Auto-pass when no instant-speed options available
 * - P2: Auto-skip blocking when no valid blockers exist
 * - P3: Auto-pass on own spells when no responses possible
 */

import type { GameState } from '../state/GameState';
import type { PlayerId } from '../state/Zone';
import type { PassPriorityAction, DeclareBlockersAction } from './Action';
import { getPlayer } from '../state/GameState';
import { CardLoader } from '../cards/CardLoader';
import { isInstant, isCreature, hasKeyword, hasFlying, hasReach } from '../cards/CardTemplate';
import { getActivatedAbilities, getGraveyardAbilities } from '../rules/activatedAbilities';
import { calculateAvailableMana } from './validators';
import { canPayManaCost, parseManaCost } from '../utils/manaCosts';
import { parseTargetRequirements, getAllLegalTargetCombinations } from '../rules/targeting';

/**
 * Check if player has any creatures that can attack
 *
 * Returns true if the player has at least one untapped, non-summoning-sick creature
 * without defender that could potentially attack.
 */
export function hasAttackers(state: GameState, playerId: PlayerId): boolean {
  const player = getPlayer(state, playerId);

  for (const permanent of player.battlefield) {
    const template = CardLoader.getById(permanent.scryfallId);
    if (!template) continue;

    // Must be a creature
    if (!template.type_line.includes('Creature')) continue;

    // Must be untapped
    if (permanent.tapped) continue;

    // Must not have summoning sickness
    if (permanent.summoningSick) continue;

    // Must not have Defender (Walls can't attack)
    if (template.type_line.includes('Wall')) continue;
    if (template.keywords?.includes('Defender')) continue;

    // Found a potential attacker
    return true;
  }

  return false;
}

/**
 * Check if attacker is completely unblockable
 * (True unblockable like Phantom Warrior, not conditional like landwalk)
 */
function isUnblockable(template: { name?: string; oracle_text?: string }): boolean {
  const unblockableCreatures = ['Phantom Warrior'];
  if (template.name && unblockableCreatures.includes(template.name)) {
    return true;
  }

  const text = template.oracle_text?.toLowerCase() || '';

  // Skip conditional blocking restrictions
  if (
    text.includes("can't be blocked as long as") ||
    text.includes("can't be blocked except") ||
    text.includes('walk')
  ) {
    return false;
  }

  // True unblockable
  if (text.includes("can't be blocked.") || text.includes('cannot be blocked.')) {
    return true;
  }

  return false;
}

/**
 * Check if player has any sorcery-speed options
 *
 * Returns true if the player can:
 * - Play a land (if they haven't this turn)
 * - Cast a creature, sorcery, enchantment, or artifact
 *
 * This is used to determine if we should auto-pass during main phase.
 */
export function hasSorcerySpeedOptions(state: GameState, playerId: PlayerId): boolean {
  const player = getPlayer(state, playerId);
  const availableMana = calculateAvailableMana(state, playerId);

  // Check if player can play a land
  if (player.landsPlayedThisTurn < 1) {
    for (const card of player.hand) {
      const template = CardLoader.getById(card.scryfallId);
      if (template && template.type_line.includes('Land')) {
        return true; // Can play a land
      }
    }
  }

  // Check for castable sorcery-speed spells
  for (const card of player.hand) {
    const template = CardLoader.getById(card.scryfallId);
    if (!template) continue;

    // Skip instants (handled by hasInstantSpeedOptions)
    if (template.type_line.includes('Instant')) continue;
    // Skip lands (handled above)
    if (template.type_line.includes('Land')) continue;

    // Check if we can afford it
    const manaCost = parseManaCost(template.mana_cost);
    if (canPayManaCost(availableMana, manaCost, 0)) {
      // Check if it has valid targets (if targeting required)
      const targetRequirements = parseTargetRequirements(template.oracle_text || '');
      if (targetRequirements.length === 0) {
        return true; // No targets needed, can cast
      }

      // Check if valid targets exist
      const targetCombinations = getAllLegalTargetCombinations(
        state,
        targetRequirements,
        playerId,
        card,
      );
      if (targetCombinations.length > 0) {
        return true; // Has valid targets
      }
    }
  }

  return false;
}

/**
 * P1: Check if player has any instant-speed options
 *
 * Returns true if the player can:
 * - Cast an instant spell
 * - Cast a spell with Flash
 * - Activate an ability (most are instant speed)
 *
 * Returns false if the only legal action is PASS_PRIORITY
 */
export function hasInstantSpeedOptions(state: GameState, playerId: PlayerId): boolean {
  const player = getPlayer(state, playerId);
  const availableMana = calculateAvailableMana(state, playerId);

  // Check hand for instant-speed spells
  for (const card of player.hand) {
    const template = CardLoader.getById(card.scryfallId);
    if (!template) continue;

    const isInstantSpeed = isInstant(template) || hasKeyword(template, 'Flash');
    if (!isInstantSpeed) continue;

    // Check if we can afford it
    const manaCost = parseManaCost(template.mana_cost);
    if (canPayManaCost(availableMana, manaCost, 0)) {
      // Check if it has valid targets (if targeting required)
      const targetRequirements = parseTargetRequirements(template.oracle_text || '');
      if (targetRequirements.length === 0) {
        return true; // No targets needed, can cast
      }

      // Check if valid targets exist
      const targetCombinations = getAllLegalTargetCombinations(
        state,
        targetRequirements,
        playerId,
        card,
      );
      if (targetCombinations.length > 0) {
        return true; // Has valid targets
      }
    }
  }

  // Check battlefield for activated abilities
  for (const permanent of player.battlefield) {
    const abilities = getActivatedAbilities(permanent, state);

    for (const ability of abilities) {
      // Skip mana abilities - they don't affect the game strategically at instant speed
      // when there's nothing to spend the mana on
      if (ability.isManaAbility) continue;

      if (ability.canActivate(state, permanent.instanceId, playerId)) {
        // Check targeting
        if (!ability.targetRequirements || ability.targetRequirements.length === 0) {
          return true; // No targets needed
        }

        const targetCombinations = getAllLegalTargetCombinations(
          state,
          ability.targetRequirements,
          playerId,
          permanent,
        );
        if (targetCombinations.length > 0) {
          return true; // Has valid targets
        }
      }
    }
  }

  // Check graveyard for activated abilities (e.g., Flashback, Necrosavant)
  for (const card of player.graveyard) {
    const abilities = getGraveyardAbilities(card, state);

    for (const ability of abilities) {
      if (ability.canActivate(state, card.instanceId, playerId)) {
        if (!ability.targetRequirements || ability.targetRequirements.length === 0) {
          return true;
        }

        const targetCombinations = getAllLegalTargetCombinations(
          state,
          ability.targetRequirements,
          playerId,
          card,
        );
        if (targetCombinations.length > 0) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * P2: Check if player has any valid blockers for the current attackers
 *
 * Returns true if there exists at least one legal blocking assignment.
 * Returns false if:
 * - Player has no untapped creatures
 * - All attackers are unblockable
 * - All potential blockers are prevented from blocking all attackers
 *   (e.g., no flyers to block flying attackers)
 */
export function hasValidBlockers(state: GameState, playerId: PlayerId): boolean {
  const player = getPlayer(state, playerId);
  const attackingPlayerId = state.activePlayer;
  const attackingPlayer = getPlayer(state, attackingPlayerId);

  // Find attackers
  const attackers = attackingPlayer.battlefield.filter((c) => c.attacking);
  if (attackers.length === 0) {
    return false; // No attackers to block
  }

  // Find potential blockers (untapped creatures)
  const potentialBlockers = player.battlefield.filter((card) => {
    const template = CardLoader.getById(card.scryfallId);
    if (!template || !isCreature(template)) return false;
    if (card.tapped) return false;
    return true;
  });

  if (potentialBlockers.length === 0) {
    return false; // No creatures to block with
  }

  // Check if any blocker can legally block any attacker
  for (const attacker of attackers) {
    const attackerTemplate = CardLoader.getById(attacker.scryfallId);
    if (!attackerTemplate) continue;

    // Skip unblockable attackers
    if (isUnblockable(attackerTemplate)) continue;

    for (const blocker of potentialBlockers) {
      const blockerTemplate = CardLoader.getById(blocker.scryfallId);
      if (!blockerTemplate) continue;

      // Check flying restriction
      if (hasFlying(attackerTemplate)) {
        if (!hasFlying(blockerTemplate) && !hasReach(blockerTemplate)) {
          continue; // Can't block flying
        }
      }

      // If we get here, this blocker can potentially block this attacker
      // (Full validation happens in validators.ts, but this is a quick check)
      return true;
    }
  }

  return false; // No valid blocking assignments possible
}

/**
 * P3: Check if player should auto-pass after casting their own spell
 *
 * When a player casts a spell and it goes on the stack, priority passes to
 * the opponent. But if the casting player has no instant-speed responses
 * to their own spell, they would always pass priority back anyway.
 *
 * This detects when the NON-ACTIVE player (who just received priority after
 * opponent cast a spell) has no responses, so we can auto-pass for them.
 *
 * Note: This is called from the perspective of the player receiving priority.
 */
export function shouldAutoPassOnStack(state: GameState, playerId: PlayerId): boolean {
  // Only applies when there's something on the stack
  if (state.stack.length === 0) {
    return false;
  }

  // Check if player has any instant-speed options
  return !hasInstantSpeedOptions(state, playerId);
}

/**
 * Get the minimal action set when auto-pass conditions are met
 *
 * This returns just PASS_PRIORITY when the player has no meaningful options.
 */
export function getAutoPassAction(playerId: PlayerId): PassPriorityAction {
  return {
    type: 'PASS_PRIORITY',
    playerId,
    payload: {},
  };
}

/**
 * Get the auto-skip blocker action (declare no blocks)
 *
 * Used when there are no valid blockers available.
 */
export function getNoBlockAction(playerId: PlayerId): DeclareBlockersAction {
  return {
    type: 'DECLARE_BLOCKERS',
    playerId,
    payload: { blocks: [] },
  };
}

/**
 * Master function: Check if player should auto-pass in current situation
 *
 * Combines all auto-pass conditions:
 * - P1: No instant-speed options
 * - P3: Stack has items and no responses available
 *
 * Note: P2 (blocking) is handled separately in getLegalBlockerDeclarations
 */
export function shouldAutoPass(state: GameState, playerId: PlayerId): boolean {
  // Must have priority to pass
  if (state.priorityPlayer !== playerId) {
    return false;
  }

  // Beginning phase is already handled specially in getLegalActions
  if (state.phase === 'beginning') {
    return false;
  }

  // During declare_blockers step, the defending player needs to declare blockers,
  // not pass priority. Let getLegalBlockerDeclarations handle this.
  if (state.phase === 'combat' && state.step === 'declare_blockers') {
    const defendingPlayer = state.activePlayer === 'player' ? 'opponent' : 'player';
    if (playerId === defendingPlayer) {
      return false; // Don't auto-pass, let P2 optimization handle blockers
    }
  }

  // During declare_attackers step, the active player might want to declare attackers
  // But if they have no creatures that can attack, they should auto-pass
  if (state.phase === 'combat' && state.step === 'declare_attackers') {
    if (playerId === state.activePlayer) {
      if (hasAttackers(state, playerId)) {
        return false; // Has potential attackers, let normal attack declaration handle this
      }
      // No attackers available, can auto-pass through combat
    }
  }

  // Check if we have any instant-speed options
  if (hasInstantSpeedOptions(state, playerId)) {
    return false;
  }

  // If stack is empty and it's our main phase, check for sorcery-speed options
  if (state.stack.length === 0) {
    if (state.activePlayer === playerId && (state.phase === 'main1' || state.phase === 'main2')) {
      // Only skip auto-pass if player actually has sorcery-speed plays available
      if (hasSorcerySpeedOptions(state, playerId)) {
        return false;
      }
      // Otherwise, player has no plays - auto-pass is safe
    }
  }

  return true;
}
