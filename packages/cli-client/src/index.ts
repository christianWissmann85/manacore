/**
 * @manacore/cli-client - Terminal interface for testing
 *
 * This package provides:
 * - ASCII art game state display
 * - Command-line interface for playing games
 * - Bot vs Bot simulation runner
 */

import { RandomBot } from '@manacore/ai';
import { runSimulation, printResults } from './commands/simulate';
import { playGame } from './commands/play';

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

      console.log('🎮 ManaCore - Game Simulator\n');

      const playerBot = new RandomBot(42);
      const opponentBot = new RandomBot(43);

      const results = await runSimulation(playerBot, opponentBot, {
        gameCount,
        maxTurns: 50,  // Phase 0: simplified combat should finish quickly
        verbose,
        seed: 12345,
      });

      printResults(results, playerBot.getName(), opponentBot.getName());
      break;
    }

    case 'help':
    default:
      console.log('🎮 ManaCore CLI Client\n');
      console.log('Commands:');
      console.log('  play               Play against RandomBot');
      console.log('  simulate [count]   Run bot vs bot simulations (default: 100 games)');
      console.log('  sim [count]        Alias for simulate');
      console.log('  help               Show this help message');
      console.log('');
      console.log('Options:');
      console.log('  --verbose, -v      Show detailed output (for simulate)');
      console.log('');
      console.log('Examples:');
      console.log('  bun run src/index.ts play');
      console.log('  bun run src/index.ts simulate 100');
      console.log('  bun run src/index.ts sim 10 --verbose');
      break;
  }
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
