import { Stats } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { lazy, Suspense } from 'react';
import { CAMERA_CONFIG } from './config/camera.config';
import { QUALITY_PRESETS } from './config/graphics.config';
import { GameScene } from './scene/GameScene';
import { useSettingsStore } from './stores/settingsStore';
import { UIRoot } from './ui/UIRoot';

// Loaded on demand: post-processing code only ships when bloom is enabled.
const Effects = lazy(() => import('./scene/Effects'));

/** Fades out the HTML boot splash once the first 3D frame is on screen. */
function hideBootSplash(): void {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const boot = document.getElementById('boot');
      if (!boot) return;
      boot.classList.add('done');
      window.setTimeout(() => boot.remove(), 600);
    }),
  );
}

export default function App() {
  const qualityLevel = useSettingsStore((s) => s.quality);
  const showFps = useSettingsStore((s) => s.showFps);
  const postProcessing = useSettingsStore((s) => s.postProcessing);
  const quality = QUALITY_PRESETS[qualityLevel];
  return (
    <>
      {/* Antialiasing/shadow mode need a fresh WebGL context, so the canvas
          remounts when the quality preset changes. */}
      <Canvas
        key={qualityLevel}
        className="game-canvas"
        dpr={quality.dpr}
        // `flat` = no tone mapping, so toon colors match the palette exactly.
        flat
        shadows={quality.shadowMapSize > 0 ? 'percentage' : false}
        gl={{ antialias: quality.antialias, powerPreference: 'high-performance' }}
        camera={{ fov: CAMERA_CONFIG.fov, near: 0.5, far: 500 }}
        onCreated={hideBootSplash}
      >
        <GameScene />
        {postProcessing && qualityLevel !== 'low' && (
          <Suspense fallback={null}>
            <Effects samples={qualityLevel === 'high' ? 4 : 2} />
          </Suspense>
        )}
        {showFps && <Stats />}
      </Canvas>
      <UIRoot />
    </>
  );
}
