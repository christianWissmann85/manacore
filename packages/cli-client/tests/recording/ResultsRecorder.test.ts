/**
 * ResultsRecorder Tests
 *
 * Comprehensive tests for the ResultsRecorder module which tracks
 * simulation results and statistics.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { ResultsRecorder } from '../../src/recording/ResultsRecorder';
import { createGameResult, createDeckStats, assertValidSimulationResults } from '../helpers';
import type { GameResult } from '../../src/types';

describe('ResultsRecorder', () => {
  describe('Constructor and initialization', () => {
    test('creates with default values', () => {
      const recorder = new ResultsRecorder(12345, 100);
      const results = recorder.getResults();

      expect(results.baseSeed).toBe(12345);
      expect(results.totalGames).toBe(100);
      expect(results.playerWins).toBe(0);
      expect(results.opponentWins).toBe(0);
      expect(results.draws).toBe(0);
      expect(results.errors).toBe(0);
      expect(results.gamesCompleted).toBe(0);
      expect(results.averageTurns).toBe(0);
      expect(results.minTurns).toBe(Infinity);
      expect(results.maxTurns).toBe(0);
      expect(results.gameRecords).toEqual([]);
      expect(results.failedSeeds).toEqual([]);
      expect(Object.keys(results.deckStats)).toHaveLength(0);
      expect(Object.keys(results.matchups)).toHaveLength(0);
    });

    test('accepts different configuration values', () => {
      const recorder1 = new ResultsRecorder(1, 10);
      const recorder2 = new ResultsRecorder(99999, 1000);

      expect(recorder1.getResults().baseSeed).toBe(1);
      expect(recorder1.getResults().totalGames).toBe(10);

      expect(recorder2.getResults().baseSeed).toBe(99999);
      expect(recorder2.getResults().totalGames).toBe(1000);
    });

    test('initializes with zero seed', () => {
      const recorder = new ResultsRecorder(0, 50);
      const results = recorder.getResults();

      expect(results.baseSeed).toBe(0);
      expect(results.totalGames).toBe(50);
    });
  });

  describe('Recording game results', () => {
    let recorder: ResultsRecorder;

    beforeEach(() => {
      recorder = new ResultsRecorder(12345, 10);
    });

    test('recordGame() with player win', () => {
      const gameResult = createGameResult({
        winner: 'player',
        turns: 15,
        playerDeck: 'RedDeck',
        opponentDeck: 'GreenDeck',
      });

      recorder.recordGame(1, 12345, gameResult);
      const results = recorder.getResults();

      expect(results.gamesCompleted).toBe(1);
      expect(results.playerWins).toBe(1);
      expect(results.opponentWins).toBe(0);
      expect(results.draws).toBe(0);
      expect(results.gameRecords).toHaveLength(1);
      expect(results.gameRecords[0].winner).toBe('player');
      expect(results.gameRecords[0].turns).toBe(15);
    });

    test('recordGame() with opponent win', () => {
      const gameResult = createGameResult({
        winner: 'opponent',
        turns: 20,
        playerDeck: 'RedDeck',
        opponentDeck: 'GreenDeck',
      });

      recorder.recordGame(1, 12345, gameResult);
      const results = recorder.getResults();

      expect(results.gamesCompleted).toBe(1);
      expect(results.playerWins).toBe(0);
      expect(results.opponentWins).toBe(1);
      expect(results.draws).toBe(0);
    });

    test('recordGame() with draw', () => {
      const gameResult = createGameResult({
        winner: null,
        turns: 100,
        playerDeck: 'RedDeck',
        opponentDeck: 'GreenDeck',
      });

      recorder.recordGame(1, 12345, gameResult);
      const results = recorder.getResults();

      expect(results.gamesCompleted).toBe(1);
      expect(results.playerWins).toBe(0);
      expect(results.opponentWins).toBe(0);
      expect(results.draws).toBe(1);
    });

    test('tracks turn counts correctly', () => {
      const games: GameResult[] = [
        createGameResult({ winner: 'player', turns: 10 }),
        createGameResult({ winner: 'opponent', turns: 5 }),
        createGameResult({ winner: 'player', turns: 25 }),
      ];

      games.forEach((game, index) => {
        recorder.recordGame(index + 1, 12345 + index, game);
      });

      const results = recorder.getResults();

      expect(results.minTurns).toBe(5);
      expect(results.maxTurns).toBe(25);
    });

    test('records game number and seed in game records', () => {
      const gameResult = createGameResult({
        winner: 'player',
        turns: 12,
        playerDeck: 'Deck1',
        opponentDeck: 'Deck2',
      });

      recorder.recordGame(42, 99999, gameResult);
      const results = recorder.getResults();

      expect(results.gameRecords[0].gameNumber).toBe(42);
      expect(results.gameRecords[0].seed).toBe(99999);
    });

    test('records duration when provided', () => {
      const gameResult = createGameResult({
        winner: 'player',
        turns: 10,
        durationMs: 150,
      });

      recorder.recordGame(1, 12345, gameResult);
      const results = recorder.getResults();

      expect(results.gameRecords[0].durationMs).toBe(150);
    });

    test('handles multiple games sequentially', () => {
      for (let i = 0; i < 5; i++) {
        const winner = i % 2 === 0 ? 'player' : 'opponent';
        const gameResult = createGameResult({
          winner: winner as 'player' | 'opponent',
          turns: 10 + i,
          playerDeck: 'DeckA',
          opponentDeck: 'DeckB',
        });
        recorder.recordGame(i + 1, 12345 + i, gameResult);
      }

      const results = recorder.getResults();

      expect(results.gamesCompleted).toBe(5);
      expect(results.playerWins).toBe(3); // Games 0, 2, 4
      expect(results.opponentWins).toBe(2); // Games 1, 3
      expect(results.gameRecords).toHaveLength(5);
    });
  });

  describe('Statistics aggregation', () => {
    let recorder: ResultsRecorder;

    beforeEach(() => {
      recorder = new ResultsRecorder(12345, 10);
    });

    test('getResults() returns correct totals', () => {
      const games: GameResult[] = [
        createGameResult({ winner: 'player', turns: 10, playerDeck: 'A', opponentDeck: 'B' }),
        createGameResult({ winner: 'player', turns: 12, playerDeck: 'A', opponentDeck: 'B' }),
        createGameResult({ winner: 'opponent', turns: 8, playerDeck: 'A', opponentDeck: 'B' }),
        createGameResult({ winner: null, turns: 100, playerDeck: 'A', opponentDeck: 'B' }),
      ];

      games.forEach((game, index) => {
        recorder.recordGame(index + 1, 12345 + index, game);
      });

      const results = recorder.getResults();

      expect(results.gamesCompleted).toBe(4);
      expect(results.playerWins).toBe(2);
      expect(results.opponentWins).toBe(1);
      expect(results.draws).toBe(1);
    });

    test('average turns calculated correctly after finalize()', () => {
      const games: GameResult[] = [
        createGameResult({ winner: 'player', turns: 10, playerDeck: 'A', opponentDeck: 'B' }),
        createGameResult({ winner: 'player', turns: 20, playerDeck: 'A', opponentDeck: 'B' }),
        createGameResult({ winner: 'opponent', turns: 30, playerDeck: 'A', opponentDeck: 'B' }),
      ];

      games.forEach((game, index) => {
        recorder.recordGame(index + 1, 12345 + index, game);
      });

      const results = recorder.finalize();

      // (10 + 20 + 30) / 3 = 20
      expect(results.averageTurns).toBe(20);
    });

    test('deck statistics tracked per deck', () => {
      const games: GameResult[] = [
        createGameResult({
          winner: 'player',
          turns: 10,
          playerDeck: 'RedDeck',
          opponentDeck: 'GreenDeck',
        }),
        createGameResult({
          winner: 'player',
          turns: 12,
          playerDeck: 'RedDeck',
          opponentDeck: 'BlueDeck',
        }),
        createGameResult({
          winner: 'opponent',
          turns: 8,
          playerDeck: 'WhiteDeck',
          opponentDeck: 'GreenDeck',
        }),
      ];

      games.forEach((game, index) => {
        recorder.recordGame(index + 1, 12345 + index, game);
      });

      const results = recorder.getResults();

      // RedDeck: 2 wins, 0 losses
      expect(results.deckStats['RedDeck'].wins).toBe(2);
      expect(results.deckStats['RedDeck'].losses).toBe(0);
      expect(results.deckStats['RedDeck'].games).toBe(2);

      // GreenDeck: 1 win (when it was opponent and player lost), 1 loss (when player won)
      expect(results.deckStats['GreenDeck'].wins).toBe(1);
      expect(results.deckStats['GreenDeck'].losses).toBe(1);
      expect(results.deckStats['GreenDeck'].games).toBe(2);

      // BlueDeck: 0 wins, 1 loss
      expect(results.deckStats['BlueDeck'].wins).toBe(0);
      expect(results.deckStats['BlueDeck'].losses).toBe(1);
      expect(results.deckStats['BlueDeck'].games).toBe(1);

      // WhiteDeck: 0 wins, 1 loss
      expect(results.deckStats['WhiteDeck'].wins).toBe(0);
      expect(results.deckStats['WhiteDeck'].losses).toBe(1);
      expect(results.deckStats['WhiteDeck'].games).toBe(1);
    });

    test('win rates can be calculated from deck stats', () => {
      const games: GameResult[] = [
        createGameResult({
          winner: 'player',
          turns: 10,
          playerDeck: 'TestDeck',
          opponentDeck: 'Other',
        }),
        createGameResult({
          winner: 'player',
          turns: 12,
          playerDeck: 'TestDeck',
          opponentDeck: 'Other',
        }),
        createGameResult({
          winner: 'player',
          turns: 8,
          playerDeck: 'TestDeck',
          opponentDeck: 'Other',
        }),
        createGameResult({
          winner: 'opponent',
          turns: 15,
          playerDeck: 'TestDeck',
          opponentDeck: 'Other',
        }),
      ];

      games.forEach((game, index) => {
        recorder.recordGame(index + 1, 12345 + index, game);
      });

      const results = recorder.getResults();
      const testDeckStats = results.deckStats['TestDeck'];

      // 3 wins out of 4 games = 75%
      const winRate = testDeckStats.wins / testDeckStats.games;
      expect(winRate).toBe(0.75);
    });
  });

  describe('Matchup tracking', () => {
    let recorder: ResultsRecorder;

    beforeEach(() => {
      recorder = new ResultsRecorder(12345, 10);
    });

    test('records matchup-specific win rates', () => {
      const games: GameResult[] = [
        createGameResult({ winner: 'player', turns: 10, playerDeck: 'Red', opponentDeck: 'Green' }),
        createGameResult({ winner: 'player', turns: 12, playerDeck: 'Red', opponentDeck: 'Green' }),
        createGameResult({
          winner: 'opponent',
          turns: 8,
          playerDeck: 'Red',
          opponentDeck: 'Green',
        }),
      ];

      games.forEach((game, index) => {
        recorder.recordGame(index + 1, 12345 + index, game);
      });

      const results = recorder.getResults();
      const matchup = results.matchups['Red vs Green'];

      expect(matchup).toBeDefined();
      expect(matchup.wins).toBe(2);
      expect(matchup.losses).toBe(1);
      expect(matchup.draws).toBe(0);
    });

    test('tracks multiple different matchups', () => {
      const games: GameResult[] = [
        createGameResult({ winner: 'player', turns: 10, playerDeck: 'Red', opponentDeck: 'Green' }),
        createGameResult({
          winner: 'player',
          turns: 12,
          playerDeck: 'Blue',
          opponentDeck: 'White',
        }),
        createGameResult({ winner: 'opponent', turns: 8, playerDeck: 'Red', opponentDeck: 'Blue' }),
      ];

      games.forEach((game, index) => {
        recorder.recordGame(index + 1, 12345 + index, game);
      });

      const results = recorder.getResults();

      expect(Object.keys(results.matchups)).toHaveLength(3);
      expect(results.matchups['Red vs Green']).toBeDefined();
      expect(results.matchups['Blue vs White']).toBeDefined();
      expect(results.matchups['Red vs Blue']).toBeDefined();
    });

    test('handles mirror matches correctly', () => {
      const games: GameResult[] = [
        createGameResult({ winner: 'player', turns: 10, playerDeck: 'Red', opponentDeck: 'Red' }),
        createGameResult({ winner: 'opponent', turns: 12, playerDeck: 'Red', opponentDeck: 'Red' }),
        createGameResult({ winner: null, turns: 100, playerDeck: 'Red', opponentDeck: 'Red' }),
      ];

      games.forEach((game, index) => {
        recorder.recordGame(index + 1, 12345 + index, game);
      });

      const results = recorder.getResults();
      const mirrorMatchup = results.matchups['Red vs Red'];

      expect(mirrorMatchup).toBeDefined();
      expect(mirrorMatchup.wins).toBe(1);
      expect(mirrorMatchup.losses).toBe(1);
      expect(mirrorMatchup.draws).toBe(1);

      // In mirror matches, deck stats should track both sides
      expect(results.deckStats['Red'].games).toBe(6); // 3 games x 2 sides
      expect(results.deckStats['Red'].wins).toBe(2); // Each game has one winner and one loser from same deck
      expect(results.deckStats['Red'].losses).toBe(2);
      expect(results.deckStats['Red'].draws).toBe(2);
    });

    test('tracks draws in matchups', () => {
      const games: GameResult[] = [
        createGameResult({ winner: null, turns: 100, playerDeck: 'A', opponentDeck: 'B' }),
        createGameResult({ winner: null, turns: 100, playerDeck: 'A', opponentDeck: 'B' }),
      ];

      games.forEach((game, index) => {
        recorder.recordGame(index + 1, 12345 + index, game);
      });

      const results = recorder.getResults();
      const matchup = results.matchups['A vs B'];

      expect(matchup.wins).toBe(0);
      expect(matchup.losses).toBe(0);
      expect(matchup.draws).toBe(2);
    });
  });

  describe('Error handling', () => {
    let recorder: ResultsRecorder;

    beforeEach(() => {
      recorder = new ResultsRecorder(12345, 10);
    });

    test('records errors with recordError()', () => {
      const error = new Error('Game crashed');

      recorder.recordError(1, 12345, error);
      const results = recorder.getResults();

      expect(results.errors).toBe(1);
      expect(results.failedSeeds).toContain(12345);
      expect(results.gameRecords).toHaveLength(1);
      expect(results.gameRecords[0].error).toBe('Game crashed');
      expect(results.gameRecords[0].winner).toBeNull();
      expect(results.gameRecords[0].turns).toBe(0);
    });

    test('error count tracked correctly with multiple errors', () => {
      recorder.recordError(1, 12345, new Error('Error 1'));
      recorder.recordError(2, 12346, new Error('Error 2'));
      recorder.recordError(3, 12347, new Error('Error 3'));

      const results = recorder.getResults();

      expect(results.errors).toBe(3);
      expect(results.failedSeeds).toHaveLength(3);
      expect(results.failedSeeds).toContain(12345);
      expect(results.failedSeeds).toContain(12346);
      expect(results.failedSeeds).toContain(12347);
    });

    test('error records have unknown deck names', () => {
      recorder.recordError(1, 12345, new Error('Test error'));
      const results = recorder.getResults();

      expect(results.gameRecords[0].playerDeck).toBe('unknown');
      expect(results.gameRecords[0].opponentDeck).toBe('unknown');
    });

    test('errors do not increment gamesCompleted', () => {
      recorder.recordGame(1, 12345, createGameResult({ winner: 'player' }));
      recorder.recordError(2, 12346, new Error('Error'));
      recorder.recordGame(3, 12347, createGameResult({ winner: 'opponent' }));

      const results = recorder.getResults();

      expect(results.gamesCompleted).toBe(2);
      expect(results.errors).toBe(1);
      expect(results.gameRecords).toHaveLength(3);
    });

    test('mixed successful games and errors', () => {
      recorder.recordGame(1, 12345, createGameResult({ winner: 'player', turns: 10 }));
      recorder.recordError(2, 12346, new Error('Error 1'));
      recorder.recordGame(3, 12347, createGameResult({ winner: 'opponent', turns: 15 }));
      recorder.recordError(4, 12348, new Error('Error 2'));
      recorder.recordGame(5, 12349, createGameResult({ winner: 'player', turns: 12 }));

      const results = recorder.finalize();

      expect(results.gamesCompleted).toBe(3);
      expect(results.errors).toBe(2);
      expect(results.playerWins).toBe(2);
      expect(results.opponentWins).toBe(1);
      expect(results.failedSeeds).toEqual([12346, 12348]);
      // Average turns should only count successful games: (10 + 15 + 12 + 0 + 0) / 3 = 12.33...
      // But error games have turns=0 in records, so: (10 + 0 + 15 + 0 + 12) / 3 = 12.33
      expect(results.averageTurns).toBeCloseTo(12.33, 1);
    });
  });

  describe('Edge cases', () => {
    test('no games recorded', () => {
      const recorder = new ResultsRecorder(12345, 10);
      const results = recorder.finalize();

      expect(results.gamesCompleted).toBe(0);
      expect(results.playerWins).toBe(0);
      expect(results.opponentWins).toBe(0);
      expect(results.draws).toBe(0);
      expect(results.errors).toBe(0);
      expect(results.averageTurns).toBe(0);
      expect(results.minTurns).toBe(0); // Fixed from Infinity
      expect(results.maxTurns).toBe(0);
      expect(results.gameRecords).toHaveLength(0);
    });

    test('all wins scenario', () => {
      const recorder = new ResultsRecorder(12345, 5);

      for (let i = 0; i < 5; i++) {
        recorder.recordGame(
          i + 1,
          12345 + i,
          createGameResult({ winner: 'player', turns: 10 + i, playerDeck: 'A', opponentDeck: 'B' }),
        );
      }

      const results = recorder.finalize();

      expect(results.playerWins).toBe(5);
      expect(results.opponentWins).toBe(0);
      expect(results.draws).toBe(0);
      expect(results.gamesCompleted).toBe(5);

      // Player deck should have 100% win rate
      expect(results.deckStats['A'].wins).toBe(5);
      expect(results.deckStats['A'].losses).toBe(0);
    });

    test('all losses scenario', () => {
      const recorder = new ResultsRecorder(12345, 5);

      for (let i = 0; i < 5; i++) {
        recorder.recordGame(
          i + 1,
          12345 + i,
          createGameResult({
            winner: 'opponent',
            turns: 10 + i,
            playerDeck: 'A',
            opponentDeck: 'B',
          }),
        );
      }

      const results = recorder.finalize();

      expect(results.playerWins).toBe(0);
      expect(results.opponentWins).toBe(5);
      expect(results.draws).toBe(0);
      expect(results.gamesCompleted).toBe(5);

      // Player deck should have 0% win rate
      expect(results.deckStats['A'].wins).toBe(0);
      expect(results.deckStats['A'].losses).toBe(5);
    });

    test('single game scenario - player wins', () => {
      const recorder = new ResultsRecorder(12345, 1);

      recorder.recordGame(
        1,
        12345,
        createGameResult({
          winner: 'player',
          turns: 15,
          playerDeck: 'Solo',
          opponentDeck: 'Enemy',
        }),
      );

      const results = recorder.finalize();

      expect(results.gamesCompleted).toBe(1);
      expect(results.playerWins).toBe(1);
      expect(results.averageTurns).toBe(15);
      expect(results.minTurns).toBe(15);
      expect(results.maxTurns).toBe(15);
    });

    test('single game scenario - error only', () => {
      const recorder = new ResultsRecorder(12345, 1);

      recorder.recordError(1, 12345, new Error('Only game failed'));

      const results = recorder.finalize();

      expect(results.gamesCompleted).toBe(0);
      expect(results.errors).toBe(1);
      expect(results.playerWins).toBe(0);
      expect(results.averageTurns).toBe(0);
      expect(results.failedSeeds).toEqual([12345]);
    });

    test('very large turn counts', () => {
      const recorder = new ResultsRecorder(12345, 2);

      recorder.recordGame(
        1,
        12345,
        createGameResult({ winner: 'player', turns: 1000, playerDeck: 'A', opponentDeck: 'B' }),
      );
      recorder.recordGame(
        2,
        12346,
        createGameResult({ winner: 'opponent', turns: 2000, playerDeck: 'A', opponentDeck: 'B' }),
      );

      const results = recorder.finalize();

      expect(results.minTurns).toBe(1000);
      expect(results.maxTurns).toBe(2000);
      expect(results.averageTurns).toBe(1500);
    });

    test('zero turn game', () => {
      const recorder = new ResultsRecorder(12345, 1);

      // Edge case: game ends on turn 0 (immediate loss)
      recorder.recordGame(
        1,
        12345,
        createGameResult({ winner: 'opponent', turns: 0, playerDeck: 'A', opponentDeck: 'B' }),
      );

      const results = recorder.finalize();

      expect(results.minTurns).toBe(0);
      expect(results.maxTurns).toBe(0);
      expect(results.averageTurns).toBe(0);
    });
  });

  describe('Profile data', () => {
    test('setProfileData() sets profile correctly', () => {
      const recorder = new ResultsRecorder(12345, 10);

      const profileData = {
        totalMs: 5000,
        avgGameMs: 50,
        gamesPerSecond: 20,
      };

      recorder.setProfileData(profileData);
      const results = recorder.getResults();

      expect(results.profile).toBeDefined();
      expect(results.profile?.totalMs).toBe(5000);
      expect(results.profile?.avgGameMs).toBe(50);
      expect(results.profile?.gamesPerSecond).toBe(20);
    });

    test('profile data preserved after finalize()', () => {
      const recorder = new ResultsRecorder(12345, 10);

      recorder.setProfileData({
        totalMs: 1000,
        avgGameMs: 100,
        gamesPerSecond: 10,
      });

      recorder.recordGame(1, 12345, createGameResult({ winner: 'player' }));

      const results = recorder.finalize();

      expect(results.profile).toBeDefined();
      expect(results.profile?.gamesPerSecond).toBe(10);
    });
  });

  describe('Mana curve statistics', () => {
    test('calculates mana curve when deck cards provided', () => {
      const recorder = new ResultsRecorder(12345, 1);

      // Create mock card templates with different CMCs
      const mockCards = [
        { name: 'Mountain', type_line: 'Basic Land - Mountain', cmc: 0 },
        { name: 'Lightning Bolt', type_line: 'Instant', cmc: 1 },
        { name: 'Lightning Bolt', type_line: 'Instant', cmc: 1 },
        { name: 'Goblin Guide', type_line: 'Creature - Goblin', cmc: 1 },
        { name: 'Ash Zealot', type_line: 'Creature - Human Warrior', cmc: 2 },
        { name: 'Ball Lightning', type_line: 'Creature - Elemental', cmc: 3 },
      ];

      const gameResult = createGameResult({
        winner: 'player',
        turns: 10,
        playerDeck: 'TestDeck',
        opponentDeck: 'EnemyDeck',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        playerDeckCards: mockCards as any,
      });

      recorder.recordGame(1, 12345, gameResult);
      const results = recorder.getResults();

      const deckStats = results.deckStats['TestDeck'];
      expect(deckStats).toBeDefined();

      // avgCmc should only count non-lands
      // Non-lands: 1 + 1 + 1 + 2 + 3 = 8, count = 5
      // avgCmc = 8 / 5 = 1.6
      expect(deckStats.avgCmc).toBe(1.6);

      // cmcDistribution should show counts by CMC
      expect(deckStats.cmcDistribution?.[1]).toBe(3); // 3 cards at CMC 1
      expect(deckStats.cmcDistribution?.[2]).toBe(1); // 1 card at CMC 2
      expect(deckStats.cmcDistribution?.[3]).toBe(1); // 1 card at CMC 3
    });

    test('deck stats created without mana curve when no cards provided', () => {
      const recorder = new ResultsRecorder(12345, 1);

      const gameResult = createGameResult({
        winner: 'player',
        turns: 10,
        playerDeck: 'NoCurve',
        opponentDeck: 'Enemy',
        // No playerDeckCards provided
      });

      recorder.recordGame(1, 12345, gameResult);
      const results = recorder.getResults();

      const deckStats = results.deckStats['NoCurve'];
      expect(deckStats).toBeDefined();
      expect(deckStats.avgCmc).toBeUndefined();
      expect(deckStats.cmcDistribution).toBeUndefined();
    });
  });

  describe('Finalize behavior', () => {
    test('finalize() fixes infinity minTurns when no games played', () => {
      const recorder = new ResultsRecorder(12345, 10);
      const results = recorder.finalize();

      expect(results.minTurns).toBe(0);
      expect(results.minTurns).not.toBe(Infinity);
    });

    test('finalize() calculates correct average with error games', () => {
      const recorder = new ResultsRecorder(12345, 4);

      recorder.recordGame(
        1,
        12345,
        createGameResult({ winner: 'player', turns: 10, playerDeck: 'A', opponentDeck: 'B' }),
      );
      recorder.recordError(2, 12346, new Error('Failed'));
      recorder.recordGame(
        3,
        12347,
        createGameResult({ winner: 'opponent', turns: 20, playerDeck: 'A', opponentDeck: 'B' }),
      );

      const results = recorder.finalize();

      // Error games have turns=0 in records
      // Total turns from records: 10 + 0 + 20 = 30
      // But average is calculated as totalTurns / gamesCompleted
      // gamesCompleted = 2, so average = 30 / 2 = 15
      expect(results.averageTurns).toBe(15);
    });

    test('getResults() returns current state without modifying', () => {
      const recorder = new ResultsRecorder(12345, 10);

      recorder.recordGame(1, 12345, createGameResult({ winner: 'player', turns: 10 }));

      // Get results before finalize
      const beforeFinalize = recorder.getResults();
      expect(beforeFinalize.averageTurns).toBe(0); // Not calculated yet

      // Finalize
      const afterFinalize = recorder.finalize();
      expect(afterFinalize.averageTurns).toBe(10); // Now calculated

      // getResults should now return the finalized value
      const afterFinalizeGet = recorder.getResults();
      expect(afterFinalizeGet.averageTurns).toBe(10);
    });
  });

  describe('Integration with assertValidSimulationResults', () => {
    test('finalized results pass validation', () => {
      const recorder = new ResultsRecorder(12345, 5);

      // Record some games
      recorder.recordGame(
        1,
        12345,
        createGameResult({ winner: 'player', turns: 10, playerDeck: 'A', opponentDeck: 'B' }),
      );
      recorder.recordGame(
        2,
        12346,
        createGameResult({ winner: 'opponent', turns: 15, playerDeck: 'A', opponentDeck: 'B' }),
      );
      recorder.recordGame(
        3,
        12347,
        createGameResult({ winner: 'player', turns: 12, playerDeck: 'A', opponentDeck: 'B' }),
      );
      recorder.recordError(4, 12348, new Error('Game failed'));
      recorder.recordGame(
        5,
        12349,
        createGameResult({ winner: null, turns: 100, playerDeck: 'A', opponentDeck: 'B' }),
      );

      const results = recorder.finalize();

      // Should not throw
      expect(() => assertValidSimulationResults(results)).not.toThrow();
    });

    test('results have consistent statistics', () => {
      const recorder = new ResultsRecorder(12345, 10);

      for (let i = 0; i < 10; i++) {
        const winners = ['player', 'opponent', null] as const;
        const winner = winners[i % 3];
        recorder.recordGame(
          i + 1,
          12345 + i,
          createGameResult({
            winner,
            turns: 10 + i,
            playerDeck: 'DeckA',
            opponentDeck: 'DeckB',
          }),
        );
      }

      const results = recorder.finalize();

      // Verify consistency
      const totalOutcomes = results.playerWins + results.opponentWins + results.draws;
      expect(totalOutcomes).toBe(results.gamesCompleted);
      expect(results.gamesCompleted + results.errors).toBe(results.totalGames);
      expect(results.gameRecords.length).toBe(results.totalGames);
    });
  });
});
