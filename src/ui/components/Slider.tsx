import type { CSSProperties } from 'react';
import styles from './components.module.css';

interface Props {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  label: string;
  format?: (v: number) => string;
}

/** Pill range slider, filled in the primary color up to the thumb (§10.4). */
export function Slider({ value, min, max, step, onChange, label, format }: Props) {
  const fill = `${((value - min) / (max - min)) * 100}%`;
  return (
    <input
      type="range"
      className={styles.slider}
      style={{ '--fill': fill } as CSSProperties}
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={label}
      aria-valuetext={format ? format(value) : undefined}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}
