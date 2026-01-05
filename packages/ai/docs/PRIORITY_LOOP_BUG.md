# Priority Loop Bug - Investigation Summary

**Date**: January 5, 2026  
**Status**: 🟢 Fixed  
**Impact**: Games randomly hang with infinite priority passing

---

## Resolution

**Fixed on**: January 5, 2026

The infinite loop was caused by missing logic in `packages/engine/src/actions/reducer.ts` within the `advancePhase` function. When both players passed priority on an empty stack in Main Phase 1 or Main Phase 2, the game failed to transition to the next phase/step (Combat or End Turn), instead just resetting priority to the active player.

**Fix Details:**

- Modified `advancePhase` in `reducer.ts`:
  - **Main 1**: Now correctly transitions to `combat` phase, `declare_attackers` step.
  - **Main 2**: Now automatically applies `END_TURN` logic to proceed to the next turn.
- Added regression test `packages/engine/tests/phase-transitions.test.ts`.

---

## Problem

Benchmark simulations randomly hang after ~2 minutes with no visible progress or error messages. Games get stuck processing thousands of actions on a single turn.

## Investigation

### What We Added

Added `--debug-verbose` (`-dv`) CLI flag to provide detailed real-time feedback during simulations:

```bash
bun src/index.ts benchmark 3 --debug-verbose
```

**New Logging Features:**

- 📋 Game start info (deck colors, seed)
- 🔄 Turn-by-turn progression with phase/step
- ⚡ Action count updates every 50 actions
- ⚠️ Warning every 100 actions on same turn (with action description and priority flow)
- 🔴 Infinite loop detection at 500+ actions (with stack state, priority, active player, legal actions)
- ✅ Game completion summary

### Files Modified

- `/home/chris/manacore/packages/cli-client/src/index.ts` - Added flag parsing
- `/home/chris/manacore/packages/cli-client/src/commands/simulate.ts` - Enhanced logging

---

## Root Cause Identified

### The Bug

**Infinite priority passing loop in main phase 2**

```
⚠️  Turn 19: 500 actions! Last: Pass priority [main2/main] player→opponent
🔴 POTENTIAL INFINITE LOOP DETECTED!
      Stack: 0 items
      Priority: player
      Active: player
      Legal actions: 1
```

### Key Observations

1. **Location**: Occurs randomly around turn 15-20
2. **Phase**: Stuck in `main2/main` (main phase 2, main step)
3. **Pattern**: Priority bounces `player→opponent→player→opponent` infinitely
4. **State**:
   - Stack is **empty** (0 items)
   - Only **1 legal action** available (PASS_PRIORITY)
   - Priority player = Active player
5. **Expected Behavior**: When both players pass priority with empty stack, should advance to next phase
6. **Actual Behavior**: Loops forever passing priority back and forth

---

## Action Plan

### 1. Examine Priority Passing Logic

**Files to investigate:**

- `packages/engine/src/rules/stack.ts` - Priority system implementation
- `packages/engine/src/actions/reducer.ts` - Action application logic
- `packages/engine/src/actions/getLegalActions.ts` - Legal action generation

**What to look for:**

- How does PASS_PRIORITY action work?
- What triggers phase advancement?
- Is there a "both players passed" flag/counter?
- When stack is empty + both passed → should advance phase

### 2. Reproduce the Bug Reliably

**Known working seed that triggers bug:**

```bash
cd packages/cli-client
bun src/index.ts benchmark 5 --debug-verbose
# Watch for turn ~15-20 getting stuck
```

The bug appears to be intermittent based on deck combinations and game state.

### 3. Likely Fix Location

**Hypothesis**: The priority passing mechanism doesn't track consecutive passes correctly.

**Check for missing logic:**

```typescript
// Pseudocode of what might be missing:
if (action.type === 'PASS_PRIORITY') {
  if (state.stack.length === 0) {
    if (/* both players have passed in succession */) {
      // ADVANCE TO NEXT PHASE ← This might be missing!
    }
  }
}
```

### 4. Write a Test Case

Create a failing test that reproduces the priority loop:

```typescript
// packages/engine/tests/priority-loop.test.ts
test('both players passing priority with empty stack should advance phase', () => {
  let state = /* setup game in main2 phase */;

  // Player passes
  state = applyAction(state, { type: 'PASS_PRIORITY', ... });

  // Opponent passes
  state = applyAction(state, { type: 'PASS_PRIORITY', ... });

  // Should advance to ending phase, not loop back
  expect(state.phase).not.toBe('main2');
  expect(state.phase).toBe('ending'); // or next phase
});
```

### 5. Emergency Workaround (Temporary)

Add action count limit to prevent infinite loops:

```typescript
// In simulate.ts runSingleGame()
const MAX_ACTIONS_PER_TURN = 1000;
let actionsThisTurn = 0;

while (!state.gameOver && turnCount < maxTurns) {
  // ... existing code ...

  if (state.turnCount > turnCount) {
    actionsThisTurn = 0;
  } else {
    actionsThisTurn++;
    if (actionsThisTurn > MAX_ACTIONS_PER_TURN) {
      console.error(`⚠️  Turn ${state.turnCount} exceeded action limit - forcing draw`);
      break;
    }
  }
}
```

---

## Debugging Commands

**Run with verbose logging:**

```bash
cd /home/chris/manacore/packages/cli-client
bun src/index.ts benchmark 3 --debug-verbose
```

**Capture full output for analysis:**

```bash
timeout 30 bun src/index.ts benchmark 5 --debug-verbose 2>&1 | tee bug_output.log
```

**Search for problem patterns:**

```bash
grep "🔴" bug_output.log  # Find infinite loop occurrences
grep "⚠️.*[0-9]{3,}" bug_output.log  # Find high action counts
```

---

## Next Steps

1. ✅ **Reproduced and identified** - Bug confirmed with detailed logs
2. 🔲 **Examine stack.ts** - Review priority passing implementation
3. 🔲 **Write failing test** - Create test case for the bug
4. 🔲 **Fix the logic** - Implement proper phase advancement
5. 🔲 **Verify fix** - Run benchmark 100+ games without hangs
6. 🔲 **Add safeguard** - Consider max actions per turn limit as safety

---

## Technical Details

### Priority System Rules (Magic: The Gathering)

1. Active player gets priority first in each phase
2. When a player has priority, they can cast spells/activate abilities or pass
3. When a player passes with non-empty stack → other player gets priority
4. When BOTH players pass with EMPTY stack → phase advances
5. The bug: Step 4 is not working correctly

### Expected Flow in Main Phase 2

```
main2 begins → active player priority
  → player passes → opponent priority
  → opponent passes → stack empty + both passed
  → SHOULD advance to ending phase
  → ACTUALLY loops back to player priority ❌
```

---

## References

- Debug flag: `--debug-verbose` or `-dv`
- Bug output sample: `/tmp/debug_output.txt`
- Modified files:
  - `packages/cli-client/src/index.ts`
  - `packages/cli-client/src/commands/simulate.ts`
