import { useGameStore } from '../store/gameStore';
import { clsx } from 'clsx';

export function ActionBar() {
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
    <div className="bg-board-surface/80 backdrop-blur border-t border-board-accent/30 p-3">
      <div className="flex items-center justify-between gap-4">
        {/* Action buttons */}
        <div className="flex-1 flex flex-wrap gap-2">
          {otherActions.length > 0 ? (
            otherActions.map((action) => (
              <button
                key={action.index}
                onClick={() => handleAction(action.index)}
                className={clsx(
                  'btn text-sm',
                  action.isRecommended ? 'btn-primary' : 'btn-secondary',
                )}
              >
                {action.description}
              </button>
            ))
          ) : selectedCardId ? (
            <span className="text-gray-500 text-sm">Select an action for this card</span>
          ) : (
            showHints && (
              <span className="text-gray-500 text-sm">
                Click a highlighted card to see available actions
              </span>
            )
          )}
        </div>

        {/* Pass priority button */}
        {passActions.length > 0 && passActions[0] && (
          <button
            onClick={() => handleAction(passActions[0].index)}
            className="btn btn-secondary text-sm"
          >
            Pass Priority
          </button>
        )}
      </div>

      {/* Phase hint */}
      {showHints && gameState && (
        <div className="mt-2 text-xs text-gray-500">
          {getPhaseHint(gameState.phase, gameState.step)}
        </div>
      )}
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
