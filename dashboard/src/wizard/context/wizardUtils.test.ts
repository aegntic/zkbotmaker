import { describe, it, expect } from 'vitest';
import { validatePage, buildCreateBotInput } from './wizardUtils';
import type { WizardState } from './wizardUtils';

function createDefaultState(): WizardState {
  return {
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
      commands: false,
      tts: false,
      ttsVoice: 'alloy',
      sandbox: false,
      sandboxTimeout: 30,
      sessionScope: 'user',
      toolsProfile: 'messaging',
      telegramStreaming: 'off',
      discordStreaming: 'off',
    },
    providerConfigs: {},
    channelConfigs: {},
  };
}

describe('validatePage', () => {
  describe('page 0 (Templates)', () => {
    it('should always be valid', () => {
      const state = createDefaultState();
      const result = validatePage(0, state);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should be valid even with template selected', () => {
      const state = createDefaultState();
      state.selectedTemplateId = 'some-template';
      const result = validatePage(0, state);
      expect(result.valid).toBe(true);
    });
  });

  describe('page 1 (Personality)', () => {
    it('should require bot name', () => {
      const state = createDefaultState();
      state.hostname = 'valid-hostname';
      const result = validatePage(1, state);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Bot name is required');
    });

    it('should require hostname', () => {
      const state = createDefaultState();
      state.botName = 'My Bot';
      const result = validatePage(1, state);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Hostname is required');
    });

    it('should require lowercase hostname', () => {
      const state = createDefaultState();
      state.botName = 'My Bot';
      state.hostname = 'MyBot';
      const result = validatePage(1, state);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Hostname must be lowercase letters, numbers, and hyphens only');
    });

    it('should reject hostname with spaces', () => {
      const state = createDefaultState();
      state.botName = 'My Bot';
      state.hostname = 'my bot';
      const result = validatePage(1, state);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Hostname must be lowercase letters, numbers, and hyphens only');
    });

    it('should require hostname of at least 2 chars', () => {
      const state = createDefaultState();
      state.botName = 'My Bot';
      state.hostname = 'a';
      const result = validatePage(1, state);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Hostname must be at least 2 characters');
    });

    it('should require hostname of at most 64 chars', () => {
      const state = createDefaultState();
      state.botName = 'My Bot';
      state.hostname = 'a'.repeat(65);
      const result = validatePage(1, state);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Hostname must be at most 64 characters');
    });

    it('should accept valid hostname', () => {
      const state = createDefaultState();
      state.botName = 'My Bot';
      state.hostname = 'my-bot-123';
      const result = validatePage(1, state);
      expect(result.valid).toBe(true);
    });
  });

  describe('page 2 (Toggles)', () => {
    it('should require at least one provider', () => {
      const state = createDefaultState();
      state.enabledChannels = ['telegram'];
      const result = validatePage(2, state);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Select at least one LLM provider');
    });

    it('should require at least one channel', () => {
      const state = createDefaultState();
      state.enabledProviders = ['openai'];
      const result = validatePage(2, state);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Select at least one channel');
    });

    it('should be valid with provider and channel', () => {
      const state = createDefaultState();
      state.enabledProviders = ['openai'];
      state.enabledChannels = ['telegram'];
      const result = validatePage(2, state);
      expect(result.valid).toBe(true);
    });

    it('should accept multiple providers and channels', () => {
      const state = createDefaultState();
      state.enabledProviders = ['openai', 'anthropic'];
      state.enabledChannels = ['telegram', 'discord'];
      const result = validatePage(2, state);
      expect(result.valid).toBe(true);
    });
  });

  describe('page 3 (Config)', () => {
    it('should not require API keys (may exist in keyring-proxy)', () => {
      const state = createDefaultState();
      state.enabledProviders = ['openai'];
      state.enabledChannels = ['telegram'];
      state.providerConfigs = { openai: { model: 'gpt-4' } };
      state.channelConfigs = { telegram: { token: 'bot-token' } };
      const result = validatePage(3, state);
      expect(result.valid).toBe(true);
    });

    it('should require token for each enabled channel', () => {
      const state = createDefaultState();
      state.enabledProviders = ['openai'];
      state.enabledChannels = ['telegram'];
      state.providerConfigs = { openai: { model: 'gpt-4', apiKey: 'sk-test-key' } };
      const result = validatePage(3, state);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token required for telegram');
    });

    it('should be valid with all configs provided', () => {
      const state = createDefaultState();
      state.enabledProviders = ['openai'];
      state.enabledChannels = ['telegram'];
      state.providerConfigs = { openai: { model: 'gpt-4', apiKey: 'sk-test-key' } };
      state.channelConfigs = { telegram: { token: 'bot-token' } };
      const result = validatePage(3, state);
      expect(result.valid).toBe(true);
    });
  });

  describe('page 4 (Summary)', () => {
    it('should always be valid', () => {
      const state = createDefaultState();
      const result = validatePage(4, state);
      expect(result.valid).toBe(true);
    });
  });

  describe('unknown page', () => {
    it('should be valid for unknown page numbers', () => {
      const state = createDefaultState();
      const result = validatePage(99, state);
      expect(result.valid).toBe(true);
    });
  });
});

