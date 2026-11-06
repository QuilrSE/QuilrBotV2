import type { ChatMessage } from '../types';

/**
 * Anthropic and Bedrock Converse require a conversation that starts with a
 * user turn and alternates roles. QuilrBot's history can violate that (a
 * retried or failed reply, split-view channels), so normalize it: drop
 * system/empty turns, drop leading assistant turns, and merge consecutive
 * turns from the same role.
 */
export function toAlternatingTurns(messages: ChatMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  const turns: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const message of messages) {
    if (message.role === 'system' || !message.content.trim()) continue;
    if (turns.length === 0 && message.role === 'assistant') continue;
    const last = turns[turns.length - 1];
    if (last && last.role === message.role) {
      last.content = `${last.content}\n\n${message.content}`;
    } else {
      turns.push({ role: message.role, content: message.content });
    }
  }
  return turns;
}
