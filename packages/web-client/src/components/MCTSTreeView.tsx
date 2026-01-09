import { useState, useCallback } from 'react';
import type { MCTSTreeNode } from '../types';
import { clsx } from 'clsx';

interface MCTSTreeViewProps {
  tree: MCTSTreeNode;
}

export function MCTSTreeView({ tree }: MCTSTreeViewProps) {
  const [selectedNode, setSelectedNode] = useState<MCTSTreeNode | null>(null);
  const [viewMode, setViewMode] = useState<'bars' | 'tree'>('bars');

  // Sort children by visits (most explored first)
  const sortedChildren = [...tree.children].sort((a, b) => b.visits - a.visits);
  const topChildren = sortedChildren.slice(0, 5);
  const maxVisits = Math.max(...topChildren.map((c) => c.visits), 1);

  if (topChildren.length === 0) {
    return (
      <div className="text-glass-text-muted text-sm text-center py-4 italic opacity-70">
        No search tree data available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* View mode toggle */}
      <div className="flex items-center justify-end gap-1 mb-2">
        <button
          onClick={() => setViewMode('bars')}
          className={clsx(
            'px-3 py-1 text-[10px] uppercase font-bold rounded-l transition-colors border border-glass-border',
            viewMode === 'bars'
              ? 'bg-accent-primary text-white border-accent-primary'
              : 'bg-glass-panel text-glass-text-muted hover:text-white',
          )}
        >
          Bars
        </button>
        <button
          onClick={() => setViewMode('tree')}
          className={clsx(
            'px-3 py-1 text-[10px] uppercase font-bold rounded-r transition-colors border border-glass-border border-l-0',
            viewMode === 'tree'
              ? 'bg-accent-primary text-white border-accent-primary'
              : 'bg-glass-panel text-glass-text-muted hover:text-white',
          )}
        >
          Tree
        </button>
      </div>

      {viewMode === 'bars' ? (
        /* Bar view - compact action comparison */
        <div className="space-y-2">
          {topChildren.map((child, index) => (
            <MCTSNodeBar
              key={index}
              node={child}
              rank={index + 1}
              maxVisits={maxVisits}
              isBest={index === 0}
              isSelected={selectedNode === child}
              onSelect={() => setSelectedNode(selectedNode === child ? null : child)}
            />
          ))}
        </div>
      ) : (
        /* Tree view - hierarchical exploration */
        <div className="glass-panel rounded-lg p-2 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-glass-border">
          <MCTSTreeNodeView
            node={tree}
            depth={0}
            maxDepth={3}
            selectedNode={selectedNode}
            onSelectNode={setSelectedNode}
          />
        </div>
      )}

      {sortedChildren.length > 5 && viewMode === 'bars' && (
        <div className="text-[10px] text-glass-text-muted text-center pt-2">
          +{sortedChildren.length - 5} more actions explored
        </div>
      )}

      {/* Selected node details */}
      {selectedNode && (
        <div className="bg-accent-primary/5 border border-accent-primary/20 rounded-lg p-4 mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
            <span className="text-sm font-bold text-white truncate max-w-[200px]">
              {selectedNode.action ?? 'Root Node'}
            </span>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-glass-text-muted hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
            <div>
              <span className="text-glass-text-secondary block mb-0.5">Visits</span>
              <span className="font-mono text-white text-lg">
                {selectedNode.visits.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-glass-text-secondary block mb-0.5">Win Rate</span>
              <span
                className={clsx(
                  'font-mono text-lg font-bold',
                  selectedNode.winRate >= 0.55
                    ? 'text-accent-success'
                    : selectedNode.winRate <= 0.45
                      ? 'text-accent-danger'
                      : 'text-yellow-400',
                )}
              >
                {(selectedNode.winRate * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-glass-text-secondary block mb-0.5">Value Est.</span>
              <span className="font-mono text-glass-text-primary">
                {selectedNode.value.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-glass-text-secondary block mb-0.5">Branches</span>
              <span className="font-mono text-glass-text-primary">
                {selectedNode.children.length}
              </span>
            </div>
          </div>
          {selectedNode.children.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <span className="text-[10px] text-glass-text-muted uppercase tracking-widest block mb-2">
                Follow-up Moves
              </span>
              <div className="space-y-1.5">
                {selectedNode.children
                  .sort((a, b) => b.visits - a.visits)
                  .slice(0, 3)
                  .map((child, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs bg-black/20 rounded px-2 py-1.5 border border-white/5"
                    >
                      <span className="text-glass-text-primary truncate max-w-[150px]">
                        {child.action}
                      </span>
                      <span className="text-glass-text-muted font-mono text-[10px]">
                        {child.visits} visits
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tree stats */}
      <div className="flex justify-between text-[10px] text-glass-text-muted mt-3 pt-2 border-t border-glass-border opacity-60">
        <span>Root visits: {tree.visits.toLocaleString()}</span>
        <span>Total Branches: {tree.children.length}</span>
      </div>
    </div>
  );
}

interface MCTSNodeBarProps {
  node: MCTSTreeNode;
  rank: number;
  maxVisits: number;
  isBest: boolean;
  isSelected: boolean;
  onSelect: () => void;
}

function MCTSNodeBar({ node, rank, maxVisits, isBest, isSelected, onSelect }: MCTSNodeBarProps) {
  const visitPercent = (node.visits / maxVisits) * 100;
  const winRate = node.winRate;

  // Color based on win rate
  const getWinRateColor = (rate: number) => {
    if (rate < 0.4) return 'bg-accent-danger';
    if (rate < 0.6) return 'bg-yellow-500';
    return 'bg-accent-success';
  };

  const getWinRateText = (rate: number) => {
    if (rate < 0.4) return 'text-accent-danger';
    if (rate < 0.6) return 'text-yellow-400';
    return 'text-accent-success';
  };

  const hasChildren = node.children.length > 0;

  return (
    <div
      onClick={onSelect}
      className={clsx(
        'relative bg-glass-panel rounded-md p-2 cursor-pointer transition-all border hover:bg-glass-highlight',
        isBest ? 'border-accent-success/30' : 'border-glass-border',
        isSelected && 'ring-1 ring-accent-primary border-accent-primary',
      )}
    >
      {/* Rank badge */}
      <div
        className={clsx(
          'absolute -left-2 -top-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border shadow-sm z-10',
          isBest
            ? 'bg-accent-success text-black border-accent-success'
            : 'bg-glass-surface text-glass-text-muted border-glass-border',
        )}
      >
        {rank}
      </div>

      {/* Action name */}
      <div className="flex items-center justify-between mb-1.5 pl-2">
        <span
          className={clsx(
            'text-xs font-medium truncate max-w-[180px]',
            isBest ? 'text-white' : 'text-glass-text-primary',
          )}
        >
          {node.action ?? 'Root'}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-glass-text-muted font-mono">
            {node.visits.toLocaleString()}
          </span>
          {hasChildren && <span className="text-[8px] text-accent-primary">▶</span>}
        </div>
      </div>

      {/* Visit bar */}
      <div className="h-1 bg-black/40 rounded-full overflow-hidden mb-1.5">
        <div
          className="h-full bg-accent-primary/80 transition-all duration-300"
          style={{ width: `${visitPercent}%` }}
        />
      </div>

      {/* Win rate */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-glass-text-secondary opacity-70">Win Probability</span>
        <div className="flex items-center gap-2">
          <div className="w-16 h-1 bg-black/40 rounded-full overflow-hidden">
            <div
              className={clsx('h-full transition-all duration-300', getWinRateColor(winRate))}
              style={{ width: `${winRate * 100}%` }}
            />
          </div>
          <span className={clsx('font-mono font-bold', getWinRateText(winRate))}>
            {(winRate * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

interface MCTSTreeNodeViewProps {
  node: MCTSTreeNode;
  depth: number;
  maxDepth: number;
  selectedNode: MCTSTreeNode | null;
  onSelectNode: (node: MCTSTreeNode | null) => void;
}

function MCTSTreeNodeView({
  node,
  depth,
  maxDepth,
  selectedNode,
  onSelectNode,
}: MCTSTreeNodeViewProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedNode === node;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelectNode(isSelected ? null : node);
    },
    [isSelected, node, onSelectNode],
  );

  const handleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  }, []);

  // Win rate color
  const winRateColor =
    node.winRate >= 0.55
      ? 'text-accent-success'
      : node.winRate <= 0.45
        ? 'text-accent-danger'
        : 'text-yellow-400';

  // Sort children by visits
  const sortedChildren = [...node.children].sort((a, b) => b.visits - a.visits);

  return (
    <div className="select-none">
      <div
        onClick={handleClick}
        className={clsx(
          'flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition-colors border border-transparent',
          isSelected ? 'bg-accent-primary/10 border-accent-primary/30' : 'hover:bg-white/5',
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Expand/collapse button */}
        {hasChildren && depth < maxDepth ? (
          <button
            onClick={handleExpand}
            className="w-4 h-4 flex items-center justify-center text-[10px] text-glass-text-muted hover:text-white"
          >
            {expanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="w-4 h-4 flex items-center justify-center text-[10px] text-glass-text-muted opacity-30">
            {hasChildren ? '•' : '○'}
          </span>
        )}

        {/* Node content */}
        <div className="flex-1 flex items-center justify-between min-w-0">
          <span
            className={clsx(
              'text-xs truncate',
              depth === 0 ? 'font-bold text-white' : 'text-glass-text-primary',
              isSelected && 'text-accent-primary',
            )}
          >
            {node.action ?? 'Root'}
          </span>
          <div className="flex items-center gap-3 text-[10px] ml-2">
            <span className="text-glass-text-muted font-mono">{node.visits}</span>
            <span className={clsx('font-mono font-bold', winRateColor)}>
              {(node.winRate * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && depth < maxDepth && (
        <div className="relative">
          {/* Tree line guide */}
          <div
            className="absolute left-[15px] top-0 bottom-0 w-px bg-white/5"
            style={{ left: `${depth * 16 + 15}px` }}
          />
          {sortedChildren.map((child, index) => (
            <MCTSTreeNodeView
              key={index}
              node={child}
              depth={depth + 1}
              maxDepth={maxDepth}
              selectedNode={selectedNode}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
