# Expansion Addition Plan (AI Research Perspective)

This document outlines the strategy for adding new card expansions to ManaCore. As a **research platform**, our goal is to expand the "meta-game" and agent training variety without introducing mechanical complexity that doesn't significantly contribute to AI learning.

## 🎯 Research Goals for Card Additions

1.  **Variety over Completeness:** We don't need 100% of a set. We need "themed" cards that introduce new strategic patterns for agents to learn.
2.  **High-Frequency Compatibility:** Avoid "engine-breakers" (e.g., extra turns, sub-games, complex replacement effects) that slow down simulations.
3.  **Deterministic Simplicity:** Favor mechanics that can be easily modeled in our state machine.
4.  **Strategic Depth:** Focus on cards that force agents to evaluate long-term resources (e.g., card advantage, mana curves, board pressure).

---

## 📅 Expansion Roadmap

The following expansions are categorized by implementation difficulty.

### 🟢 Tier 1: Easy (Low Effort, High Value)

_Compatible with current engine (Week 1.5.x). Mostly require JSON data and minimal registration._

| Expansion             | Set Code | Key Mechanics        | AI Research Value                              |
| --------------------- | -------- | -------------------- | ---------------------------------------------- |
| **7th Edition**       | `7ed`    | Same as 6ED          | Expands vanilla/simple card pool.              |
| **Portal**            | `por`    | Simplified sorceries | Great for basic tactical training.             |
| **Portal Second Age** | `p02`    | Simplified sorceries | Clean environment for learning curves.         |
| **Mercadian Masques** | `mmq`    | Tutors (Mercenaries) | Agents learn to value specific deck searching. |

### 🟡 Tier 2: Medium (Requires Minor Engine Extensions)

_Requires small updates to the ability registry or trigger system._

| Expansion         | Set Code | Required Extension            | AI Research Value                            |
| ----------------- | -------- | ----------------------------- | -------------------------------------------- |
| **Urza's Saga**   | `usg`    | **Cycling** (Hand Abilities)  | Agents learn to "dig" for answers.           |
| **Tempest**       | `tmp`    | **Shadow** (Evasion)          | New blocking constraints for bots to solve.  |
| **Visions**       | `vis`    | **Flanking** (Block Triggers) | Combat math complexity.                      |
| **Urza's Legacy** | `ulg`    | **Echo** (Upkeep Triggers)    | Resource management (paying for permanence). |

### 🔴 Tier 3: Hard (Complex Mechanics)

_Requires significant engine refactors. Postpone for advanced research phases._

| Expansion      | Set Code | Mechanics     | Reason for Delay                         |
| -------------- | -------- | ------------- | ---------------------------------------- |
| **Mirage**     | `mir`    | **Phasing**   | Requires new state hooks in turn phases. |
| **Stronghold** | `sth`    | **Buyback**   | Complex spell resolution logic.          |
| **Exodus**     | `exo`    | **Recursion** | High-complexity graveyard-to-hand loops. |

---

## 🛠️ Implementation Strategy

### 1. Data File Structure

Each expansion will have its own JSON file in `packages/engine/data/cards/`:

```bash
packages/engine/data/cards/
├── 6ed.json      # Current (335 cards)
├── 7ed.json      # Planned
├── por.json      # Planned
└── usg.json      # Planned
```

### 2. Updating CardLoader

The `CardLoader.ts` should be updated to scan and load all JSON files in the `data/cards/` directory instead of hardcoding `6ed.json`.

### 3. Ability Registration (Bulk Reuse)

Since many expansions reuse abilities from 6ED (e.g., Llanowar Elves in 7ED), we will utilize `registerBulk` in `packages/engine/src/rules/abilities/registry.ts` to map new card IDs to existing ability factories.

### 4. Fetching Strategy

Modify `scripts/fetch-cards.ts` to accept a set code as a CLI argument:

```bash
# Example command
bun scripts/fetch-cards.ts --set 7ed
```

## 🧪 Testing New Sets

When adding a set, a corresponding test file should be created:
`packages/engine/tests/expansions/[set].test.ts`
This file should verify:

1.  All cards in the JSON load correctly.
2.  Key mechanics (e.g., Flanking, Cycling) resolve correctly in a mock game state.
3.  Random bot simulation doesn't crash with the new card pool.

---

_Note: This plan prioritizes deterministic, fast-resolving cards to keep simulation speeds at 1000+ games/sec._
