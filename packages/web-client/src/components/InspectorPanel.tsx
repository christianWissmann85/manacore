import { useGameStore } from '../store/gameStore';
import { MCTSTreeView } from './MCTSTreeView';
import { WinProbabilityChart } from './WinProbabilityChart';
import { EvaluationBreakdown } from './EvaluationBreakdown';
import { PolicyDistribution } from './PolicyDistribution';
import { ActionLog } from './ActionLog';

export function InspectorPanel() {
  const { aiThinking, showAIThinking, toggleAIThinking, opponentType, playerType } = useGameStore();

  const isAIvsAI = playerType !== 'human';
  const hasAIThinking = aiThinking !== null;

  // Used to show different UI hints for AI vs AI mode
  void isAIvsAI;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="panel-header flex items-center justify-between">
        <span>AI Inspector</span>
        <button
          onClick={toggleAIThinking}
          className={`text-xs px-2 py-1 rounded ${showAIThinking ? 'bg-board-highlight' : 'bg-board-accent'}`}
        >
          {showAIThinking ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {showAIThinking && hasAIThinking ? (
          <>
            {/* Agent info */}
            <div className="bg-board-bg/50 rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">
                  {aiThinking.agentName}
                  <span className="text-gray-500 ml-2">
                    ({aiThinking.playerId === 'player' ? 'You' : 'Opponent'})
                  </span>
                </span>
                <span className="text-xs text-gray-400">
                  {aiThinking.evaluatedNodes.toLocaleString()} nodes in {aiThinking.timeMs}ms
                </span>
              </div>

              {/* Win probability gauge */}
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-400">Win Probability</span>
                  <span className="font-mono text-lg">
                    {(aiThinking.winProbability * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-500"
                    style={{ width: `${aiThinking.winProbability * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* MCTS Tree (if available) */}
            {aiThinking.mctsTree && (
              <div>
                <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                  Search Tree (Top Actions)
                </h3>
                <MCTSTreeView tree={aiThinking.mctsTree} />
              </div>
            )}

            {/* Evaluation breakdown (if available) */}
            {aiThinking.evaluation && (
              <div>
                <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                  Evaluation Breakdown
                </h3>
                <EvaluationBreakdown evaluation={aiThinking.evaluation} />
              </div>
            )}

            {/* Policy distribution for neural bots */}
            {aiThinking.policyDistribution && (
              <div>
                <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                  Policy Distribution
                </h3>
                <PolicyDistribution distribution={aiThinking.policyDistribution} />
              </div>
            )}
          </>
        ) : showAIThinking ? (
          <div className="text-center text-gray-500 py-8">
            <div className="text-2xl mb-2">🤔</div>
            <p>Waiting for AI thinking data...</p>
            <p className="text-xs mt-1">Playing against: {opponentType}</p>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <p>AI visualization disabled</p>
            <button onClick={toggleAIThinking} className="btn btn-secondary text-xs mt-2">
              Enable
            </button>
          </div>
        )}

        {/* Win probability history chart */}
        <div>
          <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2">
            Win Probability Over Time
          </h3>
          <WinProbabilityChart />
        </div>

        {/* Action log */}
        <div>
          <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2">Action Log</h3>
          <ActionLog />
        </div>
      </div>
    </div>
  );
}
