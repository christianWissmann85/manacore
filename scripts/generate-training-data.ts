#!/usr/bin/env bun
/**
 * Training Data Generation Pipeline
 *
 * Spawns Claude Code CLI processes to play MTG games via MCP Server,
 * generating training data with strategic reasoning.
 *
 * Usage:
 *   bun scripts/generate-training-data.ts --games 1000 --parallel 3
 *   bun scripts/generate-training-data.ts --games 15 --parallel 1  # Test run
 */

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { parseArgs } from 'util';

// ANSI color codes and cursor control
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

const cursor = {
  up: (n: number) => `\x1b[${n}A`,
  clearLine: '\x1b[2K',
  hide: '\x1b[?25l',
  show: '\x1b[?25h',
};

// Configuration
const DECKS = ['white', 'blue', 'black', 'red', 'green'] as const;
const OPPONENTS = ['random', 'greedy', 'mcts'] as const;
const MODELS = ['opus', 'sonnet', 'haiku'] as const;
type ModelType = (typeof MODELS)[number];

// Default mix ratios (opus:sonnet:haiku)
const DEFAULT_MIX_RATIO = { opus: 20, sonnet: 40, haiku: 40 };

const PROJECT_ROOT = join(dirname(import.meta.path), '..');
const DATA_DIR = join(PROJECT_ROOT, 'packages/ai/data/human-training');
const PROGRESS_FILE = join(DATA_DIR, 'batch-progress.json');
const PROMPT_TEMPLATE = readFileSync(join(PROJECT_ROOT, 'scripts/prompts/play-mtg-game.txt'), 'utf-8');

interface GameConfig {
  id: string;
  deck: string;
  opponent: string;
  model: ModelType;
  seed: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  file?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

interface BatchProgress {
  batchId: string;
  startedAt: string;
  config: {
    totalGames: number;
    parallelWorkers: number;
    matchups: string[];
  };
  stats: {
    completed: number;
    failed: number;
    pending: number;
    running: number;
  };
  games: Record<string, GameConfig>;
}

// Track running games for status display
const runningGames: Map<
  string,
  { game: GameConfig; startTime: number; turn: number; reasoning: string }
> = new Map();
let statusInterval: ReturnType<typeof setInterval> | null = null;
let batchStartTime: number = 0;
let completedDurations: number[] = [];
let lastStatusLines: number = 0; // Track how many lines the status block uses

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function formatTime(date: Date = new Date()): string {
  return date.toLocaleTimeString('en-US', { hour12: false });
}

function log(message: string, color: string = ''): void {
  const timestamp = `${colors.gray}[${formatTime()}]${colors.reset}`;
  console.log(`${timestamp} ${color}${message}${colors.reset}`);
}

function generateBatchId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const rand = Math.random().toString(36).slice(2, 8);
  return `batch-${date}-${rand}`;
}

function getModelBadge(model: ModelType): string {
  switch (model) {
    case 'opus':
      return `${colors.magenta}[OPUS]${colors.reset}`;
    case 'sonnet':
      return `${colors.blue}[SNNT]${colors.reset}`;
    case 'haiku':
      return `${colors.cyan}[HAIK]${colors.reset}`;
    default:
      return `[${model}]`;
  }
}

function selectModel(
  modelArg: string,
  mixRatio: { opus: number; sonnet: number; haiku: number },
  gameIndex: number,
  totalGames: number,
): ModelType {
  if (modelArg !== 'mix') {
    return modelArg as ModelType;
  }

  // Distribute models according to mix ratio
  const total = mixRatio.opus + mixRatio.sonnet + mixRatio.haiku;
  const opusThreshold = (mixRatio.opus / total) * totalGames;
  const sonnetThreshold = opusThreshold + (mixRatio.sonnet / total) * totalGames;

  if (gameIndex < opusThreshold) {
    return 'opus';
  } else if (gameIndex < sonnetThreshold) {
    return 'sonnet';
  } else {
    return 'haiku';
  }
}

