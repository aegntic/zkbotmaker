import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CaddyService } from './CaddyService.js';

// Mock dockerode
vi.mock('dockerode', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      getContainer: vi.fn(),
    })),
  };
});

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('CaddyService', () => {
  let caddy: CaddyService;

  beforeEach(() => {
    vi.clearAllMocks();
    caddy = new CaddyService('us1.example.com');
  });

  describe('isAvailable', () => {
    it('should return true when Caddy admin API responds OK', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      expect(await caddy.isAvailable()).toBe(true);
    });

    it('should return false when Caddy admin API fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      expect(await caddy.isAvailable()).toBe(false);
    });

    it('should return false when Caddy returns non-OK status', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      expect(await caddy.isAvailable()).toBe(false);
    });
  });

  describe('addBotRoute', () => {
    it('should PUT correct config to Caddy admin API', async () => {
      // Mock Docker container inspect for IP lookup
      const dockerInstance = (await import('dockerode')).default;
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          NetworkSettings: {
            Networks: {
              'bm-internal': { IPAddress: '172.18.0.5' },
            },
          },
        }),
      };
      vi.mocked(dockerInstance).mockImplementation(() => ({
        getContainer: vi.fn().mockReturnValue(mockContainer),
      }) as unknown as InstanceType<typeof dockerInstance>);

      // Re-create caddy with fresh mock
      caddy = new CaddyService('us1.example.com');

      mockFetch.mockResolvedValueOnce({ ok: true });

      await caddy.addBotRoute('bob', 19000, 8080);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://host.docker.internal:2019/config/apps/http/servers/bot-bob',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      // Verify the body contains the right config
      const callArgs = mockFetch.mock.calls[0] as [string, { body: string }];
      const body = JSON.parse(callArgs[1].body) as Record<string, unknown>;
      expect(body.listen).toEqual([':19000']);
      expect(body.routes).toEqual([
        {
          match: [{ host: ['us1.example.com'] }],
          handle: [
            {
              handler: 'reverse_proxy',
              upstreams: [{ dial: '172.18.0.5:8080' }],
            },
          ],
          terminal: true,
        },
      ]);
    });

    it('should throw when Caddy returns error', async () => {
      const dockerInstance = (await import('dockerode')).default;
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          NetworkSettings: {
            Networks: {
              'bm-internal': { IPAddress: '172.18.0.5' },
            },
          },
        }),
      };
      vi.mocked(dockerInstance).mockImplementation(() => ({
        getContainer: vi.fn().mockReturnValue(mockContainer),
      }) as unknown as InstanceType<typeof dockerInstance>);

      caddy = new CaddyService('us1.example.com');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('internal error'),
      });

      await expect(caddy.addBotRoute('bob', 19000, 8080)).rejects.toThrow(
        'Failed to add Caddy route for bob',
      );
    });
  });

  describe('restoreRoutes', () => {
    const mockLogger = { info: vi.fn(), warn: vi.fn() };

    it('should restore routes for all running bots', async () => {
      const dockerInstance = (await import('dockerode')).default;
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          NetworkSettings: {
            Networks: {
              'bm-internal': { IPAddress: '172.18.0.5' },
            },
          },
        }),
      };
      vi.mocked(dockerInstance).mockImplementation(() => ({
        getContainer: vi.fn().mockReturnValue(mockContainer),
      }) as unknown as InstanceType<typeof dockerInstance>);

      caddy = new CaddyService('us1.example.com');

      // isAvailable check + two addBotRoute calls
      mockFetch
        .mockResolvedValueOnce({ ok: true })   // isAvailable
        .mockResolvedValueOnce({ ok: true })   // addBotRoute for alice
        .mockResolvedValueOnce({ ok: true });  // addBotRoute for bob

      const bots = [
        { hostname: 'alice', port: 19000 },
        { hostname: 'bob', port: 19001 },
      ];

      const restored = await caddy.restoreRoutes(bots, 8080, mockLogger);

      expect(restored).toBe(2);
      // isAvailable + 2 addBotRoute PUTs
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should return 0 when no bots to restore', async () => {
      const restored = await caddy.restoreRoutes([], 8080, mockLogger);
      expect(restored).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should skip when Caddy is unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const bots = [{ hostname: 'alice', port: 19000 }];
      const restored = await caddy.restoreRoutes(bots, 8080, mockLogger);

      expect(restored).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Caddy admin API not available — skipping route restoration',
      );
    });

    it('should continue restoring when one bot fails', async () => {
      const dockerInstance = (await import('dockerode')).default;
      vi.mocked(dockerInstance).mockImplementation(() => ({
        getContainer: vi.fn().mockReturnValue({
          inspect: vi.fn()
            .mockRejectedValueOnce(new Error('no such container'))  // alice fails
            .mockResolvedValueOnce({                                 // bob succeeds
              NetworkSettings: {
                Networks: { 'bm-internal': { IPAddress: '172.18.0.6' } },
              },
            }),
        }),
      }) as unknown as InstanceType<typeof dockerInstance>);

      caddy = new CaddyService('us1.example.com');

      mockFetch
        .mockResolvedValueOnce({ ok: true })   // isAvailable
        .mockResolvedValueOnce({ ok: true });  // addBotRoute for bob

      const bots = [
        { hostname: 'alice', port: 19000 },
        { hostname: 'bob', port: 19001 },
      ];
      const restored = await caddy.restoreRoutes(bots, 8080, mockLogger);

      expect(restored).toBe(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ hostname: 'alice' }),
        'Failed to restore Caddy route',
      );
    });
  });

  describe('removeBotRoute', () => {
    it('should send DELETE to Caddy admin API', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await caddy.removeBotRoute('bob');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://host.docker.internal:2019/config/apps/http/servers/bot-bob',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('should not throw when DELETE fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      // Should not throw
      await caddy.removeBotRoute('bob');
    });
  });
});
