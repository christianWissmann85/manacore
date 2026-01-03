# Claude Code Handoff: ManaCore Project

## Project Context

You are continuing development of **ManaCore**, a digital Magic: The Gathering implementation with an AI research platform. This project combines:

- A playable MTG game (6th Edition card pool)
- Monte Carlo Tree Search (MCTS) AI
- Research tools for deck building and meta-game analysis
- Future machine learning applications

**Tech Stack:** TypeScript, Bun, PixiJS  
**Architecture:** Monorepo with headless game engine for high-speed AI simulation

## Documents Available

Three comprehensive documents have been created and should be in the repository:

1. **spec.md** - Full project specification

   - Project vision and goals
   - Game rules (phased complexity)
   - Technical requirements
   - AI specifications
   - Success criteria

2. **architecture.md** - Technical implementation guide

   - Monorepo structure
   - Scryfall API integration (card data scraper)
   - Engine architecture (immutable state, actions)
   - MCTS implementation details
   - Web client structure

3. **roadmap.md** - Development timeline
   - Phase 0-5 breakdown (26+ weeks)
   - Week-by-week tasks
   - Milestones and deliverables
   - Risk management

**Please read all three documents before starting any implementation work.**

## Current Status

✅ **Completed:**

- Project specification written
- Technical architecture designed
- Development roadmap planned

❌ **Not Started:**

- No code written yet
- No repository initialized
- No dependencies installed
- No card data fetched

## Immediate Goals (Phase 0, Weeks 1-3)

### Week 1: Project Setup

1. Initialize Bun monorepo with workspaces
2. Create package structure:
   - `packages/engine` - Pure game logic (no UI dependencies)
   - `packages/ai` - MCTS and bot implementations
   - `packages/cli-client` - Terminal interface
   - `packages/data-scraper` - Scryfall API integration
   - `packages/web-client` - PixiJS UI (create structure only)
3. Configure TypeScript for each package
4. Set up Git with appropriate `.gitignore`

### Week 2: Data & Engine Core

1. Implement Scryfall scraper to fetch 6th Edition cards
2. Parse and cache JSON locally (all game data + artwork URLs)
3. Implement core engine types:
   - `GameState` (source of truth)
   - `PlayerState` (life, zones, mana)
   - `CardInstance` (runtime card state)
4. Implement basic action system:
   - Play land
   - Cast creature (sorcery speed only)
   - Attack (attacker chooses blocker - simplified)
5. Implement `CardLoader` to load cached Scryfall data

### Week 3: CLI & RandomBot

1. Build terminal interface for testing
2. Display game state as ASCII art
3. Implement `RandomBot` (picks random legal actions)
4. Run automated games (RandomBot vs RandomBot)
5. Verify 100 games complete without crashes

## Key Architectural Principles

**1. Separation of Concerns**

- Engine has ZERO dependencies on DOM/PixiJS/UI
- Engine can run headless at 1000+ games/second
- All UI code in separate packages

**2. Immutable State**

- Use `structuredClone()` for game state copies
- Pure functions: `applyAction(state, action) → newState`
- Never mutate state directly

**3. Data-Driven Cards**

- Cards are JSON data, not classes
- All cards from Scryfall API cached locally
- CardLoader provides runtime access

**4. Action-Based Game Loop**

- All game progression via `GameAction` commands
- AI and UI use same action interface
- Enables deterministic replays (save actions + RNG seed)

**5. Test-Driven Development**

- Write tests for combat, stack, state-based actions
- Use Bun's built-in test runner
- Goal: 80%+ code coverage

## Critical Technical Details

### Scryfall API Integration

**Endpoint:**

```
GET https://api.scryfall.com/cards/search?q=set:6ed
```

**Rate Limiting:**

- 100ms delay between requests
- Paginated results (~175 cards per page)
- Total: ~350 cards in 6th Edition

**Required Fields:**

