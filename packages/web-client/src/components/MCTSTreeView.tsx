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
      <div className="text-gray-500 text-sm text-center py-4">No search tree data available</div>
    );
  }

  return (
    <div className="space-y-2">
      {/* View mode toggle */}
      <div className="flex items-center justify-end gap-1 mb-2">
        <button
          onClick={() => setViewMode('bars')}
          className={clsx(
            'px-2 py-0.5 text-xs rounded',
            viewMode === 'bars' ? 'bg-board-highlight text-black' : 'bg-board-accent text-gray-300',
          )}
        >
          Bars
        </button>
        <button
          onClick={() => setViewMode('tree')}
          className={clsx(
            'px-2 py-0.5 text-xs rounded',
            viewMode === 'tree' ? 'bg-board-highlight text-black' : 'bg-board-accent text-gray-300',
          )}
        >
          Tree
        </button>
      </div>

      {viewMode === 'bars' ? (
        /* Bar view - compact action comparison */
        <>
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
        </>
      ) : (
        /* Tree view - hierarchical exploration */
        <div className="bg-board-bg/30 rounded p-2">
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
        <div className="text-xs text-gray-500 text-center">
          +{sortedChildren.length - 5} more actions explored
        </div>
      )}

      {/* Selected node details */}
      {selectedNode && (
        <div className="bg-board-bg/50 border border-board-accent/50 rounded p-3 mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-board-highlight">
              {selectedNode.action ?? 'Root Node'}
            </span>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-gray-400 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Visits:</span>{' '}
              <span className="font-mono">{selectedNode.visits.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-500">Win Rate:</span>{' '}
              <span
                className={clsx(
                  'font-mono',
                  selectedNode.winRate >= 0.55
                    ? 'text-green-400'
                    : selectedNode.winRate <= 0.45
                      ? 'text-red-400'
                      : 'text-yellow-400',
                )}
              >
                {(selectedNode.winRate * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-gray-500">Value:</span>{' '}
              <span className="font-mono">{selectedNode.value.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-500">Children:</span>{' '}
              <span className="font-mono">{selectedNode.children.length}</span>
            </div>
          </div>
          {selectedNode.children.length > 0 && (
            <div className="mt-2 pt-2 border-t border-board-accent/30">
              <span className="text-xs text-gray-500">Top follow-up moves:</span>
              <div className="mt-1 space-y-1">
                {selectedNode.children
                  .sort((a, b) => b.visits - a.visits)
                  .slice(0, 3)
                  .map((child, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs bg-board-bg/50 rounded px-2 py-1"
                    >
                      <span className="text-gray-300 truncate max-w-[150px]">{child.action}</span>
                      <span className="text-gray-500 font-mono">{child.visits} visits</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
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
  isSelected: boolean;
  onSelect: () => void;
}

function MCTSNodeBar({ node, rank, maxVisits, isBest, isSelected, onSelect }: MCTSNodeBarProps) {
  const visitPercent = (node.visits / maxVisits) * 100;
  const winRate = node.winRate;

  // Color based on win rate: red (0%) -> yellow (50%) -> green (100%)
  const getWinRateColor = (rate: number) => {
    if (rate < 0.4) return 'bg-red-500';
    if (rate < 0.6) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const hasChildren = node.children.length > 0;

  return (
    <div
      onClick={onSelect}
      className={clsx(
        'relative bg-board-bg/50 rounded p-2 cursor-pointer transition-all',
        isBest && 'ring-1 ring-green-500/50',
        isSelected && 'ring-2 ring-board-highlight',
        hasChildren && 'hover:bg-board-bg/70',
      )}
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
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{node.visits.toLocaleString()} visits</span>
          {hasChildren && <span className="text-xs text-board-highlight">▶</span>}
        </div>
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
      ? 'text-green-400'
      : node.winRate <= 0.45
        ? 'text-red-400'
        : 'text-yellow-400';

  // Sort children by visits
  const sortedChildren = [...node.children].sort((a, b) => b.visits - a.visits);

  return (
    <div className="select-none">
      <div
        onClick={handleClick}
        className={clsx(
          'flex items-center gap-2 py-1 px-2 rounded cursor-pointer',
          isSelected ? 'bg-board-highlight/20' : 'hover:bg-board-accent/30',
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Expand/collapse button */}
        {hasChildren && depth < maxDepth ? (
          <button
            onClick={handleExpand}
            className="w-4 h-4 flex items-center justify-center text-xs text-gray-400 hover:text-white"
          >
            {expanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="w-4 h-4 flex items-center justify-center text-xs text-gray-600">
            {hasChildren ? '•' : '○'}
          </span>
        )}

        {/* Node content */}
        <div className="flex-1 flex items-center justify-between min-w-0">
          <span
            className={clsx(
              'text-xs truncate',
              depth === 0 ? 'font-semibold' : '',
              isSelected && 'text-board-highlight',
            )}
          >
            {node.action ?? 'Root'}
          </span>
          <div className="flex items-center gap-3 text-xs ml-2">
            <span className="text-gray-500 font-mono">{node.visits}</span>
            <span className={clsx('font-mono', winRateColor)}>
              {(node.winRate * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && depth < maxDepth && (
        <div>
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
