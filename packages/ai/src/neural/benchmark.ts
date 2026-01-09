#!/usr/bin/env bun
/**
 * Benchmark NeuralBot against baseline bots.
 *
 * Usage:
 *   bun packages/ai/src/neural/benchmark.ts
 */

import { NeuralBot, createNeuralBot } from './NeuralBot';
import { RandomBot } from '../bots/RandomBot';
import { GreedyBot } from '../bots/GreedyBot';
import { initializeGame, applyAction, getLegalActions, getRandomTestDeck } from '@manacore/engine';
import type { Bot } from '../bots/Bot';
import { resolve } from 'path';

interface BenchmarkResult {
  p1Name: string;
  p2Name: string;
  games: number;
  p1Wins: number;
  p2Wins: number;
  draws: number;
  errors: number;
  avgTurns: number;
  gamesPerSecond: number;
}

async function playGame(
  p1: Bot | NeuralBot,
  p2: Bot | NeuralBot,
  seed: number,
  maxTurns: number = 100,
): Promise<{ winner: 'p1' | 'p2' | 'draw' | 'error'; turns: number }> {
  let state = initializeGame(getRandomTestDeck(), getRandomTestDeck(), seed);

  let turns = 0;

  try {
    while (!state.gameOver && turns < maxTurns) {
      const currentBot = state.priorityPlayer === 'player' ? p1 : p2;
      const playerId = state.priorityPlayer;

      let action;
      if ('chooseActionAsync' in currentBot) {
        action = await (currentBot as NeuralBot).chooseActionAsync(state, playerId);
      } else {
        action = (currentBot as Bot).chooseAction(state, playerId);
      }

      state = applyAction(state, action);

      if (state.priorityPlayer === 'player' && state.phase === 'untap') {
        turns++;
      }
    }

    if (state.gameOver) {
      return { winner: state.winner === 'player' ? 'p1' : 'p2', turns };
    }
    return { winner: 'draw', turns };
  } catch {
    // Game hit an edge case
    return { winner: 'error', turns };
  }
}

async function benchmark(
  p1: Bot | NeuralBot,
  p2: Bot | NeuralBot,
  numGames: number,
  baseSeed: number = 42,
): Promise<BenchmarkResult> {
  const p1Name = p1.getName();
  const p2Name = p2.getName();

  console.log(`\nBenchmarking: ${p1Name} vs ${p2Name} (${numGames} games)`);

  let p1Wins = 0;
  let p2Wins = 0;
  let draws = 0;
  let errors = 0;
  let totalTurns = 0;

  const startTime = Date.now();

  for (let i = 0; i < numGames; i++) {
    const result = await playGame(p1, p2, baseSeed + i);

    if (result.winner === 'p1') p1Wins++;
    else if (result.winner === 'p2') p2Wins++;
    else if (result.winner === 'error') errors++;
    else draws++;

    totalTurns += result.turns;

    if ((i + 1) % 10 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (i + 1) / elapsed;
      process.stdout.write(`\r  Progress: ${i + 1}/${numGames} (${rate.toFixed(1)} games/s)`);
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;
  const gamesPerSecond = numGames / elapsed;

  console.log(`\r  Progress: ${numGames}/${numGames} - Done!                    `);

  return {
    p1Name,
    p2Name,
    games: numGames,
    p1Wins,
    p2Wins,
    draws,
    errors,
    avgTurns: totalTurns / numGames,
    gamesPerSecond,
  };
}

function printResult(result: BenchmarkResult) {
  const validGames = result.games - result.errors;
  const p1WinRate = validGames > 0 ? (result.p1Wins / validGames) * 100 : 0;
  const p2WinRate = validGames > 0 ? (result.p2Wins / validGames) * 100 : 0;

  console.log(`\n  Results:`);
  console.log(`    ${result.p1Name}: ${result.p1Wins} wins (${p1WinRate.toFixed(1)}%)`);
  console.log(`    ${result.p2Name}: ${result.p2Wins} wins (${p2WinRate.toFixed(1)}%)`);
  console.log(`    Draws: ${result.draws}`);
  if (result.errors > 0) {
    console.log(`    Errors: ${result.errors}`);
  }
  console.log(`    Avg turns: ${result.avgTurns.toFixed(1)}`);
  console.log(`    Speed: ${result.gamesPerSecond.toFixed(1)} games/sec`);
}

async function main() {
  console.log('═'.repeat(60));
  console.log('NeuralBot Benchmark');
  console.log('═'.repeat(60));

  // Create bots
  const modelPath = resolve(__dirname, '../../models/imitator.onnx');
  console.log(`\nLoading NeuralBot from: ${modelPath}`);

  const neuralBot = await createNeuralBot(modelPath);
  const randomBot = new RandomBot(42);
  const greedyBot = new GreedyBot(42);

  const numGames = 100;

  // NeuralBot vs RandomBot
  const vsRandom = await benchmark(neuralBot, randomBot, numGames);
  printResult(vsRandom);

  // NeuralBot vs GreedyBot
  const vsGreedy = await benchmark(neuralBot, greedyBot, numGames);
  printResult(vsGreedy);

  // GreedyBot vs RandomBot (baseline)
  const greedyVsRandom = await benchmark(greedyBot, randomBot, numGames);
  printResult(greedyVsRandom);

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('Summary');
  console.log('═'.repeat(60));
  console.log(
    `NeuralBot vs Random:  ${((vsRandom.p1Wins / vsRandom.games) * 100).toFixed(1)}% win rate`,
  );
  console.log(
    `NeuralBot vs Greedy:  ${((vsGreedy.p1Wins / vsGreedy.games) * 100).toFixed(1)}% win rate`,
  );
  console.log(
    `Greedy vs Random:     ${((greedyVsRandom.p1Wins / greedyVsRandom.games) * 100).toFixed(1)}% win rate (baseline)`,
  );
  console.log('═'.repeat(60));

  // Cleanup
  await neuralBot.close();
}

main().catch(console.error);
