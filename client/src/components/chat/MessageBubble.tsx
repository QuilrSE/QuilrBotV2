import { useState } from 'react';
import { Check, Copy, KeyRound, RotateCcw, Waypoints } from 'lucide-react';
import type { ChatMessage } from '../../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { copyMessageToClipboard } from '../../hooks/useStreamingChat';
import { GuardrailChip, IconButton, verdictChipProps } from '../ui';

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(timestamp);
}

function formatLatency(ms?: number): string | null {
  if (ms === undefined) return null;
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

interface MessageBubbleProps {
  message: ChatMessage;
  isLastAssistant: boolean;
  isStreamingSide: boolean;
  onRetry: () => void;
  /** Hidden inside split-view columns, where the column header already names the channel. */
  hideSideTag?: boolean;
}

export function MessageBubble({ message, isLastAssistant, isStreamingSide, onRetry, hideSideTag }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isPending = !isUser && !message.verdict && isStreamingSide && isLastAssistant;
  const showTyping = isPending && !message.content;
  const latency = formatLatency(message.latencyMs);

  async function handleCopy() {
    try {
      await copyMessageToClipboard(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard can be unavailable (non-secure context). Nothing useful to show.
    }
  }

  const rowClass = ['q-msg', isUser ? 'q-msg--user' : 'q-msg--assistant', message.verdict ? `q-msg--${message.verdict}` : ''].join(' ');

  return (
    <article className={rowClass} aria-busy={isPending}>
      {!isUser ? <div className="q-msg__avatar" aria-hidden /> : null}

      <div className="q-msg__body">
        <header className="q-msg__meta">
          <span className="q-msg__role">{isUser ? 'You' : 'QuilrBot'}</span>
          {!isUser && !hideSideTag && message.side ? (
            <span className="q-msg__side">
              {message.side === 'provider' ? <KeyRound size={11} strokeWidth={2} /> : <Waypoints size={11} strokeWidth={2} />}
              {message.side === 'provider' ? 'Provider' : 'Gateway'}
            </span>
          ) : null}
          {!isUser && message.verdict ? (
            <GuardrailChip
              size="sm"
              {...verdictChipProps(message.verdict, message.status)}
              title={message.finishReason ? `Stop reason: ${message.finishReason}` : undefined}
            />
          ) : null}
          <time className="q-msg__time" dateTime={new Date(message.timestamp).toISOString()}>
            {formatTime(message.timestamp)}
          </time>
          <span className="q-msg__actions">
            {!isUser && message.content ? (
              <IconButton label={copied ? 'Copied' : 'Copy reply'} onClick={handleCopy}>
                {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.75} />}
              </IconButton>
            ) : null}
            {!isUser && isLastAssistant && !isStreamingSide ? (
              <IconButton label="Send again" onClick={onRetry}>
                <RotateCcw size={14} strokeWidth={1.75} />
              </IconButton>
            ) : null}
          </span>
        </header>

        <div className={message.isError ? 'q-msg__content q-msg__content--error' : 'q-msg__content'}>
          {showTyping ? (
            <span className="q-typing" role="status" aria-label="Waiting for the first token">
              <span />
              <span />
              <span />
            </span>
          ) : message.isError ? (
            <p>{message.content}</p>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>

        {!isUser && (message.usage || latency || message.model) && !message.isError ? (
          <footer className="q-msg__telemetry">
            {message.usage ? (
              <span title="Prompt tokens → completion tokens">
                {message.usage.promptTokens ?? '–'} → {message.usage.completionTokens ?? '–'} tokens
              </span>
            ) : null}
            {latency ? <span>{latency}</span> : null}
            {message.model ? <span className="q-msg__model">{message.model}</span> : null}
          </footer>
        ) : null}
      </div>
    </article>
  );
}
