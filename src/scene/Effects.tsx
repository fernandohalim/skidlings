import { Bloom, EffectComposer, HueSaturation, Vignette } from '@react-three/postprocessing';
import { GRAPHICS_FX } from '../config/graphics.config';

/**
 * Optional post-processing (§3): subtle bloom on nitro flames and drift
 * sparks only. Those use colors above 1.0; the threshold sits just above 1 so
 * white toon surfaces never glow. Lazy-loaded so the library is only
 * downloaded when the setting is on.
 */
export default function Effects({ samples }: { samples: number }) {
  // The composer renders off-screen, so canvas antialiasing no longer applies: use MSAA here.
  return (
    <EffectComposer multisampling={samples}>
      <Bloom
        mipmapBlur
        intensity={GRAPHICS_FX.bloomIntensity}
        luminanceThreshold={GRAPHICS_FX.bloomThreshold}
        luminanceSmoothing={0}
      />
      <HueSaturation saturation={GRAPHICS_FX.saturation} />
      <Vignette offset={GRAPHICS_FX.vignetteOffset} darkness={GRAPHICS_FX.vignetteDarkness} />
    </EffectComposer>
  );
}
