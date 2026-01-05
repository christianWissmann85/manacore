/**
 * Benchmark Suite Command - Bot comparison matrix
 *
 * Runs all bots against each other and produces win rate matrices.
 */

import type { BotType } from '../botFactory';
import type {
  BenchmarkConfig,
  BenchmarkResults,
  BenchmarkProgress,
  BenchmarkPreset,
} from '../benchmarking/types';
import { BenchmarkRunner } from '../benchmarking/BenchmarkRunner';
import { getPreset, parseBotList } from '../benchmarking/presets';
import { OutputLevel } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Options for the benchmark suite command
 */
export interface BenchmarkSuiteOptions {
  preset: BenchmarkPreset;
  bots?: BotType[];
  gamesPerMatchup?: number;
  maxTurns?: number;
  seed?: number;
  outputLevel?: OutputLevel;
  exportJson?: boolean;
  exportPath?: string;
}

/**
 * Format time duration
 */
function formatTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}m ${secs}s`;
}

/**
 * Format percentage
 */
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Print progress dashboard
 */
function printDashboard(progress: BenchmarkProgress): void {
  const {
    currentMatchup,
    totalMatchups,
    totalGamesCompleted,
    totalGames,
    bot1,
    bot2,
    currentWinRate,
    elapsedMs,
    estimatedRemainingMs,
    gamesPerSecond,
  } = progress;

  const pct = Math.round((totalGamesCompleted / totalGames) * 100);
  const barWidth = 30;
  const filled = Math.round((pct / 100) * barWidth);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);

  const lines: string[] = [];
  lines.push('\u250C' + '\u2500'.repeat(60) + '\u2510');
  lines.push(
    `\u2502  Benchmark Suite - Matchup ${currentMatchup}/${totalMatchups}`.padEnd(61) + '\u2502',
  );
  lines.push('\u251C' + '\u2500'.repeat(60) + '\u2524');
  lines.push(`\u2502  Current: ${bot1} vs ${bot2}`.padEnd(61) + '\u2502');
  lines.push(`\u2502  Win Rate: ${formatPercent(currentWinRate)}`.padEnd(61) + '\u2502');
  lines.push('\u2502'.padEnd(61) + '\u2502');
  lines.push(`\u2502  Progress: [${bar}] ${pct}%`.padEnd(61) + '\u2502');
  lines.push(`\u2502  Games: ${totalGamesCompleted}/${totalGames}`.padEnd(61) + '\u2502');
  lines.push(
    `\u2502  Speed: ${gamesPerSecond.toFixed(1)} games/sec | ETA: ${formatTime(estimatedRemainingMs)}`.padEnd(
      61,
    ) + '\u2502',
  );
  lines.push(`\u2502  Elapsed: ${formatTime(elapsedMs)}`.padEnd(61) + '\u2502');
  lines.push('\u2514' + '\u2500'.repeat(60) + '\u2518');

  // Move cursor up and clear
  process.stdout.write('\x1b[' + lines.length + 'A');
  process.stdout.write('\x1b[0J');
  console.log(lines.join('\n'));
}

/**
 * Print initial dashboard placeholder
 */
function printInitialDashboard(): void {
  const lines: string[] = [];
  lines.push('\u250C' + '\u2500'.repeat(60) + '\u2510');
  lines.push('\u2502  Benchmark Suite - Initializing...'.padEnd(61) + '\u2502');
  lines.push('\u251C' + '\u2500'.repeat(60) + '\u2524');
  lines.push('\u2502  Current: ---'.padEnd(61) + '\u2502');
  lines.push('\u2502  Win Rate: ---%'.padEnd(61) + '\u2502');
  lines.push('\u2502'.padEnd(61) + '\u2502');
  lines.push(`\u2502  Progress: [${'░'.repeat(30)}] 0%`.padEnd(61) + '\u2502');
  lines.push('\u2502  Games: 0/---'.padEnd(61) + '\u2502');
  lines.push('\u2502  Speed: --- games/sec | ETA: ---'.padEnd(61) + '\u2502');
  lines.push('\u2502  Elapsed: 0s'.padEnd(61) + '\u2502');
  lines.push('\u2514' + '\u2500'.repeat(60) + '\u2518');
  console.log(lines.join('\n'));
}

/**
 * Print win rate matrix to console
 */
function printMatrix(results: BenchmarkResults): void {
  const { matrix, config } = results;
  const bots = config.bots;

  console.log('\n' + '='.repeat(70));
  console.log('  WIN RATE MATRIX (row = P1 win rate vs column)');
  console.log('='.repeat(70) + '\n');

  // Calculate column widths
  const maxBotLen = Math.max(...bots.map((b) => b.length), 10);
  const colWidth = 8;

  // Header row
  let header = ''.padEnd(maxBotLen + 2);
  for (const bot of bots) {
    header += bot.slice(0, colWidth - 1).padStart(colWidth);
  }
  console.log(header);
  console.log('-'.repeat(maxBotLen + 2 + bots.length * colWidth));

  // Data rows
  for (const bot1 of bots) {
    let row = bot1.padEnd(maxBotLen + 2);
    for (const bot2 of bots) {
      const winRate = matrix[bot1]?.[bot2] ?? 0;
      const pct = formatPercent(winRate);
      row += pct.padStart(colWidth);
    }
    console.log(row);
  }

  console.log();
}

/**
 * Print rankings to console
 */
function printRankings(results: BenchmarkResults): void {
  const { rankings } = results;

  console.log('='.repeat(70));
  console.log('  BOT RANKINGS (by average win rate)');
  console.log('='.repeat(70) + '\n');

  console.log('  Rank  Bot                    Avg Win%   Games   W/L/D');
  console.log('  ' + '-'.repeat(60));

  rankings.forEach((ranking, index) => {
    const rank = String(index + 1).padStart(4);
    const bot = ranking.bot.padEnd(22);
    const winRate = formatPercent(ranking.avgWinRate).padStart(8);
    const games = String(ranking.gamesPlayed).padStart(7);
    const wld = `${ranking.wins}/${ranking.losses}/${ranking.draws}`;
    console.log(`  ${rank}  ${bot}${winRate}${games}   ${wld}`);
  });

  console.log();
}

/**
 * Print summary to console
 */
function printSummary(results: BenchmarkResults): void {
  const { summary, metadata } = results;

  console.log('='.repeat(70));
  console.log('  BENCHMARK SUMMARY');
  console.log('='.repeat(70) + '\n');

  console.log(`  Bots compared: ${summary.botsCompared}`);
  console.log(`  Total matchups: ${summary.totalMatchups}`);
  console.log(`  Total games: ${summary.totalGames}`);
  console.log(`  Duration: ${formatTime(summary.totalDurationMs)}`);
  console.log(`  Throughput: ${summary.gamesPerSecond.toFixed(1)} games/sec`);
  console.log(`  Seed: ${metadata.seed}`);
  if (metadata.preset) {
    console.log(`  Preset: ${metadata.preset}`);
  }

  console.log();
}

/**
 * Export results to JSON
 */
function exportJson(results: BenchmarkResults, outputPath?: string): string {
  const resultsDir = path.resolve(__dirname, '../../../../results/benchmarks');

  // Ensure directory exists
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `benchmark-${results.metadata.preset || 'custom'}-${timestamp}.json`;
  const filepath = outputPath || path.join(resultsDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(results, null, 2));

  return filepath;
}

/**
 * Run the benchmark suite command
 */
export async function runBenchmarkSuite(options: BenchmarkSuiteOptions): Promise<BenchmarkResults> {
  const preset = options.preset || 'quick';
  const presetConfig = getPreset(preset);

  // Determine bots to use
  let bots: BotType[];
  let gamesPerMatchup: number;

  if (options.bots && options.bots.length > 0) {
    bots = options.bots;
    gamesPerMatchup = options.gamesPerMatchup ?? 50;
  } else if (presetConfig) {
    bots = presetConfig.bots;
    gamesPerMatchup = options.gamesPerMatchup ?? presetConfig.gamesPerMatchup;
  } else {
    bots = ['random', 'greedy'];
    gamesPerMatchup = options.gamesPerMatchup ?? 50;
  }

  const config: BenchmarkConfig = {
    bots,
    gamesPerMatchup,
    maxTurns: options.maxTurns ?? 100,
    seed: options.seed ?? Date.now(),
    parallel: false, // MVP: serial only
    outputLevel: options.outputLevel ?? OutputLevel.MINIMAL,
  };

  const runner = new BenchmarkRunner(config);
  const totalGames = runner.getTotalGames();
  const totalMatchups = runner.getTotalMatchups();

  // Print header
  console.log('\n' + '='.repeat(70));
  console.log('  MANACORE BENCHMARK SUITE');
  console.log('='.repeat(70));
  console.log(`  Preset: ${preset}${presetConfig ? ` - ${presetConfig.description}` : ''}`);
  console.log(`  Bots: ${bots.length} (${bots.join(', ')})`);
  console.log(`  Matchups: ${totalMatchups} (including mirrors)`);
  console.log(`  Games per matchup: ${gamesPerMatchup}`);
  console.log(`  Total games: ${totalGames}`);
  console.log(`  Seed: ${config.seed}`);
  if (presetConfig) {
    console.log(`  Estimated time: ${presetConfig.estimatedTime}`);
  }
  console.log('='.repeat(70) + '\n');

  // Print initial dashboard
  printInitialDashboard();

  // Run benchmark with progress updates
  const results = await runner.run((progress) => {
    printDashboard(progress);
  }, preset);

  // Clear dashboard area and print results
  console.log('\n');

  // Print results
  printMatrix(results);
  printRankings(results);
  printSummary(results);

  // Export JSON if requested (or by default)
  if (options.exportJson !== false) {
    const jsonPath = exportJson(results, options.exportPath);
    console.log(`  Results exported to: ${jsonPath}\n`);
  }

  return results;
}

/**
 * Parse command line arguments for benchmark suite
 */
export function parseBenchmarkSuiteArgs(args: string[]): BenchmarkSuiteOptions {
  const options: BenchmarkSuiteOptions = {
    preset: 'quick',
    exportJson: true,
  };

  // Parse --preset
  const presetIdx = args.indexOf('--preset');
  if (presetIdx !== -1 && args[presetIdx + 1]) {
    const presetArg = args[presetIdx + 1] as BenchmarkPreset;
    if (['quick', 'standard', 'comprehensive'].includes(presetArg)) {
      options.preset = presetArg;
    }
  }

  // Parse --bots (comma-separated list)
  const botsIdx = args.indexOf('--bots');
  if (botsIdx !== -1 && args[botsIdx + 1]) {
    options.bots = parseBotList(args[botsIdx + 1]!);
    options.preset = 'custom';
  }

  // Parse --games
  const gamesIdx = args.indexOf('--games');
  if (gamesIdx !== -1 && args[gamesIdx + 1]) {
    options.gamesPerMatchup = parseInt(args[gamesIdx + 1]!, 10);
  }

  // Parse --seed
  const seedIdx = args.indexOf('--seed');
  if (seedIdx !== -1 && args[seedIdx + 1]) {
    options.seed = parseInt(args[seedIdx + 1]!, 10);
  }

  // Parse --turns
  const turnsIdx = args.indexOf('--turns');
  if (turnsIdx !== -1 && args[turnsIdx + 1]) {
    options.maxTurns = parseInt(args[turnsIdx + 1]!, 10);
  }

  // Parse output level
  if (args.includes('--quiet')) {
    options.outputLevel = OutputLevel.QUIET;
  } else if (args.includes('--verbose')) {
    options.outputLevel = OutputLevel.VERBOSE;
  }

  // Parse --no-export
  if (args.includes('--no-export')) {
    options.exportJson = false;
  }

  // Parse --export-path
  const exportPathIdx = args.indexOf('--export-path');
  if (exportPathIdx !== -1 && args[exportPathIdx + 1]) {
    options.exportPath = args[exportPathIdx + 1];
  }

  return options;
}
