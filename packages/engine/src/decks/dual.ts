import { CardTemplate } from '../cards/CardTemplate';
import { createSimpleDeck } from './utils';

// =============================================================================
// TWO-COLOR TEST DECKS (Phase 1.5 - Full Card Coverage)
// =============================================================================

/**
 * White-Blue (Azorius) Control Deck
 * Walls, counterspells, bounce, and defensive creatures
 */
export function createAzoriusDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (24)
    { name: 'Plains', count: 10 },
    { name: 'Island', count: 10 },
    { name: 'Adarkar Wastes', count: 4 },
    // Creatures (18)
    { name: 'Wall of Air', count: 2 },
    { name: 'Wall of Swords', count: 2 },
    { name: 'Phantom Warrior', count: 2 },
    { name: 'Storm Crow', count: 2 },
    { name: 'Glacial Wall', count: 2 },
    { name: 'Dancing Scimitar', count: 2 },
    { name: 'Sage Owl', count: 2 },
    { name: 'Longbow Archer', count: 2 },
    { name: 'Samite Healer', count: 2 },
    // Spells (18)
    { name: 'Memory Lapse', count: 2 },
    { name: 'Remove Soul', count: 2 },
    { name: 'Power Sink', count: 2 },
    { name: 'Spell Blast', count: 2 },
    { name: 'Boomerang', count: 2 },
    { name: 'Inspiration', count: 2 },
    { name: 'Tidal Surge', count: 2 },
    { name: 'Healing Salve', count: 2 },
    { name: 'Remedy', count: 2 },
  ]);
}

/**
 * White-Black (Orzhov) Life Drain Deck
 * Life manipulation, recursion, and evasive creatures
 */
export function createOrzhovDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (24)
    { name: 'Plains', count: 12 },
    { name: 'Swamp', count: 12 },
    // Creatures (20)
    { name: 'Venerable Monk', count: 2 },
    { name: 'Staunch Defenders', count: 2 },
    { name: 'Drudge Skeletons', count: 2 },
    { name: 'Bog Wraith', count: 2 },
    { name: 'Lost Soul', count: 2 },
    { name: 'Feral Shadow', count: 2 },
    { name: 'Razortooth Rats', count: 2 },
    { name: 'Gravebane Zombie', count: 2 },
    { name: 'Standing Troops', count: 2 },
    { name: 'Sengir Autocrat', count: 2 },
    // Spells (16)
    { name: 'Syphon Soul', count: 2 },
    { name: 'Dry Spell', count: 2 },
    { name: 'Raise Dead', count: 2 },
    { name: 'Reprisal', count: 2 },
    { name: 'Tariff', count: 2 },
    { name: 'Spirit Link', count: 2 },
    { name: 'Dread of Night', count: 2 },
    { name: 'Crusade', count: 2 },
  ]);
}

/**
 * White-Red (Boros) Aggro Deck
 * Fast creatures, burn, and combat buffs
 */
export function createBorosDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (22)
    { name: 'Plains', count: 11 },
    { name: 'Mountain', count: 11 },
    // Creatures (22)
    { name: 'Tundra Wolves', count: 2 },
    { name: 'Infantry Veteran', count: 2 },
    { name: 'Ardent Militia', count: 2 },
    { name: 'Raging Goblin', count: 4 },
    { name: 'Talruum Minotaur', count: 4 },
    { name: 'Volcanic Dragon', count: 2 },
    { name: 'Anaba Bodyguard', count: 2 },
    { name: 'Sabretooth Tiger', count: 2 },
    { name: 'Pearl Dragon', count: 2 },
    // Spells (16)
    { name: 'Tremor', count: 2 },
    { name: 'Earthquake', count: 2 },
    { name: "Warrior's Honor", count: 2 },
    { name: 'Wrath of God', count: 2 },
    { name: 'Fervor', count: 2 },
    { name: "Serra's Blessing", count: 2 },
    { name: 'Orcish Oriflamme', count: 2 },
    { name: "Hero's Resolve", count: 2 },
  ]);
}

/**
 * White-Green (Selesnya) Creature Deck
 * Mana ramp, big creatures, and token generation
 */
