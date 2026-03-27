# @urule/channel-router

Multi-channel message normalization and routing for Slack, Telegram, and webhooks.

Part of the [Urule](https://github.com/urule-ai/urule) ecosystem — the open-source coordination layer for AI agents.

## Features

- **Pluggable adapter system** -- built-in adapters for Slack, Telegram, and generic webhooks; add your own by implementing the `ChannelAdapter` interface
- **Message normalization** -- inbound messages from any channel are converted to a unified `NormalizedMessage` format
- **Workspace routing** -- channel bindings map incoming messages to the correct workspace and agent
- **Outbound messaging** -- send text messages and approval cards back through any registered channel
- **Identity mapping** -- link channel-specific user IDs (Slack, Telegram) to Urule user identities
- **Approval card delivery** -- push rich approval cards with action buttons to any channel
- Fastify REST API with health check

## Quick Start

```bash
npm install
npm run build
npm start
```

Or for development with hot reload:

```bash
npm run dev
```

The server starts on port `3006` by default.

### Receive a Slack webhook

```bash
curl -X POST http://localhost:3006/api/v1/channels/slack/webhook \
  -H 'Content-Type: application/json' \
  -d '{"event": {"type": "message", "channel": "C123", "user": "U456", "text": "hello", "ts": "1700000000.000000"}}'
```

### Send a message to Telegram

```bash
curl -X POST http://localhost:3006/api/v1/channels/telegram/send \
  -H 'Content-Type: application/json' \
  -d '{"channelId": "12345", "message": {"text": "Hello from Urule!"}}'
```

### Bind a channel to a workspace

```bash
curl -X POST http://localhost:3006/api/v1/channel-bindings \
  -H 'Content-Type: application/json' \
  -d '{"channelType": "slack", "channelId": "C123", "workspaceId": "ws-1", "config": {"agentId": "agent-1"}}'
```

## API Endpoints

### Webhooks and Messaging

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/channels/:channelType/webhook` | Receive and normalize an inbound webhook |
| `POST` | `/api/v1/channels/:channelType/send` | Send an outbound message |
| `POST` | `/api/v1/channels/:channelType/approval` | Send an approval card |

### Channel Bindings

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/channel-bindings` | List bindings (optional `workspaceId` query) |
| `POST` | `/api/v1/channel-bindings` | Create a channel-to-workspace binding |
| `DELETE` | `/api/v1/channel-bindings/:bindingId` | Remove a binding |

### Identity Mappings

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/identity-mappings` | List all identity mappings |
| `POST` | `/api/v1/identity-mappings` | Create a channel user to Urule user mapping |
| `DELETE` | `/api/v1/identity-mappings/:mappingId` | Remove an identity mapping |
| `POST` | `/api/v1/identity-mappings/lookup` | Look up a Urule identity from a channel user |

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/healthz` | Health check |

## How to Add a Channel Adapter

Implement the `ChannelAdapter` interface and register it with the `ChannelManager`:

```ts
import type { ChannelAdapter, InboundWebhook, NormalizedMessage, ChannelRef, OutboundMessage, DeliveryResult, ApprovalCard, ChannelUser, UruleIdentity } from '@urule/channel-router';

export class DiscordAdapter implements ChannelAdapter {
  readonly channelType = 'discord' as const;

  async receiveWebhook(req: InboundWebhook): Promise<NormalizedMessage> {
    // Parse Discord webhook payload into NormalizedMessage
  }

  async sendMessage(ref: ChannelRef, msg: OutboundMessage): Promise<DeliveryResult> {
    // Send message via Discord API
  }

  async sendApprovalCard(ref: ChannelRef, card: ApprovalCard): Promise<DeliveryResult> {
    // Send approval card with action buttons
  }

  async mapIdentity(user: ChannelUser): Promise<UruleIdentity | null> {
    // Resolve Discord user to Urule identity
  }
}
```

Then register it in `server.ts`:

```ts
channelManager.registerAdapter(new DiscordAdapter());
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3006` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `NATS_URL` | `nats://localhost:4222` | NATS server URL |
| `REGISTRY_URL` | `http://localhost:3001` | Urule registry service URL |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

Apache-2.0
