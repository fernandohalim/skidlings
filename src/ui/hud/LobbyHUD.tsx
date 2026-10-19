import { useEffect, useRef, useState } from 'react';
import { LOBBY_CONFIG } from '../../config/lobby.config';
import { useSettingsStore } from '../../stores/settingsStore';
import { telemetry } from '../../stores/telemetry';
import { KeyCap } from '../components/KeyCap';
import styles from './hud.module.css';

/**
 * Lobby HUD (§10.6): small logo top-left, controls hint bottom-left that fades
 * after 10 s of driving and comes back on H (KeyboardShortcuts toggles it).
 */
export function LobbyHUD({ hintsVisible }: { hintsVisible: boolean }) {
  const b = useSettingsStore((s) => s.bindings);
  const driven = useRef(0);
  const [faded, setFaded] = useState(false);

  // Pressing H remounts this component (new key), which resets the fade.
  useEffect(() => {
    if (!hintsVisible) return;
    const id = window.setInterval(() => {
      if (Math.abs(telemetry.speed) > 2) driven.current += 0.25;
      if (driven.current >= LOBBY_CONFIG.hintFadeAfter) setFaded(true);
    }, 250);
    return () => window.clearInterval(id);
  }, [hintsVisible]);

  return (
    <>
      <div className={styles.topLeft}>
        <div className={`${styles.pill} ${styles.logoPill}`}>Skidlings</div>
        <div className={`${styles.pill} ${styles.subPill}`}>
          <span className={styles.hint}>Drive onto a pad to race</span>
        </div>
      </div>
      <div className={styles.hints} data-faded={faded || !hintsVisible}>
        <span className={styles.hintGroup}>
          <KeyCap code={b.throttle[0]} />
          <KeyCap code={b.left[0]} />
          <KeyCap code={b.brake[0]} />
          <KeyCap code={b.right[0]} />
          <span className={styles.hint}>drive</span>
        </span>
        <span className={styles.hintGroup}>
          <KeyCap code={b.drift[0]} />
          <span className={styles.hint}>drift</span>
        </span>
        <span className={styles.hintGroup}>
          <KeyCap code={b.nitro[0]} />
          <span className={styles.hint}>nitro</span>
        </span>
        <span className={styles.hintGroup}>
          <KeyCap code={b.reset[0]} />
          <span className={styles.hint}>reset</span>
        </span>
        <span className={styles.hintGroup}>
          <KeyCap code="KeyH" />
          <span className={styles.hint}>help</span>
        </span>
      </div>
    </>
  );
}
