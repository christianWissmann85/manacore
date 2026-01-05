import { CardTemplate } from '../cards/CardTemplate';
import { createSimpleDeck } from './utils';

/**
 * Create a vanilla creature deck for testing
 * Aggressive deck with low-cost creatures to ensure games finish quickly
 */
export function createVanillaDeck(): CardTemplate[] {
  return createSimpleDeck([
    { name: 'Forest', count: 20 },
    { name: 'Grizzly Bears', count: 40 }, // 2/2 for 1G - very aggressive
  ]);
}

// =============================================================================
// MONO-COLORED TEST DECKS (Week 11)
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
    { name: 'Terror', count: 8 }, // 1B - Destroy nonblack nonartifact creature
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
    { name: 'Balduvian Barbarians', count: 10 }, // 3/2 aggressive
    { name: 'Anaba Shaman', count: 8 }, // 2/2 with tap for damage
    // Spells (20)
    { name: 'Lightning Blast', count: 10 }, // 4 damage
    { name: 'Shock', count: 10 }, // 2 damage
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
    { name: 'Llanowar Elves', count: 8 }, // Mana acceleration
    { name: 'Birds of Paradise', count: 8 }, // Mana acceleration (any color)
    { name: 'Grizzly Bears', count: 16 }, // 2/2 for 1G
    // Spells (8)
    { name: 'Giant Growth', count: 8 }, // +3/+3 combat trick
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
