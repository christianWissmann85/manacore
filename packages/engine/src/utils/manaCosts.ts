/**
 * Mana cost parsing, validation, and payment utilities
 *
 * Handles:
 * - Parsing Scryfall mana cost strings like "{2}{R}{B}" or "{X}{R}{R}"
 * - Checking if a mana pool can pay a cost
 * - Deducting mana from a pool
 * - Adding mana to a pool
 */

import type { ManaPool } from '../state/PlayerState';

/**
 * Parsed mana cost representation
 *
 * - Colored mana (white, blue, etc.) must be paid with that specific color
 * - Generic mana can be paid with any color
 * - X costs are variable (determined at cast time)
 */
export interface ManaCost {
  white: number;
  blue: number;
  black: number;
  red: number;
  green: number;
  colorless: number; // {C} - explicitly colorless (e.g., Eldrazi)
  generic: number; // {1}, {2}, etc. - payable with any color
  x: number; // Number of X symbols in cost (each X is paid separately)
}

/**
 * Mana color symbols used in Scryfall notation
 */
export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';

/**
 * Create an empty mana cost (zero of everything)
 */
export function createEmptyManaCost(): ManaCost {
  return {
    white: 0,
    blue: 0,
    black: 0,
    red: 0,
    green: 0,
    colorless: 0,
    generic: 0,
    x: 0,
  };
}

/**
 * Parse a Scryfall mana cost string into a ManaCost object
 *
 * Examples:
 * - "{R}" → { red: 1 }
 * - "{2}{R}{R}" → { generic: 2, red: 2 }
 * - "{X}{R}" → { x: 1, red: 1 }
 * - "{X}{X}{U}" → { x: 2, blue: 1 }
 * - "" or undefined → empty cost (lands)
 *
 * @param manaCostString - Scryfall format mana cost (e.g., "{2}{R}{B}")
 * @returns Parsed ManaCost object
 */
export function parseManaCost(manaCostString: string | undefined): ManaCost {
  const cost = createEmptyManaCost();

  if (!manaCostString || manaCostString.trim() === '') {
    return cost;
  }

  // Match all {X} patterns in the string
  const symbolRegex = /\{([^}]+)\}/g;
  let match;

  while ((match = symbolRegex.exec(manaCostString)) !== null) {
    const symbol = match[1]!.toUpperCase();

    switch (symbol) {
      case 'W':
        cost.white++;
        break;
      case 'U':
        cost.blue++;
        break;
      case 'B':
        cost.black++;
        break;
      case 'R':
        cost.red++;
        break;
      case 'G':
        cost.green++;
        break;
      case 'C':
        cost.colorless++;
        break;
      case 'X':
        cost.x++;
        break;
      default: {
        // Try to parse as a number (generic mana)
        const numericValue = parseInt(symbol, 10);
        if (!isNaN(numericValue)) {
          cost.generic += numericValue;
        }
        // Ignore unknown symbols (hybrid mana, phyrexian, etc. - not in 6th Ed)
        break;
      }
    }
  }

  return cost;
}

/**
 * Calculate the total mana in a pool
 */
export function getTotalMana(pool: ManaPool): number {
  return pool.white + pool.blue + pool.black + pool.red + pool.green + pool.colorless;
}

/**
 * Calculate the converted mana cost (total mana needed, excluding X)
 */
export function getConvertedManaCost(cost: ManaCost): number {
  return (
    cost.white + cost.blue + cost.black + cost.red + cost.green + cost.colorless + cost.generic
  );
}

/**
 * Check if a mana pool can pay a mana cost
 *
 * For X costs, xValue must be provided (defaults to 0)
 *
 * @param pool - Current mana pool
 * @param cost - Mana cost to pay
 * @param xValue - Value chosen for each X in the cost (default 0)
 * @returns true if the pool can pay the cost
 */
export function canPayManaCost(pool: ManaPool, cost: ManaCost, xValue: number = 0): boolean {
  // Check colored mana requirements first
  if (pool.white < cost.white) return false;
  if (pool.blue < cost.blue) return false;
  if (pool.black < cost.black) return false;
  if (pool.red < cost.red) return false;
  if (pool.green < cost.green) return false;
  if (pool.colorless < cost.colorless) return false;

  // Calculate remaining mana after paying colored costs
  const remainingMana =
    pool.white -
    cost.white +
    (pool.blue - cost.blue) +
    (pool.black - cost.black) +
    (pool.red - cost.red) +
    (pool.green - cost.green) +
    (pool.colorless - cost.colorless);

  // Generic mana + X costs can be paid with any remaining mana
  const genericNeeded = cost.generic + cost.x * xValue;

  return remainingMana >= genericNeeded;
}

/**
 * Pay a mana cost from a pool, returning the new pool state
 *
 * Uses a simple greedy algorithm for paying generic costs:
 * 1. Pay colored requirements first (exact colors)
 * 2. Pay colorless requirements with colorless mana
 * 3. Pay generic/X costs with any available mana (colorless first, then colors)
 *
 * @param pool - Current mana pool
 * @param cost - Mana cost to pay
 * @param xValue - Value chosen for each X (default 0)
 * @returns New mana pool after payment
 * @throws Error if pool cannot pay the cost
 */
