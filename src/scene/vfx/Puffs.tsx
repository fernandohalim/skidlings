import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  Color,
  DynamicDrawUsage,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  ShaderMaterial,
  type InstancedMesh,
} from 'three';

// General-purpose burst particles (landing dust, wall-scrape sparks, boost-pad
// flashes). Gameplay code queues bursts via `emitPuffs`; one instanced mesh
// animates everything on the GPU (ballistic motion, growth, fade).

const MAX = 400;

interface Burst {
  x: number;
  y: number;
  z: number;
  count: number;
  color: Color;
  /** Horizontal spray speed (m/s). */
  spread: number;
  /** Upward speed (m/s). */
  up: number;
  /** Particle size (m) and lifetime (s). */
  size: number;
  life: number;
  /** >0: bright additive-looking sparks (colors pushed above 1 for bloom). */
  glow: number;
}

const queue: Burst[] = [];
const tmpColor = new Color();

export function emitPuffs(
  x: number,
  y: number,
  z: number,
  opts: Partial<Omit<Burst, 'x' | 'y' | 'z' | 'color'>> & { color?: string } = {},
): void {
  if (queue.length > 64) return;
  queue.push({
    x,
    y,
    z,
    count: opts.count ?? 12,
    color: new Color(opts.color ?? '#F2E6CC'),
    spread: opts.spread ?? 4,
    up: opts.up ?? 2,
    size: opts.size ?? 0.9,
    life: opts.life ?? 0.7,
    glow: opts.glow ?? 0,
  });
}

const vert = /* glsl */ `
  attribute float aBirth;
  attribute float aLife;
  attribute float aSize;
  attribute vec3 aOrigin;
  attribute vec3 aVel;
  attribute vec3 aColor;
  uniform float uTime;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float age = uTime - aBirth;
    float t = clamp(age / aLife, 0.0, 1.0);
    vAlpha = (age < 0.0 || t >= 1.0) ? 0.0 : (1.0 - t);
    vColor = aColor;
    vec3 p = aOrigin + aVel * age * (1.0 - 0.45 * t);
    p.y += -4.0 * age * age * 0.5;
    float s = aSize * mix(0.5, 1.4, sqrt(t));
    gl_Position = projectionMatrix * viewMatrix * vec4(p + position * s, 1.0);
  }
`;
const frag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    if (vAlpha <= 0.01) discard;
    gl_FragColor = vec4(vColor, vAlpha * 0.85);
  }
`;

export function Puffs() {
  const mesh = useRef<InstancedMesh>(null);
  const { geometry, material, a } = useMemo(() => {
    const g = new IcosahedronGeometry(0.5, 1);
    const mk = (n: number, fill = 0) => {
      const attr = new InstancedBufferAttribute(new Float32Array(MAX * n).fill(fill), n);
      attr.setUsage(DynamicDrawUsage);
      return attr;
    };
    const a = {
      birth: mk(1, -1e6),
      life: mk(1, 1),
      size: mk(1, 1),
      origin: mk(3),
      vel: mk(3),
      color: mk(3),
    };
    g.setAttribute('aBirth', a.birth);
    g.setAttribute('aLife', a.life);
    g.setAttribute('aSize', a.size);
    g.setAttribute('aOrigin', a.origin);
    g.setAttribute('aVel', a.vel);
    g.setAttribute('aColor', a.color);
    const m = new ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    return { geometry: g, material: m, a };
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      queue.length = 0;
    },
    [geometry, material],
  );
  const st = useRef({ time: 0, next: 0, seed: 7 });

  useFrame((_, dt) => {
    const s = st.current;
    s.time += dt;
    material.uniforms.uTime!.value = s.time;
    if (queue.length === 0) return;
    const rnd = () => {
      s.seed = (s.seed * 16807) % 2147483647;
      return s.seed / 2147483647;
    };
    for (const b of queue) {
      for (let k = 0; k < b.count; k++) {
        const i = s.next;
        const ang = rnd() * Math.PI * 2;
        const sp = b.spread * (0.5 + rnd() * 0.5);
        a.origin.setXYZ(i, b.x, b.y, b.z);
        a.vel.setXYZ(i, Math.cos(ang) * sp, b.up * (0.6 + rnd() * 0.8), Math.sin(ang) * sp);
        tmpColor.copy(b.color).multiplyScalar(b.glow > 0 ? 1 + b.glow : 1);
        a.color.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
        a.size.setX(i, b.size * (0.7 + rnd() * 0.6));
        a.life.setX(i, b.life * (0.7 + rnd() * 0.6));
        a.birth.setX(i, s.time);
        s.next = (s.next + 1) % MAX;
      }
    }
    queue.length = 0;
    for (const k of Object.values(a)) k.needsUpdate = true;
  }, -1);

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, MAX]}
      frustumCulled={false}
      renderOrder={3}
    />
  );
}
