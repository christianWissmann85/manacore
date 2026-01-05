# Targeting System Refactor

**Date**: January 4, 2026
**Status**: Complete
**Goal**: Refactor the monolithic 732-line `targeting.ts` into a modular, pattern-based system

## Overview

The targeting system currently handles parsing oracle text, validating targets, checking protection/hexproof, generating legal targets, and checking fizzle conditions - all in a single 732-line file. As more cards are added, the oracle text parser will become unmaintainable with dozens of hardcoded if-else branches.

This refactor will:

- **Split into focused modules** by responsibility (parsing, validation, generation, resolution)
- **Use a pattern registry** for extensible oracle text parsing
- **Create composable validators** for target restrictions
- **Improve testability** through separation of concerns
- **Enable easy additions** of new targeting patterns without touching core logic

## Current Structure Problems

### File: `packages/engine/src/rules/targeting.ts` (732 lines)

**Issues**:

1. **Monolithic parser**: `parseTargetRequirements()` has ~30 if-else branches for different oracle text patterns
2. **Mixed responsibilities**: Types, parsing, validation, protection checks, legal target generation all together
3. **Hardcoded patterns**: Each new targeting pattern requires editing the core parsing function
4. **Poor extensibility**: Adding "target tapped creature" means finding the right place in a long if-else chain
5. **Testing difficulty**: Can't test individual components in isolation
6. **Maintenance burden**: 732 lines that will grow exponentially as more cards are added

### Current Sections

```typescript
// Types (50 lines)
export type TargetType = ...
export type TargetRestriction = ...
export interface TargetRequirement = ...

// Oracle text parsing (250 lines)
export function parseTargetRequirements() {
  if (text.includes('any target')) { ... }
  else if (/target player/.test(text)) { ... }
  else if (/target opponent/.test(text)) { ... }
  // ... 27 more branches ...
}

// Protection checks (100 lines)
export function hasHexproof() { ... }
export function hasProtectionFrom() { ... }

// Validation (200 lines)
export function validateTargets() { ... }
export function validateSingleTarget() { ... }
validateTargetType(), validateRestriction()

// Legal target generation (100 lines)
export function getLegalTargets() { ... }
export function getAllLegalTargetCombinations() { ... }

// Resolution/fizzle checks (50 lines)
export function checkTargetsStillLegal() { ... }
export function shouldSpellFizzle() { ... }
```

## New Structure

```
packages/engine/src/rules/targeting/
├── index.ts                    # Public API (barrel exports)
├── types.ts                    # Type definitions only
│
├── parser/
│   ├── index.ts               # Main parseTargetRequirements()
│   ├── patterns.ts            # Pattern registry & handlers
│   └── restrictions.ts        # Parse restriction clauses
│
├── validation/
│   ├── index.ts               # Main validation entry points
│   ├── validators.ts          # Per-restriction validators
│   └── protection.ts          # Hexproof, Shroud, Protection checks
│
├── generation/
│   ├── index.ts               # Legal target generation
│   └── combinations.ts        # Target combination algorithms
│
└── resolution/
    └── index.ts               # Fizzle checks & resolution validation
```

## Detailed Module Breakdown

### 1. `types.ts` (60 lines)

**Responsibility**: Pure type definitions

```typescript
export type TargetType =
  | 'any'
  | 'creature'
  | 'player'
  | 'opponent'
  | 'spell'
  | 'creature_spell'
  | 'permanent'
  | 'artifact'
  | 'enchantment'
  | 'land'
  | 'artifact_or_enchantment';

export type MtgColor = 'W' | 'U' | 'B' | 'R' | 'G';

export type TargetRestriction =
  | { type: 'color'; color: MtgColor; negated: boolean }
  | { type: 'controller'; controller: 'you' | 'opponent' }
  | { type: 'combat'; status: 'attacking' | 'blocking' | 'attacking_or_blocking' }
  | { type: 'tapped' }
  | { type: 'untapped' }
  | { type: 'nonartifact' }
  | { type: 'nonland' }
  | { type: 'keyword'; keyword: string }
  | { type: 'subtype'; subtype: string };

export interface TargetRequirement {
  id: string;
  count: number;
  targetType: TargetType;
  zone: Zone | 'any';
  restrictions: TargetRestriction[];
  optional: boolean;
  description: string;
}

export interface ResolvedTarget {
  id: string;
  type: 'card' | 'player' | 'stack_object';
}
```

