# Dragon Engine Infinite Loop Fix

**Date**: 2026-01-06  
**Issue**: MCTSBot was causing infinite loops with pump abilities like Dragon Engine's `{2}: +1/+0 until end of turn`

## Root Cause

MCTSBot lacked anti-loop protection for repeated ability activations. During MCTS tree expansion and simulation, the bot could:

1. Expand the same pump ability activation multiple times in sequence
2. Repeatedly activate Dragon Engine's pump ability 50+ times in a priority window
3. Trigger the infinite loop detector in the game engine

This issue affected all cards with repeatable pump abilities:

- Dragon Engine (`{2}: +1/+0`)
- Frozen Shade (`{B}: +1/+1`)
- Shivan Dragon (`{R}: +1/+0`)
- Wall of Fire (`{R}: +1/+0`)
- Mesa Falcon (`{1}{W}: +0/+1`)
- Pearl Dragon (`{1}{W}: +0/+1`)

## Why Other Bots Weren't Affected

**GreedyBot** and **TunableBot** both implemented anti-loop logic:

- Track the last 10 actions taken
- Count repeated ability activations
- Apply exponential penalty: `score -= Math.pow(10, repeatCount + 1)`

**MCTSBot** had no such protection - it would happily expand pump ability nodes repeatedly, wasting tree exploration and triggering loops.

## The Fix

Added two layers of protection to [MCTS.ts](../src/search/MCTS.ts):

### 1. Action Filtering During Tree Expansion

New function `filterRepeatedAbilities()` prevents the same ability from being activated twice in a row:

```typescript
export function filterRepeatedAbilities(actions: Action[], parentAction: Action | null): Action[] {
  // If parent wasn't an ability activation, no filtering needed
  if (!parentAction || parentAction.type !== 'ACTIVATE_ABILITY') {
    return actions;
  }

  const parentAbilityId = parentAction.payload.abilityId;

  // Remove the same ability activation from available actions
  return actions.filter((action) => {
    if (action.type !== 'ACTIVATE_ABILITY') {
      return true; // Keep non-ability actions
    }
    // Filter out the same ability that was just activated
    return action.payload.abilityId !== parentAbilityId;
  });
}
```

Applied during node expansion:

```typescript
// Get legal actions for new child node
let childActions = getLegalActions(newState, newState.priorityPlayer);

// ANTI-LOOP FIX: Filter out repeated ability activations
childActions = filterRepeatedAbilities(childActions, action);
```

### 2. Penalty in Greedy Rollout Policy

Added a small penalty to ability activations during simulations:

```typescript
// ANTI-LOOP FIX: Penalize pump abilities (they cause infinite loops)
if (action.type === 'ACTIVATE_ABILITY') {
  score -= 5; // Small penalty to deprioritize ability spam
}
```

This makes the greedy rollout prefer casting spells or attacking over repeatedly pumping creatures.

## Verification

### Test Coverage

Added unit tests in [MCTS.test.ts](../tests/MCTS.test.ts):

- `filterRepeatedAbilities prevents same ability from being activated twice`
- `filterRepeatedAbilities keeps all actions when parent is not an ability`
- `filterRepeatedAbilities keeps all actions when parent is null`

All tests pass ✅

### Integration Testing

Ran the phase3.4 experiment with 500 games:

- **Before fix**: 2 infinite loop errors (games 26 and 389)
- **After fix**: 0 errors, all 500 games completed successfully

```bash
📊 Quick Summary
   MCTSBot-200-eval: 172 wins (34%) | MCTSBot-200-ordered: 56 wins (11%) | Draws: 272
   Avg game length: 91.0 turns (range: 3-100)
   Performance: 192.2s total | 2.6 games/sec
```

## Impact

### Positive

- ✅ Eliminates infinite loops with pump abilities
- ✅ Improves MCTS tree exploration efficiency (doesn't waste nodes on repeated pumps)
- ✅ More realistic gameplay (bot doesn't spam pump abilities irrationally)

### Minimal

- Slight performance impact from filtering actions (negligible - ~0.1ms per expansion)
- May slightly reduce win rate in edge cases where pumping multiple times is optimal

### Trade-offs

The fix prevents consecutive activations of the same ability. This means:

- ✅ **Good**: Can't spam Dragon Engine 50 times
- ⚠️ **Limitation**: In rare cases, activating the same ability 2-3 times might be optimal (e.g., pumping before blockers declared). However, this limitation is acceptable because:
  1. The old behavior was causing infinite loops
  2. The bot can still activate the ability once per priority window
  3. After other actions (passing priority, declaring blockers), the ability becomes available again

## Future Improvements

Consider adding more sophisticated loop detection:

- Track ability activation counts per turn
- Allow 2-3 activations before filtering
- Use heuristics based on available mana and board state

For now, the simple "no consecutive repeats" rule eliminates the infinite loop bug while maintaining reasonable gameplay.

## Related Files

- [packages/ai/src/search/MCTS.ts](../src/search/MCTS.ts) - Implementation
- [packages/ai/tests/MCTS.test.ts](../tests/MCTS.test.ts) - Tests
- [packages/engine/src/rules/abilities/sets/6ed/pumpers.ts](/home/chris/manacore/packages/engine/src/rules/abilities/sets/6ed/pumpers.ts) - Dragon Engine definition