export function createSelesnyaDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (24)
    { name: 'Plains', count: 10 },
    { name: 'Forest', count: 10 },
    { name: 'Brushland', count: 4 },
    // Creatures (22)
    { name: 'Llanowar Elves', count: 4 },
    { name: 'Cat Warriors', count: 2 },
    { name: 'Trained Armodon', count: 2 },
    { name: 'Gorilla Chieftain', count: 2 },
    { name: 'Warthog', count: 2 },
    { name: 'Scaled Wurm', count: 2 },
    { name: 'Regal Unicorn', count: 2 },
    { name: 'Armored Pegasus', count: 2 },
    { name: 'Mesa Falcon', count: 2 },
    { name: 'Resistance Fighter', count: 2 },
    // Spells (14)
    { name: 'Fog', count: 2 },
    { name: 'Rampant Growth', count: 2 },
    { name: 'Waiting in the Weeds', count: 2 },
    { name: 'Castle', count: 2 },
    { name: 'Familiar Ground', count: 2 },
    { name: 'Divine Transformation', count: 2 },
    { name: 'Icatian Town', count: 2 },
  ]);
}

/**
 * Blue-Black (Dimir) Control Deck
 * Counters, discard, removal, and card advantage
 */
export function createDimirDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (24)
    { name: 'Island', count: 10 },
    { name: 'Swamp', count: 10 },
    { name: 'Underground River', count: 4 },
    // Creatures (16)
    { name: 'Abyssal Hunter', count: 2 },
    { name: 'Blood Pet', count: 2 },
    { name: 'Hidden Horror', count: 2 },
    { name: 'Zombie Master', count: 2 },
    { name: 'Merfolk of the Pearl Trident', count: 2 },
    { name: 'Lord of Atlantis', count: 2 },
    { name: 'Nightmare', count: 2 },
    { name: 'Vodalian Soldiers', count: 2 },
    // Spells (20)
    { name: 'Mystical Tutor', count: 2 },
    { name: 'Ancestral Memories', count: 2 },
    { name: 'Fatal Blow', count: 2 },
    { name: 'Howl from Beyond', count: 2 },
    { name: 'Stupor', count: 2 },
    { name: 'Infernal Contract', count: 2 },
    { name: 'Greed', count: 2 },
    { name: 'Pestilence', count: 2 },
    { name: 'Psychic Venom', count: 2 },
    { name: 'Enfeeblement', count: 2 },
  ]);
}

/**
 * Blue-Red (Izzet) Burn/Counter Deck
 * Direct damage, counterspells, and spell synergies
 */
export function createIzzetDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (24)
    { name: 'Island', count: 12 },
    { name: 'Mountain', count: 12 },
    // Creatures (16)
    { name: 'Spitting Drake', count: 2 },
    { name: 'Harmattan Efreet', count: 2 },
    { name: 'Crimson Hellkite', count: 2 },
    { name: 'Fire Elemental', count: 2 },
    { name: 'Flame Spirit', count: 2 },
    { name: 'Wall of Fire', count: 2 },
    { name: 'Horned Turtle', count: 2 },
    { name: 'Wind Drake', count: 2 },
    // Spells (20)
    { name: 'Boil', count: 2 },
    { name: 'Shatter', count: 2 },
    { name: 'Volcanic Geyser', count: 2 },
    { name: 'Blaze', count: 2 },
    { name: 'Pyrotechnics', count: 2 },
    { name: 'Hammer of Bogardan', count: 2 },
    { name: 'Mana Short', count: 2 },
    { name: 'Dream Cache', count: 2 },
    { name: 'Relearn', count: 2 },
    { name: 'Aether Flash', count: 2 },
  ]);
}

/**
 * Blue-Green (Simic) Tempo Deck
 * Mana acceleration, evasion, and card filtering
 */
export function createSimicDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (24)
    { name: 'Island', count: 12 },
    { name: 'Forest', count: 12 },
    // Creatures (20)
    { name: 'Wind Spirit', count: 2 },
    { name: 'Segovian Leviathan', count: 2 },
    { name: 'River Boa', count: 2 },
    { name: 'Unseen Walker', count: 2 },
    { name: 'Giant Spider', count: 2 },
    { name: 'Maro', count: 2 },
    { name: 'Fyndhorn Elder', count: 2 },
    { name: 'Thicket Basilisk', count: 2 },
    { name: 'Sea Monster', count: 2 },
    { name: 'Verduran Enchantress', count: 2 },
    // Spells (16)
    { name: 'Early Harvest', count: 2 },
    { name: 'Untamed Wilds', count: 2 },
    { name: 'Summer Bloom', count: 2 },
    { name: 'Worldly Tutor', count: 2 },
    { name: 'Fallow Earth', count: 2 },
    { name: 'Wild Growth', count: 2 },
    { name: 'Regeneration', count: 2 },
    { name: 'Dense Foliage', count: 2 },
  ]);
}

/**
 * Black-Red (Rakdos) Aggro Deck
 * Aggressive creatures, burn, and land destruction
 */
