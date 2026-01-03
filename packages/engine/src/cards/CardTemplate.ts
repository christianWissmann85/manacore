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
