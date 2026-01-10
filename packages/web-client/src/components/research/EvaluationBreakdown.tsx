import { clsx } from 'clsx';

interface EvaluationBreakdownProps {
  evaluation: {
    life: number;
    board: number;
    cards: number;
    mana: number;
    tempo: number;
    total: number;
  };
}

const FACTORS = [
  { key: 'life', label: 'Life', color: 'bg-accent-danger', icon: '❤️' },
  { key: 'board', label: 'Board', color: 'bg-accent-primary', icon: '⚔️' },
  { key: 'cards', label: 'Cards', color: 'bg-purple-500', icon: '🃏' },
  { key: 'mana', label: 'Mana', color: 'bg-yellow-500', icon: '💎' },
  { key: 'tempo', label: 'Tempo', color: 'bg-accent-success', icon: '⚡' },
] as const;

export function EvaluationBreakdown({ evaluation }: EvaluationBreakdownProps) {
  const maxFactor = Math.max(...FACTORS.map((f) => Math.abs(evaluation[f.key])), 0.01);

  return (
    <div className="glass-panel p-3 rounded-lg space-y-3">
      {/* Total score */}
      <div className="flex items-center justify-between pb-2 border-b border-glass-border">
        <span className="text-xs font-bold text-white uppercase tracking-wide">
          Heuristic Score
        </span>
        <span
          className={clsx(
            'text-sm font-mono font-bold',
            evaluation.total > 0.6
              ? 'text-accent-success'
              : evaluation.total > 0.4
                ? 'text-yellow-400'
                : 'text-accent-danger',
          )}
        >
          {(evaluation.total * 100).toFixed(1)}%
        </span>
      </div>

      {/* Factor breakdown */}
      <div className="space-y-2.5">
        {FACTORS.map(({ key, label, color, icon }) => {
          const value = evaluation[key];
          const absValue = Math.abs(value);
          const barWidth = (absValue / maxFactor) * 100;
          const isPositive = value >= 0;

          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="flex items-center gap-1.5 text-glass-text-secondary">
                  <span className="text-xs">{icon}</span>
                  <span className="uppercase font-semibold tracking-wide">{label}</span>
                </span>
                <span
                  className={clsx(
                    'font-mono font-bold',
                    isPositive ? 'text-accent-success' : 'text-accent-danger',
                  )}
                >
                  {isPositive ? '+' : ''}
                  {(value * 100).toFixed(1)}
                </span>
              </div>

              {/* Center-aligned bar chart logic */}
              <div className="h-1 bg-black/40 rounded-full overflow-hidden relative">
                <div
                  className={clsx(
                    'h-full absolute transition-all duration-300 rounded-full',
                    color,
                  )}
                  style={{
                    width: `${barWidth}%`,
                    opacity: 0.8,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
