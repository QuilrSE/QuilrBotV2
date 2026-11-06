import { useAppState } from './state/AppStateContext';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { RightPanel } from './components/layout/RightPanel';
import { ChatWindow } from './components/chat/ChatWindow';
import { SettingsPage } from './components/settings/SettingsPage';
import { GatewaysPage } from './components/pages/GatewaysPage';
import { ModelsPage } from './components/pages/ModelsPage';
import { ProvidersPage } from './components/pages/ProvidersPage';

function App() {
  const { state } = useAppState();

  return (
    <div className={state.view === 'chat' ? 'q-shell q-shell--chat' : 'q-shell'}>
      <Sidebar />
      <main className="q-main">
        <TopBar />
        {state.view === 'chat' ? <ChatWindow /> : null}
        {state.view === 'models' ? <ModelsPage /> : null}
        {state.view === 'providers' ? <ProvidersPage /> : null}
        {state.view === 'gateways' ? <GatewaysPage /> : null}
        {state.view === 'settings' ? <SettingsPage /> : null}
      </main>
      {state.view === 'chat' ? <RightPanel /> : null}
    </div>
  );
}

export default App;
