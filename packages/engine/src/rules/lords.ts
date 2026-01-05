/**
 * Lords System - Query-Time Power/Toughness and Keyword Calculation
 *
 * This module handles Lord creatures that grant bonuses to other creatures,
 * as well as global enchantment effects (anthems) and aura effects.
 *
 * Lords in 6th Edition:
 * - Goblin King: Other Goblins get +1/+1 and have mountainwalk
 * - Lord of Atlantis: Other Merfolk get +1/+1 and have islandwalk
 *
 * Anthem Enchantments:
 * - Castle: Untapped creatures you control get +0/+2
 * - Crusade: White creatures get +1/+1
 * - Dread of Night: White creatures get -1/-1
 * - Fervor: Creatures you control have haste
 * - Orcish Oriflamme: Attacking creatures you control get +1/+0
 * - Serra's Blessing: Creatures you control have vigilance
 *
 * Auras (Phase 1.5.5):
 * - Stat modifications: Divine Transformation, Giant Strength, Hero's Resolve, etc.
 * - Keyword granting: Flight, Fear, Burrowing, Leshrac's Rite
 * - Ability granting: Firebreathing, Regeneration (handled via ability registry)
 * - Combat prevention: Pacifism (handled via validators.ts)
 *
 * Variable P/T Creatures (Phase 1.5.4):
 * - Maro: P/T = cards in hand
 * - Nightmare: P/T = Swamps you control
 * - Uktabi Wildcats: P/T = Forests you control
 * - Primal Clay: Choice on ETB (3/3, 2/2 flying, or 1/6 wall)
 */

import type { GameState } from '../state/GameState';
import type { PlayerId } from '../state/Zone';
import type { CardInstance } from '../state/CardInstance';
import { CardLoader } from '../cards/CardLoader';
import { isCreature, isAura } from '../cards/CardTemplate';

/**
 * Lord bonus definition
 */
interface LordBonus {
  powerBonus: number;
  toughnessBonus: number;
  grantedKeywords: string[];
}

/**
 * Get creature subtypes from a card's type line
 * e.g., "Creature — Goblin" => ["Goblin"]
 * e.g., "Creature — Merfolk Wizard" => ["Merfolk", "Wizard"]
 */
export function getCreatureSubtypes(typeLine: string): string[] {
  if (!typeLine.includes('Creature')) return [];

  const dashIndex = typeLine.indexOf('—');
  if (dashIndex === -1) return [];

  const subtypePart = typeLine.slice(dashIndex + 1).trim();
  return subtypePart.split(/\s+/).filter((s) => s.length > 0);
}

/**
 * Check if a creature has a specific subtype
 */
export function hasCreatureSubtype(typeLine: string, subtype: string): boolean {
  const subtypes = getCreatureSubtypes(typeLine);
  return subtypes.some((s) => s.toLowerCase() === subtype.toLowerCase());
}

/**
 * Get the color of a card
 */
function getCardColors(template: { colors?: string[] }): string[] {
  return template.colors || [];
}

// ==========================================
// VARIABLE P/T CALCULATION (Phase 1.5.4)
// ==========================================

/**
 * Count lands of a specific type controlled by a player
 * Checks basic land types (Plains, Island, Swamp, Mountain, Forest)
 */
function countLandsOfType(state: GameState, controller: PlayerId, landType: string): number {
  const player = state.players[controller as keyof typeof state.players];
  let count = 0;

  for (const card of player.battlefield) {
    const template = CardLoader.getById(card.scryfallId);
    if (!template) continue;

    // Check if it's the basic land type
    if (template.type_line?.includes(landType)) {
      count++;
    }
  }

  return count;
}

/**
 * Calculate base power/toughness for creatures with variable P/T (star/star)
 * Returns { power, toughness } or null if not a variable P/T creature
 */
