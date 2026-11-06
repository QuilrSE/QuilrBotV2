import { ExternalLink, Server } from 'lucide-react';
import { useAppState } from '../../state/AppStateContext';
import { Badge, Card } from '../ui';

const DIALECT: Record<string, string> = {
  openai: 'Chat Completions',
  anthropic: 'Messages API',
  'bedrock-converse': 'Converse API',
};

/** Every registered provider and its suggested models. Picking one loads it into Chat. */
export function ModelsPage() {
  const { state, dispatch } = useAppState();

  function useInChat(providerId: string, model: string) {
    const definition = state.providerCatalog.find((p) => p.id === providerId);
    dispatch({ type: 'SET_MODE', mode: 'provider' });
    dispatch({ type: 'SET_SPLIT_MODE', value: false });
    dispatch({
      type: 'PATCH_PROVIDER',
      patch: {
        providerId,
        model,
        ...(providerId !== state.provider.providerId ? { baseUrlOverride: '' } : {}),
        ...(definition?.regions && !state.provider.region ? { region: definition.defaultRegion ?? '' } : {}),
      },
    });
    dispatch({ type: 'SET_VIEW', view: 'chat' });
  }

  return (
    <div className="q-page">
      <p className="q-page__lede">
        Choose a model to open it in Chat. These are suggestions; any model id the provider accepts can be typed into the connection form.
      </p>
      <div className="q-model-grid">
        {state.providerCatalog.map((provider) => (
          <Card key={provider.id} as="article" className="q-model-card" accentEdge={provider.id === 'aws-bedrock'}>
            <header className="q-model-card__head">
              <h2>{provider.label}</h2>
              <Badge size="sm" tone={provider.apiStyle === 'bedrock-converse' ? 'blue' : provider.apiStyle === 'anthropic' ? 'purple' : 'neutral'}>
                {DIALECT[provider.apiStyle]}
              </Badge>
            </header>
            <p>{provider.description}</p>
            {provider.hasServerCredentials ? (
              <p className="q-model-card__server">
                <Server size={12} strokeWidth={1.75} /> Credential configured on the server
              </p>
            ) : null}
            <div className="q-model-card__models">
              {provider.defaultModels.map((model) => (
                <button key={model} type="button" className="q-model-pill" onClick={() => useInChat(provider.id, model)}>
                  {model}
                </button>
              ))}
            </div>
            {provider.docsUrl ? (
              <a className="q-docs-link" href={provider.docsUrl} target="_blank" rel="noreferrer">
                API reference <ExternalLink size={12} strokeWidth={1.75} />
              </a>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