function generateGameQueue(
  totalGames: number,
  modelArg: string,
  mixRatio: { opus: number; sonnet: number; haiku: number },
): GameConfig[] {
  const matchups: { deck: string; opponent: string }[] = [];
  for (const deck of DECKS) {
    for (const opponent of OPPONENTS) {
      matchups.push({ deck, opponent });
    }
  }

  const gamesPerMatchup = Math.ceil(totalGames / matchups.length);
  const games: GameConfig[] = [];
  const baseSeed = Date.now();

  for (let i = 0; i < matchups.length; i++) {
    const { deck, opponent } = matchups[i];
    for (let j = 0; j < gamesPerMatchup && games.length < totalGames; j++) {
      const seed = baseSeed + games.length;
      const model = selectModel(modelArg, mixRatio, games.length, totalGames);
      games.push({
        id: `game-${seed}`,
        deck,
        opponent,
        model,
        seed,
        status: 'pending',
      });
    }
  }

  // Shuffle to interleave matchups (and models in mix mode)
  for (let i = games.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [games[i], games[j]] = [games[j], games[i]];
  }

  return games;
}

function loadProgress(): BatchProgress | null {
  if (existsSync(PROGRESS_FILE)) {
    try {
      return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
    } catch {
      log('Warning: Could not parse progress file, starting fresh', colors.yellow);
    }
  }
  return null;
}

