import type { ProviderConfig, ModelInfo } from './types';
import { openai } from './openai';
import { anthropic } from './anthropic';
import { google } from './google';
import { deepseek } from './deepseek';
import { mistral } from './mistral';
import { groq } from './groq';
import { cerebras } from './cerebras';
import { fireworks } from './fireworks';
import { openrouter } from './openrouter';
import { venice } from './venice';
import { togetherai } from './togetherai';
import { deepinfra } from './deepinfra';
import { perplexity } from './perplexity';
import { nvidia } from './nvidia';
import { moonshot } from './moonshot';
import { grok } from './grok';
import { scaleway } from './scaleway';
import { nebius } from './nebius';
import { ovhcloud } from './ovhcloud';
import { huggingface } from './huggingface';
import { minimax } from './minimax';
import { ollama } from './ollama';

export type { ProviderConfig, ModelInfo };
export { PROVIDER_CATEGORIES } from './categories';
export type { ProviderCategory } from './categories';

// Ordered by category: major, fast-inference, aggregators, specialized, regional, local
export const PROVIDERS: ProviderConfig[] = [
  // Major Providers
  openai, anthropic, google, deepseek, mistral,
  // Fast Inference
  groq, cerebras, fireworks,
  // Aggregators
  openrouter, venice, togetherai, deepinfra,
  // Specialized
  perplexity, nvidia, moonshot, grok,
  // Regional / Infrastructure
  scaleway, nebius, ovhcloud, huggingface, minimax,
  // Local
  ollama,
];

export const AI_PROVIDERS = PROVIDERS.map((p) => ({
  value: p.id,
  label: p.label,
}));

export const MODELS: Record<string, string[]> = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p.models.map((m) => m.id)])
);

export function getProvider(id: string): ProviderConfig | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function getModels(providerId: string): ModelInfo[] {
  return getProvider(providerId)?.models ?? [];
}

export function getDefaultModel(providerId: string): string {
  const provider = getProvider(providerId);
  return provider?.defaultModel ?? provider?.models[0]?.id ?? '';
}

export function getKeyHint(providerId: string): string {
  return getProvider(providerId)?.keyHint ?? 'API key';
}

export function requiresAuth(providerId: string): boolean {
  const provider = getProvider(providerId);
  return provider ? !provider.noAuth : true;
}
