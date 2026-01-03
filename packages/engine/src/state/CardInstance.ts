/**
 * Runtime instance of a card in a game
 *
 * This represents a specific copy of a card with game state attached.
 * Multiple instances can reference the same Scryfall card data.
 */

import type { Zone, PlayerId, CounterType } from './Zone';

export interface CardInstance {
  // Unique ID for this specific instance in this game
  instanceId: string;

  // Reference to Scryfall card data (from CardLoader)
  scryfallId: string;

  // Ownership
  controller: PlayerId;  // Who controls it now
  owner: PlayerId;       // Who owns it (for return-to-hand effects)

  // Location
  zone: Zone;

  // State
  tapped: boolean;
  summoningSick: boolean;  // Can't attack/tap on turn it entered

  // Damage (marked damage until cleanup)
  damage: number;

  // Modifications (Phase 1+)
  counters: Partial<Record<CounterType, number>>;

  // Attachments (Phase 2+)
  attachments: string[];  // Instance IDs of Auras/Equipment

  // Combat state
  attacking?: boolean;
  blocking?: string;      // Instance ID of attacker being blocked
  blockedBy?: string[];   // Instance IDs of creatures blocking this attacker
}

/**
 * Create a new card instance
 */
export function createCardInstance(
  scryfallId: string,
  owner: PlayerId,
  zone: Zone,
): CardInstance {
  return {
    instanceId: generateInstanceId(),
    scryfallId,
    controller: owner,
    owner,
    zone,
    tapped: false,
    summoningSick: zone === 'battlefield',
    damage: 0,
    counters: {},
    attachments: [],
  };
}

/**
 * Generate unique instance ID
 */
let instanceCounter = 0;
function generateInstanceId(): string {
  return `card_${Date.now()}_${instanceCounter++}`;
}
