/**
 * FitnessEvaluator - Evaluate weight configurations through gameplay
 *
 * Computes three fitness metrics:
 * 1. Win rate vs RandomBot
 * 2. Win rate vs GreedyBot
 * 3. Head-to-head tournament Elo
 */

import type { PlayerId } from '@manacore/engine';
import {
  initializeGame,
  getRandomTestDeck,
  applyAction,
  getLegalActions,
  enableF6Mode,
} from '@manacore/engine';
import { RandomBot } from '../bots/RandomBot';
import { GreedyBot } from '../bots/GreedyBot';
import type { Bot } from '../bots/Bot';
import { TunableBot, normalizeWeights } from './TunableBot';
import type { FitnessScores, FitnessConfig, WeightCandidate } from './types';
import type { EvaluationWeights } from '../evaluation/evaluate';

const DEFAULT_CONFIG: FitnessConfig = {
  gamesVsRandom: 50,
  gamesVsGreedy: 30,
  tournamentGames: 20,
  maxTurns: 100,
  seed: Date.now(),
};

interface GameResult {
  winner: PlayerId | null;
  turns: number;
}

/**
 * Run a single game between two bots
 */
function runGame(bot1: Bot, bot2: Bot, seed: number, maxTurns: number): GameResult {
  const deck1 = getRandomTestDeck();
  const deck2 = getRandomTestDeck();
  let state = initializeGame(deck1, deck2, seed);

  // Enable F6 auto-pass for faster AI simulations
  // This eliminates forced non-decisions at the engine level
  enableF6Mode(state, true);

  let turnCount = 0;
  let actionCount = 0;
  const MAX_ACTIONS_PER_PRIORITY = 50;
  let actionsThisPriority = 0;
  let lastPriorityPlayer = state.priorityPlayer;
  let lastPhase = state.phase;

  while (!state.gameOver && turnCount < maxTurns && actionCount < 10000) {
    const bot = state.priorityPlayer === 'player' ? bot1 : bot2;
    const legalActions = getLegalActions(state, state.priorityPlayer);

    if (legalActions.length === 0) break;

    const action = bot.chooseAction(state, state.priorityPlayer);

    try {
      state = applyAction(state, action);
      actionCount++;

      // Check for priority change (hang detection)
      if (state.priorityPlayer !== lastPriorityPlayer || state.phase !== lastPhase) {
        actionsThisPriority = 0;
        lastPriorityPlayer = state.priorityPlayer;
        lastPhase = state.phase;
      } else {
        actionsThisPriority++;
        if (actionsThisPriority >= MAX_ACTIONS_PER_PRIORITY) {
          // Infinite loop - declare draw
          break;
        }
      }
    } catch {
      // Action failed - break
      break;
    }

    if (state.turnCount > turnCount) {
      turnCount = state.turnCount;
    }
  }

  // Determine winner
  let winner: PlayerId | null = null;
  if (state.gameOver && state.winner) {
    winner = state.winner;
  } else {
    // Tiebreak by life
    const p1Life = state.players.player.life;
    const p2Life = state.players.opponent.life;
    if (p1Life > p2Life) winner = 'player';
    else if (p2Life > p1Life) winner = 'opponent';
  }

  return { winner, turns: turnCount };
}

/**
 * Calculate Elo rating change
 */
function calculateEloChange(
  winnerElo: number,
  loserElo: number,
  isDraw: boolean,
  k = 32,
): { winnerChange: number; loserChange: number } {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLoser = 1 - expectedWinner;

  if (isDraw) {
    return {
      winnerChange: k * (0.5 - expectedWinner),
      loserChange: k * (0.5 - expectedLoser),
    };
  }

  return {
    winnerChange: k * (1 - expectedWinner),
    loserChange: k * (0 - expectedLoser),
  };
}

export class FitnessEvaluator {
  private config: FitnessConfig;
  private gamesPlayed = 0;

