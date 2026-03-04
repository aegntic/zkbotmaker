import { useState, useEffect } from 'react';
import { useWizard } from '../context/WizardContext';
import { getProvider } from '../../config/providers';
import { getChannel } from '../../config/channels';
import { CollapsibleSection } from '../components';
import { fetchProxyKeys, addProxyKey } from '../../api';
import type { ProxyKey } from '../../types';
import './Page5Summary.css';

function maskToken(token: string): string {
  if (token.length <= 4) return '****';
  return '****' + token.slice(-4);
}

/**
 * Map provider IDs to their vendor names in keyring-proxy.
 * Most providers use the same ID, but some differ.
 */
function getVendorForProvider(providerId: string): string {
  // Provider ID usually matches vendor name
  return providerId;
}

export function Page5Summary() {
  const { state } = useWizard();
  const [proxyKeys, setProxyKeys] = useState<ProxyKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [keyError, setKeyError] = useState<string | null>(null);

  // Fetch existing proxy keys on mount
  useEffect(() => {
    fetchProxyKeys()
      .then((keys) => { setProxyKeys(keys); })
      .catch(() => { setProxyKeys([]); })
      .finally(() => { setLoadingKeys(false); });
  }, []);

  // Find providers that require auth but have no key
  // Check both: wizard state (apiKey entered in Page4) AND existing proxy keys
  const configuredVendors = new Set(proxyKeys.map(k => k.vendor));
  const missingKeyProviders = state.enabledProviders.filter(providerId => {
    const provider = getProvider(providerId);
    // Skip providers that don't need auth (e.g., Ollama)
    if (provider?.noAuth) return false;
    // Check if API key was entered in wizard (Page4)
    const wizardApiKey = state.providerConfigs[providerId]?.apiKey?.trim();
    if (wizardApiKey) return false;
    // Check if key exists in proxy
    const vendor = getVendorForProvider(providerId);
    return !configuredVendors.has(vendor);
  });

  const handleAddKey = async (providerId: string) => {
    const apiKey = (keyInputs[providerId] ?? '').trim();
    if (!apiKey) return;

    setAddingKey(providerId);
    setKeyError(null);

    try {
      const vendor = getVendorForProvider(providerId);
      await addProxyKey({ vendor, secret: apiKey });
      // Refresh keys list
      const keys = await fetchProxyKeys();
      setProxyKeys(keys);
      // Clear input
      setKeyInputs(prev => ({ ...prev, [providerId]: '' }));
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : 'Failed to add key');
    } finally {
      setAddingKey(null);
    }
  };

  return (
    <div className="page5-summary">
      <div className="page5-header">
        <h3 className="page5-title">Review Your Bot</h3>
        <p className="page5-subtitle">Verify everything looks correct before creating</p>
      </div>

      {/* Missing API Keys Warning */}
      {!loadingKeys && missingKeyProviders.length > 0 && (
        <div className="page5-missing-keys">
          <div className="page5-missing-keys-header">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>Missing API Keys</span>
          </div>
          <p className="page5-missing-keys-text">
            The following providers need API keys configured before your bot can use them:
          </p>
          {keyError && (
            <div className="page5-key-error">{keyError}</div>
          )}
          <div className="page5-missing-keys-list">
            {missingKeyProviders.map(providerId => {
              const provider = getProvider(providerId);
              const isAdding = addingKey === providerId;
              return (
                <div key={providerId} className="page5-missing-key-item">
                  <div className="page5-missing-key-info">
                    <span className="page5-missing-key-name">{provider?.label ?? providerId}</span>
                    {provider?.keyHint && (
                      <span className="page5-missing-key-hint">{provider.keyHint}</span>
                    )}
                  </div>
                  <div className="page5-missing-key-input">
                    <input
                      type="password"
                      placeholder="API key..."
                      value={keyInputs[providerId] ?? ''}
                      onChange={(e) => { setKeyInputs(prev => ({ ...prev, [providerId]: e.target.value })); }}
                      disabled={isAdding}
                    />
                    <button
                      type="button"
                      onClick={() => { void handleAddKey(providerId); }}
                      disabled={isAdding || !(keyInputs[providerId] ?? '').trim()}
                    >
                      {isAdding ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <CollapsibleSection title="Persona" defaultOpen={true}>
        <div className="page5-persona">
          <div className="page5-avatar">
            {state.avatarPreviewUrl ? (
              <img src={state.avatarPreviewUrl} alt="Avatar" className="page5-avatar-image" />
            ) : (
              <span className="page5-avatar-emoji">{state.emoji}</span>
            )}
          </div>
          <div className="page5-persona-details">
            <div className="page5-field">
              <span className="page5-label">Name</span>
              <span className="page5-value">{state.botName || '(not set)'}</span>
            </div>
            <div className="page5-field">
              <span className="page5-label">Emoji</span>
              <span className="page5-value">{state.emoji}</span>
            </div>
          </div>
        </div>
        {state.soulMarkdown && (
          <div className="page5-soul-preview">
            <span className="page5-label">SOUL.md Preview</span>
            <pre className="page5-soul-content">
              {state.soulMarkdown.slice(0, 300)}
              {state.soulMarkdown.length > 300 && '...'}
            </pre>
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Providers" defaultOpen={true}>
        {state.enabledProviders.length === 0 ? (
          <span className="page5-empty">No providers selected</span>
        ) : (
          <div className="page5-list">
            {state.enabledProviders.map((providerId) => {
              const provider = getProvider(providerId);
              const config = state.providerConfigs[providerId];
              return (
                <div key={providerId} className="page5-list-item">
                  <span className="page5-list-icon">{provider?.label.charAt(0) ?? ''}</span>
                  <div className="page5-list-content">
                    <span className="page5-list-title">{provider?.label ?? providerId}</span>
                    <span className="page5-list-subtitle">
                      Model: {config?.model ?? 'default'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Channels" defaultOpen={true}>
        {state.enabledChannels.length === 0 ? (
          <span className="page5-empty">No channels selected</span>
        ) : (
          <div className="page5-list">
            {state.enabledChannels.map((channelId) => {
              const channel = getChannel(channelId);
              const config = state.channelConfigs[channelId];
              return (
                <div key={channelId} className="page5-list-item">
                  <span className="page5-list-icon">{channel?.icon}</span>
                  <div className="page5-list-content">
                    <span className="page5-list-title">{channel?.label ?? channelId}</span>
                    <span className="page5-list-subtitle">
                      Token: {maskToken(config?.token ?? '')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Features" defaultOpen={true}>
        <div className="page5-features">
          <div className="page5-feature">
            <span className={`page5-feature-status ${state.features.commands ? 'page5-feature-status--on' : ''}`} />
            <span>Commands</span>
          </div>
          <div className="page5-feature">
            <span className={`page5-feature-status ${state.features.tts ? 'page5-feature-status--on' : ''}`} />
            <span>TTS{state.features.tts && ` (${state.features.ttsVoice})`}</span>
          </div>
          <div className="page5-feature">
            <span className={`page5-feature-status ${state.features.sandbox ? 'page5-feature-status--on' : ''}`} />
            <span>Sandbox{state.features.sandbox && ` (${state.features.sandboxTimeout}s)`}</span>
          </div>
          <div className="page5-field page5-field--inline">
            <span className="page5-label">Session Scope</span>
            <span className="page5-value">{state.features.sessionScope}</span>
          </div>
          <div className="page5-field page5-field--inline">
            <span className="page5-label">Capabilities</span>
            <span className="page5-value">
              {state.features.toolsProfile === 'messaging' && 'Chat Bot'}
              {state.features.toolsProfile === 'coding' && 'Developer Assistant'}
              {state.features.toolsProfile === 'full' && 'Full Access'}
              {state.features.toolsProfile === 'minimal' && 'Minimal'}
            </span>
          </div>
          {state.routingTags.length > 0 && (
            <div className="page5-field page5-field--inline">
              <span className="page5-label">Routing Tags</span>
              <div className="page5-tags">
                {state.routingTags.map((tag) => (
                  <span key={tag} className="page5-tag">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
