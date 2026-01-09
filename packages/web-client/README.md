# @manacore/web-client

Web client package for ManaCore

This is a fantastic pivot. By framing the Web Client as a **"Glass-Box AI Lab"** rather than just a game, we align perfectly with the academic and open-source goals of Manacore. It becomes a showcase of *intelligence*, not just mechanics.

Here is the **Specification, Architecture, and Design Document** for the Manacore Web Client (Phase 4), tailored for deployment on Hugging Face Spaces.

### 1. High-Level Architecture: The "Hybrid" Model

To ensure IP safety (Client-side fetching) and robust simulation (Server-side logic), we will use a **Hybrid Client-Server Architecture** bundled into a single Docker container.

* **Host:** Hugging Face Spaces (Docker SDK).
* **Container Internal:**
* **Backend (`gym-server`):** Runs the `engine`, `ai` bots, and exposes the REST API. It holds the "Truth".
* **Frontend (`web-client`):** A static React SPA (Single Page Application) served by Nginx (or Hono static middleware) within the same container.


* **External Data:**
* **Scryfall API:** The browser fetches images directly. The server *never* touches image data.



```mermaid
graph TD
    User[User / Researcher]
    Browser[Web Browser (Client)]
    HF[Hugging Face Docker Container]
    Scryfall[Scryfall API (External)]

    User -->|Interacts| Browser
    Browser -->|1. GET /game/state| HF
    Browser -->|2. Fetch Images (Client-side)| Scryfall
    HF -->|3. JSON State + AI Metadata| Browser
    
    subgraph HF [Manacore Container]
        GymServer[Gym Server (Node/Bun)]
        Engine[Manacore Engine]
        Bots[AI Agents (MCTS/PPO)]
        
        GymServer --> Engine
        GymServer --> Bots
    end

```

### 2. Technical Stack Specifications

We will keep the stack lightweight, type-safe, and modern.

* **Language:** TypeScript (Strict).
* **Build Tool:** Vite (Fastest build times, native ESM support).
* **Framework:** React 18+ (Component-based, easiest for complex state viz).
* **State Management:** Zustand (Simpler than Redux, perfect for game state).
* **Styling:** Tailwind CSS (Rapid UI development, consistent design system).
* **Visualization:**
* `react-force-graph` or `vis-network`: For the MCTS Tree visualization.
* `recharts`: For Win Probability and Evaluation graphs.
* `framer-motion`: For smooth card animations (essential for "game feel").



### 3. "Glass-Box" Feature Design

This is the core differentiator. We need to visualize the invisible.

#### A. The MCTS "Thought Cloud" (Tree Visualization)

When the AI is thinking, we visualize the search tree in real-time (or playback).

* **Nodes:** Represent Game States. Size = Visit Count (Confidence). Color = Win Rate (Red=Bad, Green=Good).
* **Edges:** Represent Actions taken.
* **Interaction:** Hovering over a node shows the "Expected Sequence" the AI is planning.

#### B. The "Saliency" Hand Overlay (Neural Net Viz)

If using the Neural/PPO bot:

* **Visual:** A semi-transparent heat map overlay on the cards in the AI's hand.
* **Meaning:** "The Neural Network is paying 90% attention to *Counterspell* right now." (Derived from attention weights or policy output distribution).

#### C. The "Win Probability" Seismograph

A live line chart at the bottom of the screen.

* **X-Axis:** Turns/Steps.
* **Y-Axis:** Estimated Win Probability (0% to 100%).
* **Events:** Annotate spikes with key moves (e.g., "Turn 4: Wrath of God cast -> Win Prob spiked to 80%").

### 4. Required Backend Extensions (API Contract)

To support this, `packages/gym-server` needs slight modifications to expose the "Brain" data. It currently only returns `observation`.

**Update `POST /game/:id/step` Response:**
We need to add a `debug` or `ai_state` field.

```typescript
// Proposed Response Interface
interface GameStepResponse {
  gameId: string;
  observation: number[]; // For the agent
  
  // NEW: Full semantic state for the UI (Human readable)
  clientState: {
    hand: CardData[];
    board: PermanentData[];
    stack: StackItem[];
    // ... logic to map Engine IDs to Scryfall Names
  };

  // NEW: The "Glass Box" Data
  aiThinking?: {
    agentName: string; // e.g., "MCTS-Expert"
    winProbability: number; // 0.75
    evaluatedNodes: number; // 5000
    rootNode?: {
      visits: number;
      value: number;
      children: { action: string; visits: number; value: number }[];
    };
    // For Neural Nets:
    policyDistribution?: { action: string; prob: number }[];
  };
}

```

### 5. UI/UX Layout Strategy (The "Lab" Interface)

We will use a **Three-Panel Layout**:

* **Left Panel (The Game Board):**
* Traditional layout: Opponent (Top), Battlefield (Mid), Player (Bottom).
* Clean, minimalistic. Use standard MTG metaphors (tapping, stacking).


* **Right Panel (The Inspector):**
* **Top:** "Brain View" (The MCTS Tree or Neural Heatmap).
* **Mid:** "Log & Probability" (Text log of actions + Win Prob Chart).
* **Bottom:** "Controls" (Play, Pause, Step, Take Control, Reset).


* **Overlay (The "Upload" Modal):**
* "Challenge the Arena": Drag & Drop a `.onnx` model or `.pt` weights file.



### 6. Implementation Plan

We will execute this in 3 sprints.

**Sprint 1: The Skeleton & Scryfall Bridge**

* Initialize `packages/web-client` with Vite + React + Tailwind.
* Implement `ScryfallService`:
* `getCardImage(name)`: Caches results in `localStorage` to be polite to API.


* Create a basic `Board` component that renders static dummy data.
* **Goal:** A static webpage showing a mock MTG board with real card images.

**Sprint 2: The Gym Connection & State Mapping**

* Update `gym-server` to return `clientState` (mapped from `GameState`).
* Implement `GameService` in React to poll/push actions to the local Gym.
* Wire up the Game Loop: Start Game -> Fetch State -> Render -> Click Card -> Send Action -> Repeat.
* **Goal:** A playable game of Magic in the browser (Human vs. RandomBot).

**Sprint 3: The "Glass Box" Visuals**

* Update `MCTSBot` to return its tree statistics in the result.
* Pass this data through `gym-server`.
* Implement the `InspectorPanel` with the Tree Viz and Probability Graph.
* Add the "Upload Agent" hook.
* **Goal:** The full "Research Dashboard."
