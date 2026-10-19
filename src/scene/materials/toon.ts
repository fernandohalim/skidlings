import { DataTexture, MeshToonMaterial, NearestFilter, RedFormat } from 'three';
import { TOON_CONFIG } from '../../config/graphics.config';

let gradientMap: DataTexture | null = null;

/** Shared hard-banded ramp for every MeshToonMaterial (anime cel look). */
export function getToonGradient(): DataTexture {
  if (gradientMap) return gradientMap;
  const bands = TOON_CONFIG.bands;
  const data = new Uint8Array(bands.length);
  bands.forEach((b, i) => (data[i] = Math.round(b * 255)));
  gradientMap = new DataTexture(data, bands.length, 1, RedFormat);
  gradientMap.minFilter = NearestFilter;
  gradientMap.magFilter = NearestFilter;
  gradientMap.generateMipmaps = false;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

const materialCache = new Map<string, MeshToonMaterial>();

/** One shared toon material per color, so cars/props reuse GPU programs and state. */
export function getToonMaterial(color: string): MeshToonMaterial {
  let m = materialCache.get(color);
  if (!m) {
    m = new MeshToonMaterial({ color, gradientMap: getToonGradient() });
    materialCache.set(color, m);
  }
  return m;
}

let vertexColorMaterial: MeshToonMaterial | null = null;

/** Shared toon material that takes its colors from the geometry (merged cars). */
export function getToonVertexColorMaterial(): MeshToonMaterial {
  vertexColorMaterial ??= new MeshToonMaterial({
    color: '#FFFFFF',
    vertexColors: true,
    gradientMap: getToonGradient(),
  });
  return vertexColorMaterial;
}
