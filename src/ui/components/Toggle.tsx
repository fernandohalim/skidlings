import styles from './components.module.css';

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}

/** Pill switch with a chunky thumb (§10.4). Space/Enter toggle it. */
export function Toggle({ checked, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={styles.toggle}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.toggleThumb} />
    </button>
  );
}