export function calculateVariablePT(
  state: GameState,
  card: CardInstance,
  template: { name: string; power?: string; toughness?: string },
): { power: number; toughness: number } | null {
  // Only process creatures with * in power or toughness
  if (template.power !== '*' && template.toughness !== '*') {
    return null;
  }

  const controller = card.controller;

  switch (template.name) {
    case 'Maro': {
      // "Maro's power and toughness are each equal to the number of cards in your hand."
      const cardsInHand = state.players[controller].hand.length;
      return { power: cardsInHand, toughness: cardsInHand };
    }

    case 'Nightmare': {
      // "Nightmare's power and toughness are each equal to the number of Swamps you control."
      const swampCount = countLandsOfType(state, controller, 'Swamp');
      return { power: swampCount, toughness: swampCount };
    }

    case 'Uktabi Wildcats': {
      // "Uktabi Wildcats's power and toughness are each equal to the number of Forests you control."
      const forestCount = countLandsOfType(state, controller, 'Forest');
      return { power: forestCount, toughness: forestCount };
    }

    case 'Primal Clay': {
      // Default to 3/3 if no choice has been made // The choice is stored on the card instance when it enters // "As Primal Clay enters the battlefield, it becomes your choice of..."
      const choice = card.primalClayChoice || '3/3';
      switch (choice) {
        case '2/2 flying':
          return { power: 2, toughness: 2 };
        case '1/6 wall':
          return { power: 1, toughness: 6 };
        case '3/3':
        default:
          return { power: 3, toughness: 3 };
      }
    }

    default:
      // Unknown variable P/T creature - default to 0/0
      return { power: 0, toughness: 0 };
  }
}

/**
 * Calculate Lord bonuses for a creature based on battlefield state
 * Uses query-time calculation (no state mutation)
 */
export function getLordBonuses(
  state: GameState,
  targetCard: CardInstance,
  targetTemplate: { type_line: string; colors?: string[] },
): LordBonus {
  let powerBonus = 0;
  let toughnessBonus = 0;
  const grantedKeywords: string[] = [];

  const targetSubtypes = getCreatureSubtypes(targetTemplate.type_line);
  const targetColors = getCardColors(targetTemplate);
  const targetController = targetCard.controller;

  // Check all permanents on battlefield for Lord effects
  const playerIds: PlayerId[] = ['player', 'opponent'];
  for (const playerId of playerIds) {
    const player = state.players[playerId as keyof typeof state.players];

    for (const permanent of player.battlefield) {
      // Skip the target card itself (Lords don't affect themselves)
      if (permanent.instanceId === targetCard.instanceId) continue;

      const template = CardLoader.getById(permanent.scryfallId);
      if (!template) continue;

      // Check for Lord creatures
      if (isCreature(template)) {
        const bonus = checkLordCreature(
          template.name,
          targetCard,
          targetSubtypes,
          playerId,
          permanent,
        );
        powerBonus += bonus.powerBonus;
        toughnessBonus += bonus.toughnessBonus;
        grantedKeywords.push(...bonus.grantedKeywords);
      }

      // Check for anthem enchantments
      if (template.type_line.includes('Enchantment') && !template.type_line.includes('Aura')) {
        const bonus = checkAnthemEnchantment(
          template.name,
          targetCard,
          targetColors,
          playerId,
          targetController,
        );
        powerBonus += bonus.powerBonus;
        toughnessBonus += bonus.toughnessBonus;
        grantedKeywords.push(...bonus.grantedKeywords);
      }
    }
  }

  return { powerBonus, toughnessBonus, grantedKeywords };
}

/**
 * Check if a Lord creature grants bonuses to a target creature
 */
function checkLordCreature(
  lordName: string,
  targetCard: CardInstance,
  targetSubtypes: string[],
  lordController: PlayerId,
  _lordCard: CardInstance,
): LordBonus {
  const result: LordBonus = { powerBonus: 0, toughnessBonus: 0, grantedKeywords: [] };

  switch (lordName) {
    case 'Goblin King':
      // "Other Goblins get +1/+1 and have mountainwalk."
      // Only affects controller's creatures
      if (targetCard.controller === lordController && targetSubtypes.includes('Goblin')) {
        result.powerBonus = 1;
        result.toughnessBonus = 1;
        result.grantedKeywords.push('Mountainwalk');
      }
      break;

    case 'Lord of Atlantis':
      // "Other Merfolk get +1/+1 and have islandwalk."
      // Note: This affects ALL Merfolk, not just controller's (from original wording)
      if (targetSubtypes.includes('Merfolk')) {
        result.powerBonus = 1;
        result.toughnessBonus = 1;
        result.grantedKeywords.push('Islandwalk');
      }
      break;

    case 'Zombie Master':
      // "Other Zombie creatures have swampwalk."
      // Also gives regeneration, but that's handled separately
      if (targetCard.controller === lordController && targetSubtypes.includes('Zombie')) {
        result.grantedKeywords.push('Swampwalk');
      }
      break;
  }

  return result;
}

