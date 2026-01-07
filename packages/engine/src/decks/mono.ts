import { CardTemplate } from '../cards/CardTemplate';
import { createSimpleDeck } from './utils';

// =============================================================================
// MONO-COLORED TEST DECKS
// All decks follow the 4-card maximum rule for non-basic lands
// =============================================================================

/**
 * White Test Deck
 * Aggressive "White Weenie" strategy with efficient creatures and removal
 * Curve: 1-drops, 2-drops, 3-drops with removal spells
 */
export function createWhiteDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (24)
    { name: 'Plains', count: 24 },
    // 1-drops (8)
    { name: 'Tundra Wolves', count: 4 }, // W 1/1 First Strike
    { name: 'Infantry Veteran', count: 4 }, // W 1/1, {T}: Attacker +1/+1
    // 2-drops (12)
    { name: 'Longbow Archer', count: 4 }, // WW 2/2 First Strike, Reach
    { name: 'Armored Pegasus', count: 4 }, // 1W 1/2 Flying
    { name: 'Mesa Falcon', count: 4 }, // 1W 1/1 Flying, {1}{W}: +0/+1
    // 3-drops (8)
    { name: 'Standing Troops', count: 4 }, // 2W 1/4 Vigilance
    { name: 'Ardent Militia', count: 4 }, // 2W 2/4 Vigilance
    // Removal & Support (8)
    { name: 'Pacifism', count: 4 }, // 1W - Enchant creature can't attack/block
    { name: 'Exile', count: 4 }, // 2W - Exile attacking creature, gain life
  ]);
}

/**
 * Blue Test Deck
 * Tempo strategy with efficient creatures, bounce, and selective counters
 * Curve: 1-drops, 2-drops, 3-drops with interaction
 */
export function createBlueDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (24)
    { name: 'Island', count: 24 },
    // 1-drops (8)
    { name: 'Merfolk of the Pearl Trident', count: 4 }, // U 1/1
    { name: 'Sage Owl', count: 4 }, // 1U 1/1 Flying, scry on ETB
    // 2-drops (12)
    { name: 'Phantom Warrior', count: 4 }, // 1U 2/2 Unblockable
    { name: 'Storm Crow', count: 4 }, // 1U 1/2 Flying
    { name: 'Vodalian Soldiers', count: 4 }, // 1U 1/2
    // 3-drops (4)
    { name: 'Wind Drake', count: 4 }, // 2U 2/2 Flying
    // 5-drops (4)
    { name: 'Air Elemental', count: 4 }, // 3UU 4/4 Flying
    // Interaction (8)
    { name: 'Counterspell', count: 4 }, // UU - Counter target spell
    { name: 'Unsummon', count: 4 }, // U - Bounce creature
  ]);
}

/**
 * Black Test Deck
 * Aggressive strategy with efficient creatures and removal
 * Curve: 1-drops, 2-drops, 3-drops with evasion + removal
 */
export function createBlackDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (24)
    { name: 'Swamp', count: 24 },
    // 1-drops (4)
    { name: 'Bog Rats', count: 4 }, // B 1/1 (can't be blocked by Walls)
    // 2-drops (12)
    { name: 'Drudge Skeletons', count: 4 }, // 1B 1/1 Regenerate
    { name: 'Bog Imp', count: 4 }, // 1B 1/1 Flying
    { name: 'Scathe Zombies', count: 4 }, // 2B 2/2
    // 3-drops (8)
    { name: 'Feral Shadow', count: 4 }, // 2B 2/1 Flying
    { name: 'Python', count: 4 }, // 1BB 3/2
    // 4-drops (4)
    { name: 'Bog Wraith', count: 4 }, // 3B 3/3 Swampwalk
    // Removal (8)
    { name: 'Terror', count: 4 }, // 1B - Destroy nonblack nonartifact creature
    { name: 'Dry Spell', count: 4 }, // 1B - 1 damage to each creature/player
  ]);
}

/**
 * Red Test Deck
 * Aggressive burn strategy with direct damage
 */
export function createRedDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (22)
    { name: 'Mountain', count: 22 },
    // Creatures (18)
    { name: 'Raging Goblin', count: 4 }, // R 1/1 Haste
    { name: 'Balduvian Barbarians', count: 4 }, // 1RR 3/2
    { name: 'Anaba Shaman', count: 4 }, // 2RR 2/2 tap for damage
    { name: 'Goblin Hero', count: 4 }, // 2R 2/2
    { name: 'Fire Elemental', count: 2 }, // 3RR 5/4
    // Spells (20)
    { name: 'Lightning Blast', count: 4 }, // 3R 4 damage
    { name: 'Shock', count: 4 }, // R 2 damage
    { name: 'Hammer of Bogardan', count: 4 }, // 1RR 3 damage, returns to hand
    { name: 'Spitting Earth', count: 4 }, // 1R damage = mountains
    { name: 'Stone Rain', count: 4 }, // 2R land destruction
  ]);
}

/**
 * Green Test Deck
 * Aggressive creature strategy with mana acceleration
 */
export function createGreenDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (20)
    { name: 'Forest', count: 20 },
    // Creatures (32)
    { name: 'Llanowar Elves', count: 4 }, // G 1/1 tap for G
    { name: 'Birds of Paradise', count: 4 }, // G 0/1 Flying, tap for any color
    { name: 'Grizzly Bears', count: 4 }, // 1G 2/2
    { name: 'River Boa', count: 4 }, // 1G 2/1 Islandwalk, Regenerate
    { name: 'Gorilla Chieftain', count: 4 }, // 2GG 3/3 Regenerate
    { name: 'Giant Spider', count: 4 }, // 3G 2/4 Reach
    { name: 'Stalking Tiger', count: 4 }, // 3G 3/3 can't be blocked by 1 creature
    { name: 'Scaled Wurm', count: 4 }, // 7G 7/6
    // Spells (8)
    { name: 'Giant Growth', count: 4 }, // G +3/+3
    { name: 'Untamed Wilds', count: 4 }, // 2G search for basic land
  ]);
}

/**
 * All available test decks - mono-color
 */
export type DeckColor = 'white' | 'blue' | 'black' | 'red' | 'green';

export const MONO_DECKS: Record<DeckColor, () => CardTemplate[]> = {
  white: createWhiteDeck,
  blue: createBlueDeck,
  black: createBlackDeck,
  red: createRedDeck,
  green: createGreenDeck,
};
