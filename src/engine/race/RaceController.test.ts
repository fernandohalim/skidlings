import { describe, expect, it } from 'vitest';
import { RACE_CONFIG } from '../../config/race.config';
import { createCarState, resetCarState, type CarState } from '../car/types';
import { createInputState } from '../input/types';
import { buildTrack } from '../track/trackBuilder';
import { PINE_HILLS } from '../../tracks/pineHills';
import { crossesGate, formatTime } from './checkpoints';
import { RaceController, type RaceEvent } from './RaceController';

const DT = 1 / 60;
const track = buildTrack(PINE_HILLS);
const N = track.sampleCount;

/** Advance the controller through intro + countdown with no input. */
function toRacing(race: RaceController) {
  const input = createInputState();
  for (let i = 0; i < 60 * 5 && race.phase !== 'racing'; i++) race.beforeCarStep(input, DT);
}

/** Teleports the car along the centerline sample-by-sample (forward or backward). */
function driveSamples(race: RaceController, car: CarState, from: number, count: number, dir = 1) {
  const input = createInputState();
  for (let k = 1; k <= count; k++) {
    const i = (((from + k * dir) % N) + N) % N;
    car.prevX = car.x;
    car.prevZ = car.z;
    car.x = track.px[i]!;
    car.z = track.pz[i]!;
    car.heading = Math.atan2(track.tx[i]! * dir, track.tz[i]! * dir);
    car.vx = track.tx[i]! * dir * 20;
    car.vz = track.tz[i]! * dir * 20;
    race.beforeCarStep(input, DT);
    race.afterCarStep(car, DT);
  }
}

function startCar(): CarState {
  const g = track.startGrid[0]!;
  const s = (N - 8) % N; // grid row 1 sits ~8 samples behind the line
  const car = createCarState();
  resetCarState(car, track.px[s]!, track.pz[s]!, g.heading);
  return car;
}

describe('checkpoints', () => {
  it('detects a forward crossing only', () => {
    const cp = track.checkpoints[3]!;
    const ax = cp.x - cp.tx;
    const az = cp.z - cp.tz;
    const bx = cp.x + cp.tx;
    const bz = cp.z + cp.tz;
    expect(crossesGate(cp, ax, az, bx, bz)).toBe(true);
    expect(crossesGate(cp, bx, bz, ax, az)).toBe(false);
  });

  it('ignores crossings outside the gate width', () => {
    const cp = track.checkpoints[3]!;
    const off = cp.halfWidth + 5;
    const ox = -cp.tz * off;
    const oz = cp.tx * off;
    expect(
      crossesGate(cp, cp.x - cp.tx + ox, cp.z - cp.tz + oz, cp.x + cp.tx + ox, cp.z + cp.tz + oz),
    ).toBe(false);
  });

  it('formats m:ss.mmm', () => {
    expect(formatTime(83.456)).toBe('1:23.456');
    expect(formatTime(5.01)).toBe('0:05.010');
    expect(formatTime(Infinity)).toBe('-:--.---');
  });
});

describe('RaceController', () => {
  it('runs intro → countdown 3,2,1 → GO and stays locked until GO', () => {
    const race = new RaceController(track, RACE_CONFIG);
    const events: RaceEvent[] = [];
    expect(race.locked).toBe(true);
    toRacing(race);
    race.drainEvents(events);
    expect(
      events.filter((e) => e.type === 'countdown').map((e) => (e as { value: number }).value),
    ).toEqual([3, 2, 1]);
    expect(events.at(-1)?.type).toBe('go');
    expect(race.locked).toBe(false);
  });

  it('counts a lap only after all checkpoints in order, then finishes after 3', () => {
    const race = new RaceController(track, RACE_CONFIG);
    toRacing(race);
    const car = startCar();
    // Crossing the line at the start does not count.
    driveSamples(race, car, N - 8, 20);
    expect(race.lap).toBe(0);
    driveSamples(race, car, 12, N);
    expect(race.lap).toBe(1);
    driveSamples(race, car, 12, N * 2);
    expect(race.lap).toBe(3);
    expect(race.phase).toBe('finished');
    expect(race.lapTimes).toHaveLength(3);
    expect(race.bestLap).toBe(Math.min(...race.lapTimes));
    expect(race.raceTime).toBeCloseTo(
      race.lapTimes.reduce((a, b) => a + b, 0), // lap clock starts at GO too
      6,
    );
  });

  it('ignores the wrong checkpoint (skipping the loop via a shortcut)', () => {
    const race = new RaceController(track, RACE_CONFIG);
    toRacing(race);
    const car = startCar();
    driveSamples(race, car, N - 8, 20); // passes the line (ignored)
    // Teleport to just before the finish line and cross it: no lap, wrong order.
    driveSamples(race, car, N - 5, 10);
    expect(race.lap).toBe(0);
    expect(race.nextCheckpoint).toBe(1);
  });

  it('flags wrong way after driving backwards for the delay', () => {
    const race = new RaceController(track, RACE_CONFIG);
    toRacing(race);
    const car = startCar();
    driveSamples(race, car, N - 8, 30);
    expect(race.wrongWay).toBe(false);
    driveSamples(race, car, 22, Math.round(RACE_CONFIG.wrongWayDelay * 60) + 5, -1);
    expect(race.wrongWay).toBe(true);
    driveSamples(race, car, 0, 5, 1);
    expect(race.wrongWay).toBe(false);
  });

  it('reset pose is the last passed checkpoint, facing along the track', () => {
    const race = new RaceController(track, RACE_CONFIG);
    toRacing(race);
    expect(race.resetPose()).toEqual(track.startGrid[0]);
    const car = startCar();
    driveSamples(race, car, N - 8, track.checkpoints[2]!.sample + 12);
    const cp = track.checkpoints[2]!;
    const pose = race.resetPose();
    expect(pose.x).toBeCloseTo(cp.x);
    expect(pose.z).toBeCloseTo(cp.z);
    expect(pose.heading).toBeCloseTo(Math.atan2(cp.tx, cp.tz));
  });

  it('before any checkpoint, reset goes back to the player grid slot', () => {
    const race = new RaceController(track, RACE_CONFIG, 3, 3);
    expect(race.resetPose()).toEqual(track.startGrid[3]);
  });

  it('perfect start: throttle pressed right at GO earns it, holding early does not', () => {
    const run = (pressAt: number) => {
      const race = new RaceController(track, RACE_CONFIG);
      const goAt = RACE_CONFIG.introDuration + 3 * RACE_CONFIG.countdownStepDuration;
      const input = createInputState();
      for (let t = 0; t < goAt + 1; t += DT) {
        input.throttle = t >= pressAt ? 1 : 0;
        race.beforeCarStep(input, DT);
      }
      return race.pendingPerfectStart;
    };
    const goAt = RACE_CONFIG.introDuration + 3 * RACE_CONFIG.countdownStepDuration;
    expect(run(goAt - 0.05)).toBe(true);
    expect(run(goAt + 0.1)).toBe(true);
    expect(run(goAt - 1.5)).toBe(false);
    expect(run(goAt + 0.6)).toBe(false);
  });

  it('progress increases along the lap', () => {
    const race = new RaceController(track, RACE_CONFIG);
    toRacing(race);
    const car = startCar();
    driveSamples(race, car, N - 8, 40);
    const a = race.progress;
    driveSamples(race, car, 32, 60);
    expect(race.progress).toBeGreaterThan(a);
  });
});
