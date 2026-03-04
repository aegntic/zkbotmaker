import { useState, useMemo } from 'react';
import { useWizard } from '../context/WizardContext';
import { PROVIDERS, PROVIDER_CATEGORIES } from '../../config/providers';
import { POPULAR_CHANNELS, OTHER_CHANNELS } from '../../config/channels';
import { FeatureCheckbox } from '../components';
import type { SessionScope, ToolsProfile } from '../../types';
import './Page3Toggles.css';

const ALWAYS_VISIBLE_CATEGORIES = ['major', 'local'];
const providerMap = new Map(PROVIDERS.map((p) => [p.id, p]));

export function Page3Toggles() {
  const { state, dispatch } = useWizard();
  const [showAllProviders, setShowAllProviders] = useState(false);
  const [showAllChannels, setShowAllChannels] = useState(false);
  const [providerSearch, setProviderSearch] = useState('');

  const isSearching = providerSearch.trim().length > 0;
  const searchLower = providerSearch.trim().toLowerCase();

  const filteredCategories = useMemo(() => {
    return PROVIDER_CATEGORIES.map((cat) => {
      const providers = cat.providerIds
        .map((id) => providerMap.get(id))
        .filter((p) => p !== undefined)
        .filter((p) => !isSearching || p.label.toLowerCase().includes(searchLower) || p.id.toLowerCase().includes(searchLower));
      return { ...cat, providers };
    }).filter((cat) => cat.providers.length > 0);
  }, [isSearching, searchLower]);

  const hiddenCategoryCount = isSearching
    ? 0
    : filteredCategories.filter((c) => !ALWAYS_VISIBLE_CATEGORIES.includes(c.id)).reduce((sum, c) => sum + c.providers.length, 0);

  const handleProviderToggle = (providerId: string) => {
    dispatch({ type: 'TOGGLE_PROVIDER', providerId });
  };

  const handleChannelToggle = (channelId: string) => {
    dispatch({ type: 'TOGGLE_CHANNEL', channelId });
  };

  const handleFeatureChange = (feature: 'commands' | 'tts' | 'sandbox', value: boolean) => {
    dispatch({ type: 'SET_FEATURE', feature, value });
  };

  const handleSessionScopeChange = (scope: SessionScope) => {
    dispatch({ type: 'SET_FEATURE', feature: 'sessionScope', value: scope });
  };

  const handleToolsProfileChange = (profile: ToolsProfile) => {
    dispatch({ type: 'SET_FEATURE', feature: 'toolsProfile', value: profile });
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const tags = value
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0 && /^[a-z0-9-]+$/.test(t));
    dispatch({ type: 'SET_ROUTING_TAGS', tags });
  };

  return (
    <div className="page3-toggles">
      <section className="page3-section">
        <h4 className="page3-section-title">LLM Providers</h4>
        <input
          type="text"
          className="page3-provider-search wizard-input"
          placeholder="Search providers..."
          value={providerSearch}
          onChange={(e) => { setProviderSearch(e.target.value); }}
        />
        {filteredCategories.map((cat) => {
          const isVisible = isSearching || showAllProviders || ALWAYS_VISIBLE_CATEGORIES.includes(cat.id);
          if (!isVisible) return null;
          return (
            <div key={cat.id} className="page3-provider-category">
              <span className="page3-category-label">{cat.label}</span>
              <div className="page3-checkbox-grid">
                {cat.providers.map((provider) => (
                  <FeatureCheckbox
                    key={provider.id}
                    id={`provider-${provider.id}`}
                    label={provider.label}
                    checked={state.enabledProviders.includes(provider.id)}
                    onChange={() => { handleProviderToggle(provider.id); }}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {!isSearching && hiddenCategoryCount > 0 && (
          <button
            type="button"
            className="page3-show-more"
            onClick={() => { setShowAllProviders(!showAllProviders); }}
          >
            {showAllProviders ? 'Show less' : `Show all (${hiddenCategoryCount} more)`}
          </button>
        )}
      </section>

      <section className="page3-section">
        <h4 className="page3-section-title">Channels</h4>
        <div className="page3-checkbox-grid">
          {POPULAR_CHANNELS.map((channel) => (
            <FeatureCheckbox
              key={channel.id}
              id={`channel-${channel.id}`}
              icon={channel.icon}
              label={channel.label}
              checked={state.enabledChannels.includes(channel.id)}
              onChange={() => { handleChannelToggle(channel.id); }}
            />
          ))}
        </div>
        {OTHER_CHANNELS.length > 0 && (
          <>
            <button
              type="button"
              className="page3-show-more"
              onClick={() => { setShowAllChannels(!showAllChannels); }}
            >
              {showAllChannels ? 'Show less' : `Show all (${OTHER_CHANNELS.length} more)`}
            </button>
            {showAllChannels && (
              <div className="page3-checkbox-grid page3-checkbox-grid--dense">
                {OTHER_CHANNELS.map((channel) => (
                  <FeatureCheckbox
                    key={channel.id}
                    id={`channel-${channel.id}`}
                    icon={channel.icon}
                    label={channel.label}
                    checked={state.enabledChannels.includes(channel.id)}
                    onChange={() => { handleChannelToggle(channel.id); }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="page3-section">
        <h4 className="page3-section-title">Features</h4>
        <div className="page3-checkbox-grid">
          <FeatureCheckbox
            id="feature-commands"
            label="Commands enabled"
            hint="Allow /commands in chat"
            checked={state.features.commands}
            onChange={(checked) => { handleFeatureChange('commands', checked); }}
          />
          <FeatureCheckbox
            id="feature-tts"
            label="Text-to-Speech"
            hint="Voice responses (requires provider support)"
            checked={state.features.tts}
            onChange={(checked) => { handleFeatureChange('tts', checked); }}
          />
          <FeatureCheckbox
            id="feature-sandbox"
            label="Sandbox mode"
            hint="Isolated environment for testing"
            checked={state.features.sandbox}
            onChange={(checked) => { handleFeatureChange('sandbox', checked); }}
          />
        </div>

        <div className="page3-radio-group">
          <span className="page3-radio-label">Session Scope</span>
          <div className="page3-radio-options">
            {(['user', 'channel', 'global'] as SessionScope[]).map((scope) => (
              <label key={scope} className="page3-radio-option">
                <input
                  type="radio"
                  name="sessionScope"
                  value={scope}
                  checked={state.features.sessionScope === scope}
                  onChange={() => { handleSessionScopeChange(scope); }}
                />
                <span className="page3-radio-box" />
                <span className="page3-radio-text">{scope}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="page3-section">
        <h4 className="page3-section-title">Bot Capabilities</h4>
        <p className="page3-section-hint">
          Choose what tools your bot can use. This affects security and functionality.
        </p>
        <div className="page3-radio-group">
          <div className="page3-radio-options page3-radio-options--capabilities">
            <label className="page3-radio-option page3-radio-option--stacked">
              <input
                type="radio"
                name="toolsProfile"
                value="messaging"
                checked={state.features.toolsProfile === 'messaging'}
                onChange={() => { handleToolsProfileChange('messaging'); }}
              />
              <span className="page3-radio-box" />
              <div className="page3-radio-content">
                <span className="page3-radio-title">Chat Bot</span>
                <span className="page3-radio-desc">Send messages, view history — safe for public use</span>
              </div>
            </label>
            <label className="page3-radio-option page3-radio-option--stacked">
              <input
                type="radio"
                name="toolsProfile"
                value="coding"
                checked={state.features.toolsProfile === 'coding'}
                onChange={() => { handleToolsProfileChange('coding'); }}
              />
              <span className="page3-radio-box" />
              <div className="page3-radio-content">
                <span className="page3-radio-title">Developer Assistant</span>
                <span className="page3-radio-desc">Read/write files, run commands, search memory</span>
              </div>
            </label>
            <label className="page3-radio-option page3-radio-option--stacked">
              <input
                type="radio"
                name="toolsProfile"
                value="full"
                checked={state.features.toolsProfile === 'full'}
                onChange={() => { handleToolsProfileChange('full'); }}
              />
              <span className="page3-radio-box" />
              <div className="page3-radio-content">
                <span className="page3-radio-title">Full Access</span>
                <span className="page3-radio-desc">All tools including web browsing and automation</span>
              </div>
            </label>
          </div>
        </div>
      </section>

      <section className="page3-section">
        <h4 className="page3-section-title">API Routing Tags</h4>
        <div className="page3-tags-field">
          <input
            type="text"
            className="wizard-input"
            placeholder="prod, high-priority"
            defaultValue={state.routingTags.join(', ')}
            onChange={handleTagsChange}
          />
          <span className="page3-tags-hint">
            Comma-separated tags for API key routing. Keys with matching tags will be used first.
            Leave empty to use default keys.
          </span>
          {state.routingTags.length > 0 && (
            <div className="page3-tags-preview">
              {state.routingTags.map((tag) => (
                <span key={tag} className="page3-tag-badge">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
