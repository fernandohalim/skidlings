import styles from './components.module.css';

const NAMES: Record<string, string> = {
  Space: 'Space',
  ShiftLeft: 'Shift',
  ShiftRight: 'R Shift',
  ControlLeft: 'Ctrl',
  ControlRight: 'R Ctrl',
  AltLeft: 'Alt',
  AltRight: 'R Alt',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Escape: 'Esc',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: '⌫',
  CapsLock: 'Caps',
};

/** Human label for a KeyboardEvent.code ("KeyW" → "W", "Digit1" → "1"). */
export function keyLabel(code: string): string {
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

/** A keyboard key drawn as a small toy keycap (§10.4). */
export function KeyCap({ code, label }: { code?: string; label?: string }) {
  const text = label ?? (code ? keyLabel(code) : '');
  const wide = text.length > 2;
  return <kbd className={`${styles.keycap} ${wide ? styles.keycapWide : ''}`}>{text}</kbd>;
}
