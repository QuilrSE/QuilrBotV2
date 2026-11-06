import { useState } from 'react';
import { FolderOpen, Save, Star, Trash2 } from 'lucide-react';
import { useAppState } from '../../state/AppStateContext';
import { GatewayService } from '../../services/gatewayApi';
import { ConfigurationService } from '../../services/settingsApi';
import { Badge, Button, Card } from '../ui';
import { inferGatewayApiStyle } from '../../utils/validation';

export function GatewaySettings() {
  const { state, dispatch, refreshSavedGateways } = useAppState();
  const [saving, setSaving] = useState(false);
  const g = state.gateway;

  async function handleSave() {
    setSaving(true);
    try {
      await GatewayService.save({
        name: g.name || 'Untitled gateway',
        baseUrl: g.baseUrl,
        endpointPath: g.endpointPath,
        model: g.model,
        maxTokensField: g.maxTokensField,
        apiStyle: g.apiStyle,
        authMethod: g.authMethod,
        authHeaderName: g.authHeaderName,
        apiKey: g.apiKey,
        headers: g.headers,
      });
      refreshSavedGateways();
    } finally {
      setSaving(false);
    }
  }

  async function handleLoad(id: string) {
    const { gateway } = await GatewayService.reveal(id);
    dispatch({
      type: 'LOAD_GATEWAY_PROFILE',
      gateway: {
        id: gateway.id,
        name: gateway.name,
        baseUrl: gateway.baseUrl,
        endpointPath: gateway.endpointPath,
        model: gateway.model ?? '',
        maxTokensField: gateway.maxTokensField ?? 'max_tokens',
        apiStyle: gateway.apiStyle ?? inferGatewayApiStyle(gateway.endpointPath),
        authMethod: gateway.authMethod,
        authHeaderName: gateway.authHeaderName ?? '',
        apiKey: gateway.apiKey,
        headers: gateway.headers ?? [],
      },
    });
    dispatch({ type: 'SET_VIEW', view: 'chat' });
  }

  async function handleDelete(id: string) {
    await GatewayService.remove(id);
    refreshSavedGateways();
  }

  async function handleSetDefault(id: string) {
    const { settings } = await ConfigurationService.update({ defaultGatewayId: id });
    dispatch({ type: 'SET_APP_SETTINGS', settings });
  }

  return (
    <div className="q-stack">
      <Card as="section">
        <h2 className="q-card__title">Save the current gateway</h2>
        <p className="q-card__desc">
          Saves <strong>{g.name || 'the gateway'}</strong>
          {g.baseUrl ? <> at <span className="q-mono">{g.baseUrl}</span></> : null} with its credential and headers.
        </p>
        <Button disabled={saving || !g.baseUrl.trim()} onClick={handleSave} iconLeft={<Save size={14} strokeWidth={1.75} />}>
          {saving ? 'Saving…' : 'Save gateway'}
        </Button>
      </Card>

      <Card as="section">
        <h2 className="q-card__title">Saved gateways</h2>
        <p className="q-card__desc">The default gateway loads automatically when you switch Chat to LLM Gateway.</p>
        {state.savedGatewayProfiles.length ? (
          <ul className="q-saved">
            {state.savedGatewayProfiles.map((gateway) => {
              const isDefault = state.appSettings?.defaultGatewayId === gateway.id;
              return (
                <li className="q-saved__item" key={gateway.id}>
                  <div className="q-saved__info">
                    <strong>
                      {gateway.name}
                      {isDefault ? (
                        <Badge tone="mint" size="sm" icon={<Star size={10} strokeWidth={2} />}>
                          Default
                        </Badge>
                      ) : null}
                    </strong>
                    <span className="q-mono">
                      {gateway.baseUrl}
                      {gateway.endpointPath}
                    </span>
                  </div>
                  <div className="q-saved__actions">
                    {!isDefault ? (
                      <Button variant="ghost" size="sm" onClick={() => handleSetDefault(gateway.id)} iconLeft={<Star size={13} strokeWidth={1.75} />}>
                        Make default
                      </Button>
                    ) : null}
                    <Button variant="outline" size="sm" onClick={() => handleLoad(gateway.id)} iconLeft={<FolderOpen size={13} strokeWidth={1.75} />}>
                      Load in Chat
                    </Button>
                    <Button variant="ghost" size="sm" className="q-btn--ghost-danger" onClick={() => handleDelete(gateway.id)} iconLeft={<Trash2 size={13} strokeWidth={1.75} />}>
                      Delete
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="q-card__empty">Nothing saved yet. Set up a gateway in Chat, then save it above.</p>
        )}
      </Card>
    </div>
  );
}
