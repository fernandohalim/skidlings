import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Group } from 'three';
import type { CarId } from '../../config/car.config';
import { RACE_CONFIG } from '../../config/race.config';
import type { RaceController } from '../../engine/race/RaceController';
import type { CarSimulation } from '../../engine/car/CarSimulation';
import { InputManager } from '../../engine/input/InputManager';
import { FixedStepLoop } from '../../engine/loop/FixedStepLoop';
import { clamp } from '../../engine/utils/math';
import { isSimPaused, useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { telemetry } from '../../stores/telemetry';
import type { CarRenderPose } from '../sim/CarRenderPose';
import { applyCarPose, createPoseSmoothing } from './carPose';
import { CarVisual, createCarRig, WHEEL_RADIUS } from './CarVisual';

/** Runs before the camera/lighting/VFX (lower priority runs first; <=0 keeps auto-render). */
export const SIM_FRAME_PRIORITY = -2;

const MAX_WHEEL_STEER = 0.45; // rad, visual only
const BODY_ROLL_PER_MS = 0.012; // rad of lean per m/s of lateral slip, visual only
const MAX_BODY_ROLL = 0.12;

interface PlayerCarProps {
  carId: CarId;
  sim: CarSimulation;
  pose: CarRenderPose;
  spawn: { x: number; z: number; heading: number };
  outlines: boolean;
  /** Race rules when on a track; null in free roam. */
  race: RaceController | null;
  /** Extra per-fixed-step logic after the car moved (lobby cones, …). */
  onStep?: (dt: number) => void;
}

export function PlayerCar({ carId, sim, pose, spawn, outlines, race, onStep }: PlayerCarProps) {
  const group = useRef<Group>(null);
  const rig = useMemo(() => createCarRig(), []);
  const smoothing = useMemo(() => createPoseSmoothing(), []);
  const input = useMemo(() => new InputManager(useSettingsStore.getState().bindings), []);
  const loop = useMemo(() => new FixedStepLoop(1 / 60, 5), []);

  useEffect(() => {
    input.attach(window);
    // Remapped keys apply instantly; opening/closing a menu drops held keys so
    // nothing stays "stuck" from menu navigation.
    const unsubBindings = useSettingsStore.subscribe((s, prev) => {
      if (s.bindings !== prev.bindings) input.setBindings(s.bindings);
    });
    const unsubModal = useGameStore.subscribe((s, prev) => {
      if (s.modal !== prev.modal) input.releaseAll();
    });
    return () => {
      unsubBindings();
      unsubModal();
      input.detach();
    };
  }, [input]);

  useEffect(() => {
    sim.reset(spawn.x, spawn.z, spawn.heading);
    loop.reset();
  }, [sim, spawn, loop]);

  useEffect(() => {
    if (!race) return;
    // Any key skips the intro sweep (§9.1).
    const skip = () => {
      if (!isSimPaused()) race.skipIntro();
    };
    window.addEventListener('keydown', skip);
    return () => window.removeEventListener('keydown', skip);
  }, [race]);

  useFrame((_, dt) => {
    if (isSimPaused()) return;
    const car = sim.car;

    const alpha = loop.advance(dt * (race?.timeScale ?? 1), (h) => {
      const inp = input.update(h, sim.cfg.steerSmoothTime);
      if (race) {
        race.beforeCarStep(inp, h);
        if (race.locked) return; // frozen on the grid during intro/countdown
        if (race.pendingPerfectStart) {
          race.pendingPerfectStart = false;
          sim.boost(RACE_CONFIG.perfectStartTier);
        }
        if (race.phase === 'finished') {
          // Hands off: coast through the finish slow-mo.
          inp.throttle = 0;
          inp.steer = 0;
          inp.drift = false;
          inp.nitro = false;
          inp.reset = false;
        }
      }
      if (inp.reset) {
        const p = race ? race.resetPose() : spawn;
        sim.reset(p.x, p.z, p.heading);
      }
      sim.step(inp, h);
      onStep?.(h);
      race?.afterCarStep(car, h);
    });

    // Interpolated pose for rendering / camera / VFX (incl. 2.5D height + pitch).
    applyCarPose(group.current, pose, car, sim.heights, alpha, dt, smoothing);
    pose.boosting = sim.drift.boostTime > 0 || sim.nitro.active;
    pose.alpha = alpha;

    const wheelSteer = -input.state.steer * MAX_WHEEL_STEER;
    for (const p of rig.steerPivots) p.rotation.y = wheelSteer;
    const spin = (car.speedForward * dt) / WHEEL_RADIUS;
    for (const w of rig.spinners) w.rotation.x += spin;
    if (rig.body) {
      // Lean away from the slide (toy suspension feel).
      const roll = clamp(car.speedLateral * BODY_ROLL_PER_MS, -MAX_BODY_ROLL, MAX_BODY_ROLL);
      rig.body.rotation.z += (roll - rig.body.rotation.z) * Math.min(1, dt * 10);
    }

    const t = telemetry;
    t.speed = car.speedForward;
    t.throttle = input.state.throttle;
    t.lateral = Math.abs(car.speedLateral);
    t.nitro = sim.nitro.amount;
    t.nitroMax = sim.cfg.nitroMax;
    t.nitroActive = sim.nitro.active;
    t.drifting = sim.drift.drifting;
    t.driftCharge = sim.drift.charge;
    t.driftMaxCharge = sim.cfg.driftTiers.at(-1)?.minCharge ?? 1;
    t.driftTier = sim.drift.tier;
    t.boostTier = sim.drift.boostTier;
    t.boostTime = sim.drift.boostTime;
    t.driftScore = sim.drift.score;
  }, SIM_FRAME_PRIORITY);

  return (
    <group ref={group}>
      <CarVisual carId={carId} rig={rig} outlines={outlines} />
    </group>
  );
}
