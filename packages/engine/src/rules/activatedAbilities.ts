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
  sacrifice?: SacrificeCost; // Sacrifice cost
  life?: number;        // Pay life cost
}

/**
 * Sacrifice cost definition
 */
export interface SacrificeCost {
  type: 'self' | 'creature' | 'permanent' | 'artifact' | 'land';
  count?: number;       // How many to sacrifice (default 1)
  restriction?: {
    notSelf?: boolean;  // Can't sacrifice the source
    mustBeControlled?: boolean; // Must sacrifice your own
  };
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

    case 'Fyndhorn Elder':
      // "{T}: Add {G}{G}."
      abilities.push({
        id: `${card.instanceId}_tap_mana`,
        name: 'Tap: Add {G}{G}',
        cost: { tap: true },
        effect: {
          type: 'ADD_MANA',
          amount: 2,
          manaColors: ['G'],
        },
        isManaAbility: true,
        canActivate: (_state: GameState, sourceId: string, controller: PlayerId) => {
          const source = _state.players[controller].battlefield.find(c => c.instanceId === sourceId);
          if (!source) return false;
          if (source.tapped) return false;
          // Creatures have summoning sickness for tap abilities
          if (source.summoningSick) return false;
          return true;
        },
      });
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

    // ========================================
    // SACRIFICE CARDS (Phase 1.5.1)
    // ========================================

    case 'Blood Pet':
      // "Sacrifice Blood Pet: Add {B}."
      abilities.push({
        id: `${card.instanceId}_sac_mana`,
        name: 'Sacrifice: Add {B}',
        cost: { sacrifice: { type: 'self' } },
        effect: {
          type: 'ADD_MANA',
          amount: 1,
          manaColors: ['B'],
        },
        isManaAbility: true, // Sacrifice for mana is a mana ability
        canActivate: (_state: GameState, sourceId: string, controller: PlayerId) => {
          const source = _state.players[controller].battlefield.find(c => c.instanceId === sourceId);
          return source !== undefined;
        },
      });
      break;

    case "Ashnod's Altar":
      // "Sacrifice a creature: Add {C}{C}."
      abilities.push({
        id: `${card.instanceId}_sac_creature_mana`,
        name: 'Sacrifice creature: Add {C}{C}',
        cost: { sacrifice: { type: 'creature' } },
        effect: {
          type: 'ADD_MANA',
          amount: 2,
          manaColors: ['C'],
        },
        isManaAbility: true,
        canActivate: (_state: GameState, _sourceId: string, controller: PlayerId) => {
          // Check if player has any creatures to sacrifice
          const player = _state.players[controller];
          return player.battlefield.some(c => {
            const t = CardLoader.getById(c.scryfallId);
            return t && t.type_line?.toLowerCase().includes('creature');
          });
        },
      });
      break;

    case 'Fallen Angel':
      // "Sacrifice a creature: Fallen Angel gets +2/+1 until end of turn."
      abilities.push({
        id: `${card.instanceId}_sac_pump`,
        name: 'Sacrifice creature: +2/+1',
        cost: { sacrifice: { type: 'creature', restriction: { notSelf: true } } },
        effect: {
          type: 'CUSTOM',
          custom: (state: GameState) => {
            // Find Fallen Angel and add +2/+1
            for (const playerId of ['player', 'opponent'] as const) {
              const fallenAngel = state.players[playerId].battlefield.find(
                c => c.instanceId === card.instanceId
              );
              if (fallenAngel) {
                fallenAngel.temporaryModifications.push({
                  id: `pump_${Date.now()}`,
                  powerChange: 2,
                  toughnessChange: 1,
                  expiresAt: 'end_of_turn',
                  source: card.instanceId,
                });
                break;
              }
            }
          },
        },
        isManaAbility: false,
        canActivate: (_state: GameState, sourceId: string, controller: PlayerId) => {
          const player = _state.players[controller];
          // Must have another creature to sacrifice (not self)
          return player.battlefield.filter(c => {
            if (c.instanceId === sourceId) return false;
            const t = CardLoader.getById(c.scryfallId);
            return t && t.type_line?.toLowerCase().includes('creature');
          }).length > 0;
        },
      });
      break;

    case 'Skull Catapult':
      // "{1}, {T}, Sacrifice a creature: Skull Catapult deals 2 damage to any target."
      abilities.push({
        id: `${card.instanceId}_sac_damage`,
        name: '{1}, Tap, Sacrifice creature: 2 damage',
        cost: { tap: true, mana: '{1}', sacrifice: { type: 'creature' } },
        effect: { type: 'DAMAGE', amount: 2 },
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
        canActivate: (_state: GameState, sourceId: string, controller: PlayerId) => {
          const source = _state.players[controller].battlefield.find(c => c.instanceId === sourceId);
          if (!source) return false;
          if (source.tapped) return false;

          // Check if player has any creatures to sacrifice
          const player = _state.players[controller];
          const hasCreature = player.battlefield.some(c => {
            const t = CardLoader.getById(c.scryfallId);
            return t && t.type_line?.toLowerCase().includes('creature');
          });
          return hasCreature;
        },
      });
      break;

