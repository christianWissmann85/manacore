/**
 * Protection Logic
 *
 * Handles Hexproof, Shroud, and Protection from colors checks.
 * These are used during target validation to determine if a
 * permanent can be legally targeted.
 */

import type { CardTemplate } from '../../../cards/CardTemplate';
import { hasKeyword } from '../../../cards/CardTemplate';
import type { MtgColor } from '../types';
import { COLOR_NAMES } from '../types';

// =============================================================================
// HEXPROOF & SHROUD
// =============================================================================

/**
 * Check if a card has Hexproof
 *
 * Hexproof means the permanent can't be the target of spells or abilities
 * your opponents control.
 */
export function hasHexproof(card: CardTemplate): boolean {
  return hasKeyword(card, 'Hexproof');
}

/**
 * Check if a card has Shroud
 *
 * Shroud means the permanent can't be the target of spells or abilities
 * (including your own).
 */
export function hasShroud(card: CardTemplate): boolean {
  return hasKeyword(card, 'Shroud');
}

// =============================================================================
// PROTECTION
// =============================================================================

/**
 * Check if a card has Protection from a specific color
 *
 * Looks for patterns like:
 * - "Protection from black"
 * - "Protection from white and from blue"
 *
 * @param card - The card to check
 * @param color - The color to check protection from
 * @returns true if the card has protection from that color
 */
export function hasProtectionFrom(card: CardTemplate, color: MtgColor): boolean {
  const oracleText = card.oracle_text?.toLowerCase() || '';
  const colorName = COLOR_NAMES[color];
  return oracleText.includes(`protection from ${colorName}`);
}

/**
 * Check if a card has Protection from all colors
 *
 * This is a special case that protects from all colored sources.
 */
export function hasProtectionFromAllColors(card: CardTemplate): boolean {
  const oracleText = card.oracle_text?.toLowerCase() || '';
  return oracleText.includes('protection from all colors');
}

// =============================================================================
// SOURCE COLOR UTILITIES
// =============================================================================

/**
 * Get the colors of a source (spell/ability source)
 *
 * Filters the card's colors to only include valid MTG colors.
 * Colorless cards return an empty array.
 *
 * @param card - The source card
 * @returns Array of MtgColor values
 */
export function getSourceColors(card: CardTemplate): MtgColor[] {
  return card.colors.filter((c): c is MtgColor => ['W', 'U', 'B', 'R', 'G'].includes(c));
}

/**
 * Check if a target has protection from the source
 *
 * This checks both protection from all colors and protection from
 * specific colors of the source.
 *
 * @param target - The potential target card
 * @param source - The source of the spell/ability
 * @returns true if the target has protection from the source
 */
export function hasProtectionFromSource(target: CardTemplate, source: CardTemplate): boolean {
  const sourceColors = getSourceColors(source);

  // Check protection from all colors (only blocks colored sources)
  if (hasProtectionFromAllColors(target) && sourceColors.length > 0) {
    return true;
  }

  // Check protection from specific colors
  for (const color of sourceColors) {
    if (hasProtectionFrom(target, color)) {
      return true;
    }
  }

  return false;
}
