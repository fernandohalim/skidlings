import { useGameStore } from '../../stores/gameStore';
import { useRaceStore } from '../../stores/raceStore';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import styles from './screens.module.css';

/** Pause (§10.7). The simulation is frozen while any modal is open. */
export function PauseMenu() {
  const scene = useGameStore((s) => s.scene);
  const closeModal = useGameStore((s) => s.closeModal);
  const openNested = useGameStore((s) => s.openNested);
  const goLobby = useGameStore((s) => s.goLobby);
  const goTitle = useGameStore((s) => s.goTitle);
  const requestRestart = useRaceStore((s) => s.requestRestart);
  const inRace = scene === 'race';

  return (
    <Modal title="Paused">
      <div className={styles.stack}>
        <Button data-autofocus onClick={closeModal}>
          Resume
        </Button>
        {inRace && (
          <Button
            variant="secondary"
            onClick={() => {
              requestRestart();
              closeModal();
            }}
          >
            Restart race
          </Button>
        )}
        <Button variant="ghost" onClick={() => openNested('settings')}>
          Settings
        </Button>
        <Button variant="ghost" onClick={() => openNested('controls')}>
          Controls
        </Button>
        {inRace ? (
          <Button variant="danger" onClick={goLobby}>
            Back to Lobby
          </Button>
        ) : (
          <Button variant="danger" onClick={goTitle}>
            Back to Title
          </Button>
        )}
      </div>
    </Modal>
  );
}
