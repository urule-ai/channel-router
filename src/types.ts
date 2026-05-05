export type ChannelType = 'slack' | 'telegram' | 'email' | 'webhook' | 'discord';

export interface NormalizedMessage {
  id: string;
  channelType: ChannelType;
  channelId: string;
  senderId: string;
  senderName: string;
  text: string;
  attachments: Attachment[];
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface Attachment {
  type: string;
  url?: string;
  name?: string;
  content?: string;
}

export interface InboundWebhook {
  channelType: ChannelType;
  headers: Record<string, string>;
  body: unknown;
}

export interface OutboundMessage {
  text: string;
  threadId?: string;
  attachments?: Attachment[];
}

export interface ChannelRef {
  channelType: ChannelType;
  channelId: string;
  threadId?: string;
}

export interface ApprovalCard {
  approvalId: string;
  title: string;
  description: string;
  requester: string;
  actions: ApprovalAction[];
  urgency: 'low' | 'medium' | 'high';
}

export interface ApprovalAction {
  label: string;
  value: string;
  style: 'primary' | 'danger' | 'default';
}

export interface DeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ChannelUser {
  channelType: ChannelType;
  channelUserId: string;
  displayName?: string;
  email?: string;
}

export interface UruleIdentity {
  userId: string;
  orgId: string;
  workspaceIds: string[];
}

export interface ChannelBinding {
  id: string;
  channelType: ChannelType;
  channelId: string;
  workspaceId: string;
  config: Record<string, unknown>;
  createdAt: string;
}

export interface IdentityMapping {
  id: string;
  channelType: ChannelType;
  channelUserId: string;
  uruleUserId: string;
  createdAt: string;
}

export interface ChannelAdapter {
  channelType: ChannelType;
  receiveWebhook(req: InboundWebhook): Promise<NormalizedMessage>;
  sendMessage(ref: ChannelRef, msg: OutboundMessage): Promise<DeliveryResult>;
  sendApprovalCard(ref: ChannelRef, card: ApprovalCard): Promise<DeliveryResult>;
  mapIdentity(user: ChannelUser): Promise<UruleIdentity | null>;
}
