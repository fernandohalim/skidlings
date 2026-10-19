import type { RaceConfig } from '../../config/race.config';
import type { CarState } from '../car/types';
import type { InputState } from '../input/types';
import type { GridSlot, TrackData } from '../track/TrackDefinition';
import { degToRad, wrapAngle } from '../utils/math';
import { crossesGate } from './checkpoints';

export type RacePhase = 'intro' | 'countdown' | 'racing' | 'finished';

export type RaceEvent =
  | { type: 'countdown'; value: number } // 3, 2, 1
  | { type: 'go' }
  | { type: 'perfectStart' }
  | { type: 'checkpoint'; index: number }
  | { type: 'lap'; lap: number; time: number; best: boolean } // lap = laps completed
  | { type: 'finalLap' }
  | { type: 'finish'; totalTime: number; bestLap: number };

/**
 * Race rules (§9): intro → countdown → racing → finished, ordered checkpoints,
 * lap timing, wrong-way detection, reset-to-checkpoint, perfect start.
 * Pure TS; driven once per fixed simulation step.
 */
export class RaceController {
  phase: RacePhase = 'intro';
  /** Seconds spent in the current phase (unscaled sim time). */
  phaseTime = 0;
  /** 3, 2, 1 during countdown; 0 afterwards. */
  countdown = 3;
  readonly totalLaps: number;
  /** Laps completed. */
  lap = 0;
  nextCheckpoint = 1;
  /** Index of the last gate passed (reset target). -1 = start grid. */
  lastCheckpoint = -1;
  raceTime = 0;
  lapTime = 0;
  bestLap = Infinity;
  lapTimes: number[] = [];
  wrongWay = false;
  /** Sample index tracking the car along the centerline. */
  trackCursor = 0;
  /** Set when a perfect start is earned; the sim applies the boost and clears it. */
  pendingPerfectStart = false;
  /** Time scale the sim loop should use (finish slow-mo). */
  timeScale = 1;

  private wrongWayTimer = 0;
  private throttleWasDown = false;
  /** Countdown-relative time the throttle went down (GO = 0), or null. */
  private throttlePressedAt: number | null = null;
  private perfectChecked = false;
  private readonly events: RaceEvent[] = [];

  constructor(
    readonly track: TrackData,
    readonly cfg: RaceConfig,
    laps = track.def.laps,
    /** Player's start-grid slot (reset target before the first checkpoint). */
    readonly gridSlot = 0,
  ) {
    this.totalLaps = laps;
  }

  restart(): void {
    this.phase = 'intro';
    this.phaseTime = 0;
    this.countdown = 3;
    this.lap = 0;
    this.nextCheckpoint = 1;
    this.lastCheckpoint = -1;
    this.raceTime = 0;
    this.lapTime = 0;
    this.bestLap = Infinity;
    this.lapTimes = [];
    this.wrongWay = false;
    this.wrongWayTimer = 0;
    this.trackCursor = 0;
    this.pendingPerfectStart = false;
    this.timeScale = 1;
    this.throttleWasDown = false;
    this.throttlePressedAt = null;
    this.perfectChecked = false;
    this.events.length = 0;
  }

  /** Car may not move during intro/countdown. */
  get locked(): boolean {
    return this.phase === 'intro' || this.phase === 'countdown';
  }

  /** Skip the intro sweep (any key). */
  skipIntro(): void {
    if (this.phase === 'intro') this.enter('countdown');
  }

  /** 0..1 progress of the intro sweep (1 once past it). */
  get introProgress(): number {
    return this.phase === 'intro' ? Math.min(1, this.phaseTime / this.cfg.introDuration) : 1;
  }

  /** Drains queued events (HUD toasts, sounds). */
  drainEvents(out: RaceEvent[]): void {
    for (const e of this.events) out.push(e);
    this.events.length = 0;
  }

  /** Where R puts the car: last passed gate (or the grid), facing along the track, speed 0. */
  resetPose(): GridSlot {
    if (this.lastCheckpoint < 0) return this.track.startGrid[this.gridSlot]!;
    const cp = this.track.checkpoints[this.lastCheckpoint]!;
    return { x: cp.x, z: cp.z, heading: Math.atan2(cp.tx, cp.tz) };
  }

