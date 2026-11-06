import { useAppState } from '../../state/AppStateContext';
import { maskHeaderList, maskSecret } from '../../utils/masking';
import { Card } from '../ui';
import type { ConnectionMode, ProviderDefinition } from '../../types';

const DIALECT_LABEL: Record<string, string> = {
  openai: 'OpenAI Chat Completions',
  anthropic: 'Anthropic Messages',
  'bedrock-converse': 'Bedrock Converse',
};

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="q-kv">
      <dt>{label}</dt>
      <dd className={mono ? 'q-mono' : undefined} title={value}>
        {value}
      </dd>
    </div>
  );
}

function providerEndpoint(definition: ProviderDefinition | undefined, baseUrlOverride: string, region: string): string {
  if (!definition) return '—';
  if (definition.allowsBaseUrlOverride && baseUrlOverride.trim()) return baseUrlOverride.trim();
  if (!definition.defaultBaseUrl) return definition.hasServerBaseUrl ? 'Server default' : 'Not set';
  return definition.defaultBaseUrl.replace('{region}', region || '{region}');
}

function ChannelDetails({ side }: { side: ConnectionMode }) {
  const { state } = useAppState();
  const { provider, gateway } = state;
  const definition = state.providerCatalog.find((p) => p.id === provider.providerId);
  const headers = maskHeaderList((side === 'provider' ? provider.headers : gateway.headers).filter((h) => h.enabled && h.name.trim()));
  const meta = state.requestMetadata[side];
  const isAws = definition?.authHeaderStyle === 'aws';

  let credential = 'Not set';
  if (side === 'gateway') {
    credential = gateway.authMethod === 'none' ? 'None' : gateway.apiKey ? maskSecret(gateway.apiKey) : 'Not set';
  } else if (isAws && provider.awsAuthMode === 'iam') {
    credential = provider.awsAccessKeyId ? maskSecret(provider.awsAccessKeyId) : definition?.hasServerCredentials ? 'Server IAM' : 'Not set';
  } else {
    credential = provider.apiKey ? maskSecret(provider.apiKey) : definition?.hasServerCredentials ? 'Server key' : 'Not set';
  }

  return (
    <>
      <Card padding="sm" as="section" aria-label={`${side === 'provider' ? 'Direct Provider' : 'LLM Gateway'} details`}>
        <h3 className="q-panel__title">{side === 'provider' ? 'Direct Provider' : 'LLM Gateway'}</h3>
        <dl>
          {side === 'provider' ? (
            <>
              <Row label="Provider" value={definition?.label ?? '—'} />
              <Row label="Dialect" value={definition ? DIALECT_LABEL[definition.apiStyle] : '—'} />
              {isAws ? <Row label="Region" value={provider.region || '—'} mono /> : null}
              {isAws ? <Row label="Auth" value={provider.awsAuthMode === 'iam' ? 'IAM · SigV4' : 'Bedrock API key'} /> : null}
              <Row label="Model" value={provider.model || '—'} mono />
              <Row label="Endpoint" value={providerEndpoint(definition, provider.baseUrlOverride, provider.region)} mono />
            </>
          ) : (
            <>
              <Row label="Gateway" value={gateway.name || '—'} />
              <Row label="Dialect" value={DIALECT_LABEL[gateway.apiStyle]} />
              <Row label="Model" value={gateway.model || '—'} mono />
              <Row label="Endpoint" value={gateway.baseUrl ? `${gateway.baseUrl.replace(/\/+$/, '')}${gateway.endpointPath}` : '—'} mono />
              <Row label="Auth" value={gateway.authMethod === 'header' ? gateway.authHeaderName || 'Custom header' : gateway.authMethod} />
            </>
          )}
          <Row label="Credential" value={credential} mono />
          {meta.finishedAt && meta.startedAt ? <Row label="Last reply" value={`${((meta.finishedAt - meta.startedAt) / 1000).toFixed(1)} s`} mono /> : null}
        </dl>
      </Card>

      <Card padding="sm" as="section" aria-label="Custom headers">
        <h3 className="q-panel__title">Headers sent</h3>
        {headers.length ? (
          <dl>
            {headers.map((h) => (
              <Row key={h.name} label={h.name} value={h.value || '(empty)'} mono />
            ))}
          </dl>
        ) : (
          <p className="q-panel__empty">No custom headers.</p>
        )}
      </Card>
    </>
  );
}

export function RightPanel() {
  const { state } = useAppState();
  return (
    <aside className="q-inspector" aria-label="Connection inspector">
      {state.splitMode ? (
        <>
          <ChannelDetails side="provider" />
          <ChannelDetails side="gateway" />
        </>
      ) : (
        <ChannelDetails side={state.mode} />
      )}
    </aside>
  );
}
