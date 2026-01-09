#!/usr/bin/env bun
/**
 * Batch Training Data Generation Script
 *
 * Generates large-scale training datasets (10K+ games) with:
 * - Progress tracking and ETA
 * - Resume capability from interruption
 * - Multiple export formats (JSON, JSONL, NPZ-ready)
 * - Quality metrics logging
 *
 * Usage:
 *   bun scripts/generate-batch-data.ts --games 10000 --output ./output/training-data/batch-10k
 *   bun scripts/generate-batch-data.ts --resume ./output/training-data/batch-10k
 */

import { RandomBot, GreedyBot, MCTSBot, type Bot } from '@manacore/ai';
import {
  TrainingDataCollector,
  saveMultipleAsJSONL,
  exportForNumPy,
  type GameTrainingData,
} from '@manacore/ai';
import {
  initializeGame,
  applyAction,
  getLegalActions,
  getRandomTestDeck,
  type GameState,
} from '@manacore/engine';
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

interface BatchConfig {
  games: number;
  p1Type: string;
  p2Type: string;
  maxTurns: number;
  seed: number;
  outputDir: string;
  exportJsonl: boolean;
  exportTensors: boolean;
  saveInterval: number; // Save progress every N games
}

interface BatchProgress {
  config: BatchConfig;
  completedGames: number;
  startTime: number;
  lastSaveTime: number;
  stats: {
    p1Wins: number;
    p2Wins: number;
    draws: number;
    errors: number;
    totalSamples: number;
    totalTurns: number;
    avgSamplesPerGame: number;
    avgTurnsPerGame: number;
    gamesPerHour: number;
  };
}

const DEFAULT_CONFIG: BatchConfig = {
  games: 1000,
  p1Type: 'mcts-eval',
  p2Type: 'greedy',
  maxTurns: 100,
  seed: Date.now(),
  outputDir: './output/training-data/batch',
  exportJsonl: true,
  exportTensors: true,
  saveInterval: 100,
};

function createBot(type: string, seed: number): Bot {
  switch (type.toLowerCase()) {
    case 'random':
      return new RandomBot(seed);
    case 'greedy':
      return new GreedyBot(seed);
    case 'mcts':
    case 'mcts-eval':
      return new MCTSBot({
        seed,
        iterations: 200,
        explorationConstant: 1.41,
        useEvaluation: true,
        maxRolloutDepth: 0,
      });
    case 'mcts-fast':
    case 'mcts-eval-fast':
      return new MCTSBot({
        seed,
        iterations: 50,
        explorationConstant: 1.41,
        useEvaluation: true,
        maxRolloutDepth: 0,
      });
    case 'mcts-strong':
    case 'mcts-eval-strong':
      return new MCTSBot({
        seed,
        iterations: 500,
        explorationConstant: 1.41,
        useEvaluation: true,
        maxRolloutDepth: 0,
      });
    default:
      console.warn(`Unknown bot type: ${type}, defaulting to greedy`);
      return new GreedyBot(seed);
  }
}

