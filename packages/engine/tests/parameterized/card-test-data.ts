/**
 * Card Test Data - Centralized data for parameterized card tests
 *
 * This file contains all card groupings organized by mechanics and abilities.
 * Cards are grouped to enable parameterized testing with minimal code duplication.
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface CreatureTestData {
  name: string;
  power: string;
  toughness: string;
  cost?: { W?: number; U?: number; B?: number; R?: number; G?: number };
  cmc?: number;
  manaCost?: string;
}

export interface KeywordCreatureTestData {
  name: string;
  keywords: string[];
  power?: string;
  toughness?: string;
}

export interface LandwalkCreatureTestData {
  name: string;
  landwalkType: 'Swampwalk' | 'Islandwalk' | 'Forestwalk' | 'Mountainwalk' | 'Plainswalk';
  correspondingLand: 'Swamp' | 'Island' | 'Forest' | 'Mountain' | 'Plains';
}

export interface ETBCreatureTestData {
  name: string;
  power: string;
  toughness: string;
  effect: string;
  oracleTextContains: string[];
}

export interface StatModifierTestData {
  name: string;
  modifier: { power: number; toughness: number };
  type: 'aura' | 'enchantment' | 'spell';
}

// ============================================
// VANILLA CREATURES (no abilities)
// ============================================

export const VANILLA_CREATURES: CreatureTestData[] = [
  { name: 'Grizzly Bears', power: '2', toughness: '2', manaCost: '{1}{G}', cmc: 2 },
  { name: 'Balduvian Barbarians', power: '3', toughness: '2', manaCost: '{1}{R}{R}', cmc: 3 },
  { name: 'Fire Elemental', power: '5', toughness: '4', manaCost: '{3}{R}{R}', cmc: 5 },
  { name: 'Goblin Hero', power: '2', toughness: '2', manaCost: '{2}{R}', cmc: 3 },
  { name: 'Horned Turtle', power: '1', toughness: '4', manaCost: '{2}{U}', cmc: 3 },
  { name: 'Merfolk of the Pearl Trident', power: '1', toughness: '1', manaCost: '{U}', cmc: 1 },
  { name: 'Obsianus Golem', power: '4', toughness: '6', manaCost: '{6}', cmc: 6 },
  { name: 'Panther Warriors', power: '6', toughness: '3', manaCost: '{4}{G}', cmc: 5 },
  { name: 'Python', power: '3', toughness: '2', manaCost: '{1}{B}{B}', cmc: 3 },
  { name: 'Redwood Treefolk', power: '3', toughness: '6', manaCost: '{4}{G}', cmc: 5 },
  { name: 'Regal Unicorn', power: '2', toughness: '3', manaCost: '{2}{W}', cmc: 3 },
  { name: 'Scaled Wurm', power: '7', toughness: '6', manaCost: '{7}{G}', cmc: 8 },
  { name: 'Scathe Zombies', power: '2', toughness: '2', manaCost: '{2}{B}', cmc: 3 },
  { name: 'Trained Armodon', power: '3', toughness: '3', manaCost: '{1}{G}{G}', cmc: 3 },
  { name: 'Viashino Warrior', power: '4', toughness: '2', manaCost: '{3}{R}', cmc: 4 },
  { name: 'Vodalian Soldiers', power: '1', toughness: '2', manaCost: '{1}{U}', cmc: 2 },
];

// ============================================
// FLYING CREATURES
// ============================================

export const FLYING_CREATURES: KeywordCreatureTestData[] = [
  { name: 'Air Elemental', keywords: ['Flying'], power: '4', toughness: '4' },
  { name: 'Armored Pegasus', keywords: ['Flying'], power: '1', toughness: '2' },
  { name: 'Birds of Paradise', keywords: ['Flying'], power: '0', toughness: '1' },
  { name: 'Bog Imp', keywords: ['Flying'], power: '1', toughness: '1' },
  { name: 'Dancing Scimitar', keywords: ['Flying'], power: '1', toughness: '5' },
  { name: 'Feral Shadow', keywords: ['Flying'], power: '2', toughness: '1' },
  { name: 'Fog Elemental', keywords: ['Flying'], power: '4', toughness: '4' },
  { name: 'Mesa Falcon', keywords: ['Flying'], power: '1', toughness: '1' },
  { name: 'Ornithopter', keywords: ['Flying'], power: '0', toughness: '2' },
  { name: 'Storm Crow', keywords: ['Flying'], power: '1', toughness: '2' },
  { name: 'Wind Drake', keywords: ['Flying'], power: '2', toughness: '2' },
  { name: 'Abyssal Specter', keywords: ['Flying'], power: '2', toughness: '3' },
  { name: 'Sage Owl', keywords: ['Flying'], power: '1', toughness: '1' },
  { name: 'Mischievous Poltergeist', keywords: ['Flying'], power: '1', toughness: '1' },
];

// ============================================
// FIRST STRIKE CREATURES
// ============================================

export const FIRST_STRIKE_CREATURES: KeywordCreatureTestData[] = [
  { name: 'Anaba Bodyguard', keywords: ['First strike'], power: '2', toughness: '3' },
  { name: 'Elvish Archers', keywords: ['First strike'], power: '2', toughness: '1' },
  { name: 'Sabretooth Tiger', keywords: ['First strike'], power: '2', toughness: '1' },
  { name: 'Tundra Wolves', keywords: ['First strike'], power: '1', toughness: '1' },
  { name: 'Ekundu Griffin', keywords: ['Flying', 'First strike'], power: '2', toughness: '2' },
  { name: 'Longbow Archer', keywords: ['First strike', 'Reach'], power: '2', toughness: '2' },
];

// ============================================
// VIGILANCE CREATURES
// ============================================

export const VIGILANCE_CREATURES: KeywordCreatureTestData[] = [
  { name: 'Archangel', keywords: ['Flying', 'Vigilance'], power: '5', toughness: '5' },
  { name: 'Ardent Militia', keywords: ['Vigilance'], power: '2', toughness: '4' },
  { name: 'Standing Troops', keywords: ['Vigilance'], power: '1', toughness: '4' },
];

// ============================================
// HASTE CREATURES
// ============================================

export const HASTE_CREATURES: KeywordCreatureTestData[] = [
  { name: 'Raging Goblin', keywords: ['Haste'], power: '1', toughness: '1' },
  { name: 'Talruum Minotaur', keywords: ['Haste'], power: '3', toughness: '3' },
  { name: 'Volcanic Dragon', keywords: ['Flying', 'Haste'], power: '4', toughness: '4' },
];

// ============================================
// REACH CREATURES
// ============================================

export const REACH_CREATURES: KeywordCreatureTestData[] = [
  { name: 'Giant Spider', keywords: ['Reach'], power: '2', toughness: '4' },
  { name: 'Longbow Archer', keywords: ['First strike', 'Reach'], power: '2', toughness: '2' },
];

// ============================================
// DEFENDER (WALL) CREATURES
// ============================================

export const DEFENDER_CREATURES: KeywordCreatureTestData[] = [
  { name: 'Glacial Wall', keywords: ['Defender'], power: '0', toughness: '7' },
  { name: 'Wall of Air', keywords: ['Defender', 'Flying'], power: '1', toughness: '5' },
  { name: 'Wall of Fire', keywords: ['Defender'], power: '0', toughness: '5' },
  { name: 'Wall of Swords', keywords: ['Defender', 'Flying'], power: '3', toughness: '5' },
  { name: 'Sunweb', keywords: ['Defender', 'Flying'], power: '5', toughness: '6' },
];

// ============================================
// LANDWALK CREATURES
// ============================================

export const LANDWALK_CREATURES: LandwalkCreatureTestData[] = [
  { name: 'Bog Wraith', landwalkType: 'Swampwalk', correspondingLand: 'Swamp' },
  { name: 'Lost Soul', landwalkType: 'Swampwalk', correspondingLand: 'Swamp' },
  { name: 'Warthog', landwalkType: 'Swampwalk', correspondingLand: 'Swamp' },
  { name: 'Cat Warriors', landwalkType: 'Forestwalk', correspondingLand: 'Forest' },
  { name: 'Shanodin Dryads', landwalkType: 'Forestwalk', correspondingLand: 'Forest' },
  { name: 'Mountain Goat', landwalkType: 'Mountainwalk', correspondingLand: 'Mountain' },
  { name: 'Segovian Leviathan', landwalkType: 'Islandwalk', correspondingLand: 'Island' },
  { name: 'River Boa', landwalkType: 'Islandwalk', correspondingLand: 'Island' },
];

// ============================================
// FEAR CREATURES
// ============================================

export const FEAR_CREATURES: KeywordCreatureTestData[] = [
  { name: 'Razortooth Rats', keywords: ['Fear'], power: '2', toughness: '1' },
];

// ============================================
// MENACE CREATURES
// ============================================

export const MENACE_CREATURES: KeywordCreatureTestData[] = [
  { name: 'Wind Spirit', keywords: ['Flying', 'Menace'], power: '3', toughness: '2' },
];

// ============================================
// MULTI-KEYWORD CREATURES (for combined tests)
// ============================================

export const MULTI_KEYWORD_CREATURES: KeywordCreatureTestData[] = [
  { name: 'Archangel', keywords: ['Flying', 'Vigilance'], power: '5', toughness: '5' },
  { name: 'Ekundu Griffin', keywords: ['Flying', 'First strike'], power: '2', toughness: '2' },
  { name: 'Longbow Archer', keywords: ['First strike', 'Reach'], power: '2', toughness: '2' },
  { name: 'Volcanic Dragon', keywords: ['Flying', 'Haste'], power: '4', toughness: '4' },
  { name: 'Wind Spirit', keywords: ['Flying', 'Menace'], power: '3', toughness: '2' },
  { name: 'Wall of Air', keywords: ['Defender', 'Flying'], power: '1', toughness: '5' },
  { name: 'Wall of Swords', keywords: ['Defender', 'Flying'], power: '3', toughness: '5' },
  { name: 'Sunweb', keywords: ['Defender', 'Flying'], power: '5', toughness: '6' },
];

// ============================================
// ETB (ENTERS THE BATTLEFIELD) CREATURES
// ============================================

export const ETB_LIFE_GAIN_CREATURES: ETBCreatureTestData[] = [
  {
    name: 'Venerable Monk',
    power: '2',
    toughness: '2',
    effect: 'gain 2 life',
    oracleTextContains: ['when', 'enters', 'gain 2 life'],
  },
  {
    name: 'Staunch Defenders',
    power: '3',
    toughness: '4',
    effect: 'gain 4 life',
    oracleTextContains: ['when', 'enters', 'gain 4 life'],
  },
];

export const ETB_GRAVEYARD_CREATURES: ETBCreatureTestData[] = [
  {
    name: 'Gravedigger',
    power: '2',
    toughness: '2',
    effect: 'return creature from graveyard',
    oracleTextContains: ['when', 'enters', 'return', 'graveyard'],
  },
];

export const ETB_DISCARD_CREATURES: ETBCreatureTestData[] = [
  {
    name: 'Hidden Horror',
    power: '4',
    toughness: '4',
    effect: 'discard creature or sacrifice',
    oracleTextContains: ['when', 'enters', 'discard'],
  },
  {
    name: 'Balduvian Horde',
    power: '5',
    toughness: '5',
    effect: 'discard or sacrifice',
    oracleTextContains: ['when', 'enters', 'discard'],
  },
];

export const ETB_LIBRARY_CREATURES: ETBCreatureTestData[] = [
  {
    name: 'Sage Owl',
    power: '1',
    toughness: '1',
    effect: 'look at top 4',
    oracleTextContains: ['when', 'enters', 'look at the top'],
  },
];

export const ETB_DESTROY_CREATURES: ETBCreatureTestData[] = [
  {
    name: 'Uktabi Orangutan',
    power: '2',
    toughness: '2',
    effect: 'destroy target artifact',
    oracleTextContains: ['when', 'enters', 'destroy', 'artifact'],
  },
];

// ============================================
// STAT MODIFIER AURAS
// ============================================

export const STAT_BUFF_AURAS: StatModifierTestData[] = [
  { name: 'Divine Transformation', modifier: { power: 3, toughness: 3 }, type: 'aura' },
  { name: 'Giant Strength', modifier: { power: 2, toughness: 2 }, type: 'aura' },
  { name: "Hero's Resolve", modifier: { power: 1, toughness: 5 }, type: 'aura' },
  { name: 'Feast of the Unicorn', modifier: { power: 4, toughness: 0 }, type: 'aura' },
];

export const STAT_DEBUFF_AURAS: StatModifierTestData[] = [
  { name: 'Enfeeblement', modifier: { power: -2, toughness: -2 }, type: 'aura' },
];

// ============================================
// BASIC LANDS
// ============================================

export const BASIC_LANDS = [
  { name: 'Plains', color: 'W' },
  { name: 'Island', color: 'U' },
  { name: 'Swamp', color: 'B' },
  { name: 'Mountain', color: 'R' },
  { name: 'Forest', color: 'G' },
] as const;

// ============================================
// MANA DORKS (creatures that tap for mana)
// ============================================

export const MANA_DORKS = [
  { name: 'Llanowar Elves', manaProduced: 'G' },
  { name: 'Birds of Paradise', manaProduced: 'any' },
  { name: 'Fyndhorn Elder', manaProduced: 'GG' },
] as const;

// ============================================
// VARIABLE P/T CREATURES
// ============================================

export const VARIABLE_PT_CREATURES = [
  { name: 'Maro', basePT: '*/*', variable: 'cards in hand' },
  { name: 'Nightmare', basePT: '*/*', variable: 'Swamps controlled' },
  { name: 'Uktabi Wildcats', basePT: '*/*', variable: 'Forests controlled' },
] as const;

