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
    <div className="bg-board-bg/30 rounded p-3 space-y-2">
      <p className="text-xs text-gray-500 mb-3">
        Neural network action probabilities (policy head output)
      </p>

      {top5.map((item, index) => {
        const barWidth = (item.probability / maxProb) * 100;
        const isTop = index === 0;

        return (
          <div key={item.actionIndex} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span
                className={clsx('truncate max-w-[200px]', isTop && 'text-green-400 font-medium')}
              >
                {item.description}
              </span>
              <span className={clsx('font-mono ml-2', isTop && 'text-green-400')}>
                {(item.probability * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={clsx(
                  'h-full transition-all duration-300',
                  isTop ? 'bg-green-500' : 'bg-blue-500',
                )}
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>
        );
      })}

      {sorted.length > 5 && (
        <div className="text-xs text-gray-500 text-center pt-2">
          +{sorted.length - 5} other actions with lower probability
        </div>
      )}
    </div>
  );
}
