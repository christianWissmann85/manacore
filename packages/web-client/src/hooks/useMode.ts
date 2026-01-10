import { useState, useEffect, useCallback } from 'react';

export type UIMode = 'play' | 'research';

const STORAGE_KEY = 'manacore-mode';
const DEFAULT_MODE: UIMode = 'play';

/**
 * Hook to manage UI mode (Play vs Research)
 * - URL query param (?mode=research) takes priority
 * - Falls back to localStorage
 * - Falls back to default ('play')
 */
export function useMode() {
  const [mode, setModeState] = useState<UIMode>(() => getInitialMode());

  // Sync mode changes to localStorage and URL
  const setMode = useCallback((newMode: UIMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);

    // Update URL without full page reload
    const url = new URL(window.location.href);
    url.searchParams.set('mode', newMode);
    window.history.replaceState({}, '', url.toString());
  }, []);

  // Listen for popstate events (browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      setModeState(getInitialMode());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return { mode, setMode };
}

/**
 * Get initial mode from URL or localStorage
 */
function getInitialMode(): UIMode {
  // Check URL first
  const urlParams = new URLSearchParams(window.location.search);
  const urlMode = urlParams.get('mode');
  if (urlMode === 'play' || urlMode === 'research') {
    return urlMode;
  }

  // Check localStorage
  const storedMode = localStorage.getItem(STORAGE_KEY);
  if (storedMode === 'play' || storedMode === 'research') {
    return storedMode;
  }

  // Default
  return DEFAULT_MODE;
}
