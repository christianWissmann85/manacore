#!/usr/bin/env bun
import { BenchmarkRunner } from '../packages/ai/src/simulation/BenchmarkRunner';
import { RandomBot } from '../packages/ai/src/bots/RandomBot';
import { GreedyBot } from '../packages/ai/src/bots/GreedyBot';
import { MCTSBot } from '../packages/ai/src/bots/MCTSBot';

async function main() {
  const numGames = parseInt(process.argv[2]) || 100;

  console.log('═'.repeat(60));
  console.log(`MANACORE PERFORMANCE BENCHMARK (${numGames} games)`);
  console.log('═'.repeat(60));

  const bots = [
    new RandomBot(42),
    new GreedyBot(42),
    new MCTSBot(42, { iterations: 100 }), // Faster MCTS for benchmarking
  ];

  for (let i = 0; i < bots.length; i++) {
    for (let j = i; j < bots.length; j++) {
      const p1 = bots[i];
      const p2 = bots[j];

      const result = await BenchmarkRunner.run(p1, p2, numGames);

      console.log(`\nMatchup: ${result.p1Name} vs ${result.p2Name}`);
      console.log(
        `  Speed: ${result.gamesPerSecond.toFixed(2)} games/s (${result.actionsPerSecond.toFixed(2)} actions/s)`,
      );
      console.log(`  Latency: ${result.avgTurnResolutionTimeMs.toFixed(4)} ms/action`);
      console.log(
        `  Memory: ${result.avgMemoryMb.toFixed(2)} MB avg / ${result.peakMemoryMb.toFixed(2)} MB peak`,
      );
      console.log(`  Stability: ${result.ruleComplianceRate.toFixed(2)}% rule compliance`);
      console.log(`  Outcome: ${result.p1Wins}W - ${result.p2Wins}L - ${result.draws}D`);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('BENCHMARK COMPLETE');
  console.log('═'.repeat(60));
}

main().catch(console.error);
