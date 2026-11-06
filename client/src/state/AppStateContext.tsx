import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type {
  AppSettings,
  AppView,
  ChatMessage,
  Conversation,
  ConnectionMode,
  GatewayConnectionState,
  HeaderEntry,
  Notice,
  ProviderConnectionState,
  ProviderDefinition,
  RequestMetadata,
  RequestMetadataEntry,
  SavedGatewayProfile,
  SavedProviderProfile,
  StreamingState,
} from '../types';
import { readLocal, writeLocal } from '../utils/storage';
import { createId } from '../utils/id';
import { inferGatewayApiStyle } from '../utils/validation';
import { ProviderService } from '../services/providerApi';
import { GatewayService } from '../services/gatewayApi';
import { ConfigurationService } from '../services/settingsApi';
import {
  DEFAULT_GATEWAY_CONNECTION,
  DEFAULT_PROVIDER_CONNECTION,
  DEFAULT_SYSTEM_PROMPT,
  PROVIDER_SECRET_FIELDS,
  createConversation,
} from './defaults';

interface AppState {
  view: AppView;
  mode: ConnectionMode;
  splitMode: boolean;
  provider: ProviderConnectionState;
  gateway: GatewayConnectionState;
  systemPrompt: string;
  conversations: Conversation[];
  activeConversationId: string;
  streaming: StreamingState;
  notice: Notice | null;
  requestMetadata: RequestMetadata;
  providerCatalog: ProviderDefinition[];
  savedProviderProfiles: SavedProviderProfile[];
  savedGatewayProfiles: SavedGatewayProfile[];
  appSettings: AppSettings | null;
}

type Action =
  | { type: 'SET_VIEW'; view: AppView }
  | { type: 'SET_MODE'; mode: ConnectionMode }
  | { type: 'SET_SPLIT_MODE'; value: boolean }
  | { type: 'PATCH_PROVIDER'; patch: Partial<ProviderConnectionState> }
  | { type: 'PATCH_GATEWAY'; patch: Partial<GatewayConnectionState> }
  | { type: 'SET_PROVIDER_HEADERS'; headers: HeaderEntry[] }
  | { type: 'SET_GATEWAY_HEADERS'; headers: HeaderEntry[] }
  | { type: 'SET_SYSTEM_PROMPT'; value: string }
  | { type: 'NEW_CONVERSATION' }
  | { type: 'SELECT_CONVERSATION'; id: string }
  | { type: 'DELETE_CONVERSATION'; id: string }
  | { type: 'CLEAR_ACTIVE_CONVERSATION' }
  | { type: 'APPEND_MESSAGE'; message: ChatMessage }
  | { type: 'PATCH_MESSAGE'; id: string; patch: Partial<ChatMessage> }
  | { type: 'REMOVE_MESSAGE'; id: string }
  | { type: 'SET_STREAMING_SIDE'; side: ConnectionMode; value: boolean }
  | { type: 'SET_NOTICE'; notice: Notice | null }
  | { type: 'SET_REQUEST_METADATA'; side: ConnectionMode; metadata: RequestMetadataEntry }
  | { type: 'LOAD_GATEWAY_PROFILE'; gateway: GatewayConnectionState }
  | { type: 'LOAD_PROVIDER_PROFILE'; provider: ProviderConnectionState }
  | { type: 'SET_CATALOG'; catalog: ProviderDefinition[] }
  | { type: 'SET_SAVED_PROVIDERS'; profiles: SavedProviderProfile[] }
  | { type: 'SET_SAVED_GATEWAYS'; profiles: SavedGatewayProfile[] }
  | { type: 'SET_APP_SETTINGS'; settings: AppSettings };

const STORAGE_KEYS = {
  mode: 'connection-mode',
  splitMode: 'split-mode',
  provider: 'provider-connection',
  gateway: 'gateway-connection',
  systemPrompt: 'system-prompt',
  conversations: 'conversations',
  activeConversationId: 'active-conversation-id',
};

