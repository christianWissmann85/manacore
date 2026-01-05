/**
 * Activated Abilities System (Legacy)
 *
 * NOTE: All card-specific abilities have been migrated to the new registry-based system.
 * This file now only contains:
 * - Generic land mana abilities (basic lands, etc.)
 * - Helper functions (payCosts, applyEffect, etc.)
 * - Type re-exports for backwards compatibility
 *
 * The main getActivatedAbilities function delegates to the new system
 * in ./abilities/index.ts, which uses O(1) registry lookup.
 *
 * Card-specific abilities are registered in ./abilities/sets/6ed/
 */

import type { GameState } from '../state/GameState';
import type { CardInstance } from '../state/CardInstance';
import type { PlayerId } from '../state/Zone';
import { CardLoader } from '../cards/CardLoader';
import { isLand } from '../cards/CardTemplate';
import type { ManaColor } from '../utils/manaCosts';
import {
  getLandManaColors,
  parseManaCost,
  canPayManaCost,
  payManaCost,
  addManaToPool,
} from '../utils/manaCosts';
import type { TargetRequirement } from './targeting';

// Import the new registry-based system
import {
  getActivatedAbilities as getAbilitiesFromRegistry,
  getGraveyardAbilities as getGraveyardAbilitiesFromRegistry,
} from './abilities';

/**
 * Activated ability definition
 */
export interface ActivatedAbility {
  id: string; // Unique ID for this ability
  name: string; // Display name
  cost: AbilityCost; // What you pay to activate
  effect: AbilityEffect; // What happens when it resolves
  isManaAbility: boolean; // Mana abilities don't use the stack
  targetRequirements?: TargetRequirement[]; // Targeting requirements (if ability targets)
  canActivate: (state: GameState, sourceId: string, controller: PlayerId) => boolean;
}

/**
 * Cost to activate an ability
 */
export interface AbilityCost {
  tap?: boolean; // Tap the permanent
  mana?: string; // Mana cost (e.g., "{2}{R}")
  sacrifice?: SacrificeCost; // Sacrifice cost
  life?: number; // Pay life cost
}

/**
 * Sacrifice cost definition
 */
export interface SacrificeCost {
  type: 'self' | 'creature' | 'permanent' | 'artifact' | 'land';
  count?: number; // How many to sacrifice (default 1)
  restriction?: {
    notSelf?: boolean; // Can't sacrifice the source
    mustBeControlled?: boolean; // Must sacrifice your own
  };
}

/**
 * Effect when ability resolves
 */
export interface AbilityEffect {
  type: 'DAMAGE' | 'DESTROY' | 'DRAW_CARD' | 'ADD_MANA' | 'REGENERATE' | 'CUSTOM';
  amount?: number; // For damage or mana amount
  target?: string; // Target instance ID
  manaColors?: ManaColor[]; // For ADD_MANA: colors that can be added
  custom?: (state: GameState) => void;
}

/**
 * Get all activated abilities for a card
 *
 * This function delegates to the new registry-based system for most cards.
 * Special lands (pain lands, depletion lands) are still handled here.
 */
export function getActivatedAbilities(card: CardInstance, state: GameState): ActivatedAbility[] {
  // Delegate to the new registry-based system
  // The registry handles most cards with O(1) lookup, falling back to
  // the legacy getLegacyAbilities function for non-migrated cards
  return getAbilitiesFromRegistry(card, state) as ActivatedAbility[];
}

/**
 * Get all graveyard abilities for a card
 *
 * For cards like Necrosavant that can activate abilities from the graveyard.
 */
export function getGraveyardAbilities(card: CardInstance, state: GameState): ActivatedAbility[] {
  return getGraveyardAbilitiesFromRegistry(card, state) as ActivatedAbility[];
}

/**
 * Legacy ability lookup for cards not yet migrated to registry
 *
 * This function is called by the new system as a fallback for cards
 * not found in the registry.
 *
 * NOTE: Most cards have been migrated to the registry-based system.
 * This function now only handles:
 * - Generic land mana abilities (basic lands, etc.)
 * - Cards that only have keyword abilities or ETB triggers (no activated abilities)
 */
