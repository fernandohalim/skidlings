import { CAR_PRESETS, resolveCarConfig, type CarConfig, type CarId } from '../../config/car.config';
import { useGameStore } from '../../stores/gameStore';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import styles from './screens.module.css';

const IDS = Object.keys(CAR_PRESETS) as CarId[];
const EMOJI: Record<CarId, string> = { balanced: '🚗', drifter: '🏎️', speedster: '🚀' };

interface Stat {
  label: string;
  /** Higher = better for the player. */
  value: (c: CarConfig) => number;
}

const STATS: Stat[] = [
  { label: 'Speed', value: (c) => c.maxSpeed },
  { label: 'Accel', value: (c) => c.accel },
  { label: 'Grip', value: (c) => c.normalGrip },
  { label: 'Drift', value: (c) => (1 / c.driftGrip) * c.driftChargeRate },
];

/** 1..5 pips, relative to the other cars (so differences are readable). */
function pips(stat: Stat, cfg: CarConfig): number {
  const all = IDS.map((id) => stat.value(resolveCarConfig(id)));
  const min = Math.min(...all);
  const max = Math.max(...all);
  if (max - min < 1e-6) return 3;
  return 2 + Math.round(((stat.value(cfg) - min) / (max - min)) * 3);
}

/** Garage modal: pick one of the 3 cars (all unlocked, §0.1). */
export function Garage() {
  const selected = useGameStore((s) => s.selectedCar);
  const selectCar = useGameStore((s) => s.selectCar);
  const closeModal = useGameStore((s) => s.closeModal);

  return (
    <Modal title="Garage">
      <div className={styles.cards}>
        {IDS.map((id) => {
          const p = CAR_PRESETS[id];
          const cfg = resolveCarConfig(id);
          return (
            <button
              key={id}
              type="button"
              className={styles.card}
              aria-pressed={selected === id}
              data-autofocus={selected === id ? true : undefined}
              style={{ ['--card-color' as string]: p.color }}
              onClick={() => selectCar(id)}
            >
              <span className={styles.swatch} style={{ background: p.color }} aria-hidden>
                {EMOJI[id]}
              </span>
              <span className={styles.cardTitle}>{p.name}</span>
              <span className={styles.tagline2}>{p.tagline}</span>
              {STATS.map((s) => {
                const n = pips(s, cfg);
                return (
                  <span key={s.label} className={styles.statRow}>
                    <span>{s.label}</span>
                    <span className={styles.pips} aria-label={`${s.label} ${n} of 5`}>
                      {[1, 2, 3, 4, 5].map((k) => (
                        <span key={k} className={styles.pip} data-on={k <= n} />
                      ))}
                    </span>
                  </span>
                );
              })}
            </button>
          );
        })}
      </div>
      <div className={styles.buttonsRow}>
        <Button onClick={closeModal}>Let's drive!</Button>
      </div>
    </Modal>
  );
}