/**
 * Check if an anthem enchantment grants bonuses to a target creature
 */
function checkAnthemEnchantment(
  enchantmentName: string,
  targetCard: CardInstance,
  targetColors: string[],
  enchantmentController: PlayerId,
  targetController: PlayerId,
): LordBonus {
  const result: LordBonus = { powerBonus: 0, toughnessBonus: 0, grantedKeywords: [] };

  switch (enchantmentName) {
    case 'Crusade':
      // "White creatures get +1/+1."
      if (targetColors.includes('W')) {
        result.powerBonus = 1;
        result.toughnessBonus = 1;
      }
      break;

    case 'Dread of Night':
      // "White creatures get -1/-1."
      if (targetColors.includes('W')) {
        result.powerBonus = -1;
        result.toughnessBonus = -1;
      }
      break;

    case 'Castle':
      // "Untapped creatures you control get +0/+2."
      if (targetController === enchantmentController && !targetCard.tapped) {
        result.toughnessBonus = 2;
      }
      break;

    case 'Orcish Oriflamme':
      // "Attacking creatures you control get +1/+0."
      if (targetController === enchantmentController && targetCard.attacking) {
        result.powerBonus = 1;
      }
      break;

    case 'Fervor':
      // "Creatures you control have haste."
      if (targetController === enchantmentController) {
        result.grantedKeywords.push('Haste');
      }
      break;

    case "Serra's Blessing":
      // "Creatures you control have vigilance."
      if (targetController === enchantmentController) {
        result.grantedKeywords.push('Vigilance');
      }
      break;
  }

  return result;
}

// ==========================================
// AURA EFFECTS (Phase 1.5.5)
// ==========================================

/**
 * Aura stat modification definitions
 * Maps aura name to { powerBonus, toughnessBonus }
 */
const AURA_STAT_MODIFICATIONS: Record<string, { power: number; toughness: number }> = {
  // Positive stat buffs (6th Edition)
  'Divine Transformation': { power: 3, toughness: 3 },
  'Giant Strength': { power: 2, toughness: 2 },
  "Hero's Resolve": { power: 1, toughness: 5 },
  'Feast of the Unicorn': { power: 4, toughness: 0 },

  // Negative stat debuffs (6th Edition)
  Enfeeblement: { power: -2, toughness: -2 },
};

/**
 * Aura keyword grants
 * Maps aura name to keywords it grants
 */
const AURA_KEYWORD_GRANTS: Record<string, string[]> = {
  Flight: ['Flying'],
  Fear: ['Fear'],
  Burrowing: ['Mountainwalk'],
  "Leshrac's Rite": ['Swampwalk'],
};

/**
 * Aura ability grants
 * Maps aura name to ability type it grants
 * Actual ability creation is done in getAuraGrantedAbilities
 */
type AuraAbilityType = 'firebreathing' | 'regeneration';
const AURA_ABILITY_GRANTS: Record<string, AuraAbilityType> = {
  Firebreathing: 'firebreathing',
  Regeneration: 'regeneration',
};

/**
 * Get activated abilities granted by auras attached to a creature
 * These are abilities the creature can activate due to aura enchantments
 *
 * @param state Game state
 * @param targetCard The creature to check for aura-granted abilities
 * @returns Array of ability definitions from attached auras
 */
export function getAuraGrantedAbilities(
  state: GameState,
  targetCard: CardInstance,
): AuraGrantedAbility[] {
  const abilities: AuraGrantedAbility[] = [];

  // No attachments = no granted abilities
  if (!targetCard.attachments || targetCard.attachments.length === 0) {
    return abilities;
  }

  // Check each attachment
  for (const attachmentId of targetCard.attachments) {
    const aura = findAuraByInstanceId(state, attachmentId);
    if (!aura) continue;

    const auraTemplate = CardLoader.getById(aura.scryfallId);
    if (!auraTemplate || !isAura(auraTemplate)) continue;

    const abilityType = AURA_ABILITY_GRANTS[auraTemplate.name];
    if (!abilityType) continue;

    // Create the ability based on type
    const ability = createAuraGrantedAbility(abilityType, targetCard, aura, auraTemplate.name);
    if (ability) {
      abilities.push(ability);
    }
  }

  return abilities;
}