export function payManaCost(pool: ManaPool, cost: ManaCost, xValue: number = 0): ManaPool {
  if (!canPayManaCost(pool, cost, xValue)) {
    throw new Error('Cannot pay mana cost: insufficient mana');
  }

  // Create new pool (immutable update)
  const newPool: ManaPool = { ...pool };

  // 1. Pay colored costs (exact colors required)
  newPool.white -= cost.white;
  newPool.blue -= cost.blue;
  newPool.black -= cost.black;
  newPool.red -= cost.red;
  newPool.green -= cost.green;
  newPool.colorless -= cost.colorless;

  // 2. Pay generic + X costs with any available mana
  let genericRemaining = cost.generic + cost.x * xValue;

  // Pay with colorless first (it can only be used for generic)
  const colorlessForGeneric = Math.min(newPool.colorless, genericRemaining);
  newPool.colorless -= colorlessForGeneric;
  genericRemaining -= colorlessForGeneric;

  // Then use colored mana for remaining generic (order doesn't matter for basic auto-tap)
  // We'll use: white, blue, black, red, green order
  const colors: (keyof ManaPool)[] = ['white', 'blue', 'black', 'red', 'green'];
  for (const color of colors) {
    if (genericRemaining <= 0) break;
    const fromColor = Math.min(newPool[color], genericRemaining);
    newPool[color] -= fromColor;
    genericRemaining -= fromColor;
  }

  return newPool;
}

/**
 * Add mana of a specific color to a pool
 *
 * @param pool - Current mana pool
 * @param color - Color to add ('W', 'U', 'B', 'R', 'G', 'C')
 * @param amount - Amount to add (default 1)
 * @returns New mana pool with added mana
 */
export function addManaToPool(pool: ManaPool, color: ManaColor, amount: number = 1): ManaPool {
  const newPool: ManaPool = { ...pool };

  switch (color) {
    case 'W':
      newPool.white += amount;
      break;
    case 'U':
      newPool.blue += amount;
      break;
    case 'B':
      newPool.black += amount;
      break;
    case 'R':
      newPool.red += amount;
      break;
    case 'G':
      newPool.green += amount;
      break;
    case 'C':
      newPool.colorless += amount;
      break;
  }

  return newPool;
}

/**
 * Empty a mana pool (used at end of phases)
 */
export function emptyManaPool(): ManaPool {
  return {
    white: 0,
    blue: 0,
    black: 0,
    red: 0,
    green: 0,
    colorless: 0,
  };
}

/**
 * Format a mana pool for display
 *
 * @param pool - Mana pool to format
 * @returns String like "{W}{W}{U}{R}" or "Empty" if no mana
 */
export function formatManaPool(pool: ManaPool): string {
  const parts: string[] = [];

  for (let i = 0; i < pool.white; i++) parts.push('{W}');
  for (let i = 0; i < pool.blue; i++) parts.push('{U}');
  for (let i = 0; i < pool.black; i++) parts.push('{B}');
  for (let i = 0; i < pool.red; i++) parts.push('{R}');
  for (let i = 0; i < pool.green; i++) parts.push('{G}');
  for (let i = 0; i < pool.colorless; i++) parts.push('{C}');

  return parts.length > 0 ? parts.join('') : 'Empty';
}

/**
 * Format a mana cost for display
 *
 * @param cost - Mana cost to format
 * @returns String like "{2}{R}{R}" or "{X}{G}{G}"
 */
export function formatManaCost(cost: ManaCost): string {
  const parts: string[] = [];

  // X comes first
  for (let i = 0; i < cost.x; i++) parts.push('{X}');

  // Then generic
  if (cost.generic > 0) parts.push(`{${cost.generic}}`);

  // Then colors in WUBRG order
  for (let i = 0; i < cost.white; i++) parts.push('{W}');
  for (let i = 0; i < cost.blue; i++) parts.push('{U}');
  for (let i = 0; i < cost.black; i++) parts.push('{B}');
  for (let i = 0; i < cost.red; i++) parts.push('{R}');
  for (let i = 0; i < cost.green; i++) parts.push('{G}');

  // Colorless last
  for (let i = 0; i < cost.colorless; i++) parts.push('{C}');

  return parts.length > 0 ? parts.join('') : '{0}';
}

/**
 * Get the color(s) that a land produces based on its type
 *
 * @param typeLine - Card type line (e.g., "Basic Land — Mountain")
 * @returns Array of mana colors the land produces
 */
export function getLandManaColors(typeLine: string): ManaColor[] {
  const colors: ManaColor[] = [];
  const lowerType = typeLine.toLowerCase();

  if (lowerType.includes('plains')) colors.push('W');
  if (lowerType.includes('island')) colors.push('U');
  if (lowerType.includes('swamp')) colors.push('B');
  if (lowerType.includes('mountain')) colors.push('R');
  if (lowerType.includes('forest')) colors.push('G');

  return colors;
}

/**
 * Check if a card has an X in its mana cost
 */
export function hasXInCost(manaCostString: string | undefined): boolean {
  if (!manaCostString) return false;
  return manaCostString.toUpperCase().includes('{X}');
}

/**
 * Get the minimum X value that makes sense for a spell
 * (usually 0, but some spells need X >= 1 to do anything)
 */
export function getMinimumXValue(_manaCostString: string | undefined): number {
  // For now, all X spells can be cast with X=0 (even if useless)
  // In the future, we could parse oracle text to find minimum useful X
  return 0;
}
