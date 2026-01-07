/**
 * Comprehensive Deck Baseline Benchmark
 *
 * Tests all 25+ deck archetypes against each other using GreedyBot.
 * This provides baseline performance data for each deck.
 *
 * Usage:
 *   bun scripts/benchmark-all-decks.ts
 *   bun scripts/benchmark-all-decks.ts --games 50  # Faster, fewer games
 *   bun scripts/benchmark-all-decks.ts --quick     # Quick test (10 games)
 */

import {
  ALL_TEST_DECKS,
  type AllDeckTypes,
  initializeGame,
  getDeckDisplayName,
  type CardTemplate,
  type GameState,
  type PlayerId,
  applyAction,
} from '@manacore/engine';
import { GreedyBot } from '@manacore/ai';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Configuration
// =============================================================================

interface BenchmarkConfig {
  gamesPerMatchup: number;
  maxTurns: number;
  seed: number;
  outputDir: string;
}

interface MatchupResult {
  p1Deck: AllDeckTypes;
  p2Deck: AllDeckTypes;
  p1Wins: number;
  p2Wins: number;
  draws: number;
  totalGames: number;
  p1WinRate: number;
  avgTurns: number;
}

interface DeckStats {
  deck: AllDeckTypes;
  totalWins: number;
  totalGames: number;
  winRate: number;
  vsRecord: Record<string, { wins: number; games: number }>;
}

interface BenchmarkResults {
  config: BenchmarkConfig;
  matchups: MatchupResult[];
  deckStats: Record<AllDeckTypes, DeckStats>;
  timestamp: number;
  duration: number;
}

// =============================================================================
// Game Runner
// =============================================================================

function runGame(
  deck1: CardTemplate[],
  deck2: CardTemplate[],
  seed: number,
  maxTurns: number,
): { winner: PlayerId | null; turns: number } {
  let state = initializeGame(deck1, deck2, seed);
  let turns = 0;

  const bot1 = new GreedyBot(seed, false);
  const bot2 = new GreedyBot(seed + 1, false);

  while (turns < maxTurns) {
    if (state.winner !== null) {
      return { winner: state.winner, turns };
    }

    const bot = state.priorityPlayer === 'player' ? bot1 : bot2;
    const action = bot.chooseAction(state, state.priorityPlayer);

    if (!action) {
      // No valid action, should not happen
      return { winner: null, turns };
    }

    state = applyAction(state, action);
    turns++;
  }

  return { winner: null, turns: maxTurns };
}

// =============================================================================
// Matchup Runner
// =============================================================================

function runMatchup(
  p1DeckName: AllDeckTypes,
  p2DeckName: AllDeckTypes,
  config: BenchmarkConfig,
): MatchupResult {
  const p1Deck = ALL_TEST_DECKS[p1DeckName]();
  const p2Deck = ALL_TEST_DECKS[p2DeckName]();

  let p1Wins = 0;
  let p2Wins = 0;
  let draws = 0;
  let totalTurns = 0;

  for (let i = 0; i < config.gamesPerMatchup; i++) {
    const seed = config.seed + i * 1000;
    const result = runGame(p1Deck, p2Deck, seed, config.maxTurns);

    if (result.winner === 'player') {
      p1Wins++;
    } else if (result.winner === 'opponent') {
      p2Wins++;
    } else {
      draws++;
    }

    totalTurns += result.turns;
  }

  return {
    p1Deck: p1DeckName,
    p2Deck: p2DeckName,
    p1Wins,
    p2Wins,
    draws,
    totalGames: config.gamesPerMatchup,
    p1WinRate: p1Wins / config.gamesPerMatchup,
    avgTurns: totalTurns / config.gamesPerMatchup,
  };
}

// =============================================================================
// Full Benchmark
// =============================================================================