/**
 * Aura-granted ability definition
 * Extends the standard ability format with aura reference
 */
export interface AuraGrantedAbility {
  id: string;
  name: string;
  auraInstanceId: string;
  abilityType: AuraAbilityType;
  cost: {
    mana?: string;
    tap?: boolean;
  };
  effect: {
    type: 'PUMP' | 'REGENERATE';
    powerChange?: number;
    toughnessChange?: number;
  };
  isManaAbility: boolean;
}

/**
 * Create an ability definition for an aura-granted ability
 */
function createAuraGrantedAbility(
  abilityType: AuraAbilityType,
  creature: CardInstance,
  aura: CardInstance,
  _auraName: string, // Used for potential future logging/debugging
): AuraGrantedAbility | null {
  switch (abilityType) {
    case 'firebreathing':
      return {
        id: `${creature.instanceId}_aura_${aura.instanceId}_firebreathing`,
        name: '{R}: +1/+0 until end of turn',
        auraInstanceId: aura.instanceId,
        abilityType: 'firebreathing',
        cost: { mana: '{R}' },
        effect: {
          type: 'PUMP',
          powerChange: 1,
          toughnessChange: 0,
        },
        isManaAbility: false,
      };

    case 'regeneration':
      return {
        id: `${creature.instanceId}_aura_${aura.instanceId}_regeneration`,
        name: '{G}: Regenerate',
        auraInstanceId: aura.instanceId,
        abilityType: 'regeneration',
        cost: { mana: '{G}' },
        effect: {
          type: 'REGENERATE',
        },
        isManaAbility: false,
      };

    default:
      return null;
  }
}

/**
 * Check if an aura grants bonuses to the enchanted creature
 * Called for each aura attached to the target creature
 */
function checkAuraEffects(auraName: string): LordBonus {
  const result: LordBonus = { powerBonus: 0, toughnessBonus: 0, grantedKeywords: [] };

  // Check stat modifications
  const statMod = AURA_STAT_MODIFICATIONS[auraName];
  if (statMod) {
    result.powerBonus = statMod.power;
    result.toughnessBonus = statMod.toughness;
  }

  // Check keyword grants
  const keywords = AURA_KEYWORD_GRANTS[auraName];
  if (keywords) {
    result.grantedKeywords.push(...keywords);
  }

  return result;
}

/**
 * Get bonuses from all auras attached to a creature
 * Iterates through the creature's attachments array
 */
export function getAuraBonuses(state: GameState, targetCard: CardInstance): LordBonus {
  let powerBonus = 0;
  let toughnessBonus = 0;
  const grantedKeywords: string[] = [];

  // No attachments = no bonuses
  if (!targetCard.attachments || targetCard.attachments.length === 0) {
    return { powerBonus, toughnessBonus, grantedKeywords };
  }

  // Check each attachment
  for (const attachmentId of targetCard.attachments) {
    // Find the aura on the battlefield
    const aura = findAuraByInstanceId(state, attachmentId);
    if (!aura) continue;

    const auraTemplate = CardLoader.getById(aura.scryfallId);
    if (!auraTemplate || !isAura(auraTemplate)) continue;

    // Get bonuses from this aura
    const bonus = checkAuraEffects(auraTemplate.name);
    powerBonus += bonus.powerBonus;
    toughnessBonus += bonus.toughnessBonus;
    grantedKeywords.push(...bonus.grantedKeywords);
  }

  return { powerBonus, toughnessBonus, grantedKeywords };
}

/**
 * Find an aura by instance ID across all battlefields
 */
function findAuraByInstanceId(state: GameState, instanceId: string): CardInstance | undefined {
  for (const playerId of ['player', 'opponent'] as const) {
    const player = state.players[playerId];
    const found = player.battlefield.find((c) => c.instanceId === instanceId);
    if (found) return found;
  }
  return undefined;
}

/**
 * Get effective power including Lord/anthem bonuses
 * This is the main entry point for calculating power with all modifiers
 */
