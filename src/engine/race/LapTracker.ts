import type { CarState } from '../car/types';
import type { TrackData } from '../track/TrackDefinition';
import { crossesGate } from './checkpoints';

/**
 * Ordered-checkpoint lap counting + centerline progress for any car (bots use
 * this; the player's RaceController has the same rules plus UI events).
 */
export class LapTracker {
  lap = 0;
  nextCheckpoint = 1;
  cursor = 0;
  finished = false;
  finishTime = Infinity;

  constructor(
    readonly track: TrackData,
    readonly totalLaps: number,
    private readonly searchWindow = 30,
  ) {}

  reset(startSample: number): void {
    this.lap = 0;
    this.nextCheckpoint = 1;
    this.cursor = startSample;
    this.finished = false;
    this.finishTime = Infinity;
  }

  /** Call after the car's step. Returns true on the step the car finishes. */
  update(car: CarState, raceTime: number): boolean {
    this.updateCursor(car.x, car.z);
    if (this.finished) return false;
    const cps = this.track.checkpoints;
    if (!crossesGate(cps[this.nextCheckpoint]!, car.prevX, car.prevZ, car.x, car.z)) return false;
    if (this.nextCheckpoint === 0) {
      this.lap++;
      if (this.lap >= this.totalLaps) {
        this.finished = true;
        this.finishTime = raceTime;
        this.nextCheckpoint = 1;
        return true;
      }
    }
    this.nextCheckpoint = (this.nextCheckpoint + 1) % cps.length;
    return false;
  }

  /** lap * N + next + fraction toward next (same formula as the player, §9.2). */
  get progress(): number {
    const cps = this.track.checkpoints;
    const n = cps.length;
    if (this.finished) return this.totalLaps * n + 1;
    const prev = cps[(this.nextCheckpoint - 1 + n) % n]!.sample;
    const next = cps[this.nextCheckpoint]!.sample;
    const total = this.track.sampleCount;
    const span = (next - prev + total) % total || total;
    const done = (this.cursor - prev + total) % total;
    return this.lap * n + this.nextCheckpoint + Math.min(1, done / span);
  }

  private updateCursor(x: number, z: number): void {
    const { px, pz, sampleCount: n } = this.track;
    let best = this.cursor;
    let bestD = Infinity;
    for (let k = -this.searchWindow; k <= this.searchWindow; k++) {
      const i = (this.cursor + k + n) % n;
      const d = (px[i]! - x) ** 2 + (pz[i]! - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    this.cursor = best;
  }
}

export interface StandingEntry {
  id: string;
  progress: number;
  finished: boolean;
  finishTime: number;
}

/** Sorts racers: finished first by time, then by progress. */
export function rankStandings<T extends StandingEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    return b.progress - a.progress;
  });
}