export function getLegacyAbilities(card: CardInstance, _state: GameState): ActivatedAbility[] {
  const template = CardLoader.getById(card.scryfallId);
  if (!template) return [];

  const abilities: ActivatedAbility[] = [];

  // Check if it's a land with mana abilities
  if (isLand(template)) {
    const manaAbilities = getManaAbilitiesForLand(card, template);
    abilities.push(...manaAbilities);
  }

  // Card-specific abilities for non-migrated cards
  // Most activated abilities are now in ./abilities/sets/6ed/
  switch (template.name) {
    // ========================================
    // CREATURES WITH KEYWORD-ONLY OR ETB TRIGGERS
    // (No activated abilities - just here for documentation)
    // ========================================

    case 'Sengir Autocrat':
      // Creates 0/1 Serf tokens (ETB trigger, handled in triggers.ts)
      // Serfs leave when Autocrat leaves (trigger)
      break;

    case 'Balduvian Horde':
      // ETB: Sacrifice a creature or counter (handled in triggers)
      break;

    case 'Wall of Swords':
      // Flying, Defender (keyword-only)
      break;

    case 'Wall of Spears':
      // First Strike, Defender (keyword-only)
      break;
  }

  return abilities;
}

/**
 * Lands with custom mana ability implementations in the switch/case
 * These should NOT be processed by generic oracle text parsing
 */
const LANDS_WITH_CUSTOM_ABILITIES = new Set([
  // Pain lands
  'Adarkar Wastes',
  'Brushland',
  'Karplusan Forest',
  'Sulfurous Springs',
  'Underground River',
  // City of Brass
  'City of Brass',
  // Sacrifice lands
  'Crystal Vein',
  'Dwarven Ruins',
  'Ebon Stronghold',
  'Havenwood Battleground',
  'Ruins of Trokair',
  'Svyelunite Temple',
]);

/**
 * Get mana abilities for a land card
 */
function getManaAbilitiesForLand(
  card: CardInstance,
  template: { type_line: string; oracle_text?: string; name: string },
): ActivatedAbility[] {
  // Skip generic parsing for lands with custom implementations
  if (LANDS_WITH_CUSTOM_ABILITIES.has(template.name)) {
    return [];
  }

  const abilities: ActivatedAbility[] = [];

  // Basic lands: detect from type line (Plains, Island, Swamp, Mountain, Forest)
  const basicColors = getLandManaColors(template.type_line);

  if (basicColors.length > 0) {
    // Basic land or land with basic land types
    abilities.push({
      id: `${card.instanceId}_tap_mana`,
      name: `Tap: Add {${basicColors[0]}}`,
      cost: { tap: true },
      effect: {
        type: 'ADD_MANA',
        amount: 1,
        manaColors: basicColors,
      },
      isManaAbility: true,
      canActivate: (_state: GameState, sourceId: string, controller: PlayerId) => {
        const source = _state.players[controller].battlefield.find(
          (c) => c.instanceId === sourceId,
        );
        if (!source) return false;
        if (source.tapped) return false;
        // Lands don't have summoning sickness for mana abilities
        return true;
      },
    });
  } else if (template.oracle_text) {
    // Non-basic lands: parse oracle text for mana abilities
    const parsedAbilities = parseManaAbilitiesFromOracleText(card, template.oracle_text);
    abilities.push(...parsedAbilities);
  }

  return abilities;
}

/**
 * Parse mana abilities from oracle text
 *
 * Handles patterns like:
 * - "{T}: Add {C}."
 * - "{T}: Add {W} or {U}."
 * - "{T}: Add {G}{G}."
 */
