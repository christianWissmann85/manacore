import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';

export function ResearchControlPanel() {
  const {
    gameState,
    playerType,
    opponentType,
    history,
    isReplaying,
    replayIndex,
    replaySpeed,
    setReplayIndex,
    setReplaySpeed,
    startReplay,
    stopReplay,
    resetGame,
    endGame,
    showHints,
    toggleHints,
  } = useGameStore();

  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const autoPlayRef = useRef<number | null>(null);

  const isAIvsAI = playerType !== 'human';
  const gameOver = gameState?.gameOver ?? false;

  // Auto-play for AI vs AI or replay
  useEffect(() => {
    if (isAutoPlaying && !gameOver) {
      const interval = 1000 / replaySpeed;

      autoPlayRef.current = window.setInterval(() => {
        if (isReplaying) {
          const nextIndex = replayIndex + 1;
          if (nextIndex < history.length) {
            setReplayIndex(nextIndex);
          } else {
            setIsAutoPlaying(false);
          }
        } else if (isAIvsAI) {
          // For AI vs AI, trigger the next step
          void useGameStore.getState().stepAI();
        }
      }, interval);

      return () => {
        if (autoPlayRef.current) {
          clearInterval(autoPlayRef.current);
        }
      };
    }
  }, [
    isAutoPlaying,
    replaySpeed,
    isReplaying,
    replayIndex,
    history.length,
    gameOver,
    isAIvsAI,
    setReplayIndex,
  ]);

  const handlePlayPause = () => {
    setIsAutoPlaying(!isAutoPlaying);
  };

  const handleStep = () => {
    if (isReplaying) {
      const nextIndex = replayIndex + 1;
      if (nextIndex < history.length) {
        setReplayIndex(nextIndex);
      }
    } else if (isAIvsAI) {
      void useGameStore.getState().stepAI();
    }
  };

  const handleReplayToggle = () => {
    if (isReplaying) {
      stopReplay();
      setIsAutoPlaying(false);
    } else {
      startReplay();
    }
  };

  return (
    <div className="space-y-4">
      {/* Game Header / Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-success animate-pulse"></span>
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            {playerType === 'human' ? 'Human' : playerType.toUpperCase()} vs{' '}
            {opponentType.toUpperCase()}
          </span>
        </div>
        {gameOver && (
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded ${gameState?.winner === 'player' ? 'bg-accent-success/20 text-accent-success' : 'bg-accent-danger/20 text-accent-danger'}`}
          >
            {gameState?.winner === 'player' ? 'VICTORY' : 'DEFEAT'}
          </span>
        )}
      </div>

      {/* Playback Controls (Main Action Area) */}
      {(isAIvsAI || gameOver) && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => void handlePlayPause()}
            className="btn btn-primary text-xs py-2"
            disabled={gameOver && !isReplaying}
          >
            {isAutoPlaying ? '⏸ Pause' : '▶ Play Auto'}
          </button>
          <button
            onClick={() => void handleStep()}
            className="btn btn-secondary text-xs py-2"
            disabled={isAutoPlaying || (gameOver && !isReplaying)}
          >
            ⏭ Step Forward
          </button>
        </div>
      )}

      {/* Speed & Timeline Controls */}
      <div className="glass-panel p-3 rounded-lg space-y-3 bg-black/20">
        {/* Speed Slider */}
        {(isAIvsAI || isReplaying) && (
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-glass-text-secondary uppercase font-bold w-10">
              Speed
            </span>
            <input
              type="range"
              min="0.25"
              max="4"
              step="0.25"
              value={replaySpeed}
              onChange={(e) => setReplaySpeed(parseFloat((e.target as HTMLInputElement).value))}
              className="flex-1 h-1.5 bg-glass-border rounded-lg appearance-none cursor-pointer accent-accent-primary"
            />
            <span className="text-[10px] font-mono w-8 text-right text-accent-primary">
              {replaySpeed}x
            </span>
          </div>
        )}

        {/* History / Replay Slider */}
        {history.length > 1 && (
          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="flex items-center justify-between text-[10px] text-glass-text-secondary">
              <span className="uppercase font-bold">Timeline</span>
              <span className="font-mono">
                {isReplaying ? replayIndex + 1 : history.length} / {history.length}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max={history.length - 1}
              value={isReplaying ? replayIndex : history.length - 1}
              onChange={(e) => {
                if (!isReplaying) startReplay();
                setReplayIndex(parseInt((e.target as HTMLInputElement).value));
              }}
              className="w-full h-1.5 bg-glass-border rounded-lg appearance-none cursor-pointer accent-accent-secondary"
            />

            <div className="flex justify-end">
              {!isReplaying ? (
                <button
                  onClick={handleReplayToggle}
                  className="text-[10px] text-accent-glow hover:text-white underline decoration-dashed"
                >
                  Enter Replay Mode
                </button>
              ) : (
                <button
                  onClick={handleReplayToggle}
                  className="text-[10px] text-red-400 hover:text-white flex items-center gap-1"
                >
                  <span>■</span> Exit Replay
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Settings */}
      <div className="flex items-center justify-between pt-2">
        <label className="flex items-center gap-2 text-xs text-glass-text-muted cursor-pointer hover:text-white transition-colors">
          <input
            type="checkbox"
            checked={showHints}
            onChange={toggleHints}
            className="rounded bg-transparent border-glass-border text-accent-primary focus:ring-0"
          />
          Show Hints
        </label>

        <div className="flex gap-2">
          <button
            onClick={() => void resetGame()}
            className="text-xs px-3 py-1 text-glass-text-secondary hover:text-white hover:bg-white/5 rounded transition-colors"
          >
            Reset
          </button>
          <button
            onClick={endGame}
            className="text-xs px-3 py-1 text-red-400 hover:text-white hover:bg-red-500/20 rounded transition-colors"
          >
            End Game
          </button>
        </div>
      </div>
    </div>
  );
}
