import { useGameStore } from '../store/gameStore';

interface HeaderProps {
  mode: 'play' | 'research';
  onModeChange: (mode: 'play' | 'research') => void;
}

export function Header({ mode, onModeChange }: HeaderProps) {
  const { gameState } = useGameStore();

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-glass-border bg-glass-surface/50 backdrop-blur-md z-10 shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center shadow-lg shadow-accent-primary/20">
            <span className="text-white font-bold text-lg">M</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-none tracking-tight">ManaCore</h1>
            <span className="text-[10px] text-accent-primary uppercase tracking-[0.15em] font-semibold">
              {mode === 'play' ? 'Play Mode' : 'Research Lab'}
            </span>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center gap-1 ml-4 bg-glass-panel rounded-full p-1 border border-glass-border">
          <button
            onClick={() => onModeChange('play')}
            className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all ${
              mode === 'play'
                ? 'bg-accent-primary text-white shadow-lg'
                : 'text-glass-text-muted hover:text-white'
            }`}
          >
            Play
          </button>
          <button
            onClick={() => onModeChange('research')}
            className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all ${
              mode === 'research'
                ? 'bg-accent-secondary text-white shadow-lg'
                : 'text-glass-text-muted hover:text-white'
            }`}
          >
            Research
          </button>
        </div>
      </div>

      {gameState && (
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-glass-text-muted uppercase tracking-wider font-semibold">
              Current Turn
            </span>
            <span className="text-sm text-glass-text-primary font-mono font-bold">
              {gameState.turn}
            </span>
          </div>
          <div className="h-8 w-px bg-glass-border"></div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-glass-text-muted uppercase tracking-wider font-semibold">
              Phase
            </span>
            <span className="text-sm text-accent-glow font-bold uppercase">{gameState.phase}</span>
          </div>
        </div>
      )}
    </header>
  );
}
