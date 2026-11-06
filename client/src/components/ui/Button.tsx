import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

// Quilr AI Design System — Button (components/core/Button).
// mint = primary "guardian" action · gradient = brand moment · outline/ghost = secondary · danger = destructive.

export type ButtonVariant = 'primary' | 'gradient' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', iconLeft, iconRight, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={['q-btn', `q-btn--${variant}`, `q-btn--${size}`, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
});

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: 'default' | 'danger';
}

export function IconButton({ label, tone = 'default', className, children, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={['q-icon-btn', tone === 'danger' ? 'q-icon-btn--danger' : '', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}
