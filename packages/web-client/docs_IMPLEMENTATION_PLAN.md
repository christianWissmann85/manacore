# Dual-Mode UI Implementation Plan

**Date:** January 10, 2026
**Status:** Approved for Implementation
**Package:** packages/web-client

---

## Executive Summary

This document captures the finalized implementation plan for the "Dual-Mode" UI initiative, splitting the web-client into **Play Mode** (immersive human experience) and **Research Lab** (high-density AI analysis dashboard).

### Key Decisions

| Decision | Choice |
|----------|--------|
| Mode switching | URL query param + localStorage (URL overrides) |
| Default mode | Play |
| Animation library | Framer Motion |
| Time Travel markers | Auto-generated + user bookmarks |
| Card sizing in Research | Configurable (user preference) |
| Phase execution | Sequential |
| Mobile support | Out of scope (desktop only) |

---

## Architecture

### Mode Router (App.tsx)

```typescript
const getMode = (): 'play' | 'research' => {
  const urlParams = new URLSearchParams(window.location.search);
  const urlMode = urlParams.get('mode');
  if (urlMode === 'play' || urlMode === 'research') return urlMode;
  return localStorage.getItem('manacore-mode') as 'play' | 'research' || 'play';
};
```

**URLs:**
- Play Mode: `https://app.example.com/` or `?mode=play`
- Research Lab: `https://app.example.com/?mode=research`

### Directory Structure

```
src/
├── components/
│   ├── core/                    # Shared by BOTH modes
│   │   ├── Card.tsx
│   │   ├── Battlefield.tsx
│   │   ├── ManaSymbols.tsx
│   │   ├── LifeCounter.tsx
│   │   ├── ManaDisplay.tsx
│   │   ├── ZoneIndicator.tsx
│   │   └── index.ts
│   │
│   ├── play/                    # Play Mode exclusives
│   │   ├── PlayHand.tsx
│   │   ├── PlayStack.tsx
│   │   ├── ActionPrompt.tsx
│   │   ├── AnimationLayer.tsx
│   │   ├── PlayerHUD.tsx
│   │   ├── PlayActionBar.tsx
│   │   └── index.ts
│   │
│   └── research/                # Research Lab exclusives
│       ├── MCTSTreeView.tsx
│       ├── WinProbabilityChart.tsx
│       ├── EvaluationBreakdown.tsx
│       ├── PolicyDistribution.tsx
│       ├── ActionLog.tsx
│       ├── StateInspector.tsx
│       ├── TimelineScrubber.tsx
│       ├── ResearchControlPanel.tsx
│       └── index.ts
│
├── layouts/
│   ├── PlayLayout.tsx
│   ├── ResearchLayout.tsx
│   ├── Header.tsx               # Mode-aware header
│   └── index.ts
│
├── store/
│   └── gameStore.ts             # Unchanged - shared by both modes
│
├── services/                    # Unchanged
├── hooks/                       # Unchanged
├── types/                       # Unchanged
└── App.tsx                      # Mode router
```

### Component Migration Map

| Current Component | Destination | Action |
|-------------------|-------------|--------|
| Card.tsx | `core/Card.tsx` | Move, add `displayMode` prop |
| Battlefield.tsx | `core/Battlefield.tsx` | Move, add `compact` prop |
| ManaSymbols.tsx | `core/ManaSymbols.tsx` | Move as-is |
| LifeCounter.tsx | `core/LifeCounter.tsx` | Move as-is |
| ManaDisplay.tsx | `core/ManaDisplay.tsx` | Move as-is |
| ZoneIndicator.tsx | `core/ZoneIndicator.tsx` | Move as-is |
| Hand.tsx | `play/PlayHand.tsx` | Move, enhance with animations |
| Stack.tsx | `play/PlayStack.tsx` | Move, simplify for immersion |
| ActionBar.tsx | `play/PlayActionBar.tsx` | Move, clean up UI |
| PlayerArea.tsx | `play/PlayerHUD.tsx` | Refactor into compact HUD |
| GameBoard.tsx | **Retire** | Logic moves into layouts |
| MainLayout.tsx | **Retire** | Replaced by Play/ResearchLayout |
| Header.tsx | `layouts/Header.tsx` | Move, add mode toggle |
| InspectorPanel.tsx | **Retire** | Research components standalone |
| MCTSTreeView.tsx | `research/MCTSTreeView.tsx` | Move, enhance expand/collapse |
| WinProbabilityChart.tsx | `research/WinProbabilityChart.tsx` | Move, add click-to-seek |
| EvaluationBreakdown.tsx | `research/EvaluationBreakdown.tsx` | Move as-is |
| PolicyDistribution.tsx | `research/PolicyDistribution.tsx` | Move as-is |
| ActionLog.tsx | `research/ActionLog.tsx` | Move, add click-to-highlight |
| ControlPanel.tsx | `research/ResearchControlPanel.tsx` | Move, research-specific |
| CardPreview.tsx | `research/CardPreview.tsx` | Move (research inspection) |

