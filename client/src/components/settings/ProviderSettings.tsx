import { useState } from 'react';
import { FolderOpen, KeyRound, Save, Trash2 } from 'lucide-react';
import { useAppState } from '../../state/AppStateContext';
import { ProviderService } from '../../services/providerApi';
import { Button, Card, Field } from '../ui';
import { DEFAULT_PROVIDER_CONNECTION } from '../../state/defaults';

export function ProviderSettings() {
  const { state, dispatch, refreshSavedProviders } = useAppState();
  const [profileName, setProfileName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const p = state.provider;
  const definition = state.providerCatalog.find((d) => d.id === p.providerId);
  const isAws = definition?.authHeaderStyle === 'aws';

  async function handleSave() {
    if (!profileName.trim()) return;
    setSaving(true);
    setError('');
    try {
      await ProviderService.save({
        name: profileName.trim(),
        providerId: p.providerId,
        apiKey: p.apiKey,
        model: p.model,
        baseUrlOverride: p.baseUrlOverride,
        apiVersion: p.apiVersion,
        headers: p.headers,
        ...(isAws
          ? {
              region: p.region,
              awsAuthMode: p.awsAuthMode,
              aws: { accessKeyId: p.awsAccessKeyId, secretAccessKey: p.awsSecretAccessKey, sessionToken: p.awsSessionToken },
            }
          : {}),
      });
      setProfileName('');
      refreshSavedProviders();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLoad(id: string) {
    const { profile } = await ProviderService.reveal(id);
    dispatch({
      type: 'LOAD_PROVIDER_PROFILE',
      provider: {
        ...DEFAULT_PROVIDER_CONNECTION,
        id: profile.id,
        providerId: profile.providerId,
        apiKey: profile.apiKey ?? '',
        model: profile.model,
        baseUrlOverride: profile.baseUrlOverride ?? '',
        apiVersion: profile.apiVersion ?? '',
        region: profile.region ?? '',
        awsAuthMode: profile.awsAuthMode ?? 'api-key',
        awsAccessKeyId: profile.aws?.accessKeyId ?? '',
        awsSecretAccessKey: profile.aws?.secretAccessKey ?? '',
        awsSessionToken: profile.aws?.sessionToken ?? '',
        headers: profile.headers ?? [],
      },
    });
    dispatch({ type: 'SET_VIEW', view: 'chat' });
  }

  async function handleDelete(id: string) {
    await ProviderService.remove(id);
    refreshSavedProviders();
  }

  const summary = [definition?.label ?? p.providerId, p.model, isAws ? p.region : null].filter(Boolean).join(' · ');

  return (
    <div className="q-stack">
      <Card as="section">
        <h2 className="q-card__title">Save the current connection</h2>
        <p className="q-card__desc">
          Saves the provider, model, credentials, and headers set up in Chat. Secrets are encrypted on this machine.
        </p>
        <div className="q-inline-form">
          <Field label="Name" hint={`Will save: ${summary}`} error={error || undefined}>
            {(a11y) => (
              <input
                {...a11y}
                type="text"
                value={profileName}
                placeholder="e.g. Bedrock Mumbai, production"
                onChange={(e) => setProfileName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
            )}
          </Field>
          <Button disabled={!profileName.trim() || saving} onClick={handleSave} iconLeft={<Save size={14} strokeWidth={1.75} />}>
            {saving ? 'Saving…' : 'Save connection'}
          </Button>
        </div>
      </Card>

      <Card as="section">
        <h2 className="q-card__title">Saved connections</h2>
        {state.savedProviderProfiles.length ? (
          <ul className="q-saved">
            {state.savedProviderProfiles.map((profile) => {
              const label = state.providerCatalog.find((d) => d.id === profile.providerId)?.label ?? profile.providerId;
              return (
                <li className="q-saved__item" key={profile.id}>
                  <div className="q-saved__info">
                    <strong>{profile.name}</strong>
                    <span>
                      {label} · <span className="q-mono">{profile.model}</span>
                      {profile.region ? <> · {profile.region}</> : null}
                      {profile.hasApiKey ? (
                        <span className="q-saved__key">
                          <KeyRound size={11} strokeWidth={1.75} /> credential saved
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="q-saved__actions">
                    <Button variant="outline" size="sm" onClick={() => handleLoad(profile.id)} iconLeft={<FolderOpen size={13} strokeWidth={1.75} />}>
                      Load in Chat
                    </Button>
                    <Button variant="ghost" size="sm" className="q-btn--ghost-danger" onClick={() => handleDelete(profile.id)} iconLeft={<Trash2 size={13} strokeWidth={1.75} />}>
                      Delete
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="q-card__empty">Nothing saved yet. Set up a provider in Chat, then name and save it above.</p>
        )}
      </Card>
    </div>
  );
}
