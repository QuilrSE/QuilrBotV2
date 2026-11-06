import type { HTMLAttributes, ReactNode } from 'react';

// Quilr AI Design System — Badge (components/core/Badge).
// Compact uppercase status/category label; tones map to brand roles.

export type BadgeTone = 'neutral' | 'mint' | 'purple' | 'blue' | 'pink' | 'warn';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  variant?: 'soft' | 'solid' | 'outline';
  size?: 'sm' | 'md';
  dot?: boolean;
  /** Pulses the dot — reserved for live state (streaming). */
  live?: boolean;
  icon?: ReactNode;
}

export function Badge({ tone = 'neutral', variant = 'soft', size = 'md', dot, live, icon, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={['q-badge', `q-badge--${tone}`, `q-badge--${variant}`, `q-badge--${size}`, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {dot ? <span className={live ? 'q-badge__dot q-badge__dot--live' : 'q-badge__dot'} aria-hidden /> : null}
      {icon}
      {children}
    </span>
  );
}