---

### 2. `parser/` Module (250 lines total)

#### `parser/patterns.ts` (180 lines)

**Responsibility**: Pattern matching & handlers

```typescript
import type { TargetRequirement, TargetType, TargetRestriction } from '../types';

/**
 * A pattern matcher for oracle text
 */
export interface TargetPattern {
  /** Regex to match oracle text */
  regex: RegExp;
  /** Priority (higher = checked first) */
  priority: number;
  /** Handler function to create TargetRequirement */
  handler: (match: RegExpMatchArray, requirementIndex: number) => TargetRequirement;
}

/**
 * Pattern registry - ordered by priority
 * Higher priority patterns are checked first (more specific patterns win)
 */
export const TARGET_PATTERNS: TargetPattern[] = [
  // === Creature patterns (specific first) ===
  {
    regex: /target nonartifact,?\s*nonblack creature/,
    priority: 100,
    handler: (match, idx) => ({
      id: `target_${idx}`,
      count: 1,
      targetType: 'creature',
      zone: 'battlefield',
      restrictions: [{ type: 'nonartifact' }, { type: 'color', color: 'B', negated: true }],
      optional: false,
      description: 'target nonartifact, nonblack creature',
    }),
  },

  {
    regex: /target nonwhite attacking creature/,
    priority: 95,
    handler: (match, idx) => ({
      id: `target_${idx}`,
      count: 1,
      targetType: 'creature',
      zone: 'battlefield',
      restrictions: [
        { type: 'color', color: 'W', negated: true },
        { type: 'combat', status: 'attacking' },
      ],
      optional: false,
      description: 'target nonwhite attacking creature',
    }),
  },

  {
    regex: /target attacking or blocking creature/,
    priority: 90,
    handler: (match, idx) => ({
      id: `target_${idx}`,
      count: 1,
      targetType: 'creature',
      zone: 'battlefield',
      restrictions: [{ type: 'combat', status: 'attacking_or_blocking' }],
      optional: false,
      description: 'target attacking or blocking creature',
    }),
  },

  {
    regex: /target attacking creature/,
    priority: 85,
    handler: (match, idx) => ({
      id: `target_${idx}`,
      count: 1,
      targetType: 'creature',
      zone: 'battlefield',
      restrictions: [{ type: 'combat', status: 'attacking' }],
      optional: false,
      description: 'target attacking creature',
    }),
  },

  {
    regex: /target blocking creature/,
    priority: 85,
    handler: (match, idx) => ({
      id: `target_${idx}`,
      count: 1,
      targetType: 'creature',
      zone: 'battlefield',
      restrictions: [{ type: 'combat', status: 'blocking' }],
      optional: false,
      description: 'target blocking creature',
    }),
  },

  {
    regex: /target nonblack creature/,
    priority: 80,
    handler: (match, idx) => ({
      id: `target_${idx}`,
      count: 1,
      targetType: 'creature',
      zone: 'battlefield',
      restrictions: [{ type: 'color', color: 'B', negated: true }],
      optional: false,
      description: 'target nonblack creature',
    }),
  },

  {
    regex: /target nonartifact creature/,
    priority: 80,
    handler: (match, idx) => ({
      id: `target_${idx}`,
      count: 1,
      targetType: 'creature',
      zone: 'battlefield',
      restrictions: [{ type: 'nonartifact' }],
      optional: false,
      description: 'target nonartifact creature',
    }),
  },

  {
    regex: /target creature/,
    priority: 50,
    handler: (match, idx) => ({
      id: `target_${idx}`,
      count: 1,
      targetType: 'creature',
      zone: 'battlefield',
      restrictions: [],
      optional: false,
      description: 'target creature',
    }),
  },

  // === Player/Opponent patterns ===
  {
    regex: /any target|to any target/,
    priority: 60,
    handler: (match, idx) => ({
      id: `target_${idx}`,
      count: 1,
      targetType: 'any',
      zone: 'battlefield',
      restrictions: [],
      optional: false,
      description: 'any target',
    }),
  },

  {
    regex: /target opponent/,
    priority: 70,
    handler: (match, idx) => ({
      id: `target_${idx}`,
      count: 1,
      targetType: 'opponent',
      zone: 'any',
      restrictions: [],
      optional: false,
      description: 'target opponent',
    }),
  },

  {
    regex: /target player/,
    priority: 65,
    handler: (match, idx) => ({
      id: `target_${idx}`,
      count: 1,
      targetType: 'player',
      zone: 'any',
      restrictions: [],
      optional: false,
      description: 'target player',
    }),
  },

  // === Spell patterns ===
  {
    regex: /target creature spell/,
    priority: 75,
    handler: (match, idx) => ({
      id: `target_${idx}`,
      count: 1,
      targetType: 'creature_spell',
      zone: 'stack',
      restrictions: [],
      optional: false,
      description: 'target creature spell',
    }),
  },

  {
    regex: /target spell/,
    priority: 70,
    handler: (match, idx) => ({
      id: `target_${idx}`,
      count: 1,
      targetType: 'spell',
      zone: 'stack',
      restrictions: [],
      optional: false,
      description: 'target spell',
    }),
  },

  // === Permanent types ===
  {
    regex: /target artifact or enchantment/,
    priority: 75,
    handler: (match, idx) => ({
      id: `target_${idx}`,
      count: 1,
      targetType: 'artifact_or_enchantment',
      zone: 'battlefield',
      restrictions: [],
      optional: false,
      description: 'target artifact or enchantment',
    }),
  },

  {
    regex: /target artifact/,
    priority: 60,
    handler: (match, idx) => ({
      id: `target_${idx}`,
      count: 1,
      targetType: 'artifact',
      zone: 'battlefield',
      restrictions: [],
      optional: false,
      description: 'target artifact',
    }),
  },

  {
    regex: /target enchantment/,
    priority: 60,
    handler: (match, idx) => ({
      id: `target_${idx}`,
      count: 1,
      targetType: 'enchantment',
      zone: 'battlefield',
      restrictions: [],
      optional: false,
      description: 'target enchantment',
    }),
  },

  {
    regex: /target land/,
    priority: 60,
    handler: (match, idx) => ({
      id: `target_${idx}`,
      count: 1,
      targetType: 'land',
      zone: 'battlefield',
      restrictions: [],
      optional: false,
      description: 'target land',
    }),
  },

  {
    regex: /target permanent/,
    priority: 50,
    handler: (match, idx) => ({
      id: `target_${idx}`,
      count: 1,
      targetType: 'permanent',
      zone: 'battlefield',
      restrictions: [],
      optional: false,
      description: 'target permanent',
    }),
  },
];

/**
 * Match oracle text against all patterns, return best match
 */
export function matchTargetPattern(text: string): TargetPattern | null {
  const sortedPatterns = [...TARGET_PATTERNS].sort((a, b) => b.priority - a.priority);

  for (const pattern of sortedPatterns) {
    if (pattern.regex.test(text)) {
      return pattern;
    }
  }

  return null;
}
```

