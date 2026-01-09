import { useState } from 'react';
import { GameBoard } from './components/GameBoard';
import { InspectorPanel } from './components/InspectorPanel';
import { ControlPanel } from './components/ControlPanel';
import { useGameStore } from './store/gameStore';

export default function App() {
  const { gameState, isLoading } = useGameStore();

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      {/* Left: Game Board (main area) */}
      <main className="flex-1 flex flex-col min-w-0">
        <Header />
        <div className="flex-1 overflow-hidden">
          <GameBoard />
        </div>
      </main>

      {/* Right: Inspector Panel */}
      <aside className="w-[420px] flex flex-col border-l border-board-accent/30 bg-board-surface">
        <InspectorPanel />
        <ControlPanel />
      </aside>

      {/* Loading overlay */}
      {isLoading && <LoadingOverlay />}

      {/* Welcome modal when no game */}
      {!gameState && !isLoading && <WelcomeModal />}
    </div>
  );
}

function Header() {
  const { gameState } = useGameStore();

  return (
    <header className="h-12 flex items-center justify-between px-4 bg-board-surface border-b border-board-accent/30">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-board-highlight">ManaCore</h1>
        <span className="text-xs text-gray-500 uppercase tracking-wider">Glass-Box AI Lab</span>
      </div>
      {gameState && (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-400">
            Turn <span className="text-white font-mono">{gameState.turn}</span>
          </span>
          <span className="text-gray-400">
            Phase: <span className="text-white">{gameState.phase}</span>
          </span>
        </div>
      )}
    </header>
  );
}

function LoadingOverlay() {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-board-highlight border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-300">Loading...</span>
      </div>
    </div>
  );
}

function WelcomeModal() {
  const { startGame } = useGameStore();
  const [seedInput, setSeedInput] = useState('');

  const getSeed = () => {
    const parsed = parseInt(seedInput, 10);
    return isNaN(parsed) ? undefined : parsed;
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="panel max-w-lg w-full mx-4 p-6">
        <h2 className="text-2xl font-bold text-board-highlight mb-2">Welcome to ManaCore</h2>
        <p className="text-gray-400 mb-6">
          The Glass-Box AI Lab for Magic: The Gathering. Watch AI agents think, explore their
          decision trees, and understand how they play.
        </p>

        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-sm text-gray-400">Random Seed (Optional):</label>
            <input
              type="number"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              className="bg-board-bg border border-board-accent/30 rounded px-2 py-1 text-sm text-white w-24"
              placeholder="e.g. 123"
            />
          </div>

          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Start a Game
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => void startGame('human', 'greedy', 'red', 'red', getSeed())}
              className="btn btn-primary text-left p-4"
            >
              <div className="font-semibold">Human vs Greedy</div>
              <div className="text-xs text-gray-300 mt-1">Play against the heuristic bot</div>
            </button>

            <button
              onClick={() => void startGame('human', 'mcts', 'red', 'red', getSeed())}
              className="btn btn-primary text-left p-4"
            >
              <div className="font-semibold">Human vs MCTS</div>
              <div className="text-xs text-gray-300 mt-1">Challenge the search-based AI</div>
            </button>

            <button
              onClick={() => void startGame('greedy', 'mcts', 'red', 'red', getSeed())}
              className="btn btn-secondary text-left p-4"
            >
              <div className="font-semibold">Greedy vs MCTS</div>
              <div className="text-xs text-gray-300 mt-1">Watch AI vs AI battle</div>
            </button>

            <button
              onClick={() => void startGame('mcts', 'mcts', 'red', 'red', getSeed())}
              className="btn btn-secondary text-left p-4"
            >
              <div className="font-semibold">MCTS vs MCTS</div>
              <div className="text-xs text-gray-300 mt-1">Mirror match analysis</div>
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-6 text-center">
          Powered by ManaCore Engine - 302+ cards from 6th Edition
        </p>
      </div>
    </div>
  );
}
