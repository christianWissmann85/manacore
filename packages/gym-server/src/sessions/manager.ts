/**
 * Game Session Manager
 *
 * Manages multiple concurrent game sessions for the Gym server.
 * Sessions are stored in memory and auto-cleaned after inactivity.
 */

import type { GameState, CardTemplate } from '@manacore/engine';
import {
  initializeGame,
  applyAction,
  getLegalActions,
  getRandomTestDeck,
  getTestDeck,
  ALL_TEST_DECKS,
} from '@manacore/engine';
import type { AllDeckTypes } from '@manacore/engine';
import type { Bot } from '@manacore/ai';
import { RandomBot, GreedyBot, MCTSBotPresets } from '@manacore/ai';
import {
  RewardShaper,
  type RewardShapingConfig,
  DEFAULT_REWARD_SHAPING_CONFIG,
} from '../rewards/shaping';

export interface GameSession {
  id: string;
  state: GameState;
  opponent: Bot;
  opponentType: string;
  createdAt: number;
  lastAccessedAt: number;
  stepCount: number;
  seed: number;
  rewardShaper: RewardShaper;
}

export interface SessionManagerConfig {
  maxSessions: number;
  inactivityTimeoutMs: number;
  cleanupIntervalMs: number;
  rewardShaping: RewardShapingConfig;
}

export const DEFAULT_SESSION_CONFIG: SessionManagerConfig = {
  maxSessions: 1000,
  inactivityTimeoutMs: 5 * 60 * 1000, // 5 minutes
  cleanupIntervalMs: 60 * 1000, // 1 minute
  rewardShaping: DEFAULT_REWARD_SHAPING_CONFIG,
};

/**
 * Create a bot instance from a string identifier
 */
export function createBot(botType: string): Bot {
  switch (botType.toLowerCase()) {
    case 'random':
      return new RandomBot();
    case 'greedy':
      return new GreedyBot();
    case 'mcts':
    case 'mcts-eval':
      return MCTSBotPresets.standard();
    case 'mcts-fast':
    case 'mcts-eval-fast':
      return MCTSBotPresets.fast();
    case 'mcts-strong':
    case 'mcts-eval-strong':
      return MCTSBotPresets.strong();
    default:
      console.warn(`Unknown bot type: ${botType}, defaulting to greedy`);
      return new GreedyBot();
  }
}

/**
 * Get all available deck names
 */
export function getAvailableDeckNames(): string[] {
  return Object.keys(ALL_TEST_DECKS);
}

/**
 * Get a deck by name or return a random deck
 */
export function getDeck(deckName: string): CardTemplate[] {
  if (deckName === 'random') {
    return getRandomTestDeck();
  }

  // Normalize deck name
  const normalizedName = deckName.toLowerCase().replace(/[^a-z]/g, '');

  // Try exact match first
  const deckNames = Object.keys(ALL_TEST_DECKS) as AllDeckTypes[];
  const exactMatch = deckNames.find(
    (name) =>
      name.toLowerCase() === normalizedName || name.toLowerCase() === deckName.toLowerCase(),
  );

  if (exactMatch) {
    return getTestDeck(exactMatch);
  }

  // Try partial match
  const partialMatch = deckNames.find(
    (name) =>
      name.toLowerCase().includes(normalizedName) || normalizedName.includes(name.toLowerCase()),
  );

  if (partialMatch) {
    return getTestDeck(partialMatch);
  }

  // Handle common aliases
  const aliases: Record<string, AllDeckTypes> = {
    vanilla: 'red',
    aggro: 'red_burn',
    control: 'blue_control',
    burn: 'red_burn',
    weenie: 'white_weenie',
  };

  const aliasMatch = aliases[normalizedName];
  if (aliasMatch) {
    return getTestDeck(aliasMatch);
  }

  // Default to red (simple aggro deck)
  console.warn(`Unknown deck: ${deckName}, defaulting to red`);
  return getTestDeck('red');
}

