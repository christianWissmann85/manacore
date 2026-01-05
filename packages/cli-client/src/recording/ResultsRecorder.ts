/**
 * ResultsRecorder - Tracks simulation results and statistics
 *
 * Responsible for:
 * - Recording individual game outcomes
 * - Aggregating deck and matchup statistics
 * - Tracking failed game seeds
 * - Computing mana curve statistics
 */

import type { CardTemplate } from '@manacore/engine';
import type { SimulationResults, GameResult, DeckStats } from '../types';

export class ResultsRecorder {
  private results: SimulationResults;

  constructor(baseSeed: number, totalGames: number) {
    this.results = {
      totalGames,
      playerWins: 0,
      opponentWins: 0,
      draws: 0,
      averageTurns: 0,
      minTurns: Infinity,
      maxTurns: 0,
      errors: 0,
      gamesCompleted: 0,
      deckStats: {},
      matchups: {},
      gameRecords: [],
      baseSeed,
      failedSeeds: [],
    };
  }

  /**
   * Record a successful game completion
   */
  recordGame(gameNumber: number, seed: number, result: GameResult): void {
    this.results.gamesCompleted++;
    this.results.minTurns = Math.min(this.results.minTurns, result.turns);
    this.results.maxTurns = Math.max(this.results.maxTurns, result.turns);

    // Initialize deck stats if needed
    this.ensureDeckStats(result.playerDeck, result.playerDeckCards);
    this.ensureDeckStats(result.opponentDeck, result.opponentDeckCards);

    // Update matchup stats
    const matchupKey = this.getMatchupKey(result.playerDeck, result.opponentDeck);
    if (!this.results.matchups[matchupKey]) {
      this.results.matchups[matchupKey] = { wins: 0, losses: 0, draws: 0 };
    }

    // Track game outcome
    const playerDeckStats = this.results.deckStats[result.playerDeck];
    const opponentDeckStats = this.results.deckStats[result.opponentDeck];
    const matchupStats = this.results.matchups[matchupKey];

    if (!playerDeckStats || !opponentDeckStats || !matchupStats) return;

    playerDeckStats.games++;
    opponentDeckStats.games++;

    if (result.winner === 'player') {
      this.results.playerWins++;
      playerDeckStats.wins++;
      opponentDeckStats.losses++;
      matchupStats.wins++;
    } else if (result.winner === 'opponent') {
      this.results.opponentWins++;
      playerDeckStats.losses++;
      opponentDeckStats.wins++;
      matchupStats.losses++;
    } else {
      this.results.draws++;
      playerDeckStats.draws++;
      opponentDeckStats.draws++;
      matchupStats.draws++;
    }

    // Record game details
    this.results.gameRecords.push({
      gameNumber,
      seed,
      winner: result.winner,
      turns: result.turns,
      playerDeck: result.playerDeck,
      opponentDeck: result.opponentDeck,
      durationMs: result.durationMs,
    });
  }

  /**
   * Record a failed game
   */
  recordError(gameNumber: number, seed: number, error: Error): void {
    this.results.errors++;
    this.results.failedSeeds.push(seed);

    this.results.gameRecords.push({
      gameNumber,
      seed,
      winner: null,
      turns: 0,
      playerDeck: 'unknown',
      opponentDeck: 'unknown',
      error: error.message,
    });
  }

  /**
   * Finalize results (compute averages, etc.)
   */
  finalize(): SimulationResults {
    // Calculate average turns
    const totalTurns = this.results.gameRecords.reduce((sum, game) => sum + game.turns, 0);
    this.results.averageTurns =
      this.results.gamesCompleted > 0 ? totalTurns / this.results.gamesCompleted : 0;

    // Fix infinity minTurns
    if (this.results.minTurns === Infinity) {
      this.results.minTurns = 0;
    }

    return this.results;
  }

  /**
   * Get current results (without finalizing)
   */
  getResults(): SimulationResults {
    return this.results;
  }

  /**
   * Set profile data
   */
  setProfileData(profile: SimulationResults['profile']): void {
    this.results.profile = profile;
  }

  /**
   * Ensure deck stats exist and include mana curve data
   */
  private ensureDeckStats(deckName: string, deckCards?: CardTemplate[]): void {
    if (!this.results.deckStats[deckName]) {
      const stats: DeckStats = {
        wins: 0,
        losses: 0,
        draws: 0,
        games: 0,
      };

      // Calculate mana curve if we have the deck data
      if (deckCards) {
        const curveStats = this.calculateManaCurve(deckCards);
        stats.avgCmc = curveStats.avgCmc;
        stats.cmcDistribution = curveStats.cmcDistribution;
      }

      this.results.deckStats[deckName] = stats;
    }
  }

  /**
   * Calculate mana curve statistics for a deck
   */
  private calculateManaCurve(deck: CardTemplate[]): {
    avgCmc: number;
    cmcDistribution: Record<number, number>;
  } {
    const nonLands = deck.filter((card) => !card.type_line?.includes('Land'));
    const cmcDistribution: Record<number, number> = {};
    let totalCmc = 0;

    for (const card of nonLands) {
      const cmc = card.cmc || 0;
      cmcDistribution[cmc] = (cmcDistribution[cmc] || 0) + 1;
      totalCmc += cmc;
    }

    const avgCmc = nonLands.length > 0 ? totalCmc / nonLands.length : 0;

    return { avgCmc, cmcDistribution };
  }

  /**
   * Generate matchup key
   */
  private getMatchupKey(deck1: string, deck2: string): string {
    return `${deck1} vs ${deck2}`;
  }
}
