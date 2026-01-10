# **🎨 ManaCore UI/UX Revamp: The "Dual-Mode" Initiative**

Date: January 10, 2026  
Author: Christian Wissmann (Product Owner) & Gemini (Lead Architect)  
Status: Approved for Implementation  
Target Package: packages/web-client

## **1\. Executive Summary 🎯**

Currently, the packages/web-client application attempts to serve two masters with diametrically opposed needs: the **Human Player**, who seeks immersion, simplicity, and fluid gameplay; and the **AI Researcher**, who requires maximum data density, transparency, and diagnostic tools. By forcing these two distinct use cases into a single "compromise" interface, we are currently delivering a suboptimal experience for both. The player is overwhelmed by debug graphs, while the researcher is frustrated by the lack of granular internal state visibility.

**The Solution:** We are architecting a fundamental split in the frontend application to support two distinct, optimized user interfaces driven by the same core engine state:

1. **Play Mode 🎮:** An immersive, clean, and distraction-free interface designed for Human vs. AI matches. Ideally suited for testing "fun factor" and subjective bot performance.
2. **Research Lab 🧪:** A high-density, "Glass Box" dashboard designed for AI vs. AI observation, debugging, hyperparameter tuning, and training analysis.

This document outlines the technical specification, design philosophy, and implementation roadmap to achieve this separation of concerns without code duplication.

## **2\. Problem Statement 🚩**

### **2.1 Cognitive Overload for Human Players**

The current interface displays raw telemetry data—such as MCTSTreeView, InspectorPanel, and WinProbabilityChart—alongside the active game board.

- **Impact:** This breaks the "magic circle" of gameplay. A human player trying to focus on their next move is distracted by shifting probability curves and debug logs.
- **Result:** It feels less like playing a game and more like operating a spreadsheet. The "fun" is obscured by the "math."

### **2.2 Insufficient Data Granularity for Researchers**

Conversely, for a researcher analyzing a specific bot failure (e.g., "Why didn't the bot attack for lethal?"), the current view is too graphical and sparse.

- **Impact:** The beautiful, large-card rendering takes up 80% of the screen, leaving only small margins for the actual data that matters: neural network policy outputs, search tree depths, and engine state flags.
- **Result:** Researchers cannot see the _cause_ of behaviors, only the _effect_, forcing them to revert to console logs or backend breakpoints.

### **2.3 Mobile & Responsive Incompatibility**

The "all-in-one" layout relies on a widescreen desktop format to fit both the board and the side panels.

- **Impact:** On smaller screens or tablets, the UI collapses or becomes unusable because the debug panels crowd out the play area.
- **Result:** We cannot test the game on mobile devices, limiting our ability to dogfood the "player experience."

## **3\. Architecture: The "Dual-Container" Pattern 🏗️**

To solve this, we will refactor the root entry point App.tsx to act as a **High-Level Mode Switcher**. Instead of conditional rendering scattered throughout deep components, we will implement a clean separation at the layout level.

### **3.1 Routing & State Strategy**

The App component will determine the active mode based on user selection (persisted in local storage) or URL query parameters (e.g., ?mode=research). It will then mount one of two high-level container components.

Critically, both layouts will subscribe to the **same GameStore**. This ensures that the game state (cards, zones, life totals) is the single source of truth, while the _presentation_ of that truth differs wildly.

### **3.2 New Directory Structure Recommendation**

We will reorganize src/ to reflect this separation, ensuring components are categorized by their intended audience.

src/  
├── components/  
│ ├── core/ \# Shared functionality used by BOTH modes  
│ │ ├── Card.tsx \# The fundamental card visual  
│ │ ├── Battlefield.tsx \# The grid layout for permanents  
│ │ └── ManaSymbols.tsx \# Cost rendering  
│ ├── play/ \# Play Mode exclusives (Immersion focused)  
│ │ ├── Hand.tsx \# Large, interactable hand  
│ │ ├── ActionPrompt.tsx \# User-friendly modal dialogs  
│ │ └── AnimationLayer.tsx \# Particle effects & transitions  
│ └── research/ \# Research exclusives (Data focused)  
│ │ ├── MCTSView/ \# Complex tree visualization  
│ │ ├── ProbChart.tsx \# Win rate timelines  
│ │ └── StateInspector.tsx \# JSON/Tree view of engine state  
├── layouts/  
│ ├── PlayLayout.tsx \# The Immersive Wrapper (UI Chrome minimized)  
│ └── ResearchLayout.tsx \# The Dashboard Wrapper (Grid based)  
└── App.tsx \# The Router/Switcher

