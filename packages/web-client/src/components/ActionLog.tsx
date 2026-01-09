import { useGameStore } from '../store/gameStore';
import { useRef, useEffect } from 'react';
import { clsx } from 'clsx';

export function ActionLog() {
  const { history } = useGameStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history.length]);

  const handleExport = () => {
    const text = history
      .map((entry) => {
        const turn = `Turn ${entry.turn} [${entry.phase}]`;
        const action = entry.action ? entry.action.description : '(None)';
        const aiInfo = entry.aiThinking
          ? `\n  AI Eval: ${(entry.aiThinking.winProbability * 100).toFixed(1)}%`
          : '';
        return `${turn}\n  ${action}${aiInfo}\n`;
      })
      .join('\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `manacore-log-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (history.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-gray-500 text-sm bg-board-bg/30 rounded">
        Action history will appear here
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 h-48">
      <div className="flex justify-end">
        <button
          onClick={handleExport}
          className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1 bg-board-surface px-2 py-1 rounded border border-board-accent/20"
        >
          <span>📥</span> Export Log
        </button>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-board-bg/30 rounded p-2 space-y-1 scrollbar-hide"
      >
        {history.map((entry, index) => (
          <LogEntry key={index} entry={entry} index={index} />
        ))}
      </div>
    </div>
  );
}

interface LogEntryProps {
  entry: {
    turn: number;
    phase: string;
    action: { description: string; type: string } | null;
    timestamp: number;
  };
  index: number;
}

function LogEntry({ entry, index }: LogEntryProps) {
  const isNewTurn = index === 0 || entry.turn !== useGameStore.getState().history[index - 1]?.turn;

  return (
    <>
      {isNewTurn && (
        <div className="text-xs text-gray-500 uppercase tracking-wider pt-2 pb-1 border-b border-board-accent/30">
          Turn {entry.turn}
        </div>
      )}

      {entry.action && (
        <div className="flex items-start gap-2 py-1 text-xs hover:bg-board-accent/20 rounded px-1">
          <span className={clsx('w-16 shrink-0', getPhaseColor(entry.phase))}>
            {formatPhase(entry.phase)}
          </span>
          <span className="text-gray-300">{entry.action.description}</span>
        </div>
      )}
    </>
  );
}

function formatPhase(phase: string): string {
  const map: Record<string, string> = {
    beginning: 'Begin',
    main1: 'Main 1',
    combat: 'Combat',
    main2: 'Main 2',
    ending: 'End',
  };
  return map[phase] ?? phase;
}

function getPhaseColor(phase: string): string {
  const map: Record<string, string> = {
    beginning: 'text-blue-400',
    main1: 'text-green-400',
    combat: 'text-red-400',
    main2: 'text-green-400',
    ending: 'text-purple-400',
  };
  return map[phase] ?? 'text-gray-400';
}
