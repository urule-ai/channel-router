import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { ChannelManager } from './services/channel-manager.js';
import { MessageRouter } from './services/message-router.js';
import { SlackAdapter } from './adapters/slack.adapter.js';
import { TelegramAdapter } from './adapters/telegram.adapter.js';
import { GenericWebhookAdapter } from './adapters/webhook.adapter.js';
import { authMiddleware } from '@urule/auth-middleware';
import { correlationIdPlugin } from '@urule/correlation-id';
import { registerChannelRoutes } from './routes/channel.routes.js';

export interface BuildServerOptions {
  logger?: boolean;
}

export async function buildServer(opts: BuildServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: request.url,
            hostname: request.hostname,
            remoteAddress: request.ip,
          };
        },
      },
    },
  });

  // Correlation ID — must be the first plugin so all other middleware logs carry it
  await app.register(correlationIdPlugin);

  // Register CORS
  const allowedOrigins = (process.env['CORS_ORIGINS'] ?? 'http://localhost:3000').split(',');
  await app.register(cors, { origin: allowedOrigins });

  // Rate limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Auth middleware
  await app.register(authMiddleware, { publicRoutes: ['/healthz', '/api/v1/channels', '/docs'] });

  // OpenAPI documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Urule Channel Router API',
        description: 'Multi-channel message normalization',
        version: '0.1.0',
      },
      servers: [{ url: 'http://localhost:3006' }],
      tags: [{ name: 'channels' }, { name: 'bindings' }, { name: 'identity' }],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // Initialize services
  const channelManager = new ChannelManager();
  const messageRouter = new MessageRouter(channelManager);

  // Register default adapters
  channelManager.registerAdapter(new SlackAdapter());
  channelManager.registerAdapter(new TelegramAdapter());
  channelManager.registerAdapter(new GenericWebhookAdapter());

  // Health check
  app.get('/healthz', async () => ({ status: 'ok', service: 'urule-channel-router' }));

  // Register routes
  registerChannelRoutes(app, channelManager, messageRouter);

  return app;
}
