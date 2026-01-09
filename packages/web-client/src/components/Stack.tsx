import { useGameStore } from '../store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';

export function Stack() {
  const { gameState, showHints } = useGameStore();

  if (!gameState || gameState.stack.length === 0) {
    return null;
  }

  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
      <div className="bg-board-bg/95 border border-board-highlight/50 rounded-lg p-3 shadow-xl">
        <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
          <span className="w-2 h-2 bg-board-highlight rounded-full animate-pulse" />
          The Stack
        </div>

        <AnimatePresence mode="popLayout">
          {gameState.stack.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`
                p-2 rounded border mb-1 last:mb-0
                ${
                  item.controller === 'player'
                    ? 'bg-blue-900/50 border-blue-700/50'
                    : 'bg-red-900/50 border-red-700/50'
                }
              `}
              style={{ zIndex: gameState.stack.length - index }}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{item.card.name}</span>
                <span className="text-xs text-gray-400">
                  ({item.controller === 'player' ? 'You' : 'Opponent'})
                </span>
              </div>
              {item.targets.length > 0 && (
                <div className="text-xs text-gray-400 mt-1">Target: {item.description}</div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {showHints && (
          <div className="mt-2 text-xs text-gray-500">Top resolves first. Click to respond.</div>
        )}
      </div>
    </div>
  );
}
