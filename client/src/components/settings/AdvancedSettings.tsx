import { useAppState } from '../../state/AppStateContext';
import { ConfigurationService } from '../../services/settingsApi';
import { Card, Switch } from '../ui';
import type { AppSettings } from '../../types';

export function AdvancedSettings() {
  const { state, dispatch } = useAppState();
  const settings = state.appSettings;
  if (!settings) return <p className="q-card__empty">Loading settings from the relay…</p>;

  async function patch(partial: Partial<AppSettings['advanced']>) {
    const next = { ...settings!, advanced: { ...settings!.advanced, ...partial } };
    dispatch({ type: 'SET_APP_SETTINGS', settings: next });
    await ConfigurationService.update({ advanced: next.advanced });
  }

  return (
    <Card as="section">
      <h2 className="q-card__title">Request behaviour</h2>
      <p className="q-card__desc">Applies to every request, on every provider and gateway.</p>

      <div className="q-setting">
        <div>
          <strong>Timeout</strong>
          <span>How long to wait for a reply before giving up.</span>
        </div>
        <div className="q-setting__input">
          <input
            type="number"
            aria-label="Timeout in seconds"
            min={5}
            step={5}
            defaultValue={Math.round(settings.advanced.requestTimeoutMs / 1000)}
            onBlur={(e) => patch({ requestTimeoutMs: Math.max(5, Number(e.target.value) || 60) * 1000 })}
          />
          <span>seconds</span>
        </div>
      </div>

      <div className="q-setting">
        <div>
          <strong>Max output tokens</strong>
          <span>Required by Claude. Sent to Anthropic, Bedrock, OpenAI, Azure OpenAI, OpenRouter, and gateways (field set per gateway).</span>
        </div>
        <div className="q-setting__input">
          <input
            type="number"
            aria-label="Max output tokens"
            min={16}
            step={256}
            defaultValue={settings.advanced.maxTokens ?? 4096}
            onBlur={(e) => patch({ maxTokens: Math.max(16, Number(e.target.value) || 4096) })}
          />
          <span>tokens</span>
        </div>
      </div>

      <div className="q-setting">
        <div>
          <strong>Stream replies</strong>
          <span>Show tokens as they arrive instead of waiting for the full reply.</span>
        </div>
        <Switch label="Stream replies" checked={settings.advanced.streamingEnabled} onChange={(v) => patch({ streamingEnabled: v })} />
      </div>

      <div className="q-setting">
        <div>
          <strong>Debug logging</strong>
          <span>Logs request routing on the relay server. Credentials and headers are never logged.</span>
        </div>
        <Switch label="Debug logging" checked={settings.advanced.debugMode} onChange={(v) => patch({ debugMode: v })} />
      </div>
    </Card>
  );
}
