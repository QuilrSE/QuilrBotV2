import { useEffect, useRef } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { MessageBubble } from './MessageBubble';
import { EmptyState } from './EmptyState';

interface MessageListProps {
  onRetry: (messageId: string) => void;
  onSuggestion: (text: string) => void;
}

export function MessageList({ onRetry, onSuggestion }: MessageListProps) {
  const { state, activeConversation } = useAppState();
  const endRef = useRef<HTMLDivElement | null>(null);
  const messages = activeConversation.messages;
  const lastContent = messages[messages.length - 1]?.content.length ?? 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, lastContent]);

  if (!messages.length) return <EmptyState split={false} onSuggestion={onSuggestion} />;

  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;
  // Only label the channel when this conversation actually mixes both.
  const mixedChannels = new Set(messages.filter((m) => m.role === 'assistant').map((m) => m.side)).size > 1;

  return (
    <div className="q-thread" role="log" aria-live="polite">
      <div className="q-thread__inner">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isLastAssistant={message.id === lastAssistantId}
            isStreamingSide={state.streaming[message.side ?? state.mode]}
            onRetry={() => onRetry(message.id)}
            hideSideTag={!mixedChannels}
          />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
