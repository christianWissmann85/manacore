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
import { runTuneMCTS, parseTuneMCTSArgs } from './commands/tune-mcts';
import { runBenchmarkSuite, parseBenchmarkSuiteArgs } from './commands/benchmarkSuite';
import { runPipeline, parsePipelineArgs } from './commands/pipeline';
import { runReplayCommand, parseReplayArgs } from './commands/replay';
import { runCollectTraining, parseCollectTrainingArgs } from './commands/collect-training';
import { loadConfig, runExperiment } from './config';
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

    // NEW: Configuration-based experiment runner
    case 'run': {
      const configPath = args[1];
      if (!configPath) {
        console.error('❌ Error: Please specify a config file');
        console.error('   Usage: bun cli run experiments/my-experiment.json');
        console.error('');
        console.error('   Available experiments in experiments/:');
        try {
          const { readdirSync } = await import('fs');
          const { resolve } = await import('path');
          const expDir = resolve(process.cwd(), '..', '..', 'experiments');
          const files = readdirSync(expDir).filter((f: string) => f.endsWith('.json'));
          files.forEach((f: string) => console.error(`     - experiments/${f}`));
        } catch {
          console.error('     (run from packages/cli-client)');
        }
        process.exit(1);
      }
      try {
        const config = loadConfig(configPath);
        await runExperiment(config);
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
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

    case 'replay':
    case 'replay-file': {
      const arg1 = args[1];

      // Check if it's a file path (contains . or /) or a seed number
      const isFilePath = arg1 && (arg1.includes('.') || arg1.includes('/'));

      if (isFilePath) {
        // New replay file mode
        try {
          const replayOptions = parseReplayArgs(args.slice(1));
          await runReplayCommand(replayOptions);
        } catch (e) {
          console.error(`❌ Error: ${e}`);
          console.log('\nUsage: bun src/index.ts replay <file.replay.json> [options]');
          console.log('Options:');
          console.log('  --turn <n>     Stop at specific turn');
          console.log('  --action <n>   Stop at specific action');
          console.log('  --watch, -w    Watch mode (show game progressing)');
          console.log('  --delay <ms>   Delay between actions in watch mode (default: 500)');
          console.log('  --verify       Verify replay integrity');
          console.log('  --summary, -s  Show summary only');
          console.log('  --verbose, -v  Verbose output');
        }
        break;
      }

      // Legacy: Replay by seed (re-run simulation with specific seed)
      const gameSeed = parseInt(arg1!, 10);
      if (isNaN(gameSeed)) {
        console.error('❌ Error: Please provide a valid seed number or replay file path');
        console.log('\nUsage:');
        console.log('  bun src/index.ts replay <seed>              # Re-run game with seed');
        console.log('  bun src/index.ts replay <file.replay.json>  # Play back recorded game');
        console.log('\nExamples:');
        console.log('  bun src/index.ts replay 12383');
        console.log('  bun src/index.ts replay results/replays/game-42-player.replay.json');
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

      console.log('🔄 ManaCore - Game Replay (by seed)\n');
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

    case 'tune-mcts':
    case 'mcts-tune': {
      // Parse MCTS tuning options
      const mctsOptions = parseTuneMCTSArgs(args.slice(1));
      await runTuneMCTS(mctsOptions);
      break;
    }

    case 'benchmark-suite':
    case 'suite': {
      // Parse benchmark suite options
      const options = parseBenchmarkSuiteArgs(args);
      await runBenchmarkSuite(options);
      break;
    }

    case 'pipeline': {
      // Parse pipeline options
      const pipelineOptions = parsePipelineArgs(args.slice(1));
      await runPipeline(pipelineOptions);
      break;
    }

    case 'collect-training':
    case 'collect': {
      // Parse collect-training options
      const collectOptions = parseCollectTrainingArgs(args.slice(1));
      await runCollectTraining(collectOptions);
      break;
    }

    case 'help':
    default:
      console.log('🔬 ManaCore Research CLI\n');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('  RECOMMENDED: Use JSON config files for reproducible research');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('');
      console.log('Config-Based Commands (NEW):');
      console.log('  run <config.json>       Run experiment from config file');
      console.log('');
      console.log('  Examples:');
      console.log('    bun cli run experiments/simulate-mcts-vs-greedy.json');
      console.log('    bun cli run experiments/benchmark-all-bots.json');
      console.log('    bun cli run experiments/collect-training-fast.json');
      console.log('    bun cli run experiments/pipeline-full.json');
      console.log('');
      console.log('  Available experiment templates in experiments/:');
      console.log('    simulate-mcts-vs-greedy.json  - Bot vs bot simulations');
      console.log('    benchmark-all-bots.json       - Full bot comparison matrix');
      console.log('    tune-weights-evolve.json      - Evaluation weight tuning');
      console.log('    tune-mcts-grid.json           - MCTS hyperparameter search');
      console.log('    pipeline-full.json            - Complete tuning workflow');
      console.log('    collect-training-fast.json    - ML training data (fast)');
      console.log('    collect-training-mcts.json    - ML training data (quality)');
      console.log('');
      console.log('───────────────────────────────────────────────────────────────');
      console.log('');
      console.log('Legacy Commands (still supported):');
      console.log('  play                    Start interactive debug session (Human vs Agent)');
      console.log('  simulate [count]        Run batch agent simulations (default: 100)');
      console.log('  sim [count]             Alias for simulate');
      console.log('  benchmark [count]       Run GreedyBot vs RandomBot benchmark (default: 10)');
      console.log('  bench [count]           Alias for benchmark');
      console.log('  benchmark-suite         Run bot comparison matrix (Phase 2.5)');
      console.log('  suite                   Alias for benchmark-suite');
      console.log('  replay <seed>           Replay a specific game by seed (re-run simulation)');
      console.log('  replay <file.json>      Play back a recorded game from replay file');
      console.log('  tune                    Run weight tuning optimization (Phase 2.3)');
      console.log('  tune-mcts               Tune MCTS hyperparameters (Phase 3.0)');
      console.log('  pipeline                Complete tuning pipeline (Phase 3.0)');
      console.log('  collect-training        Collect ML training data (Phase 3.0)');
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
      console.log('  bun src/index.ts replay 12383 --verbose      # Re-run game with seed');
      console.log('');
      console.log('Replay Files (Phase 2.6):');
      console.log(
        '  bun src/index.ts replay game.replay.json              # Play back recorded game',
      );
      console.log(
        '  bun src/index.ts replay game.replay.json --watch      # Watch mode (animated)',
      );
      console.log('  bun src/index.ts replay game.replay.json --turn 5     # Stop at turn 5');
      console.log(
        '  bun src/index.ts replay game.replay.json --verify     # Verify replay integrity',
      );
      console.log('  bun src/index.ts replay game.replay.json --summary    # Show summary only');
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
      console.log('MCTS Hyperparameter Tuning (Phase 3.0):');
      console.log('  tune-mcts               Tune MCTS parameters (C, depth, policy)');
      console.log('  --method <type>         grid or coarse-to-fine (default: coarse-to-fine)');
      console.log('  --games <n>             Games per config (default: 50)');
      console.log('  --validation <n>        Validation games (default: 200)');
      console.log('  --iterations <n>        MCTS iterations during tuning (default: 50)');
      console.log('  --save                  Save results to weights.json');
      console.log('');
      console.log('MCTS Tuning Examples:');
      console.log('  bun src/index.ts tune-mcts                   # Coarse-to-fine search');
      console.log('  bun src/index.ts tune-mcts --method grid     # Full grid search');
      console.log('  bun src/index.ts tune-mcts --games 100 --save  # Save results');
      console.log('');
      console.log('Full Tuning Pipeline (Phase 3.0):');
      console.log('  pipeline                Complete tuning workflow');
      console.log('  --seed <n>              Random seed for reproducibility');
      console.log('  --weight-method <type>  local or evolve (default: local)');
      console.log('  --mcts-method <type>    grid or coarse-to-fine (default: coarse-to-fine)');
      console.log('  --generations <n>       Weight tuning generations (default: 10)');
      console.log('  --games <n>             Games per evaluation (default: 30)');
      console.log('  --validation <n>        Validation games (default: 200)');
      console.log('  --acceptance <level>    relaxed, default, or strict');
      console.log('  --skip-weights          Skip weight tuning stage');
      console.log('  --skip-mcts             Skip MCTS tuning stage');
      console.log('  --weights-only          Alias for --skip-mcts');
      console.log('  --mcts-only             Alias for --skip-weights');
      console.log('  --dry-run               Show what would happen without saving');
      console.log('  --force                 Persist even if validation fails');
      console.log('');
      console.log('Pipeline Examples:');
      console.log('  bun src/index.ts pipeline                    # Full pipeline');
      console.log('  bun src/index.ts pipeline --dry-run          # Preview mode');
      console.log('  bun src/index.ts pipeline --mcts-only        # Just MCTS tuning');
      console.log('  bun src/index.ts pipeline --weights-only     # Just weight tuning');
      console.log('');
      console.log('Training Data Collection (Phase 3.0):');
      console.log('  collect-training        Collect ML training data with curriculum');
      console.log('  collect                 Alias for collect-training');
      console.log('  --games <n>             Total games to collect (default: 500)');
      console.log('  --output <dir>          Output directory (default: training-data)');
      console.log('  --seed <n>              Base seed for reproducibility');
      console.log('  --iterations <n>        MCTS iterations (default: 100)');
      console.log('  --phase <name>          Single phase only: easy, medium, hard');
      console.log('  --no-json               Skip JSON export');
      console.log('  --no-binary             Skip binary export');
      console.log('');
      console.log('  Curriculum Phases:');
      console.log('    easy   - MCTSBot vs RandomBot (20% of games)');
      console.log('    medium - MCTSBot vs GreedyBot (30% of games)');
      console.log('    hard   - MCTSBot vs MCTSBot (50% of games)');
      console.log('');
      console.log('Collection Examples:');
      console.log('  bun src/index.ts collect --games 1000         # Full curriculum');
      console.log('  bun src/index.ts collect --phase hard         # Self-play only');
      console.log('  bun src/index.ts collect --iterations 200     # Higher quality');
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
