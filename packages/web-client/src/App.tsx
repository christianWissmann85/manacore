import { GameBoard } from './components/GameBoard';
import { InspectorPanel } from './components/InspectorPanel';
import { ControlPanel } from './components/ControlPanel';
import { useGameStore } from './store/gameStore';
import { MainLayout } from './components/layout/MainLayout';
import { WelcomeModal } from './components/modals/WelcomeModal';
import { LoadingOverlay } from './components/modals/LoadingOverlay';

export default function App() {
  const { gameState, isLoading } = useGameStore();

  return (
    <>
      <MainLayout
        sidebar={
          <>
            <InspectorPanel />
            <div className="border-t border-glass-border p-4 bg-glass-surface/50">
              <ControlPanel />
            </div>
          </>
        }
      >
        <GameBoard />
      </MainLayout>

      {/* Global Overlays */}
      {isLoading && <LoadingOverlay />}
      {!gameState && !isLoading && <WelcomeModal />}
    </>
  );
}