export class SessionManager {
  private sessions: Map<string, GameSession> = new Map();
  private config: SessionManagerConfig;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<SessionManagerConfig> = {}) {
    this.config = { ...DEFAULT_SESSION_CONFIG, ...config };
    this.startCleanup();
  }

  /**
   * Create a new game session
   */
  createSession(
    opponentType: string = 'greedy',
    playerDeck: string = 'vanilla',
    opponentDeck: string = 'vanilla',
    seed?: number,
  ): GameSession {
    // Check capacity
    if (this.sessions.size >= this.config.maxSessions) {
      // Try to clean up inactive sessions first
      this.cleanup();
      if (this.sessions.size >= this.config.maxSessions) {
        throw new Error(`Maximum sessions (${this.config.maxSessions}) reached. Try again later.`);
      }
    }

    const actualSeed = seed ?? Date.now();
    const gameId = `game-${actualSeed}-${Math.random().toString(36).slice(2, 8)}`;

    const deck1 = getDeck(playerDeck);
    const deck2 = getDeck(opponentDeck);

    const state = initializeGame(deck1, deck2, actualSeed);
    const opponent = createBot(opponentType);
    const rewardShaper = new RewardShaper(this.config.rewardShaping);
    rewardShaper.initialize(state);

    const session: GameSession = {
      id: gameId,
      state,
      opponent,
      opponentType,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      stepCount: 0,
      seed: actualSeed,
      rewardShaper,
    };

    this.sessions.set(gameId, session);
    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(gameId: string): GameSession | undefined {
    const session = this.sessions.get(gameId);
    if (session) {
      session.lastAccessedAt = Date.now();
    }
    return session;
  }

  /**
   * Apply an action to a game session
   */
  step(
    gameId: string,
    actionIndex: number,
  ): {
    state: GameState;
    reward: number;
    done: boolean;
    truncated: boolean;
    info: Record<string, unknown>;
  } {
    const session = this.sessions.get(gameId);
    if (!session) {
      throw new Error(`Session not found: ${gameId}`);
    }

    session.lastAccessedAt = Date.now();
    session.stepCount++;

    // If game is already over, return terminal state (no-op for RL compatibility)
    if (session.state.gameOver) {
      const reward = session.state.winner === 'player' ? 1.0 : -1.0;
      return {
        state: session.state,
        reward,
        done: true,
        truncated: false,
        info: {
          stepCount: session.stepCount,
          turn: session.state.turnCount,
          phase: session.state.phase,
          winner: session.state.winner,
        },
      };
    }

    // Get legal actions for player
    const legalActions = getLegalActions(session.state, 'player');

    // No legal actions = treat as terminal (edge case, shouldn't happen normally)
    if (legalActions.length === 0) {
      console.warn(`[SessionManager] No legal actions available for game ${gameId}`);
      return {
        state: session.state,
        reward: -1.0, // Treat as loss
        done: true,
        truncated: false,
        info: {
          stepCount: session.stepCount,
          turn: session.state.turnCount,
          phase: session.state.phase,
          winner: 'opponent',
          error: 'No legal actions available',
        },
      };
    }

    if (actionIndex < 0 || actionIndex >= legalActions.length) {
      throw new Error(
        `Invalid action index: ${actionIndex}. Legal actions: 0-${legalActions.length - 1}`,
      );
    }

    // Apply player action
    const action = legalActions[actionIndex];
    if (!action) {
      throw new Error(`Action at index ${actionIndex} not found`);
    }

    try {
      session.state = applyAction(session.state, action);
    } catch (error) {
      // Action validation failed - treat as terminal state
      console.warn(
        `[SessionManager] Action failed for game ${gameId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return {
        state: session.state,
        reward: -1.0,
        done: true,
        truncated: false,
        info: {
          stepCount: session.stepCount,
          turn: session.state.turnCount,
          phase: session.state.phase,
          winner: 'opponent',
          error: error instanceof Error ? error.message : 'Action failed',
        },
      };
    }

    // Run opponent moves until player has priority again or game ends
    while (!session.state.gameOver && session.state.priorityPlayer === 'opponent') {
      try {
        const opponentAction = session.opponent.chooseAction(session.state, 'opponent');
        session.state = applyAction(session.state, opponentAction);
      } catch (error) {
        // Opponent action failed - treat as win for player
        console.warn(
          `[SessionManager] Opponent action failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        return {
          state: session.state,
          reward: 1.0,
          done: true,
          truncated: false,
          info: {
            stepCount: session.stepCount,
            turn: session.state.turnCount,
            phase: session.state.phase,
            winner: 'player',
            error: 'Opponent action failed',
          },
        };
      }
    }

    // Auto-pass forced moves for player
    try {
      while (!session.state.gameOver && session.state.priorityPlayer === 'player') {
        const playerActions = getLegalActions(session.state, 'player');
        if (playerActions.length === 1 && playerActions[0]) {
          // Forced move - auto apply
          session.state = applyAction(session.state, playerActions[0]);

          // Check if opponent now has priority
          while (!session.state.gameOver && session.state.priorityPlayer === 'opponent') {
            const opponentAction = session.opponent.chooseAction(session.state, 'opponent');
            session.state = applyAction(session.state, opponentAction);
          }
        } else {
          break;
        }
      }
    } catch (error) {
      // Auto-pass loop failed - return current state as terminal
      console.warn(
        `[SessionManager] Auto-pass failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return {
        state: session.state,
        reward: session.state.gameOver ? (session.state.winner === 'player' ? 1.0 : -1.0) : -1.0,
        done: true,
        truncated: false,
        info: {
          stepCount: session.stepCount,
          turn: session.state.turnCount,
          phase: session.state.phase,
          winner: session.state.winner || 'opponent',
          error: error instanceof Error ? error.message : 'Auto-pass failed',
        },
      };
    }

    // Calculate reward (terminal + shaped)
    const terminalReward = session.state.gameOver
      ? session.state.winner === 'player'
        ? 1.0
        : -1.0
      : 0;
    const reward = session.rewardShaper.calculateReward(
      session.state,
      terminalReward,
      session.state.gameOver,
    );

    // Check for truncation (max steps)
    const truncated = session.stepCount > 500;

    return {
      state: session.state,
      reward,
      done: session.state.gameOver,
      truncated,
      info: {
        stepCount: session.stepCount,
        turn: session.state.turnCount,
        phase: session.state.phase,
        winner: session.state.winner,
        shapedReward: reward !== terminalReward,
      },
    };
  }

  /**
   * Reset a game session (keep same opponent)
   */
  reset(gameId: string, seed?: number): GameSession {
    const session = this.sessions.get(gameId);
    if (!session) {
      throw new Error(`Session not found: ${gameId}`);
    }

    const actualSeed = seed ?? Date.now();
    const deck1 = getRandomTestDeck();
    const deck2 = getRandomTestDeck();

    session.state = initializeGame(deck1, deck2, actualSeed);
    session.lastAccessedAt = Date.now();
    session.stepCount = 0;
    session.seed = actualSeed;
    session.rewardShaper.reset();
    session.rewardShaper.initialize(session.state);

    return session;
  }

  /**
   * Delete a session
   */
  deleteSession(gameId: string): boolean {
    return this.sessions.delete(gameId);
  }

  /**
   * Get session statistics
   */
  getStats(): {
    activeSessions: number;
    maxSessions: number;
    oldestSession: number | null;
  } {
    let oldest: number | null = null;
    for (const session of this.sessions.values()) {
      if (oldest === null || session.createdAt < oldest) {
        oldest = session.createdAt;
      }
    }

    return {
      activeSessions: this.sessions.size,
      maxSessions: this.config.maxSessions,
      oldestSession: oldest,
    };
  }

  /**
   * Get all session IDs
   */
  getSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Clean up inactive sessions
   * Note: Only clean up based on inactivity timeout, NOT gameOver status.
   * This allows RL training to reuse sessions by calling reset().
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.config.inactivityTimeoutMs;
    let cleaned = 0;

    for (const [id, session] of this.sessions) {
      if (session.lastAccessedAt < cutoff) {
        this.sessions.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[SessionManager] Cleaned up ${cleaned} inactive sessions`);
    }
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => this.cleanup(), this.config.cleanupIntervalMs);
  }

  /**
   * Stop automatic cleanup
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
