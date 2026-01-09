import { useGameStore } from '../store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';

export function Stack() {
  const { gameState, showHints } = useGameStore();

  if (!gameState || gameState.stack.length === 0) {
    return null;
  }

  return (
    <div className="absolute right-8 top-1/2 -translate-y-1/2 z-30 flex flex-col items-end pointer-events-none">
      <div className="pointer-events-auto min-w-[280px]">
        {/* Header */}
        <div className="bg-accent-secondary text-white text-[10px] font-bold px-3 py-1 rounded-t-lg uppercase tracking-widest w-fit ml-auto shadow-lg flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          The Stack
        </div>

        {/* Stack Items Container */}
        <div className="glass-panel rounded-b-lg rounded-tl-lg p-3 flex flex-col-reverse gap-2 shadow-2xl border-accent-secondary/30">
          <AnimatePresence mode="popLayout">
            {gameState.stack.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.95 }}
                className={`
                    p-3 rounded-md border text-left
                    ${
                      item.controller === 'player'
                        ? 'bg-blue-500/10 border-blue-500/30'
                        : 'bg-red-500/10 border-red-500/30'
                    }
                `}
              >
                <div className="flex justify-between items-start gap-2 mb-1">
                  <span className="font-bold text-sm text-white leading-tight">
                    {item.card.name}
                  </span>
                  <span
                    className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                      item.controller === 'player'
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}
                  >
                    {item.controller === 'player' ? 'YOU' : 'OPP'}
                  </span>
                </div>

                {item.targets.length > 0 ? (
                  <div className="text-xs text-glass-text-secondary mt-1 border-t border-white/5 pt-1">
                    <span className="text-glass-text-muted">Target:</span> {item.description}
                  </div>
                ) : (
                  <div className="text-xs text-glass-text-muted mt-1 italic">
                    {item.description}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {showHints && (
            <div className="mt-2 text-[10px] text-center text-glass-text-muted uppercase tracking-wide border-t border-glass-border pt-2">
              Top item resolves next
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
