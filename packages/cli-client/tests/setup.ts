/**
 * Global Test Setup
 *
 * This file runs before all tests to configure the test environment
 * and cleanup after all tests complete.
 *
 * Key responsibilities:
 * 1. Set MANACORE_OUTPUT_DIR to isolate test output from production
 * 2. Cleanup test output directory after all tests finish
 */

import { rmSync, existsSync } from 'fs';
import { afterAll } from 'bun:test';

// Set output directory for tests to /tmp instead of production output/
const TEST_OUTPUT_DIR = '/tmp/manacore-test-output';
process.env.MANACORE_OUTPUT_DIR = TEST_OUTPUT_DIR;

// Don't log setup message during quiet tests
if (process.env.NODE_ENV !== 'test-quiet') {
  console.log(`\n📁 Test output directory: ${TEST_OUTPUT_DIR}\n`);
}

/**
 * Global cleanup - runs after ALL tests complete
 * This is registered at module load time to ensure it runs
 */
afterAll(() => {
  if (existsSync(TEST_OUTPUT_DIR)) {
    try {
      rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
      console.log(`\n✨ Cleaned up test output directory: ${TEST_OUTPUT_DIR}\n`);
    } catch (error) {
      console.error(`\n⚠️  Failed to cleanup test output directory: ${error}\n`);
    }
  }
});
