/**
 * Action validators - check if actions are legal
 *
 * Returns an array of error messages (empty = valid)
 */

import type { GameState } from '../state/GameState';
import type { Action, PlayLandAction, CastSpellAction, DeclareAttackersAction, DeclareBlockersAction, ActivateAbilityAction, SacrificePermanentAction } from './Action';
import { getPlayer, findCard } from '../state/GameState';
import { CardLoader } from '../cards/CardLoader';
import { isLand, isCreature, isInstant, isSorcery, hasFlying, hasReach, isAura } from '../cards/CardTemplate';
import type { CardInstance } from '../state/CardInstance';
import { getActivatedAbilities } from '../rules/activatedAbilities';
import type { PlayerId } from '../state/Zone';
import type { ManaPool } from '../state/PlayerState';
import { parseManaCost, canPayManaCost, hasXInCost } from '../utils/manaCosts';
import {
  parseTargetRequirements,
  validateTargets,
  getRequiredTargetCount,
} from '../rules/targeting';

/**
 * Check if a creature is prevented from attacking or blocking by an aura
 * (e.g., Pacifism: "Enchanted creature can't attack or block")
 */
function isPreventedFromCombat(state: GameState, creature: CardInstance): boolean {
  if (!creature.attachments || creature.attachments.length === 0) {
    return false;
  }

  // Check each attachment
  for (const attachmentId of creature.attachments) {
    // Find the aura on any player's battlefield
    for (const playerId of ['player', 'opponent'] as const) {
      const aura = state.players[playerId].battlefield.find(c => c.instanceId === attachmentId);
      if (aura) {
        const auraTemplate = CardLoader.getById(aura.scryfallId);
        if (auraTemplate?.oracle_text) {
          const text = auraTemplate.oracle_text.toLowerCase();
          // Check for "can't attack" or "can't attack or block"
          if (text.includes("can't attack") || text.includes("cannot attack")) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Validate any action
 */
export function validateAction(state: GameState, action: Action): string[] {
  switch (action.type) {
    case 'PLAY_LAND':
      return validatePlayLand(state, action);
    case 'CAST_SPELL':
      return validateCastSpell(state, action);
    case 'DECLARE_ATTACKERS':
      return validateDeclareAttackers(state, action);
    case 'DECLARE_BLOCKERS':
      return validateDeclareBlockers(state, action);
    case 'ACTIVATE_ABILITY':
      return validateActivateAbility(state, action);
    case 'SACRIFICE_PERMANENT':
      return validateSacrificePermanent(state, action);
    default:
      return [];  // Other actions are always valid for now
  }
}

/**
 * Validate playing a land
 */
function validatePlayLand(state: GameState, action: PlayLandAction): string[] {
  const errors: string[] = [];
  const player = getPlayer(state, action.playerId);

  // Check if it's the player's turn
  if (state.activePlayer !== action.playerId) {
    errors.push('Not your turn');
  }

  // Check if in main phase
  if (state.phase !== 'main1' && state.phase !== 'main2') {
    errors.push('Can only play lands during main phase');
  }

  // Check if already played a land this turn
  if (player.landsPlayedThisTurn >= 1) {
    errors.push('Already played a land this turn');
  }

  // Check if card is in hand
  const card = findCard(state, action.payload.cardInstanceId);
  if (!card) {
    errors.push('Card not found');
    return errors;
  }

  if (card.zone !== 'hand') {
    errors.push('Card is not in hand');
  }

  if (card.controller !== action.playerId) {
    errors.push('You do not control this card');
  }

  // Check if card is actually a land
  const template = CardLoader.getById(card.scryfallId);
  if (!template) {
    errors.push('Card template not found');
    return errors;
  }

  if (!isLand(template)) {
    errors.push('Card is not a land');
  }

  return errors;
}

/**
 * Validate casting a spell
 * Phase 1+: Instant vs Sorcery timing
 */
function validateCastSpell(state: GameState, action: CastSpellAction): string[] {
  const errors: string[] = [];

  // Check if card is in hand first (need template for timing checks)
  const card = findCard(state, action.payload.cardInstanceId);
  if (!card) {
    errors.push('Card not found');
    return errors;
  }

  if (card.zone !== 'hand') {
    errors.push('Card is not in hand');
  }

  if (card.controller !== action.playerId) {
    errors.push('You do not control this card');
  }

  // Get card template to check timing restrictions
  const template = CardLoader.getById(card.scryfallId);
  if (!template) {
    errors.push('Card template not found');
    return errors;
  }

  // Check if player has priority
  if (state.priorityPlayer !== action.playerId) {
    errors.push('You do not have priority');
  }

  // Timing restrictions differ for instants vs sorceries
  const isInstantSpeed = isInstant(template);
  const isSorcerySpeed = isSorcery(template) || isCreature(template) || isLand(template);

  if (isSorcerySpeed) {
    // Sorcery-speed spells require:
    // 1. Your turn
    // 2. Main phase (main1 or main2)
    // 3. Empty stack
    if (state.activePlayer !== action.playerId) {
      errors.push('Can only cast sorcery-speed spells on your turn');
    }

    if (state.phase !== 'main1' && state.phase !== 'main2') {
      errors.push('Can only cast sorcery-speed spells during main phase');
    }

    if (state.stack.length > 0) {
      errors.push('Cannot cast sorcery-speed spells while stack is not empty');
    }
  } else if (isInstantSpeed) {
    // Instants can be cast any time you have priority (already checked above)
    // No additional restrictions
  }

  // Mana cost validation with auto-tapping
  const manaCost = parseManaCost(template.mana_cost);

  // For X spells, check if they can afford at least X=0
  // The actual X value will be chosen when casting
  const xValue = action.payload.xValue ?? 0;

  // Check if player can afford the spell (current pool + available mana from untapped sources)
  const availableMana = calculateAvailableMana(state, action.playerId);

  if (!canPayManaCost(availableMana, manaCost, xValue)) {
    errors.push('Not enough mana to cast this spell');
  }

  // For X spells, validate the X value makes sense
  if (hasXInCost(template.mana_cost) && xValue < 0) {
    errors.push('X value cannot be negative');
  }

  // Target validation
  const targetRequirements = parseTargetRequirements(template.oracle_text || '');

  if (targetRequirements.length > 0) {
    const targets = action.payload.targets || [];
    const requiredCount = getRequiredTargetCount(targetRequirements);

    // Check if targets were provided when required
    if (requiredCount > 0 && targets.length === 0) {
      errors.push(`This spell requires ${requiredCount} target(s)`);
      return errors;
    }

    // Validate the provided targets
    if (targets.length > 0) {
      const targetErrors = validateTargets(
        state,
        targets,
        targetRequirements,
        action.playerId,
        card
      );
      errors.push(...targetErrors);
    }
  }

  return errors;
}

/**
 * Validate declaring attackers
 */
function validateDeclareAttackers(state: GameState, action: DeclareAttackersAction): string[] {
  const errors: string[] = [];

  // Check if it's the player's turn
  if (state.activePlayer !== action.playerId) {
    errors.push('Not your turn');
  }

  // Phase 0: Can attack from main1 (simplified)
  // Phase 1+: Must be in declare_attackers step
  if (state.phase !== 'main1' && state.step !== 'declare_attackers') {
    errors.push('Can only declare attackers in main1 or declare_attackers step');
  }

  // Validate each attacker
  for (const attackerId of action.payload.attackers) {
    const attacker = findCard(state, attackerId);

    if (!attacker) {
      errors.push(`Attacker ${attackerId} not found`);
      continue;
    }

    if (attacker.controller !== action.playerId) {
      errors.push(`You do not control ${attackerId}`);
    }

    if (attacker.zone !== 'battlefield') {
      errors.push(`${attackerId} is not on the battlefield`);
    }

    if (attacker.tapped) {
      errors.push(`${attackerId} is tapped`);
    }

    if (attacker.summoningSick) {
      errors.push(`${attackerId} has summoning sickness`);
    }

    // Check if creature is prevented from attacking by an aura (e.g., Pacifism)
    if (isPreventedFromCombat(state, attacker)) {
      errors.push(`${attackerId} can't attack`);
    }

    // Check if it's a creature
    const template = CardLoader.getById(attacker.scryfallId);
    if (template && !isCreature(template)) {
      errors.push(`${attackerId} is not a creature`);
    }
  }

  return errors;
}

/**
 * Validate declaring blockers
 * Phase 1+: Proper blocking with Flying/Reach restrictions
 */
function validateDeclareBlockers(state: GameState, action: DeclareBlockersAction): string[] {
  const errors: string[] = [];

  // Must be in declare_blockers step
  if (state.step !== 'declare_blockers') {
    errors.push('Can only declare blockers during declare_blockers step');
    return errors;
  }

  // Defending player is the one who's not the active player
  const defendingPlayer = state.activePlayer === 'player' ? 'opponent' : 'player';

  if (action.playerId !== defendingPlayer) {
    errors.push('Only the defending player can declare blockers');
  }

  // Validate each block assignment
  for (const block of action.payload.blocks) {
    const blocker = findCard(state, block.blockerId);
    const attacker = findCard(state, block.attackerId);

    // Check blocker exists and is valid
    if (!blocker) {
      errors.push(`Blocker ${block.blockerId} not found`);
      continue;
    }

    if (blocker.controller !== action.playerId) {
      errors.push(`You do not control blocker ${block.blockerId}`);
    }

    if (blocker.zone !== 'battlefield') {
      errors.push(`Blocker ${block.blockerId} is not on the battlefield`);
    }

    if (blocker.tapped) {
      errors.push(`Blocker ${block.blockerId} is tapped`);
    }

    // Check if creature is prevented from blocking by an aura (e.g., Pacifism)
    if (isPreventedFromCombat(state, blocker)) {
      errors.push(`Blocker ${block.blockerId} can't block`);
    }

    const blockerTemplate = CardLoader.getById(blocker.scryfallId);
    if (blockerTemplate && !isCreature(blockerTemplate)) {
      errors.push(`Blocker ${block.blockerId} is not a creature`);
    }

    // Check attacker exists and is attacking
    if (!attacker) {
      errors.push(`Attacker ${block.attackerId} not found`);
      continue;
    }

    if (!attacker.attacking) {
      errors.push(`${block.attackerId} is not attacking`);
    }

    // Flying restriction: Flying creatures can only be blocked by Flying/Reach
    const attackerTemplate = CardLoader.getById(attacker.scryfallId);
    if (attackerTemplate && blockerTemplate) {
      if (hasFlying(attackerTemplate)) {
        if (!hasFlying(blockerTemplate) && !hasReach(blockerTemplate)) {
          errors.push(`${block.blockerId} cannot block ${block.attackerId} (Flying)`);
        }
      }
    }
  }

  return errors;
}

/**
 * Validate activating an ability
 * Phase 1+: Activated abilities require priority and costs to be paid
 */
function validateActivateAbility(state: GameState, action: ActivateAbilityAction): string[] {
  const errors: string[] = [];

  // Check if player has priority
  if (state.priorityPlayer !== action.playerId) {
    errors.push('You do not have priority');
  }

  // Find the card with the ability
  const card = findCard(state, action.payload.sourceId);
  if (!card) {
    errors.push('Card not found');
    return errors;
  }

  if (card.zone !== 'battlefield') {
    errors.push('Card must be on the battlefield');
  }

  if (card.controller !== action.playerId) {
    errors.push('You do not control this card');
  }

  // Get all abilities for this card
  const abilities = getActivatedAbilities(card, state);
  const ability = abilities.find(a => a.id === action.payload.abilityId);

  if (!ability) {
    errors.push('Ability not found on card');
    return errors;
  }

  // Check if ability can be activated
  if (!ability.canActivate(state, action.payload.sourceId, action.playerId)) {
    errors.push('Ability cannot be activated');
  }

  // Target validation for abilities that require targets
  if (ability.targetRequirements && ability.targetRequirements.length > 0) {
    const targets = action.payload.targets || [];
    const requiredCount = getRequiredTargetCount(ability.targetRequirements);

    // Check if targets were provided when required
    if (requiredCount > 0 && targets.length === 0) {
      errors.push(`This ability requires ${requiredCount} target(s)`);
      return errors;
    }

    // Validate the provided targets
    if (targets.length > 0) {
      const targetErrors = validateTargets(
        state,
        targets,
        ability.targetRequirements,
        action.playerId,
        card
      );
      errors.push(...targetErrors);
    }
  }

  return errors;
}

/**
 * Calculate total available mana for a player
 *
 * This includes:
 * 1. Current mana in the mana pool
 * 2. Potential mana from untapped lands
 * 3. Potential mana from untapped mana-producing creatures (not summoning sick)
 *
 * For multi-color lands, we optimistically count their best possible contribution.
 * The actual auto-tapping will happen when the spell is cast.
 */
export function calculateAvailableMana(state: GameState, playerId: PlayerId): ManaPool {
  const player = getPlayer(state, playerId);

  // Start with current mana pool
  const available: ManaPool = { ...player.manaPool };

  // Add potential mana from untapped permanents
  for (const permanent of player.battlefield) {
    // Skip tapped permanents
    if (permanent.tapped) continue;

    const template = CardLoader.getById(permanent.scryfallId);
    if (!template) continue;

    // Get mana abilities for this permanent
    const abilities = getActivatedAbilities(permanent, state);
    const manaAbilities = abilities.filter(a => a.isManaAbility && a.effect.type === 'ADD_MANA');

    for (const ability of manaAbilities) {
      // Check if ability can be activated (handles summoning sickness for creatures)
      if (!ability.canActivate(state, permanent.instanceId, playerId)) continue;

      // Add the mana this ability can produce
      // For abilities that can produce multiple colors, add all possibilities
      // (this is optimistic - actual payment will choose specific colors)
      if (ability.effect.manaColors) {
        for (const color of ability.effect.manaColors) {
          const amount = ability.effect.amount ?? 1;
          switch (color) {
            case 'W': available.white += amount; break;
            case 'U': available.blue += amount; break;
            case 'B': available.black += amount; break;
            case 'R': available.red += amount; break;
            case 'G': available.green += amount; break;
            case 'C': available.colorless += amount; break;
          }
        }
        // Only count the first mana ability per permanent (you can only tap once)
        break;
      }
    }
  }

  return available;
}

/**
 * Validate sacrificing a permanent
 */
function validateSacrificePermanent(state: GameState, action: SacrificePermanentAction): string[] {
  const errors: string[] = [];

  // Find the permanent
  const permanent = findCard(state, action.payload.permanentId);
  if (!permanent) {
    errors.push('Permanent not found');
    return errors;
  }

  // Must be on the battlefield
  if (permanent.zone !== 'battlefield') {
    errors.push('Can only sacrifice permanents on the battlefield');
  }

  // Must control the permanent to sacrifice it
  if (permanent.controller !== action.playerId) {
    errors.push('You do not control this permanent');
  }

  return errors;
}