## **4\. Mode A: Play Mode (Human vs. AI) 🎮**

Design Philosophy: "Focus on the Cards."  
This mode minimizes UI chrome to near-zero. The player should only see what is legally required to play the game of Magic. All debug information is stripped away to foster immersion.

### **4.1 UI Requirements**

- **Top Region (Opponent):**
  - Simplified representation. We do not need to see the opponent's full hand, only the card count.
  - Compact Avatar, Life Total, and a simplified Mana Pool indicator.
- **Center Region (The Battlefield):**
  - This is the hero of the interface. It should consume roughly 60-70% of the vertical screen real estate.
  - Cards should be rendered at a size legible without hovering.
  - Permanent placement should automatically organize into "Lands" (back row) and "Creatures/Artifacts" (front row).
- **Bottom Region (Player):**
  - **Hand:** Large, fanned-out cards. Drag-and-drop interactions should be prioritized here.
  - **Resources:** Clear, large typography for Life and Mana.
- **Floating Elements:**
  - **The Stack:** Instead of a list, the Stack should appear as a floating overlay on the right, showing just the art and name of the spell currently resolving.

### **4.2 Interaction Guidelines**

- **Modals over Sidebars:** When the game needs a decision (e.g., "Choose a target"), use a central modal or overlay that dims the background, focusing attention immediately. Do not open a side panel.
- **Animation as Feedback:** Replace text logs with visual cues.
  - _Draw Card:_ Animate a card moving from Library to Hand.
  - _Damage:_ Shake the card or avatar and flash red.
  - _Counter:_ A specific visual effect (e.g., shattering glass) on the stack.

### **4.3 Technical Implementation Note**

Components like Hand.tsx and Battlefield.tsx must be refactored to accept a displayMode or zoomLevel prop.

- In PlayMode, zoomLevel="large".
- In ResearchMode, zoomLevel="compact".

## **5\. Mode B: Research Lab (AI vs. AI / "Glass Box") 🧪**

Design Philosophy: "Maximum Telemetry."  
This mode treats the game engine as a subject of scientific study. Aesthetics are secondary to information density. We want to see the "Brain" of the agent and the "Guts" of the engine simultaneously.

### **5.1 UI Requirements: The 3-Column Dashboard**

We will utilize a rigid CSS Grid layout to maximize screen real estate usage.

#### **Column 1: The Match Narrative (20%)**

- **Top: Win Probability Timeline:**
  - Component: WinProbabilityChart.tsx.
  - Function: Displays the Agent's confidence over time. Spikes and dips here indicate "turning points" in the match that researchers need to investigate.
- **Bottom: Detailed Action Log:**
  - Component: ActionLog.tsx (Verbose Mode).
  - _Upgrade:_ Clicking a log entry (e.g., "Bot casts Giant Growth") should highlight the relevant cards on the board and scroll the state inspector to that timestamp.

#### **Column 2: The State (40%)**

- **Center: The Board:**
  - Component: GameBoard.tsx (Scaled down).
  - Cards are rendered as "thumbnails" or even simple text boxes to save space. We just need to see presence, tapped status, and power/toughness.
- **Overlay: Phase Indicator:**
  - Component: ZoneIndicator.tsx.
  - Must prominently display the exact Phase and Step (e.g., "Post-Combat Main Phase") as timing bugs are common in AI development.

#### **Column 3: The Brain (40%) \- _The Core Value Prop_**

This column is unique to the Research Lab and provides insights into the AI's decision-making process.

- **Top: Search Tree Visualization:**
  - Component: MCTSTreeView.tsx.
  - _Requirement:_ Visualize the MCTS path. Show the "Principal Variation" (the best path found) vs. alternative paths. Color-code nodes by visit count (confidence).
- **Middle: Policy Head Output:**
  - Component: PolicyDistribution.tsx.
  - Show the raw Neural Network output probabilities _before_ MCTS search. This helps identify if the "instinct" of the network differs from the "calculated" choice of the search.