  /**
   * Advance one fixed step. Call BEFORE the car step with the raw input
   * (handles throttle timing for the perfect start), and pass the car state
   * AFTER its step via `afterCarStep`.
   */
  beforeCarStep(input: InputState, dt: number): void {
    this.phaseTime += dt;
    const throttleDown = input.throttle > 0;
    const pressed = throttleDown && !this.throttleWasDown;
    this.throttleWasDown = throttleDown;

    switch (this.phase) {
      case 'intro':
        if (this.phaseTime >= this.cfg.introDuration) this.enter('countdown');
        break;
      case 'countdown': {
        const step = this.cfg.countdownStepDuration;
        const value = 3 - Math.floor(this.phaseTime / step);
        if (pressed) this.throttlePressedAt = this.phaseTime - 3 * step;
        if (!throttleDown) this.throttlePressedAt = null;
        if (value <= 0) {
          this.enter('racing');
        } else if (value !== this.countdown) {
          this.countdown = value;
          this.events.push({ type: 'countdown', value });
        }
        break;
      }
      case 'racing':
        if (pressed && this.throttlePressedAt === null) this.throttlePressedAt = this.phaseTime;
        if (!this.perfectChecked && this.phaseTime > this.cfg.perfectStartWindow) {
          this.checkPerfectStart();
        }
        this.raceTime += dt;
        this.lapTime += dt;
        break;
      case 'finished':
        this.timeScale =
          this.phaseTime < this.cfg.finishSlowMoDuration ? this.cfg.finishSlowMoScale : 1;
        break;
    }
  }

  afterCarStep(car: CarState, dt: number): void {
    if (this.phase !== 'racing') return;
    this.updateCursor(car.x, car.z);
    this.updateWrongWay(car, dt);

    const cps = this.track.checkpoints;
    const cp = cps[this.nextCheckpoint]!;
    if (!crossesGate(cp, car.prevX, car.prevZ, car.x, car.z)) return;

    this.lastCheckpoint = this.nextCheckpoint;
    if (this.nextCheckpoint === 0) {
      this.completeLap();
    } else {
      this.events.push({ type: 'checkpoint', index: this.nextCheckpoint });
    }
    this.nextCheckpoint = (this.nextCheckpoint + 1) % cps.length;
  }

  /** lap * N + next + fraction toward next (§9.2), for ranking. */
  get progress(): number {
    const n = this.track.checkpoints.length;
    const cps = this.track.checkpoints;
    const prev = cps[(this.nextCheckpoint - 1 + n) % n]!.sample;
    const next = cps[this.nextCheckpoint]!.sample;
    const total = this.track.sampleCount;
    const span = (next - prev + total) % total || total;
    const done = (this.trackCursor - prev + total) % total;
    return this.lap * n + this.nextCheckpoint + Math.min(1, done / span);
  }

  private completeLap(): void {
    const time = this.lapTime;
    this.lap++;
    this.lapTimes.push(time);
    const best = time < this.bestLap;
    if (best) this.bestLap = time;
    this.lapTime = 0;
    this.events.push({ type: 'lap', lap: this.lap, time, best });
    if (this.lap >= this.totalLaps) {
      this.enter('finished');
      this.events.push({ type: 'finish', totalTime: this.raceTime, bestLap: this.bestLap });
    } else if (this.lap === this.totalLaps - 1) {
      this.events.push({ type: 'finalLap' });
    }
  }

  private checkPerfectStart(): void {
    this.perfectChecked = true;
    const t = this.throttlePressedAt;
    if (t !== null && t >= -this.cfg.perfectStartEarly && t <= this.cfg.perfectStartWindow) {
      this.pendingPerfectStart = true;
      this.events.push({ type: 'perfectStart' });
    }
  }

  private enter(phase: RacePhase): void {
    this.phase = phase;
    this.phaseTime = 0;
    if (phase === 'countdown') {
      this.countdown = 3;
      this.events.push({ type: 'countdown', value: 3 });
    } else if (phase === 'racing') {
      this.countdown = 0;
      this.events.push({ type: 'go' });
    } else if (phase === 'finished') {
      this.wrongWay = false;
      this.timeScale = this.cfg.finishSlowMoScale;
    }
  }

  private updateCursor(x: number, z: number): void {
    const { px, pz, sampleCount: n } = this.track;
    const w = this.cfg.trackSearchWindow;
    let best = this.trackCursor;
    let bestD = Infinity;
    for (let k = -w; k <= w; k++) {
      const i = (this.trackCursor + k + n) % n;
      const d = (px[i]! - x) ** 2 + (pz[i]! - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    this.trackCursor = best;
  }

  private updateWrongWay(car: CarState, dt: number): void {
    const i = this.trackCursor;
    const tangentYaw = Math.atan2(this.track.tx[i]!, this.track.tz[i]!);
    const off = Math.abs(wrapAngle(car.heading - tangentYaw));
    const moving = Math.hypot(car.vx, car.vz) > this.cfg.wrongWayMinSpeed;
    if (moving && off > degToRad(this.cfg.wrongWayAngleDeg)) {
      this.wrongWayTimer += dt;
    } else {
      this.wrongWayTimer = 0;
    }
    this.wrongWay = this.wrongWayTimer >= this.cfg.wrongWayDelay;
  }
}
