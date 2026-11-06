import { useAppState } from '../../state/AppStateContext';
import { useStreamingChat } from '../../hooks/useStreamingChat';
import { Badge } from '../ui';

const VIEW_TITLES: Record<string, { title: string; subtitle: string }> = {
  chat: { title: 'Chat', subtitle: 'Send prompts straight to a provider, through your gateway, or both at once.' },
  models: { title: 'Models', subtitle: 'Every provider QuilrBot can reach, and the models it suggests for each.' },
  providers: { title: 'Provider Connections', subtitle: 'Saved Direct Provider connections.' },
  gateways: { title: 'Gateway Connections', subtitle: 'Saved LLM Gateway connections.' },
  settings: { title: 'Settings', subtitle: 'Saved connections and request behaviour.' },
};

export function TopBar() {
  const { state } = useAppState();
  const { providerFieldErrors, gatewayFieldErrors } = useStreamingChat();
  const { title, subtitle } = VIEW_TITLES[state.view] ?? VIEW_TITLES.chat;

  const providerReady = Object.keys(providerFieldErrors).length === 0;
  const gatewayReady = Object.keys(gatewayFieldErrors).length === 0;
  const ready = state.splitMode ? providerReady && gatewayReady : state.mode === 'provider' ? providerReady : gatewayReady;
  const streaming = state.streaming.provider || state.streaming.gateway;

  return (
    <header className="q-topbar">
      <div className="q-topbar__title">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {state.view === 'chat' ? (
        <div className="q-topbar__status">
          {streaming ? (
            <Badge tone="purple" dot live>
              Streaming
            </Badge>
          ) : (
            <Badge tone={ready ? 'mint' : 'warn'} dot>
              {ready ? 'Ready to send' : 'Connection incomplete'}
            </Badge>
          )}
        </div>
      ) : null}
    </header>
  );
}
