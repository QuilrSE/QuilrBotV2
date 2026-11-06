import { useEffect, useRef } from 'react';
import { KeyRound, Waypoints } from 'lucide-react';
import { useAppState } from '../../state/AppStateContext';
import { MessageBubble } from './MessageBubble';
import { EmptyState } from './EmptyState';
import { GuardrailChip } from '../ui';
import type { ChatMessage, ConnectionMode, GuardrailVerdict } from '../../types';

function tally(messages: ChatMessage[]): Record<GuardrailVerdict, number> {
  const counts: Record<GuardrailVerdict, number> = { allowed: 0, blocked: 0, failed: 0 };
  for (const m of messages) if (m.role === 'assistant' && m.verdict) counts[m.verdict] += 1;
  return counts;
}

function SplitColumn({ side, messages, onRetry }: { side: ConnectionMode; messages: ChatMessage[]; onRetry: (id: string) => void }) {
  const { state } = useAppState();
  const endRef = useRef<HTMLDivElement | null>(null);
  const filtered = messages.filter((m) => m.role === 'user' || m.side === side);
  const lastAssistantId = [...filtered].reverse().find((m) => m.role === 'assistant')?.id;
  const lastContent = filtered[filtered.length - 1]?.content.length ?? 0;
  const counts = tally(filtered);
  const definition = state.providerCatalog.find((p) => p.id === state.provider.providerId);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [filtered.length, lastContent]);

  return (
    <section className="q-split__col" aria-label={side === 'provider' ? 'Direct Provider replies' : 'LLM Gateway replies'}>
      <header className="q-split__head">
        <div className="q-split__title">
          {side === 'provider' ? <KeyRound size={14} strokeWidth={1.75} /> : <Waypoints size={14} strokeWidth={1.75} />}
          <strong>{side === 'provider' ? definition?.label ?? 'Direct Provider' : state.gateway.name || 'LLM Gateway'}</strong>
          <span className="q-split__model">{side === 'provider' ? state.provider.model : state.gateway.model}</span>
        </div>
        <div className="q-split__tally" aria-label="Verdicts so far">
          {counts.allowed ? <GuardrailChip size="sm" verdict="allow" label={String(counts.allowed)} title="Allowed" /> : null}
          {counts.blocked ? <GuardrailChip size="sm" verdict="block" label={String(counts.blocked)} title="Blocked" /> : null}
          {counts.failed ? <GuardrailChip size="sm" verdict="fail" label={String(counts.failed)} title="Failed" /> : null}
        </div>
      </header>
      <div className="q-split__messages" role="log" aria-live="polite">
        {filtered.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isLastAssistant={message.id === lastAssistantId}
            isStreamingSide={state.streaming[side]}
            onRetry={() => onRetry(message.id)}
            hideSideTag
          />
        ))}
        <div ref={endRef} />
      </div>
    </section>
  );
}

/** The same prompt, answered independently by the Direct Provider and the LLM Gateway. */
export function SplitMessageList({ onRetry, onSuggestion }: { onRetry: (id: string) => void; onSuggestion: (text: string) => void }) {
  const { activeConversation } = useAppState();
  const messages = activeConversation.messages;
  if (!messages.length) return <EmptyState split onSuggestion={onSuggestion} />;

  return (
    <div className="q-split">
      <SplitColumn side="provider" messages={messages} onRetry={onRetry} />
      <SplitColumn side="gateway" messages={messages} onRetry={onRetry} />
    </div>
  );
}