  constructor(config: Partial<FitnessConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get total games played
   */
  getGamesPlayed(): number {
    return this.gamesPlayed;
  }

  /**
   * Reset game counter
   */
  resetGamesPlayed(): void {
    this.gamesPlayed = 0;
  }

  /**
   * Evaluate a single weight configuration
   */
  evaluate(weights: EvaluationWeights, baseSeed?: number): FitnessScores {
    const seed = baseSeed ?? this.config.seed;
    const normalized = normalizeWeights(weights);
    const tunableBot = new TunableBot(normalized, seed, 'Candidate');

    // 1. Win rate vs RandomBot
    const vsRandomResults = this.runMatchup(
      tunableBot,
      new RandomBot(seed + 1000),
      this.config.gamesVsRandom,
      seed,
    );
    const vsRandom = vsRandomResults.wins / vsRandomResults.total;

    // 2. Win rate vs GreedyBot
    const vsGreedyResults = this.runMatchup(
      tunableBot,
      new GreedyBot(seed + 2000),
      this.config.gamesVsGreedy,
      seed + 10000,
    );
    const vsGreedy = vsGreedyResults.wins / vsGreedyResults.total;

    // 3. Elo is computed in tournament (placeholder here)
    // For single evaluation, use a simple formula based on win rates
    const elo = 1500 + (vsRandom - 0.5) * 400 + (vsGreedy - 0.5) * 600;

    // Combined fitness: weighted average
    // vs Random is easier, so weight it less
    const combined = vsRandom * 0.3 + vsGreedy * 0.5 + ((elo - 1500) / 1000) * 0.2 + 0.5;

    return {
      vsRandom,
      vsGreedy,
      elo: Math.round(elo),
      combined: Math.min(1, Math.max(0, combined)),
      gamesPlayed: vsRandomResults.total + vsGreedyResults.total,
    };
  }

  /**
   * Run a matchup between two bots
   */
  private runMatchup(
    bot1: Bot,
    bot2: Bot,
    games: number,
    baseSeed: number,
  ): { wins: number; losses: number; draws: number; total: number } {
    let wins = 0;
    let losses = 0;
    let draws = 0;

    for (let i = 0; i < games; i++) {
      const seed = baseSeed + i;
      const result = runGame(bot1, bot2, seed, this.config.maxTurns);
      this.gamesPlayed++;

      if (result.winner === 'player') wins++;
      else if (result.winner === 'opponent') losses++;
      else draws++;
    }

    return { wins, losses, draws, total: games };
  }

  /**
   * Run a round-robin tournament between multiple candidates
   * Returns updated candidates with Elo ratings
   */
  runTournament(candidates: WeightCandidate[], baseSeed?: number): WeightCandidate[] {
    const seed = baseSeed ?? this.config.seed;
    const n = candidates.length;

    // Initialize Elo ratings
    const elos = new Map<string, number>();
    for (const c of candidates) {
      elos.set(c.id, 1500);
    }

    // Round-robin: each candidate plays against every other
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const c1 = candidates[i]!;
        const c2 = candidates[j]!;

        const bot1 = new TunableBot(c1.weights, seed + i * 1000, `C${i}`);
        const bot2 = new TunableBot(c2.weights, seed + j * 1000, `C${j}`);

        // Play multiple games
        for (let g = 0; g < this.config.tournamentGames; g++) {
          const gameSeed = seed + i * 10000 + j * 100 + g;
          const result = runGame(bot1, bot2, gameSeed, this.config.maxTurns);
          this.gamesPlayed++;

          const elo1 = elos.get(c1.id)!;
          const elo2 = elos.get(c2.id)!;

          if (result.winner === 'player') {
            const change = calculateEloChange(elo1, elo2, false);
            elos.set(c1.id, elo1 + change.winnerChange);
            elos.set(c2.id, elo2 + change.loserChange);
          } else if (result.winner === 'opponent') {
            const change = calculateEloChange(elo2, elo1, false);
            elos.set(c2.id, elo2 + change.winnerChange);
            elos.set(c1.id, elo1 + change.loserChange);
          } else {
            // Draw
            const change = calculateEloChange(elo1, elo2, true);
            elos.set(c1.id, elo1 + change.winnerChange);
            elos.set(c2.id, elo2 + change.loserChange);
          }
        }
      }
    }

    // Update candidates with Elo ratings
    return candidates.map((c) => {
      const elo = Math.round(elos.get(c.id) ?? 1500);
      const fitness = c.fitness
        ? { ...c.fitness, elo }
        : {
            vsRandom: 0,
            vsGreedy: 0,
            elo,
            combined: 0,
            gamesPlayed: 0,
          };
      return { ...c, fitness };
    });
  }

  /**
   * Evaluate multiple candidates in parallel-friendly way
   * (Actually runs sequentially, but structured for future parallelization)
   */
  evaluateAll(
    candidates: WeightCandidate[],
    onProgress?: (completed: number, total: number) => void,
  ): WeightCandidate[] {
    const total = candidates.length;
    const results: WeightCandidate[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]!;
      const fitness = this.evaluate(candidate.weights, this.config.seed + i * 100000);

      results.push({
        ...candidate,
        fitness,
      });

      onProgress?.(i + 1, total);
    }

    return results;
  }
}