describe('buildCreateBotInput', () => {
  it('should build correct output shape', () => {
    const state = createDefaultState();
    state.botName = 'Test Bot';
    state.hostname = 'test-bot';
    state.emoji = '🤖';
    state.soulMarkdown = 'I am a test bot.';
    state.enabledProviders = ['openai'];
    state.enabledChannels = ['telegram'];
    state.providerConfigs = { openai: { model: 'gpt-4' } };
    state.channelConfigs = { telegram: { token: 'bot-token' } };

    const result = buildCreateBotInput(state);

    expect(result).toEqual({
      name: 'Test Bot',
      hostname: 'test-bot',
      emoji: '🤖',
      avatarUrl: undefined,
      providers: [{ providerId: 'openai', model: 'gpt-4' }],
      primaryProvider: 'openai',
      channels: [{ channelType: 'telegram', token: 'bot-token' }],
      persona: {
        name: 'Test Bot',
        soulMarkdown: 'I am a test bot.',
      },
      features: {
        commands: false,
        tts: false,
        ttsVoice: undefined,
        sandbox: false,
        sandboxTimeout: undefined,
        sessionScope: 'user',
        toolsProfile: 'messaging',
        telegramStreaming: 'off',
        discordStreaming: 'off',
      },
      tags: undefined,
    });
  });

  it('should include avatarUrl when present', () => {
    const state = createDefaultState();
    state.botName = 'Bot';
    state.hostname = 'bot';
    state.avatarPreviewUrl = 'data:image/png;base64,abc123';
    state.enabledProviders = ['openai'];
    state.enabledChannels = ['telegram'];
    state.providerConfigs = { openai: { model: 'gpt-4' } };
    state.channelConfigs = { telegram: { token: 'tk' } };

    const result = buildCreateBotInput(state);
    expect(result.avatarUrl).toBe('data:image/png;base64,abc123');
  });

  it('should include ttsVoice when tts is enabled', () => {
    const state = createDefaultState();
    state.botName = 'Bot';
    state.hostname = 'bot';
    state.features.tts = true;
    state.features.ttsVoice = 'nova';
    state.enabledProviders = ['openai'];
    state.enabledChannels = ['telegram'];
    state.providerConfigs = { openai: { model: 'gpt-4' } };
    state.channelConfigs = { telegram: { token: 'tk' } };

    const result = buildCreateBotInput(state);
    expect(result.features.tts).toBe(true);
    expect(result.features.ttsVoice).toBe('nova');
  });

  it('should exclude ttsVoice when tts is disabled', () => {
    const state = createDefaultState();
    state.botName = 'Bot';
    state.hostname = 'bot';
    state.features.tts = false;
    state.features.ttsVoice = 'nova';
    state.enabledProviders = ['openai'];
    state.enabledChannels = ['telegram'];
    state.providerConfigs = { openai: { model: 'gpt-4' } };
    state.channelConfigs = { telegram: { token: 'tk' } };

    const result = buildCreateBotInput(state);
    expect(result.features.tts).toBe(false);
    expect(result.features.ttsVoice).toBeUndefined();
  });

  it('should include sandboxTimeout when sandbox is enabled', () => {
    const state = createDefaultState();
    state.botName = 'Bot';
    state.hostname = 'bot';
    state.features.sandbox = true;
    state.features.sandboxTimeout = 60;
    state.enabledProviders = ['openai'];
    state.enabledChannels = ['telegram'];
    state.providerConfigs = { openai: { model: 'gpt-4' } };
    state.channelConfigs = { telegram: { token: 'tk' } };

    const result = buildCreateBotInput(state);
    expect(result.features.sandbox).toBe(true);
    expect(result.features.sandboxTimeout).toBe(60);
  });

  it('should include tags when present', () => {
    const state = createDefaultState();
    state.botName = 'Bot';
    state.hostname = 'bot';
    state.routingTags = ['prod', 'premium'];
    state.enabledProviders = ['openai'];
    state.enabledChannels = ['telegram'];
    state.providerConfigs = { openai: { model: 'gpt-4' } };
    state.channelConfigs = { telegram: { token: 'tk' } };

    const result = buildCreateBotInput(state);
    expect(result.tags).toEqual(['prod', 'premium']);
  });

  it('should exclude tags when empty', () => {
    const state = createDefaultState();
    state.botName = 'Bot';
    state.hostname = 'bot';
    state.routingTags = [];
    state.enabledProviders = ['openai'];
    state.enabledChannels = ['telegram'];
    state.providerConfigs = { openai: { model: 'gpt-4' } };
    state.channelConfigs = { telegram: { token: 'tk' } };

    const result = buildCreateBotInput(state);
    expect(result.tags).toBeUndefined();
  });

  it('should handle multiple providers and channels', () => {
    const state = createDefaultState();
    state.botName = 'Multi Bot';
    state.hostname = 'multi-bot';
    state.enabledProviders = ['openai', 'anthropic'];
    state.enabledChannels = ['telegram', 'discord'];
    state.providerConfigs = {
      openai: { model: 'gpt-4' },
      anthropic: { model: 'claude-3' },
    };
    state.channelConfigs = {
      telegram: { token: 'tg-token' },
      discord: { token: 'dc-token' },
    };

    const result = buildCreateBotInput(state);

    expect(result.providers).toHaveLength(2);
    expect(result.providers[0]).toEqual({ providerId: 'openai', model: 'gpt-4' });
    expect(result.providers[1]).toEqual({ providerId: 'anthropic', model: 'claude-3' });
    expect(result.primaryProvider).toBe('openai');

    expect(result.channels).toHaveLength(2);
    expect(result.channels[0]).toEqual({ channelType: 'telegram', token: 'tg-token' });
    expect(result.channels[1]).toEqual({ channelType: 'discord', token: 'dc-token' });
  });

  it('should handle missing provider config gracefully', () => {
    const state = createDefaultState();
    state.botName = 'Bot';
    state.hostname = 'bot';
    state.enabledProviders = ['openai'];
    state.enabledChannels = ['telegram'];
    state.providerConfigs = {}; // Missing config
    state.channelConfigs = { telegram: { token: 'tk' } };

    const result = buildCreateBotInput(state);
    expect(result.providers[0]).toEqual({ providerId: 'openai', model: '' });
  });
});
