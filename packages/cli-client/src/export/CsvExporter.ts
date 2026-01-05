/**
 * CsvExporter - Exports results as CSV
 *
 * Provides tabular CSV output suitable for:
 * - Spreadsheet analysis
 * - Statistical tools (R, Python pandas)
 * - Database import
 */

import type { SimulationResults } from '../types';
import { ResultsExporter, type ExportOptions } from './ResultsExporter';

export class CsvExporter extends ResultsExporter {
  getFormat(): string {
    return 'csv';
  }

  async export(
    results: SimulationResults,
    playerBotName: string,
    opponentBotName: string,
    options?: ExportOptions,
  ): Promise<string> {
    // Generate CSV with per-game details
    const lines: string[] = [];

    // Header
    lines.push('game_number,seed,winner,turns,player_deck,opponent_deck,duration_ms,error');

    // Data rows
    for (const game of results.gameRecords) {
      const row = [
        game.gameNumber,
        game.seed,
        game.winner || 'draw',
        game.turns,
        game.playerDeck,
        game.opponentDeck,
        game.durationMs || '',
        game.error ? `"${game.error.replace(/"/g, '""')}"` : '',
      ];
      lines.push(row.join(','));
    }

    // Add summary section
    lines.push('');
    lines.push('# Summary');
    lines.push(`total_games,${results.totalGames}`);
    lines.push(`games_completed,${results.gamesCompleted}`);
    lines.push(`player_wins,${results.playerWins}`);
    lines.push(`opponent_wins,${results.opponentWins}`);
    lines.push(`draws,${results.draws}`);
    lines.push(`errors,${results.errors}`);
    lines.push(`avg_turns,${results.averageTurns.toFixed(2)}`);
    lines.push(`min_turns,${results.minTurns}`);
    lines.push(`max_turns,${results.maxTurns}`);
    lines.push(`base_seed,${results.baseSeed}`);
    lines.push(`player_bot,${playerBotName}`);
    lines.push(`opponent_bot,${opponentBotName}`);

    const csvString = lines.join('\n');

    if (options?.outputPath) {
      await Bun.write(options.outputPath, csvString);
      console.log(`\n📊 Results exported to: ${options.outputPath}`);
      return options.outputPath;
    }

    return csvString;
  }
}