- **Bottom: Heuristic Breakdown:**
  - Component: EvaluationBreakdown.tsx.
  - When hovering over a decision node, show the breakdown of the score (e.g., "Material: \+2.0", "Tempo: \-0.5", "Life Advantage: \+0.1").

### **5.2 The "Time Travel" Feature (New Requirement) ⏳**

Watching AI vs. AI in real-time is often futile; it is either too fast to comprehend or too slow (while thinking).

- **Requirement:** Add a **Scrubber/Timeline Slider** at the bottom of the Research Layout.
- **Function:** Allows the user to pause execution and scrub back to Turn 3, Step 2\.
- **UX Goal:** "I saw a weird spike in the win rate graph. Let me scrub back to that moment and inspect the MCTS tree to see what the bot was thinking."
- _Technical Dependency:_ The GameStore must maintain a history of state snapshots or a deterministic action log that can be replayed instantly on the client side.

## **6\. Implementation Roadmap 🛣️**

### **Phase 1: The Great Refactor (Architecture) 🛠️**

1. **File Restructuring:** Move components into src/components/core, play, and research.
2. **Layout Creation:** Create PlayLayout.tsx and ResearchLayout.tsx.
3. **Router Implementation:** Modify App.tsx to handle the switching logic.
4. **Heavy Component Migration:** Move InspectorPanel, MCTSTreeView, etc., strictly into ResearchLayout.

### **Phase 2: Polish Play Mode (Experience) ✨**

1. **CSS Variable System:** Define size variables for cards so Battlefield.tsx can scale dynamically between modes.
2. **Quiet Mode for Logs:** Refactor ActionLog to support a "toast notification" style for Play Mode.
3. **Stack Overlay:** Build the visual stack component for the right-hand side.

### **Phase 3: Build the Research Dashboard (Data) 📊**

1. **Grid Layout:** Implement the 3-column CSS Grid.
2. **Tree Interaction:** Enhance MCTSTreeView to support expanding/collapsing nodes (crucial for navigating deep searches).
3. **Data Wiring:** Ensure WinProbabilityChart and PolicyDistribution are receiving real-time data chunks from the gym-server via the websocket.

### **Phase 4: Time Travel & Analysis (Advanced) ⏳**

1. **Snapshotting:** Implement a lightweight snapshot mechanism in GameStore.
2. **Scrubber UI:** Build the timeline slider.
3. **Replay Logic:** Implement the logic to "reset and fast-forward" the client state to a specific historical index.

## **7\. Rationale & Use Cases 💡**

| Feature           | Rational                                                                                                                                                                            | Product Story                                                                                                                                                    |
| :---------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Play Mode**     | **Cognitive Load Reduction.** Humans have limited working memory. Removing debug data allows players to focus on strategy and game mechanics.                                       | _"As a human player, I want to enjoy a casual game of Magic against the AI without seeing matrix code or debug graphs, so I can immerse myself in the fantasy."_ |
| **Research Mode** | **Observability.** AI behaviors are complex and often counter-intuitive. We need deep introspection tools to distinguish between "bad luck" and "bad logic."                        | _"As a Prompt Engineer, I need to see if the LLM hallucinated a rule (illegal move) or if the PPO agent simply miscalculated lethal damage (bad strategy)."_     |
| **Split UI**      | **Separation of Concerns.** Developers often break the player UI when adding debug tools. Splitting them allows us to iterate on the "Lab" rapidly without degrading the "Product." | _"As a Developer, I want to add a new 'Attention Map' visualization for the neural net without worrying that I'm cluttering the screen for the end-user."_       |
| **Time Travel**   | **Root Cause Analysis.** Bugs are often transient. Being able to rewind and inspect the state _exactly as it was_ is critical for debugging reinforcement learning agents.          | _"As a Researcher, I want to replay the critical Turn 4 to understand why the agent chose to sacrifice its creature instead of blocking."_                       |

Let's build the best "Glass Box" AI interface in the industry. 🚀

## Note

1. Add a way to select a Deck from all existing decks for the human player, and the AI
2. Use random decks as default (Human vs AI, AI vs AI)
