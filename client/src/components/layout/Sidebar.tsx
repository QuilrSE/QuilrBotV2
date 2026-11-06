import { BrainCircuit, KeyRound, MessageSquare, Plus, Settings, Waypoints, X } from 'lucide-react';
import { useAppState } from '../../state/AppStateContext';
import { Button, Logo } from '../ui';
import type { AppView } from '../../types';

const NAV_ITEMS: Array<{ view: AppView; label: string; icon: typeof MessageSquare }> = [
  { view: 'chat', label: 'Chat', icon: MessageSquare },
  { view: 'models', label: 'Models', icon: BrainCircuit },
  { view: 'providers', label: 'Provider Connections', icon: KeyRound },
  { view: 'gateways', label: 'Gateway Connections', icon: Waypoints },
  { view: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const { state, dispatch, activeConversation } = useAppState();

  return (
    <aside className="q-sidebar">
      <div className="q-brand">
        <Logo height={26} />
        <span className="q-brand__product">Bot</span>
      </div>

      <Button
        variant="gradient"
        iconLeft={<Plus size={16} strokeWidth={2} />}
        onClick={() => {
          dispatch({ type: 'NEW_CONVERSATION' });
          dispatch({ type: 'SET_VIEW', view: 'chat' });
        }}
      >
        New chat
      </Button>

      <nav className="q-nav" aria-label="Main">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            type="button"
            aria-current={item.view === state.view ? 'page' : undefined}
            className={item.view === state.view ? 'q-nav__item q-nav__item--active' : 'q-nav__item'}
            onClick={() => dispatch({ type: 'SET_VIEW', view: item.view })}
          >
            <item.icon size={16} strokeWidth={1.75} />
            {item.label}
          </button>
        ))}
      </nav>

      <h2 className="q-sidebar__heading">Conversations</h2>
      <ul className="q-convos">
        {state.conversations.map((conversation) => (
          <li
            key={conversation.id}
            className={conversation.id === activeConversation.id ? 'q-convos__item q-convos__item--active' : 'q-convos__item'}
          >
            <button
              type="button"
              className="q-convos__title"
              title={conversation.title}
              onClick={() => {
                dispatch({ type: 'SELECT_CONVERSATION', id: conversation.id });
                dispatch({ type: 'SET_VIEW', view: 'chat' });
              }}
            >
              {conversation.title}
            </button>
            <button
              type="button"
              className="q-convos__delete"
              aria-label={`Delete “${conversation.title}”`}
              onClick={() => dispatch({ type: 'DELETE_CONVERSATION', id: conversation.id })}
            >
              <X size={13} strokeWidth={2} />
            </button>
          </li>
        ))}
      </ul>

      <p className="q-sidebar__tagline">Stay safe. Quilr it.</p>
    </aside>
  );
}
