import { describe, test, expect } from 'bun:test';
import { runSimulation } from '../src/commands/simulate';
import { RandomBot } from '@manacore/ai';
import * as fs from 'fs';

describe('CLI Simulation E2E', () => {
  test('runSimulation executes 2 games without error', async () => {
    const p1 = new RandomBot();
    const p2 = new RandomBot();
    
    // Run minimal simulation
    const output = await runSimulation(p1, p2, {
        gameCount: 2,
        maxTurns: 50,
        outputLevel: 0, // Silent
        seed: 12345,
        experimentName: 'test-e2e'
    });
    
    // Check results structure
    expect(output.results.totalGames).toBe(2);
    expect(output.results.gamesCompleted).toBe(2);
    expect(output.results.errors).toBe(0);
    
    // Check log file existence
    expect(fs.existsSync(output.logPath)).toBe(true);
    
    // Check log content
    const logContent = fs.readFileSync(output.logPath, 'utf-8');
    expect(logContent).toContain('ManaCore Simulation Log');
    expect(logContent).toContain('Game 1:');
    expect(logContent).toContain('Game 2:');
    
    // Clean up
    fs.unlinkSync(output.logPath);
  });
});