function loadInitialState(): AppState {
  const conversations = readLocal<Conversation[]>(STORAGE_KEYS.conversations, []);
  const initialConversation = conversations[0] ?? createConversation();
  const conversationList = conversations.length ? conversations : [initialConversation];

  const storedProvider = readLocal<Partial<ProviderConnectionState>>(STORAGE_KEYS.provider, {});
  const storedGateway = readLocal<Partial<GatewayConnectionState>>(STORAGE_KEYS.gateway, {});
  const provider: ProviderConnectionState = { ...DEFAULT_PROVIDER_CONNECTION, ...storedProvider };
  for (const field of PROVIDER_SECRET_FIELDS) provider[field] = '';

  return {
    view: 'chat',
    mode: readLocal(STORAGE_KEYS.mode, 'provider' as ConnectionMode),
    splitMode: readLocal(STORAGE_KEYS.splitMode, false),
    provider,
    gateway: {
      ...DEFAULT_GATEWAY_CONNECTION,
      ...storedGateway,
      // Older versions shared one model between both channels.
      model: storedGateway.model ?? provider.model,
      apiStyle: storedGateway.apiStyle ?? inferGatewayApiStyle(storedGateway.endpointPath ?? ''),
      apiKey: '',
    },
    systemPrompt: readLocal(STORAGE_KEYS.systemPrompt, DEFAULT_SYSTEM_PROMPT),
    conversations: conversationList,
    activeConversationId: readLocal(STORAGE_KEYS.activeConversationId, conversationList[0].id),
    streaming: { provider: false, gateway: false },
    notice: null,
    requestMetadata: { provider: {}, gateway: {} },
    providerCatalog: [],
    savedProviderProfiles: [],
    savedGatewayProfiles: [],
    appSettings: null,
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, view: action.view };
    case 'SET_MODE':
      return { ...state, mode: action.mode, notice: null };
    case 'SET_SPLIT_MODE':
      return { ...state, splitMode: action.value, notice: null };
    case 'PATCH_PROVIDER':
      return { ...state, provider: { ...state.provider, ...action.patch } };
    case 'PATCH_GATEWAY':
      return { ...state, gateway: { ...state.gateway, ...action.patch } };
    case 'SET_PROVIDER_HEADERS':
      return { ...state, provider: { ...state.provider, headers: action.headers } };
    case 'SET_GATEWAY_HEADERS':
      return { ...state, gateway: { ...state.gateway, headers: action.headers } };
    case 'SET_SYSTEM_PROMPT':
      return { ...state, systemPrompt: action.value };
    case 'LOAD_GATEWAY_PROFILE':
      return { ...state, gateway: action.gateway, mode: 'gateway' };
    case 'LOAD_PROVIDER_PROFILE':
      return { ...state, provider: action.provider, mode: 'provider' };

    case 'NEW_CONVERSATION': {
      const conversation = createConversation();
      return {
        ...state,
        conversations: [conversation, ...state.conversations],
        activeConversationId: conversation.id,
        notice: null,
      };
    }

    case 'SELECT_CONVERSATION':
      return { ...state, activeConversationId: action.id, notice: null };

    case 'DELETE_CONVERSATION': {
      const remaining = state.conversations.filter((conversation) => conversation.id !== action.id);
      const nextList = remaining.length ? remaining : [createConversation()];
      const nextActive = action.id === state.activeConversationId ? nextList[0].id : state.activeConversationId;
      return { ...state, conversations: nextList, activeConversationId: nextActive };
    }

    case 'CLEAR_ACTIVE_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.map((conversation) =>
          conversation.id === state.activeConversationId
            ? { ...conversation, messages: [], updatedAt: Date.now() }
            : conversation,
        ),
      };

    case 'APPEND_MESSAGE': {
      return {
        ...state,
        conversations: state.conversations.map((conversation) => {
          if (conversation.id !== state.activeConversationId) return conversation;
          const isFirstUserMessage = conversation.messages.length === 0 && action.message.role === 'user';
          return {
            ...conversation,
            messages: [...conversation.messages, action.message],
            updatedAt: Date.now(),
            title: isFirstUserMessage ? deriveTitle(action.message.content) : conversation.title,
          };
        }),
      };
    }

    case 'PATCH_MESSAGE':
      return {
        ...state,
        conversations: state.conversations.map((conversation) =>
          conversation.id === state.activeConversationId
            ? {
                ...conversation,
                messages: conversation.messages.map((message) =>
                  message.id === action.id ? { ...message, ...action.patch } : message,
                ),
              }
            : conversation,
        ),
      };

    case 'REMOVE_MESSAGE':
      return {
        ...state,
        conversations: state.conversations.map((conversation) =>
          conversation.id === state.activeConversationId
            ? { ...conversation, messages: conversation.messages.filter((message) => message.id !== action.id) }
            : conversation,
        ),
      };

    case 'SET_STREAMING_SIDE':
      return { ...state, streaming: { ...state.streaming, [action.side]: action.value } };
    case 'SET_NOTICE':
      return { ...state, notice: action.notice };
    case 'SET_REQUEST_METADATA':
      return { ...state, requestMetadata: { ...state.requestMetadata, [action.side]: action.metadata } };
    case 'SET_CATALOG':
      return { ...state, providerCatalog: action.catalog };
    case 'SET_SAVED_PROVIDERS':
      return { ...state, savedProviderProfiles: action.profiles };
    case 'SET_SAVED_GATEWAYS':
      return { ...state, savedGatewayProfiles: action.profiles };
    case 'SET_APP_SETTINGS':
      return { ...state, appSettings: action.settings };

    default:
      return state;
  }
}

