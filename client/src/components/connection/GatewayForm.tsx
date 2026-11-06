import { useAppState } from '../../state/AppStateContext';
import { HeaderEditor } from './HeaderEditor';
import { Field } from '../ui';
import type { FieldErrors, GatewayApiStyle, GatewayAuthMethod, GatewayConnectionState, GatewayMaxTokensField } from '../../types';
import { inferGatewayApiStyle } from '../../utils/validation';

const DEFAULT_PATH: Record<GatewayApiStyle, string> = { openai: '/chat/completions', anthropic: '/v1/messages' };

const AUTH_METHODS: Array<{ value: GatewayAuthMethod; label: string }> = [
  { value: 'bearer', label: 'Bearer token (Authorization header)' },
  { value: 'header', label: 'Custom header' },
  { value: 'none', label: 'No authorization' },
];

/** Enterprise LLM Gateway connection form. Gateways speak the OpenAI chat-completions dialect. */
export function GatewayForm({ fieldErrors, disabled }: { fieldErrors: FieldErrors; disabled: boolean }) {
  const { state, dispatch } = useAppState();
  const gateway = state.gateway;
  const maxTokens = state.appSettings?.advanced.maxTokens ?? 4096;
  const patch = (value: Partial<GatewayConnectionState>) => dispatch({ type: 'PATCH_GATEWAY', patch: value });

  return (
    <div className="q-form-grid">
      <Field label="Gateway name">
        {(a11y) => <input {...a11y} type="text" value={gateway.name} disabled={disabled} onChange={(e) => patch({ name: e.target.value })} />}
      </Field>

      <Field label="Model" error={fieldErrors.model} hint="The model id the gateway routes to.">
        {(a11y) => (
          <input
            {...a11y}
            type="text"
            spellCheck={false}
            value={gateway.model}
            disabled={disabled}
            placeholder="e.g. gpt-6-sol"
            onChange={(e) => patch({ model: e.target.value })}
          />
        )}
      </Field>

      <Field label="Base URL" error={fieldErrors.baseUrl}>
        {(a11y) => (
          <input
            {...a11y}
            type="url"
            spellCheck={false}
            value={gateway.baseUrl}
            disabled={disabled}
            placeholder="https://gateway.internal.acme.com"
            onChange={(e) => patch({ baseUrl: e.target.value })}
          />
        )}
      </Field>

      <Field
        label="API format"
        hint={
          gateway.apiStyle === 'anthropic'
            ? 'System prompt sent as top-level system; max_tokens always sent.'
            : 'System prompt sent as the first message.'
        }
      >
        {(a11y) => (
          <select
            {...a11y}
            value={gateway.apiStyle}
            disabled={disabled}
            onChange={(e) => {
              const apiStyle = e.target.value as GatewayApiStyle;
              const path = gateway.endpointPath.trim();
              // Swap the path only if it's still the other format's default.
              const swapPath = !path || Object.values(DEFAULT_PATH).includes(path);
              patch({ apiStyle, ...(swapPath ? { endpointPath: DEFAULT_PATH[apiStyle] } : {}) });
            }}
          >
            <option value="openai">OpenAI Chat Completions</option>
            <option value="anthropic">Anthropic Messages</option>
          </select>
        )}
      </Field>

      <Field label="Endpoint path" error={fieldErrors.endpointPath}>
        {(a11y) => (
          <input
            {...a11y}
            type="text"
            spellCheck={false}
            value={gateway.endpointPath}
            disabled={disabled}
            placeholder={DEFAULT_PATH[gateway.apiStyle]}
            onChange={(e) => {
              const endpointPath = e.target.value;
              // Typing a recognisable path selects the matching format.
              const known = /\/(messages|chat\/completions)\/?$/i.test(endpointPath);
              patch({ endpointPath, ...(known ? { apiStyle: inferGatewayApiStyle(endpointPath) } : {}) });
            }}
          />
        )}
      </Field>

      {gateway.apiStyle === 'openai' ? (
      <Field
        label="Output token limit"
        hint={`Sends the Max output tokens setting (${maxTokens}). Claude behind a gateway needs max_tokens.`}
      >
        {(a11y) => (
          <select
            {...a11y}
            value={gateway.maxTokensField}
            disabled={disabled}
            onChange={(e) => patch({ maxTokensField: e.target.value as GatewayMaxTokensField })}
          >
            <option value="max_tokens">max_tokens (Anthropic, Bedrock, most gateways)</option>
            <option value="max_completion_tokens">max_completion_tokens (OpenAI reasoning models)</option>
            <option value="none">Don’t send a limit</option>
          </select>
        )}
      </Field>
      ) : null}

      <Field label="Authorization">
        {(a11y) => (
          <select {...a11y} value={gateway.authMethod} disabled={disabled} onChange={(e) => patch({ authMethod: e.target.value as GatewayAuthMethod })}>
            {AUTH_METHODS.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        )}
      </Field>

      {gateway.authMethod === 'header' ? (
        <Field label="Header name" error={fieldErrors.authHeaderName}>
          {(a11y) => (
            <input
              {...a11y}
              type="text"
              spellCheck={false}
              value={gateway.authHeaderName}
              disabled={disabled}
              placeholder="x-api-key"
              onChange={(e) => patch({ authHeaderName: e.target.value })}
            />
          )}
        </Field>
      ) : null}

      {gateway.authMethod !== 'none' ? (
        <Field label="Credential" error={fieldErrors.apiKey} hint="Kept in this tab’s memory only, unless you save a profile.">
          {(a11y) => (
            <input
              {...a11y}
              type="password"
              autoComplete="off"
              value={gateway.apiKey}
              disabled={disabled}
              onChange={(e) => patch({ apiKey: e.target.value })}
            />
          )}
        </Field>
      ) : null}

      <div className="q-field q-field--full">
        <span className="q-field__label">Custom headers</span>
        <HeaderEditor headers={gateway.headers} disabled={disabled} onChange={(headers) => dispatch({ type: 'SET_GATEWAY_HEADERS', headers })} />
        {fieldErrors.headers ? <p className="q-field__error">{fieldErrors.headers}</p> : null}
      </div>
    </div>
  );
}
