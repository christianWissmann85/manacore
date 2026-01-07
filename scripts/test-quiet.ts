#!/usr/bin/env bun
/**
 * Quiet test runner - shows only failures and summary
 *
 * Usage: bun scripts/test-quiet.ts [test args...]
 *
 * When all tests pass: shows only the summary
 * When tests fail: shows failure details + summary
 */

import { $ } from 'bun';

const args = process.argv.slice(2);

// Strip ANSI escape codes
function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

// Run tests with output fully captured - use script -q to detach from TTY
// This prevents bun test from writing directly to the terminal
import { spawn } from 'bun';

const proc = spawn(['script', '-qec', `bun test ${args.join(' ')}`, '/dev/null'], {
  env: { ...process.env, FORCE_COLOR: '0', NODE_ENV: 'test-quiet' },
  stdout: 'pipe',
  stderr: 'pipe',
  stdin: 'ignore',
});

const output = stripAnsi(await new Response(proc.stdout).text());
const exitCode = await proc.exited;
let hasFailures = false;

// Parse and filter output
const lines = output.split('\n');
const summaryLines: string[] = [];
const failureLines: string[] = [];
let inFailure = false;
let currentFile = '';

for (const line of lines) {
  // Skip setup/cleanup messages
  if (line.includes('Test output directory') || line.includes('Cleaned up test output')) {
    continue;
  }

  // Skip progress bars and game status
  if (line.includes('⏳') || line.includes('🎮 Running') || /Progress: \d+\/\d+/.test(line)) {
    continue;
  }

  // Skip CardLoader and engine initialization messages
  if (
    line.includes('CardLoader:') ||
    line.includes('@manacore/engine') ||
    line.includes('@manacore/ai') ||
    line.includes('Registered') ||
    line.includes('cards with abilities')
  ) {
    continue;
  }

  // Detect summary lines (at the end)
  if (
    /^\s*\d+\s+(pass|fail|skip)/.test(line) ||
    /expect\(\) calls/.test(line) ||
    /Ran \d+ tests/.test(line) ||
    /tests skipped:/.test(line) ||
    /tests failed:/.test(line)
  ) {
    summaryLines.push(line);
    continue;
  }

  // Detect file header (e.g., "tests/foo.test.ts:")
  if (/^[a-zA-Z].*\.ts:/.test(line) || /^packages\/.*\.ts:/.test(line)) {
    currentFile = line;
    inFailure = false;
    continue;
  }

  // Skip passing test lines (✓ or (pass))
  if (line.includes('✓') || line.includes('(pass)')) {
    continue;
  }

  // Detect failure marker
  if (line.includes('✗') || line.includes('(fail)') || line.includes('error:')) {
    hasFailures = true;
    if (currentFile && !failureLines.includes(currentFile)) {
      failureLines.push(currentFile);
    }
    inFailure = true;
    failureLines.push(line);
    continue;
  }

  // Continue capturing failure context
  if (inFailure && line.trim()) {
    // Stop on next summary line or empty section
    if (/^\s*\d+\s+(pass|fail|skip)/.test(line)) {
      inFailure = false;
    } else {
      failureLines.push(line);
    }
  }
}

// Output results
if (hasFailures) {
  console.log(failureLines.join('\n'));
  console.log('');
}

console.log(summaryLines.join('\n'));

process.exit(exitCode);