// ============================================
// LORDS (creatures that buff others)
// ============================================

export const LORD_CREATURES = [
  { name: 'Goblin King', buffedType: 'Goblin', bonus: '+1/+1', grantsKeyword: 'Mountainwalk' },
  { name: 'Lord of Atlantis', buffedType: 'Merfolk', bonus: '+1/+1', grantsKeyword: 'Islandwalk' },
  { name: 'Zombie Master', buffedType: 'Zombie', bonus: 'regenerate', grantsKeyword: 'Swampwalk' },
] as const;

// ============================================
// DAMAGE SPELLS
// ============================================

export const X_DAMAGE_SPELLS = [
  { name: 'Blaze', cost: '{X}{R}', targetType: 'any target' },
  { name: 'Volcanic Geyser', cost: '{X}{R}{R}', targetType: 'any target' },
] as const;

export const FIXED_DAMAGE_SPELLS = [
  { name: 'Shock', cost: '{R}', damage: 2, targetType: 'any target' },
  { name: 'Lightning Blast', cost: '{3}{R}', damage: 4, targetType: 'any target' },
] as const;

// ============================================
// COUNTERSPELLS
// ============================================

export const COUNTERSPELLS = [
  { name: 'Counterspell', cost: '{U}{U}', restriction: 'none' },
  { name: 'Remove Soul', cost: '{1}{U}', restriction: 'creature spell' },
  { name: 'Memory Lapse', cost: '{1}{U}', restriction: 'none', effect: 'put on library' },
] as const;

