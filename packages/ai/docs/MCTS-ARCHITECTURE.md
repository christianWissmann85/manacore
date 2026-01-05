# Monte Carlo Tree Search for ManaCore

**Version:** 1.0
**Status:** Design Document
**Phase:** 2 (Hidden Information & Smart AI)

---

## Overview

This document outlines the MCTS implementation for ManaCore, a Magic: The Gathering AI research platform. MCTS is well-suited for MTG because:

1. **Large branching factor** - Hundreds of legal actions per turn
2. **Hidden information** - Opponent's hand is unknown
3. **Stochastic elements** - Card draw randomness
4. **No reliable heuristic** - Board evaluation is complex

---

## Algorithm: UCT (Upper Confidence Bounds for Trees)

### Core Loop

```
function MCTS(rootState, iterations):
    root = createNode(rootState)

    for i in 1..iterations:
        node = root
        state = clone(rootState)

        // 1. SELECTION
        while node is fully expanded AND not terminal:
            node = selectChild(node)  // UCB1
            state = applyAction(state, node.action)

        // 2. EXPANSION
        if node is not terminal:
            action = unexploredAction(node)
            state = applyAction(state, action)
            node = addChild(node, action)

        // 3. SIMULATION (Rollout)
        while not terminal(state):
            action = rolloutPolicy(state)  // Random or Greedy
            state = applyAction(state, action)

        // 4. BACKPROPAGATION
        reward = evaluate(state)  // 1.0 win, 0.0 loss, 0.5 draw
        while node is not null:
            node.visits += 1
            node.totalReward += reward
            node = node.parent

    return bestChild(root).action  // Most visited
```

### UCB1 Selection Formula

```
UCB1(node) = (wins / visits) + C * sqrt(ln(parent.visits) / visits)

where:
  - wins/visits = exploitation (prefer known good moves)
  - C = exploration constant (typically sqrt(2) ≈ 1.41)
  - sqrt(...) = exploration (prefer less-visited nodes)
```

---

## Handling Hidden Information: Determinization

MTG has hidden information (opponent's hand). We use **Information Set MCTS (ISMCTS)** via determinization:

### Approach: Multiple Determinizations

```
function MCTSWithDeterminization(state, iterations, samples):
    aggregatedScores = {}

    for s in 1..samples:
        // Create a "possible world" by guessing opponent's hand
        deterministicState = determinize(state)

        // Run standard MCTS on this world
        scores = MCTS(deterministicState, iterations / samples)

        // Aggregate action scores across all worlds
        for action, score in scores:
            aggregatedScores[action] += score

    return argmax(aggregatedScores)
```

### Determinization Strategy

```
function determinize(state):
    state = clone(state)

    // Known: cards we've seen (graveyard, our hand, battlefield)
    // Unknown: opponent's hand, both libraries

    // Shuffle unknown cards and redistribute
    unknownCards = opponent.hand + opponent.library
    shuffle(unknownCards)

    opponent.hand = unknownCards[0..handSize]
    opponent.library = unknownCards[handSize..]

    return state
```

---

## Node Structure

```typescript
interface MCTSNode {
  state: GameState; // Game state at this node
  action: Action | null; // Action that led here (null for root)
  parent: MCTSNode | null;
  children: MCTSNode[];

  visits: number; // N(v) - visit count
  totalReward: number; // Q(v) - cumulative reward

  untriedActions: Action[]; // Actions not yet expanded
}
```

---

## Rollout Policies

### 1. Random Rollout (Baseline)

```
function randomRollout(state):
    while not terminal(state):
        actions = getLegalActions(state)
        action = randomChoice(actions)
        state = applyAction(state, action)
    return winner(state)
```

### 2. Greedy Rollout (Recommended)

```
function greedyRollout(state):
    while not terminal(state):
        actions = getLegalActions(state)
        bestAction = argmax(a => evaluate(applyAction(state, a)))
        state = applyAction(state, bestAction)
    return winner(state)
```

### 3. Epsilon-Greedy Rollout

```
function epsilonGreedyRollout(state, epsilon=0.1):
    while not terminal(state):
        if random() < epsilon:
            action = randomChoice(getLegalActions(state))
        else:
            action = greedyChoice(state)
        state = applyAction(state, action)
    return winner(state)
```

---

## Evaluation Function

Terminal states return: `1.0` (win), `0.0` (loss), `0.5` (draw)

For early termination or leaf evaluation:

```
evaluate(state, playerId):
    me = getPlayer(state, playerId)
    opp = getOpponent(state, playerId)

    // Life differential (normalized)
    lifeDiff = (me.life - opp.life) / 40.0

    // Board presence (creature power on battlefield)
    myPower = sum(creature.power for creature in me.battlefield)
    oppPower = sum(creature.power for creature in opp.battlefield)
    boardDiff = (myPower - oppPower) / 20.0

    // Card advantage
    cardDiff = (me.hand.length - opp.hand.length) / 7.0

    // Weighted combination
    score = 0.4 * lifeDiff + 0.4 * boardDiff + 0.2 * cardDiff

    // Normalize to [0, 1]
    return 0.5 + 0.5 * clamp(score, -1, 1)
```

---

## Performance Optimizations

### 1. State Cloning

- Use `structuredClone()` for correctness
- Consider incremental state for hot paths

### 2. Action Caching

```
// Cache legal actions at each node
node.legalActions = getLegalActions(node.state)
```

### 3. Transposition Table

```
// Hash states to detect transpositions
stateHash = hash(state)
if transpositionTable.has(stateHash):
    return transpositionTable.get(stateHash)
```

### 4. Parallel Search

```
// Run multiple MCTS trees in parallel (web workers)
// Aggregate results via root parallelization
```

---

## Configuration Parameters

| Parameter             | Default | Description             |
| --------------------- | ------- | ----------------------- |
| `iterations`          | 1000    | Total MCTS iterations   |
| `explorationConstant` | 1.41    | UCB1 C value            |
| `determinizations`    | 5       | Number of world samples |
| `rolloutDepth`        | 50      | Max moves per rollout   |
| `timeLimit`           | 5000ms  | Max thinking time       |

---

## Success Criteria

1. **Performance:** 1000 iterations in <5 seconds
2. **Strength:** Beat RandomBot 90%+ of games
3. **Scalability:** Beat GreedyBot 60%+ of games

---

## Implementation Phases

### Phase 2.1: Basic MCTS

- Single determinization
- Random rollout
- No optimizations
- Target: Beat RandomBot 80%+

### Phase 2.2: ISMCTS

- Multiple determinizations
- Greedy rollout
- Target: Beat RandomBot 90%+

### Phase 2.3: Optimized MCTS

- Transposition tables
- Action caching
- Parallel search
- Target: Beat GreedyBot 70%+

---

## References

1. Browne et al. "A Survey of Monte Carlo Tree Search Methods" (2012)
2. Cowling et al. "Information Set Monte Carlo Tree Search" (2012)
3. Silver et al. "Mastering Chess and Shogi by Self-Play" (AlphaZero, 2017)

---

**Next Steps:** Implement GreedyBot as the baseline before building MCTS.
