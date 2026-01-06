import { RandomBot, GreedyBot, MCTSBot, type Bot } from '@manacore/ai';

export type BotType =
  | 'random'
  | 'greedy'
  // MCTS eval variants (no rollout - FASTEST and most effective)
  | 'mcts-eval-fast'
  | 'mcts-eval'
  | 'mcts-eval-strong'
  | 'mcts-eval-turbo'
  // MCTS with move ordering (Phase 3.4 - slight improvement)
  | 'mcts-ordered';

export function createBot(type: BotType, seed: number, debug = false): Bot {
  switch (type) {
    case 'greedy':
      return new GreedyBot(seed, debug);

    // MCTS NO ROLLOUT variants - evaluate expanded node directly (FASTEST)
    case 'mcts-eval-fast':
      return new MCTSBot({
        iterations: 50,
        rolloutDepth: 0,
        debug,
        nameSuffix: 'eval-fast',
      });
    case 'mcts-eval':
      return new MCTSBot({
        iterations: 200,
        rolloutDepth: 0,
        debug,
        nameSuffix: 'eval',
      });
    case 'mcts-eval-strong':
      return new MCTSBot({
        iterations: 500,
        rolloutDepth: 0,
        debug,
        nameSuffix: 'eval-strong',
      });
    case 'mcts-eval-turbo':
      return new MCTSBot({
        iterations: 1000,
        rolloutDepth: 0,
        debug,
        nameSuffix: 'eval-turbo',
      });

    // MCTS with move ordering (Phase 3.4)
    case 'mcts-ordered':
      return new MCTSBot({
        iterations: 200,
        rolloutDepth: 0,
        moveOrdering: true,
        debug,
        nameSuffix: 'ordered',
      });

    case 'random':
    default:
      return new RandomBot(seed);
  }
}
