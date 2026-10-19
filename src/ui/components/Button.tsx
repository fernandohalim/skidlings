import type { ButtonHTMLAttributes, Ref } from 'react';
import styles from './components.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'normal' | 'small';
  ref?: Ref<HTMLButtonElement>;
}

/** Chunky toy button (§10.4): hard shadow, lift on hover, press-in, accent focus ring. */
export function Button({ variant = 'primary', size = 'normal', className, ref, ...rest }: Props) {
  const cls = [
    styles.button,
    variant !== 'primary' ? styles[variant] : '',
    size === 'small' ? styles.small : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return <button ref={ref} type="button" className={cls} {...rest} />;
}
