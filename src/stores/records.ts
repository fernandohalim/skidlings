// Best lap / best total per track, persisted in localStorage (§9.3).
// Storage can be unavailable (private mode, blocked) — everything degrades to in-memory.

export interface TrackRecord {
  bestLap: number;
  bestTotal: number;
}

const KEY = 'skidlings.records.v1';
let cache: Record<string, TrackRecord> | null = null;

function load(): Record<string, TrackRecord> {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Record<string, TrackRecord>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

export function getRecord(trackId: string): TrackRecord | null {
  return load()[trackId] ?? null;
}

export interface RecordResult {
  newBestLap: boolean;
  newBestTotal: boolean;
  record: TrackRecord;
}

/** Merges a finished race into the stored records and reports what was beaten. */
export function submitResult(trackId: string, bestLap: number, total: number): RecordResult {
  const all = load();
  const prev = all[trackId];
  const newBestLap = !prev || bestLap < prev.bestLap;
  const newBestTotal = !prev || total < prev.bestTotal;
  const record: TrackRecord = {
    bestLap: newBestLap ? bestLap : prev.bestLap,
    bestTotal: newBestTotal ? total : prev.bestTotal,
  };
  all[trackId] = record;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // ignore: records stay in memory for this session
  }
  return { newBestLap, newBestTotal, record };
}
