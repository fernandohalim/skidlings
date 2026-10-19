import { useEffect } from 'react';
import { audio } from '../audio/AudioManager';
import { useGameStore } from '../stores/gameStore';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * App-level audio wiring (§11): unlock on the first gesture (autoplay rules),
 * live volume settings, music per scene, menu ducking + pops, and UI blips for
 * every button via event delegation.
 */
export function useAudioDirector() {
  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    const applyVolumes = () => {
      const s = useSettingsStore.getState();
      audio.setVolumes(s.masterVolume, s.sfxVolume, s.musicVolume);
    };
    applyVolumes();
    const unsubSettings = useSettingsStore.subscribe(applyVolumes);

    const applyScene = () => {
      const g = useGameStore.getState();
      audio.setMusic(g.scene === 'race' ? 'race' : 'lobby');
      audio.setMenuOpen(g.modal !== null);
    };
    applyScene();
    const unsubGame = useGameStore.subscribe((s, prev) => {
      applyScene();
      if (s.modal !== prev.modal) audio.uiPop(s.modal !== null);
    });

    const isButton = (t: EventTarget | null) =>
      t instanceof Element && t.closest('button') !== null;
    let lastHover: Element | null = null;
    const onOver = (e: PointerEvent) => {
      const b = e.target instanceof Element ? e.target.closest('button') : null;
      if (b && b !== lastHover) audio.uiHover();
      lastHover = b;
    };
    const onFocus = (e: FocusEvent) => {
      if (isButton(e.target) && e.target !== lastHover) audio.uiHover();
    };
    const onClick = (e: MouseEvent) => {
      if (isButton(e.target)) audio.uiClick();
    };
    document.addEventListener('pointerover', onOver);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('click', onClick);

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      unsubSettings();
      unsubGame();
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('click', onClick);
    };
  }, []);
}
