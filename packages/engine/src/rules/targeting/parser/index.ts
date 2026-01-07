/**
 * Target Requirements Parser
 *
 * Parses oracle text to extract target requirements.
 * Uses a pattern registry for extensible matching.
 */

import type { TargetRequirement } from '../types';
import { matchTargetPattern } from './patterns';

// =============================================================================
// MAIN PARSING FUNCTION
// =============================================================================

/**
 * Parse target requirements from oracle text
 *
 * Examples:
 * - "Lightning Bolt deals 3 damage to any target."
 *   -> [{ targetType: 'any', count: 1 }]
 *
 * - "Destroy target nonblack creature."
 *   -> [{ targetType: 'creature', restrictions: [{ type: 'color', color: 'B', negated: true }] }]
 *
 * - "Counter target spell."
 *   -> [{ targetType: 'spell', zone: 'stack' }]
 *
 * @param oracleText - The oracle text to parse
 * @returns Array of target requirements
 */
export function parseTargetRequirements(oracleText: string): TargetRequirement[] {
  if (!oracleText) return [];

  const requirements: TargetRequirement[] = [];

  // Filter out ability text - these have their own targeting when activated/triggered
  // - Triggered abilities start with "When", "Whenever", or "At"
  // - Activated abilities start with a cost (e.g., "{R}, {T}:") followed by a colon
  const sentences = oracleText.split(/[.\n]/);
  const spellText = sentences
    .filter((s) => {
      const trimmed = s.trim().toLowerCase();
      // Filter triggered abilities
      if (trimmed.startsWith('when') || trimmed.startsWith('at ')) {
        return false;
      }
      // Filter activated abilities - they start with {cost}: pattern
      // e.g., "{R}, {T}: Deal 1 damage..." or "{2}: Do something..."
      if (/^\{[^}]+\}.*:/.test(trimmed)) {
        return false;
      }
      return true;
    })
    .join('. ');

  const text = spellText.toLowerCase();

  // Try to match a pattern
  const pattern = matchTargetPattern(text);
  if (pattern) {
    const match = text.match(pattern.regex);
    if (match) {
      const requirement = pattern.handler(match, 0);
      requirements.push(requirement);
    }
  }

  return requirements;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a spell/ability requires targets
 *
 * @param oracleText - The oracle text to check
 * @returns True if the spell requires targets
 */
export function requiresTargets(oracleText: string | undefined): boolean {
  if (!oracleText) return false;
  return parseTargetRequirements(oracleText).length > 0;
}

/**
 * Get the total number of targets required (non-optional)
 *
 * @param requirements - Array of target requirements
 * @returns Total required target count
 */
export function getRequiredTargetCount(requirements: TargetRequirement[]): number {
  return requirements.reduce((sum, req) => sum + (req.optional ? 0 : req.count), 0);
}

/**
 * Get the maximum number of targets allowed
 *
 * @param requirements - Array of target requirements
 * @returns Maximum target count
 */
export function getMaxTargetCount(requirements: TargetRequirement[]): number {
  return requirements.reduce((sum, req) => sum + req.count, 0);
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

export { matchTargetPattern, getAllMatchingPatterns, TARGET_PATTERNS } from './patterns';
export type { TargetPattern } from './patterns';