function runFullBenchmark(config: BenchmarkConfig): BenchmarkResults {
  const startTime = Date.now();
  const allDecks = Object.keys(ALL_TEST_DECKS) as AllDeckTypes[];

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     MANACORE DECK BASELINE BENCHMARK (GreedyBot Only)    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log(`📊 Configuration:`);
  console.log(`   Decks: ${allDecks.length}`);
  console.log(`   Games per matchup: ${config.gamesPerMatchup}`);
  console.log(`   Total matchups: ${allDecks.length * (allDecks.length - 1)}`);
  console.log(
    `   Total games: ${allDecks.length * (allDecks.length - 1) * config.gamesPerMatchup}`,
  );
  console.log(`   Max turns: ${config.maxTurns}`);
  console.log(`   Seed: ${config.seed}\n`);

  const matchups: MatchupResult[] = [];
  const deckStats: Record<string, DeckStats> = {};

  // Initialize deck stats
  for (const deck of allDecks) {
    deckStats[deck] = {
      deck,
      totalWins: 0,
      totalGames: 0,
      winRate: 0,
      vsRecord: {},
    };
  }

  // Run all matchups (excluding mirror matches)
  let completed = 0;
  const totalMatchups = allDecks.length * (allDecks.length - 1);

  for (let i = 0; i < allDecks.length; i++) {
    for (let j = 0; j < allDecks.length; j++) {
      if (i === j) continue; // Skip mirror matches

      const p1Deck = allDecks[i]!;
      const p2Deck = allDecks[j]!;

      // Progress update
      completed++;
      const progress = ((completed / totalMatchups) * 100).toFixed(1);
      process.stdout.write(
        `\r⚔️  Progress: ${completed}/${totalMatchups} (${progress}%) | Testing: ${p1Deck} vs ${p2Deck}`.padEnd(
          80,
        ),
      );

      const result = runMatchup(p1Deck, p2Deck, config);
      matchups.push(result);

      // Update stats
      deckStats[p1Deck]!.totalWins += result.p1Wins;
      deckStats[p1Deck]!.totalGames += result.totalGames;

      if (!deckStats[p1Deck]!.vsRecord[p2Deck]) {
        deckStats[p1Deck]!.vsRecord[p2Deck] = { wins: 0, games: 0 };
      }
      deckStats[p1Deck]!.vsRecord[p2Deck]!.wins += result.p1Wins;
      deckStats[p1Deck]!.vsRecord[p2Deck]!.games += result.totalGames;

      deckStats[p2Deck]!.totalWins += result.p2Wins;
      deckStats[p2Deck]!.totalGames += result.totalGames;

      if (!deckStats[p2Deck]!.vsRecord[p1Deck]) {
        deckStats[p2Deck]!.vsRecord[p1Deck] = { wins: 0, games: 0 };
      }
      deckStats[p2Deck]!.vsRecord[p1Deck]!.wins += result.p2Wins;
      deckStats[p2Deck]!.vsRecord[p1Deck]!.games += result.totalGames;
    }
  }

  // Calculate win rates
  for (const deck of allDecks) {
    const stats = deckStats[deck]!;
    stats.winRate = stats.totalGames > 0 ? stats.totalWins / stats.totalGames : 0;
  }

  console.log('\n\n✅ Benchmark complete!\n');

  const duration = Date.now() - startTime;

  return {
    config,
    matchups,
    deckStats: deckStats as Record<AllDeckTypes, DeckStats>,
    timestamp: startTime,
    duration,
  };
}

// =============================================================================
// Results Display
// =============================================================================

function displayResults(results: BenchmarkResults): void {
  const { deckStats, duration } = results;

  // Sort decks by win rate
  const sortedDecks = Object.values(deckStats).sort((a, b) => b.winRate - a.winRate);

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    DECK RANKINGS                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('Rank  Deck                      Win Rate    W-L      Games');
  console.log('────────────────────────────────────────────────────────────');

  for (let i = 0; i < sortedDecks.length; i++) {
    const deck = sortedDecks[i]!;
    const rank = `${i + 1}.`.padStart(4);
    const name = deck.deck.padEnd(25);
    const winRate = `${(deck.winRate * 100).toFixed(1)}%`.padStart(7);
    const record = `${deck.totalWins}-${deck.totalGames - deck.totalWins}`.padStart(9);
    const games = `${deck.totalGames}`.padStart(6);

    console.log(`${rank}  ${name}  ${winRate}    ${record}  ${games}`);
  }

  console.log('\n');
  console.log(`⏱️  Duration: ${(duration / 1000).toFixed(1)}s`);
  console.log(
    `📈 Games/sec: ${((results.matchups.length * results.config.gamesPerMatchup) / (duration / 1000)).toFixed(1)}\n`,
  );
}

// =============================================================================
// Export Functions
// =============================================================================