#### `parser/index.ts` (70 lines)

**Responsibility**: Main parsing entry point

```typescript
import type { TargetRequirement } from '../types';
import { matchTargetPattern } from './patterns';

/**
 * Parse target requirements from oracle text
 */
export function parseTargetRequirements(oracleText: string): TargetRequirement[] {
  if (!oracleText) return [];

  const requirements: TargetRequirement[] = [];

  // Filter out triggered ability text
  const sentences = oracleText.split(/[.\n]/);
  const spellText = sentences
    .filter((s) => {
      const trimmed = s.trim().toLowerCase();
      return !trimmed.startsWith('when') && !trimmed.startsWith('at ');
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

/**
 * Check if a spell/ability requires targets
 */
export function requiresTargets(oracleText: string | undefined): boolean {
  if (!oracleText) return false;
  return parseTargetRequirements(oracleText).length > 0;
}

/**
 * Get the total number of targets required
 */
export function getRequiredTargetCount(requirements: TargetRequirement[]): number {
  return requirements.reduce((sum, req) => sum + (req.optional ? 0 : req.count), 0);
}

/**
 * Get the maximum number of targets allowed
 */
export function getMaxTargetCount(requirements: TargetRequirement[]): number {
  return requirements.reduce((sum, req) => sum + req.count, 0);
}
```

---

### 3. `validation/` Module (250 lines total)

#### `validation/protection.ts` (100 lines)

**Responsibility**: Protection, Hexproof, Shroud checks

