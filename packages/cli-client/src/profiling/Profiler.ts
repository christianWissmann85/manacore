/**
 * Profiler - Performance tracking for simulations
 */

import type { ProfileData } from '../types';

export class Profiler {
  private startTime: number = 0;
  private gameStartTime: number = 0;
  private gameDurations: number[] = [];
  private detailed: boolean;

  // AI Profiling
  private aiDecisions: number = 0;
  private aiTotalTime: number = 0;
  private aiMinTime: number = Infinity;
  private aiMaxTime: number = 0;
  private currentAiStart: number = 0;

  // Engine Profiling
  private engineActions: number = 0;
  private engineTotalTime: number = 0;
  private engineMinTime: number = Infinity;
  private engineMaxTime: number = 0;
  private currentEngineStart: number = 0;

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
   * Start profiling an AI decision
   */
  startAiDecision(): void {
    if (!this.detailed) return;
    this.currentAiStart = performance.now();
  }

  /**
   * End profiling an AI decision
   */
  endAiDecision(): void {
    if (!this.detailed) return;
    const duration = performance.now() - this.currentAiStart;
    this.aiDecisions++;
    this.aiTotalTime += duration;
    if (duration < this.aiMinTime) this.aiMinTime = duration;
    if (duration > this.aiMaxTime) this.aiMaxTime = duration;
  }

  /**
   * Start profiling an Engine action
   */
  startEngineAction(): void {
    if (!this.detailed) return;
    this.currentEngineStart = performance.now();
  }

  /**
   * End profiling an Engine action
   */
  endEngineAction(): void {
    if (!this.detailed) return;
    const duration = performance.now() - this.currentEngineStart;
    this.engineActions++;
    this.engineTotalTime += duration;
    if (duration < this.engineMinTime) this.engineMinTime = duration;
    if (duration > this.engineMaxTime) this.engineMaxTime = duration;
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

      // This will require instrumentation in the engine
      profile.detailed = {
        phases: {},
        actions: {
          total: 0,
          byType: {},
          avgPerTurn: 0,
        },
        ai: {
          decisions: this.aiDecisions,
          totalTime: this.aiTotalTime,
          avgTime: this.aiDecisions > 0 ? this.aiTotalTime / this.aiDecisions : 0,
          minTime: this.aiMinTime === Infinity ? 0 : this.aiMinTime,
          maxTime: this.aiMaxTime,
        },
        engine: {
          actions: this.engineActions,
          totalTime: this.engineTotalTime,
          avgTime: this.engineActions > 0 ? this.engineTotalTime / this.engineActions : 0,
          minTime: this.engineMinTime === Infinity ? 0 : this.engineMinTime,
          maxTime: this.engineMaxTime,
        },
      };
    }

    return profile;
  }

  /**
   * Add profile data from another source (e.g. worker thread)
   */
  add(data: ProfileData): void {
    if (data.detailed) {
      this.detailed = true; // Ensure we are in detailed mode if we receive detailed data
      if (data.detailed.ai) {
        this.aiDecisions += data.detailed.ai.decisions;
        this.aiTotalTime += data.detailed.ai.totalTime;
        if (data.detailed.ai.minTime < this.aiMinTime && data.detailed.ai.decisions > 0)
          this.aiMinTime = data.detailed.ai.minTime;
        if (data.detailed.ai.maxTime > this.aiMaxTime) this.aiMaxTime = data.detailed.ai.maxTime;
      }
      if (data.detailed.engine) {
        this.engineActions += data.detailed.engine.actions;
        this.engineTotalTime += data.detailed.engine.totalTime;
        if (data.detailed.engine.minTime < this.engineMinTime && data.detailed.engine.actions > 0)
          this.engineMinTime = data.detailed.engine.minTime;
        if (data.detailed.engine.maxTime > this.engineMaxTime)
          this.engineMaxTime = data.detailed.engine.maxTime;
      }
    }
    // Note: totalMs and gamesPerSecond are still calculated from the main profiler's start time
  }

  /**
   * Reset profiler state
   */
  reset(): void {
    this.startTime = 0;
    this.gameStartTime = 0;
    this.gameDurations = [];
    this.aiDecisions = 0;
    this.aiTotalTime = 0;
    this.aiMinTime = Infinity;
    this.aiMaxTime = 0;
    this.engineActions = 0;
    this.engineTotalTime = 0;
    this.engineMinTime = Infinity;
    this.engineMaxTime = 0;
  }
}
