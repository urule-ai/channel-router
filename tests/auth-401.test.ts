import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { authMiddleware } from '@urule/auth-middleware';

// Mirror channel-router's server.ts publicRoutes config. /api/v1/channels
// is public because inbound channel webhooks (Slack, Telegram, etc.) verify
// auth themselves via HMAC signatures, not Bearer tokens.
const PUBLIC_ROUTES = ['/healthz', '/api/v1/channels', '/docs'];

async function buildAuthClosedApp() {
  const app = Fastify({ logger: false });
  await app.register(authMiddleware, {
    failClosed: true,
    jwksUrl: 'http://localhost:99999/nonexistent',
    publicRoutes: PUBLIC_ROUTES,
  });
  app.get('/healthz', async () => ({ status: 'ok' }));
  app.get('/docs/json', async () => ({ openapi: '3.0' }));
  app.post('/api/v1/channels/slack/webhook', async () => ({ received: true }));
  app.post('/api/v1/messages/send', async () => ({ id: 'm1' }));
  return app;
}

describe('channel-router — fail-closed auth wiring', () => {
  it('returns 401 on a protected route with no auth header', async () => {
    const app = await buildAuthClosedApp();
    const res = await app.inject({ method: 'POST', url: '/api/v1/messages/send', payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it('keeps /healthz accessible (k8s liveness probe)', async () => {
    const app = await buildAuthClosedApp();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
  });

  it('keeps /docs/* accessible (Swagger UI)', async () => {
    const app = await buildAuthClosedApp();
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(res.statusCode).toBe(200);
  });

  it('keeps /api/v1/channels/* accessible (HMAC-verified webhook ingress)', async () => {
    const app = await buildAuthClosedApp();
    const res = await app.inject({ method: 'POST', url: '/api/v1/channels/slack/webhook', payload: {} });
    expect(res.statusCode).toBe(200);
  });
});
