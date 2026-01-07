# Testing Guide

## Overview

ManaCore has a comprehensive test suite covering the game engine, AI bots, and CLI client. Tests are organized into **fast unit tests** and **slow integration tests**.

## Running Tests

### Quick Development Testing (Recommended)

```bash
bun test
```

By default, this runs the **fast test suite** which completes in ~13 seconds. Slow integration tests are skipped automatically.

### All Tests (CI/Full Validation)

To run ALL tests including slow integration tests, temporarily unskip them:

```bash
# Edit the test files and remove .skip from test definitions
# Or run specific slow tests individually
```

### Package-Specific Tests

```bash
bun test:engine    # Engine tests only
bun test:ai        # AI tests only
```

### Quiet Mode

```bash
bun test:quiet     # Minimal output
```

## Test Categories

### Fast Tests (Default - Skipped: NO)

- **Unit tests**: Core logic, data structures, algorithms
- **Quick integration**: Simple bot decisions, single actions
- **Validation**: Config parsing, weight loading, feature extraction
- **Time**: ~13 seconds total

### Slow Tests (Default - Skipped: YES)

These are marked with `test.skip()` for faster development cycles:

1. **MCTSTuner > evaluateConfig** (~1.3s)
   - Runs actual game simulations for hyperparameter evaluation
   - Location: `packages/ai/tests/MCTSTuner.test.ts`

2. **Bot Robustness Tests** (~150ms combined)
   - GreedyBot robustness: 50 game iterations
   - RandomBot robustness: 50 game iterations
   - Location: `packages/ai/tests/bot-robustness.test.ts`

3. **Engine Stress Tests** (variable)
   - Runs 5 full games with random choices
   - Location: `packages/engine/tests/stress.test.ts`

4. **MCTS Integration Tests** (~5s each)
   - Full MCTS search decision-making
   - Location: `packages/cli-client/tests/botFactory.test.ts`

5. **MCTSTuner > integration** (very slow)
   - Full grid search over hyperparameters
   - Location: `packages/ai/tests/MCTSTuner.test.ts`

## Skipped Tests Summary

Current test run shows:

```
6 tests skipped:
(skip) MCTSTuner > evaluateConfig > evaluates a single configuration
(skip) MCTSTuner > integration > runs quick grid search
(skip) Bot Robustness > GreedyBot never crashes on random states
(skip) Bot Robustness > RandomBot never crashes
(skip) Engine Stress Tests > Chaos Mode: Run 5 full games with Random choices
(skip) Integration - bots can play > MCTS fast bot can make a decision in reasonable time
```

## Unskipping Tests

To run slow tests locally or in CI:

1. **Individual test**: Change `test.skip('name', ...)` to `test('name', ...)`
2. **Entire suite**: Remove all `.skip` modifiers from the test file
3. **One-off run**: Edit, run, then revert changes

## CI Recommendations

For CI pipelines:

- **PR validation**: Run fast tests only (13s)
- **Merge to main**: Run all tests including slow ones
- **Nightly builds**: Full test suite + stress tests

## Test Performance

Before optimization: **28 seconds**  
After skipping slow tests: **13 seconds** (53% faster)

## Writing New Tests

**Guidelines:**

- Keep unit tests fast (< 50ms each)
- Mark integration tests that simulate games with `.skip`
- Use `test.skip()` for any test taking > 100ms
- Add comments explaining why a test is skipped

**Example:**

```typescript
// Skip: This test runs actual MCTS search and takes ~1.3s
test.skip('evaluates MCTS configuration', () => {
  // ... test code
});
```