---

## Phase 1: The Great Refactor (Architecture)

**Goal:** Establish dual-mode architecture without breaking existing functionality.

### Tasks

- [ ] **1.1** Create directory structure
  ```bash
  mkdir -p src/components/{core,play,research}
  mkdir -p src/layouts
  ```

- [ ] **1.2** Move core components
  - Move: Card, Battlefield, ManaSymbols, LifeCounter, ManaDisplay, ZoneIndicator
  - Create `src/components/core/index.ts` barrel export

- [ ] **1.3** Move play components
  - Copy Hand.tsx → PlayHand.tsx
  - Copy Stack.tsx → PlayStack.tsx
  - Copy ActionBar.tsx → PlayActionBar.tsx
  - Copy PlayerArea.tsx → PlayerHUD.tsx
  - Create `src/components/play/index.ts` barrel export

- [ ] **1.4** Move research components
  - Move: MCTSTreeView, WinProbabilityChart, EvaluationBreakdown, PolicyDistribution, ActionLog
  - Copy ControlPanel.tsx → ResearchControlPanel.tsx
  - Copy CardPreview.tsx → research/
  - Create `src/components/research/index.ts` barrel export

- [ ] **1.5** Create layout shells
  - Create `PlayLayout.tsx` (wraps existing MainLayout behavior initially)
  - Create `ResearchLayout.tsx` (wraps existing MainLayout behavior initially)
  - Move Header.tsx to layouts/, add mode toggle button

- [ ] **1.6** Implement mode router in App.tsx
  ```typescript
  function App() {
    const mode = useMode(); // URL + localStorage logic
    const { gameState, isLoading } = useGameStore();

    return (
      <>
        {mode === 'play' ? <PlayLayout /> : <ResearchLayout />}
        {isLoading && <LoadingOverlay />}
        {!gameState && !isLoading && <WelcomeModal />}
      </>
    );
  }
  ```

- [ ] **1.7** Update all import paths throughout codebase

- [ ] **1.8** Add mode to gameStore (for persistence)
  ```typescript
  interface GameStore {
    // ... existing
    uiMode: 'play' | 'research';
    setUIMode: (mode: 'play' | 'research') => void;
  }
  ```

- [ ] **1.9** Verify both modes render identically to current state

- [ ] **1.10** Delete retired components (GameBoard, MainLayout, InspectorPanel)

### Deliverable
Mode switching works via URL (`?mode=research`) and toggle button. Both modes currently look identical.

### Testing Checklist
- [ ] Play mode loads at `/` and `/?mode=play`
- [ ] Research mode loads at `/?mode=research`
- [ ] Mode persists across refresh (localStorage)
- [ ] URL param overrides localStorage
- [ ] Mode toggle in header works
- [ ] Game starts correctly in both modes
- [ ] Actions execute correctly in both modes

---

## Phase 2: Polish Play Mode (Experience)

**Goal:** Transform Play Mode into an immersive, distraction-free experience.

### Tasks

- [ ] **2.1** Strip research components from PlayLayout
  - Remove all chart/inspector imports
  - Remove sidebar entirely
  - Full-width game board

- [ ] **2.2** Implement CSS variable system for card sizing
  ```css
  :root {
    --card-width-play: 126px;
    --card-height-play: 176px;
    --card-width-research: 63px;
    --card-height-research: 88px;
  }
  ```

- [ ] **2.3** Enhance PlayHand.tsx
  - Larger cards (medium → large size)
  - Improved fan-out effect with vertical arch
  - Hover lift animation (Framer Motion)
  - Playable card indicators (green glow pulse)

- [ ] **2.4** Build PlayStack.tsx (floating overlay)
  - Position: fixed right, vertically centered
  - Glass-morphism styling
  - Shows card art + name only
  - Framer Motion enter/exit animations
  - Auto-hide when empty

- [ ] **2.5** Build ActionPrompt.tsx (modal decisions)
  - Centered modal with backdrop blur
  - Clear action buttons
  - Target highlighting on board
  - Keyboard shortcuts (1-9 for options)

- [ ] **2.6** Refactor PlayActionBar
  - Floating dock at bottom center
  - Minimal buttons (contextual)
  - Phase indicator as subtle label
  - "Pass Priority" always visible