function deriveTitle(content: string): string {
  const trimmed = content.trim().replace(/\s+/g, ' ');
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed || 'New chat';
}

interface AppStateContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  activeConversation: Conversation;
  refreshSavedProviders: () => void;
  refreshSavedGateways: () => void;
  refreshSettings: () => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);

  useEffect(() => writeLocal(STORAGE_KEYS.mode, state.mode), [state.mode]);
  useEffect(() => writeLocal(STORAGE_KEYS.splitMode, state.splitMode), [state.splitMode]);
  useEffect(() => {
    const persisted: Partial<ProviderConnectionState> = { ...state.provider };
    for (const field of PROVIDER_SECRET_FIELDS) delete persisted[field];
    writeLocal(STORAGE_KEYS.provider, persisted);
  }, [state.provider]);
  useEffect(() => {
    const { apiKey, ...rest } = state.gateway;
    writeLocal(STORAGE_KEYS.gateway, rest);
  }, [state.gateway]);
  useEffect(() => writeLocal(STORAGE_KEYS.systemPrompt, state.systemPrompt), [state.systemPrompt]);
  useEffect(() => writeLocal(STORAGE_KEYS.conversations, state.conversations), [state.conversations]);
  useEffect(
    () => writeLocal(STORAGE_KEYS.activeConversationId, state.activeConversationId),
    [state.activeConversationId],
  );

  const refreshSavedProviders = React.useCallback(() => {
    ProviderService.listSaved()
      .then(({ profiles }) => dispatch({ type: 'SET_SAVED_PROVIDERS', profiles }))
      .catch(() => undefined);
  }, []);

  const refreshSavedGateways = React.useCallback(() => {
    GatewayService.list()
      .then(({ gateways }) => dispatch({ type: 'SET_SAVED_GATEWAYS', profiles: gateways }))
      .catch(() => undefined);
  }, []);

  const refreshSettings = React.useCallback(() => {
    ConfigurationService.get()
      .then(({ settings }) => dispatch({ type: 'SET_APP_SETTINGS', settings }))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    ProviderService.getCatalog()
      .then(({ providers }) => dispatch({ type: 'SET_CATALOG', catalog: providers }))
      .catch(() => undefined);
    refreshSavedProviders();
    refreshSavedGateways();
    refreshSettings();
  }, [refreshSavedProviders, refreshSavedGateways, refreshSettings]);

  const activeConversation = useMemo(
    () =>
      state.conversations.find((conversation) => conversation.id === state.activeConversationId) ??
      state.conversations[0],
    [state.conversations, state.activeConversationId],
  );

  const value = useMemo(
    () => ({ state, dispatch, activeConversation, refreshSavedProviders, refreshSavedGateways, refreshSettings }),
    [state, activeConversation, refreshSavedProviders, refreshSavedGateways, refreshSettings],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within an AppStateProvider.');
  return ctx;
}

export function useHeaderId(): string {
  return createId();
}
