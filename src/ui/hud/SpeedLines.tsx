import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { createRng } from '../../engine/utils/random';
import { useSettingsStore } from '../../stores/settingsStore';
import { telemetry } from '../../stores/telemetry';
import styles from './SpeedLines.module.css';

const LINES = 28;
/** Lines start appearing above this speed (m/s), full at +12. */
const START = 22;

/**
 * Anime-style speed streaks around the screen edge (§10.8 juice). Opacity is
 * driven straight from telemetry at ~20 Hz; the streak motion is pure CSS.
 */
export function SpeedLines() {
  const root = useRef<HTMLDivElement>(null);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  const lines = useMemo(() => {
    const r = createRng(3);
    return Array.from({ length: LINES }, () => ({
      angle: r() * 360,
      delay: r() * 0.6,
      dur: 0.35 + r() * 0.3,
      len: 18 + r() * 22,
    }));
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      const el = root.current;
      if (!el) return;
      const v = Math.abs(telemetry.speed);
      let o = Math.min(1, Math.max(0, (v - START) / 12));
      if (telemetry.boostTime > 0 || telemetry.nitroActive) o = Math.max(o, 0.85);
      el.style.opacity = o.toFixed(2);
    }, 50);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  if (reduceMotion) return null;
  return (
    <div ref={root} className={styles.root} aria-hidden>
      {lines.map((l, i) => (
        <span
          key={i}
          className={styles.line}
          style={
            {
              '--a': `${l.angle}deg`,
              '--len': `${l.len}vmin`,
              animationDelay: `${l.delay}s`,
              animationDuration: `${l.dur}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
