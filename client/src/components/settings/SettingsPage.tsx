import { useState } from 'react';
import { ProviderSettings } from './ProviderSettings';
import { GatewaySettings } from './GatewaySettings';
import { AdvancedSettings } from './AdvancedSettings';

type Tab = 'providers' | 'gateways' | 'advanced';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'providers', label: 'Providers' },
  { id: 'gateways', label: 'Gateways' },
  { id: 'advanced', label: 'Requests' },
];

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('providers');

  return (
    <div className="q-page">
      <div className="q-tabs" role="tablist" aria-label="Settings sections">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            className={tab === entry.id ? 'q-tabs__tab q-tabs__tab--active' : 'q-tabs__tab'}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      {tab === 'providers' ? <ProviderSettings /> : null}
      {tab === 'gateways' ? <GatewaySettings /> : null}
      {tab === 'advanced' ? <AdvancedSettings /> : null}
    </div>
  );
}
