/**
 * Game initialization utilities
 */

import type { GameState, CardTemplate, PlayerId } from '../index';
import { createGameState, createCardInstance } from '../index';
import { CardLoader } from '../cards/CardLoader';

/**
 * Shuffle an array in place
 */
export function shuffle<T>(array: T[], seed?: number): T[] {
  const rng = seed !== undefined ? createSeededRandom(seed) : Math.random;

  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j]!, array[i]!];
  }

  return array;
}

/**
 * Create a seeded random number generator
 */
function createSeededRandom(seed: number): () => number {
  let state = seed;
  return function () {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Create a simple deck (for testing)
 */
export function createSimpleDeck(deckList: Array<{ name: string; count: number }>): CardTemplate[] {
  const cards: CardTemplate[] = [];

  for (const entry of deckList) {
    const template = CardLoader.getByName(entry.name);
    if (!template) {
      console.warn(`Card not found: ${entry.name}`);
      continue;
    }

    for (let i = 0; i < entry.count; i++) {
      cards.push(template);
    }
  }

  return cards;
}

/**
 * Initialize a game with two decks
 */
export function initializeGame(
  playerDeck: CardTemplate[],
  opponentDeck: CardTemplate[],
  seed?: number,
): GameState {
  // Shuffle decks
  const shuffledPlayerDeck = shuffle([...playerDeck], seed);
  const shuffledOpponentDeck = shuffle([...opponentDeck], seed ? seed + 1 : undefined);

  // Create card instances
  const playerLibrary = shuffledPlayerDeck.map((card) =>
    createCardInstance(card.id, 'player', 'library'),
  );

  const opponentLibrary = shuffledOpponentDeck.map((card) =>
    createCardInstance(card.id, 'opponent', 'library'),
  );

  // Create game state
  const state = createGameState(playerLibrary, opponentLibrary, seed);

  // Draw opening hands (7 cards)
  for (let i = 0; i < 7; i++) {
    drawCard(state, 'player');
    drawCard(state, 'opponent');
  }

  // Set to main phase (skip untap/draw for turn 1)
  state.phase = 'main1';
  state.step = 'main';

  return state;
}

/**
 * Draw a card from library to hand
 */
function drawCard(state: GameState, playerId: PlayerId): void {
  const player = state.players[playerId];
  const card = player.library.pop();

  if (card) {
    card.zone = 'hand';
    player.hand.push(card);
  }
}

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
 * Control/defensive strategy with removal and flying threats
 */
export function createWhiteDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (24)
    { name: 'Plains', count: 24 },
    // Creatures (20)
    { name: 'Archangel', count: 20 }, // 5/5 Flying Vigilance - finisher
    // Spells (16)
    { name: 'Disenchant', count: 4 }, // Artifact/enchantment removal
    { name: 'Pacifism', count: 4 }, // Creature removal (aura)
    { name: 'Exile', count: 8 }, // Exile attacking creature + life gain
  ]);
}

/**
 * Blue Test Deck
 * Control strategy with counterspells and flyers
 */
export function createBlueDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (24)
    { name: 'Island', count: 24 },
    // Creatures (20)
    { name: 'Air Elemental', count: 10 }, // 4/4 Flying
    { name: 'Fog Elemental', count: 10 }, // 4/4 Flying
    // Spells (16)
    { name: 'Counterspell', count: 8 }, // Counter target spell
    { name: 'Unsummon', count: 8 }, // Bounce creature
  ]);
}

/**
 * Black Test Deck
 * Discard and removal with evasive threats
 */
