import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { audio } from '../../audio/AudioManager';
import type { CarSimulation } from '../../engine/car/CarSimulation';
import { isSimPaused } from '../../stores/gameStore';
import { telemetry } from '../../stores/telemetry';
import { addFovKick, addShake } from '../sim/fx';
import { emitPuffs } from '../vfx/Puffs';

/**
 * Turns player-car state changes into feedback (§10.8, §11): engine/screech
 * audio every frame, plus chimes, whooshes, bonks, shake and FOV kicks on edges.
 */
export function CarFeedback({ sim }: { sim: CarSimulation }) {
  const last = useRef({ tier: 0, boostTime: 0, nitro: false });
  const audioState = useRef({ speed01: 0, throttle: 0, lateral: 0, drifting: false, nitro: false });

  useEffect(() => {
    audio.setCarActive(true);
    return () => audio.setCarActive(false);
  }, []);

  useFrame(() => {
    const paused = isSimPaused();
    audio.setCarActive(!paused);
    if (paused) return;
    const d = sim.drift;
    const n = sim.nitro;
    const l = last.current;

    const a = audioState.current; // reused: no per-frame allocation
    a.speed01 = Math.abs(sim.car.speedForward) / sim.cfg.maxSpeed;
    a.throttle = telemetry.throttle;
    a.lateral = telemetry.lateral;
    a.drifting = d.drifting;
    a.nitro = n.active;
    audio.updateCar(a);

    if (d.drifting && d.tier > l.tier) audio.tierUp(d.tier);
    if (d.boostTime > l.boostTime + 0.05) {
      // a new mini-boost fired
      audio.boost();
      addShake(0.25 + d.boostTier * 0.1);
      addFovKick(4 + d.boostTier * 2);
      const c = sim.car;
      emitPuffs(c.x - Math.sin(c.heading) * 2.2, c.y + 0.5, c.z - Math.cos(c.heading) * 2.2, {
        count: 10,
        color: '#B88CFF',
        glow: 1.2,
        spread: 3,
        up: 1.5,
        size: 0.7,
        life: 0.5,
      });
    }
    if (n.active && !l.nitro) {
      audio.nitroStart();
      addShake(0.2);
    }
    const impact = sim.consumeImpact();
    if (impact > 3) {
      audio.bonk(impact);
      addShake(Math.min(0.8, impact * 0.04));
      const c = sim.car;
      emitPuffs(c.x, c.y + 0.6, c.z, {
        count: Math.min(20, 6 + Math.round(impact)),
        color: '#FFB347',
        glow: 1.5,
        spread: 6,
        up: 3,
        size: 0.25,
        life: 0.4,
      });
    }
    const landing = sim.consumeLanding();
    if (landing > 0) {
      audio.land(landing);
      addShake(Math.min(0.9, landing * 0.06));
      const c = sim.car;
      emitPuffs(c.x, c.y + 0.2, c.z, { count: 16, spread: 6, up: 1.2, size: 1.1, life: 0.8 });
    }

    l.tier = d.drifting ? d.tier : 0;
    l.boostTime = d.boostTime;
    l.nitro = n.active;
  }, -1);

  return null;
}