    case 'Phyrexian Vault':
      // "{2}, {T}, Sacrifice a creature: Draw a card."
      abilities.push({
        id: `${card.instanceId}_sac_draw`,
        name: '{2}, Tap, Sacrifice creature: Draw',
        cost: { tap: true, mana: '{2}', sacrifice: { type: 'creature' } },
        effect: {
          type: 'CUSTOM',
          custom: (state: GameState) => {
            // Draw a card for the controller
            const controller = findCardController(state, card.instanceId);
            if (controller) {
              const player = state.players[controller];
              const drawnCard = player.library.pop();
              if (drawnCard) {
                drawnCard.zone = 'hand';
                player.hand.push(drawnCard);
              }
            }
          },
        },
        isManaAbility: false,
        canActivate: (_state: GameState, sourceId: string, controller: PlayerId) => {
          const source = _state.players[controller].battlefield.find(c => c.instanceId === sourceId);
          if (!source) return false;
          if (source.tapped) return false;

          const player = _state.players[controller];
          const hasCreature = player.battlefield.some(c => {
            const t = CardLoader.getById(c.scryfallId);
            return t && t.type_line?.toLowerCase().includes('creature');
          });
          return hasCreature;
        },
      });
      break;

    case 'Crystal Vein':
      // "{T}: Add {C}."
      // "{T}, Sacrifice Crystal Vein: Add {C}{C}."
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
          return source !== undefined && !source.tapped;
        },
      });
      abilities.push({
        id: `${card.instanceId}_sac_mana`,
        name: 'Tap, Sacrifice: Add {C}{C}',
        cost: { tap: true, sacrifice: { type: 'self' } },
        effect: {
          type: 'ADD_MANA',
          amount: 2,
          manaColors: ['C'],
        },
        isManaAbility: true,
        canActivate: (_state: GameState, sourceId: string, controller: PlayerId) => {
          const source = _state.players[controller].battlefield.find(c => c.instanceId === sourceId);
          return source !== undefined && !source.tapped;
        },
      });
      break;

    // ========================================
    // PAIN LANDS (Phase 1.5.1)
    // ========================================

    case 'Adarkar Wastes':
      // "{T}: Add {C}."
      // "{T}: Add {W} or {U}. This land deals 1 damage to you."
      abilities.push(...createPainLandAbilities(card, ['W', 'U']));
      break;

    case 'Brushland':
      // "{T}: Add {C}."
      // "{T}: Add {G} or {W}. This land deals 1 damage to you."
      abilities.push(...createPainLandAbilities(card, ['G', 'W']));
      break;

    case 'Karplusan Forest':
      // "{T}: Add {C}."
      // "{T}: Add {R} or {G}. This land deals 1 damage to you."
      abilities.push(...createPainLandAbilities(card, ['R', 'G']));
      break;

    case 'Sulfurous Springs':
      // "{T}: Add {C}."
      // "{T}: Add {B} or {R}. This land deals 1 damage to you."
      abilities.push(...createPainLandAbilities(card, ['B', 'R']));
      break;

    case 'Underground River':
      // "{T}: Add {C}."
      // "{T}: Add {U} or {B}. This land deals 1 damage to you."
      abilities.push(...createPainLandAbilities(card, ['U', 'B']));
      break;

    // ========================================
    // CITY OF BRASS (Phase 1.5.1)
    // ========================================

    case 'City of Brass':
      // "Whenever this land becomes tapped, it deals 1 damage to you."
      // "{T}: Add one mana of any color."
      // Note: The damage trigger is handled in triggers.ts
      abilities.push({
        id: `${card.instanceId}_tap_mana`,
        name: 'Tap: Add any color',
        cost: { tap: true },
        effect: {
          type: 'ADD_MANA',
          amount: 1,
          manaColors: ['W', 'U', 'B', 'R', 'G'],
        },
        isManaAbility: true,
        canActivate: (_state: GameState, sourceId: string, controller: PlayerId) => {
          const source = _state.players[controller].battlefield.find(c => c.instanceId === sourceId);
          return source !== undefined && !source.tapped;
        },
      });
      break;

    // ========================================
    // SACRIFICE LANDS (Phase 1.5.1)
    // These enter tapped (handled in reducer)
    // ========================================

    case 'Dwarven Ruins':
      // "This land enters tapped."
      // "{T}: Add {R}."
      // "{T}, Sacrifice: Add {R}{R}."
      abilities.push(...createSacrificeLandAbilities(card, 'R'));
      break;

    case 'Ebon Stronghold':
      // "This land enters tapped."
      // "{T}: Add {B}."
      // "{T}, Sacrifice: Add {B}{B}."
      abilities.push(...createSacrificeLandAbilities(card, 'B'));
      break;

    case 'Havenwood Battleground':
      // "This land enters tapped."
      // "{T}: Add {G}."
      // "{T}, Sacrifice: Add {G}{G}."
      abilities.push(...createSacrificeLandAbilities(card, 'G'));
      break;

    case 'Ruins of Trokair':
      // "This land enters tapped."
      // "{T}: Add {W}."
      // "{T}, Sacrifice: Add {W}{W}."
      abilities.push(...createSacrificeLandAbilities(card, 'W'));
      break;

    case 'Svyelunite Temple':
      // "This land enters tapped."
      // "{T}: Add {U}."
      // "{T}, Sacrifice: Add {U}{U}."
      abilities.push(...createSacrificeLandAbilities(card, 'U'));
      break;

    // Add more cards with activated abilities here
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
function getManaAbilitiesForLand(card: CardInstance, template: { type_line: string; oracle_text?: string; name: string }): ActivatedAbility[] {
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
 * Create mana abilities for a pain land
 *
 * Pain lands have two abilities:
 * 1. {T}: Add {C}
 * 2. {T}: Add {color1} or {color2}. This land deals 1 damage to you.
 *
 * The second ability deals 1 damage to the controller as part of activation.
 */
function createPainLandAbilities(card: CardInstance, colors: ManaColor[]): ActivatedAbility[] {
  return [
    // Ability 1: Tap for colorless (no pain)
    {
      id: `${card.instanceId}_tap_colorless`,
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
        return source !== undefined && !source.tapped;
      },
    },
    // Ability 2: Tap for colored + 1 damage (using life cost)
    {
      id: `${card.instanceId}_tap_colored`,
      name: `Tap: Add {${colors[0]}} or {${colors[1]}} (1 damage)`,
      cost: { tap: true, life: 1 },
      effect: {
        type: 'ADD_MANA',
        amount: 1,
        manaColors: colors,
      },
      isManaAbility: true,
      canActivate: (_state: GameState, sourceId: string, controller: PlayerId) => {
        const source = _state.players[controller].battlefield.find(c => c.instanceId === sourceId);
        return source !== undefined && !source.tapped;
      },
    },
  ];
}

