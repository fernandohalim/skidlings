import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Button } from '../components/Button';
import { KeyCap } from '../components/KeyCap';
import { Modal } from '../components/Modal';
import { REMAPPABLE } from './SettingsScreen';
import styles from './screens.module.css';

/** Controls overlay (§10.7): current bindings as keycaps. Title, Pause, Lobby (H). */
export function ControlsOverlay() {
  const bindings = useSettingsStore((s) => s.bindings);
  const closeModal = useGameStore((s) => s.closeModal);
  return (
    <Modal title="Controls">
      <div className={styles.controlsGrid}>
        {REMAPPABLE.map(({ action, label }) => (
          <div key={action} style={{ display: 'contents' }}>
            <span>{label}</span>
            <span className={styles.keys}>
              {bindings[action].map((c) => (
                <KeyCap key={c} code={c} />
              ))}
            </span>
          </div>
        ))}
        <span>Pause / back</span>
        <span className={styles.keys}>
          <KeyCap code="Escape" />
        </span>
        <span>Show controls (lobby)</span>
        <span className={styles.keys}>
          <KeyCap code="KeyH" />
        </span>
      </div>
      <p style={{ textAlign: 'center', fontWeight: 700, marginTop: 24 }}>
        Hold <KeyCap code={bindings.drift[0]} /> while steering to drift. Let go to boost!
      </p>
      <div className={styles.buttonsRow}>
        <Button data-autofocus onClick={closeModal}>
          Got it
        </Button>
      </div>
    </Modal>
  );
}