function saveProgress(progress: BatchProgress): void {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function updateStats(progress: BatchProgress): void {
  const games = Object.values(progress.games);
  progress.stats = {
    completed: games.filter((g) => g.status === 'completed').length,
    failed: games.filter((g) => g.status === 'failed').length,
    pending: games.filter((g) => g.status === 'pending').length,
    running: games.filter((g) => g.status === 'running').length,
  };
}

function buildPrompt(deck: string, opponent: string): string {
  return PROMPT_TEMPLATE.replace(/\{deck\}/g, deck).replace(/\{opponent\}/g, opponent);
}

function clearStatusBlock(): void {
  if (lastStatusLines > 0) {
    // Move cursor up and clear each line
    process.stdout.write(cursor.up(lastStatusLines));
    for (let i = 0; i < lastStatusLines; i++) {
      process.stdout.write(cursor.clearLine + '\n');
    }
    process.stdout.write(cursor.up(lastStatusLines));
  }
}

function printStatusUpdate(progress: BatchProgress): void {
  const now = Date.now();
  const elapsed = formatDuration(now - batchStartTime);
  const total = progress.config.totalGames;
  const done = progress.stats.completed + progress.stats.failed;
  const pct = ((done / total) * 100).toFixed(1);

  // Calculate ETA
  let eta = 'calculating...';
  if (completedDurations.length >= 1) {
    const avgDuration = completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length;
    const remaining = progress.stats.pending + runningGames.size;
    const etaMs = (remaining / progress.config.parallelWorkers) * avgDuration;
    eta = formatDuration(etaMs);
  }

  // Clear previous status block
  clearStatusBlock();

  // Build status lines
  const lines: string[] = [];
  lines.push(`${colors.cyan}${'─'.repeat(60)}${colors.reset}`);
  lines.push(
    `${colors.bright}Status${colors.reset} │ ` +
      `Elapsed: ${colors.yellow}${elapsed}${colors.reset} │ ` +
      `ETA: ${colors.yellow}${eta}${colors.reset} │ ` +
      `Progress: ${colors.bright}${pct}%${colors.reset} (${done}/${total})`,
  );
  lines.push(
    `${colors.green}✓ ${progress.stats.completed}${colors.reset} │ ` +
      `${colors.red}✗ ${progress.stats.failed}${colors.reset} │ ` +
      `${colors.blue}◌ ${progress.stats.pending}${colors.reset} │ ` +
      `${colors.magenta}► ${runningGames.size} running${colors.reset}`,
  );

  // Show running games with reasoning
  for (const [, info] of runningGames) {
    const runningFor = formatDuration(now - info.startTime);
    const turnInfo = info.turn > 0 ? `T${info.turn}` : '...';
    const modelBadge = getModelBadge(info.game.model);
    const reasoningSnippet = info.reasoning
      ? `${colors.dim}"${info.reasoning.slice(0, 35)}${info.reasoning.length > 35 ? '...' : ''}"${colors.reset}`
      : '';
    lines.push(
      `  ${colors.magenta}►${colors.reset} ${modelBadge} ${info.game.deck} vs ${info.game.opponent} ` +
        `${colors.gray}(${runningFor}, ${turnInfo})${colors.reset} ${reasoningSnippet}`,
    );
  }

  lines.push(`${colors.cyan}${'─'.repeat(60)}${colors.reset}`);

  // Print all lines
  for (const line of lines) {
    console.log(line);
  }

  // Track how many lines we printed for clearing next time
  lastStatusLines = lines.length;
}

function startStatusUpdates(progress: BatchProgress): void {
  // Print initial status
  printStatusUpdate(progress);
  // Update in-place every 5 seconds
  statusInterval = setInterval(() => {
    printStatusUpdate(progress);
  }, 5000);
}

function stopStatusUpdates(): void {
  if (statusInterval) {
    clearInterval(statusInterval);
    statusInterval = null;
  }
  // Clear the status block before final output
  clearStatusBlock();
  lastStatusLines = 0;
}

async function runGame(game: GameConfig, progress: BatchProgress): Promise<boolean> {
  const prompt = buildPrompt(game.deck, game.opponent);
  const startTime = Date.now();

  return new Promise((resolve) => {
    game.status = 'running';
    game.startedAt = new Date().toISOString();
    updateStats(progress);
    saveProgress(progress);

    // Clear status, log start, then track
    clearStatusBlock();
    lastStatusLines = 0;

    log(
      `${colors.blue}►${colors.reset} Starting: ` +
        `${getModelBadge(game.model)} ` +
        `${colors.bright}${game.deck}${colors.reset} vs ` +
        `${colors.bright}${game.opponent}${colors.reset}`,
    );

    // Track this running game
    runningGames.set(game.id, {
      game,
      startTime,
      turn: 0,
      reasoning: '',
    });

    const proc = spawn(
      'claude',
      [
        '-p', // print mode
        '--model',
        game.model,
        '--dangerously-skip-permissions', // needed for MCP in batch mode
        prompt,
      ],
      {
        cwd: PROJECT_ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          MANACORE_SILENT_INIT: '1',
        },
      },
    );

    let stdout = '';
    let stderr = '';
    let turnCount = 0;

    // Helper to extract info from output
    const parseOutput = (text: string) => {
      const info = runningGames.get(game.id);
      if (!info) return;

      // Extract turn number
      const turnMatch = text.match(/Turn (\d+)/i);
      if (turnMatch) {
        turnCount = parseInt(turnMatch[1], 10);
        info.turn = turnCount;
      }

      // Extract reasoning from tool calls or output
      // Look for patterns like: "reasoning": "..." or reasoning: "..."
      const reasoningMatch = text.match(/"reasoning":\s*"([^"]+)"/);
      if (reasoningMatch) {
        info.reasoning = reasoningMatch[1].replace(/\\n/g, ' ').trim();
      }

      // Also try to catch reasoning from MCP action output
      const actionReasonMatch = text.match(/Reasoning:\s*(.+?)(?:\n|$)/i);
      if (actionReasonMatch) {
        info.reasoning = actionReasonMatch[1].trim();
      }
    };

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      parseOutput(text);
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      parseOutput(text);
    });

    // Timeout after 10 minutes (some games take longer with complex board states)
    const timeout = setTimeout(
      () => {
        log(
          `${colors.yellow}⏱${colors.reset} Timeout after 10 min: ${game.deck} vs ${game.opponent}`,
          colors.yellow,
        );
        proc.kill('SIGTERM');
      },
      10 * 60 * 1000,
    );

    proc.on('close', (code) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;
      game.completedAt = new Date().toISOString();
      game.durationMs = duration;

      // Remove from running games
      runningGames.delete(game.id);

      // Check if game completed successfully
      // Note: MCP server logs to stderr, so check both stdout and stderr
      const allOutput = stdout + stderr;
      const gameOver =
        allOutput.includes('Game Over') ||
        allOutput.includes('Training data saved') ||
        allOutput.includes('Saved training data');
      const hasFatalError =
        stderr.includes('FATAL') || stderr.includes('Cannot find module') || stderr.includes('SyntaxError');

      // Clear status, print result, then status will redraw
      clearStatusBlock();
      lastStatusLines = 0;

      if (code === 0 && !hasFatalError) {
        game.status = 'completed';
        completedDurations.push(duration);
        // Try to find the generated file
        const recentFiles = findRecentGameFiles();
        if (recentFiles.length > 0) {
          game.file = recentFiles[0];
        }
        log(
          `${colors.green}✓${colors.reset} Completed: ` +
            `${getModelBadge(game.model)} ` +
            `${colors.bright}${game.deck}${colors.reset} vs ` +
            `${colors.bright}${game.opponent}${colors.reset} ` +
            `(${formatDuration(duration)}, ~${turnCount} turns)`,
        );
        resolve(true);
      } else {
        game.status = 'failed';
        game.error = hasFatalError ? stderr.slice(0, 500) : `Exit code: ${code}`;
        log(
          `${colors.red}✗${colors.reset} Failed: ${getModelBadge(game.model)} ` +
            `${game.deck} vs ${game.opponent} - ${game.error.slice(0, 80)}`,
          colors.red,
        );
        resolve(false);
      }

      updateStats(progress);
      saveProgress(progress);
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      runningGames.delete(game.id);
      game.status = 'failed';
      game.error = err.message;
      game.completedAt = new Date().toISOString();
      game.durationMs = Date.now() - startTime;
      log(`${colors.red}✗${colors.reset} Process error: ${err.message}`, colors.red);
      updateStats(progress);
      saveProgress(progress);
      resolve(false);
    });
  });
}