- [ ] **2.7** Build AnimationLayer.tsx
  ```typescript
  type AnimationType = 'draw' | 'damage' | 'counter' | 'resolve' | 'destroy' | 'tap' | 'untap';

  interface AnimationEvent {
    id: string;
    type: AnimationType;
    sourceId?: string;
    targetId?: string;
    value?: number;
  }
  ```
  - Framer Motion AnimatePresence
  - Particle effects for damage (red sparks)
  - Card draw animation (slide from deck)
  - Spell counter effect (shatter)

- [ ] **2.8** Implement PlayerHUD (compact player info)
  - Opponent: Avatar, Life, Hand count badge
  - Player: Life (large), Mana pool (expanded)
  - Active player/priority indicators

- [ ] **2.9** PlayLayout final assembly
  ```
  ┌─────────────────────────────────────┐
  │ Header (minimal: turn, phase, mode) │
  ├─────────────────────────────────────┤
  │ Opponent HUD                        │
  ├─────────────────────────────────────┤
  │                                     │
  │         BATTLEFIELD                 │
  │         (full width)                │
  │                                     │
  │                          [Stack]    │
  ├─────────────────────────────────────┤
  │ Player HUD  │  HAND (large cards)   │
  ├─────────────────────────────────────┤
  │      [ Action Dock (floating) ]     │
  └─────────────────────────────────────┘
  ```

### Deliverable
Play Mode is visually distinct, immersive, and free of debug clutter.

### Testing Checklist
- [ ] No research components visible in Play Mode
- [ ] Cards render at large size
- [ ] Hand fan effect works smoothly
- [ ] Stack appears/disappears correctly
- [ ] Action prompts work for targeting
- [ ] Animations fire on game events
- [ ] Pass Priority works
- [ ] Full game playable start to finish

---

## Phase 3: Build Research Dashboard (Data)

**Goal:** Create the 3-column high-density Research Lab dashboard.

### Tasks

- [ ] **3.1** Implement 3-column CSS Grid in ResearchLayout
  ```css
  .research-grid {
    display: grid;
    grid-template-columns: 20% 40% 40%;
    grid-template-rows: 1fr auto; /* main + scrubber */
    height: 100vh;
    gap: 8px;
    padding: 8px;
  }
  ```

- [ ] **3.2** Build Column 1: Match Narrative
  - WinProbabilityChart (top 40%)
  - ActionLog (bottom 60%)
  - Scrollable, dense text

- [ ] **3.3** Build Column 2: The State
  - Compact board view (`size="small"` or text mode)
  - Clear zone labels
  - Phase/Step banner (prominent)
  - Mini hand display
  - Stack as list (not overlay)

- [ ] **3.4** Build Column 3: The Brain
  - MCTSTreeView (top 50%)
  - PolicyDistribution (middle 25%)
  - EvaluationBreakdown (bottom 25%)

- [ ] **3.5** Enhance MCTSTreeView
  - Expandable/collapsible nodes
  - Principal Variation highlight (best path)
  - Color gradient by visit count
  - Click node for detailed stats panel

- [ ] **3.6** Enhance ActionLog with click-to-highlight
  - Click entry → highlight cards on board
  - Click entry → seek timeline to that moment
  - Show AI thinking inline for each entry

- [ ] **3.7** Wire WinProbabilityChart click-to-seek
  - Click point on chart → seek to that turn
  - Hover shows tooltip with action description

- [ ] **3.8** Build StateInspector.tsx
  - Collapsible JSON tree view
  - Sections: player, opponent, stack, legalActions
  - Copy-to-clipboard button
  - Toggle: formatted vs raw

- [ ] **3.9** Add card size toggle (configurable density)
  ```typescript
  type ResearchCardMode = 'thumbnail' | 'text' | 'mini';
  // User preference stored in localStorage
  ```

- [ ] **3.10** ResearchLayout final assembly
  ```
  ┌─────────────────┬──────────────────────┬─────────────────────┐
  │ Win Prob Chart  │  Opponent Battlefield │  MCTS Tree View     │
  │                 │  (compact)            │  (expandable)       │
  │─────────────────│                       │─────────────────────│
  │                 │  Player Battlefield   │  Policy Distribution│
  │ Action Log      │  (compact)            │─────────────────────│
  │ (verbose)       │                       │  Eval Breakdown     │
  │                 │  [Phase: MAIN 2]      │                     │
  │                 │  Hand + Stack (mini)  │  [State Inspector]  │
  └─────────────────┴──────────────────────┴─────────────────────┘
  ```

### Deliverable
Research Lab is a fully functional 3-column analysis dashboard.

