/**
 * Card template - the static data from Scryfall
 *
 * This is distinct from CardInstance (runtime state).
 * Multiple CardInstances can reference the same CardTemplate.
 */

export interface CardTemplate {
  id: string;                    // Scryfall UUID
  name: string;
  mana_cost?: string;             // "{2}{R}{R}"
  cmc: number;                   // Converted mana cost
  type_line: string;             // "Creature — Dragon"
  oracle_text?: string;          // Rules text
  power?: string;
  toughness?: string;
  colors: string[];              // ["R"]
  color_identity: string[];
  keywords: string[];            // ["Flying", "Haste"]
  flavor_text?: string;
  rarity: string;
  set: string;
  collector_number: string;
  image_filename: string;        // Local path to image
  rulings_uri: string;
}

/**
 * Check if a card is a creature
 */
export function isCreature(card: CardTemplate): boolean {
  return card.type_line.includes('Creature');
}

/**
 * Check if a card is a land
 */
export function isLand(card: CardTemplate): boolean {
  return card.type_line.includes('Land');
}

/**
 * Check if a card is an instant
 */
export function isInstant(card: CardTemplate): boolean {
  return card.type_line.includes('Instant');
}

/**
 * Check if a card is a sorcery
 */
export function isSorcery(card: CardTemplate): boolean {
  return card.type_line.includes('Sorcery');
}

/**
 * Check if a card is an enchantment
 */
export function isEnchantment(card: CardTemplate): boolean {
  return card.type_line.includes('Enchantment');
}

/**
 * Check if a card is an Aura (enchantment that attaches to something)
 */
export function isAura(card: CardTemplate): boolean {
  return card.type_line.includes('Aura');
}

/**
 * Check if a card is an artifact
 */
export function isArtifact(card: CardTemplate): boolean {
  return card.type_line.includes('Artifact');
}

/**
 * Check if a card has a keyword ability
 */
export function hasKeyword(card: CardTemplate, keyword: string): boolean {
  return card.keywords.some(k => k.toLowerCase() === keyword.toLowerCase());
}

/**
 * Check if a creature has Flying
 */
export function hasFlying(card: CardTemplate): boolean {
  return hasKeyword(card, 'Flying');
}

/**
 * Check if a creature has First Strike
 */
export function hasFirstStrike(card: CardTemplate): boolean {
  return hasKeyword(card, 'First Strike') || hasKeyword(card, 'Double Strike');
}

/**
 * Check if a creature has Double Strike
 */
export function hasDoubleStrike(card: CardTemplate): boolean {
  return hasKeyword(card, 'Double Strike');
}

/**
 * Check if a creature has Trample
 */
export function hasTrample(card: CardTemplate): boolean {
  return hasKeyword(card, 'Trample');
}

/**
 * Check if a creature has Vigilance
 */
export function hasVigilance(card: CardTemplate): boolean {
  return hasKeyword(card, 'Vigilance');
}

/**
 * Check if a creature has Reach
 */
export function hasReach(card: CardTemplate): boolean {
  return hasKeyword(card, 'Reach');
}

/**
 * Check if a creature has Haste
 */
export function hasHaste(card: CardTemplate): boolean {
  return hasKeyword(card, 'Haste');
}

/**
 * Check if a permanent has Hexproof
 * (Can't be targeted by opponents)
 */
export function hasHexproof(card: CardTemplate): boolean {
  return hasKeyword(card, 'Hexproof');
}

/**
 * Check if a permanent has Shroud
 * (Can't be targeted by anyone)
 */
export function hasShroud(card: CardTemplate): boolean {
  return hasKeyword(card, 'Shroud');
}

/**
 * Check if a permanent has Protection from a color
 */
export function hasProtectionFromColor(card: CardTemplate, color: 'W' | 'U' | 'B' | 'R' | 'G'): boolean {
  const oracleText = card.oracle_text?.toLowerCase() || '';
  const colorNames: Record<string, string> = {
    W: 'white',
    U: 'blue',
    B: 'black',
    R: 'red',
    G: 'green',
  };
  return oracleText.includes(`protection from ${colorNames[color]}`);
}

/**
 * Check if a creature has Defender (cannot attack)
 * Note: Walls have Defender by default in modern rules
 */
export function hasDefender(card: CardTemplate): boolean {
  // Check for Defender keyword
  if (hasKeyword(card, 'Defender')) {
    return true;
  }
  // In 6th Edition, Walls have "can't attack" in their rules text
  // Modern cards use Defender keyword, but older Walls may not have it
  if (card.type_line.includes('Wall')) {
    return true;
  }
  return false;
}

/**
 * Check if a creature has Fear
 * (Can only be blocked by artifact creatures and/or black creatures)
 */
export function hasFear(card: CardTemplate): boolean {
  return hasKeyword(card, 'Fear');
}

/**
 * Check if a creature has Intimidate
 * (Can only be blocked by artifact creatures and/or creatures that share a color)
 */
export function hasIntimidate(card: CardTemplate): boolean {
  return hasKeyword(card, 'Intimidate');
}

/**
 * Check if a creature has Menace
 * (Can only be blocked by two or more creatures)
 */
export function hasMenace(card: CardTemplate): boolean {
  return hasKeyword(card, 'Menace');
}

/**
 * Landwalk abilities - creature can't be blocked if defending player controls that land type
 */
export function hasSwampwalk(card: CardTemplate): boolean {
  return hasKeyword(card, 'Swampwalk');
}

export function hasIslandwalk(card: CardTemplate): boolean {
  return hasKeyword(card, 'Islandwalk');
}

export function hasForestwalk(card: CardTemplate): boolean {
  return hasKeyword(card, 'Forestwalk');
}

export function hasMountainwalk(card: CardTemplate): boolean {
  return hasKeyword(card, 'Mountainwalk');
}

export function hasPlainswalk(card: CardTemplate): boolean {
  return hasKeyword(card, 'Plainswalk');
}

/**
 * Check if a creature has any landwalk ability
 * Returns the land types it can walk through, or empty array if none
 */
export function getLandwalkTypes(card: CardTemplate): string[] {
  const types: string[] = [];
  if (hasSwampwalk(card)) types.push('Swamp');
  if (hasIslandwalk(card)) types.push('Island');
  if (hasForestwalk(card)) types.push('Forest');
  if (hasMountainwalk(card)) types.push('Mountain');
  if (hasPlainswalk(card)) types.push('Plains');
  return types;
}
