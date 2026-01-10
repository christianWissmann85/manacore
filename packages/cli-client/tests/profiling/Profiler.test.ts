import { describe, it, expect, beforeEach } from 'bun:test';
import { Profiler } from '../../src/profiling/Profiler';

describe('Profiler', () => {
  let profiler: Profiler;

  beforeEach(() => {
    profiler = new Profiler(true); // Detailed mode
  });

  it('should track AI decision latency', async () => {
    profiler.startSimulation();
    profiler.startGame();

    // Simulate AI thinking
    profiler.startAiDecision();
    await new Promise((resolve) => setTimeout(resolve, 10)); // 10ms delay
    profiler.endAiDecision();

    profiler.startAiDecision();
    await new Promise((resolve) => setTimeout(resolve, 20)); // 20ms delay
    profiler.endAiDecision();

    profiler.endGame();

    const data = profiler.getProfileData(1);

    expect(data.detailed).toBeDefined();
    expect(data.detailed?.ai).toBeDefined();
    expect(data.detailed?.ai?.decisions).toBe(2);
    // Allow for some timing variance, but should be at least the sum of delays
    expect(data.detailed?.ai?.totalTime).toBeGreaterThanOrEqual(30); 
    expect(data.detailed?.ai?.avgTime).toBeGreaterThanOrEqual(15);
  });

  it('should aggregate AI metrics across games', () => {
    profiler.startSimulation();

    // Game 1
    profiler.startGame();
    profiler.startAiDecision();
    // mock 10ms
    const start1 = performance.now();
    while (performance.now() - start1 < 10) {}
    profiler.endAiDecision();
    profiler.endGame();

    // Game 2
    profiler.startGame();
    profiler.startAiDecision();
    // mock 20ms
    const start2 = performance.now();
    while (performance.now() - start2 < 20) {}
    profiler.endAiDecision();
    profiler.endGame();

    const data = profiler.getProfileData(2);

    expect(data.detailed?.ai?.decisions).toBe(2);
    expect(data.detailed?.ai?.totalTime).toBeGreaterThanOrEqual(30);
  });
  
  it('should reset AI metrics', () => {
      profiler.startSimulation();
      profiler.startAiDecision();
      profiler.endAiDecision();
      
      profiler.reset();
      
      const data = profiler.getProfileData(0);
      expect(data.detailed?.ai?.decisions).toBe(0);
      expect(data.detailed?.ai?.totalTime).toBe(0);
  });

  it('should track Engine action latency', async () => {
    profiler.startSimulation();
    profiler.startGame();

    // Simulate Engine processing
    profiler.startEngineAction();
    await new Promise((resolve) => setTimeout(resolve, 5));
    profiler.endEngineAction();

    profiler.startEngineAction();
    await new Promise((resolve) => setTimeout(resolve, 10));
    profiler.endEngineAction();

    profiler.endGame();

    const data = profiler.getProfileData(1);

    expect(data.detailed?.engine).toBeDefined();
    expect(data.detailed?.engine?.actions).toBe(2);
    expect(data.detailed?.engine?.totalTime).toBeGreaterThanOrEqual(15);
    expect(data.detailed?.engine?.avgTime).toBeGreaterThanOrEqual(7.5);
  });
});
