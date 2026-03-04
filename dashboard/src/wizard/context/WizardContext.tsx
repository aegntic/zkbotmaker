/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react';
import type { CreateBotInput } from '../../types';
import { getTemplate } from '../data/templates';
import { getDefaultModel } from '../../config/providers';
import {
  type WizardState,
  type ValidationResult,
  validatePage,
  buildCreateBotInput,
} from './wizardUtils';

// Re-export types and functions for external use
export type { WizardState, ValidationResult };
export { validatePage, buildCreateBotInput };

type WizardAction =
  | { type: 'SELECT_TEMPLATE'; templateId: string }
  | { type: 'SET_BOT_NAME'; name: string }
  | { type: 'SET_HOSTNAME'; hostname: string }
  | { type: 'SET_EMOJI'; emoji: string }
  | { type: 'SET_AVATAR'; file: File | null; previewUrl: string }
  | { type: 'SET_SOUL_MARKDOWN'; markdown: string }
  | { type: 'TOGGLE_PROVIDER'; providerId: string }
  | { type: 'TOGGLE_CHANNEL'; channelId: string }
  | { type: 'SET_ROUTING_TAGS'; tags: string[] }
  | { type: 'SET_FEATURE'; feature: keyof WizardState['features']; value: unknown }
  | { type: 'SET_PROVIDER_CONFIG'; providerId: string; config: { model?: string; baseUrl?: string; apiKey?: string } }
  | { type: 'SET_CHANNEL_CONFIG'; channelId: string; config: { token: string } }
  | { type: 'RESET' };

const initialState: WizardState = {
  selectedTemplateId: null,
  botName: '',
  hostname: '',
  emoji: '🤖',
  avatarFile: null,
  avatarPreviewUrl: '',
  soulMarkdown: '',
  enabledProviders: [],
  enabledChannels: [],
  routingTags: [],
  features: {
    commands: true,
    tts: false,
    ttsVoice: 'alloy',
    sandbox: false,
    sandboxTimeout: 30,
    sessionScope: 'user',
    // NEW: Smart defaults for OpenClaw 2026.3.x
    toolsProfile: 'messaging',     // Safe default (OpenClaw 2026.3.2+)
    telegramStreaming: 'off',      // Avoids duplicate messages from streaming lane rotation
    discordStreaming: 'off',       // Avoids duplicate messages from streaming lane rotation
  },
  providerConfigs: {},
  channelConfigs: {},
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SELECT_TEMPLATE': {
      const template = getTemplate(action.templateId);
      if (!template) return state;
      return {
        ...state,
        selectedTemplateId: action.templateId,
        emoji: template.emoji || state.emoji,
        soulMarkdown: template.soulMarkdown,
      };
    }

    case 'SET_BOT_NAME':
      return { ...state, botName: action.name };

    case 'SET_HOSTNAME':
      return { ...state, hostname: action.hostname };

    case 'SET_EMOJI':
      return { ...state, emoji: action.emoji };

    case 'SET_AVATAR':
      return {
        ...state,
        avatarFile: action.file,
        avatarPreviewUrl: action.previewUrl,
      };

    case 'SET_SOUL_MARKDOWN':
      return { ...state, soulMarkdown: action.markdown };

    case 'TOGGLE_PROVIDER': {
      const { providerId } = action;
      const enabled = state.enabledProviders.includes(providerId);
      if (enabled) {
        const { [providerId]: _, ...remainingConfigs } = state.providerConfigs;
        return {
          ...state,
          enabledProviders: state.enabledProviders.filter((p) => p !== providerId),
          providerConfigs: remainingConfigs,
        };
      } else {
        return {
          ...state,
          enabledProviders: [...state.enabledProviders, providerId],
          providerConfigs: {
            ...state.providerConfigs,
            [providerId]: { model: getDefaultModel(providerId) },
          },
        };
      }
    }

    case 'TOGGLE_CHANNEL': {
      const { channelId } = action;
      const enabled = state.enabledChannels.includes(channelId);
      if (enabled) {
        const { [channelId]: _, ...remainingConfigs } = state.channelConfigs;
        return {
          ...state,
          enabledChannels: state.enabledChannels.filter((c) => c !== channelId),
          channelConfigs: remainingConfigs,
        };
      } else {
        return {
          ...state,
          enabledChannels: [...state.enabledChannels, channelId],
          channelConfigs: {
            ...state.channelConfigs,
            [channelId]: { token: '' },
          },
        };
      }
    }

    case 'SET_ROUTING_TAGS':
      return { ...state, routingTags: action.tags };

    case 'SET_FEATURE':
      return {
        ...state,
        features: {
          ...state.features,
          [action.feature]: action.value,
        },
      };

    case 'SET_PROVIDER_CONFIG':
      return {
        ...state,
        providerConfigs: {
          ...state.providerConfigs,
          [action.providerId]: {
            ...state.providerConfigs[action.providerId],
            ...action.config,
          },
        },
      };

    case 'SET_CHANNEL_CONFIG':
      return {
        ...state,
        channelConfigs: {
          ...state.channelConfigs,
          [action.channelId]: action.config,
        },
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

interface WizardContextValue {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  validate: (page: number) => ValidationResult;
  buildInput: () => CreateBotInput;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(wizardReducer, initialState);

  const validate = useCallback(
    (page: number) => validatePage(page, state),
    [state]
  );

  const buildInput = useCallback(
    () => buildCreateBotInput(state),
    [state]
  );

  return (
    <WizardContext.Provider value={{ state, dispatch, validate, buildInput }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}