function exportJSON(results: BenchmarkResults, outputDir: string): void {
  const timestamp = new Date(results.timestamp).toISOString().replace(/[:.]/g, '-');
  const filename = `deck-baseline-${timestamp}.json`;
  const filepath = path.join(outputDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
  console.log(`💾 Results exported to: ${filepath}`);
}

function exportMarkdown(results: BenchmarkResults, outputDir: string): void {
  const timestamp = new Date(results.timestamp).toISOString().replace(/[:.]/g, '-');
  const filename = `deck-baseline-${timestamp}.md`;
  const filepath = path.join(outputDir, filename);

  const lines: string[] = [];
  lines.push('# ManaCore Deck Baseline Benchmark\n');
  lines.push(`**Date:** ${new Date(results.timestamp).toLocaleString()}\n`);
  lines.push(`**Duration:** ${(results.duration / 1000).toFixed(1)}s\n`);
  lines.push('## Configuration\n');
  lines.push(`- **Bot:** GreedyBot`);
  lines.push(`- **Games per matchup:** ${results.config.gamesPerMatchup}`);
  lines.push(`- **Max turns:** ${results.config.maxTurns}`);
  lines.push(`- **Seed:** ${results.config.seed}`);
  lines.push(`- **Total games:** ${results.matchups.length * results.config.gamesPerMatchup}\n`);

  lines.push('## Deck Rankings\n');
  lines.push('| Rank | Deck | Win Rate | Record | Games |');
  lines.push('|------|------|----------|--------|-------|');

  const sortedDecks = Object.values(results.deckStats).sort((a, b) => b.winRate - a.winRate);

  for (let i = 0; i < sortedDecks.length; i++) {
    const deck = sortedDecks[i]!;
    const winRate = `${(deck.winRate * 100).toFixed(1)}%`;
    const record = `${deck.totalWins}-${deck.totalGames - deck.totalWins}`;
    lines.push(`| ${i + 1} | ${deck.deck} | ${winRate} | ${record} | ${deck.totalGames} |`);
  }

  lines.push('\n## Top 5 vs Bottom 5 Matchups\n');

  // Find most lopsided matchups
  const lopsidedMatchups = [...results.matchups]
    .sort((a, b) => Math.abs(b.p1WinRate - 0.5) - Math.abs(a.p1WinRate - 0.5))
    .slice(0, 5);

  lines.push('| Winner | Loser | Win Rate |');
  lines.push('|--------|-------|----------|');

  for (const matchup of lopsidedMatchups) {
    if (matchup.p1WinRate > 0.5) {
      lines.push(
        `| ${matchup.p1Deck} | ${matchup.p2Deck} | ${(matchup.p1WinRate * 100).toFixed(1)}% |`,
      );
    } else {
      lines.push(
        `| ${matchup.p2Deck} | ${matchup.p1Deck} | ${((1 - matchup.p1WinRate) * 100).toFixed(1)}% |`,
      );
    }
  }

  fs.writeFileSync(filepath, lines.join('\n'));
  console.log(`📄 Markdown report exported to: ${filepath}`);
}

function exportCSV(results: BenchmarkResults, outputDir: string): void {
  const timestamp = new Date(results.timestamp).toISOString().replace(/[:.]/g, '-');
  const filename = `deck-baseline-${timestamp}.csv`;
  const filepath = path.join(outputDir, filename);

  const lines: string[] = [];
  lines.push('Rank,Deck,WinRate,Wins,Losses,Games');

  const sortedDecks = Object.values(results.deckStats).sort((a, b) => b.winRate - a.winRate);

  for (let i = 0; i < sortedDecks.length; i++) {
    const deck = sortedDecks[i]!;
    lines.push(
      `${i + 1},${deck.deck},${deck.winRate.toFixed(4)},${deck.totalWins},${deck.totalGames - deck.totalWins},${deck.totalGames}`,
    );
  }

  fs.writeFileSync(filepath, lines.join('\n'));
  console.log(`📊 CSV exported to: ${filepath}`);
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let gamesPerMatchup = 100;
  let quick = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--games' && i + 1 < args.length) {
      gamesPerMatchup = parseInt(args[i + 1]!, 10);
      i++;
    } else if (args[i] === '--quick') {
      quick = true;
      gamesPerMatchup = 10;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: bun scripts/benchmark-all-decks.ts [options]');
      console.log('');
      console.log('Options:');
      console.log('  --games N    Number of games per matchup (default: 100)');
      console.log('  --quick      Quick test mode (10 games per matchup)');
      console.log('  --help       Show this help');
      console.log('');
      console.log('Examples:');
      console.log('  bun scripts/benchmark-all-decks.ts');
      console.log('  bun scripts/benchmark-all-decks.ts --games 50');
      console.log('  bun scripts/benchmark-all-decks.ts --quick');
      process.exit(0);
    }
  }

  const config: BenchmarkConfig = {
    gamesPerMatchup,
    maxTurns: 100,
    seed: Date.now(),
    outputDir: path.join(process.cwd(), 'output', 'baseline'),
  };

  // Ensure output directory exists
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }

  // Run benchmark
  const results = runFullBenchmark(config);

  // Display results
  displayResults(results);

  // Export results
  exportJSON(results, config.outputDir);
  exportMarkdown(results, config.outputDir);
  exportCSV(results, config.outputDir);

  console.log('\n✨ All done!\n');
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
