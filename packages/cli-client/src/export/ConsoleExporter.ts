/**
 * ConsoleExporter - Outputs results to console
 *
 * Provides rich, formatted console output with:
 * - Summary statistics
 * - Per-deck win rates
 * - Mana curve analysis
 * - Top matchups
 * - Failed game seeds for replay
 */

import type { SimulationResults } from '../types';
import { ResultsExporter, type ExportOptions } from './ResultsExporter';

export class ConsoleExporter extends ResultsExporter {
  getFormat(): string {
    return 'console';
  }

  async export(
    results: SimulationResults,
    playerBotName: string,
    opponentBotName: string,
    _options?: ExportOptions,
  ): Promise<void> {
    console.log('');
    console.log('═'.repeat(60));
    console.log('  SIMULATION RESULTS');
    console.log('═'.repeat(60));
    console.log('');

    // Overall statistics
    console.log(`Total Games: ${results.totalGames}`);
    console.log(`Completed: ${results.gamesCompleted}`);
    if (results.errors > 0) {
      console.log(`Errors: ${results.errors}`);
    }
    console.log('');

    console.log(`${playerBotName}: ${results.playerWins} wins (${this.pct(results.playerWins, results.gamesCompleted)})`);
    console.log(`${opponentBotName}: ${results.opponentWins} wins (${this.pct(results.opponentWins, results.gamesCompleted)})`);
    console.log(`Draws: ${results.draws}`);
    console.log('');

    console.log(`Average Game Length: ${results.averageTurns.toFixed(1)} turns`);
    console.log(`Range: ${results.minTurns} - ${results.maxTurns} turns`);

    // Profile data (if available)
    if (results.profile) {
      console.log('');
      console.log('─'.repeat(60));
      console.log('  PERFORMANCE PROFILE');
      console.log('─'.repeat(60));
      console.log(`Total Time: ${(results.profile.totalMs / 1000).toFixed(2)}s`);
      console.log(`Avg Game: ${results.profile.avgGameMs.toFixed(1)}ms`);
      console.log(`Games/sec: ${results.profile.gamesPerSecond.toFixed(2)}`);
    }

    // Deck statistics
    if (Object.keys(results.deckStats).length > 0) {
      console.log('');
      console.log('─'.repeat(60));
      console.log('  DECK STATISTICS');
      console.log('─'.repeat(60));

      const deckEmoji: Record<string, string> = {
        white_weenie: '⚪👼',
        blue_control: '🔵🧊',
        black_aggro: '⚫💀',
        red_burn: '🔥🟥',
        green_midrange: '🌲🟩',
        unknown: '❓',
      };

      // Sort by win rate
      const sortedDecks = Object.keys(results.deckStats)
        .filter((deckName) => (results.deckStats[deckName]?.games ?? 0) > 0)
        .sort((a, b) => {
          const aStats = results.deckStats[a];
          const bStats = results.deckStats[b];
          if (!aStats || !bStats) return 0;
          const aRate = aStats.wins / aStats.games;
          const bRate = bStats.wins / bStats.games;
          return bRate - aRate;
        });

      for (const deckName of sortedDecks) {
        const stats = results.deckStats[deckName];
        if (!stats) continue;
        const winRate = this.pct(stats.wins, stats.games);
        const name = deckName.charAt(0).toUpperCase() + deckName.slice(1);
        const emoji = deckEmoji[deckName] || '❓';

        // Format mana curve info
        const curveInfo = stats.avgCmc !== undefined ? ` [CMC: ${stats.avgCmc.toFixed(1)}]` : '';

        console.log(
          `${emoji} ${name.padEnd(14)} ${stats.wins}W-${stats.losses}L-${stats.draws}D (${winRate}) [${stats.games} games]${curveInfo}`,
        );
      }

      // Mana Curve Analysis (if enough games played)
      const largeDecks = sortedDecks.filter((d) => (results.deckStats[d]?.games ?? 0) >= 5);
      if (largeDecks.length > 0) {
        console.log('');
        console.log('─'.repeat(60));
        console.log('  MANA CURVE ANALYSIS (5+ games)');
        console.log('─'.repeat(60));

        for (const deckName of largeDecks.slice(0, 5)) {
          const stats = results.deckStats[deckName];
          if (!stats) continue;
          const name = deckName.charAt(0).toUpperCase() + deckName.slice(1);

          if (stats.avgCmc !== undefined && stats.cmcDistribution) {
            const winRate = ((stats.wins / stats.games) * 100).toFixed(0);
            console.log(
              `${name.padEnd(14)} Avg CMC: ${stats.avgCmc.toFixed(2)} | Win Rate: ${winRate}%`,
            );

            // Show distribution bar chart
            const maxCmc = Math.max(...Object.keys(stats.cmcDistribution).map(Number));
            const bars = [];
            for (let cmc = 0; cmc <= Math.min(maxCmc, 7); cmc++) {
              const count = stats.cmcDistribution[cmc] || 0;
              const bar = '█'.repeat(Math.ceil(count / 2)); // Scale down for display
              bars.push(`${cmc}:${bar}${count}`);
            }
            console.log(`  ${bars.join(' ')}`);
          }
        }
      }
    }

    // Top matchups (if enough data)
    const matchupEntries = Object.entries(results.matchups)
      .filter(([_, stats]) => stats.wins + stats.losses + stats.draws >= 2)
      .sort((a, b) => {
        const aTotal = a[1].wins + a[1].losses + a[1].draws;
        const bTotal = b[1].wins + b[1].losses + b[1].draws;
        return bTotal - aTotal;
      })
      .slice(0, 5);

    if (matchupEntries.length > 0) {
      console.log('');
      console.log('─'.repeat(60));
      console.log('  TOP MATCHUPS (P1 perspective)');
      console.log('─'.repeat(60));
      for (const [matchup, stats] of matchupEntries) {
        const total = stats.wins + stats.losses + stats.draws;
        console.log(
          `${matchup}: ${stats.wins}W-${stats.losses}L-${stats.draws}D (${this.pct(stats.wins, total)}) [${total}x]`,
        );
      }
    }

    console.log('═'.repeat(60));

    if (results.errors > 0) {
      console.log(`⚠️  ${results.errors} games encountered errors`);

      if (results.failedSeeds.length > 0) {
        console.log('\n🔬 Failed Game Seeds (for replay):');
        for (const seed of results.failedSeeds) {
          console.log(`   bun src/index.ts replay ${seed} --verbose`);
        }
      }
    }

    if (results.gamesCompleted === results.totalGames && results.errors === 0) {
      console.log('✅ All games completed successfully!');
    }
  }

  /**
   * Calculate percentage with % suffix
   */
  private pct(part: number, total: number): string {
    if (total === 0) return '0%';
    return ((part / total) * 100).toFixed(0) + '%';
  }
}
