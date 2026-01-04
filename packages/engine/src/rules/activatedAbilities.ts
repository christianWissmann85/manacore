/**
 * Activated Abilities System
 *
 * Handles "{Cost}: {Effect}" abilities
 *
 * Phase 1 abilities:
 * - "{T}: Deal 1 damage to any target" (Prodigal Sorcerer)
 */

import type { GameState } from '../state/GameState';
import type { CardInstance } from '../state/CardInstance';
import type { PlayerId } from '../state/Zone';
import { CardLoader } from '../cards/CardLoader';

/**
 * Activated ability definition
 */
export interface ActivatedAbility {
  id: string;           // Unique ID for this ability
  name: string;         // Display name
  cost: AbilityCost;    // What you pay to activate
  effect: AbilityEffect; // What happens when it resolves
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
  type: 'DAMAGE' | 'DESTROY' | 'DRAW_CARD' | 'CUSTOM';
  amount?: number;      // For damage
  target?: string;      // Target instance ID
  custom?: (state: GameState) => void;
}

/**
 * Get all activated abilities for a card
 */
export function getActivatedAbilities(card: CardInstance, _state: GameState): ActivatedAbility[] {
  const template = CardLoader.getById(card.scryfallId);
  if (!template) return [];

  const abilities: ActivatedAbility[] = [];

  // Card-specific abilities
  switch (template.name) {
    case 'Prodigal Sorcerer':
      // "{T}: Prodigal Sorcerer deals 1 damage to any target"
      abilities.push({
        id: `${card.instanceId}_tap_damage`,
        name: 'Tap: Deal 1 damage',
        cost: { tap: true },
        effect: { type: 'DAMAGE', amount: 1 },
        canActivate: (state: GameState, sourceId: string, controller: PlayerId) => {
          const source = state.players[controller].battlefield.find(c => c.instanceId === sourceId);
          if (!source) return false;
          if (source.tapped) return false;
          if (source.summoningSick) return false;
          return true;
        },
      });
      break;

    // Add more cards with activated abilities here
  }

  return abilities;
}

/**
 * Check if a card has any activated abilities
 */
export function hasActivatedAbilities(card: CardInstance, state: GameState): boolean {
  return getActivatedAbilities(card, state).length > 0;
}

/**
 * Activate an ability (pay costs)
 */
export function payCosts(state: GameState, sourceId: string, cost: AbilityCost): boolean {
  const controller = findCardController(state, sourceId);
  if (!controller) return false;

  const card = findCard(state, sourceId);
  if (!card) return false;

  // Pay tap cost
  if (cost.tap) {
    if (card.tapped) return false;
    card.tapped = true;
  }

  // TODO: Pay mana cost (Phase 1+)

  return true;
}

/**
 * Apply ability effect
 */
export function applyAbilityEffect(state: GameState, effect: AbilityEffect): void {
  switch (effect.type) {
    case 'DAMAGE':
      if (effect.target && effect.amount) {
        applyDamageToTarget(state, effect.target, effect.amount);
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
