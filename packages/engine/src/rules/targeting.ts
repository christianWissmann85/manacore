/**
 * Targeting System
 *
 * Handles target requirements, validation, and legal target generation
 * for spells and activated abilities.
 *
 * Key concepts:
 * - TargetRequirement: What a spell/ability needs (parsed from oracle text)
 * - TargetRestriction: Constraints on valid targets (e.g., "nonblack", "attacking")
 * - Validation: Check if chosen targets are legal
 * - Legal targets: Generate all valid targets for a requirement
 */

import type { GameState } from '../state/GameState';
import type { CardInstance } from '../state/CardInstance';
import type { PlayerId, Zone } from '../state/Zone';
import type { CardTemplate } from '../cards/CardTemplate';
import { CardLoader } from '../cards/CardLoader';
import { findCard, getPlayer, getOpponent } from '../state/GameState';
import {
  isCreature,
  isArtifact,
  isEnchantment,
  isLand,
  hasKeyword,
} from '../cards/CardTemplate';

// =============================================================================
// TYPES
// =============================================================================

/**
 * What type of thing can be targeted
 */
export type TargetType =
  | 'any'              // "any target" - creature or player
  | 'creature'         // "target creature"
  | 'player'           // "target player"
  | 'opponent'         // "target opponent"
  | 'spell'            // "target spell" (on stack)
  | 'creature_spell'   // "target creature spell" (on stack)
  | 'permanent'        // "target permanent"
  | 'artifact'         // "target artifact"
  | 'enchantment'      // "target enchantment"
  | 'land'             // "target land"
  | 'artifact_or_enchantment'; // "target artifact or enchantment"

/**
 * Color restriction types
 */
export type MtgColor = 'W' | 'U' | 'B' | 'R' | 'G';

/**
 * Restrictions that narrow valid targets
 */
export type TargetRestriction =
  | { type: 'color'; color: MtgColor; negated: boolean }      // "nonblack", "black"
  | { type: 'controller'; controller: 'you' | 'opponent' }    // "you control", "opponent controls"
  | { type: 'combat'; status: 'attacking' | 'blocking' | 'attacking_or_blocking' }
  | { type: 'tapped' }
  | { type: 'untapped' }
  | { type: 'nonartifact' }
  | { type: 'nonland' };

/**
 * A single targeting requirement for a spell or ability
 */
export interface TargetRequirement {
  id: string;                         // Unique ID for matching with effects
  count: number;                      // How many targets needed (usually 1)
  targetType: TargetType;             // What can be targeted
  zone: Zone | 'any';                 // Where targets must be
  restrictions: TargetRestriction[];  // Additional constraints
  optional: boolean;                  // "up to X" vs required
  description: string;                // Human-readable description
}

/**
 * A resolved target with metadata
 */
export interface ResolvedTarget {
  id: string;           // instanceId or playerId
  type: 'card' | 'player' | 'stack_object';
}

// =============================================================================
// ORACLE TEXT PARSING
// =============================================================================

/**
 * Parse target requirements from oracle text
 *
 * Examples:
 * - "Lightning Bolt deals 3 damage to any target."
 *   → [{ targetType: 'any', count: 1 }]
 *
 * - "Destroy target nonblack creature."
 *   → [{ targetType: 'creature', restrictions: [{ type: 'color', color: 'B', negated: true }] }]
 *
 * - "Counter target spell."
 *   → [{ targetType: 'spell', zone: 'stack' }]
 */
