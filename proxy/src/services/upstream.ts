import https from 'https';
import http from 'http';
import type { IncomingMessage, ServerResponse } from 'http';
import type { FastifyReply } from 'fastify';
import type { VendorConfig } from '../types.js';

interface FlushableResponse extends ServerResponse {
  flush?: () => void;
}

const REQUEST_TIMEOUT_MS = 600000; // 10 min — must exceed slowest upstream (local LLMs can be slow)

export interface UpstreamRequest {
  vendorConfig: VendorConfig;
  path: string;
  method: string;
  headers: Record<string, string>;
  body: Buffer | null;
  apiKey: string;
  forceNonStreaming?: boolean;
}

export async function forwardToUpstream(
  req: UpstreamRequest,
  reply: FastifyReply
): Promise<number> {
  return new Promise((resolve, reject) => {
    const { vendorConfig, path, method, headers, body, apiKey, forceNonStreaming } = req;

    // Build upstream path
    const upstreamPath = vendorConfig.basePath + path;

    // Clone and modify headers
    const upstreamHeaders: Record<string, string> = { ...headers };

    // Remove hop-by-hop headers
    delete upstreamHeaders.host;
    delete upstreamHeaders.connection;
    delete upstreamHeaders.authorization;
    delete upstreamHeaders['content-length'];

    // Set correct host
    upstreamHeaders.host = vendorConfig.host;

    // Set auth header with real API key (skip for noAuth vendors)
    if (!vendorConfig.noAuth) {
      upstreamHeaders[vendorConfig.authHeader.toLowerCase()] = vendorConfig.authFormat(apiKey);
    }

    // Skip forceNonStreaming for naturally non-streaming endpoints (embeddings, model info)
    const isNonStreamingEndpoint = path.includes('/embeddings') || 
                                    path.includes('/api/tags') ||
                                    path.includes('/api/show');
    const shouldForceNonStreaming = forceNonStreaming && !isNonStreamingEndpoint;

    // Handle forceNonStreaming: strip stream:true from request body
    let finalBody = body;
    let wasStreaming = false;
    if (shouldForceNonStreaming && body) {
      try {
        const json = JSON.parse(body.toString('utf8')) as Record<string, unknown>;
        if (json.stream === true) {
          wasStreaming = true;
          json.stream = false;
          finalBody = Buffer.from(JSON.stringify(json), 'utf8');
        }
      } catch {
        // Not JSON, forward as-is
      }
    }

    // Set content-length if body present
    if (finalBody) {
      upstreamHeaders['content-length'] = String(finalBody.length);
    }

    const protocol = vendorConfig.protocol ?? 'https';
    const port = vendorConfig.port ?? (protocol === 'https' ? 443 : 80);

    const options = {
      hostname: vendorConfig.host,
      port,
      path: upstreamPath,
      method,
      headers: upstreamHeaders,
      timeout: REQUEST_TIMEOUT_MS,
    };

    const transport = protocol === 'http' ? http : https;
    const proxyReq = transport.request(options, (proxyRes: IncomingMessage) => {
      const statusCode = proxyRes.statusCode ?? 500;

      if (wasStreaming && statusCode === 200) {
        // Collect the non-streaming response and convert to SSE format
        let responseBody = '';
        proxyRes.on('data', (chunk: Buffer) => { responseBody += String(chunk); });
        proxyRes.on('end', () => {
          try {
            interface CompletionChoice {
              index: number;
              message: unknown;
              finish_reason: string;
            }
            interface CompletionResponse {
              id: string;
              created: number;
              model: string;
              system_fingerprint?: string;
              choices?: CompletionChoice[];
              usage?: unknown;
            }
            const completion = JSON.parse(responseBody) as CompletionResponse;

            // Convert chat.completion → chat.completion.chunk SSE format
            const sseChunk = {
              id: completion.id,
              object: 'chat.completion.chunk',
              created: completion.created,
              model: completion.model,
              system_fingerprint: completion.system_fingerprint,
              choices: (completion.choices ?? []).map((c) => ({
                index: c.index,
                delta: c.message,
                finish_reason: c.finish_reason,
              })),
              usage: completion.usage,
            };

            reply.raw.writeHead(200, {
              'content-type': 'text/event-stream',
              'cache-control': 'no-cache',
              'connection': 'keep-alive',
            });
            reply.raw.write(`data: ${JSON.stringify(sseChunk)}\n\n`);
            reply.raw.write('data: [DONE]\n\n');
            reply.raw.end();
            resolve(200);
          } catch {
            // JSON parse failed — return raw response
            reply.raw.writeHead(statusCode, proxyRes.headers);
            reply.raw.write(responseBody);
            reply.raw.end();
            resolve(statusCode);
          }
        });
        proxyRes.on('error', (err) => {
          reply.raw.end();
          reject(err);
        });
        return;
      }

      // Build headers to forward (excluding hop-by-hop)
      const forwardHeaders: Record<string, string | string[]> = {};
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        const lowerKey = key.toLowerCase();
        if (value && !['connection', 'transfer-encoding', 'content-length'].includes(lowerKey)) {
          forwardHeaders[key] = value;
        }
      }

      // For SSE responses, ensure proper streaming headers
      const contentType = proxyRes.headers['content-type'];
      if (contentType?.includes('text/event-stream')) {
        forwardHeaders['cache-control'] = 'no-cache';
        forwardHeaders.connection = 'keep-alive';
      }

      // Use raw response to bypass Fastify buffering
      // This is critical for SSE streaming to work properly
      reply.raw.writeHead(statusCode, forwardHeaders);

      proxyRes.on('data', (chunk) => {
        reply.raw.write(chunk);
        // Force flush for SSE - ensures events are sent immediately
        const rawResponse = reply.raw as FlushableResponse;
        if (typeof rawResponse.flush === 'function') {
          rawResponse.flush();
        }
      });

      proxyRes.on('end', () => {
        reply.raw.end();
        resolve(statusCode);
      });

      proxyRes.on('error', (err) => {
        reply.raw.end();
        reject(err);
      });
    });

    proxyReq.on('error', (err) => {
      reject(err);
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      reject(new Error('Upstream request timed out'));
    });

    if (finalBody) {
      proxyReq.write(finalBody);
    }
    proxyReq.end();
  });
}
