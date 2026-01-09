/**
 * Bot Wrapper for Capturing AI Thinking
 *
 * Wraps existing bots to capture their decision-making data for visualization.
 */

import type { GameState, Action, PlayerId } from '@manacore/engine';
import type { Bot } from '@manacore/ai';
import { runMCTS, randomRolloutPolicy, DEFAULT_MCTS_CONFIG, type MCTSConfig } from '@manacore/ai';
import {
  type AIThinking,
  captureMCTSThinking,
  captureGreedyThinking,
  captureRandomThinking,
} from '../serialization/aiThinking';

/**
 * Extended bot interface that captures thinking
 */
export interface ThinkingBot extends Bot {
  /** Get the last captured thinking data */
  getLastThinking(): AIThinking | null;

  /** Clear the last thinking data */
  clearThinking(): void;
}

/**
 * Wrapper for MCTSBot that captures thinking data
 */
export class MCTSThinkingBot implements ThinkingBot {
  private config: MCTSConfig;
  private lastThinking: AIThinking | null = null;
  private nameSuffix: string;

  constructor(iterations: number = 200, options: { timeLimit?: number; nameSuffix?: string } = {}) {
    this.nameSuffix = options.nameSuffix ?? '';
    this.config = {
      ...DEFAULT_MCTS_CONFIG,
      iterations,
      timeLimit: options.timeLimit ?? 5000,
      debug: false,
    };
  }

  getName(): string {
    const suffix = this.nameSuffix ? `-${this.nameSuffix}` : '';
    return `MCTSBot-${this.config.iterations}${suffix}`;
  }

  getDescription(): string {
    return `MCTS with ${this.config.iterations} iterations`;
  }

  chooseAction(state: GameState, playerId: PlayerId): Action {
    // Run MCTS and capture the full result
    const result = runMCTS(state, playerId, randomRolloutPolicy, this.config);

    // Capture thinking data
    this.lastThinking = captureMCTSThinking(result, state, playerId, this.getName());

    return result.action;
  }

  getLastThinking(): AIThinking | null {
    return this.lastThinking;
  }

  clearThinking(): void {
    this.lastThinking = null;
  }
}

/**
 * Wrapper for GreedyBot that captures thinking data
 */
export class GreedyThinkingBot implements ThinkingBot {
  private lastThinking: AIThinking | null = null;
  private innerBot: Bot;

  constructor(seed?: number) {
    // Use dynamic import to avoid circular dependency
    const { GreedyBot } = require('@manacore/ai');
    this.innerBot = new GreedyBot(seed);
  }

  getName(): string {
    return 'GreedyBot';
  }

  getDescription(): string {
    return 'Heuristic-based greedy bot';
  }

  chooseAction(state: GameState, playerId: PlayerId): Action {
    const startTime = performance.now();
    const action = this.innerBot.chooseAction(state, playerId);
    const timeMs = performance.now() - startTime;

    // Capture thinking data
    this.lastThinking = captureGreedyThinking(state, playerId, this.getName(), timeMs);

    return action;
  }

  getLastThinking(): AIThinking | null {
    return this.lastThinking;
  }

  clearThinking(): void {
    this.lastThinking = null;
  }
}

/**
 * Wrapper for RandomBot that captures thinking data
 */
export class RandomThinkingBot implements ThinkingBot {
  private lastThinking: AIThinking | null = null;
  private innerBot: Bot;

  constructor(seed?: number) {
    const { RandomBot } = require('@manacore/ai');
    this.innerBot = new RandomBot(seed);
  }

  getName(): string {
    return 'RandomBot';
  }

  getDescription(): string {
    return 'Pure random action selection';
  }

  chooseAction(state: GameState, playerId: PlayerId): Action {
    const action = this.innerBot.chooseAction(state, playerId);

    // Capture thinking data (minimal for random)
    this.lastThinking = captureRandomThinking(state, playerId, this.getName());

    return action;
  }

  getLastThinking(): AIThinking | null {
    return this.lastThinking;
  }

  clearThinking(): void {
    this.lastThinking = null;
  }
}

/**
 * Create a thinking-enabled bot from type string
 */
export function createThinkingBot(botType: string, seed?: number): ThinkingBot {
  switch (botType.toLowerCase()) {
    case 'random':
      return new RandomThinkingBot(seed);
    case 'greedy':
      return new GreedyThinkingBot(seed);
    case 'mcts':
    case 'mcts-eval':
      return new MCTSThinkingBot(200);
    case 'mcts-fast':
    case 'mcts-eval-fast':
      return new MCTSThinkingBot(50, { nameSuffix: 'fast' });
    case 'mcts-strong':
    case 'mcts-eval-strong':
      return new MCTSThinkingBot(500, { nameSuffix: 'strong' });
    default:
      console.warn(`Unknown bot type: ${botType}, defaulting to greedy`);
      return new GreedyThinkingBot(seed);
  }
}