export function getEffectivePowerWithLords(
  state: GameState,
  card: CardInstance,
  basePower: number,
): number {
  const template = CardLoader.getById(card.scryfallId);

  // Check for variable P/T creatures first
  let power = basePower;
  if (template) {
    const variablePT = calculateVariablePT(state, card, template);
    if (variablePT !== null) {
      power = variablePT.power;
    }
  }

  // Add +1/+1 counters
  power += card.counters['+1/+1'] ?? 0;

  // Subtract -1/-1 counters
  power -= card.counters['-1/-1'] ?? 0;

  // Add temporary modifications (pump spells, etc.)
  for (const mod of card.temporaryModifications) {
    power += mod.powerChange;
  }

  // Add Lord/anthem bonuses (query-time calculation)
  if (template && isCreature(template)) {
    const lordBonus = getLordBonuses(state, card, template);
    power += lordBonus.powerBonus;

    // Add Aura bonuses (Phase 1.5.5)
    const auraBonus = getAuraBonuses(state, card);
    power += auraBonus.powerBonus;
  }

  return power;
}

/**
 * Get effective toughness including Lord/anthem/aura bonuses
 * This is the main entry point for calculating toughness with all modifiers
 */
export function getEffectiveToughnessWithLords(
  state: GameState,
  card: CardInstance,
  baseToughness: number,
): number {
  const template = CardLoader.getById(card.scryfallId);

  // Check for variable P/T creatures first
  let toughness = baseToughness;
  if (template) {
    const variablePT = calculateVariablePT(state, card, template);
    if (variablePT !== null) {
      toughness = variablePT.toughness;
    }
  }

  // Add +1/+1 counters
  toughness += card.counters['+1/+1'] ?? 0;

  // Subtract -1/-1 counters
  toughness -= card.counters['-1/-1'] ?? 0;

  // Add temporary modifications (pump spells, etc.)
  for (const mod of card.temporaryModifications) {
    toughness += mod.toughnessChange;
  }

  // Add Lord/anthem bonuses (query-time calculation)
  if (template && isCreature(template)) {
    const lordBonus = getLordBonuses(state, card, template);
    toughness += lordBonus.toughnessBonus;

    // Add Aura bonuses (Phase 1.5.5)
    const auraBonus = getAuraBonuses(state, card);
    toughness += auraBonus.toughnessBonus;
  }

  return toughness;
}

/**
 * Check if a creature has a keyword (including granted keywords from Lords/Auras)
 */
export function hasKeywordWithLords(
  state: GameState,
  card: CardInstance,
  keyword: string,
): boolean {
  const template = CardLoader.getById(card.scryfallId);
  if (!template) return false;

  // Check native keywords
  if (template.keywords?.includes(keyword)) {
    return true;
  }

  // Check Primal Clay special keywords based on choice
  if (template.name === 'Primal Clay') {
    if (card.primalClayChoice === '2/2 flying' && keyword === 'Flying') {
      return true;
    }
    if (card.primalClayChoice === '1/6 wall' && keyword === 'Defender') {
      return true;
    }
  }

  // Check granted keywords from Lords/anthems
  if (isCreature(template)) {
    const lordBonus = getLordBonuses(state, card, template);
    if (lordBonus.grantedKeywords.includes(keyword)) {
      return true;
    }

    // Check granted keywords from Auras (Phase 1.5.5)
    const auraBonus = getAuraBonuses(state, card);
    if (auraBonus.grantedKeywords.includes(keyword)) {
      return true;
    }
  }

  return false;
}

/**
 * Get all keywords for a creature (native + granted)
 */
export function getAllKeywords(state: GameState, card: CardInstance): string[] {
  const template = CardLoader.getById(card.scryfallId);
  if (!template) return [];

  const keywords = [...(template.keywords || [])];

  // Add Primal Clay special keywords based on choice
  if (template.name === 'Primal Clay') {
    if (card.primalClayChoice === '2/2 flying' && !keywords.includes('Flying')) {
      keywords.push('Flying');
    }
    if (card.primalClayChoice === '1/6 wall' && !keywords.includes('Defender')) {
      keywords.push('Defender');
    }
  }

  // Add granted keywords from Lords/anthems
  if (isCreature(template)) {
    const lordBonus = getLordBonuses(state, card, template);
    for (const kw of lordBonus.grantedKeywords) {
      if (!keywords.includes(kw)) {
        keywords.push(kw);
      }
    }

    // Add granted keywords from Auras (Phase 1.5.5)
    const auraBonus = getAuraBonuses(state, card);
    for (const kw of auraBonus.grantedKeywords) {
      if (!keywords.includes(kw)) {
        keywords.push(kw);
      }
    }
  }

  return keywords;
}
