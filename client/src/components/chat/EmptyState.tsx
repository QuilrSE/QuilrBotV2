const SUGGESTIONS = [
  'Summarize the main controls in the RBI’s guidance on AI model risk for banks.',
  'Compare calling a model directly with routing it through an AI gateway, for an audit team.',
  'Write a Python script that renames files by their creation date.',
];

export function EmptyState({ split, onSuggestion }: { split: boolean; onSuggestion: (text: string) => void }) {
  return (
    <div className="q-empty">
      <div className="q-empty__inner">
        <h2>{split ? 'One prompt, two paths.' : 'Test the model, or the guardrail in front of it.'}</h2>
        <p>
          {split
            ? 'Split View sends each prompt straight to the provider and through your gateway at once, so you can see what the gateway changes or stops.'
            : 'Set up a connection above, then send a prompt. Every reply is marked allowed, blocked, or failed. Quick Prompt has ready-made probes for testing policies.'}
        </p>
        <div className="q-empty__suggestions">
          {SUGGESTIONS.map((suggestion) => (
            <button key={suggestion} type="button" className="q-suggestion" onClick={() => onSuggestion(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
