import { useEffect, type RefObject } from 'react';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard menu navigation (§10.9): arrow keys move focus between the
 * focusable elements in `container` (Left/Right are left to range sliders),
 * and the first element is focused on open unless something inside already is.
 */
export function useMenuNav(container: RefObject<HTMLElement | null>, autoFocus = true) {
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    if (autoFocus && !root.contains(document.activeElement)) {
      const preferred = root.querySelector<HTMLElement>('[data-autofocus]');
      (preferred ?? root.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      const prev = e.key === 'ArrowUp' || e.key === 'ArrowLeft';
      const next = e.key === 'ArrowDown' || e.key === 'ArrowRight';
      if (!prev && !next) return;
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement &&
        target.type === 'range' &&
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
      ) {
        return; // let the slider move
      }
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      const j = i < 0 ? 0 : (i + (next ? 1 : -1) + items.length) % items.length;
      items[j]!.focus();
      e.preventDefault();
    };
    root.addEventListener('keydown', onKey);
    return () => root.removeEventListener('keydown', onKey);
  }, [container, autoFocus]);
}