export function parseTargetRequirements(oracleText: string): TargetRequirement[] {
  if (!oracleText) return [];

  const requirements: TargetRequirement[] = [];

  // Filter out triggered ability text - these have their own targeting
  // Triggered abilities start with "When", "Whenever", or "At"
  const sentences = oracleText.split(/[.\n]/);
  const spellText = sentences
    .filter(s => {
      const trimmed = s.trim().toLowerCase();
      return !trimmed.startsWith('when') && !trimmed.startsWith('at ');
    })
    .join('. ');

  const text = spellText.toLowerCase();
  let requirementIndex = 0;

  // Pattern: "any target" (creature or player)
  if (text.includes('any target') || text.includes('to any target')) {
    requirements.push({
      id: `target_${requirementIndex++}`,
      count: 1,
      targetType: 'any',
      zone: 'battlefield',
      restrictions: [],
      optional: false,
      description: 'any target',
    });
  }

  // Pattern: "target player"
  else if (/target player/.test(text) && !text.includes('target player discards')) {
    requirements.push({
      id: `target_${requirementIndex++}`,
      count: 1,
      targetType: 'player',
      zone: 'any',
      restrictions: [],
      optional: false,
      description: 'target player',
    });
  }

  // Pattern: "target opponent"
  else if (/target opponent/.test(text)) {
    requirements.push({
      id: `target_${requirementIndex++}`,
      count: 1,
      targetType: 'opponent',
      zone: 'any',
      restrictions: [],
      optional: false,
      description: 'target opponent',
    });
  }

  // Pattern: "target creature spell"
  else if (/target creature spell/.test(text)) {
    requirements.push({
      id: `target_${requirementIndex++}`,
      count: 1,
      targetType: 'creature_spell',
      zone: 'stack',
      restrictions: [],
      optional: false,
      description: 'target creature spell',
    });
  }

  // Pattern: "target spell"
  else if (/target spell/.test(text)) {
    requirements.push({
      id: `target_${requirementIndex++}`,
      count: 1,
      targetType: 'spell',
      zone: 'stack',
      restrictions: [],
      optional: false,
      description: 'target spell',
    });
  }

  // Pattern: "target artifact or enchantment"
  else if (/target artifact or enchantment/.test(text)) {
    requirements.push({
      id: `target_${requirementIndex++}`,
      count: 1,
      targetType: 'artifact_or_enchantment',
      zone: 'battlefield',
      restrictions: [],
      optional: false,
      description: 'target artifact or enchantment',
    });
  }

  // Pattern: "target attacking or blocking creature"
  else if (/target attacking or blocking creature/.test(text)) {
    requirements.push({
      id: `target_${requirementIndex++}`,
      count: 1,
      targetType: 'creature',
      zone: 'battlefield',
      restrictions: [{ type: 'combat', status: 'attacking_or_blocking' }],
      optional: false,
      description: 'target attacking or blocking creature',
    });
  }

  // Pattern: "target nonwhite attacking creature" (Exile)
  else if (/target nonwhite attacking creature/.test(text)) {
    requirements.push({
      id: `target_${requirementIndex++}`,
      count: 1,
      targetType: 'creature',
      zone: 'battlefield',
      restrictions: [
        { type: 'color', color: 'W', negated: true },
        { type: 'combat', status: 'attacking' },
      ],
      optional: false,
      description: 'target nonwhite attacking creature',
    });
  }

  // Pattern: "target attacking creature"
  else if (/target attacking creature/.test(text)) {
    requirements.push({
      id: `target_${requirementIndex++}`,
      count: 1,
      targetType: 'creature',
      zone: 'battlefield',
      restrictions: [{ type: 'combat', status: 'attacking' }],
      optional: false,
      description: 'target attacking creature',
    });
  }

  // Pattern: "target blocking creature"
  else if (/target blocking creature/.test(text)) {
    requirements.push({
      id: `target_${requirementIndex++}`,
      count: 1,
      targetType: 'creature',
      zone: 'battlefield',
      restrictions: [{ type: 'combat', status: 'blocking' }],
      optional: false,
      description: 'target blocking creature',
    });
  }

  // Pattern: "target nonblack creature"
  else if (/target nonblack creature/.test(text)) {
    requirements.push({
      id: `target_${requirementIndex++}`,
      count: 1,
      targetType: 'creature',
      zone: 'battlefield',
      restrictions: [{ type: 'color', color: 'B', negated: true }],
      optional: false,
      description: 'target nonblack creature',
    });
  }

  // Pattern: "target nonartifact creature"
  else if (/target nonartifact creature/.test(text)) {
    requirements.push({
      id: `target_${requirementIndex++}`,
      count: 1,
      targetType: 'creature',
      zone: 'battlefield',
      restrictions: [{ type: 'nonartifact' }],
      optional: false,
      description: 'target nonartifact creature',
    });
  }

  // Pattern: "target nonartifact, nonblack creature" (Terror pattern)
  else if (/target nonartifact,?\s*nonblack creature/.test(text)) {
    requirements.push({
      id: `target_${requirementIndex++}`,
      count: 1,
      targetType: 'creature',
      zone: 'battlefield',
      restrictions: [
        { type: 'nonartifact' },
        { type: 'color', color: 'B', negated: true },
      ],
      optional: false,
      description: 'target nonartifact, nonblack creature',
    });
  }

  // Pattern: "target creature" (generic)
  else if (/target creature/.test(text)) {
    requirements.push({
      id: `target_${requirementIndex++}`,
      count: 1,
      targetType: 'creature',
      zone: 'battlefield',
      restrictions: [],
      optional: false,
      description: 'target creature',
    });
  }

  // Pattern: "target permanent"
  else if (/target permanent/.test(text)) {
    requirements.push({
      id: `target_${requirementIndex++}`,
      count: 1,
      targetType: 'permanent',
      zone: 'battlefield',
      restrictions: [],
      optional: false,
      description: 'target permanent',
    });
  }

  // Pattern: "target artifact"
  else if (/target artifact/.test(text)) {
    requirements.push({
      id: `target_${requirementIndex++}`,
      count: 1,
      targetType: 'artifact',
      zone: 'battlefield',
      restrictions: [],
      optional: false,
      description: 'target artifact',
    });
  }

  // Pattern: "target enchantment"
  else if (/target enchantment/.test(text)) {
    requirements.push({
      id: `target_${requirementIndex++}`,
      count: 1,
      targetType: 'enchantment',
      zone: 'battlefield',
      restrictions: [],
      optional: false,
      description: 'target enchantment',
    });
  }

  // Pattern: "target land"
  else if (/target land/.test(text)) {
    requirements.push({
      id: `target_${requirementIndex++}`,
      count: 1,
      targetType: 'land',
      zone: 'battlefield',
      restrictions: [],
      optional: false,
      description: 'target land',
    });
  }

  return requirements;
}

