import { clsx } from 'clsx';

interface PolicyDistributionProps {
  distribution: Array<{
    actionIndex: number;
    description: string;
    probability: number;
  }>;
}

export function PolicyDistribution({ distribution }: PolicyDistributionProps) {
  // Sort by probability and take top 5
  const sorted = [...distribution].sort((a, b) => b.probability - a.probability);
  const top5 = sorted.slice(0, 5);
  const maxProb = Math.max(...top5.map((d) => d.probability), 0.01);

  return (
    <div className="glass-panel p-3 rounded-lg space-y-3">
      <div className="text-[10px] text-glass-text-secondary uppercase tracking-wider font-semibold border-b border-white/5 pb-2">
        Neural Network Output
      </div>

      <div className="space-y-3">
        {top5.map((item, index) => {
          const barWidth = (item.probability / maxProb) * 100;
          const isTop = index === 0;

          return (
            <div key={item.actionIndex} className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span
                  className={clsx(
                    'truncate max-w-[200px]',
                    isTop ? 'text-white font-medium' : 'text-glass-text-primary',
                  )}
                >
                  {item.description}
                </span>
                <span
                  className={clsx(
                    'font-mono',
                    isTop ? 'text-accent-success font-bold' : 'text-glass-text-secondary',
                  )}
                >
                  {(item.probability * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                <div
                  className={clsx(
                    'h-full transition-all duration-300',
                    isTop ? 'bg-accent-success' : 'bg-accent-primary/60',
                  )}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {sorted.length > 5 && (
        <div className="text-[10px] text-glass-text-muted text-center italic border-t border-white/5 pt-2">
          +{sorted.length - 5} other low-probability candidates
        </div>
      )}
    </div>
  );
}