export function createRakdosDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (24)
    { name: 'Swamp', count: 10 },
    { name: 'Mountain', count: 10 },
    { name: 'Sulfurous Springs', count: 4 },
    // Creatures (20)
    { name: 'Bog Imp', count: 2 },
    { name: 'Python', count: 2 },
    { name: 'Scathe Zombies', count: 2 },
    { name: 'Goblin Hero', count: 2 },
    { name: 'Goblin Elite Infantry', count: 2 },
    { name: 'Goblin King', count: 2 },
    { name: 'Raging Goblin', count: 2 },
    { name: 'Balduvian Horde', count: 2 },
    { name: 'Hulking Cyclops', count: 2 },
    { name: 'Viashino Warrior', count: 2 },
    // Spells (16)
    { name: 'Stone Rain', count: 2 },
    { name: 'Pillage', count: 2 },
    { name: 'Jokulhaups', count: 2 },
    { name: 'Ashen Powder', count: 2 },
    { name: 'Mind Warp', count: 2 },
    { name: 'Manabarbs', count: 2 },
    { name: 'Goblin Warrens', count: 2 },
    { name: 'Hecatomb', count: 2 },
  ]);
}

/**
 * Black-Green (Golgari) Recursion Deck
 * Graveyard synergies, sacrifice, and big creatures
 */
export function createGolgariDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (24)
    { name: 'Swamp', count: 10 },
    { name: 'Forest', count: 10 },
    { name: 'Karplusan Forest', count: 4 },
    // Creatures (20)
    { name: 'Bog Rats', count: 2 },
    { name: 'Kjeldoran Dead', count: 2 },
    { name: 'Necrosavant', count: 2 },
    { name: 'Fallen Angel', count: 2 },
    { name: 'Evil Eye of Orms-by-Gore', count: 2 },
    { name: 'Shanodin Dryads', count: 2 },
    { name: 'Elven Riders', count: 2 },
    { name: 'Stalking Tiger', count: 2 },
    { name: 'Panther Warriors', count: 2 },
    { name: 'Elvish Archers', count: 2 },
    // Spells (16)
    { name: "Nature's Resurgence", count: 2 },
    { name: 'Elven Cache', count: 2 },
    { name: 'Creeping Mold', count: 2 },
    { name: 'Lure', count: 2 },
    { name: 'Strands of Night', count: 2 },
    { name: 'Blight', count: 2 },
    { name: 'Fear', count: 2 },
    { name: 'Feast of the Unicorn', count: 2 },
  ]);
}

/**
 * Red-Green (Gruul) Big Creatures Deck
 * Mana ramp, utility creatures, and direct damage
 */
export function createGruulDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (24)
    { name: 'Mountain', count: 10 },
    { name: 'Forest', count: 10 },
    { name: 'Karplusan Forest', count: 4 },
    // Creatures (22)
    { name: 'Fyndhorn Brownie', count: 2 },
    { name: 'Pradesh Gypsies', count: 2 },
    { name: 'Radjan Spirit', count: 2 },
    { name: 'Femeref Archers', count: 2 },
    { name: 'Redwood Treefolk', count: 2 },
    { name: 'Uktabi Wildcats', count: 2 },
    { name: 'Uktabi Orangutan', count: 2 },
    { name: 'Wyluli Wolf', count: 2 },
    { name: 'Dragon Engine', count: 2 },
    { name: 'Lead Golem', count: 2 },
    { name: 'Mountain Goat', count: 2 },
    // Spells (14)
    { name: 'Fit of Rage', count: 2 },
    { name: 'Spitting Earth', count: 2 },
    { name: 'Tranquility', count: 2 },
    { name: 'Tranquil Grove', count: 2 },
    { name: 'Giant Strength', count: 2 },
    { name: 'Burrowing', count: 2 },
    { name: 'Firebreathing', count: 2 },
  ]);
}

/**
 * Two-color deck types
 */
export type TwoColorDeck =
  | 'azorius'
  | 'orzhov'
  | 'boros'
  | 'selesnya'
  | 'dimir'
  | 'izzet'
  | 'simic'
  | 'rakdos'
  | 'golgari'
  | 'gruul';

export const TWO_COLOR_DECKS: Record<TwoColorDeck, () => CardTemplate[]> = {
  azorius: createAzoriusDeck,
  orzhov: createOrzhovDeck,
  boros: createBorosDeck,
  selesnya: createSelesnyaDeck,
  dimir: createDimirDeck,
  izzet: createIzzetDeck,
  simic: createSimicDeck,
  rakdos: createRakdosDeck,
  golgari: createGolgariDeck,
  gruul: createGruulDeck,
};
