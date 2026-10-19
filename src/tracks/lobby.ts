import { LOBBY_CONFIG } from '../config/lobby.config';
import type { RampShape } from '../engine/physics/HeightField';
import type { Decoration, DecorationKind, GridSlot } from '../engine/track/TrackDefinition';
import { createRng } from '../engine/utils/random';
import type { TrackId } from './index';

/** A glowing pad on the lobby floor (§2.1). */
export type LobbyPad =
  | {
      kind: 'race';
      id: string;
      trackId: TrackId;
      label: string;
      x: number;
      z: number;
      color: string;
    }
  | { kind: 'garage'; id: string; label: string; x: number; z: number; color: string };

/** A toy building in the Toy Town skyline around the playmat. */
export interface ToyBuilding {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
  roof: string;
  rotation: number;
}

export interface LobbyLayout {
  spawn: GridSlot;
  pads: LobbyPad[];
  cones: [number, number][];
  /** Border + fountain wall segments for CollisionWorld. */
  walls: Float32Array;
  decorations: Decoration[];
  driftRing: { x: number; z: number; radius: number };
  /** Practice ramps (2.5D heights). */
  ramps: RampShape[];
  buildings: ToyBuilding[];
  fountain: { x: number; z: number; radius: number };
}

/** Builds the lobby playmat park (§8.4). Deterministic. */
export function buildLobby(): LobbyLayout {
  const c = LOBBY_CONFIG;
  const h = c.halfSize - c.borderInset;

  const pads: LobbyPad[] = [
    {
      kind: 'race',
      id: 'race-pine',
      trackId: 'pineHills',
      label: 'Pine Hills',
      x: -44,
      z: 20,
      color: '#3DD68C',
    },
    {
      kind: 'race',
      id: 'race-sea',
      trackId: 'seasideCliffs',
      label: 'Seaside Cliffs',
      x: 0,
      z: 24,
      color: '#2EC4F1',
    },
    {
      kind: 'race',
      id: 'race-canyon',
      trackId: 'redCanyon',
      label: 'Red Canyon',
      x: 44,
      z: 20,
      color: '#FF9F1C',
    },
    { kind: 'garage', id: 'garage', label: 'Garage', x: 0, z: -62, color: '#FFC933' },
  ];

  const driftRing = { x: 0, z: 58, radius: c.driftRingRadius };
  const cones: [number, number][] = [];
  for (let i = 0; i < c.driftRingCones; i++) {
    const a = (i / c.driftRingCones) * Math.PI * 2;
    cones.push([
      driftRing.x + Math.cos(a) * driftRing.radius,
      driftRing.z + Math.sin(a) * driftRing.radius,
    ]);
  }
  for (let i = 0; i < c.slalomCones; i++) {
    cones.push([-62, -40 + i * c.slalomSpacing]);
    cones.push([62, -40 + i * c.slalomSpacing]);
  }

  // Practice ramps: one down the central lane, two along the sides.
  const ramps: RampShape[] = [
    { x: 0, z: -34, heading: 0, length: 11, width: 9, height: 1.8 },
    { x: -78, z: 10, heading: Math.PI, length: 10, width: 8, height: 1.5 },
    { x: 78, z: -10, heading: 0, length: 10, width: 8, height: 1.5 },
  ];

  // Fountain in a corner plaza (solid: an octagon of wall segments).
  const fountain = { x: -60, z: -62, radius: 5.5 };
  const fw: number[] = [];
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * Math.PI * 2;
    const a1 = ((k + 1) / 8) * Math.PI * 2;
    fw.push(
      fountain.x + Math.cos(a0) * fountain.radius,
      fountain.z + Math.sin(a0) * fountain.radius,
      fountain.x + Math.cos(a1) * fountain.radius,
      fountain.z + Math.sin(a1) * fountain.radius,
    );
  }
  const walls = new Float32Array([-h, -h, h, -h, h, -h, h, h, h, h, -h, h, -h, h, -h, -h, ...fw]);

  // Toy Town skyline just outside the border wall (no collision needed).
  const brng = createRng(5);
  const BODY = ['#FF5A3C', '#2EC4F1', '#FFC933', '#3DD68C', '#9B5CFF', '#FF8FB1', '#FFFFFF'];
  const ROOF = ['#2B2340', '#FF5A3C', '#2E8BF1', '#9B5CFF', '#FFC933'];
  const buildings: ToyBuilding[] = [];
  for (let side = 0; side < 4; side++) {
    for (let t = -h + 8; t < h - 4; t += 15 + brng() * 8) {
      const out = h + 10 + brng() * 16;
      const [x, z] =
        side === 0 ? [t, -out] : side === 1 ? [out, t] : side === 2 ? [-t, out] : [-out, -t];
      buildings.push({
        x,
        z,
        w: 8 + brng() * 6,
        d: 8 + brng() * 6,
        h: 7 + brng() * 16,
        color: BODY[Math.floor(brng() * BODY.length)]!,
        roof: ROOF[Math.floor(brng() * ROOF.length)]!,
        rotation: (side * Math.PI) / 2,
      });
    }
  }

  // Props around the edge of the mat, away from pads and play areas.
  const rng = createRng(99);
  const kinds: DecorationKind[] = ['tree', 'pine', 'bush', 'block', 'flower', 'rock'];
  const decorations: Decoration[] = [];
  const keepOut = (x: number, z: number) =>
    pads.some((p) => Math.hypot(p.x - x, p.z - z) < 16) ||
    Math.hypot(driftRing.x - x, driftRing.z - z) < driftRing.radius + 10 ||
    Math.abs(Math.abs(x) - 62) < 8 ||
    Math.hypot(x - fountain.x, z - fountain.z) < 14 ||
    ramps.some((r) => Math.hypot(x - r.x, z - r.z) < 16) ||
    Math.hypot(x, z + 40) < 14;
  for (let tries = 0; decorations.length < c.decorationCount && tries < 4000; tries++) {
    const x = (rng() * 2 - 1) * (h - 4);
    const z = (rng() * 2 - 1) * (h - 4);
    const edge = Math.max(Math.abs(x), Math.abs(z)) > h - 26;
    if (!edge && rng() > 0.15) continue; // mostly around the border
    if (keepOut(x, z)) continue;
    decorations.push({
      kind: kinds[Math.floor(rng() * kinds.length)]!,
      x,
      z,
      scale: 0.8 + rng() * 0.6,
      rotation: rng() * Math.PI * 2,
      variant: Math.floor(rng() * 5),
    });
  }

  return {
    spawn: { x: 24, z: -80, heading: 0 },
    pads,
    cones,
    walls,
    decorations,
    driftRing,
    ramps,
    buildings,
    fountain,
  };
}
