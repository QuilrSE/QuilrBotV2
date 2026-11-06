import { ExternalLink, KeyRound, ShieldCheck } from 'lucide-react';
import { useAppState } from '../../state/AppStateContext';
import { HeaderEditor } from './HeaderEditor';
import { Field, Segmented } from '../ui';
import { providerNeedsBaseUrl } from '../../utils/validation';
import type { AwsAuthMode, FieldErrors, ProviderConnectionState } from '../../types';

interface ProviderFormProps {
  fieldErrors: FieldErrors;
  disabled: boolean;
}

/** Direct Provider connection form. Bedrock gets region + auth-mode controls; everything else is config-driven. */
export function ProviderForm({ fieldErrors, disabled }: ProviderFormProps) {
  const { state, dispatch } = useAppState();
  const provider = state.provider;
  const definition = state.providerCatalog.find((p) => p.id === provider.providerId);
  const isAws = definition?.authHeaderStyle === 'aws';
  const serverCreds = Boolean(definition?.hasServerCredentials);
  const patch = (value: Partial<ProviderConnectionState>) => dispatch({ type: 'PATCH_PROVIDER', patch: value });
  const listId = `models-${provider.providerId}`;

  const serverHint = serverCreds ? 'Leave blank to use the credential configured on the QuilrBot server.' : undefined;

  return (
    <div className="q-form-grid">
      <Field label="Provider" hint={definition?.description}>
        {(a11y) => (
          <select
            {...a11y}
            value={provider.providerId}
            disabled={disabled}
            onChange={(event) => {
              const next = state.providerCatalog.find((p) => p.id === event.target.value);
              patch({
                providerId: event.target.value,
                model: next?.defaultModels[0] ?? '',
                baseUrlOverride: '',
                region: next?.regions ? provider.region || next.defaultRegion || '' : provider.region,
              });
            }}
          >
            {state.providerCatalog.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field
        label={isAws ? 'Model or inference profile' : 'Model'}
        error={fieldErrors.model}
        hint={
          isAws
            ? 'Most Claude models need a geo or global inference profile (us., eu., in., global.), or paste an inference-profile ARN.'
            : 'Pick a suggestion or type any model id the provider accepts.'
        }
      >
        {(a11y) => (
          <>
            <input
              {...a11y}
              type="text"
              list={listId}
              value={provider.model}
              disabled={disabled}
              spellCheck={false}
              placeholder={definition?.defaultModels[0]}
              onChange={(event) => patch({ model: event.target.value })}
            />
            <datalist id={listId}>
              {definition?.defaultModels.map((model) => <option key={model} value={model} />)}
            </datalist>
          </>
        )}
      </Field>

      {isAws ? (
        <>
          <Field label="AWS region" error={fieldErrors.region}>
            {(a11y) => (
              <select {...a11y} value={provider.region} disabled={disabled} onChange={(event) => patch({ region: event.target.value })}>
                <option value="" disabled>
                  Choose a region
                </option>
                {definition?.regions?.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <div className="q-field">
            <span className="q-field__label">Authenticate with</span>
            <Segmented<AwsAuthMode>
              ariaLabel="Bedrock authentication method"
              value={provider.awsAuthMode}
              disabled={disabled}
              onChange={(awsAuthMode) => patch({ awsAuthMode })}
              options={[
                { value: 'api-key', label: 'Bedrock API key', icon: <KeyRound size={14} strokeWidth={1.75} /> },
                { value: 'iam', label: 'IAM access keys', icon: <ShieldCheck size={14} strokeWidth={1.75} /> },
              ]}
            />
            <p className="q-field__hint">
              {provider.awsAuthMode === 'api-key'
                ? 'Sent as a bearer token. Generate one in the Bedrock console under API keys.'
                : 'The relay signs each request with SigV4. Needs bedrock:InvokeModel and bedrock:InvokeModelWithResponseStream.'}
            </p>
          </div>

          {provider.awsAuthMode === 'api-key' ? (
            <Field label="Bedrock API key" error={fieldErrors.apiKey} hint={serverHint ?? 'Kept in this tab’s memory only, unless you save a profile.'}>
              {(a11y) => (
                <input
                  {...a11y}
                  type="password"
                  autoComplete="off"
                  value={provider.apiKey}
                  disabled={disabled}
                  placeholder={serverCreds ? 'Using server credential' : 'ABSK…'}
                  onChange={(event) => patch({ apiKey: event.target.value })}
                />
              )}
            </Field>
          ) : (
            <>
              <Field label="Access key ID" error={fieldErrors.awsAccessKeyId} hint={serverHint}>
                {(a11y) => (
                  <input
                    {...a11y}
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    value={provider.awsAccessKeyId}
                    disabled={disabled}
                    placeholder={serverCreds ? 'Using server credentials' : 'AKIA… or ASIA…'}
                    onChange={(event) => patch({ awsAccessKeyId: event.target.value })}
                  />
                )}
              </Field>
              <Field label="Secret access key" error={fieldErrors.awsSecretAccessKey}>
                {(a11y) => (
                  <input
                    {...a11y}
                    type="password"
                    autoComplete="off"
                    value={provider.awsSecretAccessKey}
                    disabled={disabled}
                    onChange={(event) => patch({ awsSecretAccessKey: event.target.value })}
                  />
                )}
              </Field>
              <Field label="Session token" optional hint="Only for temporary credentials (ASIA… keys from STS or SSO).">
                {(a11y) => (
                  <input
                    {...a11y}
                    type="password"
                    autoComplete="off"
                    value={provider.awsSessionToken}
                    disabled={disabled}
                    onChange={(event) => patch({ awsSessionToken: event.target.value })}
                  />
                )}
              </Field>
            </>
          )}

          <Field label="VPC endpoint" optional error={fieldErrors.baseUrlOverride} hint="For PrivateLink. Leave blank to use the public regional endpoint.">
            {(a11y) => (
              <input
                {...a11y}
                type="url"
                spellCheck={false}
                value={provider.baseUrlOverride}
                disabled={disabled}
                placeholder={`https://bedrock-runtime.${provider.region || 'us-east-1'}.amazonaws.com`}
                onChange={(event) => patch({ baseUrlOverride: event.target.value })}
              />
            )}
          </Field>
        </>
      ) : (
        <>
          <Field label="API key" error={fieldErrors.apiKey} hint={serverHint ?? 'Kept in this tab’s memory only, unless you save a profile.'}>
            {(a11y) => (
              <input
                {...a11y}
                type="password"
                autoComplete="off"
                value={provider.apiKey}
                disabled={disabled}
                placeholder={serverCreds ? 'Using server credential' : ''}
                onChange={(event) => patch({ apiKey: event.target.value })}
              />
            )}
          </Field>

          {definition?.allowsBaseUrlOverride ? (
            <Field
              label={definition.endpointStyle === 'azure-openai' ? 'Endpoint' : 'Base URL'}
              optional={!providerNeedsBaseUrl(definition)}
              error={fieldErrors.baseUrlOverride}
              hint={
                definition.endpointStyle === 'azure-openai'
                  ? 'Your resource endpoint uses the v1 API. A full …/openai/deployments/<name> URL uses the legacy dated API.'
                  : undefined
              }
            >
              {(a11y) => (
                <input
                  {...a11y}
                  type="url"
                  spellCheck={false}
                  value={provider.baseUrlOverride}
                  disabled={disabled}
                  placeholder={
                    definition.defaultBaseUrl ||
                    (definition.hasServerBaseUrl ? 'Using server endpoint' : 'https://your-resource.openai.azure.com')
                  }
                  onChange={(event) => patch({ baseUrlOverride: event.target.value })}
                />
              )}
            </Field>
          ) : null}

          {definition?.endpointStyle === 'azure-openai' && /\/openai\/deployments\//i.test(provider.baseUrlOverride) ? (
            <Field label="API version" optional hint="Defaults to 2024-10-21.">
              {(a11y) => (
                <input
                  {...a11y}
                  type="text"
                  value={provider.apiVersion}
                  disabled={disabled}
                  placeholder="2024-10-21"
                  onChange={(event) => patch({ apiVersion: event.target.value })}
                />
              )}
            </Field>
          ) : null}
        </>
      )}

      <div className="q-field q-field--full">
        <span className="q-field__label">Custom headers</span>
        <HeaderEditor
          headers={provider.headers}
          disabled={disabled}
          onChange={(headers) => dispatch({ type: 'SET_PROVIDER_HEADERS', headers })}
        />
        {fieldErrors.headers ? <p className="q-field__error">{fieldErrors.headers}</p> : null}
      </div>

      {definition?.docsUrl ? (
        <a className="q-docs-link" href={definition.docsUrl} target="_blank" rel="noreferrer">
          {definition.label} API reference
          <ExternalLink size={12} strokeWidth={1.75} />
        </a>
      ) : null}
    </div>
  );
}
