import { CardTemplate } from '../cards/CardTemplate';
import { createSimpleDeck } from './utils';

// =============================================================================
// ARTIFACT/COLORLESS DECK (Phase 1.5 - Cover all artifacts)
// =============================================================================

/**
 * Artifact/Colorless Deck
 * Tests all artifacts, mana rocks, and non-basic lands
 */
export function createArtifactDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Non-Basic Lands (24)
    { name: 'Crystal Vein', count: 4 },
    { name: 'Dwarven Ruins', count: 4 },
    { name: 'Ebon Stronghold', count: 4 },
    { name: 'Havenwood Battleground', count: 4 },
    { name: 'Ruins of Trokair', count: 4 },
    { name: 'Svyelunite Temple', count: 4 },
    // Artifact Creatures (12)
    { name: 'Ornithopter', count: 4 },
    { name: 'Obsianus Golem', count: 2 },
    { name: 'Patagia Golem', count: 2 },
    { name: 'Primal Clay', count: 4 },
    // Mana Artifacts (12)
    { name: 'Charcoal Diamond', count: 2 },
    { name: 'Fire Diamond', count: 2 },
    { name: 'Marble Diamond', count: 2 },
    { name: 'Moss Diamond', count: 2 },
    { name: 'Sky Diamond', count: 2 },
    { name: 'Mana Prism', count: 2 },
    // Utility Artifacts (12)
    { name: 'Jalum Tome', count: 2 },
    { name: 'Jayemdae Tome', count: 2 },
    { name: 'Rod of Ruin', count: 2 },
    { name: 'Millstone', count: 2 },
    { name: 'Meekstone', count: 2 },
    { name: 'Flying Carpet', count: 2 },
  ]);
}

// =============================================================================
// SPECIAL COVERAGE DECKS (Phase 1.5 - Remaining cards)
// =============================================================================

/**
 * Circle of Protection / Color Hate Deck
 * Tests all Circles of Protection and color-specific cards
 */
export function createColorHateDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (24)
    { name: 'Plains', count: 16 },
    { name: 'City of Brass', count: 4 },
    { name: 'Brushland', count: 4 },
    // Creatures (16)
    { name: 'Order of the Sacred Torch', count: 2 },
    { name: 'Stromgald Cabal', count: 2 },
    { name: 'Unyaro Griffin', count: 2 },
    { name: 'Daraja Griffin', count: 2 },
    { name: "D'Avenant Archer", count: 2 },
    { name: 'Ethereal Champion', count: 2 },
    { name: 'Heavy Ballista', count: 2 },
    { name: 'Kjeldoran Royal Guard', count: 2 },
    // Enchantments (20)
    { name: 'Circle of Protection: Black', count: 2 },
    { name: 'Circle of Protection: Blue', count: 2 },
    { name: 'Circle of Protection: Green', count: 2 },
    { name: 'Circle of Protection: Red', count: 2 },
    { name: 'Circle of Protection: White', count: 2 },
    { name: 'Light of Day', count: 2 },
    { name: 'Kismet', count: 2 },
    { name: 'Serenity', count: 2 },
    { name: 'Warmth', count: 2 },
    { name: 'Insight', count: 2 },
  ]);
}

/**
 * Remaining Artifacts Deck
 * Tests artifacts not covered in main artifact deck
 */
export function createArtifactsDeck2(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (24)
    { name: 'Mountain', count: 8 },
    { name: 'Swamp', count: 8 },
    { name: 'Forest', count: 8 },
    // Artifact Creatures (8)
    { name: 'Dragon Engine', count: 4 },
    { name: 'Dancing Scimitar', count: 4 },
    // Life Gain Artifacts (10)
    { name: 'Crystal Rod', count: 2 },
    { name: 'Iron Star', count: 2 },
    { name: 'Ivory Cup', count: 2 },
    { name: 'Throne of Bone', count: 2 },
    { name: 'Wooden Sphere', count: 2 },
    // Utility Artifacts (18)
    { name: 'Soul Net', count: 2 },
    { name: "Aladdin's Ring", count: 2 },
    { name: 'Ankh of Mishra', count: 2 },
    { name: "Ashnod's Altar", count: 2 },
    { name: 'Dingus Egg', count: 2 },
    { name: 'Disrupting Scepter', count: 2 },
    { name: 'Fountain of Youth', count: 2 },
    { name: 'Glasses of Urza', count: 2 },
    { name: 'Pentagram of the Ages', count: 2 },
  ]);
}

/**
 * Remaining Spells Deck
 * Tests tutors, mass removal, and utility spells not yet covered
 */
