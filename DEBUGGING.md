# 🛠️ Debugging Guide

This repository contains a suite of specialized debug scripts to help investigate game engine logic, AI behavior, and deck matchups. These scripts are located in `scripts/debug/` and can be run using `bun`.

## 📂 Script Location

All debug scripts are stored in:

```
scripts/debug/
```

## 🚀 Available Tools

### 1. `test-red-vs-green.ts`

**Use for:** High-level statistical analysis of deck matchups.
**When to use:**

- You suspect a regression in AI performance.
- You want to verify if a game logic fix (like a bug causing draws) actually changes game outcomes.
- You need to check the "Draw Rate" to ensure games aren't stalling.

**How to run:**

```bash
bun scripts/debug/test-red-vs-green.ts
```

**Output:**

- Win/Loss/Draw statistics over 50 games.
- Average turns per game.
- Breakdown of game end reasons (Life loss, Decking, Turn limit).

---

### 2. `test-detailed-game.ts`

**Use for:** Deep-dive analysis of a single game.
**When to use:**

- You need to trace _exactly_ what happened turn-by-turn.
- You are debugging life total discrepancies (e.g., "Why didn't damage apply?").
- You want to see the sequence of phases and priority passing.

**How to run:**

```bash
bun scripts/debug/test-detailed-game.ts
```

**Output:**

- Turn-by-turn log of phases.
- Life totals, hand size, and board state at the start of each turn.
- Detailed logs of combat damage steps.
- AI decisions made (e.g., "GreedyBot attacks with 3 creatures").

---

### 3. `test-combat-debug.ts`

**Use for:** Analyzing combat-specific AI decision making.
**When to use:**

- The AI is making bad attacks (suicide attacks) or missing lethal attacks.
- The AI is not blocking when it should.
- You want to see the "Score" the AI assigns to different attack/block configurations.

**How to run:**

```bash
bun scripts/debug/test-combat-debug.ts
```

**Output:**

- Lists the top attack/block options the AI considered.
- Shows the evaluation score for each option.
- Marks the option the AI actually chose.

---

### 4. `test-greedy-debug.ts`

**Use for:** General AI evaluation debugging (Main Phase).
**When to use:**

- The AI is playing lands or casting spells in a weird order.
- You want to see how the AI values different cards in hand.
- You need to debug why the AI chose to `PASS_PRIORITY` instead of acting.

**How to run:**

```bash
bun scripts/debug/test-greedy-debug.ts
```

**Output:**

- Top 5 actions evaluated by the AI for the current board state.
- Breakdowns of scores for casting spells vs. other actions.

## 📝 Best Practices

1.  **Start High-Level**: Run `test-red-vs-green.ts` first to see if there is a statistical problem (e.g., 90% draw rate).
2.  **Drill Down**: Use `test-detailed-game.ts` to find the specific turn where things go wrong.
3.  **Isolate Logic**: Use `test-combat-debug.ts` or `test-greedy-debug.ts` to understand _why_ the AI made the move that caused the issue.
4.  **Verify Fixes**: After applying a fix, run `test-red-vs-green.ts` again to confirm the win/loss rates have improved and no regressions were introduced.
