/**
 * Action validators - check if actions are legal
 *
 * Returns an array of error messages (empty = valid)
 */

import type { GameState } from '../state/GameState';
import type {
  Action,
  PlayLandAction,
  CastSpellAction,
  DeclareAttackersAction,
  DeclareBlockersAction,
  ActivateAbilityAction,
  SacrificePermanentAction,
} from './Action';
import { getPlayer, findCard } from '../state/GameState';
import { CardLoader } from '../cards/CardLoader';
import {
  isLand,
  isCreature,
  isInstant,
  isSorcery,
  hasFlying,
  hasReach,
  hasDefender,
  hasFear,
  hasIntimidate,
  hasMenace,
  getLandwalkTypes,
  isArtifact,
} from '../cards/CardTemplate';
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
 * Check if Dense Foliage is on the battlefield
 * Dense Foliage: "Creatures can't be the targets of spells."
 */
export function hasDenseFoliage(state: GameState): boolean {
  return (
    state.players.player.battlefield.some((p) => {
      const t = CardLoader.getById(p.scryfallId);
      return t?.name === 'Dense Foliage';
    }) ||
    state.players.opponent.battlefield.some((p) => {
      const t = CardLoader.getById(p.scryfallId);
      return t?.name === 'Dense Foliage';
    })
  );
}

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
      const aura = state.players[playerId].battlefield.find((c) => c.instanceId === attachmentId);
      if (aura) {
        const auraTemplate = CardLoader.getById(aura.scryfallId);
        if (auraTemplate?.oracle_text) {
          const text = auraTemplate.oracle_text.toLowerCase();
          // Check for "can't attack" or "can't attack or block"
          if (text.includes("can't attack") || text.includes('cannot attack')) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Check if a creature is prevented from attacking or blocking by a global enchantment
 * (e.g., Light of Day: "Black creatures can't attack or block")
 */
function isPreventedByGlobalEnchantment(state: GameState, creature: CardInstance): boolean {
  const creatureTemplate = CardLoader.getById(creature.scryfallId);
  if (!creatureTemplate) return false;

  const creatureColors = creatureTemplate.colors || [];

  // Check all enchantments on battlefield
  for (const playerId of ['player', 'opponent'] as const) {
    for (const permanent of state.players[playerId].battlefield) {
      const template = CardLoader.getById(permanent.scryfallId);
      if (!template) continue;

      const typeLine = template.type_line?.toLowerCase() || '';
      if (!typeLine.includes('enchantment') || typeLine.includes('aura')) continue;

      switch (template.name) {
        case 'Light of Day':
          // "Black creatures can't attack or block."
          if (creatureColors.includes('B')) {
            return true;
          }
          break;

        // Add more global enchantment combat restrictions here
      }
    }
  }

  return false;
}

/**
 * Check if a creature has Animate Wall attached
 * (Animate Wall: "Enchanted Wall can attack as though it didn't have defender.")
 */
function hasAnimateWall(state: GameState, creature: CardInstance): boolean {
  if (!creature.attachments || creature.attachments.length === 0) {
    return false;
  }

  for (const attachmentId of creature.attachments) {
    for (const playerId of ['player', 'opponent'] as const) {
      const aura = state.players[playerId].battlefield.find((c) => c.instanceId === attachmentId);
      if (aura) {
        const auraTemplate = CardLoader.getById(aura.scryfallId);
        if (auraTemplate?.name === 'Animate Wall') {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Check if a creature can't block (e.g., Hulking Cyclops)
 * Cards with "can't block" in oracle text or specific card names
 */
function cantBlock(template: { name?: string; oracle_text?: string }): boolean {
  // Check specific card names
  const cantBlockCreatures = ['Hulking Cyclops'];
  if (template.name && cantBlockCreatures.includes(template.name)) {
    return true;
  }

  // Check oracle text for "can't block" or "cannot block"
  const text = template.oracle_text?.toLowerCase() || '';
  if (text.includes("can't block") || text.includes('cannot block')) {
    // Make sure it's not "can't block alone" or other conditional
    if (!text.includes("can't block alone") && !text.includes("can't be blocked")) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a creature can't be blocked (unblockable)
 * e.g., Phantom Warrior: "Phantom Warrior can't be blocked."
 *
 * IMPORTANT: This should NOT match conditional unblockable like:
 * - Landwalk: "can't be blocked as long as defending player controls..."
 * - Shadow: "can't be blocked except by creatures with shadow"
 */
function isUnblockable(template: { name?: string; oracle_text?: string }): boolean {
  // Check specific card names
  const unblockableCreatures = ['Phantom Warrior'];
  if (template.name && unblockableCreatures.includes(template.name)) {
    return true;
  }

  // Check oracle text - be VERY careful not to match conditional unblockable
  const text = template.oracle_text?.toLowerCase() || '';

  // Skip if it has conditional blocking text (landwalk, shadow, etc.)
  if (text.includes("can't be blocked as long as") ||
      text.includes("can't be blocked except") ||
      text.includes("walk")) {
    return false;
  }

  // Match true unblockable: "[Name] can't be blocked." (period at end)
  // or "~ can't be blocked."
  if (text.includes("can't be blocked.") || text.includes("cannot be blocked.")) {
    return true;
  }

  return false;
}

/**
 * Check if a creature requires opponent to control a specific land type to attack
 * e.g., Sea Monster: "Sea Monster can't attack unless defending player controls an Island."
 */
function requiresLandToAttack(
  state: GameState,
  attacker: CardInstance,
  defendingPlayer: PlayerId,
): boolean {
  const template = CardLoader.getById(attacker.scryfallId);
  if (!template) return false;

  // Sea Monster can't attack unless defending player controls an Island
  if (template.name === 'Sea Monster') {
    const defender = state.players[defendingPlayer];
    const hasIsland = defender.battlefield.some((permanent) => {
      const permTemplate = CardLoader.getById(permanent.scryfallId);
      return permTemplate?.type_line?.includes('Island') ?? false;
    });
    return !hasIsland; // Returns true if attack should be PREVENTED (no Island)
  }

  return false; // No restriction
}

/**
 * Check if an attacker can't be blocked by Walls
 * e.g., Bog Rats: "Bog Rats can't be blocked by Walls."
 */
function cantBeBlockedByWalls(template: { name?: string; oracle_text?: string }): boolean {
  const cantBeBlockedByWallsCreatures = ['Bog Rats'];
  if (template.name && cantBeBlockedByWallsCreatures.includes(template.name)) {
    return true;
  }
  const text = template.oracle_text?.toLowerCase() || '';
  return text.includes("can't be blocked by walls");
}

/**
 * Check if an attacker can only be blocked by creatures with flying or walls
 * e.g., Elven Riders: "Elven Riders can't be blocked except by Walls and/or creatures with flying."
 */
function cantBeBlockedExceptByFlyingOrWalls(template: { name?: string; oracle_text?: string }): boolean {
  const creatures = ['Elven Riders'];
  if (template.name && creatures.includes(template.name)) {
    return true;
  }
  const text = template.oracle_text?.toLowerCase() || '';
  return text.includes("can't be blocked except by walls") ||
         text.includes("can't be blocked except by creatures with flying");
}

/**
 * Check if a creature can't attack alone
 * e.g., Goblin Elite Infantry: "Goblin Elite Infantry can't attack alone."
 */
function cantAttackAlone(template: { name?: string; oracle_text?: string }): boolean {
  const creatures = ['Goblin Elite Infantry'];
  if (template.name && creatures.includes(template.name)) {
    return true;
  }
  const text = template.oracle_text?.toLowerCase() || '';
  return text.includes("can't attack alone");
}

/**
 * Check if an attacker must be blocked by two or more creatures (like Menace but on attacker)
 * e.g., Stalking Tiger: "Stalking Tiger can't be blocked by more than one creature."
 * Note: This is the OPPOSITE - it can only be blocked by ONE creature
 */
function canOnlyBeBlockedByOne(template: { name?: string; oracle_text?: string }): boolean {
  const creatures = ['Stalking Tiger'];
  if (template.name && creatures.includes(template.name)) {
    return true;
  }
  const text = template.oracle_text?.toLowerCase() || '';
  return text.includes("can't be blocked by more than one");
}

/**
 * Check if a creature can't block small creatures (power 2 or less)
 * e.g., Sunweb: "Sunweb can't block creatures with power 2 or less."
 */
function cantBlockSmallCreatures(template: { name?: string; oracle_text?: string }): boolean {
  const creatures = ['Sunweb'];
  if (template.name && creatures.includes(template.name)) {
    return true;
  }
  const text = template.oracle_text?.toLowerCase() || '';
  return text.includes("can't block creatures with power 2 or less");
}

/**
 * Check if a creature can only be blocked by Walls
 * e.g., Evil Eye of Orms-by-Gore: "Evil Eye of Orms-by-Gore can't be blocked except by Walls."
 */
function canOnlyBeBlockedByWalls(template: { name?: string; oracle_text?: string }): boolean {
  const creatures = ['Evil Eye of Orms-by-Gore'];
  if (template.name && creatures.includes(template.name)) {
    return true;
  }
  const text = template.oracle_text?.toLowerCase() || '';
  return text.includes("can't be blocked except by walls");
}

/**
 * Check if controlling Evil Eye prevents non-Eye creatures from attacking
 * Evil Eye of Orms-by-Gore: "Non-Eye creatures you control can't attack."
 */
function isPreventedByEvilEye(state: GameState, creature: CardInstance): boolean {
  const creatureTemplate = CardLoader.getById(creature.scryfallId);
  if (!creatureTemplate) return false;

  // If this creature IS an Eye, it can attack
  if (creatureTemplate.type_line?.includes('Eye')) {
    return false;
  }

  // Check if controller has Evil Eye of Orms-by-Gore
  const controller = state.players[creature.controller];
  const hasEvilEye = controller.battlefield.some((p) => {
    const t = CardLoader.getById(p.scryfallId);
    return t?.name === 'Evil Eye of Orms-by-Gore';
  });

  return hasEvilEye;
}

/**
 * Check if a creature has Lure attached
 * (Lure: "All creatures able to block enchanted creature do so.")
 */
function hasLure(state: GameState, creature: CardInstance): boolean {
  if (!creature.attachments || creature.attachments.length === 0) {
    return false;
  }

  for (const attachmentId of creature.attachments) {
    for (const playerId of ['player', 'opponent'] as const) {
      const aura = state.players[playerId].battlefield.find((c) => c.instanceId === attachmentId);
      if (aura) {
        const auraTemplate = CardLoader.getById(aura.scryfallId);
        if (auraTemplate?.name === 'Lure') {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Check if a creature has Gaseous Form attached
 * (Gaseous Form: "Prevent all combat damage that would be dealt to and dealt by enchanted creature.")
 */
export function hasGaseousForm(state: GameState, creature: CardInstance): boolean {
  if (!creature.attachments || creature.attachments.length === 0) {
    return false;
  }

  for (const attachmentId of creature.attachments) {
    for (const playerId of ['player', 'opponent'] as const) {
      const aura = state.players[playerId].battlefield.find((c) => c.instanceId === attachmentId);
      if (aura) {
        const auraTemplate = CardLoader.getById(aura.scryfallId);
        if (auraTemplate?.name === 'Gaseous Form') {
          return true;
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
      return []; // Other actions are always valid for now
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
        card,
      );
      errors.push(...targetErrors);

      // Dense Foliage: Creatures can't be the targets of spells
      if (hasDenseFoliage(state)) {
        for (const targetId of targets) {
          // Check if target is a creature on the battlefield
          const target = findCard(state, targetId);
          if (target && target.zone === 'battlefield') {
            const targetTemplate = CardLoader.getById(target.scryfallId);
            if (targetTemplate && isCreature(targetTemplate)) {
              errors.push('Creatures cannot be targeted while Dense Foliage is on the battlefield');
              break;
            }
          }
        }
      }
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

    // Check if creature is prevented from attacking by a global enchantment (e.g., Light of Day)
    if (isPreventedByGlobalEnchantment(state, attacker)) {
      errors.push(`${attackerId} can't attack`);
    }

    // Check if creature is prevented from attacking by Evil Eye of Orms-by-Gore
    if (isPreventedByEvilEye(state, attacker)) {
      errors.push(`${attackerId} can't attack (non-Eye creatures can't attack while you control Evil Eye)`);
    }

    // Check if it's a creature
    const template = CardLoader.getById(attacker.scryfallId);
    if (template && !isCreature(template)) {
      errors.push(`${attackerId} is not a creature`);
    }

    // Check if creature has Defender (can't attack)
    // Unless it has Animate Wall attached
    if (template && hasDefender(template) && !hasAnimateWall(state, attacker)) {
      errors.push(`${attackerId} has Defender and cannot attack`);
    }

    // Check if creature requires defending player to control specific lands (e.g., Sea Monster)
    const defendingPlayer = state.activePlayer === 'player' ? 'opponent' : 'player';
    if (requiresLandToAttack(state, attacker, defendingPlayer)) {
      errors.push(`${attackerId} can't attack unless defending player controls required land`);
    }
  }

  // Check for "can't attack alone" creatures (e.g., Goblin Elite Infantry)
  if (action.payload.attackers.length === 1) {
    const loneAttacker = findCard(state, action.payload.attackers[0]!);
    if (loneAttacker) {
      const template = CardLoader.getById(loneAttacker.scryfallId);
      if (template && cantAttackAlone(template)) {
        errors.push(`${action.payload.attackers[0]} can't attack alone`);
      }
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

    // Check if creature is prevented from blocking by a global enchantment (e.g., Light of Day)
    if (isPreventedByGlobalEnchantment(state, blocker)) {
      errors.push(`Blocker ${block.blockerId} can't block`);
    }

    const blockerTemplate = CardLoader.getById(blocker.scryfallId);
    if (blockerTemplate && !isCreature(blockerTemplate)) {
      errors.push(`Blocker ${block.blockerId} is not a creature`);
    }

    // Check if creature can't block (e.g., Hulking Cyclops)
    if (blockerTemplate && cantBlock(blockerTemplate)) {
      errors.push(`${block.blockerId} can't block`);
    }

    // Check attacker exists and is attacking
    if (!attacker) {
      errors.push(`Attacker ${block.attackerId} not found`);
      continue;
    }

    if (!attacker.attacking) {
      errors.push(`${block.attackerId} is not attacking`);
    }

    // Check if attacker is unblockable (e.g., Phantom Warrior)
    const attackerTemplate = CardLoader.getById(attacker.scryfallId);
    if (attackerTemplate && isUnblockable(attackerTemplate)) {
      errors.push(`${block.attackerId} can't be blocked`);
      continue;
    }

    // Flying restriction: Flying creatures can only be blocked by Flying/Reach
    if (attackerTemplate && blockerTemplate) {
      if (hasFlying(attackerTemplate)) {
        if (!hasFlying(blockerTemplate) && !hasReach(blockerTemplate)) {
          errors.push(`${block.blockerId} cannot block ${block.attackerId} (Flying)`);
        }
      }

      // Landwalk restriction: Can't be blocked if defending player controls that land type
      const landwalkTypes = getLandwalkTypes(attackerTemplate);
      if (landwalkTypes.length > 0) {
        const defendingPlayerState = getPlayer(state, action.playerId);
        for (const landType of landwalkTypes) {
          // Check if defending player controls a land of that type
          const hasMatchingLand = defendingPlayerState.battlefield.some((permanent) => {
            const permTemplate = CardLoader.getById(permanent.scryfallId);
            if (!permTemplate) return false;
            // Check if it's the matching basic land type or has the subtype
            return permTemplate.type_line.includes(landType);
          });
          if (hasMatchingLand) {
            errors.push(`${block.blockerId} cannot block ${block.attackerId} (${landType}walk)`);
            break; // One landwalk being active is enough
          }
        }
      }

      // Fear restriction: Can only be blocked by artifact creatures and/or black creatures
      if (hasFear(attackerTemplate)) {
        const isBlackCreature = blockerTemplate.colors?.includes('B') ?? false;
        const isArtifactCreature = isArtifact(blockerTemplate) && isCreature(blockerTemplate);
        if (!isBlackCreature && !isArtifactCreature) {
          errors.push(`${block.blockerId} cannot block ${block.attackerId} (Fear)`);
        }
      }

      // Intimidate restriction: Can only be blocked by artifact creatures and/or creatures that share a color
      if (hasIntimidate(attackerTemplate)) {
        const isArtifactCreature = isArtifact(blockerTemplate) && isCreature(blockerTemplate);
        const attackerColors = attackerTemplate.colors || [];
        const blockerColors = blockerTemplate.colors || [];
        const sharesColor = attackerColors.some((c) => blockerColors.includes(c));
        if (!isArtifactCreature && !sharesColor) {
          errors.push(`${block.blockerId} cannot block ${block.attackerId} (Intimidate)`);
        }
      }

      // Bog Rats restriction: Can't be blocked by Walls
      if (cantBeBlockedByWalls(attackerTemplate)) {
        const isWall = blockerTemplate.type_line?.includes('Wall') ?? false;
        if (isWall) {
          errors.push(`${block.blockerId} cannot block ${block.attackerId} (can't be blocked by Walls)`);
        }
      }

      // Elven Riders restriction: Can only be blocked by creatures with flying or Walls
      if (cantBeBlockedExceptByFlyingOrWalls(attackerTemplate)) {
        const isWall = blockerTemplate.type_line?.includes('Wall') ?? false;
        const canBlock = hasFlying(blockerTemplate) || isWall;
        if (!canBlock) {
          errors.push(`${block.blockerId} cannot block ${block.attackerId} (only flying/Walls can block)`);
        }
      }

      // Evil Eye of Orms-by-Gore restriction: Can only be blocked by Walls
      if (canOnlyBeBlockedByWalls(attackerTemplate)) {
        const isWall = blockerTemplate.type_line?.includes('Wall') ?? false;
        if (!isWall) {
          errors.push(`${block.blockerId} cannot block ${block.attackerId} (only Walls can block Evil Eye)`);
        }
      }

      // Sunweb restriction: Can't block creatures with power 2 or less
      if (cantBlockSmallCreatures(blockerTemplate)) {
        const attackerPower = parseInt(attackerTemplate.power || '0', 10);
        if (attackerPower <= 2) {
          errors.push(`${block.blockerId} can't block creatures with power 2 or less`);
        }
      }
    }
  }

  // Menace restriction: Must be blocked by two or more creatures
  // We need to count how many blockers are assigned to each attacker with Menace
  if (action.payload.blocks.length > 0) {
    const menaceBlockerCounts: Map<string, number> = new Map();

    for (const block of action.payload.blocks) {
      const attacker = findCard(state, block.attackerId);
      if (!attacker) continue;

      const attackerTemplate = CardLoader.getById(attacker.scryfallId);
      if (attackerTemplate && hasMenace(attackerTemplate)) {
        const count = menaceBlockerCounts.get(block.attackerId) || 0;
        menaceBlockerCounts.set(block.attackerId, count + 1);
      }
    }

    // Check that each Menace creature is blocked by 2+ creatures
    for (const [attackerId, blockerCount] of menaceBlockerCounts) {
      if (blockerCount === 1) {
        errors.push(`${attackerId} has Menace - must be blocked by two or more creatures`);
      }
    }
  }

  // Stalking Tiger restriction: Can only be blocked by one creature (opposite of Menace)
  // Also check for Familiar Ground: "Each creature you control can't be blocked by more than one creature"
  if (action.payload.blocks.length > 0) {
    const singleBlockerCounts: Map<string, number> = new Map();

    // Check if attacking player controls Familiar Ground
    const attackingPlayer = state.activePlayer;
    const hasFamiliarGround = state.players[attackingPlayer].battlefield.some((p) => {
      const t = CardLoader.getById(p.scryfallId);
      return t?.name === 'Familiar Ground';
    });

    for (const block of action.payload.blocks) {
      const attacker = findCard(state, block.attackerId);
      if (!attacker) continue;

      const attackerTemplate = CardLoader.getById(attacker.scryfallId);
      // Count blockers for creatures with the restriction OR if Familiar Ground is active
      const hasRestriction = (attackerTemplate && canOnlyBeBlockedByOne(attackerTemplate)) ||
                            (hasFamiliarGround && attacker.controller === attackingPlayer);
      if (hasRestriction) {
        const count = singleBlockerCounts.get(block.attackerId) || 0;
        singleBlockerCounts.set(block.attackerId, count + 1);
      }
    }

    // Check that each "can only be blocked by one" creature has at most 1 blocker
    for (const [attackerId, blockerCount] of singleBlockerCounts) {
      if (blockerCount > 1) {
        errors.push(`${attackerId} can't be blocked by more than one creature`);
      }
    }
  }

  // Lure check: All creatures able to block a Lured creature must block it
  const attackingPlayerState = getPlayer(state, state.activePlayer);

  for (const attacker of attackingPlayerState.battlefield) {
    if (!attacker.attacking) continue;
    if (!hasLure(state, attacker)) continue;

    // This attacker has Lure - check if all able blockers are blocking it
    const defendingPlayerState = getPlayer(state, defendingPlayer);

    for (const potentialBlocker of defendingPlayerState.battlefield) {
      const blockerTemplate = CardLoader.getById(potentialBlocker.scryfallId);
      if (!blockerTemplate || !isCreature(blockerTemplate)) continue;

      // Skip if tapped
      if (potentialBlocker.tapped) continue;

      // Skip if prevented from combat
      if (isPreventedFromCombat(state, potentialBlocker)) continue;
      if (isPreventedByGlobalEnchantment(state, potentialBlocker)) continue;

      // Check if this blocker CAN block the Lured attacker (Flying, etc.)
      const attackerTemplate = CardLoader.getById(attacker.scryfallId);
      if (!attackerTemplate) continue;

      // Flying check
      if (hasFlying(attackerTemplate)) {
        if (!hasFlying(blockerTemplate) && !hasReach(blockerTemplate)) {
          continue; // Can't block this attacker
        }
      }

      // Landwalk check
      const landwalkTypes = getLandwalkTypes(attackerTemplate);
      if (landwalkTypes.length > 0) {
        let hasMatchingLand = false;
        for (const landType of landwalkTypes) {
          hasMatchingLand = defendingPlayerState.battlefield.some((permanent) => {
            const permTemplate = CardLoader.getById(permanent.scryfallId);
            if (!permTemplate) return false;
            return permTemplate.type_line.includes(landType);
          });
          if (hasMatchingLand) break;
        }
        if (hasMatchingLand) continue; // Can't block this attacker (landwalk)
      }

      // Fear check
      if (hasFear(attackerTemplate)) {
        const isBlackCreature = blockerTemplate.colors?.includes('B') ?? false;
        const isArtifactCreature = isArtifact(blockerTemplate) && isCreature(blockerTemplate);
        if (!isBlackCreature && !isArtifactCreature) continue;
      }

      // This blocker CAN block the Lured attacker - check if it IS blocking it
      const isBlockingLuredCreature = action.payload.blocks.some(
        (block) =>
          block.blockerId === potentialBlocker.instanceId &&
          block.attackerId === attacker.instanceId,
      );

      if (!isBlockingLuredCreature) {
        errors.push(`${potentialBlocker.instanceId} must block ${attacker.instanceId} (Lure)`);
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
  const ability = abilities.find((a) => a.id === action.payload.abilityId);

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
        card,
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
    const manaAbilities = abilities.filter((a) => a.isManaAbility && a.effect.type === 'ADD_MANA');

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
            case 'W':
              available.white += amount;
              break;
            case 'U':
              available.blue += amount;
              break;
            case 'B':
              available.black += amount;
              break;
            case 'R':
              available.red += amount;
              break;
            case 'G':
              available.green += amount;
              break;
            case 'C':
              available.colorless += amount;
              break;
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
