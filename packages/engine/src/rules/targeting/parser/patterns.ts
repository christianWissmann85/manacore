/**
 * Target Pattern Registry
 *
 * Pattern-based oracle text parsing for target requirements.
 * Each pattern has a regex, priority (higher = more specific), and handler.
 *
 * Priority guidelines:
 * - 100+: Most specific patterns (multiple restrictions)
 * - 90-99: Two restrictions or specific subtypes
 * - 80-89: Single specific restriction
 * - 70-79: Spell/player patterns
 * - 60-69: Simple type patterns
 * - 50-59: Generic patterns (creature, permanent)
 */

import type { TargetRequirement, TargetRestriction, TargetType } from '../types';
import type { Zone } from '../../../state/Zone';

// =============================================================================
// TYPES
// =============================================================================

/**
 * A pattern matcher for oracle text
 */
export interface TargetPattern {
  /** Regex to match oracle text (always case-insensitive) */
  regex: RegExp;
  /** Priority (higher = checked first, more specific patterns win) */
  priority: number;
  /** Handler function to create TargetRequirement */
  handler: (match: RegExpMatchArray, requirementIndex: number) => TargetRequirement;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a standard target requirement with default values
 */
function createRequirement(
  idx: number,
  targetType: TargetType,
  description: string,
  options: {
    zone?: Zone | 'any';
    restrictions?: TargetRestriction[];
    count?: number;
    optional?: boolean;
  } = {},
): TargetRequirement {
  return {
    id: `target_${idx}`,
    count: options.count ?? 1,
    targetType,
    zone: options.zone ?? 'battlefield',
    restrictions: options.restrictions ?? [],
    optional: options.optional ?? false,
    description,
  };
}

// =============================================================================
// PATTERN REGISTRY
// =============================================================================

/**
 * Pattern registry - ordered by priority
 *
 * Higher priority patterns are checked first (more specific patterns win).
 * This ensures "target nonartifact, nonblack creature" matches before
 * "target creature".
 */
export const TARGET_PATTERNS: TargetPattern[] = [
  // =========================================================================
  // CREATURE PATTERNS - MOST SPECIFIC (Priority 100+)
  // =========================================================================

  // "target nonartifact, nonblack creature" (Terror pattern)
  // Most specific: two restrictions
  {
    regex: /target nonartifact,?\s*nonblack creature/i,
    priority: 105,
    handler: (match, idx) =>
      createRequirement(idx, 'creature', 'target nonartifact, nonblack creature', {
        restrictions: [{ type: 'nonartifact' }, { type: 'color', color: 'B', negated: true }],
      }),
  },

  // =========================================================================
  // CREATURE PATTERNS - TWO RESTRICTIONS (Priority 90-99)
  // =========================================================================

  // "target nonwhite attacking creature" (Exile)
  {
    regex: /target nonwhite attacking creature/i,
    priority: 95,
    handler: (match, idx) =>
      createRequirement(idx, 'creature', 'target nonwhite attacking creature', {
        restrictions: [
          { type: 'color', color: 'W', negated: true },
          { type: 'combat', status: 'attacking' },
        ],
      }),
  },

  // "target nonblack attacking creature"
  {
    regex: /target nonblack attacking creature/i,
    priority: 95,
    handler: (match, idx) =>
      createRequirement(idx, 'creature', 'target nonblack attacking creature', {
        restrictions: [
          { type: 'color', color: 'B', negated: true },
          { type: 'combat', status: 'attacking' },
        ],
      }),
  },

  // "target tapped creature you control"
  {
    regex: /target tapped creature you control/i,
    priority: 92,
    handler: (match, idx) =>
      createRequirement(idx, 'creature', 'target tapped creature you control', {
        restrictions: [{ type: 'tapped' }, { type: 'controller', controller: 'you' }],
      }),
  },

  // "target untapped creature you control"
  {
    regex: /target untapped creature you control/i,
    priority: 92,
    handler: (match, idx) =>
      createRequirement(idx, 'creature', 'target untapped creature you control', {
        restrictions: [{ type: 'untapped' }, { type: 'controller', controller: 'you' }],
      }),
  },

  // "target creature an opponent controls"
  {
    regex: /target creature an opponent controls/i,
    priority: 92,
    handler: (match, idx) =>
      createRequirement(idx, 'creature', 'target creature an opponent controls', {
        restrictions: [{ type: 'controller', controller: 'opponent' }],
      }),
  },

  // "target creature you control"
  {
    regex: /target creature you control/i,
    priority: 91,
    handler: (match, idx) =>
      createRequirement(idx, 'creature', 'target creature you control', {
        restrictions: [{ type: 'controller', controller: 'you' }],
      }),
  },

  // =========================================================================
  // CREATURE PATTERNS - COMBAT STATUS (Priority 85-89)
  // =========================================================================

  // "target attacking or blocking creature"
  {
    regex: /target attacking or blocking creature/i,
    priority: 88,
    handler: (match, idx) =>
      createRequirement(idx, 'creature', 'target attacking or blocking creature', {
        restrictions: [{ type: 'combat', status: 'attacking_or_blocking' }],
      }),
  },

  // "target attacking creature"
  {
    regex: /target attacking creature/i,
    priority: 85,
    handler: (match, idx) =>
      createRequirement(idx, 'creature', 'target attacking creature', {
        restrictions: [{ type: 'combat', status: 'attacking' }],
      }),
  },

  // "target blocking creature"
  {
    regex: /target blocking creature/i,
    priority: 85,
    handler: (match, idx) =>
      createRequirement(idx, 'creature', 'target blocking creature', {
        restrictions: [{ type: 'combat', status: 'blocking' }],
      }),
  },

  // =========================================================================
  // CREATURE PATTERNS - SINGLE RESTRICTION (Priority 80-84)
  // =========================================================================

  // "target nonblack creature"
  {
    regex: /target nonblack creature/i,
    priority: 82,
    handler: (match, idx) =>
      createRequirement(idx, 'creature', 'target nonblack creature', {
        restrictions: [{ type: 'color', color: 'B', negated: true }],
      }),
  },

  // "target nonwhite creature"
  {
    regex: /target nonwhite creature/i,
    priority: 82,
    handler: (match, idx) =>
      createRequirement(idx, 'creature', 'target nonwhite creature', {
        restrictions: [{ type: 'color', color: 'W', negated: true }],
      }),
  },

  // "target nonblue creature"
  {
    regex: /target nonblue creature/i,
    priority: 82,
    handler: (match, idx) =>
      createRequirement(idx, 'creature', 'target nonblue creature', {
        restrictions: [{ type: 'color', color: 'U', negated: true }],
      }),
  },

  // "target nonred creature"
  {
    regex: /target nonred creature/i,
    priority: 82,
    handler: (match, idx) =>
      createRequirement(idx, 'creature', 'target nonred creature', {
        restrictions: [{ type: 'color', color: 'R', negated: true }],
      }),
  },

  // "target nongreen creature"
  {
    regex: /target nongreen creature/i,
    priority: 82,
    handler: (match, idx) =>
      createRequirement(idx, 'creature', 'target nongreen creature', {
        restrictions: [{ type: 'color', color: 'G', negated: true }],
      }),
  },

  // "target nonartifact creature"
  {
    regex: /target nonartifact creature/i,
    priority: 82,
    handler: (match, idx) =>
      createRequirement(idx, 'creature', 'target nonartifact creature', {
        restrictions: [{ type: 'nonartifact' }],
      }),
  },

  // "target tapped creature"
  {
    regex: /target tapped creature/i,
    priority: 81,
    handler: (match, idx) =>
      createRequirement(idx, 'creature', 'target tapped creature', {
        restrictions: [{ type: 'tapped' }],
      }),
  },

  // "target untapped creature"
  {
    regex: /target untapped creature/i,
    priority: 81,
    handler: (match, idx) =>
      createRequirement(idx, 'creature', 'target untapped creature', {
        restrictions: [{ type: 'untapped' }],
      }),
  },

  // Color-specific creature patterns (positive)
  // "target white creature"
  {
    regex: /target white creature/i,
    priority: 80,
    handler: (match, idx) =>
      createRequirement(idx, 'creature', 'target white creature', {
        restrictions: [{ type: 'color', color: 'W', negated: false }],
      }),
  },

  // "target blue creature"
  {
    regex: /target blue creature/i,
    priority: 80,
    handler: (match, idx) =>
      createRequirement(idx, 'creature', 'target blue creature', {
        restrictions: [{ type: 'color', color: 'U', negated: false }],
      }),
  },

  // "target black creature"
  {
    regex: /target black creature/i,
    priority: 80,
    handler: (match, idx) =>
      createRequirement(idx, 'creature', 'target black creature', {
        restrictions: [{ type: 'color', color: 'B', negated: false }],
      }),
  },

  // "target red creature"
  {
    regex: /target red creature/i,
    priority: 80,
    handler: (match, idx) =>
      createRequirement(idx, 'creature', 'target red creature', {
        restrictions: [{ type: 'color', color: 'R', negated: false }],
      }),
  },

  // "target green creature"
  {
    regex: /target green creature/i,
    priority: 80,
    handler: (match, idx) =>
      createRequirement(idx, 'creature', 'target green creature', {
        restrictions: [{ type: 'color', color: 'G', negated: false }],
      }),
  },

  // =========================================================================
  // SPELL PATTERNS (Priority 75-79)
  // =========================================================================

  // "target creature spell"
  {
    regex: /target creature spell/i,
    priority: 78,
    handler: (match, idx) =>
      createRequirement(idx, 'creature_spell', 'target creature spell', {
        zone: 'stack',
      }),
  },

  // "target instant or sorcery spell"
  {
    regex: /target instant or sorcery spell/i,
    priority: 77,
    handler: (match, idx) =>
      createRequirement(idx, 'spell', 'target instant or sorcery spell', {
        zone: 'stack',
      }),
  },

  // "target spell" (generic)
  {
    regex: /target spell/i,
    priority: 75,
    handler: (match, idx) =>
      createRequirement(idx, 'spell', 'target spell', {
        zone: 'stack',
      }),
  },

  // =========================================================================
  // PLAYER PATTERNS (Priority 70-74)
  // =========================================================================

  // "target opponent"
  {
    regex: /target opponent/i,
    priority: 72,
    handler: (match, idx) =>
      createRequirement(idx, 'opponent', 'target opponent', {
        zone: 'any',
      }),
  },

  // "target player" (exclude "target player discards" which is part of a discard effect)
  {
    regex: /target player(?!\s+discards)/i,
    priority: 70,
    handler: (match, idx) =>
      createRequirement(idx, 'player', 'target player', {
        zone: 'any',
      }),
  },

  // =========================================================================
  // PERMANENT TYPE PATTERNS (Priority 60-69)
  // =========================================================================

  // "target artifact or enchantment"
  {
    regex: /target artifact or enchantment/i,
    priority: 68,
    handler: (match, idx) =>
      createRequirement(idx, 'artifact_or_enchantment', 'target artifact or enchantment', {}),
  },

  // "any target" / "to any target" (creature, player, or planeswalker)
  {
    regex: /(?:any target|to any target)/i,
    priority: 65,
    handler: (match, idx) => createRequirement(idx, 'any', 'any target', {}),
  },

  // "target artifact"
  {
    regex: /target artifact/i,
    priority: 62,
    handler: (match, idx) => createRequirement(idx, 'artifact', 'target artifact', {}),
  },

  // "target enchantment"
  {
    regex: /target enchantment/i,
    priority: 62,
    handler: (match, idx) => createRequirement(idx, 'enchantment', 'target enchantment', {}),
  },

  // "target land"
  {
    regex: /target land/i,
    priority: 62,
    handler: (match, idx) => createRequirement(idx, 'land', 'target land', {}),
  },

  // "enchant creature" (Auras)
  {
    regex: /enchant creature/i,
    priority: 60,
    handler: (match, idx) => createRequirement(idx, 'creature', 'enchant creature', {}),
  },

  // "enchant wall" (Animate Wall)
  {
    regex: /enchant wall/i,
    priority: 60,
    handler: (match, idx) =>
      createRequirement(idx, 'creature', 'enchant wall', {
        restrictions: [{ type: 'subtype', subtype: 'Wall' }],
      }),
  },

  // "enchant land" (Wild Growth)
  {
    regex: /enchant land/i,
    priority: 60,
    handler: (match, idx) => createRequirement(idx, 'land', 'enchant land', {}),
  },

  // =========================================================================
  // GENERIC PATTERNS (Priority 50-59)
  // =========================================================================

  // "target creature" (generic, checked last among creatures)
  {
    regex: /target creature/i,
    priority: 55,
    handler: (match, idx) => createRequirement(idx, 'creature', 'target creature', {}),
  },

  // "target permanent"
  {
    regex: /target permanent/i,
    priority: 50,
    handler: (match, idx) => createRequirement(idx, 'permanent', 'target permanent', {}),
  },
];

// =============================================================================
// PATTERN MATCHING
// =============================================================================

/**
 * Match oracle text against all patterns, return best match (highest priority)
 *
 * @param text - Oracle text to match (should be lowercase)
 * @returns The matching pattern or null if no match
 */
export function matchTargetPattern(text: string): TargetPattern | null {
  // Sort patterns by priority (highest first)
  const sortedPatterns = [...TARGET_PATTERNS].sort((a, b) => b.priority - a.priority);

  for (const pattern of sortedPatterns) {
    if (pattern.regex.test(text)) {
      return pattern;
    }
  }

  return null;
}

/**
 * Get all patterns that match the text, sorted by priority
 *
 * Useful for debugging or handling cards with multiple targeting clauses.
 *
 * @param text - Oracle text to match
 * @returns Array of matching patterns, sorted by priority (highest first)
 */
export function getAllMatchingPatterns(text: string): TargetPattern[] {
  const lowerText = text.toLowerCase();
  return TARGET_PATTERNS.filter((pattern) => pattern.regex.test(lowerText)).sort(
    (a, b) => b.priority - a.priority,
  );
}
