import { useGameStore } from './store/gameStore';
import { useMode } from './hooks/useMode';
import { PlayLayout } from './layouts/PlayLayout';
import { ResearchLayout } from './layouts/ResearchLayout';
import { WelcomeModal } from './components/modals/WelcomeModal';
import { LoadingOverlay } from './components/modals/LoadingOverlay';

export default function App() {
  const { gameState, isLoading } = useGameStore();
  const { mode, setMode } = useMode();

  return (
    <>
      {/* Mode-specific layout */}
      {mode === 'play' ? (
        <PlayLayout mode={mode} onModeChange={setMode} />
      ) : (
        <ResearchLayout mode={mode} onModeChange={setMode} />
      )}

      {/* Global Overlays */}
      {isLoading && <LoadingOverlay />}
      {!gameState && !isLoading && <WelcomeModal />}
    </>
  );
}