function findRecentGameFiles(): string[] {
  if (!existsSync(DATA_DIR)) return [];

  const files = readdirSync(DATA_DIR)
    .filter((f) => f.startsWith('game-') && f.endsWith('.json') && f !== 'batch-progress.json')
    .map((f) => ({
      name: f,
      path: join(DATA_DIR, f),
      mtime: existsSync(join(DATA_DIR, f)) ? statSync(join(DATA_DIR, f)).mtime.getTime() : 0,
    }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 5)
    .map((f) => f.name);

  return files;
}

async function runBatch(
  totalGames: number,
  parallelWorkers: number,
  modelArg: string,
  mixRatio: { opus: number; sonnet: number; haiku: number },
): Promise<void> {
  batchStartTime = Date.now();

  // Load or create progress
  let progress = loadProgress();

  console.log('');
  console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}  Training Data Generation Pipeline${colors.reset}`);
  console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
  console.log('');

  if (progress && progress.stats.pending > 0) {
    log(`Resuming batch ${colors.bright}${progress.batchId}${colors.reset}`);
    log(
      `Previous progress: ${colors.green}${progress.stats.completed} completed${colors.reset}, ` +
        `${colors.red}${progress.stats.failed} failed${colors.reset}, ` +
        `${colors.blue}${progress.stats.pending} pending${colors.reset}`,
    );
  } else {
    // Create new batch
    const games = generateGameQueue(totalGames, modelArg, mixRatio);
    progress = {
      batchId: generateBatchId(),
      startedAt: new Date().toISOString(),
      config: {
        totalGames,
        parallelWorkers,
        matchups: [...new Set(games.map((g) => `${g.deck}-${g.opponent}`))],
      },
      stats: {
        completed: 0,
        failed: 0,
        pending: games.length,
        running: 0,
      },
      games: Object.fromEntries(games.map((g) => [g.id, g])),
    };
    saveProgress(progress);
    log(`Created new batch ${colors.bright}${progress.batchId}${colors.reset}`);
  }

  // Format model info for logging
  const modelInfo =
    modelArg === 'mix'
      ? `${colors.bright}mix${colors.reset} (${mixRatio.opus}% opus, ${mixRatio.sonnet}% sonnet, ${mixRatio.haiku}% haiku)`
      : `${colors.bright}${modelArg}${colors.reset}`;

  log(
    `Configuration: ${colors.bright}${totalGames}${colors.reset} games, ` +
      `${colors.bright}${parallelWorkers}${colors.reset} workers, ` +
      `model: ${modelInfo}`,
  );
  log(`Matchups: ${progress.config.matchups.length} combinations (5 decks × 3 opponents)`);
  console.log('');

  // Run games with concurrency limit
  const pendingGames = Object.values(progress.games).filter((g) => g.status === 'pending');

  if (pendingGames.length === 0) {
    log('No pending games. Batch complete!', colors.green);
    printSummary(progress);
    return;
  }

  log(`Starting ${colors.bright}${pendingGames.length}${colors.reset} games...`);
  console.log('');

  // Start periodic status updates
  startStatusUpdates(progress);

  // Process in chunks
  for (let i = 0; i < pendingGames.length; i += parallelWorkers) {
    const chunk = pendingGames.slice(i, i + parallelWorkers);
    const promises = chunk.map((game) => runGame(game, progress!));
    await Promise.all(promises);
  }

  // Stop status updates
  stopStatusUpdates();

  printSummary(progress);
}

function printSummary(progress: BatchProgress): void {
  const totalDuration = Date.now() - batchStartTime;
  const avgDuration =
    completedDurations.length > 0
      ? completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length
      : 0;

  console.log('');
  console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}  BATCH COMPLETE${colors.reset}`);
  console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
  console.log('');
  console.log(`  Batch ID:      ${colors.bright}${progress.batchId}${colors.reset}`);
  console.log(`  Total time:    ${colors.yellow}${formatDuration(totalDuration)}${colors.reset}`);
  console.log(`  Avg per game:  ${colors.yellow}${formatDuration(avgDuration)}${colors.reset}`);
  console.log('');
  console.log(`  ${colors.green}✓ Completed:${colors.reset}   ${progress.stats.completed}`);
  console.log(`  ${colors.red}✗ Failed:${colors.reset}      ${progress.stats.failed}`);
  console.log(
    `  Success rate: ${colors.bright}${((progress.stats.completed / Object.keys(progress.games).length) * 100).toFixed(1)}%${colors.reset}`,
  );

  // Matchup breakdown
  const matchupStats: Record<string, { completed: number; failed: number }> = {};
  for (const game of Object.values(progress.games)) {
    const key = `${game.deck} vs ${game.opponent}`;
    if (!matchupStats[key]) {
      matchupStats[key] = { completed: 0, failed: 0 };
    }
    if (game.status === 'completed') matchupStats[key].completed++;
    if (game.status === 'failed') matchupStats[key].failed++;
  }

  console.log('');
  console.log(`  ${colors.dim}Matchup breakdown:${colors.reset}`);
  for (const [matchup, stats] of Object.entries(matchupStats).sort()) {
    const status =
      stats.failed === 0
        ? `${colors.green}${stats.completed} ✓${colors.reset}`
        : `${colors.green}${stats.completed} ✓${colors.reset} ${colors.red}${stats.failed} ✗${colors.reset}`;
    console.log(`    ${matchup.padEnd(20)} ${status}`);
  }

  console.log('');
  console.log(`  ${colors.dim}Output:${colors.reset} ${DATA_DIR}`);
  console.log(`  ${colors.dim}Report:${colors.reset} bun scripts/generate-coverage-report.ts`);
  console.log('');
  console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
  console.log('');
}

