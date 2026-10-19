import { describe, expect, it } from 'vitest';
import { CAR_PRESETS, type CarId } from '../../config/car.config';
import { getCarGeometry } from './carGeometry';

describe('merged car geometry', () => {
  for (const id of Object.keys(CAR_PRESETS) as CarId[]) {
    it(`${id}: merges into vertex-colored shell/detail/wheels and is cached`, () => {
      const g = getCarGeometry(id, '#FF5A3C');
      for (const geo of [g.shell, g.detail, g.wheelLeft, g.wheelRight]) {
        expect(geo.getAttribute('position').count).toBeGreaterThan(0);
        expect(geo.getAttribute('color').count).toBe(geo.getAttribute('position').count);
        expect(geo.getAttribute('normal')).toBeTruthy();
      }
      // Car sits on the ground: shell bottom near wheel-hub height, top under 2 m.
      g.shell.computeBoundingBox();
      expect(g.shell.boundingBox!.max.y).toBeLessThan(2);
      expect(getCarGeometry(id, '#FF5A3C')).toBe(g);
    });
  }
});