- `id` - Scryfall UUID
- `name` - Card name
- `mana_cost` - e.g., "{2}{R}{R}"
- `cmc` - Converted mana cost
- `type_line` - e.g., "Creature — Dragon"
- `oracle_text` - Current official rules text
- `power`, `toughness` - For creatures
- `colors`, `color_identity`
- `keywords` - Array of keyword abilities
- `image_uris.normal` - Card artwork URL
- `flavor_text` - Italic flavor text
- `rulings_uri` - Link to official rulings

**NOT Needed:**

- Pricing data
- Legality in other formats
- Foil variants

### Phase 0 Card Pool (Minimal Viable Game)

For initial testing, use only these cards:

**Creatures (Vanilla):**

- Grizzly Bears (1G, 2/2)
- Hill Giant (3R, 3/3)
- Air Elemental (3UU, 4/4)

**Spells:**

- Lightning Bolt (R, 3 damage)
- Giant Growth (G, +3/+3)

**Lands:**

- Plains, Island, Swamp, Mountain, Forest

This allows us to test:

- Mana system
- Creature combat
- Instant vs sorcery speed
- Basic game loop (play → attack → win/lose)

### Directory Structure to Create

```
manacore/
├── package.json                    # Root workspace config
├── bun.lockb
├── tsconfig.json                   # Shared TS config
├── .gitignore
├── README.md
├── spec.md                         # ← Already exists
├── architecture.md                 # ← Already exists
├── roadmap.md                      # ← Already exists
│
├── packages/
│   ├── engine/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts           # Public API exports
│   │   │   ├── state/
│   │   │   │   ├── GameState.ts
│   │   │   │   ├── PlayerState.ts
│   │   │   │   ├── CardInstance.ts
│   │   │   │   └── Zone.ts
│   │   │   ├── actions/
│   │   │   │   ├── Action.ts
│   │   │   │   ├── reducer.ts
│   │   │   │   └── validators.ts
│   │   │   ├── rules/
│   │   │   │   ├── mana.ts
│   │   │   │   └── combat.ts
│   │   │   ├── cards/
│   │   │   │   ├── CardLoader.ts
│   │   │   │   └── CardTemplate.ts
│   │   │   └── utils/
│   │   │       ├── random.ts      # Seedable RNG
│   │   │       └── clone.ts
│   │   ├── data/
│   │   │   └── cards/
│   │   │       └── 6ed.json       # Created by scraper
│   │   └── tests/
│   │       └── engine.test.ts
│   │
│   ├── ai/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── bots/
│   │   │       ├── Bot.ts         # Interface
│   │   │       └── RandomBot.ts
│   │   └── tests/
│   │
│   ├── cli-client/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── display/
│   │   │       └── board.ts
│   │   └── README.md
│   │
│   ├── data-scraper/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── scraper.ts
│   │       └── types.ts
│   │
│   └── web-client/               # Create structure, don't implement yet
│       ├── package.json
│       └── README.md              # "Coming in Phase 1"
│
└── scripts/
    ├── fetch-cards.ts             # Runs the scraper
    └── validate-data.ts           # Checks JSON integrity
```

## First Commands to Run

```bash
# 1. Initialize root package.json with workspaces
bun init -y

# 2. Create package directories
mkdir -p packages/{engine,ai,cli-client,data-scraper,web-client}

# 3. Initialize each package
cd packages/engine && bun init -y && cd ../..
cd packages/ai && bun init -y && cd ../..
cd packages/cli-client && bun init -y && cd ../..
cd packages/data-scraper && bun init -y && cd ../..

# 4. Install shared dependencies (do this from root)
bun add -D typescript @types/bun

# 5. Create tsconfig.json files
# (You'll generate these with appropriate settings)

# 6. Fetch card data
bun run scripts/fetch-cards.ts

# 7. Verify card data
cat packages/engine/data/cards/6ed.json | head -n 50
```

## Root package.json Workspace Config

```json
{
  "name": "manacore",
  "version": "0.0.1",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "fetch-cards": "bun run scripts/fetch-cards.ts",
    "test": "bun test",
    "test:engine": "cd packages/engine && bun test",
    "test:ai": "cd packages/ai && bun test",
    "cli": "cd packages/cli-client && bun run src/index.ts",
    "dev:web": "cd packages/web-client && bun run dev"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.0.0"
  }
}
```

