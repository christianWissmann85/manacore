import type { MCTSTreeNode } from '../types';
import { clsx } from 'clsx';

interface MCTSTreeViewProps {
  tree: MCTSTreeNode;
}

export function MCTSTreeView({ tree }: MCTSTreeViewProps) {
  // Sort children by visits (most explored first)
  const sortedChildren = [...tree.children].sort((a, b) => b.visits - a.visits);
  const topChildren = sortedChildren.slice(0, 5);
  const maxVisits = Math.max(...topChildren.map((c) => c.visits), 1);

  if (topChildren.length === 0) {
    return (
      <div className="text-gray-500 text-sm text-center py-4">No search tree data available</div>
    );
  }

  return (
    <div className="space-y-2">
      {topChildren.map((child, index) => (
        <MCTSNodeBar
          key={index}
          node={child}
          rank={index + 1}
          maxVisits={maxVisits}
          isBest={index === 0}
        />
      ))}

      {sortedChildren.length > 5 && (
        <div className="text-xs text-gray-500 text-center">
          +{sortedChildren.length - 5} more actions explored
        </div>
      )}

      {/* Tree stats */}
      <div className="flex justify-between text-xs text-gray-500 mt-3 pt-2 border-t border-board-accent/30">
        <span>Root visits: {tree.visits.toLocaleString()}</span>
        <span>Branches: {tree.children.length}</span>
      </div>
    </div>
  );
}

interface MCTSNodeBarProps {
  node: MCTSTreeNode;
  rank: number;
  maxVisits: number;
  isBest: boolean;
}

function MCTSNodeBar({ node, rank, maxVisits, isBest }: MCTSNodeBarProps) {
  const visitPercent = (node.visits / maxVisits) * 100;
  const winRate = node.winRate;

  // Color based on win rate: red (0%) -> yellow (50%) -> green (100%)
  const getWinRateColor = (rate: number) => {
    if (rate < 0.4) return 'bg-red-500';
    if (rate < 0.6) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div
      className={clsx('relative bg-board-bg/50 rounded p-2', isBest && 'ring-1 ring-green-500/50')}
    >
      {/* Rank badge */}
      <div className="absolute -left-1 -top-1 w-5 h-5 bg-board-accent rounded-full flex items-center justify-center text-xs font-bold">
        {rank}
      </div>

      {/* Action name */}
      <div className="flex items-center justify-between mb-1 pl-4">
        <span className={clsx('text-sm font-medium', isBest && 'text-green-400')}>
          {node.action ?? 'Root'}
        </span>
        <span className="text-xs text-gray-400">{node.visits.toLocaleString()} visits</span>
      </div>

      {/* Visit bar */}
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-1">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${visitPercent}%` }}
        />
      </div>

      {/* Win rate */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">Win Rate:</span>
        <div className="flex items-center gap-2">
          <div className="w-16 h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={clsx('h-full transition-all duration-300', getWinRateColor(winRate))}
              style={{ width: `${winRate * 100}%` }}
            />
          </div>
          <span className={clsx('font-mono', getWinRateColor(winRate).replace('bg-', 'text-'))}>
            {(winRate * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}
