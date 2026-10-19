import { useEffect, useRef } from 'react';
import { displayKmh, telemetry } from '../../stores/telemetry';
import styles from './hud.module.css';

const TIER_LABEL = ['', 'I', 'II', 'III'];

/**
 * Bottom-center speed + nitro gauge with the drift badge above it (§10.5).
 * Reads `telemetry` at ~20 Hz and writes the DOM directly (no React renders).
 */
export function SpeedNitroGauge() {
  const speed = useRef<HTMLSpanElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const badge = useRef<HTMLDivElement>(null);
  const badgeTier = useRef<HTMLSpanElement>(null);
  const badgeFill = useRef<HTMLDivElement>(null);
  const boost = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let lastTier = -1;
    let lastBoost = 0;
    const id = window.setInterval(() => {
      const t = telemetry;
      if (speed.current) speed.current.textContent = String(displayKmh(t.speed));
      const frac = t.nitroMax > 0 ? t.nitro / t.nitroMax : 0;
      if (fill.current) fill.current.style.transform = `scaleX(${frac})`;
      if (track.current) {
        track.current.dataset.full = String(frac >= 0.999);
        track.current.dataset.active = String(t.nitroActive);
      }

      const b = badge.current;
      if (b) {
        b.dataset.visible = String(t.drifting);
        b.dataset.tier = String(t.driftTier);
        if (t.drifting && t.driftTier !== lastTier && t.driftTier > 0) {
          // Re-trigger the pop animation on each new tier (§10.8).
          b.classList.remove(styles.pop!);
          void b.offsetWidth;
          b.classList.add(styles.pop!);
        }
        lastTier = t.drifting ? t.driftTier : -1;
        if (badgeTier.current) badgeTier.current.textContent = TIER_LABEL[t.driftTier] ?? '';
        if (badgeFill.current) {
          // Charge progress toward the top tier.
          const p = t.driftMaxCharge > 0 ? t.driftCharge / t.driftMaxCharge : 0;
          badgeFill.current.style.transform = `scaleX(${Math.min(1, p)})`;
        }
      }
      const bo = boost.current;
      if (bo) {
        const on = t.boostTime > 0;
        bo.dataset.visible = String(on);
        bo.dataset.tier = String(t.boostTier);
        if (on && t.boostTier !== lastBoost) {
          bo.classList.remove(styles.pop!);
          void bo.offsetWidth;
          bo.classList.add(styles.pop!);
        }
        lastBoost = on ? t.boostTier : 0;
      }
    }, 50);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={styles.bottom}>
      <div ref={boost} className={styles.boostBadge} data-visible="false">
        BOOST!
      </div>
      <div ref={badge} className={styles.driftBadge} data-visible="false" data-tier="0">
        <span className={styles.driftLabel}>DRIFT</span>
        <div className={styles.driftTrack}>
          <div ref={badgeFill} className={styles.driftFill} />
        </div>
        <span ref={badgeTier} className={styles.driftTier} />
      </div>
      <div className={`${styles.pill} ${styles.gauge}`}>
        <span className={styles.speed}>
          <span ref={speed}>0</span>
          <small>km/h</small>
        </span>
        <div ref={track} className={styles.nitroTrack}>
          <div ref={fill} className={styles.nitroFill} />
        </div>
        <span className={styles.hint}>NITRO</span>
      </div>
    </div>
  );
}