## Sample TypeScript Config (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## .gitignore

```
# Dependencies
node_modules/
.bun/

# Build outputs
dist/
*.tsbuildinfo

# Environment
.env
.env.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Test coverage
coverage/

# Bun
bun.lockb
```

## Testing Strategy

### Unit Tests (Bun Test Runner)

```typescript
// packages/engine/tests/combat.test.ts
import { describe, test, expect } from "bun:test";
import { applyAction } from "../src/actions/reducer";
import { createTestState } from "./helpers";

describe("Combat", () => {
  test("2/2 creature attacks, no blockers, deals 2 damage", () => {
    const state = createTestState();
    // Add attacker to battlefield
    // Declare attack
    const newState = applyAction(state, {
      type: "DECLARE_ATTACKERS",
      playerId: "player",
      payload: { attackers: ["creature_1"] },
    });

    expect(newState.players.opponent.life).toBe(18); // 20 - 2
  });
});
```

## Success Criteria for Phase 0

By the end of Week 3, you should be able to run:

```bash
bun cli play --deck vanilla-red --opponent random
```

And see output like:

```
=== TURN 1 - PLAYER ===
BATTLEFIELD
  Opponent: 20 life, 0 mana

  You: 20 life, 0 mana

HAND: [Mountain] [Grizzly Bears] [Hill Giant] [Lightning Bolt]

> play 0
[You played Mountain]

> end turn

=== TURN 2 - OPPONENT ===
[Opponent plays Mountain]
[Opponent ends turn]

=== TURN 3 - PLAYER ===
...
```

## Common Pitfalls to Avoid

1. **Don't implement UI yet** - Focus on engine logic first
2. **Don't over-engineer** - Start with minimal viable features
3. **Don't skip tests** - They catch bugs early in AI simulations
4. **Don't hardcode card data** - Always load from Scryfall JSON
5. **Don't mutate state** - Use pure functions and cloning

## Questions to Consider

As you implement, think about:

1. How will we represent mana costs? (String: "{2}{R}{R}" or structured?)
2. How do we handle X costs? (Skip for Phase 0)
3. Should we validate actions before or during application?
4. How deep should the MCTS rollout go? (Tune this later)
5. What's the best way to display the stack in CLI? (LIFO visualization)

## Next Steps After Week 3

Once you have Phase 0 working:

1. **Week 4-5:** Implement The Stack (LIFO, priority)
2. **Week 6:** Proper combat (declare blockers)
3. **Week 7:** Keywords (Flying, First Strike)
4. **Week 8:** Basic Web UI (PixiJS)

## Resources

- **Bun Docs:** https://bun.sh/docs
- **Scryfall API:** https://scryfall.com/docs/api
- **MTG Comprehensive Rules:** https://magic.wizards.com/en/rules
- **MCTS Tutorial:** https://www.youtube.com/watch?v=UXW2yZndl7U

## How to Use This Prompt

1. **Read all three docs** (spec.md, architecture.md, roadmap.md)
2. **Start with Week 1 tasks** (monorepo setup)
3. **Work through Week 2** (Scryfall scraper, engine core)
4. **Complete Week 3** (CLI client, RandomBot)
5. **Test thoroughly** before moving to Phase 1

## Important Reminders

- **This is a marathon, not a sprint** - 26+ week timeline
- **Ship working code frequently** - Every phase should be playable
- **Test with real games** - Run RandomBot vs RandomBot often
- **Document as you go** - Future you will thank you
- **Ask questions** - Better to clarify than implement wrong

## Final Note

The goal of Phase 0 is to **prove the architecture works**. Don't worry about polish, performance optimization, or advanced features. Just get a minimal game loop running where two bots can play a complete game of Magic (simplified rules).

Once that works, everything else builds on top of it.

Good luck! 🚀

---

**Ready to start?**
