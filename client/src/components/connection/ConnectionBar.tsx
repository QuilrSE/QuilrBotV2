import { useState } from 'react';
import { ChevronDown, Columns2, KeyRound, Waypoints } from 'lucide-react';
import { useAppState } from '../../state/AppStateContext';
import { ProviderForm } from './ProviderForm';
import { GatewayForm } from './GatewayForm';
import { Badge, Segmented } from '../ui';
import type { ConnectionMode, FieldErrors } from '../../types';

interface ConnectionBarProps {
  providerFieldErrors: FieldErrors;
  gatewayFieldErrors: FieldErrors;
}

function gatewayLabel(name: string, baseUrl: string): string {
  if (name.trim()) return name.trim();
  try {
    return new URL(baseUrl).host;
  } catch {
    return 'Gateway';
  }
}

export function ConnectionBar({ providerFieldErrors, gatewayFieldErrors }: ConnectionBarProps) {
  const { state, dispatch } = useAppState();
  const [expanded, setExpanded] = useState(true);
  const disabled = state.streaming.provider || state.streaming.gateway;

  const definition = state.providerCatalog.find((p) => p.id === state.provider.providerId);
  const providerSummary = `${definition?.label ?? 'Provider'} · ${state.provider.model || 'no model'}`;
  const gatewaySummary = `${gatewayLabel(state.gateway.name, state.gateway.baseUrl)} · ${state.gateway.model || 'no model'}`;
  const providerReady = Object.keys(providerFieldErrors).length === 0;
  const gatewayReady = Object.keys(gatewayFieldErrors).length === 0;

  const summary = (side: ConnectionMode) => (
    <Badge tone={(side === 'provider' ? providerReady : gatewayReady) ? 'mint' : 'warn'} dot size="sm" className="q-conn__summary-badge">
      <span className="q-conn__summary-text">{side === 'provider' ? providerSummary : gatewaySummary}</span>
    </Badge>
  );

  return (
    <section className="q-conn" aria-label="Connection">
      <div className="q-conn__bar">
        {state.splitMode ? (
          <span className="q-conn__split-label">
            <Columns2 size={14} strokeWidth={1.75} /> Comparing both channels
          </span>
        ) : (
          <Segmented<ConnectionMode>
            ariaLabel="Connection mode"
            value={state.mode}
            disabled={disabled}
            onChange={(mode) => dispatch({ type: 'SET_MODE', mode })}
            options={[
              { value: 'provider', label: 'Direct Provider', icon: <KeyRound size={14} strokeWidth={1.75} /> },
              { value: 'gateway', label: 'LLM Gateway', icon: <Waypoints size={14} strokeWidth={1.75} /> },
            ]}
          />
        )}

        <div className="q-conn__summary">
          {state.splitMode ? (
            <>
              {summary('provider')}
              {summary('gateway')}
            </>
          ) : (
            summary(state.mode)
          )}
        </div>

        <button
          type="button"
          className={state.splitMode ? 'q-toggle q-toggle--on' : 'q-toggle'}
          aria-pressed={state.splitMode}
          onClick={() => dispatch({ type: 'SET_SPLIT_MODE', value: !state.splitMode })}
          disabled={disabled}
          title="Send every prompt to the Direct Provider and the LLM Gateway at the same time"
        >
          <Columns2 size={14} strokeWidth={1.75} />
          Split View
        </button>

        <button type="button" className="q-toggle" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Hide settings' : 'Edit connection'}
          <ChevronDown size={14} strokeWidth={1.75} className={expanded ? 'q-rotate-180' : undefined} />
        </button>
      </div>

      {expanded ? (
        <div className="q-conn__panel">
          {state.splitMode ? (
            <div className="q-conn__split">
              <div>
                <h3 className="q-conn__section-title">
                  <KeyRound size={14} strokeWidth={1.75} /> Direct Provider
                </h3>
                <ProviderForm fieldErrors={providerFieldErrors} disabled={disabled} />
              </div>
              <div>
                <h3 className="q-conn__section-title">
                  <Waypoints size={14} strokeWidth={1.75} /> LLM Gateway
                </h3>
                <GatewayForm fieldErrors={gatewayFieldErrors} disabled={disabled} />
              </div>
            </div>
          ) : state.mode === 'provider' ? (
            <ProviderForm fieldErrors={providerFieldErrors} disabled={disabled} />
          ) : (
            <GatewayForm fieldErrors={gatewayFieldErrors} disabled={disabled} />
          )}

          <label className="q-field q-field--full q-conn__system">
            <span className="q-field__label">System prompt</span>
            <textarea
              rows={2}
              value={state.systemPrompt}
              disabled={disabled}
              onChange={(e) => dispatch({ type: 'SET_SYSTEM_PROMPT', value: e.target.value })}
            />
          </label>
        </div>
      ) : null}
    </section>
  );
}
