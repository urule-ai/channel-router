import { describe, it, expect } from 'vitest';
import { buildServer } from '../src/server.js';

describe('channel-router — CORS lockdown via real buildServer + CORS_ORIGINS env', () => {
  // Exercises the actual server.ts wiring (env read, comma split, fastify-cors
  // registration) instead of stubbing fastify-cors itself. CORS only landed
  // on this service in the §1.3 expansion — webhook ingress under
  // /api/v1/channels uses HMAC verification, not Bearer tokens, but the
  // service is still browser-callable from office-ui for non-webhook routes.

  async function buildAppWithCorsOrigins(origins: string | undefined) {
    const orig = process.env['CORS_ORIGINS'];
    if (origins === undefined) delete process.env['CORS_ORIGINS'];
    else process.env['CORS_ORIGINS'] = origins;
    try {
      return await buildServer({ logger: false });
    } finally {
      if (orig !== undefined) process.env['CORS_ORIGINS'] = orig;
      else delete process.env['CORS_ORIGINS'];
    }
  }

  it('echoes Access-Control-Allow-Origin for the first allow-listed origin', async () => {
    const app = await buildAppWithCorsOrigins('http://allowed.example,http://other.example');
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/healthz',
      headers: { origin: 'http://allowed.example', 'access-control-request-method': 'GET' },
    });
    expect(res.headers['access-control-allow-origin']).toBe('http://allowed.example');
  });

  it('echoes Access-Control-Allow-Origin for the second comma-separated origin', async () => {
    const app = await buildAppWithCorsOrigins('http://allowed.example,http://other.example');
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/healthz',
      headers: { origin: 'http://other.example', 'access-control-request-method': 'GET' },
    });
    expect(res.headers['access-control-allow-origin']).toBe('http://other.example');
  });

  it('does not echo Access-Control-Allow-Origin for a non-allow-listed origin', async () => {
    const app = await buildAppWithCorsOrigins('http://allowed.example');
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/healthz',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' },
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('falls back to http://localhost:3000 when CORS_ORIGINS is unset', async () => {
    const app = await buildAppWithCorsOrigins(undefined);
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/healthz',
      headers: { origin: 'http://localhost:3000', 'access-control-request-method': 'GET' },
    });
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});