```typescript
import type { CardTemplate } from '../../cards/CardTemplate';
import { hasKeyword } from '../../cards/CardTemplate';
import type { MtgColor } from '../types';

/**
 * Check if a card has Hexproof
 */
export function hasHexproof(card: CardTemplate): boolean {
  return hasKeyword(card, 'Hexproof');
}

/**
 * Check if a card has Shroud
 */
export function hasShroud(card: CardTemplate): boolean {
  return hasKeyword(card, 'Shroud');
}

/**
 * Check if a card has Protection from a color
 */
export function hasProtectionFrom(card: CardTemplate, color: MtgColor): boolean {
  const oracleText = card.oracle_text?.toLowerCase() || '';
  const colorNames: Record<MtgColor, string> = {
    W: 'white',
    U: 'blue',
    B: 'black',
    R: 'red',
    G: 'green',
  };

  const colorName = colorNames[color];
  return oracleText.includes(`protection from ${colorName}`);
}

/**
 * Check if a card has Protection from all colors
 */
export function hasProtectionFromAllColors(card: CardTemplate): boolean {
  const oracleText = card.oracle_text?.toLowerCase() || '';
  return oracleText.includes('protection from all colors');
}

/**
 * Get the colors of a source (spell/ability source)
 */
export function getSourceColors(card: CardTemplate): MtgColor[] {
  return card.colors.filter((c): c is MtgColor => ['W', 'U', 'B', 'R', 'G'].includes(c));
}

/**
 * Check if a target has protection from the source
 */
export function hasProtectionFromSource(target: CardTemplate, source: CardTemplate): boolean {
  const sourceColors = getSourceColors(source);

  // Check protection from all colors
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
```

#### `validation/validators.ts` (100 lines)

**Responsibility**: Individual restriction validators

```typescript
import type { GameState } from '../../state/GameState';
import type { CardInstance } from '../../state/CardInstance';
import type { CardTemplate } from '../../cards/CardTemplate';
import type { PlayerId } from '../../state/Zone';
import type { TargetRestriction, MtgColor } from '../types';
import { isArtifact, isLand } from '../../cards/CardTemplate';

/**
 * Validator function type
 */
export type RestrictionValidator = (
  state: GameState,
  card: CardInstance,
  template: CardTemplate,
  restriction: TargetRestriction,
  controller: PlayerId,
) => string | null;

/**
 * Validate color restriction
 */
export function validateColorRestriction(
  state: GameState,
  card: CardInstance,
  template: CardTemplate,
  restriction: TargetRestriction,
  controller: PlayerId,
): string | null {
  if (restriction.type !== 'color') return null;

  const hasColor = template.colors.includes(restriction.color);
  const colorNames: Record<MtgColor, string> = {
    W: 'white',
    U: 'blue',
    B: 'black',
    R: 'red',
    G: 'green',
  };

  if (restriction.negated) {
    if (hasColor) {
      return `Target cannot be ${colorNames[restriction.color]}`;
    }
  } else {
    if (!hasColor) {
      return `Target must be ${restriction.color}`;
    }
  }

  return null;
}

/**
 * Validate controller restriction
 */
export function validateControllerRestriction(
  state: GameState,
  card: CardInstance,
  template: CardTemplate,
  restriction: TargetRestriction,
  controller: PlayerId,
): string | null {
  if (restriction.type !== 'controller') return null;

  if (restriction.controller === 'you') {
    if (card.controller !== controller) {
      return 'Target must be controlled by you';
    }
  } else {
    if (card.controller === controller) {
      return 'Target must be controlled by an opponent';
    }
  }

  return null;
}

/**
 * Validate combat restriction
 */
export function validateCombatRestriction(
  state: GameState,
  card: CardInstance,
  template: CardTemplate,
  restriction: TargetRestriction,
  controller: PlayerId,
): string | null {
  if (restriction.type !== 'combat') return null;

  if (restriction.status === 'attacking') {
    if (!card.attacking) {
      return 'Target must be attacking';
    }
  } else if (restriction.status === 'blocking') {
    if (!card.blocking) {
      return 'Target must be blocking';
    }
  } else if (restriction.status === 'attacking_or_blocking') {
    if (!card.attacking && !card.blocking) {
      return 'Target must be attacking or blocking';
    }
  }

  return null;
}

/**
 * Validate tapped restriction
 */
export function validateTappedRestriction(
  state: GameState,
  card: CardInstance,
  template: CardTemplate,
  restriction: TargetRestriction,
  controller: PlayerId,
): string | null {
  if (restriction.type !== 'tapped') return null;

  if (!card.tapped) {
    return 'Target must be tapped';
  }

  return null;
}

/**
 * Validate untapped restriction
 */
export function validateUntappedRestriction(
  state: GameState,
  card: CardInstance,
  template: CardTemplate,
  restriction: TargetRestriction,
  controller: PlayerId,
): string | null {
  if (restriction.type !== 'untapped') return null;

  if (card.tapped) {
    return 'Target must be untapped';
  }

  return null;
}

/**
 * Validate nonartifact restriction
 */
export function validateNonartifactRestriction(
  state: GameState,
  card: CardInstance,
  template: CardTemplate,
  restriction: TargetRestriction,
  controller: PlayerId,
): string | null {
  if (restriction.type !== 'nonartifact') return null;

  if (isArtifact(template)) {
    return 'Target cannot be an artifact';
  }

  return null;
}

/**
 * Validate nonland restriction
 */
export function validateNonlandRestriction(
  state: GameState,
  card: CardInstance,
  template: CardTemplate,
  restriction: TargetRestriction,
  controller: PlayerId,
): string | null {
  if (restriction.type !== 'nonland') return null;

  if (isLand(template)) {
    return 'Target cannot be a land';
  }

  return null;
}

/**
 * Registry of all restriction validators
 */
export const RESTRICTION_VALIDATORS: Record<string, RestrictionValidator> = {
  color: validateColorRestriction,
  controller: validateControllerRestriction,
  combat: validateCombatRestriction,
  tapped: validateTappedRestriction,
  untapped: validateUntappedRestriction,
  nonartifact: validateNonartifactRestriction,
  nonland: validateNonlandRestriction,
};
```

