import { formatTime } from '../../engine/race/checkpoints';
import { useGameStore } from '../../stores/gameStore';
import { useRaceStore, type RaceResults } from '../../stores/raceStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Button } from '../components/Button';
import { Confetti } from '../components/Confetti';
import { ordinal } from '../format';
import { Modal } from '../components/Modal';
import styles from './screens.module.css';

/** Results (§10.7): times, drift score, "New record!" ribbon. */
export function ResultsScreen({ results }: { results: RaceResults }) {
  const requestRestart = useRaceStore((s) => s.requestRestart);
  const trackName = useRaceStore((s) => s.trackName);
  const goLobby = useGameStore((s) => s.goLobby);
  const bestIdx = results.lapTimes.indexOf(results.bestLap);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  const celebrate =
    (results.newBestTotal || results.newBestLap || results.position === 1) && !reduceMotion;

  return (
    <>
      {celebrate && <Confetti />}
      <Modal title="Finish!" label={`${trackName} results`}>
        {results.newBestTotal && <div className={styles.ribbon}>New record!</div>}
        <p className={styles.placing} data-first={results.position === 1}>
          {results.position === 1 ? '🏆 ' : ''}You placed {ordinal(results.position)}!
        </p>
        <dl className={styles.resultRows}>
          <dt>Total time</dt>
          <dd>{formatTime(results.totalTime)}</dd>
          <dt>Best lap {results.newBestLap && <em className={styles.newTag}>NEW</em>}</dt>
          <dd>{formatTime(results.bestLap)}</dd>
          <dt>Drift score</dt>
          <dd>{Math.round(results.driftScore)}</dd>
        </dl>
        <ol className={styles.lapList}>
          {results.lapTimes.map((t, i) => (
            <li key={i} data-best={i === bestIdx}>
              <span>Lap {i + 1}</span>
              <span className={styles.mono}>{formatTime(t)}</span>
            </li>
          ))}
        </ol>
        <div className={styles.buttonsRow}>
          <Button data-autofocus onClick={requestRestart}>
            Race again
          </Button>
          <Button variant="ghost" onClick={goLobby}>
            Back to Lobby
          </Button>
        </div>
      </Modal>
    </>
  );
}
