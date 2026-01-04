/**
 * Runtime instance of a card in a game
 *
 * This represents a specific copy of a card with game state attached.
 * Multiple instances can reference the same Scryfall card data.
 */

import type { Zone, PlayerId, CounterType } from './Zone';

/**
 * Temporary power/toughness modification (until end of turn)
 */
export interface TemporaryModification {
  id: string;
  powerChange: number;
  toughnessChange: number;
  expiresAt: 'end_of_turn' | 'end_of_combat';
  source: string;  // Instance ID of the source (for tracking)
}

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

  // Temporary modifications (pump spells, combat tricks)
  temporaryModifications: TemporaryModification[];

  // Attachments (Phase 2+)
  attachments: string[];  // Instance IDs of Auras/Equipment attached to this
  attachedTo?: string;    // Instance ID of permanent this is attached to (for Auras)

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
    temporaryModifications: [],
    attachments: [],
  };
}

/**
 * Get effective power of a creature (base + counters + temporary mods)
 */
export function getEffectivePower(card: CardInstance, basePower: number): number {
  let power = basePower;

  // Add +1/+1 counters (each adds 1 power)
  power += card.counters['+1/+1'] ?? 0;

  // Subtract -1/-1 counters
  power -= card.counters['-1/-1'] ?? 0;

  // Add temporary modifications
  for (const mod of card.temporaryModifications) {
    power += mod.powerChange;
  }

  return power;
}

/**
 * Get effective toughness of a creature (base + counters + temporary mods)
 */
export function getEffectiveToughness(card: CardInstance, baseToughness: number): number {
  let toughness = baseToughness;

  // Add +1/+1 counters (each adds 1 toughness)
  toughness += card.counters['+1/+1'] ?? 0;

  // Subtract -1/-1 counters
  toughness -= card.counters['-1/-1'] ?? 0;

  // Add temporary modifications
  for (const mod of card.temporaryModifications) {
    toughness += mod.toughnessChange;
  }

  return toughness;
}

/**
 * Add a temporary modification to a card (until end of turn)
 */
export function addTemporaryModification(
  card: CardInstance,
  powerChange: number,
  toughnessChange: number,
  expiresAt: 'end_of_turn' | 'end_of_combat',
  sourceId: string
): void {
  card.temporaryModifications.push({
    id: `mod_${Date.now()}_${Math.random()}`,
    powerChange,
    toughnessChange,
    expiresAt,
    source: sourceId,
  });
}

/**
 * Clear temporary modifications that expire at a given time
 */
export function clearTemporaryModifications(
  card: CardInstance,
  expiresAt: 'end_of_turn' | 'end_of_combat'
): void {
  card.temporaryModifications = card.temporaryModifications.filter(
    mod => mod.expiresAt !== expiresAt
  );
}

/**
 * Generate unique instance ID
 */
let instanceCounter = 0;
function generateInstanceId(): string {
  return `card_${Date.now()}_${instanceCounter++}`;
}