/**
 * Check if a spell/ability requires targets
 */
export function requiresTargets(oracleText: string | undefined): boolean {
  if (!oracleText) return false;
  return parseTargetRequirements(oracleText).length > 0;
}

/**
 * Get the total number of targets required
 */
export function getRequiredTargetCount(requirements: TargetRequirement[]): number {
  return requirements.reduce((sum, req) => sum + (req.optional ? 0 : req.count), 0);
}

/**
 * Get the maximum number of targets allowed
 */
export function getMaxTargetCount(requirements: TargetRequirement[]): number {
  return requirements.reduce((sum, req) => sum + req.count, 0);
}

// =============================================================================
// PROTECTION / HEXPROOF / SHROUD CHECKS
// =============================================================================

/**
 * Check if a card has Hexproof
 */
export function hasHexproof(card: CardTemplate): boolean {
  return hasKeyword(card, 'Hexproof');
}

/**
 * Check if a card has Shroud
 */
export function hasShroud(card: CardTemplate): boolean {
  return hasKeyword(card, 'Shroud');
}

/**
 * Check if a card has Protection from a color
 *
 * Looks for patterns like:
 * - "Protection from black"
 * - "Protection from white and from blue"
 */
export function hasProtectionFrom(card: CardTemplate, color: MtgColor): boolean {
  const oracleText = card.oracle_text?.toLowerCase() || '';
  const colorNames: Record<MtgColor, string> = {
    W: 'white',
    U: 'blue',
    B: 'black',
    R: 'red',
    G: 'green',
  };

  const colorName = colorNames[color];
  return oracleText.includes(`protection from ${colorName}`);
}

/**
 * Check if a card has Protection from all colors
 */
export function hasProtectionFromAllColors(card: CardTemplate): boolean {
  const oracleText = card.oracle_text?.toLowerCase() || '';
  return oracleText.includes('protection from all colors');
}

/**
 * Get the colors of a source (spell/ability source)
 */
export function getSourceColors(card: CardTemplate): MtgColor[] {
  return card.colors.filter((c): c is MtgColor =>
    ['W', 'U', 'B', 'R', 'G'].includes(c)
  );
}

// =============================================================================
// TARGET VALIDATION
// =============================================================================

/**
 * Validate that targets are legal for a spell/ability
 *
 * @returns Array of error messages (empty if valid)
 */
