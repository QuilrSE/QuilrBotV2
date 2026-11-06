import { useState } from 'react';
import { Bomb, Bug, ChevronDown, CreditCard, KeyRound, MessageSquareWarning, ShieldAlert } from 'lucide-react';
import { QUICK_PROMPTS } from '../../data/quickPrompts';

const ICONS: Record<string, typeof CreditCard> = {
  'leak-pii': CreditCard,
  'leak-secret': KeyRound,
  jailbreak: ShieldAlert,
  'prompt-injection': Bug,
  violence: Bomb,
  abusive: MessageSquareWarning,
};

/** Preset red-team probes for checking a gateway's or provider's guardrails. Fills the composer; never auto-sends. */
export function QuickPrompts({ onSelect }: { onSelect: (prompt: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="q-quick">
      <button type="button" className="q-quick__toggle" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
        <ShieldAlert size={14} strokeWidth={1.75} />
        Quick Prompt
        <span className="q-quick__count">{QUICK_PROMPTS.length} guardrail probes</span>
        <ChevronDown size={14} strokeWidth={1.75} className={expanded ? 'q-rotate-180' : undefined} />
      </button>

      {expanded ? (
        <div className="q-quick__grid">
          {QUICK_PROMPTS.map((item) => {
            const Icon = ICONS[item.id] ?? ShieldAlert;
            return (
              <button
                key={item.id}
                type="button"
                className="q-quick__card"
                onClick={() => {
                  onSelect(item.prompt);
                  setExpanded(false);
                }}
                title={item.prompt}
              >
                <span className="q-quick__icon">
                  <Icon size={16} strokeWidth={1.75} />
                </span>
                <span className="q-quick__copy">
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
