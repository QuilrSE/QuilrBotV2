import { useCallback, useRef } from 'react';
import { useAppState } from '../state/AppStateContext';
import { ChatService, type ChatStreamPayload } from '../services/chatApi';
import { validateGatewayConnection, validateMessage, validateProviderConnection } from '../utils/validation';
import { createId } from '../utils/id';
import type { ChatMessage, ConnectionMode, FieldErrors } from '../types';

function createMessage(role: ChatMessage['role'], content: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return { id: createId(), role, content, timestamp: Date.now(), ...extra };
}

/** Keeps each channel's history independent: shared user turns + that channel's own successful replies. */
function buildHistoryForSide(messages: ChatMessage[], side: ConnectionMode): Array<{ role: ChatMessage['role']; content: string }> {
  return messages
    .filter((message) => message.role === 'user' || (message.side === side && !message.isError && message.content))
    .map((message) => ({ role: message.role, content: message.content }));
}

export const SIDE_LABEL: Record<ConnectionMode, string> = {
  provider: 'Direct Provider',
  gateway: 'LLM Gateway',
};

export function useStreamingChat() {
  const { state, dispatch, activeConversation } = useAppState();
  const abortRefs = useRef<Record<ConnectionMode, AbortController | null>>({ provider: null, gateway: null });

  const providerDefinition = state.providerCatalog.find((p) => p.id === state.provider.providerId);
  const providerFieldErrors: FieldErrors = state.providerCatalog.length
    ? validateProviderConnection(state.provider, providerDefinition)
    : {};
  const gatewayFieldErrors: FieldErrors = validateGatewayConnection(state.gateway);
  const fieldErrors: FieldErrors = state.mode === 'provider' ? providerFieldErrors : gatewayFieldErrors;

  const isBusy = state.streaming.provider || state.streaming.gateway;

  const buildPayload = useCallback(
    (side: ConnectionMode, history: Array<{ role: ChatMessage['role']; content: string }>): ChatStreamPayload => {
      const advanced = state.appSettings?.advanced;
      const common = {
        messages: history,
        systemPrompt: state.systemPrompt,
        stream: advanced?.streamingEnabled ?? true,
        timeoutMs: advanced?.requestTimeoutMs,
        maxTokens: advanced?.maxTokens,
      };

      if (side === 'provider') {
        const p = state.provider;
        const isAws = providerDefinition?.authHeaderStyle === 'aws';
        return {
          ...common,
          mode: 'provider',
          model: p.model.trim(),
          provider: {
            providerId: p.providerId,
            model: p.model.trim(),
            apiKey: p.apiKey.trim() || undefined,
            baseUrlOverride: p.baseUrlOverride.trim() || undefined,
            apiVersion: p.apiVersion.trim() || undefined,
            headers: p.headers,
            ...(isAws
              ? {
                  region: p.region.trim() || undefined,
                  awsAuthMode: p.awsAuthMode,
                  aws:
                    p.awsAuthMode === 'iam'
                      ? {
                          accessKeyId: p.awsAccessKeyId.trim() || undefined,
                          secretAccessKey: p.awsSecretAccessKey.trim() || undefined,
                          sessionToken: p.awsSessionToken.trim() || undefined,
                        }
                      : undefined,
                }
              : {}),
          },
        };
      }

      const g = state.gateway;
      return {
        ...common,
        mode: 'gateway',
        model: g.model.trim(),
        gateway: {
          baseUrl: g.baseUrl.trim(),
          endpointPath: g.endpointPath.trim() || '/chat/completions',
          maxTokensField: g.maxTokensField,
          apiStyle: g.apiStyle,
          authMethod: g.authMethod,
          authHeaderName: g.authHeaderName.trim() || undefined,
          apiKey: g.apiKey.trim() || undefined,
          headers: g.headers,
        },
      };
    },
    [state.appSettings, state.systemPrompt, state.provider, state.gateway, providerDefinition],
  );

  const runCompletion = useCallback(
    async (side: ConnectionMode, history: Array<{ role: ChatMessage['role']; content: string }>, assistantMessageId: string) => {
      const payload = buildPayload(side, history);
      const startedAt = Date.now();

      dispatch({ type: 'SET_STREAMING_SIDE', side, value: true });
      dispatch({ type: 'SET_REQUEST_METADATA', side, metadata: { startedAt, model: payload.model } });

      const controller = new AbortController();
      abortRefs.current[side] = controller;
      let accumulated = '';

      await ChatService.streamChat(
        payload,
        {
          onDelta(content) {
            accumulated += content;
            dispatch({ type: 'PATCH_MESSAGE', id: assistantMessageId, patch: { content: accumulated } });
          },
          onDone(meta) {
            dispatch({
              type: 'PATCH_MESSAGE',
              id: assistantMessageId,
              patch: {
                usage: meta.usage,
                model: meta.model,
                verdict: meta.verdict,
                finishReason: meta.finishReason,
                latencyMs: meta.latencyMs,
              },
            });
            dispatch({ type: 'SET_STREAMING_SIDE', side, value: false });
            dispatch({ type: 'SET_REQUEST_METADATA', side, metadata: { startedAt, finishedAt: Date.now(), model: meta.model ?? payload.model } });
          },
          onError(message, status, verdict) {
            dispatch({ type: 'SET_STREAMING_SIDE', side, value: false });
            dispatch({
              type: 'PATCH_MESSAGE',
              id: assistantMessageId,
              patch: accumulated
                ? { verdict: verdict ?? 'failed', status, finishReason: 'error' }
                : { content: message, isError: true, verdict: verdict ?? 'failed', status },
            });
            if (verdict === 'blocked' || message === 'Stopped.') return;
            dispatch({
              type: 'SET_NOTICE',
              notice: {
                kind: 'error',
                title: state.splitMode ? `${SIDE_LABEL[side]} request failed` : 'Request failed',
                detail: message,
                status,
              },
            });
          },
        },
        controller.signal,
      );
    },
    [buildPayload, dispatch, state.splitMode],
  );

  const sendPrompt = useCallback(
    async (draft: string) => {
      if (isBusy) return;

      const messageError = validateMessage(draft);
      if (messageError) {
        dispatch({ type: 'SET_NOTICE', notice: { kind: 'error', title: 'Nothing to send', detail: messageError } });
        return;
      }

      if (!state.splitMode) {
        const side = state.mode;
        const errors = side === 'provider' ? providerFieldErrors : gatewayFieldErrors;
        if (Object.keys(errors).length > 0) {
          dispatch({
            type: 'SET_NOTICE',
            notice: { kind: 'error', title: 'Finish the connection first', detail: Object.values(errors)[0] ?? '' },
          });
          return;
        }

        const userMessage = createMessage('user', draft.trim());
        const assistantMessage = createMessage('assistant', '', { side });
        const history = buildHistoryForSide([...activeConversation.messages, userMessage], side);

        dispatch({ type: 'SET_NOTICE', notice: null });
        dispatch({ type: 'APPEND_MESSAGE', message: userMessage });
        dispatch({ type: 'APPEND_MESSAGE', message: assistantMessage });
        await runCompletion(side, history, assistantMessage.id);
        return;
      }

      // Split View: one shared prompt, two independent channels.
      const misconfigured: ConnectionMode[] = [];
      if (Object.keys(providerFieldErrors).length > 0) misconfigured.push('provider');
      if (Object.keys(gatewayFieldErrors).length > 0) misconfigured.push('gateway');

      if (misconfigured.length === 2) {
        dispatch({
          type: 'SET_NOTICE',
          notice: {
            kind: 'error',
            title: 'Finish both connections first',
            detail: 'Split View needs a Direct Provider and an LLM Gateway. Open the connection panel to fill in the highlighted fields.',
          },
        });
        return;
      }

      const userMessage = createMessage('user', draft.trim());
      dispatch({ type: 'APPEND_MESSAGE', message: userMessage });
      dispatch({ type: 'SET_NOTICE', notice: null });
      const withUser = [...activeConversation.messages, userMessage];

      (['provider', 'gateway'] as ConnectionMode[]).forEach((side) => {
        const assistantMessage = createMessage('assistant', '', { side });
        dispatch({ type: 'APPEND_MESSAGE', message: assistantMessage });

        if (misconfigured.includes(side)) {
          dispatch({
            type: 'PATCH_MESSAGE',
            id: assistantMessage.id,
            patch: {
              isError: true,
              verdict: 'failed',
              content: `Not sent: the ${SIDE_LABEL[side]} connection is incomplete. Fill in the highlighted fields in the connection panel.`,
            },
          });
          return;
        }
        void runCompletion(side, buildHistoryForSide(withUser, side), assistantMessage.id);
      });
    },
    [isBusy, state.splitMode, state.mode, providerFieldErrors, gatewayFieldErrors, activeConversation, dispatch, runCompletion],
  );

  const retryMessage = useCallback(
    async (messageId: string) => {
      const messages = activeConversation.messages;
      const index = messages.findIndex((message) => message.id === messageId);
      if (index === -1) return;

      const target = messages[index];
      const side = target.side ?? state.mode;
      if (target.role !== 'assistant' || state.streaming[side]) return;

      let anchorIndex = -1;
      for (let i = index - 1; i >= 0; i -= 1) {
        if (messages[i].role === 'user') {
          anchorIndex = i;
          break;
        }
      }
      if (anchorIndex === -1) return;

      const history = buildHistoryForSide(messages.slice(0, anchorIndex + 1), side);
      dispatch({ type: 'REMOVE_MESSAGE', id: target.id });
      const assistantMessage = createMessage('assistant', '', { side });
      dispatch({ type: 'APPEND_MESSAGE', message: assistantMessage });
      await runCompletion(side, history, assistantMessage.id);
    },
    [activeConversation, state.mode, state.streaming, dispatch, runCompletion],
  );

  const cancelStreaming = useCallback(() => {
    (['provider', 'gateway'] as ConnectionMode[]).forEach((side) => abortRefs.current[side]?.abort());
  }, []);

  return {
    sendPrompt,
    retryMessage,
    cancelStreaming,
    fieldErrors,
    providerFieldErrors,
    gatewayFieldErrors,
    providerDefinition,
    isBusy,
  };
}

export function copyMessageToClipboard(content: string): Promise<void> {
  return navigator.clipboard.writeText(content);
}
