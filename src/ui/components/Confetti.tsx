import { useMemo, type CSSProperties } from 'react';
import { WORLD_PALETTE } from '../../config/graphics.config';
import { createRng } from '../../engine/utils/random';
import styles from './Confetti.module.css';

const PIECES = 90;

/** "New record!" confetti burst (§10.8): pure CSS, no per-frame JS. */
export function Confetti({ seed = 7 }: { seed?: number }) {
  const pieces = useMemo(() => {
    const r = createRng(seed);
    return Array.from({ length: PIECES }, (_, i) => ({
      left: r() * 100,
      delay: r() * 0.6,
      dur: 1.8 + r() * 1.4,
      drift: (r() - 0.5) * 220,
      spin: (r() - 0.5) * 1440,
      w: 8 + r() * 8,
      h: 10 + r() * 12,
      color: WORLD_PALETTE.toyColors[i % WORLD_PALETTE.toyColors.length],
      round: r() > 0.7,
    }));
  }, [seed]);

  return (
    <div className={styles.layer} aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className={styles.piece}
          style={
            {
              left: `${p.left}%`,
              width: p.w,
              height: p.round ? p.w : p.h,
              background: p.color,
              borderRadius: p.round ? '50%' : 3,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              '--drift': `${p.drift}px`,
              '--spin': `${p.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