#### `validation/index.ts` (50 lines)

**Responsibility**: Main validation entry points

```typescript
import type { GameState } from '../../state/GameState';
import type { CardInstance } from '../../state/CardInstance';
import type { PlayerId } from '../../state/Zone';
import type { TargetRequirement, TargetType } from '../types';
import { findCard } from '../../state/GameState';
import { CardLoader } from '../../cards/CardLoader';
import { isCreature, isArtifact, isEnchantment, isLand } from '../../cards/CardTemplate';
import { hasHexproof, hasShroud, hasProtectionFromSource } from './protection';
import { RESTRICTION_VALIDATORS } from './validators';
import { getRequiredTargetCount, getMaxTargetCount } from '../parser';

/**
 * Validate that targets are legal for a spell/ability
 */
export function validateTargets(
  state: GameState,
  targets: string[],
  requirements: TargetRequirement[],
  controller: PlayerId,
  sourceCard?: CardInstance,
): string[] {
  const errors: string[] = [];

  // Check target count
  const requiredCount = getRequiredTargetCount(requirements);
  const maxCount = getMaxTargetCount(requirements);

  if (targets.length < requiredCount) {
    errors.push(`Need at least ${requiredCount} target(s), got ${targets.length}`);
    return errors;
  }

  if (targets.length > maxCount) {
    errors.push(`Maximum ${maxCount} target(s) allowed, got ${targets.length}`);
    return errors;
  }

  // Validate each target
  let targetIndex = 0;
  for (const req of requirements) {
    for (let i = 0; i < req.count && targetIndex < targets.length; i++) {
      const targetId = targets[targetIndex]!;
      const targetErrors = validateSingleTarget(state, targetId, req, controller, sourceCard);
      errors.push(...targetErrors);
      targetIndex++;
    }
  }

  // Check for duplicate targets
  const uniqueTargets = new Set(targets);
  if (uniqueTargets.size !== targets.length) {
    errors.push('Cannot target the same thing multiple times');
  }

  return errors;
}

/**
 * Validate a single target against a requirement
 */
export function validateSingleTarget(
  state: GameState,
  targetId: string,
  requirement: TargetRequirement,
  controller: PlayerId,
  sourceCard?: CardInstance,
): string[] {
  // Player targets
  if (targetId === 'player' || targetId === 'opponent') {
    return validatePlayerTarget(targetId, requirement, controller);
  }

  // Stack targets
  if (requirement.zone === 'stack') {
    return validateStackTarget(state, targetId, requirement);
  }

  // Card targets
  return validateCardTarget(state, targetId, requirement, controller, sourceCard);
}

// ... helper functions for validatePlayerTarget, validateStackTarget, validateCardTarget
```

