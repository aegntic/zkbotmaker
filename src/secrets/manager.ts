/**
 * Secrets Manager
 *
 * Per-bot credential isolation with Unix file permissions.
 * Each bot gets its own directory and secret files, chowned to the bot
 * container UID (1000) with tight permissions (0700/0600) when running as
 * root, falling back to world-readable (0755/0644) otherwise.
 */

import { mkdirSync, writeFileSync, readFileSync, rmSync, chownSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

const HOSTNAME_REGEX = /^[a-z0-9-]{1,64}$/;
const SECRET_NAME_REGEX = /^[A-Z0-9_]{1,64}$/;

/** UID/GID of the 'node' user inside OpenClaw bot containers */
const BOT_UID = 1000;
const BOT_GID = 1000;

/**
 * Try to chown a path to the bot container user.
 * Returns true on success, false if not permitted (non-root).
 */
function tryChown(path: string): boolean {
  try {
    chownSync(path, BOT_UID, BOT_GID);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EPERM') return false;
    throw err;
  }
}

/**
 * Set ownership and permissions on a secrets path.
 * If chown succeeds: use tight permissions (only bot user can access).
 * If chown fails (not root): fall back to world-readable so bot container can still read.
 */
function setSecretOwnership(path: string, tightMode: number, fallbackMode: number): void {
  const owned = tryChown(path);
  chmodSync(path, owned ? tightMode : fallbackMode);
}

/**
 * Returns the root directory for secrets storage.
 * Uses SECRETS_DIR environment variable if set, otherwise './secrets'.
 */
export function getSecretsRoot(): string {
  return process.env.SECRETS_DIR ?? './secrets';
}

/**
 * Validates a hostname is a valid DNS-compatible format.
 * This is CRITICAL for security - prevents directory traversal attacks
 * (e.g., hostnames like "../../etc/passwd" would be rejected).
 *
 * @throws Error if hostname is not valid
 */
export function validateHostname(hostname: string): void {
  if (!HOSTNAME_REGEX.test(hostname)) {
    throw new Error(`Invalid hostname format: ${hostname}`);
  }
}

/**
 * Creates a secrets directory for a specific bot.
 * Chowns to bot UID (1000) with mode 0700 when possible; falls back to
 * 0755 if not running as root so the bot container can still read.
 *
 * @param hostname - Hostname of the bot
 * @returns Path to the created directory
 * @throws Error if hostname is invalid
 */
export function createBotSecretsDir(hostname: string): string {
  validateHostname(hostname);

  const secretsRoot = getSecretsRoot();
  const botDir = join(secretsRoot, hostname);

  mkdirSync(botDir, { recursive: true });
  setSecretOwnership(botDir, 0o700, 0o755);

  return botDir;
}

/**
 * Writes a secret file for a bot.
 * Chowns to bot UID (1000) with mode 0600 when possible; falls back to
 * 0644 if not running as root so the bot container can still read.
 *
 * @param hostname - Hostname of the bot
 * @param name - Name of the secret (becomes filename)
 * @param value - Secret value to store
 * @throws Error if hostname is invalid
 */
export function writeSecret(hostname: string, name: string, value: string): void {
  validateHostname(hostname);

  if (!SECRET_NAME_REGEX.test(name)) {
    throw new Error(`Invalid secret name: ${name}`);
  }

  const botDir = createBotSecretsDir(hostname);
  const filePath = join(botDir, name);

  writeFileSync(filePath, value);
  setSecretOwnership(filePath, 0o600, 0o644);
}

/**
 * Reads a secret file for a bot.
 *
 * @param hostname - Hostname of the bot
 * @param name - Name of the secret to read
 * @returns The secret value (trimmed) or undefined if not found
 * @throws Error if hostname is invalid or on non-ENOENT errors
 */
export function readSecret(hostname: string, name: string): string | undefined {
  validateHostname(hostname);

  if (!SECRET_NAME_REGEX.test(name)) {
    throw new Error(`Invalid secret name: ${name}`);
  }

  const secretsRoot = getSecretsRoot();
  const filePath = join(secretsRoot, hostname, name);

  try {
    const content = readFileSync(filePath, 'utf-8');
    return content.trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

/**
 * Deletes all secrets for a bot by removing its secrets directory.
 * Safe to call even if the directory doesn't exist.
 *
 * @param hostname - Hostname of the bot
 * @throws Error if hostname is invalid
 */
export function deleteBotSecrets(hostname: string): void {
  validateHostname(hostname);

  const secretsRoot = getSecretsRoot();
  const botDir = join(secretsRoot, hostname);

  rmSync(botDir, { recursive: true, force: true });
}
