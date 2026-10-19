import type { AI_CONFIG, BotProfile } from '../../config/ai.config';
import type { CarConfig } from '../../config/car.config';
import { CarSimulation } from '../car/CarSimulation';
import { createInputState, type InputState } from '../input/types';
import type { CollisionWorld } from '../physics/World';
import { LapTracker } from '../race/LapTracker';
import type { TrackData } from '../track/TrackDefinition';
import { clamp, wrapAngle } from '../utils/math';

type AiConfig = typeof AI_CONFIG;

/**
 * Spline-following AI (§9.4): steers toward a look-ahead point on a racing
 * line (lane offset + gentle sway), drifts tight corners, brakes for hairpins
 * and uses nitro on straights. Produces the same InputState a player would.
 */
export class AIDriver {
  readonly input: InputState = createInputState();

  constructor(
    readonly track: TrackData,
    readonly profile: BotProfile,
    readonly cfg: AiConfig,
  ) {}

  /** `cursor` = nearest centerline sample (from the bot's LapTracker). */
  decide(sim: CarSimulation, cursor: number): InputState {
    const t = this.track;
    const c = sim.car;
    const n = t.sampleCount;
    const a = this.cfg;
    const speed = Math.hypot(c.vx, c.vz);

    // Target point ahead on the racing line.
    const ahead = Math.round(a.lookAheadBase + speed * a.lookAheadPerSpeed);
    const i = (cursor + ahead) % n;
    const half = t.def.roadWidth / 2 - 2;
    const sway =
      Math.sin((t.dist[i]! / a.laneSwayLength) * Math.PI * 2 + this.profile.lane) * a.laneSway;
    const lane = clamp(this.profile.lane + sway, -half, half);
    const tx = t.px[i]! - t.tz[i]! * lane;
    const tz = t.pz[i]! + t.tx[i]! * lane;
    const want = Math.atan2(tx - c.x, tz - c.z);
    const err = wrapAngle(want - c.heading);

    // How hard does the track bend over the next stretch?
    const j = (cursor + a.cornerWindow) % n;
    const turn = Math.abs(
      wrapAngle(Math.atan2(t.tx[j]!, t.tz[j]!) - Math.atan2(t.tx[cursor]!, t.tz[cursor]!)),
    );

    const inp = this.input;
    inp.steer = clamp(-err * a.steerGain, -1, 1);
    inp.throttle = 1;
    inp.brake = 0;
    inp.reset = false;
    const driftAngle = a.driftCornerAngle / Math.max(0.3, this.profile.driftEagerness);
    inp.drift = turn > driftAngle && speed > sim.cfg.minDriftSpeed + 2;
    if (turn > a.brakeCornerAngle && speed > a.brakeAboveSpeed) {
      inp.throttle = 0;
      inp.brake = 1;
    }
    inp.nitro = turn < 0.15 && Math.abs(err) < 0.1 && sim.nitro.amount > a.nitroMin;
    return inp;
  }
}

/** One AI racer: its own sim, driver and lap tracker. */
export class Bot {
  readonly sim: CarSimulation;
  readonly driver: AIDriver;
  readonly tracker: LapTracker;
  private readonly baseMaxSpeed: number;

  constructor(
    readonly id: string,
    readonly profile: BotProfile,
    cfg: CarConfig,
    track: TrackData,
    world: CollisionWorld,
    laps: number,
    aiCfg: AiConfig,
    startNitro: number,
  ) {
    // Own config copy: rubber-banding edits maxSpeed per step.
    const own = { ...cfg, maxSpeed: cfg.maxSpeed * profile.pace };
    this.baseMaxSpeed = own.maxSpeed;
    this.sim = new CarSimulation(own, world, 'race', startNitro);
    this.sim.heights = track.heightField;
    this.driver = new AIDriver(track, profile, aiCfg);
    this.tracker = new LapTracker(track, laps);
  }

  reset(x: number, z: number, heading: number, startSample: number, nitro: number): void {
    this.sim.resetForRace(x, z, heading, nitro);
    this.tracker.reset(startSample);
    this.sim.cfg.maxSpeed = this.baseMaxSpeed;
  }

  /**
   * Rubber band (§9.4): `gap` = player progress − bot progress, in checkpoints.
   * Behind → up to rubberBandMax, ahead → down to rubberBandMin.
   */
  setRubberBand(gap: number, aiCfg: AiConfig): void {
    const t = clamp(gap / aiCfg.rubberBandGap, -1, 1);
    const f = t >= 0 ? 1 + t * (aiCfg.rubberBandMax - 1) : 1 + t * (1 - aiCfg.rubberBandMin);
    this.sim.cfg.maxSpeed = this.baseMaxSpeed * f;
  }

  /** One fixed step. Returns true on the step the bot crosses the finish. */
  step(dt: number, raceTime: number): boolean {
    const inp = this.tracker.finished
      ? coast(this.driver.decide(this.sim, this.tracker.cursor))
      : this.driver.decide(this.sim, this.tracker.cursor);
    this.sim.step(inp, dt);
    return this.tracker.update(this.sim.car, raceTime);
  }
}

/** After finishing, bots cruise gently instead of racing on. */
function coast(inp: InputState): InputState {
  inp.throttle = 0.35;
  inp.nitro = false;
  inp.drift = false;
  return inp;
}
