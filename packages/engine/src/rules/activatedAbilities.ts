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
import {
  getLandManaColors,
  parseManaCost,
  canPayManaCost,
  payManaCost,
  addManaToPool,
} from '../utils/manaCosts';
import type { TargetRequirement } from './targeting';

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
        targetRequirements: [
          {
            id: 'target_0',
            count: 1,
            targetType: 'any',
            zone: 'battlefield',
            restrictions: [],
            optional: false,
            description: 'any target',
          },
        ],
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
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
          const source = _state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
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
        targetRequirements: [
          {
            id: 'target_0',
            count: 1,
            targetType: 'any',
            zone: 'battlefield',
            restrictions: [],
            optional: false,
            description: 'any target',
          },
        ],
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          if (source.tapped) return false;
          if (source.summoningSick) return false;

          // Check if player can pay {R}
          const player = state.players[controller];
          const totalRedMana =
            player.manaPool.red +
            player.battlefield.filter((p) => {
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
          const source = _state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
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
          return player.battlefield.some((c) => {
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
                (c) => c.instanceId === card.instanceId,
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
          return (
            player.battlefield.filter((c) => {
              if (c.instanceId === sourceId) return false;
              const t = CardLoader.getById(c.scryfallId);
              return t && t.type_line?.toLowerCase().includes('creature');
            }).length > 0
          );
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
        targetRequirements: [
          {
            id: 'target_0',
            count: 1,
            targetType: 'any',
            zone: 'battlefield',
            restrictions: [],
            optional: false,
            description: 'any target',
          },
        ],
        canActivate: (_state: GameState, sourceId: string, controller: PlayerId) => {
          const source = _state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          if (source.tapped) return false;

          // Check if player has any creatures to sacrifice
          const player = _state.players[controller];
          const hasCreature = player.battlefield.some((c) => {
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
          const source = _state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          if (source.tapped) return false;

          const player = _state.players[controller];
          const hasCreature = player.battlefield.some((c) => {
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
          const source = _state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
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
          const source = _state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
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
          const source = _state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
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

    // ========================================
    // PHASE 1.5.4: ACTIVATED ABILITY CREATURES
    // ========================================

    // --- TAP TO DEAL DAMAGE ---

    case 'Orcish Artillery':
      // "{T}: Orcish Artillery deals 2 damage to any target and 3 damage to you."
      abilities.push({
        id: `${card.instanceId}_tap_damage`,
        name: '{T}: 2 damage to any target, 3 to you',
        cost: { tap: true },
        effect: {
          type: 'CUSTOM',
          custom: (_state: GameState) => {
            // Effect will be applied via the target system
            // The 3 damage to self is built into the effect
          },
        },
        isManaAbility: false,
        targetRequirements: [
          {
            id: 'target_0',
            count: 1,
            targetType: 'any',
            zone: 'battlefield',
            restrictions: [],
            optional: false,
            description: 'any target',
          },
        ],
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          if (source.tapped) return false;
          if (source.summoningSick) return false;
          return true;
        },
      });
      break;

    case 'Heavy Ballista':
      // "{T}: Heavy Ballista deals 2 damage to target attacking or blocking creature."
      abilities.push({
        id: `${card.instanceId}_tap_damage`,
        name: '{T}: 2 damage to attacker/blocker',
        cost: { tap: true },
        effect: { type: 'DAMAGE', amount: 2 },
        isManaAbility: false,
        targetRequirements: [
          {
            id: 'target_0',
            count: 1,
            targetType: 'creature',
            zone: 'battlefield',
            restrictions: [{ type: 'combat', status: 'attacking_or_blocking' }],
            optional: false,
            description: 'target attacking or blocking creature',
          },
        ],
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          if (source.tapped) return false;
          if (source.summoningSick) return false;
          return true;
        },
      });
      break;

    case "D'Avenant Archer":
      // "{T}: D'Avenant Archer deals 1 damage to target attacking or blocking creature."
      abilities.push({
        id: `${card.instanceId}_tap_damage`,
        name: '{T}: 1 damage to attacker/blocker',
        cost: { tap: true },
        effect: { type: 'DAMAGE', amount: 1 },
        isManaAbility: false,
        targetRequirements: [
          {
            id: 'target_0',
            count: 1,
            targetType: 'creature',
            zone: 'battlefield',
            restrictions: [{ type: 'combat', status: 'attacking_or_blocking' }],
            optional: false,
            description: 'target attacking or blocking creature',
          },
        ],
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          if (source.tapped) return false;
          if (source.summoningSick) return false;
          return true;
        },
      });
      break;

    case 'Femeref Archers':
      // "{T}: Femeref Archers deals 4 damage to target attacking creature with flying."
      abilities.push({
        id: `${card.instanceId}_tap_damage`,
        name: '{T}: 4 damage to attacking flyer',
        cost: { tap: true },
        effect: { type: 'DAMAGE', amount: 4 },
        isManaAbility: false,
        targetRequirements: [
          {
            id: 'target_0',
            count: 1,
            targetType: 'creature',
            zone: 'battlefield',
            restrictions: [
              { type: 'combat', status: 'attacking' },
              { type: 'keyword', keyword: 'flying' },
            ],
            optional: false,
            description: 'target attacking creature with flying',
          },
        ],
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          if (source.tapped) return false;
          if (source.summoningSick) return false;
          return true;
        },
      });
      break;

    case 'Reckless Embermage':
      // "{1}{R}: Reckless Embermage deals 1 damage to any target and 1 damage to itself."
      abilities.push({
        id: `${card.instanceId}_damage`,
        name: '{1}{R}: 1 damage to any target + 1 to self',
        cost: { mana: '{1}{R}' },
        effect: { type: 'DAMAGE', amount: 1 },
        isManaAbility: false,
        targetRequirements: [
          {
            id: 'target_0',
            count: 1,
            targetType: 'any',
            zone: 'battlefield',
            restrictions: [],
            optional: false,
            description: 'any target',
          },
        ],
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          // Check mana availability
          const player = state.players[controller];
          const totalMana =
            player.manaPool.red +
            player.manaPool.colorless +
            player.battlefield.filter((p) => {
              if (p.tapped) return false;
              const t = CardLoader.getById(p.scryfallId);
              return t && isLand(t);
            }).length;
          return totalMana >= 2;
        },
      });
      break;

    // --- TAP TO BUFF ---

    case 'Infantry Veteran':
      // "{T}: Target attacking creature gets +1/+1 until end of turn."
      abilities.push({
        id: `${card.instanceId}_tap_buff`,
        name: '{T}: Attacking creature +1/+1',
        cost: { tap: true },
        effect: {
          type: 'CUSTOM',
          custom: (_state: GameState) => {
            // Effect applied via targeting system
          },
        },
        isManaAbility: false,
        targetRequirements: [
          {
            id: 'target_0',
            count: 1,
            targetType: 'creature',
            zone: 'battlefield',
            restrictions: [{ type: 'combat', status: 'attacking' }],
            optional: false,
            description: 'target attacking creature',
          },
        ],
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          if (source.tapped) return false;
          if (source.summoningSick) return false;
          return true;
        },
      });
      break;

    case 'Wyluli Wolf':
      // "{T}: Target creature gets +1/+1 until end of turn."
      abilities.push({
        id: `${card.instanceId}_tap_buff`,
        name: '{T}: Creature +1/+1',
        cost: { tap: true },
        effect: {
          type: 'CUSTOM',
          custom: (_state: GameState) => {
            // Effect applied via targeting system
          },
        },
        isManaAbility: false,
        targetRequirements: [
          {
            id: 'target_0',
            count: 1,
            targetType: 'creature',
            zone: 'battlefield',
            restrictions: [],
            optional: false,
            description: 'target creature',
          },
        ],
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          if (source.tapped) return false;
          if (source.summoningSick) return false;
          return true;
        },
      });
      break;

    case 'Pradesh Gypsies':
      // "{1}{G}, {T}: Target creature gets -2/-0 until end of turn."
      abilities.push({
        id: `${card.instanceId}_tap_debuff`,
        name: '{1}{G}, {T}: Creature -2/-0',
        cost: { tap: true, mana: '{1}{G}' },
        effect: {
          type: 'CUSTOM',
          custom: (_state: GameState) => {
            // Effect applied via targeting system
          },
        },
        isManaAbility: false,
        targetRequirements: [
          {
            id: 'target_0',
            count: 1,
            targetType: 'creature',
            zone: 'battlefield',
            restrictions: [],
            optional: false,
            description: 'target creature',
          },
        ],
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          if (source.tapped) return false;
          if (source.summoningSick) return false;
          return true;
        },
      });
      break;

    // --- PUMP ABILITIES (No Tap) ---

    case 'Flame Spirit':
      // "{R}: Flame Spirit gets +1/+0 until end of turn."
      abilities.push({
        id: `${card.instanceId}_pump`,
        name: '{R}: +1/+0',
        cost: { mana: '{R}' },
        effect: {
          type: 'CUSTOM',
          custom: (state: GameState) => {
            // Find and pump self
            for (const playerId of ['player', 'opponent'] as const) {
              const creature = state.players[playerId].battlefield.find(
                (c) => c.instanceId === card.instanceId,
              );
              if (creature) {
                creature.temporaryModifications.push({
                  id: `pump_${Date.now()}_${Math.random()}`,
                  powerChange: 1,
                  toughnessChange: 0,
                  expiresAt: 'end_of_turn',
                  source: card.instanceId,
                });
                break;
              }
            }
          },
        },
        isManaAbility: false,
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          // Check for red mana
          const player = state.players[controller];
          const hasRed =
            player.manaPool.red >= 1 ||
            player.battlefield.some((p) => {
              if (p.tapped) return false;
              const t = CardLoader.getById(p.scryfallId);
              return t && (t.name === 'Mountain' || getLandManaColors(t.name).includes('R'));
            });
          return hasRed;
        },
      });
      break;

    case 'Dragon Engine':
      // "{2}: Dragon Engine gets +1/+0 until end of turn."
      abilities.push({
        id: `${card.instanceId}_pump`,
        name: '{2}: +1/+0',
        cost: { mana: '{2}' },
        effect: {
          type: 'CUSTOM',
          custom: (state: GameState) => {
            for (const playerId of ['player', 'opponent'] as const) {
              const creature = state.players[playerId].battlefield.find(
                (c) => c.instanceId === card.instanceId,
              );
              if (creature) {
                creature.temporaryModifications.push({
                  id: `pump_${Date.now()}_${Math.random()}`,
                  powerChange: 1,
                  toughnessChange: 0,
                  expiresAt: 'end_of_turn',
                  source: card.instanceId,
                });
                break;
              }
            }
          },
        },
        isManaAbility: false,
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          const player = state.players[controller];
          const totalMana =
            (Object.values(player.manaPool) as number[]).reduce((a, b) => a + b, 0) +
            player.battlefield.filter((p) => {
              if (p.tapped) return false;
              const t = CardLoader.getById(p.scryfallId);
              return t && isLand(t);
            }).length;
          return totalMana >= 2;
        },
      });
      break;

    case 'Pearl Dragon':
      // "{1}{W}: Pearl Dragon gets +0/+1 until end of turn."
      abilities.push({
        id: `${card.instanceId}_pump`,
        name: '{1}{W}: +0/+1',
        cost: { mana: '{1}{W}' },
        effect: {
          type: 'CUSTOM',
          custom: (state: GameState) => {
            for (const playerId of ['player', 'opponent'] as const) {
              const creature = state.players[playerId].battlefield.find(
                (c) => c.instanceId === card.instanceId,
              );
              if (creature) {
                creature.temporaryModifications.push({
                  id: `pump_${Date.now()}_${Math.random()}`,
                  powerChange: 0,
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
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          return source !== undefined;
        },
      });
      break;

    case 'Mesa Falcon':
      // "{1}{W}: Mesa Falcon gets +0/+1 until end of turn."
      abilities.push({
        id: `${card.instanceId}_pump`,
        name: '{1}{W}: +0/+1',
        cost: { mana: '{1}{W}' },
        effect: {
          type: 'CUSTOM',
          custom: (state: GameState) => {
            for (const playerId of ['player', 'opponent'] as const) {
              const creature = state.players[playerId].battlefield.find(
                (c) => c.instanceId === card.instanceId,
              );
              if (creature) {
                creature.temporaryModifications.push({
                  id: `pump_${Date.now()}_${Math.random()}`,
                  powerChange: 0,
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
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          return source !== undefined;
        },
      });
      break;

    case 'Wall of Fire':
      // "{R}: Wall of Fire gets +1/+0 until end of turn."
      abilities.push({
        id: `${card.instanceId}_pump`,
        name: '{R}: +1/+0',
        cost: { mana: '{R}' },
        effect: {
          type: 'CUSTOM',
          custom: (state: GameState) => {
            for (const playerId of ['player', 'opponent'] as const) {
              const creature = state.players[playerId].battlefield.find(
                (c) => c.instanceId === card.instanceId,
              );
              if (creature) {
                creature.temporaryModifications.push({
                  id: `pump_${Date.now()}_${Math.random()}`,
                  powerChange: 1,
                  toughnessChange: 0,
                  expiresAt: 'end_of_turn',
                  source: card.instanceId,
                });
                break;
              }
            }
          },
        },
        isManaAbility: false,
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          return source !== undefined;
        },
      });
      break;

    case 'Spitting Drake':
      // "{R}: Spitting Drake gets +1/+0 until end of turn. Activate only once each turn."
      abilities.push({
        id: `${card.instanceId}_pump`,
        name: '{R}: +1/+0 (once per turn)',
        cost: { mana: '{R}' },
        effect: {
          type: 'CUSTOM',
          custom: (state: GameState) => {
            for (const playerId of ['player', 'opponent'] as const) {
              const creature = state.players[playerId].battlefield.find(
                (c) => c.instanceId === card.instanceId,
              );
              if (creature) {
                creature.temporaryModifications.push({
                  id: `pump_${Date.now()}_${Math.random()}`,
                  powerChange: 1,
                  toughnessChange: 0,
                  expiresAt: 'end_of_turn',
                  source: card.instanceId,
                });
                break;
              }
            }
          },
        },
        isManaAbility: false,
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          // Check if already activated this turn (by checking for existing pump from this source)
          const alreadyActivated = source.temporaryModifications.some(
            (m) => m.source === card.instanceId && m.expiresAt === 'end_of_turn',
          );
          return !alreadyActivated;
        },
      });
      break;

    // --- TAP/UNTAP ABILITIES ---

    case 'Elder Druid':
      // "{3}{G}, {T}: You may tap or untap target artifact, creature, or land."
      abilities.push({
        id: `${card.instanceId}_tap_control`,
        name: '{3}{G}, {T}: Tap/untap permanent',
        cost: { tap: true, mana: '{3}{G}' },
        effect: {
          type: 'CUSTOM',
          custom: (_state: GameState) => {
            // Effect applied via targeting
          },
        },
        isManaAbility: false,
        targetRequirements: [
          {
            id: 'target_0',
            count: 1,
            targetType: 'permanent',
            zone: 'battlefield',
            restrictions: [],
            optional: false,
            description: 'target artifact, creature, or land',
          },
        ],
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          if (source.tapped) return false;
          if (source.summoningSick) return false;
          return true;
        },
      });
      break;

    case 'Fyndhorn Brownie':
      // "{2}{G}, {T}: Untap target creature."
      abilities.push({
        id: `${card.instanceId}_tap_untap`,
        name: '{2}{G}, {T}: Untap creature',
        cost: { tap: true, mana: '{2}{G}' },
        effect: {
          type: 'CUSTOM',
          custom: (_state: GameState) => {
            // Effect applied via targeting
          },
        },
        isManaAbility: false,
        targetRequirements: [
          {
            id: 'target_0',
            count: 1,
            targetType: 'creature',
            zone: 'battlefield',
            restrictions: [],
            optional: false,
            description: 'target creature',
          },
        ],
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          if (source.tapped) return false;
          if (source.summoningSick) return false;
          return true;
        },
      });
      break;

    case 'Radjan Spirit':
      // "{T}: Target creature loses flying until end of turn."
      abilities.push({
        id: `${card.instanceId}_tap_remove_flying`,
        name: '{T}: Target loses flying',
        cost: { tap: true },
        effect: {
          type: 'CUSTOM',
          custom: (_state: GameState) => {
            // Effect applied via targeting
          },
        },
        isManaAbility: false,
        targetRequirements: [
          {
            id: 'target_0',
            count: 1,
            targetType: 'creature',
            zone: 'battlefield',
            restrictions: [],
            optional: false,
            description: 'target creature',
          },
        ],
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          if (source.tapped) return false;
          if (source.summoningSick) return false;
          return true;
        },
      });
      break;

    // --- FLYING GRANTING ---

    case 'Patagia Golem':
      // "{3}: Patagia Golem gains flying until end of turn."
      abilities.push({
        id: `${card.instanceId}_gain_flying`,
        name: '{3}: Gains flying',
        cost: { mana: '{3}' },
        effect: {
          type: 'CUSTOM',
          custom: (_state: GameState) => {
            // Mark that this creature has flying for this turn
            // Note: Requires runtime keyword tracking (simplified for now)
          },
        },
        isManaAbility: false,
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          return source !== undefined;
        },
      });
      break;

    case 'Harmattan Efreet':
      // "{1}{U}{U}: Target creature gains flying until end of turn."
      abilities.push({
        id: `${card.instanceId}_grant_flying`,
        name: '{1}{U}{U}: Target gains flying',
        cost: { mana: '{1}{U}{U}' },
        effect: {
          type: 'CUSTOM',
          custom: (_state: GameState) => {
            // Effect applied via targeting
          },
        },
        isManaAbility: false,
        targetRequirements: [
          {
            id: 'target_0',
            count: 1,
            targetType: 'creature',
            zone: 'battlefield',
            restrictions: [],
            optional: false,
            description: 'target creature',
          },
        ],
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          return source !== undefined;
        },
      });
      break;

    // --- DAMAGE PREVENTION ---

    case 'Samite Healer':
      // "{T}: Prevent the next 1 damage that would be dealt to any target this turn."
      abilities.push({
        id: `${card.instanceId}_tap_prevent`,
        name: '{T}: Prevent 1 damage',
        cost: { tap: true },
        effect: {
          type: 'CUSTOM',
          custom: (_state: GameState) => {
            // Damage prevention effect - would need damage prevention shield system
          },
        },
        isManaAbility: false,
        targetRequirements: [
          {
            id: 'target_0',
            count: 1,
            targetType: 'any',
            zone: 'battlefield',
            restrictions: [],
            optional: false,
            description: 'any target',
          },
        ],
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          if (source.tapped) return false;
          if (source.summoningSick) return false;
          return true;
        },
      });
      break;

    // --- SACRIFICE ABILITIES ---

    case 'Daraja Griffin':
      // "Sacrifice Daraja Griffin: Destroy target black creature."
      abilities.push({
        id: `${card.instanceId}_sac_destroy`,
        name: 'Sacrifice: Destroy black creature',
        cost: { sacrifice: { type: 'self' } },
        effect: { type: 'DESTROY' },
        isManaAbility: false,
        targetRequirements: [
          {
            id: 'target_0',
            count: 1,
            targetType: 'creature',
            zone: 'battlefield',
            restrictions: [{ type: 'color', color: 'B', negated: false }],
            optional: false,
            description: 'target black creature',
          },
        ],
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          return source !== undefined;
        },
      });
      break;

    case 'Daring Apprentice':
      // "{T}, Sacrifice Daring Apprentice: Counter target spell."
      abilities.push({
        id: `${card.instanceId}_sac_counter`,
        name: '{T}, Sacrifice: Counter spell',
        cost: { tap: true, sacrifice: { type: 'self' } },
        effect: {
          type: 'CUSTOM',
          custom: (state: GameState) => {
            // Counter top spell on stack
            if (state.stack.length > 0) {
              const topSpell = state.stack[state.stack.length - 1];
              if (topSpell) {
                topSpell.countered = true;
              }
            }
          },
        },
        isManaAbility: false,
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          if (source.tapped) return false;
          if (source.summoningSick) return false;
          // Must have a spell to counter
          return state.stack.length > 0;
        },
      });
      break;

    case 'Unyaro Griffin':
      // "Sacrifice Unyaro Griffin: Counter target red instant or sorcery spell."
      abilities.push({
        id: `${card.instanceId}_sac_counter_red`,
        name: 'Sacrifice: Counter red instant/sorcery',
        cost: { sacrifice: { type: 'self' } },
        effect: {
          type: 'CUSTOM',
          custom: (state: GameState) => {
            if (state.stack.length > 0) {
              const topSpell = state.stack[state.stack.length - 1];
              if (topSpell) {
                const template = CardLoader.getById(topSpell.card.scryfallId);
                if (template && template.colors?.includes('R')) {
                  topSpell.countered = true;
                }
              }
            }
          },
        },
        isManaAbility: false,
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          // Check if there's a red spell on stack
          return state.stack.some((s) => {
            const t = CardLoader.getById(s.card.scryfallId);
            return t && t.colors?.includes('R');
          });
        },
      });
      break;

    case 'Resistance Fighter':
      // "Sacrifice Resistance Fighter: Prevent all combat damage target creature would deal this turn."
      abilities.push({
        id: `${card.instanceId}_sac_prevent`,
        name: 'Sacrifice: Prevent combat damage from creature',
        cost: { sacrifice: { type: 'self' } },
        effect: {
          type: 'CUSTOM',
          custom: (_state: GameState) => {
            // Combat damage prevention
          },
        },
        isManaAbility: false,
        targetRequirements: [
          {
            id: 'target_0',
            count: 1,
            targetType: 'creature',
            zone: 'battlefield',
            restrictions: [],
            optional: false,
            description: 'target creature',
          },
        ],
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          return source !== undefined;
        },
      });
      break;

    case 'Goblin Digging Team':
      // "{T}, Sacrifice Goblin Digging Team: Destroy target Wall."
      abilities.push({
        id: `${card.instanceId}_sac_destroy_wall`,
        name: '{T}, Sacrifice: Destroy Wall',
        cost: { tap: true, sacrifice: { type: 'self' } },
        effect: { type: 'DESTROY' },
        isManaAbility: false,
        targetRequirements: [
          {
            id: 'target_0',
            count: 1,
            targetType: 'creature',
            zone: 'battlefield',
            restrictions: [{ type: 'subtype', subtype: 'Wall' }],
            optional: false,
            description: 'target Wall',
          },
        ],
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          if (source.tapped) return false;
          if (source.summoningSick) return false;
          return true;
        },
      });
      break;

    // --- LIFE PAYMENT ABILITIES ---

    case 'Mischievous Poltergeist':
      // "Pay 1 life: Regenerate this creature." (Flying)
      abilities.push({
        id: `${card.instanceId}_regenerate`,
        name: 'Pay 1 life: Regenerate',
        cost: { life: 1 },
        effect: { type: 'REGENERATE' },
        isManaAbility: false,
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          const player = state.players[controller];
          return player.life >= 1; // Need life to pay
        },
      });
      break;

    case 'Ethereal Champion':
      // "Pay 1 life: Prevent the next 1 damage that would be dealt to Ethereal Champion this turn."
      abilities.push({
        id: `${card.instanceId}_prevent`,
        name: 'Pay 1 life: Prevent 1 damage to self',
        cost: { life: 1 },
        effect: {
          type: 'CUSTOM',
          custom: (_state: GameState) => {
            // Damage prevention shield for self
          },
        },
        isManaAbility: false,
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          const player = state.players[controller];
          return player.life > 1;
        },
      });
      break;

    // --- MORE ACTIVATED ABILITY CREATURES ---

    case 'Abyssal Hunter':
      // "{B}, {T}: Tap target creature. Abyssal Hunter deals damage equal to its power to that creature."
      abilities.push({
        id: `${card.instanceId}_tap_damage`,
        name: '{B}, {T}: Tap creature + deal damage',
        cost: { tap: true, mana: '{B}' },
        effect: {
          type: 'CUSTOM',
          custom: (_state: GameState) => {
            // Tap + deal damage based on power
          },
        },
        isManaAbility: false,
        targetRequirements: [
          {
            id: 'target_0',
            count: 1,
            targetType: 'creature',
            zone: 'battlefield',
            restrictions: [],
            optional: false,
            description: 'target creature',
          },
        ],
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          if (source.tapped) return false;
          if (source.summoningSick) return false;
          return true;
        },
      });
      break;

    case 'Blighted Shaman':
      // "{T}, Sacrifice a Swamp: Target creature gets +1/+1 until end of turn."
      abilities.push({
        id: `${card.instanceId}_sac_buff`,
        name: '{T}, Sacrifice Swamp: Creature +1/+1',
        cost: { tap: true, sacrifice: { type: 'land' } },
        effect: {
          type: 'CUSTOM',
          custom: (_state: GameState) => {
            // Effect applied via targeting
          },
        },
        isManaAbility: false,
        targetRequirements: [
          {
            id: 'target_0',
            count: 1,
            targetType: 'creature',
            zone: 'battlefield',
            restrictions: [],
            optional: false,
            description: 'target creature',
          },
        ],
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          if (source.tapped) return false;
          if (source.summoningSick) return false;
          // Check for swamp to sacrifice
          const hasSwamp = state.players[controller].battlefield.some((p) => {
            const t = CardLoader.getById(p.scryfallId);
            return t && t.name === 'Swamp';
          });
          return hasSwamp;
        },
      });
      break;

    case 'Kjeldoran Royal Guard':
      // "{T}: All combat damage that would be dealt to you by unblocked creatures this turn is dealt to Kjeldoran Royal Guard instead."
      abilities.push({
        id: `${card.instanceId}_redirect`,
        name: '{T}: Redirect unblocked damage to self',
        cost: { tap: true },
        effect: {
          type: 'CUSTOM',
          custom: (_state: GameState) => {
            // Damage redirection effect
          },
        },
        isManaAbility: false,
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          if (source.tapped) return false;
          if (source.summoningSick) return false;
          return true;
        },
      });
      break;

    case 'Order of the Sacred Torch':
      // "{T}, Pay 1 life: Counter target black spell."
      abilities.push({
        id: `${card.instanceId}_counter_black`,
        name: '{T}, Pay 1 life: Counter black spell',
        cost: { tap: true, life: 1 },
        effect: {
          type: 'CUSTOM',
          custom: (state: GameState) => {
            if (state.stack.length > 0) {
              const topSpell = state.stack[state.stack.length - 1];
              if (topSpell) {
                const template = CardLoader.getById(topSpell.card.scryfallId);
                if (template && template.colors?.includes('B')) {
                  topSpell.countered = true;
                }
              }
            }
          },
        },
        isManaAbility: false,
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          if (source.tapped) return false;
          if (source.summoningSick) return false;
          const player = state.players[controller];
          if (player.life <= 1) return false;
          // Check for black spell on stack
          return state.stack.some((s) => {
            const t = CardLoader.getById(s.card.scryfallId);
            return t && t.colors?.includes('B');
          });
        },
      });
      break;

    case 'Stromgald Cabal':
      // "{T}, Pay 1 life: Counter target white spell."
      abilities.push({
        id: `${card.instanceId}_counter_white`,
        name: '{T}, Pay 1 life: Counter white spell',
        cost: { tap: true, life: 1 },
        effect: {
          type: 'CUSTOM',
          custom: (state: GameState) => {
            if (state.stack.length > 0) {
              const topSpell = state.stack[state.stack.length - 1];
              if (topSpell) {
                const template = CardLoader.getById(topSpell.card.scryfallId);
                if (template && template.colors?.includes('W')) {
                  topSpell.countered = true;
                }
              }
            }
          },
        },
        isManaAbility: false,
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          if (source.tapped) return false;
          if (source.summoningSick) return false;
          const player = state.players[controller];
          if (player.life <= 1) return false;
          return state.stack.some((s) => {
            const t = CardLoader.getById(s.card.scryfallId);
            return t && t.colors?.includes('W');
          });
        },
      });
      break;

    case 'Rag Man':
      // "{B}{B}{B}, {T}: Target opponent reveals their hand and discards a creature card at random. Activate only during your turn."
      abilities.push({
        id: `${card.instanceId}_discard`,
        name: '{B}{B}{B}, {T}: Opponent discards creature',
        cost: { tap: true, mana: '{B}{B}{B}' },
        effect: {
          type: 'CUSTOM',
          custom: (_state: GameState) => {
            // Random creature discard effect
          },
        },
        isManaAbility: false,
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          if (source.tapped) return false;
          if (source.summoningSick) return false;
          // Only during your turn
          if (state.activePlayer !== controller) return false;
          return true;
        },
      });
      break;

    case 'Soldevi Sage':
      // "{T}, Sacrifice two lands: Draw three cards, then discard one of them."
      abilities.push({
        id: `${card.instanceId}_draw`,
        name: '{T}, Sacrifice 2 lands: Draw 3, discard 1',
        cost: { tap: true, sacrifice: { type: 'land', count: 2 } },
        effect: { type: 'DRAW_CARD', amount: 3 }, // Discard handled separately
        isManaAbility: false,
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          if (source.tapped) return false;
          if (source.summoningSick) return false;
          // Check for 2 lands to sacrifice
          const landCount = state.players[controller].battlefield.filter((p) => {
            const t = CardLoader.getById(p.scryfallId);
            return t && isLand(t);
          }).length;
          return landCount >= 2;
        },
      });
      break;

    case 'Crimson Hellkite':
      // "{X}, {T}: Crimson Hellkite deals X damage to target creature. Spend only red mana on X."
      abilities.push({
        id: `${card.instanceId}_x_damage`,
        name: '{X}, {T}: X damage to creature (red only)',
        cost: { tap: true, mana: '{X}' }, // X is variable
        effect: {
          type: 'CUSTOM',
          custom: (_state: GameState) => {
            // X damage - amount determined by X value
          },
        },
        isManaAbility: false,
        targetRequirements: [
          {
            id: 'target_0',
            count: 1,
            targetType: 'creature',
            zone: 'battlefield',
            restrictions: [],
            optional: false,
            description: 'target creature',
          },
        ],
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;
          if (source.tapped) return false;
          if (source.summoningSick) return false;
          return true;
        },
      });
      break;

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

    // ========================================
    // REGENERATION CREATURES
    // ========================================

    case 'Drudge Skeletons':
      // "{B}: Regenerate this creature."
      abilities.push({
        id: `${card.instanceId}_regenerate`,
        name: '{B}: Regenerate',
        cost: { mana: '{B}' },
        effect: { type: 'REGENERATE' },
        isManaAbility: false,
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;

          // Check if player can pay {B}
          const player = state.players[controller];
          const cost = parseManaCost('{B}');
          return canPayManaCost(player.manaPool, cost);
        },
      });
      break;

    case 'Gorilla Chieftain':
      // "{1}{G}: Regenerate this creature."
      abilities.push({
        id: `${card.instanceId}_regenerate`,
        name: '{1}{G}: Regenerate',
        cost: { mana: '{1}{G}' },
        effect: { type: 'REGENERATE' },
        isManaAbility: false,
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;

          const player = state.players[controller];
          const cost = parseManaCost('{1}{G}');
          return canPayManaCost(player.manaPool, cost);
        },
      });
      break;

    case 'Kjeldoran Dead':
      // "{B}: Regenerate this creature." (also has ETB sacrifice, handled in triggers)
      abilities.push({
        id: `${card.instanceId}_regenerate`,
        name: '{B}: Regenerate',
        cost: { mana: '{B}' },
        effect: { type: 'REGENERATE' },
        isManaAbility: false,
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;

          const player = state.players[controller];
          const cost = parseManaCost('{B}');
          return canPayManaCost(player.manaPool, cost);
        },
      });
      break;

    case 'River Boa':
      // "{G}: Regenerate this creature." (Islandwalk)
      abilities.push({
        id: `${card.instanceId}_regenerate`,
        name: '{G}: Regenerate',
        cost: { mana: '{G}' },
        effect: { type: 'REGENERATE' },
        isManaAbility: false,
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;

          const player = state.players[controller];
          const cost = parseManaCost('{G}');
          return canPayManaCost(player.manaPool, cost);
        },
      });
      break;

    case 'Uktabi Wildcats':
      // "{G}, Sacrifice a Forest: Regenerate this creature." (P/T = Forests)
      abilities.push({
        id: `${card.instanceId}_regenerate`,
        name: '{G}, Sacrifice a Forest: Regenerate',
        cost: {
          mana: '{G}',
          sacrifice: {
            type: 'land',
            restriction: { notSelf: true },
          },
        },
        effect: { type: 'REGENERATE' },
        isManaAbility: false,
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(
            (c) => c.instanceId === sourceId,
          );
          if (!source) return false;

          const player = state.players[controller];
          const cost = parseManaCost('{G}');
          if (!canPayManaCost(player.manaPool, cost)) return false;

          // Check if player has a Forest to sacrifice
          const hasForest = player.battlefield.some((p) => {
            if (p.instanceId === sourceId) return false;
            const t = CardLoader.getById(p.scryfallId);
            return t && t.type_line?.toLowerCase().includes('forest');
          });
          return hasForest;
        },
      });
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
      const source = _state.players[controller].battlefield.find((c) => c.instanceId === sourceId);
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
        const source = _state.players[controller].battlefield.find(
          (c) => c.instanceId === sourceId,
        );
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
        const source = _state.players[controller].battlefield.find(
          (c) => c.instanceId === sourceId,
        );
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
        const source = _state.players[controller].battlefield.find(
          (c) => c.instanceId === sourceId,
        );
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
        const source = _state.players[controller].battlefield.find(
          (c) => c.instanceId === sourceId,
        );
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
