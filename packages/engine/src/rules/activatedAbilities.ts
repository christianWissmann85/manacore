/**
 * Activated Abilities System
 *
 * Handles "{Cost}: {Effect}" abilities
 *
 * Phase 1 abilities:
 * - "{T}: Deal 1 damage to any target" (Prodigal Sorcerer)
 * - "{T}: Add {color}" (Basic lands and mana dorks)
 *
 * Mana abilities are special:
 * - They don't use the stack
 * - They resolve immediately
 * - Marked with isManaAbility: true
 */

import type { GameState } from '../state/GameState';
import type { CardInstance } from '../state/CardInstance';
import type { PlayerId } from '../state/Zone';
import { CardLoader } from '../cards/CardLoader';
import { isLand } from '../cards/CardTemplate';
import type { ManaColor } from '../utils/manaCosts';
import { getLandManaColors, parseManaCost, canPayManaCost, payManaCost, addManaToPool } from '../utils/manaCosts';
import type { TargetRequirement } from './targeting';

/**
 * Activated ability definition
 */
export interface ActivatedAbility {
  id: string;           // Unique ID for this ability
  name: string;         // Display name
  cost: AbilityCost;    // What you pay to activate
  effect: AbilityEffect; // What happens when it resolves
  isManaAbility: boolean; // Mana abilities don't use the stack
  targetRequirements?: TargetRequirement[]; // Targeting requirements (if ability targets)
  canActivate: (state: GameState, sourceId: string, controller: PlayerId) => boolean;
}

/**
 * Cost to activate an ability
 */
export interface AbilityCost {
  tap?: boolean;        // Tap the permanent
  mana?: string;        // Mana cost (e.g., "{2}{R}")
}

/**
 * Effect when ability resolves
 */
export interface AbilityEffect {
  type: 'DAMAGE' | 'DESTROY' | 'DRAW_CARD' | 'ADD_MANA' | 'CUSTOM';
  amount?: number;      // For damage or mana amount
  target?: string;      // Target instance ID
  manaColors?: ManaColor[]; // For ADD_MANA: colors that can be added
  custom?: (state: GameState) => void;
}

/**
 * Get all activated abilities for a card
 */
export function getActivatedAbilities(card: CardInstance, _state: GameState): ActivatedAbility[] {
  const template = CardLoader.getById(card.scryfallId);
  if (!template) return [];

  const abilities: ActivatedAbility[] = [];

  // Check if it's a land with mana abilities
  if (isLand(template)) {
    const manaAbilities = getManaAbilitiesForLand(card, template);
    abilities.push(...manaAbilities);
  }

  // Card-specific abilities
  switch (template.name) {
    case 'Prodigal Sorcerer':
      // "{T}: Prodigal Sorcerer deals 1 damage to any target"
      abilities.push({
        id: `${card.instanceId}_tap_damage`,
        name: 'Tap: Deal 1 damage to any target',
        cost: { tap: true },
        effect: { type: 'DAMAGE', amount: 1 },
        isManaAbility: false,
        targetRequirements: [{
          id: 'target_0',
          count: 1,
          targetType: 'any',
          zone: 'battlefield',
          restrictions: [],
          optional: false,
          description: 'any target',
        }],
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(c => c.instanceId === sourceId);
          if (!source) return false;
          if (source.tapped) return false;
          if (source.summoningSick) return false;
          return true;
        },
      });
      break;

    // Mana dorks (creatures that produce mana)
    case 'Llanowar Elves':
    case 'Fyndhorn Elves':
    case 'Elvish Mystic':
      abilities.push(createCreatureManaAbility(card, ['G']));
      break;

    case 'Birds of Paradise':
      // Can produce any color
      abilities.push(createCreatureManaAbility(card, ['W', 'U', 'B', 'R', 'G']));
      break;

    case 'Anaba Shaman':
      // "{R}, {T}: Anaba Shaman deals 1 damage to any target"
      abilities.push({
        id: `${card.instanceId}_tap_damage`,
        name: '{R}, Tap: Deal 1 damage to any target',
        cost: { tap: true, mana: '{R}' },
        effect: { type: 'DAMAGE', amount: 1 },
        isManaAbility: false,
        targetRequirements: [{
          id: 'target_0',
          count: 1,
          targetType: 'any',
          zone: 'battlefield',
          restrictions: [],
          optional: false,
          description: 'any target',
        }],
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(c => c.instanceId === sourceId);
          if (!source) return false;
          if (source.tapped) return false;
          if (source.summoningSick) return false;

          // Check if player can pay {R}
          const player = state.players[controller];
          const totalRedMana = player.manaPool.red +
            player.battlefield.filter(p => {
              if (p.tapped) return false;
              const t = CardLoader.getById(p.scryfallId);
              return t && (t.name === 'Mountain' || getLandManaColors(t.name).includes('R'));
            }).length;
          return totalRedMana >= 1;
        },
      });
      break;

    // Add more cards with activated abilities here
  }

  return abilities;
}

/**
 * Get mana abilities for a land card
 */
function getManaAbilitiesForLand(card: CardInstance, template: { type_line: string; oracle_text?: string; name: string }): ActivatedAbility[] {
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
        const source = _state.players[controller].battlefield.find(c => c.instanceId === sourceId);
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
function parseManaAbilitiesFromOracleText(card: CardInstance, oracleText: string): ActivatedAbility[] {
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
          const source = _state.players[controller].battlefield.find(c => c.instanceId === sourceId);
          if (!source) return false;
          if (source.tapped) return false;
          return true;
        },
      });
    }
  }

  // If no mana abilities found via pattern, check for simple colorless producers
  if (abilities.length === 0 && oracleText.includes('{T}') && oracleText.toLowerCase().includes('add')) {
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
        const source = _state.players[controller].battlefield.find(c => c.instanceId === sourceId);
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
 * Create a mana ability for a creature (like Llanowar Elves)
 */
function createCreatureManaAbility(card: CardInstance, colors: ManaColor[]): ActivatedAbility {
  return {
    id: `${card.instanceId}_tap_mana`,
    name: `Tap: Add {${colors[0]}}`,
    cost: { tap: true },
    effect: {
      type: 'ADD_MANA',
      amount: 1,
      manaColors: colors,
    },
    isManaAbility: true,
    canActivate: (_state: GameState, sourceId: string, controller: PlayerId) => {
      const source = _state.players[controller].battlefield.find(c => c.instanceId === sourceId);
      if (!source) return false;
      if (source.tapped) return false;
      // Creatures DO have summoning sickness for tap abilities
      if (source.summoningSick) return false;
      return true;
    },
  };
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
export function payCosts(state: GameState, sourceId: string, cost: AbilityCost): boolean {
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
  manaColorChoice?: ManaColor
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
          amount
        );
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
    const creature = player.battlefield.find(c => c.instanceId === targetId);

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
      if (zone.find(c => c.instanceId === cardId)) {
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
      const card = zone.find(c => c.instanceId === cardId);
      if (card) return card;
    }
  }

  return null;
}
