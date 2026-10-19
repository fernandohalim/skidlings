import { useFrame, useThree } from '@react-three/fiber';
import { lazy, Suspense, useEffect, useMemo, useRef } from 'react';
import { CAMERA_CONFIG } from '../config/camera.config';
import { resolveCarConfig, type CarConfig, type CarId } from '../config/car.config';
import { QUALITY_PRESETS, WORLD_PALETTE } from '../config/graphics.config';
import { LOBBY_CONFIG } from '../config/lobby.config';
import { RACE_CONFIG } from '../config/race.config';
import { CarSimulation } from '../engine/car/CarSimulation';
import { ConeField } from '../engine/physics/ConeField';
import { RampField } from '../engine/physics/HeightField';
import { CollisionWorld } from '../engine/physics/World';
import { BoostPads } from '../engine/race/BoostPads';
import { RaceController } from '../engine/race/RaceController';
import { buildTrack, nearestSample } from '../engine/track/trackBuilder';
import { Bot } from '../engine/ai/AIDriver';
import { resolveCarPair } from '../engine/physics/carContacts';
import { AI_CONFIG, BOT_PROFILES } from '../config/ai.config';
import { isSimPaused, useGameStore } from '../stores/gameStore';
import { useSettingsStore } from '../stores/settingsStore';
import { TRACKS, type TrackId } from '../tracks';
import { buildLobby, type LobbyLayout } from '../tracks/lobby';
import { TopDownCamera } from './camera/TopDownCamera';
import { audio } from '../audio/AudioManager';
import { BotCars } from './Car/BotCars';
import { CarFeedback } from './Car/CarFeedback';
import { PlayerCar } from './Car/PlayerCar';
import { Lighting } from './Lighting';
import { LobbyWorld } from './LobbyWorld';
import { getToonMaterial } from './materials/toon';
import { RaceDirector } from './RaceDirector';
import { RaceWorld } from './RaceWorld';
import { createCarRenderPose, type CarRenderPose } from './sim/CarRenderPose';
import { Sky } from './Sky';
import { TitleDemo } from './TitleDemo';
import { SkidMarks } from './vfx/SkidMarks';
import { DriftSparks } from './vfx/DriftSparks';
import { NitroFlame } from './vfx/NitroFlame';
import { Ambience } from './vfx/Ambience';
import { Puffs } from './vfx/Puffs';
import { TireSmoke } from './vfx/TireSmoke';

// Dev-only; the dynamic import keeps leva out of production bundles.
const DebugPanel = import.meta.env.DEV ? lazy(() => import('../debug/DebugPanel')) : null;

let lobbyLayout: LobbyLayout | null = null;
const getLobby = () => (lobbyLayout ??= buildLobby());

/** Switches between Title, Lobby and Race worlds (§4.3). Each run remounts cleanly. */
export function GameScene() {
  const scene = useGameStore((s) => s.scene);
  const trackId = useGameStore((s) => s.trackId);
  const run = useGameStore((s) => s.sceneRun);
  const carId = useGameStore((s) => s.selectedCar);
  const qualityLevel = useSettingsStore((s) => s.quality);
  const quality = QUALITY_PRESETS[qualityLevel];
  const pose = useMemo(() => createCarRenderPose(), []);
  // Fresh live config per car; leva mutates it in place in dev.
  const carConfig = useMemo(() => resolveCarConfig(carId), [carId]);

  const gl = useThree((s) => s.gl);
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__renderInfo = () => ({ ...gl.info.render });
    }
  }, [gl]);

  return (
    <>
      <Lighting quality={quality} follow={pose} />

      {scene === 'title' && (
        <TitleScene key={`t${run}`} carId={carId} pose={pose} outlines={quality.outlines} />
      )}
      {scene === 'lobby' && (
        <LobbyScene
          key={`l${run}`}
          carId={carId}
          cfg={carConfig}
          pose={pose}
          outlines={quality.outlines}
        />
      )}
      {scene === 'race' && (
        <RaceScene
          key={`r${run}`}
          trackId={trackId}
          carId={carId}
          cfg={carConfig}
          pose={pose}
          outlines={quality.outlines}
        />
      )}

      {DebugPanel && scene !== 'title' && (
        <Suspense fallback={null}>
          <DebugPanel key={carId} carId={carId} carConfig={carConfig} />
        </Suspense>
      )}
    </>
  );
}

