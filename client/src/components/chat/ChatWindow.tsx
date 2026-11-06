import { useState } from 'react';
import { X } from 'lucide-react';
import { useAppState } from '../../state/AppStateContext';
import { useStreamingChat } from '../../hooks/useStreamingChat';
import { ConnectionBar } from '../connection/ConnectionBar';
import { MessageList } from './MessageList';
import { SplitMessageList } from './SplitMessageList';
import { Composer } from './Composer';
import { QuickPrompts } from './QuickPrompts';
import { IconButton } from '../ui';

export function ChatWindow() {
  const { state, dispatch, activeConversation } = useAppState();
  const { sendPrompt, retryMessage, cancelStreaming, providerFieldErrors, gatewayFieldErrors, isBusy } = useStreamingChat();
  const [draft, setDraft] = useState('');

  return (
    <div className="q-chat">
      <ConnectionBar providerFieldErrors={providerFieldErrors} gatewayFieldErrors={gatewayFieldErrors} />

      {state.notice ? (
        <div className={`q-notice q-notice--${state.notice.kind}`} role={state.notice.kind === 'error' ? 'alert' : 'status'}>
          <div className="q-notice__text">
            <strong>
              {state.notice.title}
              {state.notice.status ? <span className="q-notice__status">HTTP {state.notice.status}</span> : null}
            </strong>
            <p>{state.notice.detail}</p>
          </div>
          <IconButton label="Dismiss" onClick={() => dispatch({ type: 'SET_NOTICE', notice: null })}>
            <X size={14} strokeWidth={1.75} />
          </IconButton>
        </div>
      ) : null}

      {state.splitMode ? (
        <SplitMessageList onRetry={retryMessage} onSuggestion={setDraft} />
      ) : (
        <MessageList onRetry={retryMessage} onSuggestion={setDraft} />
      )}

      <div className="q-chat__dock">
        <QuickPrompts onSelect={setDraft} />
        <Composer
          value={draft}
          onChange={setDraft}
          onSend={sendPrompt}
          onClear={() => dispatch({ type: 'CLEAR_ACTIVE_CONVERSATION' })}
          onCancel={cancelStreaming}
          isBusy={isBusy}
          canClear={activeConversation.messages.length > 0}
        />
      </div>
    </div>
  );
}
