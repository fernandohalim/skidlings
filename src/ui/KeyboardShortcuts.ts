import { useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useRaceStore } from '../stores/raceStore';

/**
 * Global menu keys (§5): Esc = back / pause, Enter = play from title,
 * H = controls overlay in the lobby, auto-pause when the tab is hidden.
 * Driving keys are handled by InputManager.
 */
export function useKeyboardShortcuts(onToggleHints: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const g = useGameStore.getState();
      const race = useRaceStore.getState();
      const onButton = (e.target as HTMLElement | null)?.tagName === 'BUTTON';

      if (e.code === 'Escape') {
        if (g.modal) g.closeModal();
        else if (g.scene === 'race' && race.results) g.goLobby();
        else if (g.scene === 'race' || g.scene === 'lobby') g.openModal('pause');
        return;
      }
      if (g.modal) return;
      if ((e.code === 'Enter' || e.code === 'NumpadEnter') && g.scene === 'title' && !onButton) {
        g.goLobby();
        return;
      }
      if (e.code === 'KeyH' && g.scene === 'lobby') {
        onToggleHints();
        g.openModal('controls');
      }
    };
    // Leaving the tab mid-drive pauses instead of letting the race run on.
    const onHide = () => {
      const g = useGameStore.getState();
      if (document.hidden && !g.modal && (g.scene === 'race' || g.scene === 'lobby')) {
        g.openModal('pause');
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [onToggleHints]);
}
