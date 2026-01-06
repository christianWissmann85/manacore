import {
  RandomBot,
  GreedyBot,
  MCTSBot,
  ISMCTSBot,
  greedyRolloutPolicy,
  epsilonGreedyRolloutPolicy,
  TranspositionTable,
  type Bot,
} from '@manacore/ai';

export type BotType =
  | 'random'
  | 'greedy'
  // Greedy rollout variants
  | 'mcts-greedy'
  | 'mcts-greedy-fast'
  | 'mcts-epsilon'
  // No-rollout variants (FASTEST - recommended)
  | 'mcts-eval'
  | 'mcts-eval-fast'
  | 'mcts-eval-strong'
  | 'mcts-eval-turbo'
  // Shallow greedy (best balance)
  | 'mcts-shallow'
  | 'mcts-shallow-fast'
  // Phase 3.4: Move ordering variants
  | 'mcts-ordered'
  | 'mcts-ordered-fast'
  | 'mcts-ordered-turbo'
  // Phase 3.1: ISMCTS variants
  | 'mcts-ismcts'
  | 'mcts-ismcts-fast'
  | 'mcts-ismcts-strong'
  // Phase 3.2: Transposition table variants
  | 'mcts-tt'
  | 'mcts-tt-fast'
  | 'mcts-tt-strong';

export function createBot(type: BotType, seed: number, debug = false): Bot {
  switch (type) {
    case 'greedy':
      return new GreedyBot(seed, debug);

    // Greedy rollout MCTS variants (higher quality simulations)
    case 'mcts-greedy':
      return new MCTSBot(
        { iterations: 100, rolloutDepth: 10, debug, nameSuffix: 'greedy' },
        greedyRolloutPolicy,
      );
    case 'mcts-greedy-fast':
      return new MCTSBot(
        { iterations: 25, rolloutDepth: 8, debug, nameSuffix: 'greedy-fast' },
        greedyRolloutPolicy,
      );

    // Epsilon-greedy rollout (10% random, 90% greedy)
    case 'mcts-epsilon':
      return new MCTSBot(
        { iterations: 100, rolloutDepth: 10, debug, nameSuffix: 'epsilon' },
        epsilonGreedyRolloutPolicy(0.1),
      );

    // NO ROLLOUT variants - evaluate expanded node directly (FASTEST)
    case 'mcts-eval':
      return new MCTSBot({
        iterations: 200,
        rolloutDepth: 0, // No rollout - just evaluate!
        debug,
        nameSuffix: 'eval',
      });
    case 'mcts-eval-fast':
      return new MCTSBot({
        iterations: 50,
        rolloutDepth: 0, // No rollout - just evaluate!
        debug,
        nameSuffix: 'eval-fast',
      });
    case 'mcts-eval-strong':
      return new MCTSBot({
        iterations: 500,
        rolloutDepth: 0, // No rollout - just evaluate!
        debug,
        nameSuffix: 'eval-strong',
      });
    case 'mcts-eval-turbo':
      return new MCTSBot({
        iterations: 1000,
        rolloutDepth: 0, // No rollout - max iterations!
        debug,
        nameSuffix: 'eval-turbo',
      });

    // SHALLOW GREEDY - best balance of speed + quality
    case 'mcts-shallow':
      return new MCTSBot(
        { iterations: 100, rolloutDepth: 3, debug, nameSuffix: 'shallow' },
        greedyRolloutPolicy,
      );
    case 'mcts-shallow-fast':
      return new MCTSBot(
        { iterations: 50, rolloutDepth: 2, debug, nameSuffix: 'shallow-fast' },
        greedyRolloutPolicy,
      );

    // PHASE 3.4: MOVE ORDERING - expand promising actions first
    case 'mcts-ordered':
      return new MCTSBot({
        iterations: 200,
        rolloutDepth: 0,
        moveOrdering: true, // Enable type-based action priority
        debug,
        nameSuffix: 'ordered',
      });
    case 'mcts-ordered-fast':
      return new MCTSBot({
        iterations: 50,
        rolloutDepth: 0,
        moveOrdering: true,
        debug,
        nameSuffix: 'ordered-fast',
      });
    case 'mcts-ordered-turbo':
      return new MCTSBot({
        iterations: 1000,
        rolloutDepth: 0,
        moveOrdering: true,
        debug,
        nameSuffix: 'ordered-turbo',
      });

    // PHASE 3.1: ISMCTS - multiple determinizations for hidden information
    case 'mcts-ismcts':
      return new ISMCTSBot({
        determinizations: 10,
        iterations: 500, // 10 x 50 iterations per determinization
        rolloutDepth: 0,
        moveOrdering: true,
        ismctsDebug: debug,
        nameSuffix: 'ismcts',
      });
    case 'mcts-ismcts-fast':
      return new ISMCTSBot({
        determinizations: 5,
        iterations: 100, // 5 x 20 iterations per determinization
        rolloutDepth: 0,
        moveOrdering: true,
        ismctsDebug: debug,
        nameSuffix: 'ismcts-fast',
      });
    case 'mcts-ismcts-strong':
      return new ISMCTSBot({
        determinizations: 10,
        iterations: 1000, // 10 x 100 iterations per determinization
        rolloutDepth: 0,
        moveOrdering: true,
        ismctsDebug: debug,
        nameSuffix: 'ismcts-strong',
      });

    // PHASE 3.2: Transposition Table variants
    case 'mcts-tt':
      return new MCTSBot({
        iterations: 200,
        rolloutDepth: 0,
        moveOrdering: true,
        transpositionTable: new TranspositionTable({ maxSize: 50_000 }),
        debug,
        nameSuffix: 'tt',
      });
    case 'mcts-tt-fast':
      return new MCTSBot({
        iterations: 50,
        rolloutDepth: 0,
        moveOrdering: true,
        transpositionTable: new TranspositionTable({ maxSize: 10_000 }),
        debug,
        nameSuffix: 'tt-fast',
      });
    case 'mcts-tt-strong':
      return new MCTSBot({
        iterations: 1000,
        rolloutDepth: 0,
        moveOrdering: true,
        transpositionTable: new TranspositionTable({ maxSize: 100_000 }),
        debug,
        nameSuffix: 'tt-strong',
      });

    case 'random':
    default:
      return new RandomBot(seed);
  }
}
