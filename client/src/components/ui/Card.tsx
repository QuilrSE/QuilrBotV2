import type { HTMLAttributes } from 'react';

// Quilr AI Design System — Card (components/core/Card).
// Dark raised surface with a hairline border. `accentEdge` adds the aurora rule
// across the top; `glow` adds a brand accent ring for brand moments only.

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: 'none' | 'mint' | 'purple';
  accentEdge?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  as?: 'div' | 'section' | 'article';
}

export function Card({ glow = 'none', accentEdge, padding = 'md', as: Tag = 'div', className, children, ...rest }: CardProps) {
  return (
    <Tag
      className={[
        'q-card',
        `q-card--pad-${padding}`,
        glow !== 'none' ? `q-card--glow-${glow}` : '',
        accentEdge ? 'q-card--accent-edge' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </Tag>
  );
}