interface SceneProps {
  carId: CarId;
  cfg: CarConfig;
  pose: CarRenderPose;
  outlines: boolean;
}

/** Sunny sky + fog + flat ground for the lobby / title playmat. */
function LobbyEnvironment() {
  return (
    <>
      <Sky top="#4FB8FF" horizon="#E0F6FF" />
      <fog attach="fog" args={['#E0F6FF', 90, 240]} />
      <mesh
        rotation-x={-Math.PI / 2}
        position-y={-0.02}
        receiveShadow
        material={getToonMaterial(WORLD_PALETTE.grass)}
      >
        <planeGeometry args={[1200, 1200]} />
      </mesh>
    </>
  );
}

function TitleScene({ carId, pose, outlines }: Omit<SceneProps, 'cfg'>) {
  const layout = getLobby();
  const cones = useMemo(() => new ConeField(layout.cones, LOBBY_CONFIG.cone), [layout]);
  return (
    <>
      <LobbyEnvironment />
      <LobbyWorld layout={layout} cones={cones} outlines={outlines} />
      <Puffs />
      <Ambience theme="town" pose={pose} />
      <TitleDemo center={layout.driftRing} carId={carId} pose={pose} outlines={outlines} />
    </>
  );
}

/** Keeps the sim's config pointing at the selected car without a remount. */
function useLiveConfig(sim: CarSimulation, cfg: CarConfig) {
  useEffect(() => {
    sim.cfg = cfg;
  }, [sim, cfg]);
}

function useDevHandle(value: Record<string, unknown>) {
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__game = value;
  }, [value]);
}

function LobbyScene({ carId, cfg, pose, outlines }: SceneProps) {
  const layout = getLobby();
  const world = useMemo(() => new CollisionWorld(layout.walls), [layout]);
  const sim = useMemo(
    () => {
      const s = new CarSimulation(cfg, world, 'lobby', RACE_CONFIG.startNitroLobby);
      s.heights = new RampField(layout.ramps);
      return s;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world],
  );
  useLiveConfig(sim, cfg);
  const cones = useMemo(() => new ConeField(layout.cones, LOBBY_CONFIG.cone), [layout]);
  const onStep = useMemo(() => {
    let lastConeSound = 0;
    return (dt: number) => {
      const hits = cones.step(
        sim.car,
        sim.cfg.collisionRadius,
        sim.cfg.collisionCircleOffset,
        world,
        dt,
      );
      const now = performance.now();
      if (hits > 0 && now - lastConeSound > 60) {
        audio.coneHit();
        lastConeSound = now;
      }
    };
  }, [cones, sim, world]);
  useDevHandle(useMemo(() => ({ sim, cones, layout }), [sim, cones, layout]));

  return (
    <>
      <LobbyEnvironment />
      <LobbyWorld layout={layout} cones={cones} outlines={outlines} />
      <Puffs />
      <Ambience theme="town" pose={pose} />
      <PlayerCar
        carId={carId}
        sim={sim}
        pose={pose}
        spawn={layout.spawn}
        outlines={outlines}
        race={null}
        onStep={onStep}
      />
      <PadTriggers layout={layout} sim={sim} />
      <CarFeedback sim={sim} />
      <SkidMarks sim={sim} pose={pose} />
      <TireSmoke sim={sim} pose={pose} />
      <DriftSparks sim={sim} pose={pose} />
      <NitroFlame sim={sim} pose={pose} />
      <TopDownCamera pose={pose} heightMultiplier={CAMERA_CONFIG.lobbyHeightMultiplier} />
    </>
  );
}

/** Driving onto a pad (slowly enough) opens its modal; you must leave the pad to retrigger. */
function PadTriggers({ layout, sim }: { layout: LobbyLayout; sim: CarSimulation }) {
  const inside = useRef<string | null>(null);
  useFrame(() => {
    if (isSimPaused()) return;
    const c = sim.car;
    const speed = Math.hypot(c.vx, c.vz);
    let hit: (typeof layout.pads)[number] | null = null;
    for (const p of layout.pads) {
      if (Math.hypot(c.x - p.x, c.z - p.z) < LOBBY_CONFIG.padRadius) hit = p;
    }
    if (!hit) {
      inside.current = null;
      return;
    }
    if (inside.current === hit.id || speed > LOBBY_CONFIG.padMaxSpeed) return;
    inside.current = hit.id;
    const g = useGameStore.getState();
    if (hit.kind === 'race') g.openModal('trackSelect', { padTrackId: hit.trackId });
    else g.openModal('garage');
  });
  return null;
}

