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

  if (history.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-gray-500 text-sm bg-board-bg/30 rounded">
        Action history will appear here
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="h-48 overflow-y-auto bg-board-bg/30 rounded p-2 space-y-1 scrollbar-hide"
    >
      {history.map((entry, index) => (
        <LogEntry key={index} entry={entry} index={index} />
      ))}
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