---

### 4. `generation/` Module (150 lines total)

#### `generation/combinations.ts` (70 lines)

**Responsibility**: Generate target combinations

```typescript
/**
 * Generate all valid target combinations for a set of requirements
 */
export function getAllLegalTargetCombinations(
  state: GameState,
  requirements: TargetRequirement[],
  controller: PlayerId,
  sourceCard?: CardInstance,
): string[][] {
  if (requirements.length === 0) {
    return [[]];
  }

  // Get legal targets for each requirement
  const targetsPerRequirement: string[][] = requirements.map((req) =>
    getLegalTargets(state, req, controller, sourceCard),
  );

  // Check if any required target has no valid options
  for (let i = 0; i < requirements.length; i++) {
    if (!requirements[i]!.optional && targetsPerRequirement[i]!.length === 0) {
      return [];
    }
  }

  // Generate combinations
  if (requirements.length === 1) {
    return targetsPerRequirement[0]!.map((t) => [t]);
  }

  if (requirements.length === 2) {
    const combinations: string[][] = [];
    for (const t1 of targetsPerRequirement[0]!) {
      for (const t2 of targetsPerRequirement[1]!) {
        if (t1 !== t2) {
          combinations.push([t1, t2]);
        }
      }
    }
    return combinations;
  }

  return generateCombinations(targetsPerRequirement, 0, []);
}

function generateCombinations(
  targetsPerReq: string[][],
  index: number,
  current: string[],
): string[][] {
  if (index >= targetsPerReq.length) {
    return [current];
  }

  const combinations: string[][] = [];
  for (const target of targetsPerReq[index]!) {
    if (!current.includes(target)) {
      combinations.push(...generateCombinations(targetsPerReq, index + 1, [...current, target]));
    }
  }

  return combinations;
}
```

#### `generation/index.ts` (80 lines)

**Responsibility**: Legal target generation

```typescript
/**
 * Get all legal targets for a requirement
 */
export function getLegalTargets(
  state: GameState,
  requirement: TargetRequirement,
  controller: PlayerId,
  sourceCard?: CardInstance,
): string[] {
  const validTargets: string[] = [];

  // Player targets
  if (
    requirement.targetType === 'any' ||
    requirement.targetType === 'player' ||
    requirement.targetType === 'opponent'
  ) {
    validTargets.push(...getPlayerTargets(requirement, controller));
  }

  // Stack targets
  if (
    requirement.zone === 'stack' ||
    requirement.targetType === 'spell' ||
    requirement.targetType === 'creature_spell'
  ) {
    validTargets.push(...getStackTargets(state, requirement, sourceCard));
  }

  // Battlefield targets
  if (requirement.zone === 'battlefield' || requirement.zone === 'any') {
    validTargets.push(...getBattlefieldTargets(state, requirement, controller, sourceCard));
  }

  // Graveyard targets
  if (requirement.zone === 'graveyard') {
    validTargets.push(...getGraveyardTargets(state, requirement, controller, sourceCard));
  }

  return validTargets;
}
```

---

### 5. `resolution/` Module (80 lines)

#### `resolution/index.ts` (80 lines)

**Responsibility**: Fizzle checks & resolution-time validation

```typescript
/**
 * Check if targets are still legal when a spell/ability resolves
 */
export function checkTargetsStillLegal(
  state: GameState,
  targets: string[],
  requirements: TargetRequirement[],
  controller: PlayerId,
  sourceCard?: CardInstance,
): { allIllegal: boolean; legalTargets: string[]; illegalTargets: string[] } {
  const legalTargets: string[] = [];
  const illegalTargets: string[] = [];

  let targetIndex = 0;
  for (const req of requirements) {
    for (let i = 0; i < req.count && targetIndex < targets.length; i++) {
      const targetId = targets[targetIndex]!;
      const errors = validateSingleTarget(state, targetId, req, controller, sourceCard);

      if (errors.length === 0) {
        legalTargets.push(targetId);
      } else {
        illegalTargets.push(targetId);
      }
      targetIndex++;
    }
  }

  return {
    allIllegal: legalTargets.length === 0 && targets.length > 0,
    legalTargets,
    illegalTargets,
  };
}

/**
 * Check if a spell should fizzle (all targets illegal)
 */
export function shouldSpellFizzle(
  state: GameState,
  targets: string[],
  requirements: TargetRequirement[],
  controller: PlayerId,
  sourceCard?: CardInstance,
): boolean {
  if (targets.length === 0 || requirements.length === 0) {
    return false;
  }

  const { allIllegal } = checkTargetsStillLegal(
    state,
    targets,
    requirements,
    controller,
    sourceCard,
  );

  return allIllegal;
}
```