export function validateTargets(
  state: GameState,
  targets: string[],
  requirements: TargetRequirement[],
  controller: PlayerId,
  sourceCard?: CardInstance
): string[] {
  const errors: string[] = [];

  // Check target count
  const requiredCount = getRequiredTargetCount(requirements);
  const maxCount = getMaxTargetCount(requirements);

  if (targets.length < requiredCount) {
    errors.push(`Need at least ${requiredCount} target(s), got ${targets.length}`);
    return errors;
  }

  if (targets.length > maxCount) {
    errors.push(`Maximum ${maxCount} target(s) allowed, got ${targets.length}`);
    return errors;
  }

  // Validate each target against requirements
  let targetIndex = 0;
  for (const req of requirements) {
    for (let i = 0; i < req.count && targetIndex < targets.length; i++) {
      const targetId = targets[targetIndex]!;
      const targetErrors = validateSingleTarget(
        state,
        targetId,
        req,
        controller,
        sourceCard
      );
      errors.push(...targetErrors);
      targetIndex++;
    }
  }

  // Check for duplicate targets (most spells can't target same thing twice)
  const uniqueTargets = new Set(targets);
  if (uniqueTargets.size !== targets.length) {
    errors.push('Cannot target the same thing multiple times');
  }

  return errors;
}

/**
 * Validate a single target against a requirement
 */
export function validateSingleTarget(
  state: GameState,
  targetId: string,
  requirement: TargetRequirement,
  controller: PlayerId,
  sourceCard?: CardInstance
): string[] {
  const errors: string[] = [];

  // === Player Targets ===
  if (targetId === 'player' || targetId === 'opponent') {
    // Check if requirement allows player targets
    if (requirement.targetType === 'any' || requirement.targetType === 'player') {
      // Valid player target
      return [];
    }
    if (requirement.targetType === 'opponent') {
      // Must target opponent
      if (targetId === controller) {
        return ['Must target opponent, not yourself'];
      }
      return [];
    }
    return [`Cannot target a player with "${requirement.description}"`];
  }

  // === Stack Targets (for counterspells) ===
  if (requirement.zone === 'stack') {
    const stackObj = state.stack.find(s => s.id === targetId);
    if (!stackObj) {
      return [`Target ${targetId} not found on stack`];
    }

    // Check spell type restrictions
    if (requirement.targetType === 'creature_spell') {
      const template = CardLoader.getById(stackObj.card.scryfallId);
      if (!template || !template.type_line.includes('Creature')) {
        return ['Target must be a creature spell'];
      }
    }

    return [];
  }

  // === Card Targets (battlefield, graveyard, etc.) ===
  const target = findCard(state, targetId);
  if (!target) {
    return [`Target ${targetId} not found`];
  }

  const template = CardLoader.getById(target.scryfallId);
  if (!template) {
    return [`Could not find card data for target`];
  }

  // Check zone
  if (requirement.zone !== 'any' && target.zone !== requirement.zone) {
    return [`Target must be in ${requirement.zone}, but is in ${target.zone}`];
  }

  // Check Hexproof (can't be targeted by opponents)
  if (hasHexproof(template) && target.controller !== controller) {
    return ['Target has hexproof'];
  }

  // Check Shroud (can't be targeted by anyone)
  if (hasShroud(template)) {
    return ['Target has shroud'];
  }

  // Check Protection (if we have source card info)
  if (sourceCard) {
    const sourceTemplate = CardLoader.getById(sourceCard.scryfallId);
    if (sourceTemplate) {
      const sourceColors = getSourceColors(sourceTemplate);

      // Check protection from all colors
      if (hasProtectionFromAllColors(template) && sourceColors.length > 0) {
        return ['Target has protection from all colors'];
      }

      // Check protection from specific colors
      for (const color of sourceColors) {
        if (hasProtectionFrom(template, color)) {
          const colorNames: Record<MtgColor, string> = {
            W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green'
          };
          return [`Target has protection from ${colorNames[color]}`];
        }
      }
    }
  }

  // Check target type matches
  const typeError = validateTargetType(template, target, requirement.targetType);
  if (typeError) {
    return [typeError];
  }

  // Check restrictions
  for (const restriction of requirement.restrictions) {
    const restrictionError = validateRestriction(
      state,
      target,
      template,
      restriction,
      controller
    );
    if (restrictionError) {
      return [restrictionError];
    }
  }

  return [];
}

/**
 * Validate that a card matches the required target type
 */
function validateTargetType(
  template: CardTemplate,
  card: CardInstance,
  targetType: TargetType
): string | null {
  switch (targetType) {
    case 'any':
      // Any permanent is valid (players handled separately)
      return null;

    case 'creature':
      if (!isCreature(template)) {
        return 'Target must be a creature';
      }
      return null;

    case 'permanent':
      // Any card on battlefield is a permanent
      if (card.zone !== 'battlefield') {
        return 'Target must be a permanent';
      }
      return null;

    case 'artifact':
      if (!isArtifact(template)) {
        return 'Target must be an artifact';
      }
      return null;

    case 'enchantment':
      if (!isEnchantment(template)) {
        return 'Target must be an enchantment';
      }
      return null;

    case 'land':
      if (!isLand(template)) {
        return 'Target must be a land';
      }
      return null;

    case 'artifact_or_enchantment':
      if (!isArtifact(template) && !isEnchantment(template)) {
        return 'Target must be an artifact or enchantment';
      }
      return null;

    case 'player':
    case 'opponent':
      // These are handled at the player check level
      return 'Target must be a player';

    case 'spell':
    case 'creature_spell':
      // These are handled at the stack check level
      return 'Target must be a spell on the stack';

    default:
      return null;
  }
}

