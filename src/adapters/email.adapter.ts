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
  Attachment,
} from '../types.js';

/**
 * Inbound email payload as delivered by SendGrid / Mailgun / Postmark
 * webhook-style "parse" endpoints. Common-denominator shape — providers
 * differ in details but all expose from/to/subject/text/html plus
 * optional attachments.
 */
interface EmailPayload {
  from: string;            // "Name <addr@example.com>" or just the address
  to: string;              // recipient address (the channel id)
  subject: string;
  text?: string;
  html?: string;
  messageId?: string;      // RFC 2822 Message-ID; preserved for thread correlation
  inReplyTo?: string;      // RFC 2822 In-Reply-To; threadId hint
  attachments?: Array<{ filename: string; url?: string; contentType?: string }>;
}

/**
 * Strip the display name out of "Display Name <addr@example.com>".
 * Returns just the address. Falls back to the raw string when no angle
 * brackets are present.
 */
function extractAddress(rfc2822: string): string {
  const m = rfc2822.match(/<([^>]+)>/);
  return (m?.[1] ?? rfc2822).trim().toLowerCase();
}

function extractDisplayName(rfc2822: string): string {
  const m = rfc2822.match(/^([^<]+?)\s*</);
  if (m?.[1]) return m[1].replace(/^["']|["']$/g, '').trim();
  // No display name — derive a friendly one from the local-part.
  const addr = extractAddress(rfc2822);
  const local = addr.split('@')[0] ?? addr;
  return local;
}

export class EmailAdapter implements ChannelAdapter {
  readonly channelType = 'email' as const;

  async receiveWebhook(req: InboundWebhook): Promise<NormalizedMessage> {
    const payload = req.body as EmailPayload;

    const senderId = extractAddress(payload.from);
    const senderName = extractDisplayName(payload.from);
    const channelId = extractAddress(payload.to);

    // Body precedence: prefer plain text; fall back to a stripped-tag
    // approximation of the HTML for the canonical message body. Mail
    // clients send html when text is missing.
    const text = payload.text
      ?? (payload.html ? payload.html.replace(/<[^>]+>/g, '').trim() : '');

    const attachments: Attachment[] = (payload.attachments ?? []).map((a) => ({
      type: a.contentType ?? 'application/octet-stream',
      url: a.url,
      name: a.filename,
    }));

    return {
      id: ulid(),
      channelType: 'email',
      channelId,
      senderId,
      senderName,
      text,
      attachments,
      timestamp: new Date().toISOString(),
      metadata: {
        subject: payload.subject,
        messageId: payload.messageId,
        inReplyTo: payload.inReplyTo,
      },
    };
  }

  async sendMessage(_ref: ChannelRef, _msg: OutboundMessage): Promise<DeliveryResult> {
    // In production, this would call an SMTP relay or transactional-mail
    // provider (SendGrid, Postmark, SES). Stubbed for now — caller gets
    // a deterministic Message-ID-shaped string for thread correlation.
    return {
      success: true,
      messageId: `<${ulid()}@urule.local>`,
    };
  }

  async sendApprovalCard(ref: ChannelRef, _card: ApprovalCard): Promise<DeliveryResult> {
    // Email-shaped approval cards render as a plain HTML email with
    // action links pointing at office-ui. Stub returns success.
    return this.sendMessage(ref, { text: '' });
  }

  async mapIdentity(user: ChannelUser): Promise<UruleIdentity | null> {
    // No directory lookup yet — identity-mappings table holds the
    // channelUserId↔uruleUserId binding (see channel-router routes).
    return null;
  }
}
