/**
 * @manacore/cli-client - Terminal interface for testing
 *
 * This package provides:
 * - ASCII art game state display
 * - Command-line interface for playing games
 * - Bot vs Bot simulation runner
 */

import { RandomBot, GreedyBot, type Bot } from '@manacore/ai';
import { runSimulation, printResults, exportResults } from './commands/simulate';
import { playGame } from './commands/play';
import { runTune } from './commands/tune';
import { runBenchmarkSuite, parseBenchmarkSuiteArgs } from './commands/benchmarkSuite';
import { OutputLevel, type ExportFormat } from './types';
import { createBot, type BotType } from './botFactory';

function parseBotType(arg: string): BotType {
  const lower = arg.toLowerCase();
  if (lower === 'greedy' || lower === 'g') return 'greedy';

  // Random rollout variants (slow)
  if (lower === 'mcts' || lower === 'm') return 'mcts';
  if (lower === 'mcts-fast' || lower === 'mf') return 'mcts-fast';
  if (lower === 'mcts-strong' || lower === 'ms') return 'mcts-strong';

  // Greedy rollout variants
  if (lower === 'mcts-greedy' || lower === 'mg') return 'mcts-greedy';
  if (lower === 'mcts-greedy-fast' || lower === 'mgf') return 'mcts-greedy-fast';
  if (lower === 'mcts-epsilon' || lower === 'me') return 'mcts-epsilon';

  // No-rollout variants (FASTEST)
  if (lower === 'mcts-eval' || lower === 'mev') return 'mcts-eval';
  if (lower === 'mcts-eval-fast' || lower === 'mevf') return 'mcts-eval-fast';
  if (lower === 'mcts-eval-strong' || lower === 'mevs') return 'mcts-eval-strong';
  if (lower === 'mcts-eval-turbo' || lower === 'mevt') return 'mcts-eval-turbo';

  // Shallow greedy (best balance)
  if (lower === 'mcts-shallow' || lower === 'msh') return 'mcts-shallow';
  if (lower === 'mcts-shallow-fast' || lower === 'mshf') return 'mcts-shallow-fast';

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

      // Parse output level (new Phase 2.5 flags)
      let outputLevel: OutputLevel;
      if (args.includes('--quiet') || args.includes('-q')) {
        outputLevel = OutputLevel.QUIET;
      } else if (args.includes('--minimal') || args.includes('-m')) {
        outputLevel = OutputLevel.MINIMAL;
      } else if (args.includes('--normal') || args.includes('-n')) {
        outputLevel = OutputLevel.NORMAL;
      } else if (args.includes('--verbose') || args.includes('-v')) {
        outputLevel = OutputLevel.VERBOSE;
      } else {
        // Auto-determine: minimal for large runs, normal otherwise
        outputLevel = gameCount > 50 ? OutputLevel.MINIMAL : OutputLevel.NORMAL;
      }

      // Phase 2.5: Always auto-export JSON (unless explicitly disabled)
      const noAutoExport = args.includes('--no-auto-export');
      const autoExport = !noAutoExport;

      // Parse bot types: --p1 greedy --p2 random
      const p1Index = args.indexOf('--p1');
      const p2Index = args.indexOf('--p2');
      const p1Arg = p1Index !== -1 ? args[p1Index + 1] : undefined;
      const p2Arg = p2Index !== -1 ? args[p2Index + 1] : undefined;
      const p1Type = p1Arg ? parseBotType(p1Arg) : 'random';
      const p2Type = p2Arg ? parseBotType(p2Arg) : 'random';

      // Parse turn limit: --turns 100
      const turnsIndex = args.indexOf('--turns');
      const maxTurns = turnsIndex !== -1 ? parseInt(args[turnsIndex + 1] || '100', 10) : 100;

      // Parse seed: --seed <number> (defaults to timestamp for reproducibility)
      const seedIndex = args.indexOf('--seed');
      const baseSeed = seedIndex !== -1 ? parseInt(args[seedIndex + 1]!, 10) : Date.now();

      // Parse additional export options (CSV, custom path)
      const exportCsv = args.includes('--export-csv');
      const exportPathIndex = args.indexOf('--export-path');
      const exportPath = exportPathIndex !== -1 ? args[exportPathIndex + 1] : undefined;

      // Parse profiling option
      const profile = args.includes('--profile-detailed')
        ? 'detailed'
        : args.includes('--profile')
          ? true
          : false;

      // Parallel execution (default for gameCount > 1, disable with --serial)
      const serial = args.includes('--serial');
      const parallel = !serial && gameCount > 1;

      // Only show header if not quiet
      if (outputLevel > OutputLevel.QUIET) {
        console.log('🎮 ManaCore - Game Simulator\n');
        console.log(`🎲 Base Seed: ${baseSeed}\n`);
      }

      const debugMode = args.includes('--debug') || args.includes('-d');
      const playerBot = createBot(p1Type, 42, debugMode);
      const opponentBot = createBot(p2Type, 43, debugMode);

      const { results, logPath } = await runSimulation(playerBot, opponentBot, {
        gameCount,
        maxTurns,
        verbose: outputLevel === OutputLevel.VERBOSE,
        seed: baseSeed,
        exportJson: autoExport,
        exportCsv,
        exportPath,
        profile,
        outputLevel,
        autoExport,
        botTypes: { p1: p1Type, p2: p2Type },
        parallel,
      });

      // Determine export formats
      const formats: ExportFormat[] = ['console'];
      if (autoExport) formats.push('json');
      if (exportCsv) formats.push('csv');

      // Export results
      await exportResults(
        results,
        playerBot.getName(),
        opponentBot.getName(),
        {
          formats,
          outputPath: exportPath,
          pretty: true,
        },
        logPath,
      );
      break;
    }

    case 'replay': {
      // Replay a specific failed game by seed
      const gameSeed = parseInt(args[1]!, 10);
      if (isNaN(gameSeed)) {
        console.error('❌ Error: Please provide a valid seed number');
        console.log('\nUsage: bun src/index.ts replay <seed>');
        console.log('Example: bun src/index.ts replay 12383');
        break;
      }

      // Parse output level
      let outputLevel: OutputLevel;
      if (args.includes('--quiet') || args.includes('-q')) {
        outputLevel = OutputLevel.QUIET;
      } else if (args.includes('--verbose') || args.includes('-v')) {
        outputLevel = OutputLevel.VERBOSE;
      } else {
        outputLevel = OutputLevel.NORMAL; // Replay defaults to NORMAL
      }

      const debugMode = args.includes('--debug') || args.includes('-d');

      console.log('🔄 ManaCore - Game Replay\n');
      console.log(`Replaying game with seed: ${gameSeed}\n`);

      const greedyBot = new GreedyBot(42, debugMode);
      const randomBot = new RandomBot(43);

      const { results, logPath } = await runSimulation(greedyBot, randomBot, {
        gameCount: 1,
        maxTurns: 100,
        verbose: outputLevel === OutputLevel.VERBOSE,
        debugVerbose: outputLevel === OutputLevel.VERBOSE,
        seed: gameSeed,
        outputLevel,
        autoExport: true,
      });

      if (results.errors > 0) {
        console.log('\n❌ Game failed with error (see details above)');
      } else {
        console.log('\n✅ Game completed successfully');
        await printResults(results, greedyBot.getName(), randomBot.getName(), outputLevel, logPath);
      }
      break;
    }

    case 'benchmark':
    case 'bench': {
      // Quick benchmark: GreedyBot vs RandomBot
      const gameCount = parseInt(args[1] || '10', 10);

      // Parse output level (new Phase 2.5 flags)
      let outputLevel: OutputLevel;
      if (args.includes('--quiet') || args.includes('-q')) {
        outputLevel = OutputLevel.QUIET;
      } else if (args.includes('--minimal') || args.includes('-m')) {
        outputLevel = OutputLevel.MINIMAL;
      } else if (args.includes('--normal') || args.includes('-n')) {
        outputLevel = OutputLevel.NORMAL;
      } else if (args.includes('--verbose') || args.includes('-v')) {
        outputLevel = OutputLevel.VERBOSE;
      } else {
        // Auto-determine: minimal for large runs, normal otherwise
        outputLevel = gameCount > 50 ? OutputLevel.MINIMAL : OutputLevel.NORMAL;
      }

      const debugMode = args.includes('--debug') || args.includes('-d');
      const debugVerbose = args.includes('--debug-verbose') || args.includes('-dv');

      // Phase 2.5: Always auto-export JSON (unless explicitly disabled)
      const noAutoExport = args.includes('--no-auto-export');
      const autoExport = !noAutoExport;

      // Parse turn limit: --turns 100
      const turnsIndex = args.indexOf('--turns');
      const maxTurns = turnsIndex !== -1 ? parseInt(args[turnsIndex + 1] || '100', 10) : 100;

      // Parse seed: --seed <number> (defaults to timestamp for reproducibility)
      const seedIndex = args.indexOf('--seed');
      const baseSeed = seedIndex !== -1 ? parseInt(args[seedIndex + 1]!, 10) : Date.now();

      // Parse additional export options (CSV, custom path)
      const exportCsv = args.includes('--export-csv');
      const exportPathIndex = args.indexOf('--export-path');
      const exportPath = exportPathIndex !== -1 ? args[exportPathIndex + 1] : undefined;

      // Parse profiling option
      const profile = args.includes('--profile-detailed')
        ? 'detailed'
        : args.includes('--profile')
          ? true
          : false;

      // Only show header if not quiet
      if (outputLevel > OutputLevel.QUIET) {
        console.log('🏆 ManaCore - Bot Benchmark\n');
        console.log(`Running ${gameCount} games: GreedyBot vs RandomBot`);
        console.log(`🎲 Base Seed: ${baseSeed}`);
        if (debugMode) console.log('Debug mode enabled');
        if (debugVerbose) console.log('Verbose debug mode enabled');
        if (profile) console.log(`Profiling enabled${profile === 'detailed' ? ' (detailed)' : ''}`);
        console.log('');
      }

      const greedyBot = new GreedyBot(42, debugMode);
      const randomBot = new RandomBot(43);

      const startTime = Date.now();

      const { results, logPath } = await runSimulation(greedyBot, randomBot, {
        gameCount,
        maxTurns,
        verbose: outputLevel === OutputLevel.VERBOSE,
        debugVerbose,
        seed: baseSeed,
        exportJson: autoExport,
        exportCsv,
        exportPath,
        profile,
        outputLevel,
        autoExport,
      });

      const elapsed = (Date.now() - startTime) / 1000;

      // Determine export formats
      const formats: ExportFormat[] = ['console'];
      if (autoExport) formats.push('json');
      if (exportCsv) formats.push('csv');

      // Export results
      await exportResults(
        results,
        greedyBot.getName(),
        randomBot.getName(),
        {
          formats,
          outputPath: exportPath,
          pretty: true,
        },
        logPath,
      );

      // Only show stats if not quiet
      if (outputLevel > OutputLevel.QUIET) {
        const winRate = (results.playerWins / results.gamesCompleted) * 100;
        const stats = greedyBot.getStats();
        console.log(`\n📊 GreedyBot Win Rate: ${winRate.toFixed(1)}%`);
        console.log(
          `⏱️  Total time: ${elapsed.toFixed(1)}s (${(elapsed / gameCount).toFixed(2)}s/game)`,
        );
        console.log(
          `🧠 Decisions: ${stats.decisions} | Actions evaluated: ${stats.actionsEvaluated} | Avg: ${stats.avgActions.toFixed(1)}/decision`,
        );
      }
      break;
    }

    case 'tune': {
      // Parse tune options
      const methodArg = args.find((a, i) => args[i - 1] === '--method');
      const method = methodArg === 'evolve' ? 'evolve' : 'local';

      const gamesRandomArg = args.find((a, i) => args[i - 1] === '--games-random');
      const gamesVsRandom = gamesRandomArg ? parseInt(gamesRandomArg, 10) : 30;

      const gamesGreedyArg = args.find((a, i) => args[i - 1] === '--games-greedy');
      const gamesVsGreedy = gamesGreedyArg ? parseInt(gamesGreedyArg, 10) : 20;

      const gensArg = args.find((a, i) => args[i - 1] === '--generations');
      const generations = gensArg ? parseInt(gensArg, 10) : 15;

      const popArg = args.find((a, i) => args[i - 1] === '--population');
      const populationSize = popArg ? parseInt(popArg, 10) : 10;

      const seedArg = args.find((a, i) => args[i - 1] === '--seed');
      const seed = seedArg ? parseInt(seedArg, 10) : Date.now();

      const verbose = args.includes('--verbose') || args.includes('-v');

      await runTune({
        method,
        gamesVsRandom,
        gamesVsGreedy,
        generations,
        populationSize,
        seed,
        verbose,
      });
      break;
    }

    case 'benchmark-suite':
    case 'suite': {
      // Parse benchmark suite options
      const options = parseBenchmarkSuiteArgs(args);
      await runBenchmarkSuite(options);
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
      console.log('  benchmark-suite         Run bot comparison matrix (Phase 2.5)');
      console.log('  suite                   Alias for benchmark-suite');
      console.log('  replay <seed>           Replay a specific game by seed (for debugging)');
      console.log('  tune                    Run weight tuning optimization (Phase 2.3)');
      console.log('  help                    Show this help message');
      console.log('');
      console.log('Options:');
      console.log(
        '  --seed <n>              Set base seed for reproducibility (default: timestamp)',
      );
      console.log('  --p1 <bot>              Player 1 bot type (see Bot Types below)');
      console.log('  --p2 <bot>              Player 2 bot type (see Bot Types below)');
      console.log('  --turns <n>             Maximum turns per game (default: 100)');
      console.log('');
      console.log('Bot Types:');
      console.log('  random, r               RandomBot - picks random legal actions');
      console.log('  greedy, g               GreedyBot - 1-ply lookahead');
      console.log('');
      console.log('  MCTS with Random Rollouts (original):');
      console.log('  mcts, m                 MCTSBot - 200 iterations');
      console.log('  mcts-fast, mf           MCTSBot - 50 iterations');
      console.log('  mcts-strong, ms         MCTSBot - 500 iterations');
      console.log('');
      console.log('  MCTS with Greedy Rollouts:');
      console.log('  mcts-greedy, mg         MCTSBot - 100 iter, greedy rollout');
      console.log('  mcts-greedy-fast, mgf   MCTSBot - 25 iter, greedy rollout');
      console.log('  mcts-epsilon, me        MCTSBot - 100 iter, 90% greedy + 10% random');
      console.log('');
      console.log('  MCTS No-Rollout (FASTEST - uses evaluation function):');
      console.log('  mcts-eval, mev          MCTSBot - 200 iter, no rollout');
      console.log('  mcts-eval-fast, mevf    MCTSBot - 50 iter, no rollout');
      console.log('  mcts-eval-strong, mevs  MCTSBot - 500 iter, no rollout');
      console.log('  mcts-eval-turbo, mevt   MCTSBot - 1000 iter, no rollout (RECOMMENDED)');
      console.log('');
      console.log('Output Verbosity (Phase 2.5 - NEW):');
      console.log('  --quiet, -q             Suppress all output (silent mode)');
      console.log('  --minimal, -m           Show only summary and file locations');
      console.log(
        '  --normal, -n            Show summary with top statistics (auto for <50 games)',
      );
      console.log('  --verbose, -v           Show detailed statistics and breakdowns (legacy)');
      console.log('  [auto]                  Auto-select: minimal for >50 games, normal otherwise');
      console.log('');
      console.log('Export Options (Phase 2):');
      console.log('  --export-json           Export results as JSON (auto-enabled by default)');
      console.log('  --export-csv            Export results as CSV');
      console.log('  --export-path <path>    Specify custom output path (default: results/)');
      console.log('  --no-auto-export        Disable automatic JSON export');
      console.log('  --profile               Enable basic performance profiling');
      console.log('  --profile-detailed      Enable detailed performance profiling');
      console.log('  --serial                Run games sequentially (disable parallel execution)');
      console.log('');
      console.log('Debug Options:');
      console.log('  --debug, -d             Enable debug mode for bots');
      console.log('  --debug-verbose, -dv    Show detailed progress for each game/turn');
      console.log('');
      console.log('Examples:');
      console.log('  bun src/index.ts play');
      console.log('  bun src/index.ts simulate 100');
      console.log('  bun src/index.ts sim 10 --p1 greedy --p2 random --seed 42');
      console.log('  bun src/index.ts benchmark 100 --seed 12345');
      console.log('  bun src/index.ts benchmark 100 --quiet       # Silent mode');
      console.log('  bun src/index.ts benchmark 100 --minimal     # Summary only');
      console.log('  bun src/index.ts benchmark 1000 --profile');
      console.log('  bun src/index.ts replay 12383 --verbose      # Replay failed game');
      console.log('');
      console.log('Weight Tuning (Phase 2.3):');
      console.log('  tune                    Run weight optimization');
      console.log('  --method <local|evolve> Optimization method (default: local)');
      console.log('  --generations <n>       Number of generations (default: 15)');
      console.log('  --population <n>        Population size for evolve (default: 10)');
      console.log('  --games-random <n>      Games vs RandomBot per eval (default: 30)');
      console.log('  --games-greedy <n>      Games vs GreedyBot per eval (default: 20)');
      console.log('');
      console.log('Tuning Examples:');
      console.log('  bun src/index.ts tune                        # Quick local search');
      console.log('  bun src/index.ts tune --method evolve        # Evolutionary search');
      console.log('  bun src/index.ts tune --generations 30       # More iterations');
      console.log('');
      console.log('Benchmark Suite (Phase 2.5):');
      console.log('  suite                   Run bot comparison matrix');
      console.log('  --preset <name>         Preset: quick, standard, comprehensive');
      console.log('  --bots <list>           Comma-separated bot types (overrides preset)');
      console.log('  --games <n>             Games per matchup (default: 50 for quick)');
      console.log('  --seed <n>              Random seed for reproducibility');
      console.log('  --elo                   Include Elo ratings in results');
      console.log('  --export-markdown       Export results as Markdown report');
      console.log('  --no-export             Disable JSON export');
      console.log('');
      console.log('Suite Examples:');
      console.log('  bun src/index.ts suite                       # Quick preset (4 bots)');
      console.log('  bun src/index.ts suite --preset standard     # 6 bots, 100 games each');
      console.log('  bun src/index.ts suite --bots random,greedy,mcts-eval --games 200 --elo');
      console.log('  bun src/index.ts suite --preset quick --export-markdown');
      break;
  }
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
