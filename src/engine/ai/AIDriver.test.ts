import { describe, expect, it } from 'vitest';
import { AI_CONFIG, BOT_PROFILES } from '../../config/ai.config';
import { resolveCarConfig } from '../../config/car.config';
import { createCarState } from '../car/types';
import { resolveCarPair } from '../physics/carContacts';
import { CollisionWorld } from '../physics/World';
import { rankStandings } from '../race/LapTracker';
import { buildTrack } from '../track/trackBuilder';
import { TRACKS } from '../../tracks';
import { CarSimulation } from '../car/CarSimulation';
import { BoostPads } from '../race/BoostPads';
import { Bot } from './AIDriver';

const DT = 1 / 60;

describe('AI bots', () => {
  for (const def of Object.values(TRACKS)) {
    for (const profile of BOT_PROFILES) {
      it(`${profile.name} finishes a lap of ${def.id} on its own without getting stuck`, () => {
        const track = buildTrack(def);
        const world = new CollisionWorld(track.wallSegments);
        const bot = new Bot(
          'b',
          profile,
          resolveCarConfig(profile.carId),
          track,
          world,
          1,
          AI_CONFIG,
          50,
        );
        const g = track.startGrid[0]!;
        bot.reset(g.x, g.z, g.heading, track.sampleCount - 8, 50);
        let t = 0;
        let done = false;
        for (; t < 90 && !done; t += DT) done = bot.step(DT, t);
        expect(done).toBe(true);
        // a lap at a sensible pace: well under 90 s
        expect(bot.tracker.finishTime).toBeLessThan(60);
      });
    }
  }

  it('rubber-banding speeds up a trailing bot and slows a leading one', () => {
    const track = buildTrack(TRACKS.pineHills);
    const world = new CollisionWorld(track.wallSegments);
    const p = BOT_PROFILES[0]!;
    const bot = new Bot('b', p, resolveCarConfig(p.carId), track, world, 3, AI_CONFIG, 50);
    const base = bot.sim.cfg.maxSpeed;
    bot.setRubberBand(10, AI_CONFIG);
    expect(bot.sim.cfg.maxSpeed).toBeCloseTo(base * AI_CONFIG.rubberBandMax);
    bot.setRubberBand(-10, AI_CONFIG);
    expect(bot.sim.cfg.maxSpeed).toBeCloseTo(base * AI_CONFIG.rubberBandMin);
  });
});

describe('boost pads', () => {
  it('fire once per pass and give a mini-boost', () => {
    const track = buildTrack(TRACKS.pineHills);
    const pads = new BoostPads(track.boostPads, 2);
    const p = track.boostPads[0]!;
    const sim = new CarSimulation(resolveCarConfig('balanced'));
    sim.reset(p.x, p.z, p.heading);
    expect(pads.update(sim, DT)).toBe(0);
    expect(sim.drift.boostTier).toBe(2);
    expect(pads.update(sim, DT)).toBe(-1); // cooldown
  });
});

describe('car contacts', () => {
  it('pushes overlapping cars apart and exchanges closing speed', () => {
    const a = createCarState(0, 0, 0);
    const b = createCarState(1.5, 0, 0);
    a.vx = 5;
    const impact = resolveCarPair(a, b, 1, 1, 0.3);
    expect(impact).toBeGreaterThan(0);
    expect(b.x - a.x).toBeGreaterThan(1.5);
    expect(b.vx).toBeGreaterThan(0);
    expect(a.vx).toBeLessThan(5);
  });
});

describe('standings', () => {
  it('ranks finishers by time, then the rest by progress', () => {
    const r = rankStandings([
      { id: 'a', progress: 10, finished: false, finishTime: Infinity },
      { id: 'b', progress: 99, finished: true, finishTime: 50 },
      { id: 'c', progress: 12, finished: false, finishTime: Infinity },
      { id: 'd', progress: 99, finished: true, finishTime: 48 },
    ]);
    expect(r.map((e) => e.id)).toEqual(['d', 'b', 'c', 'a']);
  });
});
