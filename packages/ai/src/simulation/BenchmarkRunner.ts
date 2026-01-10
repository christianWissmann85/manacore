import { initializeGame, applyAction, getRandomTestDeck } from '@manacore/engine';
import type { Bot } from '../bots/Bot';

export interface BenchmarkResult {
  p1Name: string;
  p2Name: string;
  games: number;
  p1Wins: number;
  p2Wins: number;
  draws: number;
  errors: number;
  avgTurns: number;
  gamesPerSecond: number;
  actionsPerSecond: number;
  avgTurnResolutionTimeMs: number;
  peakMemoryMb: number;
  avgMemoryMb: number;
  ruleComplianceRate: number;
}

export class BenchmarkRunner {
  static async run(
    p1: Bot,
    p2: Bot,
    numGames: number,
    baseSeed: number = 42,
    maxTurns: number = 200,
  ): Promise<BenchmarkResult> {
    const p1Name = p1.getName();
    const p2Name = p2.getName();

    let p1Wins = 0;
    let p2Wins = 0;
    let draws = 0;
    let errors = 0;
    let totalTurns = 0;
    let totalActions = 0;
    let totalResolutionTimeMs = 0;
    const memorySamples: number[] = [];

    const startTime = Date.now();

    for (let i = 0; i < numGames; i++) {
      const seed = baseSeed + i;
      const deck1 = getRandomTestDeck();
      const deck2 = getRandomTestDeck();
      let state = initializeGame(deck1, deck2, seed);

      let turns = 0;

      try {
        while (!state.gameOver && turns < maxTurns) {
          const currentBot = state.priorityPlayer === 'player' ? p1 : p2;
          const playerId = state.priorityPlayer;

          const actionStartTime = performance.now();
          const action = currentBot.chooseAction(state, playerId);
          const actionEndTime = performance.now();

          totalResolutionTimeMs += actionEndTime - actionStartTime;
          totalActions++;

          state = applyAction(state, action);

          if (state.priorityPlayer === 'player' && state.phase === 'beginning') {
            turns++;
          }
        }

        if (state.gameOver) {
          if (state.winner === 'player') p1Wins++;
          else p2Wins++;
        } else {
          draws++;
        }
        totalTurns += turns;
      } catch {
        errors++;
      }

      // Sample memory every game
      const mem = process.memoryUsage().heapUsed / 1024 / 1024;
      memorySamples.push(mem);
    }

    const endTime = Date.now();
    const elapsedSeconds = (endTime - startTime) / 1000;

    return {
      p1Name,
      p2Name,
      games: numGames,
      p1Wins,
      p2Wins,
      draws,
      errors,
      avgTurns: totalTurns / numGames,
      gamesPerSecond: numGames / elapsedSeconds,
      actionsPerSecond: totalActions / elapsedSeconds,
      avgTurnResolutionTimeMs: totalResolutionTimeMs / totalActions,
      peakMemoryMb: Math.max(...memorySamples),
      avgMemoryMb: memorySamples.reduce((a, b) => a + b, 0) / memorySamples.length,
      ruleComplianceRate: ((numGames - errors) / numGames) * 100,
    };
  }

  static getPlaceholderResult(): BenchmarkResult {
    return {
      p1Name: 'Placeholder',
      p2Name: 'Placeholder',
      games: 0,
      p1Wins: 0,
      p2Wins: 0,
      draws: 0,
      errors: 0,
      avgTurns: 0,
      gamesPerSecond: 0,
      actionsPerSecond: 0,
      avgTurnResolutionTimeMs: 0,
      peakMemoryMb: 0,
      avgMemoryMb: 0,
      ruleComplianceRate: 0,
    };
  }
}