// CLI
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    games: { type: 'string', short: 'g', default: '15' },
    parallel: { type: 'string', short: 'p', default: '3' },
    model: { type: 'string', short: 'm', default: 'sonnet' },
    'mix-ratio': { type: 'string', default: '20:40:40' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (values.help) {
  console.log(`
${colors.bright}Training Data Generation Pipeline${colors.reset}

${colors.dim}Usage:${colors.reset}
  bun scripts/generate-training-data.ts [options]

${colors.dim}Options:${colors.reset}
  -g, --games <n>       Number of games to generate (default: 15)
  -p, --parallel <n>    Parallel workers (default: 3)
  -m, --model <model>   Model to use: opus, sonnet, haiku, or mix (default: sonnet)
  --mix-ratio <O:S:H>   Ratio for mix mode as opus:sonnet:haiku (default: 20:40:40)
  -h, --help            Show this help

${colors.dim}Models:${colors.reset}
  opus     Highest quality reasoning, highest cost (~$0.20/game)
  sonnet   Great quality, balanced cost (~$0.10/game)
  haiku    Good quality, fastest & cheapest (~$0.02/game)
  mix      Use a mix of models based on --mix-ratio

${colors.dim}Examples:${colors.reset}
  bun scripts/generate-training-data.ts --games 15 --parallel 1          ${colors.gray}# Test run (sonnet)${colors.reset}
  bun scripts/generate-training-data.ts --games 100 --model opus         ${colors.gray}# High quality${colors.reset}
  bun scripts/generate-training-data.ts --games 100 --model haiku        ${colors.gray}# Fast & cheap${colors.reset}
  bun scripts/generate-training-data.ts --games 1000 --model mix         ${colors.gray}# Mixed quality${colors.reset}
  bun scripts/generate-training-data.ts --model mix --mix-ratio 10:50:40 ${colors.gray}# Custom mix${colors.reset}

${colors.dim}The script will resume from the last progress if interrupted.${colors.reset}
`);
  process.exit(0);
}

const totalGames = parseInt(values.games!, 10);
const parallelWorkers = parseInt(values.parallel!, 10);
const modelArg = values.model!;

// Validate games
if (isNaN(totalGames) || totalGames < 1) {
  console.error(`${colors.red}Error: --games must be a positive number${colors.reset}`);
  process.exit(1);
}

// Validate parallel workers
if (isNaN(parallelWorkers) || parallelWorkers < 1) {
  console.error(`${colors.red}Error: --parallel must be a positive number${colors.reset}`);
  process.exit(1);
}

// Validate model
const validModels = ['opus', 'sonnet', 'haiku', 'mix'];
if (!validModels.includes(modelArg)) {
  console.error(`${colors.red}Error: --model must be one of: ${validModels.join(', ')}${colors.reset}`);
  process.exit(1);
}

// Parse mix ratio
let mixRatio = DEFAULT_MIX_RATIO;
if (values['mix-ratio']) {
  const parts = values['mix-ratio'].split(':').map((s) => parseInt(s, 10));
  if (parts.length !== 3 || parts.some(isNaN) || parts.some((n) => n < 0)) {
    console.error(`${colors.red}Error: --mix-ratio must be in format O:S:H (e.g., 20:40:40)${colors.reset}`);
    process.exit(1);
  }
  mixRatio = { opus: parts[0], sonnet: parts[1], haiku: parts[2] };
}

runBatch(totalGames, parallelWorkers, modelArg, mixRatio).catch((err) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
});
