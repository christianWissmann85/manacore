/**
 * @manacore/cli-client - Terminal interface for testing
 *
 * This package provides:
 * - ASCII art game state display
 * - Command-line interface for playing games
 * - Bot vs Bot simulation runner
 */

import { RandomBot, GreedyBot, type Bot } from '@manacore/ai';
import { runSimulation, printResults } from './commands/simulate';
import { playGame } from './commands/play';

type BotType = 'random' | 'greedy';

function createBot(type: BotType, seed: number): Bot {
  switch (type) {
    case 'greedy':
      return new GreedyBot(seed);
    case 'random':
    default:
      return new RandomBot(seed);
  }
}

function parseBotType(arg: string): BotType {
  const lower = arg.toLowerCase();
  if (lower === 'greedy' || lower === 'g') return 'greedy';
  return 'random';
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  switch (command) {
    case 'play': {
      const opponentBot = new RandomBot();
      await playGame(opponentBot);
      break;
    }

    case 'simulate':
    case 'sim': {
      const gameCount = parseInt(args[1] || '100', 10);
      const verbose = args.includes('--verbose') || args.includes('-v');

      // Parse bot types: --p1 greedy --p2 random
      const p1Index = args.indexOf('--p1');
      const p2Index = args.indexOf('--p2');
      const p1Arg = p1Index !== -1 ? args[p1Index + 1] : undefined;
      const p2Arg = p2Index !== -1 ? args[p2Index + 1] : undefined;
      const p1Type = p1Arg ? parseBotType(p1Arg) : 'random';
      const p2Type = p2Arg ? parseBotType(p2Arg) : 'random';

      console.log('🎮 ManaCore - Game Simulator\n');

      const playerBot = createBot(p1Type, 42);
      const opponentBot = createBot(p2Type, 43);

      const results = await runSimulation(playerBot, opponentBot, {
        gameCount,
        maxTurns: 50,
        verbose,
        seed: 12345,
      });

      printResults(results, playerBot.getName(), opponentBot.getName());
      break;
    }

    case 'benchmark':
    case 'bench': {
      // Quick benchmark: GreedyBot vs RandomBot
      const gameCount = parseInt(args[1] || '10', 10);
      const debugMode = args.includes('--debug') || args.includes('-d');
      const debugVerbose = args.includes('--debug-verbose') || args.includes('-dv');

      console.log('🏆 ManaCore - Bot Benchmark\n');
      console.log(`Running ${gameCount} games: GreedyBot vs RandomBot`);
      if (debugMode) console.log('Debug mode enabled');
      if (debugVerbose) console.log('Verbose debug mode enabled');
      console.log('');

      const greedyBot = new GreedyBot(42, debugMode);
      const randomBot = new RandomBot(43);

      const startTime = Date.now();

      const results = await runSimulation(greedyBot, randomBot, {
        gameCount,
        maxTurns: 50,
        verbose: false,
        debugVerbose,
        seed: 12345,
      });

      const elapsed = (Date.now() - startTime) / 1000;

      printResults(results, greedyBot.getName(), randomBot.getName());

      const winRate = (results.playerWins / results.gamesCompleted) * 100;
      const stats = greedyBot.getStats();
      console.log(`\n📊 GreedyBot Win Rate: ${winRate.toFixed(1)}%`);
      console.log(
        `⏱️  Total time: ${elapsed.toFixed(1)}s (${(elapsed / gameCount).toFixed(2)}s/game)`,
      );
      console.log(
        `🧠 Decisions: ${stats.decisions} | Actions evaluated: ${stats.actionsEvaluated} | Avg: ${stats.avgActions.toFixed(1)}/decision`,
      );
      break;
    }

    case 'help':
    default:
      console.log('🔬 ManaCore Research CLI\n');
      console.log('Commands:');
      console.log('  play                    Start interactive debug session (Human vs Agent)');
      console.log('  simulate [count]        Run batch agent simulations (default: 100)');
      console.log('  sim [count]             Alias for simulate');
      console.log('  benchmark [count]       Run GreedyBot vs RandomBot benchmark (default: 10)');
      console.log('  bench [count]           Alias for benchmark');
      console.log('  help                    Show this help message');
      console.log('');
      console.log('Options:');
      console.log('  --verbose, -v           Show detailed simulation logs');
      console.log('  --debug, -d             Enable debug mode for bots');
      console.log('  --debug-verbose, -dv    Show detailed progress for each game/turn');
      console.log('  --p1 <bot>              Player 1 bot type (random, greedy)');
      console.log('  --p2 <bot>              Player 2 bot type (random, greedy)');
      console.log('');
      console.log('Examples:');
      console.log('  bun src/index.ts play');
      console.log('  bun src/index.ts simulate 100');
      console.log('  bun src/index.ts sim 10 --p1 greedy --p2 random');
      console.log('  bun src/index.ts benchmark 20');
      break;
  }
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