function RaceScene({ trackId, carId, cfg, pose, outlines }: SceneProps & { trackId: TrackId }) {
  const track = useMemo(() => buildTrack(TRACKS[trackId]), [trackId]);
  const world = useMemo(() => new CollisionWorld(track.wallSegments), [track]);
  const sim = useMemo(
    () => {
      const s = new CarSimulation(cfg, world, 'race', RACE_CONFIG.startNitroRace);
      s.heights = track.heightField;
      return s;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world],
  );
  const pads = useMemo(() => new BoostPads(track.boostPads, RACE_CONFIG.boostPadTier), [track]);
  useLiveConfig(sim, cfg);
  const playerSlot = AI_CONFIG.playerGridSlot;
  const race = useMemo(
    () => new RaceController(track, RACE_CONFIG, track.def.laps, playerSlot),
    [track, playerSlot],
  );
  // AI opponents fill the other grid slots (M8).
  const bots = useMemo(() => {
    const slots = track.startGrid.map((_, i) => i).filter((i) => i !== playerSlot);
    return BOT_PROFILES.slice(0, slots.length).map(
      (p, k) =>
        new Bot(
          `bot${k}`,
          p,
          resolveCarConfig(p.carId),
          track,
          world,
          track.def.laps,
          AI_CONFIG,
          RACE_CONFIG.startNitroRace,
        ),
    );
  }, [track, world, playerSlot]);
  const resetBots = useMemo(
    () => () => {
      const slots = track.startGrid.map((_, i) => i).filter((i) => i !== playerSlot);
      bots.forEach((b, k) => {
        const g = track.startGrid[slots[k]!]!;
        b.reset(g.x, g.z, g.heading, nearestSample(track, g.x, g.z), RACE_CONFIG.startNitroRace);
      });
    },
    [bots, track, playerSlot],
  );
  const onStep = useMemo(() => {
    const cars = [sim.car, ...bots.map((b) => b.sim.car)]; // built once, not per step
    return (dt: number) => {
      if (race.locked) return;
      if (pads.update(sim, dt) >= 0) audio.boost();
      for (const b of bots) {
        pads.update(b.sim, dt);
        b.setRubberBand(race.progress - b.tracker.progress, AI_CONFIG);
        b.step(dt, race.raceTime);
      }
      // Soft bumper-car contacts between everyone.
      const r = sim.cfg.collisionRadius;
      const off = sim.cfg.collisionCircleOffset;
      for (let i = 0; i < cars.length; i++) {
        for (let j = i + 1; j < cars.length; j++) {
          const hit = resolveCarPair(cars[i]!, cars[j]!, r, off, AI_CONFIG.contactRestitution);
          if (hit > 3 && i === 0) audio.bonk(hit * 0.6);
        }
      }
    };
  }, [bots, race, sim, pads]);
  useDevHandle(useMemo(() => ({ sim, race, track, bots }), [sim, race, track, bots]));

  return (
    <>
      <Sky top={track.def.theme.skyTop} horizon={track.def.theme.skyHorizon} />
      <fog attach="fog" args={[track.def.theme.skyHorizon, 90, 260]} />
      <RaceWorld track={track} outlines={outlines} />
      <Puffs />
      <Ambience theme={track.def.theme.kind} pose={pose} />
      <PlayerCar
        carId={carId}
        sim={sim}
        pose={pose}
        spawn={track.startGrid[playerSlot]!}
        outlines={outlines}
        race={race}
        onStep={onStep}
      />
      <BotCars bots={bots} playerPose={pose} outlines={outlines} />
      <RaceDirector race={race} sim={sim} bots={bots} resetBots={resetBots} />
      <CarFeedback sim={sim} />
      <SkidMarks sim={sim} pose={pose} />
      <TireSmoke sim={sim} pose={pose} />
      <DriftSparks sim={sim} pose={pose} />
      <NitroFlame sim={sim} pose={pose} />
      <TopDownCamera pose={pose} race={race} />
    </>
  );
}
