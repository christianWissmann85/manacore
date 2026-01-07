#!/usr/bin/env bun
/**
 * Quiet test runner - shows only failures and summary
 *
 * Usage: bun scripts/test-quiet.ts [test args...]
 *
 * When all tests pass: shows only the summary
 * When tests fail: shows failure details + summary
 */

import { spawn } from 'bun';

const args = process.argv.slice(2);
const proc = spawn(['bun', 'test', ...args], {
  stdout: 'pipe',
  stderr: 'pipe',
  env: { ...process.env, FORCE_COLOR: '1' },
});

let output = '';
let hasFailures = false;

// Collect all output
const reader = proc.stdout.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  output += decoder.decode(value);
}

// Also capture stderr
const stderrReader = proc.stderr.getReader();
let stderr = '';
while (true) {
  const { done, value } = await stderrReader.read();
  if (done) break;
  stderr += decoder.decode(value);
}

const exitCode = await proc.exited;

// Parse and filter output
const lines = output.split('\n');
const summaryLines: string[] = [];
const failureLines: string[] = [];
let inFailure = false;
let currentFile = '';

for (const line of lines) {
  // Detect summary lines (at the end)
  if (/^\s*\d+\s+(pass|fail|skip)/.test(line) ||
      /expect\(\) calls/.test(line) ||
      /Ran \d+ tests/.test(line)) {
    summaryLines.push(line);
    continue;
  }

  // Detect file header (e.g., "tests/foo.test.ts:")
  if (/^[a-zA-Z].*\.ts:/.test(line) || /^packages\/.*\.ts:/.test(line)) {
    currentFile = line;
    inFailure = false;
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
    // Stop on next test (✓) or empty section
    if (line.includes('✓') || /^\s*\d+\s+(pass|fail|skip)/.test(line)) {
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

if (stderr.trim()) {
  console.error(stderr);
}

console.log(summaryLines.join('\n'));

process.exit(exitCode);
