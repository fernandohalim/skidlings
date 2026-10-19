import { useRef, type CSSProperties } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { Button } from '../components/Button';
import { useMenuNav } from '../components/useMenuNav';
import styles from './screens.module.css';

const LETTER_COLORS = ['#FF5A3C', '#FFC933', '#2EC4F1', '#3DD68C', '#9B5CFF'];

/** Title (§10.7): bouncy logo over the drifting demo car. Enter plays. */
export function TitleScreen() {
  const root = useRef<HTMLDivElement>(null);
  useMenuNav(root);
  const goLobby = useGameStore((s) => s.goLobby);
  const openModal = useGameStore((s) => s.openModal);

  return (
    <div ref={root} className={styles.title}>
      <h1 className={styles.logo} aria-label="Skidlings">
        {'Skidlings'.split('').map((ch, i) => (
          <span
            key={i}
            aria-hidden
            style={
              {
                '--letter-color': LETTER_COLORS[i % LETTER_COLORS.length],
                '--i': i,
                '--tilt': `${i % 2 === 0 ? -3 : 3}deg`,
              } as CSSProperties
            }
          >
            {ch}
          </span>
        ))}
      </h1>
      <p className={styles.tagline}>Tiny cars. Big drifts.</p>
      <div className={styles.titleButtons}>
        <Button data-autofocus onClick={goLobby}>
          Play
        </Button>
        <Button variant="ghost" onClick={() => openModal('settings')}>
          Settings
        </Button>
        <Button variant="ghost" onClick={() => openModal('controls')}>
          Controls
        </Button>
      </div>
      <div className={styles.pressEnter}>Press Enter to play</div>
    </div>
  );
}
