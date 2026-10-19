import { useControls } from 'leva';
import { CAMERA_CONFIG } from '../config/camera.config';
import type { CarConfig, CarId } from '../config/car.config';

// Dev-only live tuning (§12 M1). Lazy-loaded from GameScene so leva never ships
// in production builds. Car choice lives in the lobby Garage now. Edits mutate the live config objects in place; the
// engine reads them every step, so changes apply instantly with no re-render.

type NumericRecord = Record<string, unknown>;

interface NumberControl {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

function numericSchema(target: NumericRecord): Record<string, NumberControl> {
  const schema: Record<string, NumberControl> = {};
  for (const [key, value] of Object.entries(target)) {
    if (typeof value !== 'number') continue;
    const max = value === 0 ? 1 : Math.abs(value) * 3;
    schema[key] = {
      value,
      min: 0,
      max,
      step: max > 10 ? 0.1 : 0.01,
      onChange: (v: number) => {
        target[key] = v;
      },
    };
  }
  return schema;
}

interface DebugPanelProps {
  carId: CarId;
  carConfig: CarConfig;
}

export default function DebugPanel({ carId, carConfig }: DebugPanelProps) {
  // Folder name includes the car so each preset keeps its own slider state.
  useControls(`Car tuning (${carId})`, numericSchema(carConfig as unknown as NumericRecord), {
    collapsed: true,
  });
  useControls('Camera', numericSchema(CAMERA_CONFIG as unknown as NumericRecord), {
    collapsed: true,
  });
  return null;
}
