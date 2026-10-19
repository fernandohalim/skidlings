import { useEffect, useMemo } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  MeshToonMaterial,
  NearestFilter,
  RGBAFormat,
  RepeatWrapping,
} from 'three';
import type { RibbonGeometry, TrackData } from '../../engine/track/TrackDefinition';
import { getToonGradient, getToonMaterial } from '../materials/toon';

function toGeometry(r: RibbonGeometry): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(r.positions, 3));
  g.setAttribute('normal', new BufferAttribute(r.normals, 3));
  if (r.colors) g.setAttribute('color', new BufferAttribute(r.colors, 3));
  g.setIndex(new BufferAttribute(r.indices, 1));
  g.computeBoundingSphere();
  return g;
}

function checkerTexture(): DataTexture {
  const w = 2;
  const data = new Uint8Array(w * w * 4);
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const v = (x + y) % 2 === 0 ? 255 : 43;
      data.set([v, v, v === 43 ? 64 : 255, 255], (y * w + x) * 4);
    }
  }
  const t = new DataTexture(data, w, w, RGBAFormat);
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

/** Road ribbon, striped curbs and the checkered start line. 3 draw calls. */
export function TrackMesh({ track }: { track: TrackData }) {
  const { road, curbs, curbMat, startMat } = useMemo(() => {
    const tex = checkerTexture();
    tex.repeat.set(track.def.roadWidth / 1.4, 1);
    return {
      road: toGeometry(track.road),
      curbs: toGeometry(track.curbs),
      curbMat: new MeshToonMaterial({ vertexColors: true, gradientMap: getToonGradient() }),
      startMat: new MeshToonMaterial({ map: tex, gradientMap: getToonGradient() }),
    };
  }, [track]);

  useEffect(
    () => () => {
      road.dispose();
      curbs.dispose();
      curbMat.dispose();
      startMat.map?.dispose();
      startMat.dispose();
    },
    [road, curbs, curbMat, startMat],
  );

  const heading = Math.atan2(track.tx[0]!, track.tz[0]!);
  return (
    <>
      <mesh geometry={road} material={getToonMaterial(track.def.theme.road)} receiveShadow />
      <mesh geometry={curbs} material={curbMat} receiveShadow />
      <mesh
        position={[track.px[0]!, track.h[0]! + 0.05, track.pz[0]!]}
        rotation={[-Math.PI / 2, 0, heading]}
        material={startMat}
        receiveShadow
      >
        <planeGeometry args={[track.def.roadWidth, 2.8]} />
      </mesh>
    </>
  );
}
