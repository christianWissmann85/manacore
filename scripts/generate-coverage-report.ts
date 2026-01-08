#!/usr/bin/env bun
/**
 * Coverage Report Generator
 *
 * Analyzes training data files and generates a coverage report
 * showing matchup distribution, game statistics, and sample quality.
 *
 * Usage:
 *   bun scripts/generate-coverage-report.ts
 *   bun scripts/generate-coverage-report.ts --dir /path/to/data
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { parseArgs } from 'util';

const PROJECT_ROOT = join(dirname(import.meta.path), '..');
const DEFAULT_DATA_DIR = join(PROJECT_ROOT, 'packages/ai/data/human-training');

interface TrainingSample {
  features: Record<string, number>;
  actionIndex: number;
  legalActionCount: number;
  actionType: string;
  turn: number;
  phase: string;
  playerId: string;
  reasoning?: string;
}

interface GameTrainingData {
  gameId: string;
  timestamp: string;
  seed: number;
  playerBot: string;
  opponentBot: string;
  outcome: 1 | 0 | -1;
  turns: number;
  totalActions: number;
  samples: TrainingSample[];
}

interface MatchupStats {
  games: number;
  wins: number;
  losses: number;
  draws: number;
  totalTurns: number;
  totalSamples: number;
  samplesWithReasoning: number;
  avgTurns: number;
  avgSamples: number;
  winRate: number;
}

interface CoverageReport {
  generatedAt: string;
  dataDirectory: string;
  summary: {
    totalGames: number;
    totalSamples: number;
    avgTurnsPerGame: number;
    avgSamplesPerGame: number;
    reasoningCoverage: number;
    overallWinRate: number;
  };
  matchups: Record<string, MatchupStats>;
  deckStats: Record<string, { games: number; winRate: number }>;
  opponentStats: Record<string, { games: number; winRate: number }>;
  actionTypeDistribution: Record<string, number>;
  issues: string[];
}

function loadGameFiles(dataDir: string): GameTrainingData[] {
  if (!existsSync(dataDir)) {
    console.error(`Data directory not found: ${dataDir}`);
    return [];
  }

  const files = readdirSync(dataDir).filter(
    (f) => f.startsWith('game-') && f.endsWith('.json') && f !== 'batch-progress.json',
  );

  const games: GameTrainingData[] = [];
  const errors: string[] = [];

  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(join(dataDir, file), 'utf-8'));
      if (data.samples && Array.isArray(data.samples)) {
        games.push(data);
      } else {
        errors.push(`${file}: Missing or invalid samples array`);
      }
    } catch (err) {
      errors.push(`${file}: Failed to parse - ${(err as Error).message}`);
    }
  }

  if (errors.length > 0) {
    console.warn(`\nWarnings (${errors.length} files with issues):`);
    errors.slice(0, 5).forEach((e) => console.warn(`  - ${e}`));
    if (errors.length > 5) {
      console.warn(`  ... and ${errors.length - 5} more`);
    }
  }

  return games;
}

function generateReport(games: GameTrainingData[], dataDir: string): CoverageReport {
  const matchups: Record<string, MatchupStats> = {};
  const deckStats: Record<string, { wins: number; total: number }> = {};
  const opponentStats: Record<string, { wins: number; total: number }> = {};
  const actionTypes: Record<string, number> = {};
  const issues: string[] = [];

  let totalSamples = 0;
  let totalTurns = 0;
  let samplesWithReasoning = 0;
  let totalWins = 0;

  for (const game of games) {
    // Extract deck from playerBot (e.g., "human" -> check samples or use default)
    // For now, we'll try to infer from the game data or use the opponentBot
    const deck = game.playerBot === 'human' ? 'unknown' : game.playerBot;
    const opponent = game.opponentBot;
    const matchupKey = `${deck} vs ${opponent}`;

    // Initialize matchup stats
    if (!matchups[matchupKey]) {
      matchups[matchupKey] = {
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        totalTurns: 0,
        totalSamples: 0,
        samplesWithReasoning: 0,
        avgTurns: 0,
        avgSamples: 0,
        winRate: 0,
      };
    }

    // Update matchup stats
    const m = matchups[matchupKey];
    m.games++;
    m.totalTurns += game.turns;
    m.totalSamples += game.samples.length;

    if (game.outcome === 1) {
      m.wins++;
      totalWins++;
    } else if (game.outcome === -1) {
      m.losses++;
    } else {
      m.draws++;
    }

    // Count reasoning
    for (const sample of game.samples) {
      if (sample.reasoning && sample.reasoning.trim().length > 0) {
        m.samplesWithReasoning++;
        samplesWithReasoning++;
      }

      // Action type distribution
      actionTypes[sample.actionType] = (actionTypes[sample.actionType] || 0) + 1;
    }

    totalSamples += game.samples.length;
    totalTurns += game.turns;

    // Deck stats (if we can determine deck)
    if (deck !== 'unknown') {
      if (!deckStats[deck]) deckStats[deck] = { wins: 0, total: 0 };
      deckStats[deck].total++;
      if (game.outcome === 1) deckStats[deck].wins++;
    }

    // Opponent stats
    if (!opponentStats[opponent]) opponentStats[opponent] = { wins: 0, total: 0 };
    opponentStats[opponent].total++;
    if (game.outcome === 1) opponentStats[opponent].wins++;

    // Quality checks
    if (game.samples.length < 3) {
      issues.push(`${game.gameId}: Very short game (${game.samples.length} samples)`);
    }
    if (game.turns < 2) {
      issues.push(`${game.gameId}: Game ended very quickly (${game.turns} turns)`);
    }
  }

  // Calculate averages
  for (const m of Object.values(matchups)) {
    m.avgTurns = m.games > 0 ? m.totalTurns / m.games : 0;
    m.avgSamples = m.games > 0 ? m.totalSamples / m.games : 0;
    m.winRate = m.games > 0 ? m.wins / m.games : 0;
  }

  // Check for under-represented matchups
  const avgGamesPerMatchup = games.length / Math.max(Object.keys(matchups).length, 1);
  for (const [matchup, stats] of Object.entries(matchups)) {
    if (stats.games < avgGamesPerMatchup * 0.5) {
      issues.push(
        `Under-represented matchup: ${matchup} (${stats.games} games, expected ~${Math.round(avgGamesPerMatchup)})`,
      );
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    dataDirectory: dataDir,
    summary: {
      totalGames: games.length,
      totalSamples,
      avgTurnsPerGame: games.length > 0 ? totalTurns / games.length : 0,
      avgSamplesPerGame: games.length > 0 ? totalSamples / games.length : 0,
      reasoningCoverage: totalSamples > 0 ? samplesWithReasoning / totalSamples : 0,
      overallWinRate: games.length > 0 ? totalWins / games.length : 0,
    },
    matchups,
    deckStats: Object.fromEntries(
      Object.entries(deckStats).map(([k, v]) => [
        k,
        { games: v.total, winRate: v.total > 0 ? v.wins / v.total : 0 },
      ]),
    ),
    opponentStats: Object.fromEntries(
      Object.entries(opponentStats).map(([k, v]) => [
        k,
        { games: v.total, winRate: v.total > 0 ? v.wins / v.total : 0 },
      ]),
    ),
    actionTypeDistribution: actionTypes,
    issues,
  };
}

function printReport(report: CoverageReport): void {
  console.log('\n' + '='.repeat(60));
  console.log('TRAINING DATA COVERAGE REPORT');
  console.log('='.repeat(60));
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Data directory: ${report.dataDirectory}`);

  console.log('\n--- SUMMARY ---');
  console.log(`Total games: ${report.summary.totalGames}`);
  console.log(`Total samples: ${report.summary.totalSamples}`);
  console.log(`Avg turns/game: ${report.summary.avgTurnsPerGame.toFixed(1)}`);
  console.log(`Avg samples/game: ${report.summary.avgSamplesPerGame.toFixed(1)}`);
  console.log(`Reasoning coverage: ${(report.summary.reasoningCoverage * 100).toFixed(1)}%`);
  console.log(`Overall win rate: ${(report.summary.overallWinRate * 100).toFixed(1)}%`);

  console.log('\n--- MATCHUP BREAKDOWN ---');
  const sortedMatchups = Object.entries(report.matchups).sort((a, b) => b[1].games - a[1].games);
  for (const [matchup, stats] of sortedMatchups) {
    const winPct = (stats.winRate * 100).toFixed(0);
    const reasoningPct =
      stats.totalSamples > 0
        ? ((stats.samplesWithReasoning / stats.totalSamples) * 100).toFixed(0)
        : '0';
    console.log(
      `  ${matchup.padEnd(25)} ${String(stats.games).padStart(4)} games, ` +
        `${stats.avgTurns.toFixed(1).padStart(5)} avg turns, ` +
        `${winPct.padStart(3)}% wins, ` +
        `${reasoningPct.padStart(3)}% reasoning`,
    );
  }

  console.log('\n--- OPPONENT PERFORMANCE ---');
  for (const [opponent, stats] of Object.entries(report.opponentStats).sort()) {
    console.log(
      `  vs ${opponent.padEnd(10)} ${stats.games} games, ${(stats.winRate * 100).toFixed(1)}% win rate`,
    );
  }

  console.log('\n--- ACTION TYPE DISTRIBUTION ---');
  const sortedActions = Object.entries(report.actionTypeDistribution).sort((a, b) => b[1] - a[1]);
  const totalActions = sortedActions.reduce((sum, [, count]) => sum + count, 0);
  for (const [action, count] of sortedActions.slice(0, 10)) {
    const pct = ((count / totalActions) * 100).toFixed(1);
    console.log(`  ${action.padEnd(20)} ${String(count).padStart(6)} (${pct}%)`);
  }

  if (report.issues.length > 0) {
    console.log('\n--- ISSUES ---');
    for (const issue of report.issues.slice(0, 10)) {
      console.log(`  - ${issue}`);
    }
    if (report.issues.length > 10) {
      console.log(`  ... and ${report.issues.length - 10} more issues`);
    }
  }

  console.log('\n' + '='.repeat(60));
}

// CLI
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    dir: { type: 'string', short: 'd', default: DEFAULT_DATA_DIR },
    output: { type: 'string', short: 'o' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (values.help) {
  console.log(`
Coverage Report Generator

Usage:
  bun scripts/generate-coverage-report.ts [options]

Options:
  -d, --dir <path>    Data directory (default: packages/ai/data/human-training)
  -o, --output <path> Save report to JSON file
  -h, --help          Show this help

Examples:
  bun scripts/generate-coverage-report.ts
  bun scripts/generate-coverage-report.ts --output report.json
`);
  process.exit(0);
}

const dataDir = values.dir!;
console.log(`Loading training data from: ${dataDir}`);

const games = loadGameFiles(dataDir);

if (games.length === 0) {
  console.log('\nNo training data found. Run generate-training-data.ts first.');
  process.exit(0);
}

const report = generateReport(games, dataDir);
printReport(report);

if (values.output) {
  writeFileSync(values.output, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to: ${values.output}`);
}
