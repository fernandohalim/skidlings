import { useEffect, useState } from 'react';
import type { QualityLevel } from '../../config/graphics.config';
import type { InputAction } from '../../config/input.config';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Button } from '../components/Button';
import componentStyles from '../components/components.module.css';
import { KeyCap } from '../components/KeyCap';
import { Modal } from '../components/Modal';
import { Slider } from '../components/Slider';
import { Toggle } from '../components/Toggle';
import styles from './screens.module.css';

export const REMAPPABLE: { action: InputAction; label: string }[] = [
  { action: 'throttle', label: 'Throttle' },
  { action: 'brake', label: 'Brake / reverse' },
  { action: 'left', label: 'Steer left' },
  { action: 'right', label: 'Steer right' },
  { action: 'drift', label: 'Drift' },
  { action: 'nitro', label: 'Nitro' },
  { action: 'reset', label: 'Reset car' },
];

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Settings (§10.7). Everything persists to localStorage immediately. */
export function SettingsScreen() {
  const s = useSettingsStore();
  const closeModal = useGameStore((st) => st.closeModal);
  const [listening, setListening] = useState<{ action: InputAction; slot: number } | null>(null);

  // Capture the next key press for remapping; Esc cancels. Capture phase +
  // stopImmediatePropagation so the global Esc handler doesn't close the screen.
  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code !== 'Escape') s.setBinding(listening.action, listening.slot, e.code);
      setListening(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listening, s]);

  const volume = (key: 'masterVolume' | 'sfxVolume' | 'musicVolume', label: string) => (
    <div className={componentStyles.row}>
      <span>{label}</span>
      <span className={styles.control}>
        <Slider
          label={label}
          value={s[key]}
          min={0}
          max={1}
          step={0.05}
          format={pct}
          onChange={(v) => s.update({ [key]: v })}
        />
        <span className={styles.valueLabel}>{pct(s[key])}</span>
      </span>
    </div>
  );

  const toggle = (
    key: 'postProcessing' | 'cameraShake' | 'reduceMotion' | 'showFps',
    label: string,
  ) => (
    <div className={componentStyles.row}>
      <span>{label}</span>
      <Toggle label={label} checked={s[key]} onChange={(v) => s.update({ [key]: v })} />
    </div>
  );

  return (
    <Modal title="Settings" className={styles.settings}>
      <h3 className={styles.section}>Audio</h3>
      {volume('masterVolume', 'Master volume')}
      {volume('sfxVolume', 'Sound effects')}
      {volume('musicVolume', 'Music')}

      <h3 className={styles.section}>Controls</h3>
      <p className={componentStyles.hint}>Click a key, then press the new one. Esc cancels.</p>
      {REMAPPABLE.map(({ action, label }) => (
        <div key={action} className={styles.bindRow}>
          <span>{label}</span>
          {[0, 1].map((slot) => {
            const code = s.bindings[action][slot];
            const isListening = listening?.action === action && listening.slot === slot;
            return (
              <button
                key={slot}
                type="button"
                className={styles.bindButton}
                data-listening={isListening}
                aria-label={`${label} ${slot === 0 ? 'key' : 'alternate key'}: ${code ?? 'none'}`}
                onClick={() => setListening({ action, slot })}
              >
                {isListening ? (
                  <KeyCap label="Press…" />
                ) : code ? (
                  <KeyCap code={code} />
                ) : (
                  <KeyCap label="—" />
                )}
              </button>
            );
          })}
        </div>
      ))}
      <div className={componentStyles.row}>
        <span />
        <Button variant="ghost" size="small" onClick={s.resetBindings}>
          Reset keys
        </Button>
      </div>

      <h3 className={styles.section}>Graphics</h3>
      <div className={componentStyles.row}>
        <span>Quality</span>
        <span className={styles.segmented}>
          {(['low', 'medium', 'high'] as QualityLevel[]).map((q) => (
            <Button
              key={q}
              variant="ghost"
              size="small"
              aria-pressed={s.quality === q}
              onClick={() => s.update({ quality: q })}
            >
              {q[0]!.toUpperCase() + q.slice(1)}
            </Button>
          ))}
        </span>
      </div>
      {toggle('postProcessing', 'Glow effects')}
      {toggle('showFps', 'Show FPS')}

      <h3 className={styles.section}>Comfort</h3>
      {toggle('cameraShake', 'Camera shake')}
      {toggle('reduceMotion', 'Reduce motion')}
      <div className={componentStyles.row}>
        <span>UI scale</span>
        <span className={styles.control}>
          <Slider
            label="UI scale"
            value={s.uiScale}
            min={0.9}
            max={1.25}
            step={0.05}
            format={pct}
            onChange={(v) => s.update({ uiScale: v })}
          />
          <span className={styles.valueLabel}>{pct(s.uiScale)}</span>
        </span>
      </div>

      <div className={styles.buttonsRow}>
        <Button data-autofocus onClick={closeModal}>
          Done
        </Button>
        <Button variant="ghost" onClick={s.resetAll}>
          Reset all
        </Button>
      </div>
    </Modal>
  );
}