// ============================================
// HELPER: Get all keyword creatures for a specific keyword
// ============================================

export function getCreaturesWithKeyword(keyword: string): KeywordCreatureTestData[] {
  const allKeywordCreatures = [
    ...FLYING_CREATURES,
    ...FIRST_STRIKE_CREATURES,
    ...VIGILANCE_CREATURES,
    ...HASTE_CREATURES,
    ...REACH_CREATURES,
    ...DEFENDER_CREATURES,
    ...FEAR_CREATURES,
    ...MENACE_CREATURES,
  ];

  return allKeywordCreatures.filter((c) => c.keywords.includes(keyword));
}

// ============================================
// ALL KEYWORD CREATURES (combined list)
// ============================================

export const ALL_KEYWORD_CREATURES: KeywordCreatureTestData[] = [
  ...FLYING_CREATURES,
  ...FIRST_STRIKE_CREATURES.filter(
    (c) => !FLYING_CREATURES.some((f) => f.name === c.name),
  ),
  ...VIGILANCE_CREATURES.filter(
    (c) => !FLYING_CREATURES.some((f) => f.name === c.name),
  ),
  ...HASTE_CREATURES.filter(
    (c) => !FLYING_CREATURES.some((f) => f.name === c.name),
  ),
  ...REACH_CREATURES.filter(
    (c) => !FIRST_STRIKE_CREATURES.some((f) => f.name === c.name),
  ),
  ...DEFENDER_CREATURES.filter(
    (c) => !FLYING_CREATURES.some((f) => f.name === c.name),
  ),
  ...FEAR_CREATURES,
  ...MENACE_CREATURES.filter(
    (c) => !FLYING_CREATURES.some((f) => f.name === c.name),
  ),
];