function parseManaAbilitiesFromOracleText(
  card: CardInstance,
  oracleText: string,
): ActivatedAbility[] {
  const abilities: ActivatedAbility[] = [];

  // Pattern: "{T}: Add {X}" or "{T}: Add {X} or {Y}"
  const tapAddPattern = /\{T\}:\s*Add\s+(.+?)(?:\.|$)/gi;
  let match;

  while ((match = tapAddPattern.exec(oracleText)) !== null) {
    const manaText = match[1]!;
    const colors = extractManaColorsFromText(manaText);

    if (colors.length > 0) {
      abilities.push({
        id: `${card.instanceId}_tap_mana_${abilities.length}`,
        name: `Tap: Add mana`,
        cost: { tap: true },
        effect: {
          type: 'ADD_MANA',
          amount: 1,
          manaColors: colors,
        },
        isManaAbility: true,
        canActivate: (_state: GameState, sourceId: string, controller: PlayerId) => {
          const source = _state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          if (source.tapped) return false;
          return true;
        },
      });
    }
  }

  // If no mana abilities found via pattern, check for simple colorless producers
  if (
    abilities.length === 0 &&
    oracleText.includes('{T}') &&
    oracleText.toLowerCase().includes('add')
  ) {
    // Default to colorless if we can't parse
    abilities.push({
      id: `${card.instanceId}_tap_mana`,
      name: 'Tap: Add {C}',
      cost: { tap: true },
      effect: {
        type: 'ADD_MANA',
        amount: 1,
        manaColors: ['C'],
      },
      isManaAbility: true,
      canActivate: (_state: GameState, sourceId: string, controller: PlayerId) => {
        const source = _state.players[controller].battlefield.find(
          (c) => c.instanceId === sourceId,
        );
        if (!source) return false;
        if (source.tapped) return false;
        return true;
      },
    });
  }

  return abilities;
}

/**
 * Extract mana colors from text like "{W} or {U}" or "{G}{G}"
 */
function extractManaColorsFromText(text: string): ManaColor[] {
  const colors: ManaColor[] = [];
  const colorPattern = /\{([WUBRGC])\}/gi;
  let match;

  while ((match = colorPattern.exec(text)) !== null) {
    const color = match[1]!.toUpperCase() as ManaColor;
    if (!colors.includes(color)) {
      colors.push(color);
    }
  }

  return colors;
}

/**
 * Check if a card has any activated abilities
 */
export function hasActivatedAbilities(card: CardInstance, state: GameState): boolean {
  return getActivatedAbilities(card, state).length > 0;
}

/**
 * Activate an ability (pay costs)
 *
 * Note: This mutates the state directly (caller should have cloned)
 *
 * @returns true if costs were paid successfully
 */
export function payCosts(
  state: GameState,
  sourceId: string,
  cost: AbilityCost,
  sacrificeTargetId?: string, // For non-self sacrifice, which creature to sacrifice
): boolean {
  const controller = findCardController(state, sourceId);
  if (!controller) return false;

  const card = findCard(state, sourceId);
  if (!card) return false;

  const player = state.players[controller];

  // Check if we can pay the mana cost first
  if (cost.mana) {
    const manaCost = parseManaCost(cost.mana);
    if (!canPayManaCost(player.manaPool, manaCost)) {
      return false;
    }
  }

  // Pay tap cost
  if (cost.tap) {
    if (card.tapped) return false;
    card.tapped = true;
  }

  // Pay mana cost
  if (cost.mana) {
    const manaCost = parseManaCost(cost.mana);
    player.manaPool = payManaCost(player.manaPool, manaCost);
  }

  // Pay life cost
  if (cost.life) {
    if (player.life < cost.life) return false;
    player.life -= cost.life;
  }

  // Pay sacrifice cost
  if (cost.sacrifice) {
    const sacrificed = paySacrificeCost(
      state,
      controller,
      cost.sacrifice,
      sourceId,
      sacrificeTargetId,
    );
    if (!sacrificed) return false;
  }

  return true;
}

/**
 * Pay a sacrifice cost
 *
 * @param state - Game state (will be mutated)
 * @param controller - Player paying the cost
 * @param sacCost - Sacrifice cost definition
 * @param sourceId - ID of the ability source (for 'self' sacrifice)
 * @param targetId - ID of the permanent to sacrifice (for non-self sacrifice)
 * @returns true if sacrifice was successful
 */
