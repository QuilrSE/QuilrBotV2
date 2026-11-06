// Quilr AI Design System — Logo (components/brand/Logo).
// The guardian-knot lockup is a fixed brand asset: never redraw or recolor it.
// Only a dark-surface variant exists today.

export function Logo({ height = 28, className }: { height?: number; className?: string }) {
  return <img src="/brand/quilr-logo.png" alt="Quilr AI" height={height} className={['q-logo', className].filter(Boolean).join(' ')} />;
}
