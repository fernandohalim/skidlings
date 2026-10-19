import { useRef, type ReactNode } from 'react';
import styles from './components.module.css';
import { useMenuNav } from './useMenuNav';

interface Props {
  title?: string;
  children: ReactNode;
  /** Extra class on the panel (width tweaks). */
  className?: string;
  label?: string;
}

/**
 * Panel on a plum blurred backdrop (§10.4). Esc handling is global
 * (KeyboardShortcuts) so nested modals close in the right order.
 */
export function Modal({ title, children, className, label }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  useMenuNav(panel);
  return (
    <div className={styles.backdrop}>
      <div
        ref={panel}
        className={`${styles.panel} ${className ?? ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? title}
      >
        {title && <h2 className={styles.panelTitle}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}
