import { AUDIO_CONFIG as A } from '../config/audio.config';

// Placeholder audio (§11), fully synthesized with Web Audio: no asset files.
// The context is created on the first user gesture (autoplay rules).

type MusicMode = 'lobby' | 'race' | null;

export interface CarAudioState {
  /** |forward speed| / max speed, 0..~1.6 with boosts. */
  speed01: number;
  throttle: number;
  /** |lateral speed| m/s. */
  lateral: number;
  drifting: boolean;
  nitro: boolean;
}

/** Chord roots (semitones from C) for a I–V–vi–IV loop. */
const PROGRESSION = [0, 7, 9, 5];
const ARP = [0, 4, 7, 12, 7, 4, 7, 12];
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private noise!: AudioBuffer;
  private volumes = { master: 0.8, sfx: 0.8, music: 0.5 };
  private musicDuck = 1;

  // continuous car voices
  private engOsc1?: OscillatorNode;
  private engOsc2?: OscillatorNode;
  private engGain?: GainNode;
  private engFilter?: BiquadFilterNode;
  private screechGain?: GainNode;
  private nitroGain?: GainNode;
  private carActive = false;

  // music sequencer
  private musicMode: MusicMode = null;
  private nextNoteTime = 0;
  private step = 0;
  private timer: number | null = null;

  get ready(): boolean {
    return this.ctx !== null;
  }

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.sfx = ctx.createGain();
    this.music = ctx.createGain();
    this.sfx.connect(this.master);
    this.music.connect(this.master);
    this.master.connect(ctx.destination);
    this.noise = this.makeNoise(ctx);
    this.applyVolumes();
    this.buildCarVoices();
    if (this.musicMode) this.startSequencer();
  }

  setVolumes(master: number, sfx: number, music: number): void {
    this.volumes = { master, sfx, music };
    this.applyVolumes();
  }

  /** Lowers music while menus are open. */
  setMenuOpen(open: boolean): void {
    this.musicDuck = open ? A.menuMusicDuck : 1;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.master, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.volumes.sfx, t, 0.05);
    this.music.gain.setTargetAtTime(this.volumes.music * A.music.gain * this.musicDuck, t, 0.1);
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private loopNoise(): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.start();
    return src;
  }

  // ---------------------------------------------------------------- car voices

  private buildCarVoices(): void {
    const ctx = this.ctx!;
    // Engine: buzzy saw + detuned square through a lowpass = toy motor.
    this.engOsc1 = ctx.createOscillator();
    this.engOsc1.type = 'sawtooth';
    this.engOsc2 = ctx.createOscillator();
    this.engOsc2.type = 'square';
    this.engOsc2.detune.value = 9;
    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass';
    this.engFilter.frequency.value = 900;
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0;
    this.engOsc1.connect(this.engFilter);
    this.engOsc2.connect(this.engFilter);
    this.engFilter.connect(this.engGain).connect(this.sfx);
    this.engOsc1.start();
    this.engOsc2.start();

    // Tire screech: band-passed noise.
    const sq = ctx.createBiquadFilter();
    sq.type = 'bandpass';
    sq.frequency.value = A.screech.bandHz;
    sq.Q.value = A.screech.q;
    this.screechGain = ctx.createGain();
    this.screechGain.gain.value = 0;
    this.loopNoise().connect(sq).connect(this.screechGain).connect(this.sfx);

    // Nitro hiss: high-passed noise.
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2500;
    this.nitroGain = ctx.createGain();
    this.nitroGain.gain.value = 0;
    this.loopNoise().connect(hp).connect(this.nitroGain).connect(this.sfx);
  }

  /** Engine + screech + nitro follow the player car. Call every frame. */
  updateCar(s: CarAudioState): void {
    if (!this.ctx || !this.engGain) return;
    const t = this.ctx.currentTime;
    const k = A.engine.smoothing;
    const on = this.carActive ? 1 : 0;
    const sp = Math.min(1.6, s.speed01);
    const hz = A.engine.idleHz + (A.engine.topHz - A.engine.idleHz) * sp;
    this.engOsc1!.frequency.setTargetAtTime(hz, t, k);
    this.engOsc2!.frequency.setTargetAtTime(hz * 0.5, t, k);
    this.engFilter!.frequency.setTargetAtTime(500 + 1400 * sp + 600 * s.throttle, t, k);
    this.engGain.gain.setTargetAtTime(
      on * (A.engine.idleGain + A.engine.throttleGain * s.throttle),
      t,
      k,
    );
    const screech = s.drifting ? Math.min(A.screech.maxGain, s.lateral * A.screech.gainPerMs) : 0;
    this.screechGain!.gain.setTargetAtTime(on * screech, t, 0.05);
    this.nitroGain!.gain.setTargetAtTime(on * (s.nitro ? A.nitro.gain : 0), t, 0.05);
  }

  /** Car voices are silent on the title screen and while paused. */
  setCarActive(active: boolean): void {
    this.carActive = active;
    if (!active)
      this.updateCar({ speed01: 0, throttle: 0, lateral: 0, drifting: false, nitro: false });
  }

  // ---------------------------------------------------------------- one-shots

  private tone(
    freq: number,
    dur: number,
    opts: {
      type?: OscillatorType;
      gain?: number;
      delay?: number;
      slideTo?: number;
      bus?: GainNode;
    } = {},
  ): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const o = ctx.createOscillator();
    o.type = opts.type ?? 'triangle';
    o.frequency.setValueAtTime(freq, t);
    if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(opts.bus ?? this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noiseBurst(dur: number, fromHz: number, toHz: number, gain: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(fromHz, t);
    f.frequency.exponentialRampToValueAtTime(toHz, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  /** Drift tier reached: rising chime, higher per tier (§10.8). */
  tierUp(tier: number): void {
    const base = 660 * 2 ** (((tier - 1) * 4) / 12);
    this.tone(base, 0.18, { gain: 0.14 });
    this.tone(base * 1.5, 0.22, { gain: 0.12, delay: 0.07 });
  }

  boost(): void {
    this.noiseBurst(0.45, 400, 3200, 0.35);
  }

  nitroStart(): void {
    this.noiseBurst(0.3, 1200, 5000, 0.2);
  }

  /** Soft plastic bonk, louder for harder hits. */
  bonk(impact: number): void {
    if (impact < A.bonk.minImpact) return;
    const g = Math.min(A.bonk.maxGain, impact * A.bonk.gainPerMs);
    this.tone(150, 0.16, { type: 'sine', gain: g, slideTo: 60 });
    this.tone(420, 0.06, { type: 'square', gain: g * 0.25 });
  }

  /** Landing thump after a jump: deeper and louder for bigger drops. */
  land(impact: number): void {
    const g = Math.min(0.4, impact * 0.025);
    this.tone(110, 0.22, { type: 'sine', gain: g, slideTo: 45 });
    this.noiseBurst(0.18, 900, 300, g * 0.5);
  }

  coneHit(): void {
    this.tone(520, 0.08, { type: 'square', gain: 0.05, slideTo: 300 });
  }

  countdownTick(): void {
    this.tone(660, 0.14, { type: 'square', gain: 0.12 });
  }

  go(): void {
    this.tone(1320, 0.4, { type: 'square', gain: 0.14 });
    this.tone(990, 0.4, { type: 'triangle', gain: 0.1 });
  }

  lap(): void {
    [784, 988, 1175].forEach((f, i) => this.tone(f, 0.18, { gain: 0.12, delay: i * 0.08 }));
  }

  finish(record: boolean): void {
    const notes = record ? [784, 988, 1175, 1568, 1175, 1568] : [784, 988, 1175, 1568];
    notes.forEach((f, i) => this.tone(f, 0.25, { gain: 0.13, delay: i * 0.1 }));
  }

  uiHover(): void {
    this.tone(1400, 0.04, { type: 'sine', gain: 0.03 });
  }

  uiClick(): void {
    this.tone(880, 0.07, { type: 'square', gain: 0.06, slideTo: 1200 });
  }

  uiPop(open: boolean): void {
    this.tone(open ? 500 : 700, 0.1, { type: 'sine', gain: 0.08, slideTo: open ? 900 : 380 });
  }

  // ---------------------------------------------------------------- music

  setMusic(mode: MusicMode): void {
    if (mode === this.musicMode) return;
    this.musicMode = mode;
    this.stopSequencer();
    if (mode && this.ctx) this.startSequencer();
  }

  private startSequencer(): void {
    if (!this.ctx) return;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  private stopSequencer(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  /** Lookahead scheduler: queues notes ~120 ms ahead on the audio clock. */
  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicMode) return;
    const bpm = this.musicMode === 'race' ? A.music.raceBpm : A.music.lobbyBpm;
    const eighth = 60 / bpm / 2;
    while (this.nextNoteTime < ctx.currentTime + 0.12) {
      const bar = Math.floor(this.step / 8) % PROGRESSION.length;
      const root = 48 + PROGRESSION[bar]!; // C3-ish
      const i = this.step % 8;
      const t = this.nextNoteTime;
      // bass on beats
      if (i % 2 === 0) this.note(midi(root - 12), eighth * 1.6, 'triangle', 0.5, t);
      // bright arpeggio
      this.note(midi(root + 12 + ARP[i]!), eighth * 0.9, 'square', 0.12, t);
      // hat
      if (this.musicMode === 'race' || i % 2 === 1) this.hat(t);
      this.nextNoteTime += eighth;
      this.step++;
    }
  }

  private note(freq: number, dur: number, type: OscillatorType, gain: number, t: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.music);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private hat(t: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    src.connect(f).connect(g).connect(this.music);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.05);
  }
}

/** App-wide audio singleton. */
export const audio = new AudioManager();