export function createBlackDeck(): CardTemplate[] {
  return createSimpleDeck([
    // Lands (24)
    { name: 'Swamp', count: 24 },
    // Creatures (20)
    { name: 'Abyssal Specter', count: 10 }, // 2/3 Flying, damage -> discard
    { name: 'Gravedigger', count: 10 }, // 2/2 ETB return creature
    // Spells (16)
    { name: 'Terror', count: 8 }, // Destroy nonblack nonartifact creature
    { name: 'Coercion', count: 8 }, // Targeted discard
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
    { name: 'Fyndhorn Elves', count: 2 },
    { name: 'Elvish Mystic', count: 2 },
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

// =============================================================================
// DECK REGISTRY AND HELPERS
// =============================================================================

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

/**
 * Special coverage decks
 */
export type SpecialDeck = 'artifact' | 'colorhate' | 'artifacts2' | 'spells' | 'creatures';

export const SPECIAL_DECKS: Record<SpecialDeck, () => CardTemplate[]> = {
  artifact: createArtifactDeck,
  colorhate: createColorHateDeck,
  artifacts2: createArtifactsDeck2,
  spells: createSpellsDeck,
  creatures: createCreaturesDeck,
};

/**
 * All test decks combined
 */
export type AllDeckTypes = DeckColor | TwoColorDeck | SpecialDeck;

export const ALL_TEST_DECKS: Record<AllDeckTypes, () => CardTemplate[]> = {
  ...MONO_DECKS,
  ...TWO_COLOR_DECKS,
  ...SPECIAL_DECKS,
};

/**
 * Legacy alias for backwards compatibility
 */
export const TEST_DECKS = MONO_DECKS;

/**
 * Get a random test deck from ALL decks (full coverage)
 */
export function getRandomTestDeck(): CardTemplate[] {
  const allDeckNames = Object.keys(ALL_TEST_DECKS) as AllDeckTypes[];
  const randomDeck = allDeckNames[Math.floor(Math.random() * allDeckNames.length)]!;
  return ALL_TEST_DECKS[randomDeck]();
}

/**
 * Get a random mono-color deck only
 */
export function getRandomMonoDeck(): CardTemplate[] {
  const colors: DeckColor[] = ['white', 'blue', 'black', 'red', 'green'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)]!;
  return MONO_DECKS[randomColor]();
}

/**
 * Get a specific test deck by name
 */
export function getTestDeck(deckName: AllDeckTypes): CardTemplate[] {
  return ALL_TEST_DECKS[deckName]();
}

/**
 * Get deck name for display (used in simulation output)
 */
export function getDeckDisplayName(deck: CardTemplate[]): string {
  // Identify deck based on land types
  const lands = deck.filter((c) => c.type_line?.includes('Land'));

  // Check for color combinations based on lands
  const hasPlains = lands.some(
    (l) => l.name === 'Plains' || l.name?.includes('Wastes') || l.name?.includes('Brushland'),
  );
  const hasIsland = lands.some(
    (l) => l.name === 'Island' || l.name?.includes('River') || l.name?.includes('Wastes'),
  );
  const hasSwamp = lands.some(
    (l) => l.name === 'Swamp' || l.name?.includes('River') || l.name?.includes('Stronghold'),
  );
  const hasMountain = lands.some(
    (l) => l.name === 'Mountain' || l.name?.includes('Springs') || l.name?.includes('Ruins'),
  );
  const hasForest = lands.some(
    (l) => l.name === 'Forest' || l.name?.includes('Brushland') || l.name?.includes('Battleground'),
  );

  const colorCount = [hasPlains, hasIsland, hasSwamp, hasMountain, hasForest].filter(
    Boolean,
  ).length;

  if (colorCount === 0 || lands.some((l) => l.name === 'Crystal Vein')) return 'artifact';
  if (colorCount >= 3) return 'multicolor';

  if (hasPlains && hasIsland) return 'azorius';
  if (hasPlains && hasSwamp) return 'orzhov';
  if (hasPlains && hasMountain) return 'boros';
  if (hasPlains && hasForest) return 'selesnya';
  if (hasIsland && hasSwamp) return 'dimir';
  if (hasIsland && hasMountain) return 'izzet';
  if (hasIsland && hasForest) return 'simic';
  if (hasSwamp && hasMountain) return 'rakdos';
  if (hasSwamp && hasForest) return 'golgari';
  if (hasMountain && hasForest) return 'gruul';

  if (hasPlains) return 'white';
  if (hasIsland) return 'blue';
  if (hasSwamp) return 'black';
  if (hasMountain) return 'red';
  if (hasForest) return 'green';

  return 'unknown';
}
