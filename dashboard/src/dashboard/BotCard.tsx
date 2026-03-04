import { useState } from 'react';
import type { Bot } from '../types';
import { StatusLight } from '../ui/StatusLight';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Panel } from '../ui/Panel';
import { TokenDisplay } from '../ui/TokenDisplay';
import { BotLink } from '../ui/BotLink';
import { getEffectiveStatus } from '../utils/bot-status';
import './BotCard.css';

type PairingState = 'idle' | 'loading' | 'success' | 'error';

interface BotCardProps {
  bot: Bot;
  onStart: (hostname: string) => void;
  onStop: (hostname: string) => void;
  onDelete: (hostname: string) => void;
  onPair: (hostname: string, code: string) => Promise<void>;
  loading: boolean;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const channelIcons: Record<string, string> = {
  telegram: 'TG',
  discord: 'DC',
};

// Valid pairing code alphabet (no I, O, 0, 1)
const PAIRING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function BotCard({ bot, onStart, onStop, onDelete, onPair, loading }: BotCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pairingExpanded, setPairingExpanded] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [pairingState, setPairingState] = useState<PairingState>('idle');
  const [pairingError, setPairingError] = useState('');
  const status = getEffectiveStatus(bot);
  const isStarting = status === 'starting';
  const isRunning = status === 'running';
  const showPairing = bot.channel_type === 'telegram' && isRunning;

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(bot.hostname);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      // Reset after 3 seconds
      setTimeout(() => { setConfirmDelete(false); }, 3000);
    }
  };

  const handlePairingInput = (value: string) => {
    const filtered = value
      .toUpperCase()
      .split('')
      .filter(ch => PAIRING_ALPHABET.includes(ch))
      .join('')
      .slice(0, 8);
    setPairingCode(filtered);
    if (pairingState === 'error') {
      setPairingState('idle');
      setPairingError('');
    }
  };

  const handlePairSubmit = async () => {
    if (pairingCode.length !== 8 || pairingState === 'loading') return;
    setPairingState('loading');
    setPairingError('');
    try {
      await onPair(bot.hostname, pairingCode);
      setPairingState('success');
      setTimeout(() => {
        setPairingState('idle');
        setPairingCode('');
      }, 2000);
    } catch (err) {
      setPairingState('error');
      setPairingError(err instanceof Error ? err.message : 'Pairing failed');
      setTimeout(() => {
        setPairingState('idle');
        setPairingError('');
      }, 3000);
    }
  };

  return (
    <Panel className="bot-card" variant="raised">
      <div className="bot-card-header">
        <div className="bot-card-status">
          <StatusLight status={status} size="md" />
        </div>
        <div className="bot-card-title">
          <h3>{bot.name}</h3>
          <span className="bot-card-model">{bot.model}</span>
        </div>
        <Badge
          variant={bot.channel_type === 'telegram' ? 'primary' : 'default'}
          className="bot-card-channel"
        >
          {channelIcons[bot.channel_type] || bot.channel_type.substring(0, 2).toUpperCase()}
        </Badge>
      </div>

      <div className="bot-card-details">
        <div className="bot-card-detail">
          <span className="bot-card-detail-label">Provider</span>
          <span className="bot-card-detail-value">{bot.ai_provider}</span>
        </div>
        <div className="bot-card-detail">
          <span className="bot-card-detail-label">Created</span>
          <span className="bot-card-detail-value">{formatDate(bot.created_at)}</span>
        </div>
        {bot.port && (
          <div className="bot-card-detail">
            <span className="bot-card-detail-label">Port</span>
            <span className="bot-card-detail-value">{bot.port}</span>
          </div>
        )}
        {bot.image_version && (
          <div className="bot-card-detail">
            <span className="bot-card-detail-label">Image</span>
            <span className="bot-card-detail-value">{bot.image_version}</span>
          </div>
        )}
      </div>

      {bot.port && (isRunning || isStarting) && (
        <div className="bot-card-link">
          <BotLink port={bot.port} gatewayToken={bot.gateway_token} disabled={isStarting} />
        </div>
      )}

      {bot.gateway_token && (
        <div className="bot-card-token">
          <TokenDisplay token={bot.gateway_token} />
        </div>
      )}

      {showPairing && (
        <div className="bot-card-pairing">
          <button
            className="bot-card-pairing-header"
            onClick={() => { setPairingExpanded(!pairingExpanded); }}
            aria-expanded={pairingExpanded}
          >
            <span className="bot-card-pairing-title">PAIR USER</span>
            <svg
              className={`bot-card-pairing-chevron ${pairingExpanded ? 'bot-card-pairing-chevron--expanded' : ''}`}
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>

          {pairingExpanded && (
            <div className="bot-card-pairing-body">
              <div className="bot-card-pairing-input-row">
                <input
                  className={`bot-card-pairing-input ${pairingState === 'error' ? 'bot-card-pairing-input--error' : ''} ${pairingState === 'success' ? 'bot-card-pairing-input--success' : ''}`}
                  type="text"
                  value={pairingState === 'success' ? 'APPROVED' : pairingCode}
                  onChange={(e) => { handlePairingInput(e.target.value); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handlePairSubmit(); }}
                  placeholder="ENTER CODE"
                  maxLength={8}
                  disabled={pairingState === 'loading' || pairingState === 'success'}
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => { void handlePairSubmit(); }}
                  disabled={pairingCode.length !== 8 || pairingState === 'loading' || pairingState === 'success'}
                  loading={pairingState === 'loading'}
                >
                  Approve
                </Button>
              </div>
              {pairingError && (
                <div className="bot-card-pairing-error">{pairingError}</div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="bot-card-actions">
        {isRunning ? (
          <Button
            size="sm"
            onClick={() => { onStop(bot.hostname); }}
            disabled={loading}
            loading={loading}
          >
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            variant="primary"
            onClick={() => { onStart(bot.hostname); }}
            disabled={loading}
            loading={loading}
          >
            Start
          </Button>
        )}
        <Button
          size="sm"
          variant={confirmDelete ? 'danger' : 'ghost'}
          onClick={handleDelete}
          disabled={loading}
        >
          {confirmDelete ? 'Confirm?' : 'Delete'}
        </Button>
      </div>
    </Panel>
  );
}
