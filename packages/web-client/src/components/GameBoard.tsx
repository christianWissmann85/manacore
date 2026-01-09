import { useGameStore } from '../store/gameStore';
import { PlayerArea } from './PlayerArea';
import { Battlefield } from './Battlefield';
import { Stack } from './Stack';
import { ActionBar } from './ActionBar';

export function GameBoard() {
  const { gameState } = useGameStore();

  if (!gameState) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        No game in progress
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">
      {/* Opponent Area (top) */}
      <PlayerArea player="opponent" />

      {/* Battlefield (center) */}
      <div className="flex-1 flex gap-3 min-h-0">
        <div className="flex-1 flex flex-col gap-2">
          {/* Opponent's battlefield */}
          <Battlefield owner="opponent" className="flex-1" />

          {/* Divider with Stack */}
          <div className="relative h-px bg-board-accent/50">
            <Stack />
          </div>

          {/* Player's battlefield */}
          <Battlefield owner="player" className="flex-1" />
        </div>
      </div>

      {/* Player Area (bottom) */}
      <PlayerArea player="player" />

      {/* Action Bar */}
      <ActionBar />
    </div>
  );
}
