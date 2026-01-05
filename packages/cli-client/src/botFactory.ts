import {
  RandomBot,
  GreedyBot,
  MCTSBot,
  greedyRolloutPolicy,
  epsilonGreedyRolloutPolicy,
  type Bot,
} from '@manacore/ai';

export type BotType =
  | 'random'
  | 'greedy'
  | 'mcts'
  | 'mcts-fast'
  | 'mcts-strong'
  | 'mcts-greedy'
  | 'mcts-greedy-fast'
  | 'mcts-epsilon'
  | 'mcts-eval'
  | 'mcts-eval-fast'
  | 'mcts-eval-strong'
  | 'mcts-eval-turbo'
  | 'mcts-shallow'
  | 'mcts-shallow-fast';

export function createBot(type: BotType, seed: number, debug = false): Bot {
  switch (type) {
    case 'greedy':
      return new GreedyBot(seed, debug);

    // Random rollout MCTS variants (original - slow)
    case 'mcts':
      return new MCTSBot({ iterations: 200, rolloutDepth: 20, debug });
    case 'mcts-fast':
      return new MCTSBot({ iterations: 50, rolloutDepth: 15, debug, nameSuffix: 'fast' });
    case 'mcts-strong':
      return new MCTSBot({ iterations: 500, rolloutDepth: 25, debug, nameSuffix: 'strong' });

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

    case 'random':
    default:
      return new RandomBot(seed);
  }
}
