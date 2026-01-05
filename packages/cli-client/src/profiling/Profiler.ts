/**
 * Profiler - Performance tracking for simulations
 */

/* global performance */

import type { ProfileData } from '../types';

export class Profiler {
  private startTime: number = 0;
  private gameStartTime: number = 0;
  private gameDurations: number[] = [];
  private detailed: boolean;

  constructor(detailed: boolean = false) {
    this.detailed = detailed;
  }

  /**
   * Start profiling the entire simulation
   */
  startSimulation(): void {
    this.startTime = performance.now();
  }

  /**
   * Start profiling a single game
   */
  startGame(): void {
    this.gameStartTime = performance.now();
  }

  /**
   * End profiling a single game
   */
  endGame(): number {
    const duration = performance.now() - this.gameStartTime;
    this.gameDurations.push(duration);
    return duration;
  }

  /**
   * Generate profile data
   */
  getProfileData(gamesCompleted: number): ProfileData {
    const totalMs = performance.now() - this.startTime;
    const avgGameMs =
      this.gameDurations.length > 0
        ? this.gameDurations.reduce((a, b) => a + b, 0) / this.gameDurations.length
        : 0;
    const gamesPerSecond = totalMs > 0 ? (gamesCompleted / totalMs) * 1000 : 0;

    const profile: ProfileData = {
      totalMs,
      avgGameMs,
      gamesPerSecond,
    };

    if (this.detailed) {
      // TODO: Add detailed profiling (phases, actions, etc.)
      // This will require instrumentation in the engine
      profile.detailed = {
        phases: {},
        actions: {
          total: 0,
          byType: {},
          avgPerTurn: 0,
        },
      };
    }

    return profile;
  }

  /**
   * Reset profiler state
   */
  reset(): void {
    this.startTime = 0;
    this.gameStartTime = 0;
    this.gameDurations = [];
  }
}