function paySacrificeCost(
  state: GameState,
  controller: PlayerId,
  sacCost: SacrificeCost,
  sourceId: string,
  targetId?: string,
): boolean {
  const player = state.players[controller];

  if (sacCost.type === 'self') {
    // Sacrifice the source of the ability
    const sourceIndex = player.battlefield.findIndex((c) => c.instanceId === sourceId);
    if (sourceIndex === -1) return false;

    const source = player.battlefield[sourceIndex]!;

    // Remove from battlefield
    player.battlefield.splice(sourceIndex, 1);

    // Move to graveyard
    source.zone = 'graveyard';
    source.damage = 0;
    source.tapped = false;
    player.graveyard.push(source);

    // Check if it's a creature for death triggers
    const template = CardLoader.getById(source.scryfallId);
    if (template && template.type_line?.toLowerCase().includes('creature')) {
      // Import would be circular, so we call registerTrigger inline
      // The trigger will be picked up by the SBA loop
      // For now, we'll rely on the SBA check to fire the trigger
    }

    return true;
  }

  // Non-self sacrifice: need a target to sacrifice
  if (!targetId) {
    // Auto-select a valid sacrifice target (first matching creature)
    const validTargets = player.battlefield.filter((c) => {
      // Skip the source if notSelf restriction
      if (sacCost.restriction?.notSelf && c.instanceId === sourceId) return false;

      const t = CardLoader.getById(c.scryfallId);
      if (!t) return false;

      switch (sacCost.type) {
        case 'creature':
          return t.type_line?.toLowerCase().includes('creature');
        case 'artifact':
          return t.type_line?.toLowerCase().includes('artifact');
        case 'land':
          return t.type_line?.toLowerCase().includes('land');
        case 'permanent':
          return true; // Any permanent
        default:
          return false;
      }
    });

    if (validTargets.length === 0) return false;
    targetId = validTargets[0]!.instanceId;
  }

  // Sacrifice the target
  const targetIndex = player.battlefield.findIndex((c) => c.instanceId === targetId);
  if (targetIndex === -1) return false;

  const target = player.battlefield[targetIndex]!;

  // Remove from battlefield
  player.battlefield.splice(targetIndex, 1);

  // Move to graveyard
  target.zone = 'graveyard';
  target.damage = 0;
  target.tapped = false;
  player.graveyard.push(target);

  return true;
}

/**
 * Apply ability effect
 *
 * @param state - Game state (will be mutated)
 * @param effect - The effect to apply
 * @param controller - Player who controls the ability (needed for ADD_MANA)
 * @param manaColorChoice - For multi-color mana abilities, which color was chosen
 */
export function applyAbilityEffect(
  state: GameState,
  effect: AbilityEffect,
  controller?: PlayerId,
  manaColorChoice?: ManaColor,
  sourceId?: string,
): void {
  switch (effect.type) {
    case 'DAMAGE':
      if (effect.target && effect.amount) {
        applyDamageToTarget(state, effect.target, effect.amount);
      }
      break;

    case 'ADD_MANA':
      if (controller && effect.manaColors && effect.manaColors.length > 0) {
        const amount = effect.amount ?? 1;
        // Use the chosen color, or default to the first available color
        const color = manaColorChoice ?? effect.manaColors[0]!;
        state.players[controller].manaPool = addManaToPool(
          state.players[controller].manaPool,
          color,
          amount,
        );
      }
      break;

    case 'REGENERATE':
      // Add a regeneration shield to the source creature
      // This protects it from the next destruction effect this turn
      if (sourceId && controller) {
        const creature = state.players[controller].battlefield.find(
          (c) => c.instanceId === sourceId,
        );
        if (creature) {
          creature.regenerationShields = (creature.regenerationShields || 0) + 1;
        }
      }
      break;

    case 'CUSTOM':
      if (effect.custom) {
        effect.custom(state);
      }
      break;

    // Add more effect types as needed
  }
}

/**
 * Apply damage to a target (player or creature)
 */
function applyDamageToTarget(state: GameState, targetId: string, amount: number): void {
  // Check if target is a player
  if (targetId === 'player' || targetId === 'opponent') {
    state.players[targetId].life -= amount;
    return;
  }

  // Otherwise, target is a creature
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];
    const creature = player.battlefield.find((c) => c.instanceId === targetId);

    if (creature) {
      creature.damage += amount;
      break;
    }
  }
}

/**
 * Find which player controls a card
 */
function findCardController(state: GameState, cardId: string): PlayerId | null {
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];

    for (const zone of [player.battlefield, player.hand, player.graveyard, player.library]) {
      if (zone.find((c) => c.instanceId === cardId)) {
        return playerId;
      }
    }
  }

  return null;
}

/**
 * Find a card instance
 */
function findCard(state: GameState, cardId: string): CardInstance | null {
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];

    for (const zone of [player.battlefield, player.hand, player.graveyard, player.library]) {
      const card = zone.find((c) => c.instanceId === cardId);
      if (card) return card;
    }
  }

  return null;
}
