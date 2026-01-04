# ManaCore

**A playable Magic: The Gathering implementation with AI research platform**

ManaCore is a digital MTG implementation (6th Edition card pool) built for:
- Playing against AI opponents
- AI research using Monte Carlo Tree Search (MCTS)
- Tournament simulation and meta-game analysis
- Future machine learning applications

**Tech Stack:** TypeScript, Bun, PixiJS

---

## Project Status

**Current Phase:** Phase 0 - Foundation (Week 1) ✅

### Completed
- ✅ Monorepo structure initialized
- ✅ Package workspaces configured
- ✅ TypeScript setup complete
- ✅ Git repository initialized

### Next Steps (Week 2-3)
- Implement Scryfall card data scraper
- Build core game engine
- Create CLI client and RandomBot

---

## Monorepo Structure

```
manacore/
├── packages/
│   ├── engine/          # Pure game logic (no UI dependencies)
│   ├── ai/              # MCTS and bot implementations
│   ├── cli-client/      # Terminal interface for testing
│   ├── data-scraper/    # Scryfall API integration
│   └── web-client/      # PixiJS UI (Phase 1+)
├── scripts/             # Build and data fetching scripts
└── docs/                # Documentation (spec, architecture, roadmap)
```

---

## Getting Started

### Install Dependencies

```bash
bun install
```

### Run Tests

```bash
bun test
```

### Fetch Card Data (Week 2+)

```bash
bun run fetch-cards
```

### Play a Game (Week 3+)

```bash
bun run cli
```

---

## Documentation

- **[spec.md](./spec.md)** - Full project specification
- **[architecture.md](./architecture.md)** - Technical implementation guide
- **[roadmap.md](./roadmap.md)** - Development timeline
- **[CLAUDE_CODE_HANDOFF.md](./CLAUDE_CODE_HANDOFF.md)** - Quick start guide

---

## Development Timeline

| Phase | Duration | Focus |
|-------|----------|-------|
| **Phase 0** | Weeks 1-3 | Foundation (setup, data, basic engine) |
| **Phase 1** | Weeks 4-8 | Core MTG rules (Stack, combat, web UI) |
| **Phase 2** | Weeks 9-14 | Smart AI (MCTS implementation) |
| **Phase 3** | Weeks 15-20 | Polish & Public Release |
| **Phase 4** | Weeks 21-26 | Research tools |
| **Phase 5** | Weeks 27+ | Machine learning |

---

## Architecture Principles

1. **Separation of Concerns** - Engine has zero UI dependencies
2. **Immutable State** - Pure functions enable fast cloning for AI
3. **Data-Driven Cards** - All cards loaded from Scryfall JSON
4. **Action-Based** - All game logic flows through reducers
5. **Test-Driven** - 80%+ code coverage target

---

## Key Features

### Phase 0 (Current)
- Minimal viable game (vanilla creatures, basic lands)
- Simplified combat (attacker chooses blocker)
- Sorcery-speed spells only

### Phase 1
- The Stack (LIFO, priority passing)
- Proper combat (declare blockers)
- Keywords: Flying, First Strike, Trample
- Instant-speed interaction

### Phase 2+
- MCTS AI with 1000+ iterations per move
- Card advantage mechanics
- Tournament simulation
- Meta-game analysis

---

## Resources

- **Bun Docs:** https://bun.sh/docs
- **Scryfall API:** https://scryfall.com/docs/api
- **MTG Comprehensive Rules:** https://magic.wizards.com/en/rules

---

## License

MIT (Educational/Research purposes)

---

## Legal Disclaimer

ManaCore is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.

The literal and graphical information presented on this site about Magic: The Gathering, including card images, the mana symbols, and Oracle text, is copyright Wizards of the Coast, LLC, a subsidiary of Hasbro, Inc. ManaCore is not produced by, endorsed by, supported by, or affiliated with Wizards of the Coast.

---

**Built with ❤️ and Bun**
