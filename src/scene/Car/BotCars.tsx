import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import type { Bot } from '../../engine/ai/AIDriver';
import { createCarRenderPose, type CarRenderPose } from '../sim/CarRenderPose';
import { emitPuffs } from '../vfx/Puffs';
import { SkidMarks } from '../vfx/SkidMarks';
import { TireSmoke } from '../vfx/TireSmoke';
import { applyCarPose, createPoseSmoothing } from './carPose';
import { CarVisual, createCarRig, WHEEL_RADIUS } from './CarVisual';

/**
 * Renders AI cars (M8). Their simulation runs inside the player's fixed-step
 * loop; this only interpolates with the same frame alpha (`playerPose.alpha`).
 */
export function BotCars({
  bots,
  playerPose,
  outlines,
}: {
  bots: Bot[];
  playerPose: CarRenderPose;
  outlines: boolean;
}) {
  return (
    <>
      {bots.map((b) => (
        <BotCar key={b.id} bot={b} playerPose={playerPose} outlines={outlines} />
      ))}
    </>
  );
}

function BotCar({
  bot,
  playerPose,
  outlines,
}: {
  bot: Bot;
  playerPose: CarRenderPose;
  outlines: boolean;
}) {
  const group = useRef<Group>(null);
  const rig = useMemo(() => createCarRig(), []);
  const pose = useMemo(() => createCarRenderPose(), []);
  const smoothing = useMemo(() => createPoseSmoothing(), []);

  useFrame((_, dt) => {
    const c = bot.sim.car;
    applyCarPose(group.current, pose, c, bot.sim.heights, playerPose.alpha, dt, smoothing);
    const landing = bot.sim.consumeLanding();
    if (landing > 0)
      emitPuffs(c.x, c.y + 0.2, c.z, { count: 10, spread: 5, up: 1, size: 1, life: 0.7 });
    const steer = bot.driver.input.steer;
    for (const p of rig.steerPivots) p.rotation.y = -steer * 0.45;
    for (const w of rig.spinners) w.rotation.x += (c.speedForward * dt) / WHEEL_RADIUS;
    if (rig.body) {
      const roll = Math.max(-0.12, Math.min(0.12, c.speedLateral * 0.012));
      rig.body.rotation.z += (roll - rig.body.rotation.z) * Math.min(1, dt * 10);
    }
  }, -2);

  return (
    <>
      <group ref={group}>
        <CarVisual
          carId={bot.profile.carId}
          color={bot.profile.color}
          rig={rig}
          outlines={outlines}
        />
      </group>
      <SkidMarks sim={bot.sim} pose={pose} />
      <TireSmoke sim={bot.sim} pose={pose} />
    </>
  );
}