### Testing Checklist
- [ ] 3-column layout renders correctly
- [ ] All research components display data
- [ ] MCTS tree expands/collapses
- [ ] Action log click highlights cards
- [ ] Win probability chart click seeks timeline
- [ ] Card size toggle works
- [ ] State inspector shows raw state
- [ ] AI vs AI game observable start to finish

---

## Phase 4: Time Travel & Analysis (Advanced)

**Goal:** Enable historical analysis with timeline scrubbing.

### Tasks

- [ ] **4.1** Build TimelineScrubber.tsx
  ```typescript
  interface TimelineScrubberProps {
    history: HistoryEntry[];
    currentIndex: number;
    onSeek: (index: number) => void;
    markers: TimelineMarker[];
  }

  interface TimelineMarker {
    index: number;
    type: 'auto' | 'user';
    label: string;
    color?: string;
  }
  ```

- [ ] **4.2** Implement auto-generated markers
  - Win probability swings > 10%
  - Combat phases
  - Spell counters
  - Creature deaths
  - Game-ending turns

- [ ] **4.3** Add user bookmark functionality
  - Click to add marker at current position
  - Custom label input
  - Delete bookmark option

- [ ] **4.4** Implement keyboard navigation
  - `←` / `→` : Step backward/forward
  - `Shift + ←` / `Shift + →` : Jump to previous/next turn
  - `Home` / `End` : Jump to start/end
  - `Space` : Play/pause auto-replay

- [ ] **4.5** Add marker hover previews
  - Tooltip with turn/phase info
  - Mini board state preview
  - Win probability at that moment

- [ ] **4.6** Visual scrubber design
  ```
  ┌────────────────────────────────────────────────────────────┐
  │ ◄ ═══●═══════════▲═════════════════●══════════════════ ►  │
  │     T1          T3               T5                   T8  │
  │                (auto)          (user)                     │
  │     Win Prob Sparkline overlay                            │
  └────────────────────────────────────────────────────────────┘
  ```

- [ ] **4.7** Integrate scrubber into ResearchLayout
  - Fixed position at bottom
  - Full width
  - Always visible during replay

- [ ] **4.8** Add state comparison view (optional enhancement)
  - Side-by-side: "Before" vs "After" for selected action
  - Highlight changes (cards added/removed, life changes)

### Deliverable
Researchers can scrub through game history, bookmark moments, and analyze decisions.

### Testing Checklist
- [ ] Scrubber displays full game history
- [ ] Click-to-seek works
- [ ] Auto markers appear at correct positions
- [ ] User can add/remove bookmarks
- [ ] Keyboard navigation works
- [ ] Board state updates when scrubbing
- [ ] AI thinking updates when scrubbing
- [ ] Sparkline overlay shows win probability trend

---

## Success Criteria

### Play Mode
- Human can play a full game against AI without seeing any debug data
- UI feels immersive and "game-like"
- Actions are intuitive (click card → see options → execute)
- Animations provide feedback for game events

### Research Lab
- All AI thinking data visible at a glance
- Can observe AI vs AI games with full telemetry
- Time travel enables precise moment analysis
- Data density maximized without overwhelming

### Technical
- Mode switching is instant (no reload)
- GameStore is shared (no data duplication)
- Performance remains smooth (60fps animations)
- All existing tests pass

---

## Appendix: Files to Create

### Phase 1
- `src/components/core/index.ts`
- `src/components/play/index.ts`
- `src/components/research/index.ts`
- `src/layouts/PlayLayout.tsx`
- `src/layouts/ResearchLayout.tsx`
- `src/layouts/index.ts`
- `src/hooks/useMode.ts`

### Phase 2
- `src/components/play/PlayHand.tsx`
- `src/components/play/PlayStack.tsx`
- `src/components/play/ActionPrompt.tsx`
- `src/components/play/AnimationLayer.tsx`
- `src/components/play/PlayerHUD.tsx`
- `src/components/play/PlayActionBar.tsx`

### Phase 3
- `src/components/research/StateInspector.tsx`

### Phase 4
- `src/components/research/TimelineScrubber.tsx`

---

## Appendix: Files to Delete (After Migration)

- `src/components/GameBoard.tsx`
- `src/components/layout/MainLayout.tsx`
- `src/components/InspectorPanel.tsx`
- `src/components/Hand.tsx` (replaced by PlayHand)
- `src/components/Stack.tsx` (replaced by PlayStack)
- `src/components/ActionBar.tsx` (replaced by PlayActionBar)
- `src/components/PlayerArea.tsx` (replaced by PlayerHUD)
- `src/components/ControlPanel.tsx` (replaced by ResearchControlPanel)

---

*Document approved for implementation on January 10, 2026.*
