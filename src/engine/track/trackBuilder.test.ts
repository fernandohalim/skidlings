import { describe, expect, it } from 'vitest';
import { TRACK_CONFIG } from '../../config/track.config';
import { TRACKS } from '../../tracks';
import { PINE_HILLS as SUNNY_LOOP } from '../../tracks/pineHills';
import { measureTrack } from './trackMetrics';
import { buildTrack, nearestSample } from './trackBuilder';

const track = buildTrack(SUNNY_LOOP);

describe('trackBuilder', () => {
  it('produces a closed loop with ~1 m sample spacing', () => {
    const n = track.sampleCount;
    const gap = Math.hypot(track.px[0]! - track.px[n - 1]!, track.pz[0]! - track.pz[n - 1]!);
    expect(gap).toBeGreaterThan(0.5);
    expect(gap).toBeLessThan(1.5);
    expect(track.length).toBeGreaterThan(300);
  });

  it('starts at the start control point, heading in race direction', () => {
    const [sx, sz] = SUNNY_LOOP.controlPoints[SUNNY_LOOP.startIndex]!;
    expect(Math.hypot(track.px[0]! - sx, track.pz[0]! - sz)).toBeLessThan(1);
    // Sunny Loop runs +Z along the right-hand straight
    expect(track.tz[0]!).toBeGreaterThan(0.9);
  });

  it('places checkpointCount checkpoints, 0 on the start line, in order', () => {
    expect(track.checkpoints).toHaveLength(SUNNY_LOOP.checkpointCount);
    expect(track.checkpoints[0]!.sample).toBe(0);
    for (let k = 1; k < track.checkpoints.length; k++) {
      expect(track.checkpoints[k]!.sample).toBeGreaterThan(track.checkpoints[k - 1]!.sample);
    }
  });

  it('puts the start grid behind the line, on the road, facing forward', () => {
    for (const slot of track.startGrid) {
      const dx = slot.x - track.px[0]!;
      const dz = slot.z - track.pz[0]!;
      expect(dx * track.tx[0]! + dz * track.tz[0]!).toBeLessThan(0);
      const s = nearestSample(track, slot.x, slot.z);
      const off = Math.hypot(slot.x - track.px[s]!, slot.z - track.pz[s]!);
      expect(off).toBeLessThan(SUNNY_LOOP.roadWidth / 2);
    }
  });

  it('keeps every wall point at the wall offset from the centerline (no pinching)', () => {
    const seg = track.wallSegments;
    for (let i = 0; i < seg.length; i += 4) {
      const s = nearestSample(track, seg[i]!, seg[i + 1]!);
      const d = Math.hypot(seg[i]! - track.px[s]!, seg[i + 1]! - track.pz[s]!);
      expect(d).toBeGreaterThan(track.wallOffset - 0.5);
    }
  });

  it('keeps decorations clear of the walls', () => {
    expect(track.decorations.length).toBeGreaterThan(50);
    for (const d of track.decorations) {
      const s = nearestSample(track, d.x, d.z);
      const dist = Math.hypot(d.x - track.px[s]!, d.z - track.pz[s]!);
      // Grass tufts may hug the bumpers (outside them); everything else keeps its distance.
      const min =
        d.kind === 'tuft'
          ? track.wallOffset + TRACK_CONFIG.bumperThickness
          : track.wallOffset + TRACK_CONFIG.decorationClearance - 1.5;
      expect(dist).toBeGreaterThan(min);
    }
  });

  it('is deterministic', () => {
    const again = buildTrack(SUNNY_LOOP);
    expect(again.decorations).toEqual(track.decorations);
    expect(Array.from(again.px)).toEqual(Array.from(track.px));
  });
});

describe('track designs (all tracks)', () => {
  for (const def of Object.values(TRACKS)) {
    it(`${def.id}: corners are wide enough for the inner wall and sections never overlap`, () => {
      const t = buildTrack(def);
      const m = measureTrack(t);
      // Inner wall would fold over itself on a tighter turn.
      expect(m.minRadius).toBeGreaterThanOrEqual(t.wallOffset + 2);
      // Two separate parts of the loop must not share walls.
      expect(m.minClearance).toBeGreaterThanOrEqual(2 * t.wallOffset + 3);
      expect(t.checkpoints).toHaveLength(def.checkpointCount);
    });

    it(`${def.id}: landmarks stand on dry land, clear of the road`, () => {
      const t = buildTrack(def);
      for (const l of def.landmarks ?? []) {
        if (l.kind === 'boat') {
          expect(t.terrain.isWater(l.x, l.z)).toBe(true);
          continue;
        }
        expect(t.terrain.isWater(l.x, l.z)).toBe(false);
        const s = nearestSample(t, l.x, l.z);
        expect(Math.hypot(l.x - t.px[s]!, l.z - t.pz[s]!)).toBeGreaterThan(t.wallOffset + 8);
      }
    });

    it(`${def.id}: road heights are smooth except at ramp lips, ramps sit on straights`, () => {
      const t = buildTrack(def);
      const lips = new Set(t.ramps.map((r) => r.sample));
      for (let i = 0; i < t.sampleCount; i++) {
        const j = (i + 1) % t.sampleCount;
        const step = Math.abs(t.h[j]! - t.h[i]!);
        // a lip may sit a sample or two from the patch's own sample
        const nearLip = [...lips].some(
          (s) => Math.abs(s - i) < 30 || Math.abs(s - i) > t.sampleCount - 30,
        );
        if (!nearLip) expect(step).toBeLessThan(0.45);
      }
      for (const r of t.ramps) {
        const a = (r.sample - 15 + t.sampleCount) % t.sampleCount;
        const b = (r.sample + 15) % t.sampleCount;
        const turn = Math.abs(
          Math.atan2(
            Math.sin(Math.atan2(t.tx[b]!, t.tz[b]!) - Math.atan2(t.tx[a]!, t.tz[a]!)),
            Math.cos(Math.atan2(t.tx[b]!, t.tz[b]!) - Math.atan2(t.tx[a]!, t.tz[a]!)),
          ),
        );
        expect(turn).toBeLessThan(0.6);
      }
    });
  }
});
