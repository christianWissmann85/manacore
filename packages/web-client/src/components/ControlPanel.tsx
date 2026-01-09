import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';

export function ControlPanel() {
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
          useGameStore.getState().stepAI();
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
      useGameStore.getState().stepAI();
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
    <div className="border-t border-board-accent/30 p-3 space-y-3">
      {/* Game info */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>
          {playerType === 'human' ? 'Human' : playerType.toUpperCase()} vs{' '}
          {opponentType.toUpperCase()}
        </span>
        {gameOver && (
          <span className="text-board-highlight font-semibold">
            {gameState?.winner === 'player' ? 'You Win!' : 'Opponent Wins!'}
          </span>
        )}
      </div>

      {/* Playback controls */}
      {(isAIvsAI || gameOver) && (
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayPause}
            className="btn btn-secondary flex-1"
            disabled={gameOver && !isReplaying}
          >
            {isAutoPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button
            onClick={handleStep}
            className="btn btn-secondary"
            disabled={isAutoPlaying || (gameOver && !isReplaying)}
          >
            ⏭ Step
          </button>
        </div>
      )}

      {/* Speed control */}
      {(isAIvsAI || isReplaying) && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-12">Speed:</span>
          <input
            type="range"
            min="0.25"
            max="4"
            step="0.25"
            value={replaySpeed}
            onChange={(e) => setReplaySpeed(parseFloat(e.target.value))}
            className="flex-1"
          />
          <span className="text-xs font-mono w-8">{replaySpeed}x</span>
        </div>
      )}

      {/* Replay slider */}
      {history.length > 1 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>History</span>
            <span>
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
              setReplayIndex(parseInt(e.target.value));
            }}
            className="w-full"
          />
          {!isReplaying && (
            <button onClick={handleReplayToggle} className="text-xs text-board-highlight">
              Watch Replay
            </button>
          )}
          {isReplaying && (
            <button onClick={handleReplayToggle} className="text-xs text-gray-400">
              Exit Replay
            </button>
          )}
        </div>
      )}

      {/* Settings */}
      <div className="flex items-center justify-between pt-2 border-t border-board-accent/30">
        <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
          <input type="checkbox" checked={showHints} onChange={toggleHints} className="rounded" />
          Show Hints
        </label>

        <div className="flex gap-2">
          <button onClick={resetGame} className="text-xs text-gray-400 hover:text-white">
            Reset
          </button>
          <button onClick={endGame} className="text-xs text-red-400 hover:text-red-300">
            End Game
          </button>
        </div>
      </div>
    </div>
  );
}