---

### 6. `index.ts` (Barrel Exports) (30 lines)

**Responsibility**: Public API

```typescript
// Re-export everything from the public API
export * from './types';
export * from './parser';
export * from './validation';
export * from './generation';
export * from './resolution';

// Maintain backward compatibility with specific exports
export {
  parseTargetRequirements,
  requiresTargets,
  getRequiredTargetCount,
  getMaxTargetCount,
} from './parser';

export { validateTargets, validateSingleTarget } from './validation';

export {
  hasHexproof,
  hasShroud,
  hasProtectionFrom,
  hasProtectionFromAllColors,
  getSourceColors,
} from './validation/protection';

export { getLegalTargets, getAllLegalTargetCombinations } from './generation';

export { checkTargetsStillLegal, shouldSpellFizzle } from './resolution';
```

## Migration Plan

### Phase 1: Create Structure & Move Types (30 min)

1. Create new folder structure
2. Create `types.ts` with all type definitions
3. Create `index.ts` with barrel exports
4. Run tests - should still pass (types haven't moved yet)

### Phase 2: Extract Protection Logic (20 min)

1. Create `validation/protection.ts`
2. Move hexproof/shroud/protection functions
3. Update barrel exports
4. Run tests - should still pass

### Phase 3: Refactor Parser (60 min)

1. Create `parser/patterns.ts` with pattern registry
2. Create `parser/index.ts` with new parseTargetRequirements
3. Migrate all existing patterns to registry
4. Run tests - fix any breaking tests
5. Add new test cases for pattern priority

### Phase 4: Split Validators (45 min)

1. Create `validation/validators.ts` with individual validators
2. Create `validation/index.ts` with main validation logic
3. Refactor validateSingleTarget to use validator registry
4. Run tests - update as needed

### Phase 5: Extract Generation (30 min)

1. Create `generation/combinations.ts`
2. Create `generation/index.ts`
3. Move legal target generation logic
4. Run tests - should pass

### Phase 6: Extract Resolution (20 min)

1. Create `resolution/index.ts`
2. Move fizzle checking logic
3. Run tests - should pass

### Phase 7: Update Imports & Cleanup (30 min)

1. Update all imports across codebase:
   - `getLegalActions.ts`
   - `validators.ts`
   - `stack.ts`
   - `activatedAbilities.ts`
   - Ability templates
   - Tests
2. Delete old `targeting.ts` file
3. Run full test suite
4. Fix any remaining issues

**Total Estimated Time**: ~3.5 hours

## Breaking Changes

### Import Paths

```typescript
// OLD
import { parseTargetRequirements } from '../rules/targeting';

// NEW (same, via barrel export)
import { parseTargetRequirements } from '../rules/targeting';

// OR (direct import)
import { parseTargetRequirements } from '../rules/targeting/parser';
```

### No API Changes

All existing functions maintain the same signatures. The refactor is internal only.

## Adding New Targeting Patterns

### Before (edit 732-line file)

```typescript
// Find the right place in 30+ if-else branches
// Edit targeting.ts line ~180
else if (/target tapped creature/.test(text)) {
  requirements.push({
    id: `target_${requirementIndex++}`,
    count: 1,
    targetType: 'creature',
    zone: 'battlefield',
    restrictions: [{ type: 'tapped' }],
    optional: false,
    description: 'target tapped creature',
  });
}
```

### After (add to pattern registry)

```typescript
// Edit parser/patterns.ts, add one entry to array
{
  regex: /target tapped creature/,
  priority: 82,
  handler: (match, idx) => ({
    id: `target_${idx}`,
    count: 1,
    targetType: 'creature',
    zone: 'battlefield',
    restrictions: [{ type: 'tapped' }],
    optional: false,
    description: 'target tapped creature',
  }),
},
```

**Benefits**:

- ✅ No need to find the "right spot" in a long if-else chain
- ✅ Priority system handles specificity automatically
- ✅ Can add patterns without touching core logic
- ✅ Easy to see all patterns at once
- ✅ Easy to test individual patterns

## Adding New Restrictions

### Before (edit validateRestriction function)

```typescript
// Find function at line ~600, add new case
function validateRestriction(...) {
  switch (restriction.type) {
    // ... 8 existing cases ...
    case 'keyword':  // NEW
      if (!hasKeyword(template, restriction.keyword)) {
        return `Target must have ${restriction.keyword}`;
      }
      return null;
  }
}
```

### After (add to validator registry)

```typescript
// Edit validation/validators.ts, add one function
export function validateKeywordRestriction(
  state: GameState,
  card: CardInstance,
  template: CardTemplate,
  restriction: TargetRestriction,
  controller: PlayerId,
): string | null {
  if (restriction.type !== 'keyword') return null;

  if (!hasKeyword(template, restriction.keyword)) {
    return `Target must have ${restriction.keyword}`;
  }

  return null;
}

// Add to registry
export const RESTRICTION_VALIDATORS = {
  // ... existing validators ...
  keyword: validateKeywordRestriction,
};
```

**Benefits**:

- ✅ Validators are isolated and testable
- ✅ No giant switch statement
- ✅ Clear what each validator does
- ✅ Easy to add without touching other validators

## Testing Strategy

### Unit Tests (by module)

```typescript
// tests/targeting/parser.test.ts
describe('parseTargetRequirements', () => {
  it('parses "target creature"', () => { ... });
  it('parses "target nonblack creature"', () => { ... });
  it('prioritizes more specific patterns', () => { ... });
});

// tests/targeting/validation.test.ts
describe('validateColorRestriction', () => { ... });
describe('validateCombatRestriction', () => { ... });
describe('hasProtectionFrom', () => { ... });

// tests/targeting/generation.test.ts
describe('getLegalTargets', () => { ... });
describe('getAllLegalTargetCombinations', () => { ... });

// tests/targeting/resolution.test.ts
describe('shouldSpellFizzle', () => { ... });
```

### Integration Tests

Existing tests in `tests/targeting.test.ts` should still pass with minimal changes (just update imports if needed).

## Success Metrics

- ✅ All existing tests pass
- ✅ No new targeting bugs introduced
- ✅ Modules are <200 lines each
- ✅ Pattern registry has clear priority ordering
- ✅ Adding new patterns takes <5 minutes
- ✅ Code is easier to understand and maintain
- ✅ Test coverage maintained or improved

## File Size Comparison

### Before

```
targeting.ts: 732 lines
```

### After

```
targeting/
  index.ts: 30 lines
  types.ts: 60 lines
  parser/
    index.ts: 70 lines
    patterns.ts: 180 lines
  validation/
    index.ts: 50 lines
    validators.ts: 100 lines
    protection.ts: 100 lines
  generation/
    index.ts: 80 lines
    combinations.ts: 70 lines
  resolution/
    index.ts: 80 lines

Total: 820 lines (88 lines added for structure/clarity)
Largest file: patterns.ts at 180 lines (vs 732 before)
```

## Future Enhancements

With this modular structure, we can easily add:

1. **Multi-target parsing** - Handle "up to two target creatures"
2. **Complex restrictions** - "target creature you don't control"
3. **Graveyard targeting** - "target creature card in a graveyard"
4. **Modal targets** - Spells with multiple modes with different targets
5. **X-spells** - "target up to X creatures"
6. **Exile targeting** - "target card in exile"
7. **Library targeting** - For few cards that target in library
8. **Planeswalker targeting** - When planeswalkers are added

## Conclusion

This refactor transforms the targeting system from a monolithic, hard-to-extend file into a modular, pattern-based architecture that:

- **Scales** as more cards are added
- **Simplifies** adding new targeting patterns
- **Improves** code clarity and maintainability
- **Enables** better testing
- **Maintains** backward compatibility

The pattern registry approach (proven successful in stack and ability refactors) makes it trivial to add new targeting patterns without touching core logic.