/**
 * Validate a single restriction
 */
function validateRestriction(
  state: GameState,
  card: CardInstance,
  template: CardTemplate,
  restriction: TargetRestriction,
  controller: PlayerId
): string | null {
  switch (restriction.type) {
    case 'color': {
      const hasColor = template.colors.includes(restriction.color);
      if (restriction.negated) {
        // "nonblack" - must NOT have the color
        if (hasColor) {
          const colorNames: Record<MtgColor, string> = {
            W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green'
          };
          return `Target cannot be ${colorNames[restriction.color]}`;
        }
      } else {
        // "black" - must HAVE the color
        if (!hasColor) {
          return `Target must be ${restriction.color}`;
        }
      }
      return null;
    }

    case 'controller':
      if (restriction.controller === 'you') {
        if (card.controller !== controller) {
          return 'Target must be controlled by you';
        }
      } else {
        if (card.controller === controller) {
          return 'Target must be controlled by an opponent';
        }
      }
      return null;

    case 'combat':
      if (restriction.status === 'attacking') {
        if (!card.attacking) {
          return 'Target must be attacking';
        }
      } else if (restriction.status === 'blocking') {
        if (!card.blocking) {
          return 'Target must be blocking';
        }
      } else if (restriction.status === 'attacking_or_blocking') {
        if (!card.attacking && !card.blocking) {
          return 'Target must be attacking or blocking';
        }
      }
      return null;

    case 'tapped':
      if (!card.tapped) {
        return 'Target must be tapped';
      }
      return null;

    case 'untapped':
      if (card.tapped) {
        return 'Target must be untapped';
      }
      return null;

    case 'nonartifact':
      if (isArtifact(template)) {
        return 'Target cannot be an artifact';
      }
      return null;

    case 'nonland':
      if (isLand(template)) {
        return 'Target cannot be a land';
      }
      return null;

    default:
      return null;
  }
}

// =============================================================================
// LEGAL TARGET GENERATION
// =============================================================================

/**
 * Get all legal targets for a requirement
 *
 * Used by getLegalActions() to generate valid (spell, targets) combinations
 */
export function getLegalTargets(
  state: GameState,
  requirement: TargetRequirement,
  controller: PlayerId,
  sourceCard?: CardInstance
): string[] {
  const validTargets: string[] = [];

  // === Player Targets ===
  if (requirement.targetType === 'any' ||
      requirement.targetType === 'player' ||
      requirement.targetType === 'opponent') {

    if (requirement.targetType === 'opponent') {
      // Only the opponent
      validTargets.push(controller === 'player' ? 'opponent' : 'player');
    } else {
      // Both players
      validTargets.push('player', 'opponent');
    }
  }

  // === Stack Targets ===
  if (requirement.zone === 'stack' ||
      requirement.targetType === 'spell' ||
      requirement.targetType === 'creature_spell') {

    for (const stackObj of state.stack) {
      // Skip our own spell that's creating this targeting
      if (sourceCard && stackObj.card.instanceId === sourceCard.instanceId) {
        continue;
      }

      // Check creature spell restriction
      if (requirement.targetType === 'creature_spell') {
        const template = CardLoader.getById(stackObj.card.scryfallId);
        if (!template || !template.type_line.includes('Creature')) {
          continue;
        }
      }

      validTargets.push(stackObj.id);
    }

    return validTargets;
  }

  // === Battlefield Targets ===
  if (requirement.zone === 'battlefield' || requirement.zone === 'any') {
    for (const playerId of ['player', 'opponent'] as const) {
      const player = state.players[playerId];

      for (const card of player.battlefield) {
        const template = CardLoader.getById(card.scryfallId);
        if (!template) continue;

        // Check all validation rules
        const errors = validateSingleTarget(
          state,
          card.instanceId,
          requirement,
          controller,
          sourceCard
        );

        if (errors.length === 0) {
          validTargets.push(card.instanceId);
        }
      }
    }
  }

  // === Graveyard Targets (for recursion spells) ===
  if (requirement.zone === 'graveyard') {
    for (const playerId of ['player', 'opponent'] as const) {
      const player = state.players[playerId];

      for (const card of player.graveyard) {
        const template = CardLoader.getById(card.scryfallId);
        if (!template) continue;

        const errors = validateSingleTarget(
          state,
          card.instanceId,
          requirement,
          controller,
          sourceCard
        );

        if (errors.length === 0) {
          validTargets.push(card.instanceId);
        }
      }
    }
  }

  return validTargets;
}