export function createSpellsDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (24)
    { name: 'Plains', count: 6 },
    { name: 'Island', count: 6 },
    { name: 'Swamp', count: 6 },
    { name: 'Mountain', count: 6 },
    // Creatures (12)
    { name: 'Daring Apprentice', count: 2 },
    { name: 'Soldevi Sage', count: 2 },
    { name: 'Sibilant Spirit', count: 2 },
    { name: 'Rag Man', count: 2 },
    { name: 'Mischievous Poltergeist', count: 2 },
    { name: 'Blighted Shaman', count: 2 },
    // Spells (24)
    { name: 'Vampiric Tutor', count: 2 },
    { name: 'Enlightened Tutor', count: 2 },
    { name: 'Armageddon', count: 2 },
    { name: 'Flashfires', count: 2 },
    { name: 'Perish', count: 2 },
    { name: 'Inferno', count: 2 },
    { name: 'Hurricane', count: 2 },
    { name: 'Recall', count: 2 },
    { name: 'Prosperity', count: 2 },
    { name: 'Forget', count: 2 },
    { name: 'Painful Memories', count: 2 },
    { name: 'Agonizing Memories', count: 2 },
  ]);
}

/**
 * Remaining Creatures Deck
 * Tests creatures not covered in other decks
 */
export function createCreaturesDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (22)
    { name: 'Forest', count: 8 },
    { name: 'Mountain', count: 7 },
    { name: 'Swamp', count: 7 },
    // Creatures (38)
    { name: 'Orcish Artillery', count: 2 },
    { name: 'Reckless Embermage', count: 2 },
    { name: 'Goblin Digging Team', count: 2 },
    { name: 'Ekundu Griffin', count: 2 },
    { name: 'Sunweb', count: 2 },
    { name: 'Elder Druid', count: 2 },
    { name: 'Phyrexian Vault', count: 2 },
    { name: 'Skull Catapult', count: 2 },
    { name: 'Snake Basket', count: 2 },
    { name: 'The Hive', count: 2 },
    // More creatures
    { name: 'Animate Wall', count: 2 },
    { name: 'Flight', count: 2 },
    { name: 'Gaseous Form', count: 2 },
    { name: "Leshrac's Rite", count: 2 },
    { name: 'Library of Lat-Nam', count: 2 },
    { name: 'Reverse Damage', count: 2 },
    { name: 'Vitalize', count: 2 },
    { name: 'Vertigo', count: 2 },
    { name: 'Stream of Life', count: 2 },
  ]);
}

/**
 * Uncovered Cards Deck
 * Tests implemented cards not covered by other decks
 * Includes: Abyssal Specter, Archangel, Fog Elemental, Gravedigger, Prodigal Sorcerer, etc.
 */
export function createUncoveredDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (24) - 5-color base
    { name: 'Plains', count: 4 },
    { name: 'Island', count: 4 },
    { name: 'Swamp', count: 6 },
    { name: 'Mountain', count: 2 },
    { name: 'Forest', count: 2 },
    { name: 'City of Brass', count: 4 },
    { name: 'Brushland', count: 2 },
    // Creatures (20) - Uncovered creatures
    { name: 'Abyssal Specter', count: 4 }, // 2BB 2/3 Flying, discard trigger
    { name: 'Archangel', count: 2 }, // 5WW 5/5 Flying, Vigilance
    { name: 'Fog Elemental', count: 4 }, // 2U 4/4 Flying
    { name: 'Gravedigger', count: 4 }, // 3B 2/2 ETB: Return creature
    { name: 'Prodigal Sorcerer', count: 4 }, // 2U 1/1 {T}: 1 damage
    { name: "D'Avenant Archer", count: 2 }, // 2W 1/2 {T}: 1 damage to attacker
    // Spells (10) - Uncovered spells
    { name: 'Coercion', count: 2 }, // 2B - Discard (you choose)
    { name: "Nature's Resurgence", count: 2 }, // 2GG - Return creatures from graveyards
    { name: 'Shatterstorm', count: 2 }, // 2RR - Destroy all artifacts
    { name: "Warrior's Honor", count: 4 }, // 2W - +1/+1 to your creatures
    // Enchantments (4) - Uncovered enchantments
    { name: "Hero's Resolve", count: 2 }, // 1W - +1/+5
    { name: "Serra's Blessing", count: 2 }, // 1W - Creatures have vigilance
    // Artifacts (2) - Expensive uncovered artifacts
    { name: "Ashnod's Altar", count: 2 }, // 3 - Sac creature: Add {C}{C}
  ]);
}

/**
 * Special coverage decks
 */
export type SpecialDeck =
  | 'artifact'
  | 'colorhate'
  | 'artifacts2'
  | 'spells'
  | 'creatures'
  | 'uncovered';

export const SPECIAL_DECKS: Record<SpecialDeck, () => CardTemplate[]> = {
  artifact: createArtifactDeck,
  colorhate: createColorHateDeck,
  artifacts2: createArtifactsDeck2,
  spells: createSpellsDeck,
  creatures: createCreaturesDeck,
  uncovered: createUncoveredDeck,
};