function playGame(
  p1: Bot,
  p2: Bot,
  collector: TrainingDataCollector,
  maxTurns: number,
  seed: number,
): {
  winner: 'player' | 'opponent' | 'draw';
  turns: number;
  samples: number;
  finalState: GameState;
} {
  let state = initializeGame(getRandomTestDeck(), getRandomTestDeck(), seed);

  let turns = 0;
  const initialSamples = collector.getSampleCount();

  while (!state.gameOver && turns < maxTurns) {
    const currentBot = state.priorityPlayer === 'player' ? p1 : p2;
    const action = currentBot.chooseAction(state, state.priorityPlayer);

    // Record the decision (pass the action object, not the index)
    const legalActions = getLegalActions(state, state.priorityPlayer);
    collector.recordDecision(state, action, legalActions);

    state = applyAction(state, action);

    if (state.priorityPlayer === 'player' && state.phase === 'untap') {
      turns++;
    }
  }

  const samples = collector.getSampleCount() - initialSamples;
  const winner = state.gameOver ? (state.winner === 'player' ? 'player' : 'opponent') : 'draw';

  return { winner, turns, samples, finalState: state };
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function formatETA(gamesRemaining: number, gamesPerHour: number): string {
  if (gamesPerHour <= 0) return 'calculating...';
  const hoursRemaining = gamesRemaining / gamesPerHour;
  const msRemaining = hoursRemaining * 60 * 60 * 1000;
  return formatDuration(msRemaining);
}

async function runBatch(config: BatchConfig, resume?: BatchProgress): Promise<void> {
  // Setup output directory
  const outputDir = resolve(config.outputDir);
  const gamesDir = join(outputDir, 'games');
  mkdirSync(gamesDir, { recursive: true });

  // Initialize or restore progress
  let progress: BatchProgress = resume || {
    config,
    completedGames: 0,
    startTime: Date.now(),
    lastSaveTime: Date.now(),
    stats: {
      p1Wins: 0,
      p2Wins: 0,
      draws: 0,
      errors: 0,
      totalSamples: 0,
      totalTurns: 0,
      avgSamplesPerGame: 0,
      avgTurnsPerGame: 0,
      gamesPerHour: 0,
    },
  };

  const progressFile = join(outputDir, 'progress.json');

  // Load existing games if resuming
  const allGames: GameTrainingData[] = [];
  if (resume) {
    console.log(`\nResuming from ${progress.completedGames} completed games...\n`);
    const existingFiles = readdirSync(gamesDir).filter((f) => f.endsWith('.json'));
    for (const file of existingFiles) {
      try {
        const data = JSON.parse(readFileSync(join(gamesDir, file), 'utf-8'));
        allGames.push(data);
      } catch {
        // Skip corrupted files
      }
    }
  }

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          ManaCore Batch Training Data Generator                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Target:      ${config.games} games`);
  console.log(`Matchup:     ${config.p1Type} vs ${config.p2Type}`);
  console.log(`Max Turns:   ${config.maxTurns}`);
  console.log(`Base Seed:   ${config.seed}`);
  console.log(`Output:      ${outputDir}`);
  console.log('');

  const startTime = Date.now();

  // Generate games
  for (let i = progress.completedGames; i < config.games; i++) {
    const gameSeed = config.seed + i;
    const p1 = createBot(config.p1Type, gameSeed);
    const p2 = createBot(config.p2Type, gameSeed + 1000000);

    const collector = new TrainingDataCollector(gameSeed, config.p1Type, config.p2Type, {
      recordPlayer: 'both', // Record both players' decisions
      skipPassPriority: true,
      maxSamplesPerGame: 200,
    });

    try {
      const result = playGame(p1, p2, collector, config.maxTurns, gameSeed);

      // Finalize game data using the final state
      const gameData = collector.finalize(result.finalState, 'player');
      allGames.push(gameData);

      // Save individual game file
      writeFileSync(join(gamesDir, `game-${gameSeed}.json`), JSON.stringify(gameData), 'utf-8');

      // Update stats
      if (result.winner === 'player') progress.stats.p1Wins++;
      else if (result.winner === 'opponent') progress.stats.p2Wins++;
      else progress.stats.draws++;

      progress.stats.totalSamples += result.samples;
      progress.stats.totalTurns += result.turns;
      progress.completedGames++;

      // Calculate rates
      const elapsed = Date.now() - startTime;
      const gamesThisSession = progress.completedGames - (resume?.completedGames || 0);
      progress.stats.gamesPerHour = (gamesThisSession / elapsed) * 3600000;
      progress.stats.avgSamplesPerGame = progress.stats.totalSamples / progress.completedGames;
      progress.stats.avgTurnsPerGame = progress.stats.totalTurns / progress.completedGames;

      // Progress output
      if ((i + 1) % 10 === 0 || i === config.games - 1) {
        const pct = ((progress.completedGames / config.games) * 100).toFixed(1);
        const eta = formatETA(config.games - progress.completedGames, progress.stats.gamesPerHour);
        const winRate = ((progress.stats.p1Wins / progress.completedGames) * 100).toFixed(1);

        process.stdout.write(
          `\r[${pct}%] ${progress.completedGames}/${config.games} games | ` +
            `${progress.stats.gamesPerHour.toFixed(0)} games/hr | ` +
            `ETA: ${eta} | ` +
            `P1 Win: ${winRate}% | ` +
            `Samples: ${progress.stats.totalSamples}`,
        );
      }

      // Save checkpoint
      if (progress.completedGames % config.saveInterval === 0) {
        progress.lastSaveTime = Date.now();
        writeFileSync(progressFile, JSON.stringify(progress, null, 2), 'utf-8');
      }
    } catch (error) {
      progress.stats.errors++;
      console.error(`\nError in game ${i}: ${error}`);
    }
  }

  console.log('\n');

  // Final export
  console.log('Exporting final datasets...');

  if (config.exportJsonl) {
    const jsonlPath = join(outputDir, 'training-data.jsonl');
    saveMultipleAsJSONL(allGames, jsonlPath);
    console.log(`  JSONL: ${jsonlPath}`);
  }

  if (config.exportTensors) {
    const tensorPath = join(outputDir, 'training-data.tensors.json');
    exportForNumPy(allGames, tensorPath);
    console.log(`  Tensors: ${tensorPath}`);
    console.log('  Convert to NPZ: python scripts/convert-training-data.py ' + tensorPath);
  }

  // Final stats
  const totalElapsed = Date.now() - progress.startTime;
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('BATCH COMPLETE');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`Total Games:     ${progress.completedGames}`);
  console.log(`Total Samples:   ${progress.stats.totalSamples}`);
  console.log(`Total Time:      ${formatDuration(totalElapsed)}`);
  console.log(`Games/Hour:      ${progress.stats.gamesPerHour.toFixed(0)}`);
  console.log('');
  console.log(
    `P1 (${config.p1Type}) Wins:  ${progress.stats.p1Wins} (${((progress.stats.p1Wins / progress.completedGames) * 100).toFixed(1)}%)`,
  );
  console.log(
    `P2 (${config.p2Type}) Wins:  ${progress.stats.p2Wins} (${((progress.stats.p2Wins / progress.completedGames) * 100).toFixed(1)}%)`,
  );
  console.log(`Draws:           ${progress.stats.draws}`);
  console.log(`Errors:          ${progress.stats.errors}`);
  console.log('');
  console.log(`Avg Samples/Game: ${progress.stats.avgSamplesPerGame.toFixed(1)}`);
  console.log(`Avg Turns/Game:   ${progress.stats.avgTurnsPerGame.toFixed(1)}`);
  console.log('════════════════════════════════════════════════════════════════');

  // Save final progress
  writeFileSync(progressFile, JSON.stringify(progress, null, 2), 'utf-8');
}

// Parse command line arguments
function parseArgs(): { config: BatchConfig; resume?: BatchProgress } {
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };
  let resume: BatchProgress | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--games':
      case '-g':
        config.games = parseInt(next!, 10);
        i++;
        break;
      case '--p1':
        config.p1Type = next!;
        i++;
        break;
      case '--p2':
        config.p2Type = next!;
        i++;
        break;
      case '--output':
      case '-o':
        config.outputDir = next!;
        i++;
        break;
      case '--seed':
      case '-s':
        config.seed = parseInt(next!, 10);
        i++;
        break;
      case '--max-turns':
        config.maxTurns = parseInt(next!, 10);
        i++;
        break;
      case '--save-interval':
        config.saveInterval = parseInt(next!, 10);
        i++;
        break;
      case '--no-jsonl':
        config.exportJsonl = false;
        break;
      case '--no-tensors':
        config.exportTensors = false;
        break;
      case '--resume':
      case '-r':
        const resumeDir = next!;
        const progressFile = join(resumeDir, 'progress.json');
        if (existsSync(progressFile)) {
          resume = JSON.parse(readFileSync(progressFile, 'utf-8'));
          Object.assign(config, resume!.config);
        } else {
          console.error(`Progress file not found: ${progressFile}`);
          process.exit(1);
        }
        i++;
        break;
      case '--help':
      case '-h':
        console.log(`
ManaCore Batch Training Data Generator

Usage:
  bun scripts/generate-batch-data.ts [options]

Options:
  --games, -g <n>      Number of games to generate (default: 1000)
  --p1 <type>          Player 1 bot type (default: mcts-eval)
  --p2 <type>          Player 2 bot type (default: greedy)
  --output, -o <dir>   Output directory (default: ./output/training-data/batch)
  --seed, -s <n>       Base random seed (default: timestamp)
  --max-turns <n>      Max turns per game (default: 100)
  --save-interval <n>  Save progress every N games (default: 100)
  --no-jsonl           Skip JSONL export
  --no-tensors         Skip tensor export
  --resume, -r <dir>   Resume from previous run
  --help, -h           Show this help

Bot Types:
  random               Random legal actions
  greedy               1-ply lookahead heuristic
  mcts, mcts-eval      MCTS with evaluation (200 iterations)
  mcts-fast            MCTS fast (50 iterations)
  mcts-strong          MCTS strong (500 iterations)

Examples:
  # Generate 10K games
  bun scripts/generate-batch-data.ts --games 10000 -o ./output/mcts-vs-greedy-10k

  # Resume interrupted batch
  bun scripts/generate-batch-data.ts --resume ./output/mcts-vs-greedy-10k

  # Different matchup
  bun scripts/generate-batch-data.ts --games 5000 --p1 mcts-strong --p2 mcts-fast
`);
        process.exit(0);
    }
  }

  return { config, resume };
}

// Main
const { config, resume } = parseArgs();
runBatch(config, resume).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
