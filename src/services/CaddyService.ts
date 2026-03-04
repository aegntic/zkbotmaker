/**
 * Caddy Service
 *
 * Manages dynamic HTTPS routing for bot gateways via Caddy admin API.
 * 
 * Key insight: Caddy auto-enables TLS for servers with a `host` matcher.
 * Bot servers must include a host matcher pointing to PUBLIC_HOST so that
 * Caddy applies the same certificate used by the main dashboard.
 * 
 * Architecture:
 * - Caddy runs in host network mode (avoids 100+ docker-proxy processes)
 * - All bot containers listen on the same internal port (e.g., 8080)
 * - Each bot has a unique external port (e.g., 19000, 19001)
 * - Caddy listens on external port, proxies to container IP + internal port
 * - Admin API accessed via host.docker.internal:2019 from botmaker container
 */

import Docker from 'dockerode';

// Caddy admin API base URL (reachable from inside Docker via extra_hosts)
const CADDY_ADMIN_URL = 'http://host.docker.internal:2019';

/**
 * Service for managing Caddy reverse proxy configuration dynamically.
 * Adds/removes HTTPS listeners for bot containers via Caddy's admin API.
 */
export class CaddyService {
  private publicHost: string;
  private networkName: string;
  private docker: Docker;

  constructor(publicHost: string, networkName = 'bm-internal') {
    this.publicHost = publicHost;
    this.networkName = networkName;
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }

  /**
   * Get the IP address of a container on the configured network.
   * Required because Caddy runs in host network mode and can't use Docker DNS.
   * 
   * @param containerName - Full container name (e.g., "botmaker-bob")
   * @returns Container IP address
   * @throws Error if container or network not found
   */
  private async getContainerIp(containerName: string): Promise<string> {
    try {
      const container = this.docker.getContainer(containerName);
      const info = await container.inspect();
      const networks = info.NetworkSettings.Networks;
      const networkInfo = networks[this.networkName];

      if (!networkInfo.IPAddress) {
        throw new Error(`Container ${containerName} has no IP on network ${this.networkName}`);
      }
      return networkInfo.IPAddress;
    } catch (err) {
      const error = err as { message?: string };
      throw new Error(`Failed to get IP for ${containerName}: ${error.message ?? 'Unknown error'}`);
    }
  }

  /**
   * Check if Caddy admin API is available.
   * @returns true if Caddy is reachable
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${CADDY_ADMIN_URL}/config/`, {
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Add an HTTPS listener for a bot gateway.
   * Creates a new server entry in Caddy with:
   * - Port-based listener on externalPort
   * - Host matcher (enables auto-TLS with same cert as dashboard)
   * - Reverse proxy to container IP + internal port
   *
   * @param hostname - Bot hostname (e.g., "bob")
   * @param externalPort - External port number (e.g., 19000)
   * @param internalPort - Internal port that OpenClaw listens on (e.g., 8080)
   */
  async addBotRoute(hostname: string, externalPort: number, internalPort: number): Promise<void> {
    const serverName = `bot-${hostname}`;
    const containerName = `botmaker-${hostname}`;
    
    // Get container IP (Caddy is on host network, can't use Docker DNS)
    const containerIp = await this.getContainerIp(containerName);
    
    // Config with host matcher to enable Caddy's auto-TLS
    // Caddy listens on external port, proxies to container IP + internal port
    const config = {
      listen: [`:${externalPort}`],
      routes: [
        {
          match: [{ host: [this.publicHost] }],
          handle: [
            {
              handler: 'reverse_proxy',
              upstreams: [
                { dial: `${containerIp}:${internalPort}` }
              ]
            }
          ],
          terminal: true
        }
      ]
    };

    try {
      const response = await fetch(
        `${CADDY_ADMIN_URL}/config/apps/http/servers/${serverName}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
          signal: AbortSignal.timeout(10000),
        }
      );
      
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`HTTP ${response.status}: ${body}`);
      }
    } catch (err) {
      const error = err as { message?: string };
      throw new Error(`Failed to add Caddy route for ${hostname}: ${error.message ?? 'Unknown error'}`);
    }
  }

  /**
   * Restore Caddy routes for all running bots.
   * Called on startup to re-register dynamic routes lost during Caddy restart.
   *
   * @param bots - List of running bots with hostname and port
   * @param internalPort - Internal port that OpenClaw listens on (e.g., 8080)
   * @param logger - Logger for status messages
   * @returns Number of routes successfully restored
   */
  async restoreRoutes(
    bots: Array<{ hostname: string; port: number }>,
    internalPort: number,
    logger: { info: (msg: string | object, ...args: unknown[]) => void; warn: (msg: string | object, ...args: unknown[]) => void },
  ): Promise<number> {
    if (bots.length === 0) return 0;

    if (!await this.isAvailable()) {
      logger.warn('Caddy admin API not available — skipping route restoration');
      return 0;
    }

    let restored = 0;
    for (const bot of bots) {
      try {
        await this.addBotRoute(bot.hostname, bot.port, internalPort);
        restored++;
      } catch (err) {
        const error = err as { message?: string };
        logger.warn({ hostname: bot.hostname, error: error.message }, 'Failed to restore Caddy route');
      }
    }
    return restored;
  }

  /**
   * Remove the HTTPS listener for a bot gateway.
   * Deletes the server entry from Caddy config.
   *
   * @param hostname - Bot hostname (e.g., "bob")
   */
  async removeBotRoute(hostname: string): Promise<void> {
    const serverName = `bot-${hostname}`;
    
    try {
      await fetch(
        `${CADDY_ADMIN_URL}/config/apps/http/servers/${serverName}`,
        {
          method: 'DELETE',
          signal: AbortSignal.timeout(10000),
        }
      );
      // Ignore response - server may not exist
    } catch {
      // Ignore errors - server may not exist
    }
  }
}
