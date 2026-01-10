# Product Guidelines - ManaCore

## Tone and Style

- **Accessible & Educational:** Documentation and interactions should explain complex AI and MTG concepts in simple, clear terms. The goal is to make high-level research accessible to a broad range of developers and researchers.
- **Clarity over Complexity:** Use straightforward language while maintaining technical accuracy.

## Design Principles

- **Transparency (Glass-Box):** The platform must prioritize visibility into AI decision-making. Interfaces should expose evaluation scores, MCTS visit counts, and other internal metrics to help users understand _why_ an agent made a specific choice.
- **Performance-First:** All user interfaces must remain highly responsive, even when the underlying engine is performing thousands of simulations per second. Performance is a core feature, not an afterthought.
- **Modularity:** System components and UI elements must be designed for reuse across different experiment types, clients (Web, CLI), and integration layers.

## Visual Identity

- **Functional Aesthetic:** UI design should prioritize data density and clarity over decorative elements.
- **Consistent Terminology:** Maintain a standard vocabulary across all clients and documentation for game rules, bot types, and research metrics.
