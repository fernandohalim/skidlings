import { useEffect, useRef } from 'react';
import { formatTime } from '../../engine/race/checkpoints';
import { useRaceStore } from '../../stores/raceStore';
import { telemetry } from '../../stores/telemetry';
import { ordinal } from '../format';
import { ResultsScreen } from '../screens/ResultsScreen';
import styles from './hud.module.css';

/** Race HUD (§10.5): lap + best (top-left), timers (top-right), center messages. */
export function RaceHUD() {
  const lap = useRaceStore((s) => s.lap);
  const totalLaps = useRaceStore((s) => s.totalLaps);
  const bestLap = useRaceStore((s) => s.bestLap);
  const recordLap = useRaceStore((s) => s.recordLap);
  const phase = useRaceStore((s) => s.phase);
  const results = useRaceStore((s) => s.results);
  const position = useRaceStore((s) => s.position);
  const racers = useRaceStore((s) => s.racers);
  const best = Math.min(bestLap, recordLap);
  const currentLap = Math.min(lap + 1, totalLaps);

  return (
    <>
      <div className={styles.topLeft}>
        <div className={`${styles.pill} ${styles.lapPill}`}>
          <span className={styles.hint}>LAP</span>
          <span className={styles.lapValue}>
            {currentLap}
            <small>/{totalLaps}</small>
          </span>
        </div>
        {racers > 1 && (
          <div
            key={position}
            className={`${styles.pill} ${styles.posPill}`}
            data-first={position === 1}
          >
            <span className={styles.posValue}>{ordinal(position)}</span>
            <small className={styles.hint}>/ {racers}</small>
          </div>
        )}
        <div className={`${styles.pill} ${styles.subPill}`}>
          <span className={styles.hint}>BEST</span>
          <span className={styles.mono}>{formatTime(best)}</span>
        </div>
      </div>
      <Timers />
      <CenterMessages />
      {phase === 'finished' && results && <ResultsScreen results={results} />}
    </>
  );
}

/** Timers write the DOM directly at ~20 Hz (never React state). */
function Timers() {
  const total = useRef<HTMLSpanElement>(null);
  const lapT = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const id = window.setInterval(() => {
      if (total.current) total.current.textContent = formatTime(telemetry.raceTime);
      if (lapT.current) lapT.current.textContent = formatTime(telemetry.lapTime);
    }, 50);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className={styles.topRight}>
      <div className={`${styles.pill} ${styles.timerPill}`}>
        <span ref={total} className={`${styles.mono} ${styles.timerBig}`}>
          0:00.000
        </span>
      </div>
      <div className={`${styles.pill} ${styles.subPill}`}>
        <span className={styles.hint}>LAP</span>
        <span ref={lapT} className={styles.mono}>
          0:00.000
        </span>
      </div>
    </div>
  );
}

const TOAST_CLASS: Record<string, string | undefined> = {
  go: styles.toastGo,
  lap: styles.toastLap,
  finalLap: styles.toastFinal,
  perfect: styles.toastPerfect,
  record: styles.toastFinal,
  finish: styles.toastLap,
};

function CenterMessages() {
  const phase = useRaceStore((s) => s.phase);
  const countdown = useRaceStore((s) => s.countdown);
  const wrongWay = useRaceStore((s) => s.wrongWay);
  const toast = useRaceStore((s) => s.toast);
  const trackName = useRaceStore((s) => s.trackName);

  return (
    <div className={styles.center} aria-live="polite">
      {phase === 'intro' && (
        <div className={styles.introCard}>
          <span className={styles.hint}>NEXT RACE</span>
          <span className={styles.introTitle}>{trackName}</span>
          <span className={styles.hint}>Press any key to skip</span>
        </div>
      )}
      {phase === 'countdown' && countdown > 0 && (
        <div key={countdown} className={styles.countdown}>
          {countdown}
        </div>
      )}
      {toast && phase !== 'countdown' && (
        <div key={toast.id} className={`${styles.toast} ${TOAST_CLASS[toast.kind] ?? ''}`}>
          {toast.text}
        </div>
      )}
      {wrongWay && <div className={`${styles.toast} ${styles.wrongWay}`}>Wrong way!</div>}
    </div>
  );
}