/**
 * Generate all valid target combinations for a set of requirements
 *
 * For single-target spells, returns array of single-element arrays.
 * For multi-target spells, returns array of all valid combinations.
 */
export function getAllLegalTargetCombinations(
  state: GameState,
  requirements: TargetRequirement[],
  controller: PlayerId,
  sourceCard?: CardInstance
): string[][] {
  if (requirements.length === 0) {
    return [[]]; // No targets needed
  }

  // Get legal targets for each requirement
  const targetsPerRequirement: string[][] = requirements.map(req =>
    getLegalTargets(state, req, controller, sourceCard)
  );

  // Check if any required target has no valid options
  for (let i = 0; i < requirements.length; i++) {
    if (!requirements[i]!.optional && targetsPerRequirement[i]!.length === 0) {
      return []; // Can't fulfill a required target
    }
  }

  // Generate combinations (cartesian product)
  // For simplicity, we handle single-target and dual-target cases
  if (requirements.length === 1) {
    return targetsPerRequirement[0]!.map(t => [t]);
  }

  if (requirements.length === 2) {
    const combinations: string[][] = [];
    for (const t1 of targetsPerRequirement[0]!) {
      for (const t2 of targetsPerRequirement[1]!) {
        // Avoid duplicate targets unless explicitly allowed
        if (t1 !== t2) {
          combinations.push([t1, t2]);
        }
      }
    }
    return combinations;
  }

  // For 3+ requirements, use recursive approach
  return generateCombinations(targetsPerRequirement, 0, []);
}

/**
 * Recursively generate target combinations
 */
function generateCombinations(
  targetsPerReq: string[][],
  index: number,
  current: string[]
): string[][] {
  if (index >= targetsPerReq.length) {
    return [current];
  }

  const combinations: string[][] = [];
  for (const target of targetsPerReq[index]!) {
    // Avoid duplicates
    if (!current.includes(target)) {
      combinations.push(
        ...generateCombinations(targetsPerReq, index + 1, [...current, target])
      );
    }
  }

  return combinations;
}

// =============================================================================
// TARGET LEGALITY CHECK (for fizzle)
// =============================================================================

/**
 * Check if targets are still legal when a spell/ability resolves
 *
 * If all targets became illegal, the spell fizzles.
 * If some targets became illegal, the spell still resolves for legal targets.
 */
export function checkTargetsStillLegal(
  state: GameState,
  targets: string[],
  requirements: TargetRequirement[],
  controller: PlayerId,
  sourceCard?: CardInstance
): { allIllegal: boolean; legalTargets: string[]; illegalTargets: string[] } {
  const legalTargets: string[] = [];
  const illegalTargets: string[] = [];

  let targetIndex = 0;
  for (const req of requirements) {
    for (let i = 0; i < req.count && targetIndex < targets.length; i++) {
      const targetId = targets[targetIndex]!;
      const errors = validateSingleTarget(state, targetId, req, controller, sourceCard);

      if (errors.length === 0) {
        legalTargets.push(targetId);
      } else {
        illegalTargets.push(targetId);
      }
      targetIndex++;
    }
  }

  return {
    allIllegal: legalTargets.length === 0 && targets.length > 0,
    legalTargets,
    illegalTargets,
  };
}

/**
 * Check if a spell should fizzle (all targets illegal)
 */
export function shouldSpellFizzle(
  state: GameState,
  targets: string[],
  requirements: TargetRequirement[],
  controller: PlayerId,
  sourceCard?: CardInstance
): boolean {
  if (targets.length === 0 || requirements.length === 0) {
    return false; // No targets = can't fizzle
  }

  const { allIllegal } = checkTargetsStillLegal(
    state,
    targets,
    requirements,
    controller,
    sourceCard
  );

  return allIllegal;
}
