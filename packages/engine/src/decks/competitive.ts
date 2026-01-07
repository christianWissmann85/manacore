import { CardTemplate } from '../cards/CardTemplate';
import { createSimpleDeck } from './utils';

// =============================================================================
// COMPETITIVE PRECONSTRUCTED DECKS (Phase 2 - Optimized Archetypes)
// =============================================================================

/**
 * White Weenie (Aggro)
 * Low-curve aggressive deck with efficient creatures and combat tricks
 */
export function createWhiteWeenie(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (20)
    { name: 'Plains', count: 20 },
    // Creatures (28)
    { name: 'Tundra Wolves', count: 4 }, // 1/1 First Strike for W
    { name: 'Infantry Veteran', count: 4 }, // 1/1 with pump ability
    { name: 'Longbow Archer', count: 4 }, // 2/2 First Strike, Reach for WW
    { name: 'Armored Pegasus', count: 4 }, // 1/2 Flying for 1W
    { name: 'Mesa Falcon', count: 4 }, // 1/1 Flying with pump for 1W
    { name: 'Standing Troops', count: 4 }, // 2/4 Vigilance for 2W
    { name: 'Samite Healer', count: 4 }, // 1/1 with damage prevention for 1W
    // Spells (12)
    { name: 'Disenchant', count: 4 }, // Artifact/Enchantment removal
    { name: 'Pacifism', count: 4 }, // Creature lockdown
    { name: 'Exile', count: 4 }, // Exile attacking creature, gain life
  ]);
}

/**
 * Blue Control
 * Counter-heavy control deck with card draw and flyers
 */
export function createBlueControl(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (24)
    { name: 'Island', count: 24 },
    // Creatures (12)
    { name: 'Phantom Warrior', count: 4 }, // Unblockable 2/2 for 1UU
    { name: 'Wind Drake', count: 4 }, // 2/2 Flying for 2U
    { name: 'Air Elemental', count: 4 }, // 4/4 Flying for 3UU
    // Spells (24)
    { name: 'Counterspell', count: 4 }, // Hard counter
    { name: 'Power Sink', count: 4 }, // Counter with X
    { name: 'Boomerang', count: 4 }, // Tempo bounce
    { name: 'Unsummon', count: 4 }, // Cheap bounce
    { name: 'Recall', count: 4 }, // Card draw
    { name: 'Sage Owl', count: 4 }, // Deck filtering
  ]);
}

/**
 * Black Aggro (Suicide Black)
 * Fast aggressive black with efficient creatures and removal
 */
export function createBlackAggro(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (20)
    { name: 'Swamp', count: 20 },
    // Creatures (24)
    { name: 'Bog Rats', count: 4 }, // 1/1 unblockable for B
    { name: 'Drudge Skeletons', count: 4 }, // 1/1 regenerate for 1B
    { name: 'Bog Imp', count: 4 }, // 1/1 Flying for 1B
    { name: 'Scathe Zombies', count: 4 }, // 2/2 for 2B
    { name: 'Python', count: 4 }, // 3/2 for 1BB
    { name: 'Bog Wraith', count: 4 }, // 3/3 Swampwalk for 3B
    // Spells (16)
    { name: 'Terror', count: 4 }, // Premium removal
    { name: 'Dry Spell', count: 4 }, // 1 damage to each creature/player
    { name: 'Raise Dead', count: 4 }, // Recursion
    { name: 'Regeneration', count: 4 }, // Protection aura
  ]);
}

/**
 * Red Burn
 * Direct damage and aggressive creatures
 */
export function createRedBurn(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (20)
    { name: 'Mountain', count: 20 },
    // Creatures (16)
    { name: 'Raging Goblin', count: 4 }, // 1/1 Haste for R
    { name: 'Goblin Hero', count: 4 }, // 2/2 for 2R
    { name: 'Balduvian Barbarians', count: 4 }, // 3/2 for 1RR
    { name: 'Hulking Cyclops', count: 4 }, // 5/5 for 3RR
    // Spells (24)
    { name: 'Shock', count: 4 }, // 2 damage for R
    { name: 'Lightning Blast', count: 4 }, // 4 damage for 3R
    { name: 'Hammer of Bogardan', count: 4 }, // 3 damage, returns to hand
    { name: 'Spitting Earth', count: 4 }, // damage = mountains
    { name: 'Stone Rain', count: 4 }, // Land destruction
    { name: 'Pyrotechnics', count: 4 }, // 4R - 4 damage divided
  ]);
}

/**
 * Green Midrange (Stompy)
 * Efficient creatures with mana acceleration
 */
export function createGreenMidrange(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (20)
    { name: 'Forest', count: 20 },
    // Creatures (28)
    { name: 'Llanowar Elves', count: 4 }, // Mana dork
    { name: 'Birds of Paradise', count: 4 }, // Mana dork (any color)
    { name: 'Grizzly Bears', count: 4 }, // 2/2 for 1G
    { name: 'River Boa', count: 4 }, // 2/1 Islandwalk, regenerate for 1G
    { name: 'Gorilla Chieftain', count: 4 }, // 3/3 Regenerate for 2GG
    { name: 'Stalking Tiger', count: 4 }, // 3/3 can't be blocked by 1 creature
    { name: 'Scaled Wurm', count: 4 }, // 7/6 for 7G
    // Spells (12)
    { name: 'Giant Growth', count: 4 }, // +3/+3 instant
    { name: 'Hurricane', count: 4 }, // Board wipe
    { name: 'Untamed Wilds', count: 4 }, // Ramp
  ]);
}

/**
 * Competitive preconstructed decks (optimized archetypes)
 */
export type CompetitiveDeck =
  | 'white_weenie'
  | 'blue_control'
  | 'black_aggro'
  | 'red_burn'
  | 'green_midrange';

export const COMPETITIVE_DECKS: Record<CompetitiveDeck, () => CardTemplate[]> = {
  white_weenie: createWhiteWeenie,
  blue_control: createBlueControl,
  black_aggro: createBlackAggro,
  red_burn: createRedBurn,
  green_midrange: createGreenMidrange,
};
