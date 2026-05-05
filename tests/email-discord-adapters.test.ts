import { describe, it, expect } from 'vitest';
import { EmailAdapter } from '../src/adapters/email.adapter.js';
import { DiscordAdapter } from '../src/adapters/discord.adapter.js';

describe('EmailAdapter', () => {
  const adapter = new EmailAdapter();

  it('normalizes "Display Name <addr>" sender into address + display name', async () => {
    const msg = await adapter.receiveWebhook({
      channelType: 'email',
      headers: {},
      body: {
        from: 'Alice Doe <alice@example.com>',
        to: 'support@urule.test',
        subject: 'Hi',
        text: 'Hello',
      },
    });
    expect(msg.senderId).toBe('alice@example.com');
    expect(msg.senderName).toBe('Alice Doe');
    expect(msg.channelId).toBe('support@urule.test');
  });

  it('falls back to local-part as display name when no name is present', async () => {
    const msg = await adapter.receiveWebhook({
      channelType: 'email',
      headers: {},
      body: { from: 'bob@example.com', to: 'support@urule.test', subject: 'Hi', text: 'Hi' },
    });
    expect(msg.senderId).toBe('bob@example.com');
    expect(msg.senderName).toBe('bob');
  });

  it('lowercases addresses for consistent identity matching', async () => {
    const msg = await adapter.receiveWebhook({
      channelType: 'email',
      headers: {},
      body: { from: 'BOB@Example.COM', to: 'Support@Urule.Test', subject: 'Hi', text: 'Hi' },
    });
    expect(msg.senderId).toBe('bob@example.com');
    expect(msg.channelId).toBe('support@urule.test');
  });

  it('strips HTML tags when only html body is provided', async () => {
    const msg = await adapter.receiveWebhook({
      channelType: 'email',
      headers: {},
      body: {
        from: 'a@b.test',
        to: 'c@d.test',
        subject: 'Hi',
        html: '<p>Hello <strong>world</strong></p>',
      },
    });
    expect(msg.text).toBe('Hello world');
  });

  it('preserves messageId/inReplyTo/subject in metadata', async () => {
    const msg = await adapter.receiveWebhook({
      channelType: 'email',
      headers: {},
      body: {
        from: 'a@b.test',
        to: 'c@d.test',
        subject: 'Re: deploy',
        text: '+1',
        messageId: '<msg-1@example.com>',
        inReplyTo: '<msg-0@example.com>',
      },
    });
    expect(msg.metadata?.subject).toBe('Re: deploy');
    expect(msg.metadata?.messageId).toBe('<msg-1@example.com>');
    expect(msg.metadata?.inReplyTo).toBe('<msg-0@example.com>');
  });

  it('maps inbound attachments to canonical Attachment shape', async () => {
    const msg = await adapter.receiveWebhook({
      channelType: 'email',
      headers: {},
      body: {
        from: 'a@b.test',
        to: 'c@d.test',
        subject: 'Hi',
        text: 'see attached',
        attachments: [{ filename: 'report.pdf', url: 'https://x/y.pdf', contentType: 'application/pdf' }],
      },
    });
    expect(msg.attachments).toEqual([
      { type: 'application/pdf', url: 'https://x/y.pdf', name: 'report.pdf' },
    ]);
  });

  it('outbound sendMessage returns a Message-ID-shaped string', async () => {
    const r = await adapter.sendMessage(
      { channelType: 'email', channelId: 'a@b.test' },
      { text: 'Hi' },
    );
    expect(r.success).toBe(true);
    expect(r.messageId).toMatch(/^<.+@urule\.local>$/);
  });
});

describe('DiscordAdapter', () => {
  const adapter = new DiscordAdapter();

  it('normalizes a Discord MESSAGE_CREATE payload', async () => {
    const msg = await adapter.receiveWebhook({
      channelType: 'discord',
      headers: {},
      body: {
        type: 0,
        id: '123456789',
        channel_id: 'C-DISCORD-1',
        guild_id: 'G-1',
        author: { id: 'U-1', username: 'alice', global_name: 'Alice' },
        content: 'Hello',
        timestamp: '2026-05-04T12:00:00.000Z',
        attachments: [],
      },
    });
    expect(msg.channelType).toBe('discord');
    expect(msg.channelId).toBe('C-DISCORD-1');
    expect(msg.senderId).toBe('U-1');
    expect(msg.senderName).toBe('Alice');
    expect(msg.text).toBe('Hello');
    expect(msg.timestamp).toBe('2026-05-04T12:00:00.000Z');
    expect(msg.metadata?.discordMessageId).toBe('123456789');
    expect(msg.metadata?.guildId).toBe('G-1');
    expect(msg.metadata?.isBot).toBe(false);
  });

  it('falls back to username when global_name is null/missing', async () => {
    const msg = await adapter.receiveWebhook({
      channelType: 'discord',
      headers: {},
      body: {
        type: 0, id: '1', channel_id: 'C', author: { id: 'U-2', username: 'bob' },
        content: 'Hi', timestamp: '2026-05-04T00:00:00Z',
      },
    });
    expect(msg.senderName).toBe('bob');
  });

  it('flags bot messages via metadata.isBot', async () => {
    const msg = await adapter.receiveWebhook({
      channelType: 'discord',
      headers: {},
      body: {
        type: 0, id: '1', channel_id: 'C',
        author: { id: 'B-1', username: 'helper-bot', bot: true },
        content: 'Beep boop', timestamp: '2026-05-04T00:00:00Z',
      },
    });
    expect(msg.metadata?.isBot).toBe(true);
  });

  it('maps Discord attachments to canonical Attachment shape', async () => {
    const msg = await adapter.receiveWebhook({
      channelType: 'discord',
      headers: {},
      body: {
        type: 0, id: '1', channel_id: 'C',
        author: { id: 'U', username: 'u' },
        content: '', timestamp: '2026-05-04T00:00:00Z',
        attachments: [{ id: 'a1', filename: 'pic.png', url: 'https://cdn/pic.png', content_type: 'image/png' }],
      },
    });
    expect(msg.attachments).toEqual([
      { type: 'image/png', url: 'https://cdn/pic.png', name: 'pic.png' },
    ]);
  });

  it('preserves replyTo when message_reference is set', async () => {
    const msg = await adapter.receiveWebhook({
      channelType: 'discord',
      headers: {},
      body: {
        type: 19, id: '2', channel_id: 'C',
        author: { id: 'U', username: 'u' },
        content: '+1', timestamp: '2026-05-04T00:00:00Z',
        message_reference: { message_id: '1', channel_id: 'C' },
      },
    });
    expect(msg.metadata?.replyTo).toBe('1');
  });
});
