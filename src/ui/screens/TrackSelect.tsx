import { useMemo, useState } from 'react';
import { formatTime } from '../../engine/race/checkpoints';
import { buildTrack } from '../../engine/track/trackBuilder';
import { useGameStore } from '../../stores/gameStore';
import { getRecord } from '../../stores/records';
import { TRACK_ORDER, TRACKS, type TrackId } from '../../tracks';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import styles from './screens.module.css';

const mapCache = new Map<TrackId, string>();

/** SVG polyline of a track's centerline, normalized into a 100×60 box. */
function miniMap(id: TrackId): string {
  const cached = mapCache.get(id);
  if (cached) return cached;
  const t = buildTrack(TRACKS[id]);
  const b = t.bounds;
  const w = b.maxX - b.minX;
  const h = b.maxZ - b.minZ;
  const s = Math.min(92 / w, 52 / h);
  const ox = (100 - w * s) / 2;
  const oy = (60 - h * s) / 2;
  const pts: string[] = [];
  for (let i = 0; i < t.sampleCount; i += 4) {
    pts.push(
      `${(ox + (t.px[i]! - b.minX) * s).toFixed(1)},${(oy + (b.maxZ - t.pz[i]!) * s).toFixed(1)}`,
    );
  }
  const out = pts.join(' ');
  mapCache.set(id, out);
  return out;
}

const TRACK_COLORS: Record<TrackId, string> = {
  pineHills: '#3DD68C',
  seasideCliffs: '#2EC4F1',
  redCanyon: '#FF9F1C',
};
const DIFFICULTY: Record<TrackId, string> = {
  pineHills: 'Easy',
  seasideCliffs: 'Medium',
  redCanyon: 'Tricky',
};

/** Track Select modal (§10.7), opened from a lobby Race Pad. */
export function TrackSelect() {
  const pad = useGameStore((s) => s.padTrackId);
  const startRace = useGameStore((s) => s.startRace);
  const closeModal = useGameStore((s) => s.closeModal);
  const [selected, setSelected] = useState<TrackId>(pad);
  const maps = useMemo(() => Object.fromEntries(TRACK_ORDER.map((id) => [id, miniMap(id)])), []);

  return (
    <Modal title="Pick a track">
      <div className={styles.cards}>
        {TRACK_ORDER.map((id) => {
          const def = TRACKS[id];
          const rec = getRecord(id);
          return (
            <button
              key={id}
              type="button"
              className={styles.card}
              aria-pressed={selected === id}
              data-autofocus={id === pad ? true : undefined}
              style={{ ['--card-color' as string]: TRACK_COLORS[id] }}
              onFocus={() => setSelected(id)}
              // Mouse click selects; Enter/Space on a focused card (detail 0) races.
              onClick={(e) => (e.detail === 0 ? startRace(id) : setSelected(id))}
              onDoubleClick={() => startRace(id)}
            >
              <span className={styles.cardTitle}>{def.name}</span>
              <svg className={styles.map} viewBox="0 0 100 60" aria-hidden>
                <polyline
                  points={maps[id]}
                  fill="none"
                  stroke="#2B2340"
                  strokeWidth="5.5"
                  strokeLinejoin="round"
                />
                <polyline
                  points={maps[id]}
                  fill="none"
                  stroke="#5A5F73"
                  strokeWidth="3.5"
                  strokeLinejoin="round"
                />
              </svg>
              <span className={styles.cardMeta}>
                <span>{def.laps} laps</span>
                <span>{DIFFICULTY[id]}</span>
              </span>
              <span className={styles.cardMeta}>
                <span>Best lap</span>
                <span className={styles.mono}>{formatTime(rec?.bestLap ?? Infinity)}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className={styles.buttonsRow}>
        <Button onClick={() => startRace(selected)}>Race!</Button>
        <Button variant="ghost" onClick={closeModal}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
