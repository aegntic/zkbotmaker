import type { ProviderConfig } from './types';

export const venice: ProviderConfig = {
  id: 'venice',
  label: 'Venice',
  baseUrl: 'https://api.venice.ai/api/v1',
  keyHint: 'VENICE-INFERENCE-KEY-...',
  defaultModel: 'zai-org-glm-4.7',
  models: [
    // Venice-hosted models (recommended)
    { id: 'venice-uncensored', label: 'Venice Uncensored 1.1' },
    { id: 'zai-org-glm-4.7', label: 'GLM 4.7 (Default)' },
    { id: 'zai-org-glm-5', label: 'GLM 5' },
    { id: 'zai-org-glm-4.7-flash', label: 'GLM 4.7 Flash' },
    { id: 'olafangensan-glm-4.7-flash-heretic', label: 'GLM 4.7 Flash Heretic' },
    { id: 'zai-org-glm-4.6', label: 'GLM 4.6' },
    { id: 'kimi-k2-5', label: 'Kimi K2.5' },
    { id: 'kimi-k2-thinking', label: 'Kimi K2 Thinking' },
    { id: 'deepseek-v3.2', label: 'DeepSeek V3.2' },

    // Qwen models
    { id: 'qwen3-235b-a22b-thinking-2507', label: 'Qwen3 235B Thinking' },
    { id: 'qwen3-235b-a22b-instruct-2507', label: 'Qwen3 235B Instruct' },
    { id: 'qwen3-next-80b', label: 'Qwen3 Next 80B' },
    { id: 'qwen3-5-35b-a3b', label: 'Qwen3.5 35B (Beta)' },
    { id: 'qwen3-coder-480b-a35b-instruct', label: 'Qwen3 Coder 480B' },
    { id: 'qwen3-coder-480b-a35b-instruct-turbo', label: 'Qwen3 Coder 480B Turbo (Beta)' },
    { id: 'qwen3-vl-235b-a22b', label: 'Qwen3 VL 235B (Vision)' },
    { id: 'qwen3-4b', label: 'Qwen3 4B (Venice Small)' },

    // Anthropic Claude
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Beta)' },
    { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { id: 'claude-opus-4-6', label: 'Claude Opus 4.6 (Beta)' },
    { id: 'claude-opus-4-5', label: 'Claude Opus 4.5' },

    // OpenAI GPT
    { id: 'openai-gpt-52', label: 'GPT-5.2' },
    { id: 'openai-gpt-52-codex', label: 'GPT-5.2 Codex' },
    { id: 'openai-gpt-53-codex', label: 'GPT-5.3 Codex (Beta)' },
    { id: 'openai-gpt-4o-2024-11-20', label: 'GPT-4o' },
    { id: 'openai-gpt-4o-mini-2024-07-18', label: 'GPT-4o Mini' },
    { id: 'openai-gpt-oss-120b', label: 'GPT OSS 120B' },

    // Google Gemini
    { id: 'gemini-3-1-pro-preview', label: 'Gemini 3.1 Pro Preview' },
    { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
    { id: 'google-gemma-3-27b-it', label: 'Google Gemma 3 27B' },

    // xAI Grok
    { id: 'grok-41-fast', label: 'Grok 4.1 Fast' },
    { id: 'grok-code-fast-1', label: 'Grok Code Fast 1' },

    // Other models
    { id: 'mistral-31-24b', label: 'Mistral 3.1 24B (Venice Medium)' },
    { id: 'minimax-m25', label: 'MiniMax M2.5' },
    { id: 'minimax-m21', label: 'MiniMax M2.1' },
    { id: 'llama-3.3-70b', label: 'Llama 3.3 70B' },
    { id: 'llama-3.2-3b', label: 'Llama 3.2 3B' },
    { id: 'hermes-3-llama-3.1-405b', label: 'Hermes 3 Llama 3.1 405B' },
    { id: 'nvidia-nemotron-3-nano-30b-a3b', label: 'NVIDIA Nemotron 3 Nano 30B (Beta)' },
  ],
};
