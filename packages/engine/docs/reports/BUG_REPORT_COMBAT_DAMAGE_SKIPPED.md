# Bug Report: Combat Damage Skipped via END_TURN

**Date**: January 5, 2026
**Severity**: Critical
**Status**: Fixed
**Impact**: GreedyBot win rate improved from 22.0% to 90.0%

## Summary

Users reported an issue where "Life kept getting reset to 18 after each round". Investigation revealed that this was not a life reset, but rather **combat damage being skipped entirely**.

The root cause was that the `END_TURN` action was legally available to players during the Combat Phase. The AI agents (specifically GreedyBot) were sometimes choosing to `END_TURN` during the `declare_blockers` step, which triggered an immediate turn end (`applyEndTurn`), bypassing the `combat_damage` step.

## Bug Details

### Location
`packages/engine/src/actions/getLegalActions.ts`

### Root Cause
The `getLegalActions` function allowed `END_TURN` whenever the active player had priority, regardless of the current phase.

```typescript
// BUGGY CODE
if (state.activePlayer === playerId && state.priorityPlayer === playerId) {
  actions.push({
    type: 'END_TURN',
    // ...
  });
}
```

This allowed the active player to choose `END_TURN` during `combat/declare_blockers` after the defender passed priority. The reducer handles `END_TURN` by immediately clearing the state and advancing to the next turn's beginning phase, effectively skipping the pending combat damage.

### Symptom
- Opponent life would drop in simulation (evaluations showed damage happening).
- In actual execution, opponent life would remain static (e.g., stuck at 18) despite unblocked attackers.
- Games would frequently end in Draws (62% rate) due to inability to deal lethal damage.

## The Fix

### Solution
Restricted `END_TURN` to only be available during Main Phases (`main1`, `main2`) and only when the stack is empty.

```typescript
// FIXED CODE
if (state.activePlayer === playerId && state.priorityPlayer === playerId) {
  // Restricted to Main Phases with empty stack to prevent skipping phases like combat
  if ((state.phase === 'main1' || state.phase === 'main2') && state.stack.length === 0) {
    actions.push({
      type: 'END_TURN',
      // ...
    });
  }
}
```

### Verification
- **Detailed Game Trace**: Confirmed life totals now decrease correctly (e.g., 20 -> 18 -> 16 -> 11 -> ... -> -4).
- **Matchup Statistics**:
  - Before: 22% Win / 62% Draw
  - After: 90% Win / 4% Draw

## Related Issues
- `BUG_REPORT_LANDS_DYING_IN_COMBAT.md`: This bug was often masked or confused with the lands dying bug, as both caused game stalls. Now both are fixed.
