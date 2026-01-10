import { useGameStore } from '../../store/gameStore';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

export function PlayActionBar() {
  const { gameState, legalActions, selectedCardId, executeAction, playerType, showHints } =
    useGameStore();

  if (!gameState || playerType !== 'human') return null;

  // Filter actions based on selection
  const relevantActions = selectedCardId
    ? legalActions.filter((a) => a.cardInstanceId === selectedCardId)
    : legalActions.filter((a) => !a.cardInstanceId); // Global actions like pass

  // Group actions by type
  const passActions = relevantActions.filter((a) => a.type === 'PASS_PRIORITY');
  const otherActions = relevantActions.filter((a) => a.type !== 'PASS_PRIORITY');

  const handleAction = (actionIndex: number) => {
    void executeAction(actionIndex);
  };

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-4 w-full max-w-2xl px-4 pointer-events-none">
      {/* Phase hint (Floating above dock) */}
      <AnimatePresence>
        {showHints && gameState && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-black/60 backdrop-blur text-white text-xs px-4 py-1.5 rounded-full border border-white/10 shadow-lg"
          >
            {getPhaseHint(gameState.phase, gameState.step)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* The Dock */}
      <div className="glass-panel p-2 rounded-2xl flex items-center gap-3 shadow-2xl border-white/10 pointer-events-auto transition-all hover:bg-glass-surface/80 hover:scale-105">
        {/* Contextual Actions Area */}
        <div className="flex gap-2 min-h-[40px] items-center px-2">
          {otherActions.length > 0 ? (
            otherActions.map((action) => (
              <button
                key={action.index}
                onClick={() => handleAction(action.index)}
                className={clsx(
                  'btn text-sm whitespace-nowrap',
                  action.isRecommended ? 'btn-primary' : 'btn-secondary',
                )}
              >
                {action.description}
              </button>
            ))
          ) : selectedCardId ? (
            <div className="text-glass-text-secondary text-sm italic px-4">
              No legal actions for this card
            </div>
          ) : (
            <div className="text-glass-text-muted text-sm italic px-4 flex items-center gap-2">
              <span className="text-lg">👈</span> Select a card to act
            </div>
          )}
        </div>

        {/* Divider */}
        {(otherActions.length > 0 || passActions.length > 0) && (
          <div className="w-px h-8 bg-glass-border mx-1" />
        )}

        {/* Global/Pass Actions */}
        {passActions.length > 0 && passActions[0] && (
          <button
            onClick={() => handleAction(passActions[0].index)}
            className="btn btn-secondary text-sm border-dashed border-glass-text-muted hover:border-white hover:text-white hover:bg-white/10"
          >
            Pass Priority
          </button>
        )}
      </div>
    </div>
  );
}

function getPhaseHint(phase: string, step: string): string {
  switch (phase) {
    case 'main1':
    case 'main2':
      return 'Main Phase: Play lands, cast spells, activate abilities';
    case 'combat':
      switch (step) {
        case 'declare_attackers':
          return 'Declare Attackers: Select creatures to attack with';
        case 'declare_blockers':
          return 'Declare Blockers: Assign blockers to attackers';
        default:
          return 'Combat Phase';
      }
    case 'beginning':
      return 'Beginning Phase: Untap, upkeep, draw';
    case 'ending':
      return 'Ending Phase: Discard to hand size if needed';
    default:
      return '';
  }
}
