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
  { key: 'life', label: 'Life', color: 'bg-red-500', icon: '❤️' },
  { key: 'board', label: 'Board', color: 'bg-blue-500', icon: '⚔️' },
  { key: 'cards', label: 'Cards', color: 'bg-purple-500', icon: '🃏' },
  { key: 'mana', label: 'Mana', color: 'bg-yellow-500', icon: '💎' },
  { key: 'tempo', label: 'Tempo', color: 'bg-green-500', icon: '⚡' },
] as const;

export function EvaluationBreakdown({ evaluation }: EvaluationBreakdownProps) {
  const maxFactor = Math.max(...FACTORS.map((f) => Math.abs(evaluation[f.key])), 0.01);

  return (
    <div className="bg-board-bg/30 rounded p-3 space-y-3">
      {/* Total score */}
      <div className="flex items-center justify-between pb-2 border-b border-board-accent/30">
        <span className="text-sm font-semibold">Total Evaluation</span>
        <span
          className={clsx(
            'text-lg font-mono font-bold',
            evaluation.total > 0.6
              ? 'text-green-400'
              : evaluation.total > 0.4
                ? 'text-yellow-400'
                : 'text-red-400',
          )}
        >
          {(evaluation.total * 100).toFixed(1)}%
        </span>
      </div>

      {/* Factor breakdown */}
      {FACTORS.map(({ key, label, color, icon }) => {
        const value = evaluation[key];
        const absValue = Math.abs(value);
        const barWidth = (absValue / maxFactor) * 100;
        const isPositive = value >= 0;

        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-gray-400">
                <span>{icon}</span>
                {label}
              </span>
              <span className={clsx('font-mono', isPositive ? 'text-green-400' : 'text-red-400')}>
                {isPositive ? '+' : ''}
                {(value * 100).toFixed(1)}
              </span>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={clsx('h-full transition-all duration-300', color)}
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>
        );
      })}

      <p className="text-xs text-gray-500 pt-2">
        Values show contribution to win probability. Positive = favoring player.
      </p>
    </div>
  );
}
