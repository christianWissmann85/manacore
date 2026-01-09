---
title: ManaCore AI Lab
emoji: 🎴
colorFrom: purple
colorTo: blue
sdk: docker
app_port: 7860
---

# ManaCore: Glass-Box AI Lab

**Interactive visualization of AI agents playing Magic: The Gathering**

Watch AI agents think, plan, and strategize in real-time. ManaCore is an open-source research platform that makes AI decision-making visible and understandable.

## Features

🧠 **Glass-Box AI Visualization**
- See inside MCTS (Monte Carlo Tree Search) decision trees
- Watch win probability evolve turn-by-turn
- Understand why AI makes each move

🎮 **Interactive Gameplay**
- Play against AI opponents
- Step through games move-by-move
- Explore alternative strategies

📊 **Research Platform**
- Based on Magic: The Gathering 6th Edition
- Fully deterministic game engine
- Suitable for ML/AI research

## How It Works

### IP-Safe Architecture

This Space demonstrates a privacy-respecting architecture:

1. **Server (This Space):** Runs the game engine and AI, sends only game state (card IDs, positions, damage)
2. **Your Browser:** Fetches card names, text, and images directly from [Scryfall API](https://scryfall.com)
3. **No Redistribution:** We never serve copyrighted card text or images

```
Your Browser → This Space (game state only)
           ↓
           → Scryfall API (card data)
```

**First visit:** 2-3 second load as your browser fetches card data  
**Subsequent visits:** Instant (cached in your browser)

### Technology Stack

- **Engine:** TypeScript game rules implementation
- **AI:** MCTS, Greedy, Random bots
- **Frontend:** React + Tailwind CSS
- **Backend:** Bun + Hono API server

## Legal Disclaimer

**ManaCore is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.**

### Data Sources

- **Game Logic:** Our own implementation of Magic rules
- **Card Data:** Fetched client-side from [Scryfall API](https://scryfall.com/docs/api)
- **Card Images:** Loaded directly from Scryfall CDN

This Space contains no copyrighted card text or images. All copyrighted content flows directly from Scryfall to your browser.

## Open Source

ManaCore is fully open source and available on GitHub:

🔗 **Repository:** [github.com/christianWissmann85/manacore](https://github.com/christianWissmann85/manacore)

### Contributing

We welcome contributions from:
- 🎮 Game developers (implementing more cards)
- 🤖 ML researchers (training new agents)
- 🎨 UI/UX designers (improving visualizations)
- 📊 Data scientists (analyzing game data)

## Research Applications

ManaCore enables research in:
- Multi-agent game theory
- Large language model planning
- Monte Carlo tree search optimization
- Reinforcement learning for complex games
- AI explainability and transparency

## Citation

If you use ManaCore in your research:

```bibtex
@software{manacore2026,
  title = {ManaCore: AI Research Platform for Magic: The Gathering},
  author = {Wissmann, Christian},
  year = {2026},
  url = {https://github.com/christianWissmann85/manacore}
}
```

## Support

- 📖 [Documentation](https://github.com/christianWissmann85/manacore/tree/main/docs)
- 💬 [Discussions](https://github.com/christianWissmann85/manacore/discussions)
- 🐛 [Issues](https://github.com/christianWissmann85/manacore/issues)

---

**Note:** This is a research and educational project. Not affiliated with or endorsed by Wizards of the Coast.
