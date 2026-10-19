import { useEffect, useMemo } from 'react';
import { CanvasTexture, LinearFilter, SRGBColorSpace, SpriteMaterial } from 'three';

const INK = '#2B2340';
const W = 512;
const H = 128;

/** Draws a toy pill label (white, ink outline, colored underline) into a canvas. */
function draw(canvas: HTMLCanvasElement, text: string, color: string): void {
  const g = canvas.getContext('2d');
  if (!g) return;
  g.clearRect(0, 0, W, H);
  g.font = `700 54px Fredoka, "Baloo 2", system-ui, sans-serif`;
  const tw = Math.min(W - 60, g.measureText(text).width + 64);
  const x = (W - tw) / 2;
  const y = 14;
  const h = 86;
  const r = h / 2;
  const pill = (dy: number) => {
    g.beginPath();
    g.roundRect(x, y + dy, tw, h, r);
  };
  // toy shadow
  g.fillStyle = INK;
  pill(10);
  g.fill();
  // body + colored base stripe
  g.fillStyle = color;
  pill(4);
  g.fill();
  g.fillStyle = '#FFFFFF';
  pill(-2);
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = INK;
  pill(-2);
  g.stroke();
  g.fillStyle = INK;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, W / 2, y + h / 2 + 1);
}

/**
 * Floating billboard label (§10.6) rendered to a canvas texture: no DOM per
 * frame, no extra React roots. Redraws once the display font has loaded.
 */
export function PadLabel({
  text,
  color,
  scale = 7,
}: {
  text: string;
  color: string;
  scale?: number;
}) {
  const { material, canvas, texture } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    draw(canvas, text, color);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.generateMipmaps = false;
    const material = new SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    return { material, canvas, texture };
  }, [text, color]);

  useEffect(() => {
    let alive = true;
    void document.fonts?.ready.then(() => {
      if (!alive) return;
      draw(canvas, text, color);
      texture.needsUpdate = true;
    });
    return () => {
      alive = false;
      texture.dispose();
      material.dispose();
    };
  }, [canvas, texture, material, text, color]);

  return <sprite material={material} scale={[scale, (scale * H) / W, 1]} renderOrder={6} />;
}
