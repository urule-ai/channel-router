import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ChannelManager } from '../services/channel-manager.js';
import type { MessageRouter } from '../services/message-router.js';
import type { ChannelType, OutboundMessage, ApprovalCard, ChannelUser } from '../types.js';

const sendMessageSchema = z.object({
  channelId: z.string(),
  message: z.object({}).passthrough(),
  threadId: z.string().optional(),
});

const sendApprovalSchema = z.object({
  channelId: z.string(),
  card: z.object({}).passthrough(),
});

const createBindingSchema = z.object({
  channelType: z.string(),
  channelId: z.string(),
  workspaceId: z.string(),
  config: z.object({}).passthrough(),
});

const createMappingSchema = z.object({
  channelType: z.string(),
  channelUserId: z.string(),
  uruleUserId: z.string(),
});

const lookupIdentitySchema = z.object({
  channelType: z.string(),
  channelUserId: z.string(),
});

export function registerChannelRoutes(
  app: FastifyInstance,
  channelManager: ChannelManager,
  messageRouter: MessageRouter,
): void {
  // POST /api/v1/channels/:channelType/webhook
  app.post<{
    Params: { channelType: string };
  }>('/api/v1/channels/:channelType/webhook', async (request, reply) => {
    const { channelType } = request.params;
    const adapter = channelManager.getAdapter(channelType as ChannelType);
    if (!adapter) {
      return reply.status(400).send({ error: `Unknown channel type: ${channelType}` });
    }
    const normalized = await channelManager.normalizeInbound({
      channelType: channelType as ChannelType,
      headers: request.headers as Record<string, string>,
      body: request.body,
    });
    const route = messageRouter.routeMessage(normalized);
    return reply.status(200).send({ message: normalized, route });
  });

  // POST /api/v1/channels/:channelType/send
  app.post<{
    Params: { channelType: ChannelType };
    Body: { channelId: string; message: OutboundMessage; threadId?: string };
  }>('/api/v1/channels/:channelType/send', async (request, reply) => {
    const parsed = sendMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }
    const { channelType } = request.params;
    const { channelId, message, threadId } = parsed.data as unknown as {
      channelId: string;
      message: OutboundMessage;
      threadId?: string;
    };
    const result = await channelManager.sendOutbound(
      { channelType, channelId, threadId },
      message,
    );
    return reply.status(200).send(result);
  });

  // POST /api/v1/channels/:channelType/approval
  app.post<{
    Params: { channelType: ChannelType };
    Body: { channelId: string; card: ApprovalCard };
  }>('/api/v1/channels/:channelType/approval', async (request, reply) => {
    const parsed = sendApprovalSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }
    const { channelType } = request.params;
    const { channelId, card } = parsed.data as unknown as { channelId: string; card: ApprovalCard };
    const result = await channelManager.sendApprovalCard({ channelType, channelId }, card);
    return reply.status(200).send(result);
  });

  // GET /api/v1/channel-bindings
  app.get<{
    Querystring: { workspaceId?: string };
  }>('/api/v1/channel-bindings', async (request, reply) => {
    const { workspaceId } = request.query as { workspaceId?: string };
    const bindings = channelManager.listBindings(workspaceId);
    return reply.status(200).send(bindings);
  });

  // POST /api/v1/channel-bindings
  app.post('/api/v1/channel-bindings', async (request, reply) => {
    const parsed = createBindingSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }
    const body = parsed.data as {
      channelType: ChannelType;
      channelId: string;
      workspaceId: string;
      config: Record<string, unknown>;
    };
    const binding = channelManager.createBinding(body);
    return reply.status(201).send(binding);
  });

  // DELETE /api/v1/channel-bindings/:bindingId
  app.delete<{
    Params: { bindingId: string };
  }>('/api/v1/channel-bindings/:bindingId', async (request, reply) => {
    const { bindingId } = request.params;
    const deleted = channelManager.deleteBinding(bindingId);
    if (!deleted) {
      return reply.status(404).send({ error: 'Binding not found' });
    }
    return reply.status(204).send();
  });

  // GET /api/v1/identity-mappings
  app.get('/api/v1/identity-mappings', async (_request, reply) => {
    const mappings = channelManager.listIdentityMappings();
    return reply.status(200).send(mappings);
  });

  // POST /api/v1/identity-mappings
  app.post('/api/v1/identity-mappings', async (request, reply) => {
    const parsed = createMappingSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }
    const body = parsed.data as {
      channelType: ChannelType;
      channelUserId: string;
      uruleUserId: string;
    };
    const mapping = channelManager.createIdentityMapping(body);
    return reply.status(201).send(mapping);
  });

  // DELETE /api/v1/identity-mappings/:mappingId
  app.delete<{
    Params: { mappingId: string };
  }>('/api/v1/identity-mappings/:mappingId', async (request, reply) => {
    const { mappingId } = request.params;
    const deleted = channelManager.deleteIdentityMapping(mappingId);
    if (!deleted) {
      return reply.status(404).send({ error: 'Identity mapping not found' });
    }
    return reply.status(204).send();
  });

  // POST /api/v1/identity-mappings/lookup
  app.post('/api/v1/identity-mappings/lookup', async (request, reply) => {
    const parsed = lookupIdentitySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }
    const user = parsed.data as ChannelUser;
    const identity = await channelManager.lookupIdentity(user);
    if (!identity) {
      return reply.status(404).send({ error: 'Identity not found' });
    }
    return reply.status(200).send(identity);
  });
}
