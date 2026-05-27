import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { COOKIE_ACCESS } from '../auth/auth.constants';
import type { JwtPayload } from '../auth/types';
import type { MessageRecord } from '../conversations/conversations.service';
import { PrismaService } from '../prisma/prisma.service';

const userRoom = (userId: string) => `user:${userId}`;

const parseCookies = (raw: string | undefined): Record<string, string> => {
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
};

interface ConversationScopedPayload {
  conversationId?: unknown;
}

@WebSocketGateway({
  cors: {
    origin: (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) return cb(null, true);
      const dev = process.env.NODE_ENV !== 'production';
      if (dev && /^https?:\/\/localhost(?::\d+)?$/.test(origin)) {
        return cb(null, true);
      }
      const allowlist = (process.env.FRONTEND_ORIGINS ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (allowlist.includes(origin)) return cb(null, true);
      cb(new Error(`Socket CORS: origin ${origin} is not allowed`), false);
    },
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // userId → set of connected socket ids. Tracks multi-tab so presence flips
  // only on 0→1 and N→0 transitions, not on every (re)connect.
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  handleConnection(socket: Socket) {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const token = cookies[COOKIE_ACCESS];
      if (!token) {
        socket.disconnect(true);
        return;
      }
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      const userId = payload.sub;
      (socket.data as { userId?: string }).userId = userId;
      void socket.join(userRoom(userId));

      const set = this.userSockets.get(userId) ?? new Set<string>();
      const wasOffline = set.size === 0;
      set.add(socket.id);
      this.userSockets.set(userId, set);
      if (wasOffline) {
        this.server.emit('presence:update', { userId, online: true });
      }
      this.logger.debug(`Connected ${userId} on ${socket.id}`);
    } catch {
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    const userId = (socket.data as { userId?: string }).userId;
    if (!userId) return;
    const set = this.userSockets.get(userId);
    if (!set) return;
    set.delete(socket.id);
    if (set.size === 0) {
      this.userSockets.delete(userId);
      this.server.emit('presence:update', { userId, online: false });
    }
    this.logger.debug(`Disconnected ${userId}`);
  }

  /** Snapshot of currently-online users — useful for a client just connecting. */
  @SubscribeMessage('presence:request')
  handlePresenceRequest(@ConnectedSocket() socket: Socket) {
    const userIds = Array.from(this.userSockets.keys());
    socket.emit('presence:snapshot', { userIds });
  }

  @SubscribeMessage('typing:start')
  onTypingStart(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: ConversationScopedPayload,
  ) {
    return this.forwardTypingEvent(socket, data, 'typing:start');
  }

  @SubscribeMessage('typing:stop')
  onTypingStop(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: ConversationScopedPayload,
  ) {
    return this.forwardTypingEvent(socket, data, 'typing:stop');
  }

  private async forwardTypingEvent(
    socket: Socket,
    data: ConversationScopedPayload,
    event: 'typing:start' | 'typing:stop',
  ) {
    const userId = (socket.data as { userId?: string }).userId;
    if (!userId) return;
    const conversationId =
      typeof data?.conversationId === 'string' ? data.conversationId : null;
    if (!conversationId) return;
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { ownerId: true, adopterId: true },
    });
    if (!conv) return;
    if (userId !== conv.ownerId && userId !== conv.adopterId) return;
    const otherUserId = userId === conv.ownerId ? conv.adopterId : conv.ownerId;
    this.server.to(userRoom(otherUserId)).emit(event, {
      conversationId,
      userId,
    });
  }

  emitMessageCreated(
    message: MessageRecord,
    recipients: { ownerId: string; adopterId: string },
  ) {
    const ownerR = userRoom(recipients.ownerId);
    const adopterR = userRoom(recipients.adopterId);
    this.server.to(ownerR).emit('message:new', message);
    if (adopterR !== ownerR) {
      this.server.to(adopterR).emit('message:new', message);
    }
  }

  emitMessagesDelivered(payload: {
    conversationId: string;
    recipientId: string;
    messageIds: string[];
    deliveredAt: string;
    ownerId: string;
    adopterId: string;
  }) {
    if (payload.messageIds.length === 0) return;
    const ownerR = userRoom(payload.ownerId);
    const adopterR = userRoom(payload.adopterId);
    const data = {
      conversationId: payload.conversationId,
      recipientId: payload.recipientId,
      messageIds: payload.messageIds,
      deliveredAt: payload.deliveredAt,
    };
    this.server.to(ownerR).emit('messages:delivered', data);
    if (adopterR !== ownerR) {
      this.server.to(adopterR).emit('messages:delivered', data);
    }
  }

  emitMessagesRead(payload: {
    conversationId: string;
    readerId: string;
    messageIds: string[];
    readAt: string;
    ownerId: string;
    adopterId: string;
  }) {
    if (payload.messageIds.length === 0) return;
    const ownerR = userRoom(payload.ownerId);
    const adopterR = userRoom(payload.adopterId);
    const data = {
      conversationId: payload.conversationId,
      readerId: payload.readerId,
      messageIds: payload.messageIds,
      readAt: payload.readAt,
    };
    this.server.to(ownerR).emit('messages:read', data);
    if (adopterR !== ownerR) {
      this.server.to(adopterR).emit('messages:read', data);
    }
  }
}
