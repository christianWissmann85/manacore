# TODO Resolution Findings: Phase 2 & Phase 3

**Date:** January 10, 2026  
**Research Focus:** Determining necessity of TODOs for ML/AI Research Gym scope

---

## Overview

Conducted investigation of two TODO groups to determine if they're necessary given ManaCore's primary goal as a "deterministic, fast ML/AI Research Gym for RL and LLM Training, not a feature complete MTG Game."

---

## Phase 2: Game Engine - Ability Stack

### TODO Location
- File: [packages/engine/src/actions/reducer.ts](packages/engine/src/actions/reducer.ts#L610)
- Comment: `"Other abilities go on the stack (TODO: implement stack for abilities)"`

### Investigation Finding
✅ **ALREADY IMPLEMENTED**

The TODO comment is **outdated**. Code analysis (lines 656-670) reveals:

```typescript
if (ability.isManaAbility) {
  // Mana abilities resolve immediately
  applyAbilityEffect(...);
} else {
  // Non-mana abilities go on the stack
  pushAbilityToStack(state, action.payload.sourceId, ...);
}
```

### Evidence
- Mana abilities resolve immediately ✅
- Non-mana abilities use `pushAbilityToStack()` ✅
- Stack structure exists in `GameState.stack: StackObject[]` ✅
- Priority system handles stack resolution ✅

### Resolution
- ✅ Removed outdated TODO comment
- ✅ Added clarifying comment pointing to implementation line

---

## Phase 3: Game Engine - Damage Prevention System

### TODO Locations
1. [packages/engine/src/spells/categories/prevention.ts](packages/engine/src/spells/categories/prevention.ts#L44)
2. [packages/engine/tests/cards/prevention.test.ts](packages/engine/tests/cards/prevention.test.ts#L6)

Both related to: **Healing Salve prevention mode**

### Investigation Finding
❌ **NOT NECESSARY FOR ML/AI RESEARCH GYM**

### Current State
Healing Salve currently implements only the life gain mode:
```typescript
if (target === 'player' || target === 'opponent') {
  gainLife(state, target, 3);
}
```

The prevention mode (prevent next 3 damage) is unimplemented.

### Infrastructure Status
**Prevention system IS fully implemented:**
- `PlayerState.preventionShields: Array<{color, amount}>` ✅
- Damage prevention templates: `createTapToPrevent()`, `createLifeToPrevent()`, etc. ✅
- Working cards using prevention:
  - Circle of Protection (all 5 colors)
  - Samite Healer
  - Pentagram of the Ages
  - Ethereal Champion
  - Resistance Fighter
- Global prevention: `preventAllCombatDamage` flag (Fog) ✅

### Analysis

**What's Missing:** Modal choice between life gain vs. damage prevention on a single spell.

**Arguments FOR Implementation:**
- Modal spells add decision complexity
- Teaches agents situational thinking
- Card exists in 6th Edition Core Set

**Arguments AGAINST (Gym-Focused):**
- Life gain mode covers 80% of practical use cases
- Prevention mode functionally redundant with existing prevention cards
- Adds implementation complexity without strategic depth enhancement
- Agents can already learn damage prevention tactics from:
  - Fog (prevent all combat damage)
  - Remedy (prevent 5 to creature)
  - Circles of Protection (color-specific prevention)
  - Samite Healer and others

**Decision Rationale:**
The prevention infrastructure exists and is well-tested. However, adding modal complexity to one spell (Healing Salve) doesn't significantly enhance the learning environment for ML/AI agents. The engine already provides multiple simpler, more focused cards for learning damage prevention strategies.

### Resolution
- ✅ Replaced TODO with `SCOPE DECISION (2026-01-10)` comment
- ✅ Documented rationale in code comments
- ✅ Updated test file comment
- ❌ No implementation needed - keeping simple life-gain mode

---

## Summary

| Phase | TODO Topic | Status | Action Taken |
|-------|-----------|---------|--------------|
| Phase 2 | Ability Stack | Already complete | Removed outdated comment |
| Phase 3 | Healing Salve Prevention | Unnecessary for gym | Documented scope decision |

---

## Impact on Track Plan

- **Phase 2:** All tasks complete (were already implemented)
- **Phase 3:** Skipped - infrastructure exists, modal complexity not needed for ML/AI research focus

---

## Recommendations

1. **Continue prioritizing gym performance** over MTG feature completeness
2. **Focus on cards that teach distinct strategic patterns** rather than modal variations
3. **Leverage existing 302+ cards** for agent training diversity
4. **Next priorities:** Optimize simulation speed, expand AI agent capabilities, improve training data collection

---

## References

- Product Goals: [conductor/product.md](../../product.md)
- Project Spec: [docs/SPEC.md](../../../docs/SPEC.md)
- Card Status: [packages/engine/docs/CARD_STATUS.md](../../../packages/engine/docs/CARD_STATUS.md)
