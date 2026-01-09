import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { BotType } from '../../types';

export function WelcomeModal() {
  const { startGame } = useGameStore();
  const [seedInput, setSeedInput] = useState('');

  const getSeed = () => {
    const parsed = parseInt(seedInput, 10);
    return isNaN(parsed) ? undefined : parsed;
  };

  const handleStart = (player: BotType, opponent: BotType) => {
    void startGame(player, opponent, 'red', 'red', getSeed());
  };

  return (
    <div className="fixed inset-0 bg-glass-base/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-panel w-full max-w-2xl overflow-hidden relative group">
        {/* Decorative background gradients */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent-secondary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="relative p-8">
          <div className="text-center mb-10">
            <h2 className="text-4xl font-display font-bold text-white mb-3 tracking-wide">
              Welcome to ManaCore
            </h2>
            <p className="text-glass-text-secondary max-w-md mx-auto leading-relaxed">
              The Glass-Box AI Lab for Magic: The Gathering. <br />
              Watch agents think, explore decision trees, and analyze gameplay.
            </p>
          </div>

          <div className="space-y-8">
            {/* Settings Row */}
            <div className="flex justify-center">
              <div className="flex items-center gap-3 bg-glass-panel px-4 py-2 rounded-full border border-glass-border">
                <label className="text-xs font-semibold text-glass-text-muted uppercase tracking-wider">
                  Seed
                </label>
                <input
                  type="number"
                  value={seedInput}
                  onChange={(e) => setSeedInput(e.target.value)}
                  className="bg-transparent border-none text-sm text-white w-20 focus:ring-0 text-right placeholder-glass-text-muted/50 font-mono"
                  placeholder="Random"
                />
              </div>
            </div>

            {/* Mode Selection Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <GameModeButton
                title="Human vs Greedy"
                description="Practice against a heuristic-based baseline bot."
                icon="🎮"
                color="blue"
                onClick={() => handleStart('human', 'greedy')}
              />
              <GameModeButton
                title="Human vs MCTS"
                description="Challenge the Monte Carlo Tree Search agent."
                icon="🧠"
                color="violet"
                onClick={() => handleStart('human', 'mcts')}
              />
              <GameModeButton
                title="Greedy vs MCTS"
                description="Watch heuristic heuristics battle pure search."
                icon="🤖"
                color="cyan"
                onClick={() => handleStart('greedy', 'mcts')}
              />
              <GameModeButton
                title="MCTS vs MCTS"
                description="Deep analysis: Search agent mirror match."
                icon="⚡"
                color="emerald"
                onClick={() => handleStart('mcts', 'mcts')}
              />
            </div>
          </div>

          <div className="mt-10 text-center">
            <span className="text-[10px] text-glass-text-muted uppercase tracking-widest border border-glass-border px-3 py-1 rounded-full">
              Engine v0.1.0 • 6th Edition Ruleset
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function GameModeButton({
  title,
  description,
  icon,
  color,
  onClick,
}: {
  title: string;
  description: string;
  icon: string;
  color: 'blue' | 'violet' | 'cyan' | 'emerald';
  onClick: () => void;
}) {
  const colorClasses = {
    blue: 'hover:border-blue-500/50 hover:bg-blue-500/10 group-hover:text-blue-400',
    violet: 'hover:border-violet-500/50 hover:bg-violet-500/10 group-hover:text-violet-400',
    cyan: 'hover:border-cyan-500/50 hover:bg-cyan-500/10 group-hover:text-cyan-400',
    emerald: 'hover:border-emerald-500/50 hover:bg-emerald-500/10 group-hover:text-emerald-400',
  };

  return (
    <button
      onClick={onClick}
      className={`relative text-left p-5 rounded-xl border border-glass-border bg-glass-surface/50 backdrop-blur-sm transition-all duration-300 group hover:-translate-y-1 hover:shadow-lg ${colorClasses[color]}`}
    >
      <div className="flex items-start gap-4">
        <div className="text-3xl bg-glass-panel w-12 h-12 rounded-lg flex items-center justify-center shadow-inner border border-white/5">
          {icon}
        </div>
        <div>
          <h3 className="font-bold text-white mb-1 group-hover:text-white transition-colors">
            {title}
          </h3>
          <p className="text-xs text-glass-text-secondary leading-relaxed">{description}</p>
        </div>
      </div>
    </button>
  );
}