/**
 * Create mana abilities for a sacrifice land (enters tapped)
 *
 * Sacrifice lands have two abilities:
 * 1. {T}: Add {color}
 * 2. {T}, Sacrifice: Add {color}{color}
 *
 * Note: "Enters tapped" is handled in the reducer when the land is played.
 */
function createSacrificeLandAbilities(card: CardInstance, color: ManaColor): ActivatedAbility[] {
  return [
    // Ability 1: Tap for single mana
    {
      id: `${card.instanceId}_tap_mana`,
      name: `Tap: Add {${color}}`,
      cost: { tap: true },
      effect: {
        type: 'ADD_MANA',
        amount: 1,
        manaColors: [color],
      },
      isManaAbility: true,
      canActivate: (_state: GameState, sourceId: string, controller: PlayerId) => {
        const source = _state.players[controller].battlefield.find(c => c.instanceId === sourceId);
        return source !== undefined && !source.tapped;
      },
    },
    // Ability 2: Tap + Sacrifice for double mana
    {
      id: `${card.instanceId}_sac_mana`,
      name: `Tap, Sacrifice: Add {${color}}{${color}}`,
      cost: { tap: true, sacrifice: { type: 'self' } },
      effect: {
        type: 'ADD_MANA',
        amount: 2,
        manaColors: [color],
      },
      isManaAbility: true,
      canActivate: (_state: GameState, sourceId: string, controller: PlayerId) => {
        const source = _state.players[controller].battlefield.find(c => c.instanceId === sourceId);
        return source !== undefined && !source.tapped;
      },
    },
  ];
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
  sacrificeTargetId?: string  // For non-self sacrifice, which creature to sacrifice
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
    const sacrificed = paySacrificeCost(state, controller, cost.sacrifice, sourceId, sacrificeTargetId);
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
  targetId?: string
): boolean {
  const player = state.players[controller];

  if (sacCost.type === 'self') {
    // Sacrifice the source of the ability
    const sourceIndex = player.battlefield.findIndex(c => c.instanceId === sourceId);
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
    const validTargets = player.battlefield.filter(c => {
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
  const targetIndex = player.battlefield.findIndex(c => c.instanceId === targetId);
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
