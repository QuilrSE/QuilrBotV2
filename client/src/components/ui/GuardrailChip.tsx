import { Check, MessageCircle, TriangleAlert, X } from 'lucide-react';
import type { GuardrailVerdict } from '../../types';

// Quilr AI Design System — GuardrailChip (components/product/GuardrailChip).
// The Decision Engine's verdict: allow (mint ✓), block (pink ×), coach (purple).
// QuilrBot adds `fail` (amber) so a misconfiguration is never mistaken for a block.

export type ChipVerdict = 'allow' | 'block' | 'coach' | 'fail';

const ICONS = { allow: Check, block: X, coach: MessageCircle, fail: TriangleAlert };

export function GuardrailChip({ verdict, label, title, size = 'md' }: { verdict: ChipVerdict; label: string; title?: string; size?: 'sm' | 'md' }) {
  const Icon = ICONS[verdict];
  return (
    <span className={`q-chip q-chip--${verdict} q-chip--${size}`} title={title}>
      <span className="q-chip__glyph" aria-hidden>
        <Icon size={size === 'sm' ? 11 : 13} strokeWidth={2.75} />
      </span>
      {label}
    </span>
  );
}

const VERDICT_TO_CHIP: Record<GuardrailVerdict, ChipVerdict> = { allowed: 'allow', blocked: 'block', failed: 'fail' };

export function verdictChipProps(verdict: GuardrailVerdict, status?: number): { verdict: ChipVerdict; label: string } {
  const label = verdict === 'allowed' ? 'Allowed' : verdict === 'blocked' ? 'Blocked' : 'Failed';
  return { verdict: VERDICT_TO_CHIP[verdict], label: status && verdict !== 'allowed' ? `${label} · ${status}` : label };
}
