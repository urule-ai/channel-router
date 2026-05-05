import { ulid } from 'ulid';
import type {
  ChannelAdapter,
  ChannelRef,
  ChannelUser,
  InboundWebhook,
  NormalizedMessage,
  OutboundMessage,
  DeliveryResult,
  ApprovalCard,
  UruleIdentity,
} from '../types.js';

/**
 * Discord MESSAGE_CREATE gateway event payload, as delivered by an
 * interactions/webhook integration. Discord's REST + Gateway both use
 * the same JSON shape for the "message" object (snake_case).
 *
 * https://discord.com/developers/docs/resources/channel#message-object
 */
interface DiscordAuthor {
  id: string;
  username: string;
  global_name?: string | null;
  discriminator?: string;
  bot?: boolean;
}

interface DiscordAttachment {
  id: string;
  filename: string;
  url: string;
  content_type?: string;
}

interface DiscordMessagePayload {
  type: 0 | 19 | number;          // 0 = DEFAULT, 19 = REPLY
  id: string;                     // message snowflake
  channel_id: string;             // channel snowflake (the channelId)
  guild_id?: string;
  author: DiscordAuthor;
  content: string;
  timestamp: string;              // ISO-8601
  attachments?: DiscordAttachment[];
  message_reference?: { message_id?: string; channel_id?: string };
}

export class DiscordAdapter implements ChannelAdapter {
  readonly channelType = 'discord' as const;

  async receiveWebhook(req: InboundWebhook): Promise<NormalizedMessage> {
    const payload = req.body as DiscordMessagePayload;

    return {
      id: ulid(),
      channelType: 'discord',
      channelId: payload.channel_id,
      senderId: payload.author.id,
      senderName: payload.author.global_name ?? payload.author.username,
      text: payload.content,
      attachments: (payload.attachments ?? []).map((a) => ({
        type: a.content_type ?? 'application/octet-stream',
        url: a.url,
        name: a.filename,
      })),
      timestamp: payload.timestamp,
      metadata: {
        discordMessageId: payload.id,
        guildId: payload.guild_id,
        replyTo: payload.message_reference?.message_id,
        isBot: !!payload.author.bot,
      },
    };
  }

  async sendMessage(_ref: ChannelRef, _msg: OutboundMessage): Promise<DeliveryResult> {
    // In production, POST to /api/v10/channels/:channelId/messages with
    // a bot token. Stubbed here.
    return {
      success: true,
      messageId: Date.now().toString(),
    };
  }

  async sendApprovalCard(ref: ChannelRef, _card: ApprovalCard): Promise<DeliveryResult> {
    // Discord renders approval cards as embeds + action-row buttons via
    // the Components v2 API. Same stub shape as sendMessage for now.
    return this.sendMessage(ref, { text: '' });
  }

  async mapIdentity(_user: ChannelUser): Promise<UruleIdentity | null> {
    return null;
  }
}
