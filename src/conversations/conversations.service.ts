import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const USER_SUMMARY = {
  id: true,
  name: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

const PET_SUMMARY = {
  id: true,
  name: true,
  species: true,
  status: true,
  photos: {
    select: { id: true, url: true, order: true },
    orderBy: { order: 'asc' },
    take: 1,
  },
} satisfies Prisma.PetSelect;

const CONVERSATION_SELECT = {
  id: true,
  petId: true,
  ownerId: true,
  adopterId: true,
  createdAt: true,
  updatedAt: true,
  pet: { select: PET_SUMMARY },
  owner: { select: USER_SUMMARY },
  adopter: { select: USER_SUMMARY },
} satisfies Prisma.ConversationSelect;

const CONVERSATION_LIST_SELECT = {
  ...CONVERSATION_SELECT,
  messages: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { id: true, body: true, senderId: true, createdAt: true },
  },
} satisfies Prisma.ConversationSelect;

const MESSAGE_SELECT = {
  id: true,
  conversationId: true,
  senderId: true,
  body: true,
  deliveredAt: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.MessageSelect;

export type MessageRecord = Prisma.MessageGetPayload<{
  select: typeof MESSAGE_SELECT;
}>;

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrGet(adopterId: string, petId: string) {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
      select: { id: true, ownerId: true },
    });
    if (!pet) throw new NotFoundException('Pet not found');
    if (pet.ownerId === adopterId) {
      throw new ForbiddenException(
        "You can't message yourself about your own pet",
      );
    }

    return this.prisma.conversation.upsert({
      where: {
        petId_adopterId: { petId, adopterId },
      },
      create: {
        petId,
        adopterId,
        ownerId: pet.ownerId,
      },
      update: {},
      select: CONVERSATION_SELECT,
    });
  }

  async list(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { OR: [{ ownerId: userId }, { adopterId: userId }] },
      orderBy: { updatedAt: 'desc' },
      select: {
        ...CONVERSATION_LIST_SELECT,
        _count: {
          select: {
            messages: {
              where: { readAt: null, NOT: { senderId: userId } },
            },
          },
        },
      },
    });
    return conversations.map((c) => {
      const { _count, ...rest } = c;
      return { ...rest, unreadCount: _count.messages };
    });
  }

  async markAllDelivered(conversationId: string, userId: string) {
    const conv = await this.assertParticipant(conversationId, userId);
    const undelivered = await this.prisma.message.findMany({
      where: {
        conversationId,
        deliveredAt: null,
        NOT: { senderId: userId },
      },
      select: { id: true },
    });
    if (undelivered.length === 0) {
      return {
        messageIds: [] as string[],
        deliveredAt: new Date().toISOString(),
        ownerId: conv.ownerId,
        adopterId: conv.adopterId,
        conversationId,
      };
    }
    const deliveredAt = new Date();
    await this.prisma.message.updateMany({
      where: { id: { in: undelivered.map((m) => m.id) } },
      data: { deliveredAt },
    });
    return {
      messageIds: undelivered.map((m) => m.id),
      deliveredAt: deliveredAt.toISOString(),
      ownerId: conv.ownerId,
      adopterId: conv.adopterId,
      conversationId,
    };
  }

  async markAllRead(conversationId: string, userId: string) {
    const conv = await this.assertParticipant(conversationId, userId);
    const unread = await this.prisma.message.findMany({
      where: {
        conversationId,
        readAt: null,
        NOT: { senderId: userId },
      },
      select: { id: true },
    });
    if (unread.length === 0) {
      return {
        messageIds: [] as string[],
        readAt: new Date().toISOString(),
        ownerId: conv.ownerId,
        adopterId: conv.adopterId,
        conversationId,
      };
    }
    const readAt = new Date();
    await this.prisma.message.updateMany({
      where: { id: { in: unread.map((m) => m.id) } },
      data: { readAt },
    });
    return {
      messageIds: unread.map((m) => m.id),
      readAt: readAt.toISOString(),
      ownerId: conv.ownerId,
      adopterId: conv.adopterId,
      conversationId,
    };
  }

  async getById(id: string, userId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id },
      select: CONVERSATION_SELECT,
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.ownerId !== userId && conv.adopterId !== userId) {
      throw new ForbiddenException("You're not part of this conversation");
    }
    return conv;
  }

  async listMessages(
    conversationId: string,
    userId: string,
    opts: { before?: string; limit?: number } = {},
  ) {
    await this.assertParticipant(conversationId, userId);
    const limit = opts.limit ?? 50;
    const where: Prisma.MessageWhereInput = { conversationId };
    if (opts.before) {
      const date = new Date(opts.before);
      if (!Number.isNaN(date.getTime())) {
        where.createdAt = { lt: date };
      }
    }
    const messages = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: MESSAGE_SELECT,
    });
    const nextBefore =
      messages.length === limit
        ? messages[messages.length - 1].createdAt.toISOString()
        : null;
    return { messages, nextBefore };
  }

  async sendMessage(
    conversationId: string,
    userId: string,
    body: string,
  ): Promise<{
    message: MessageRecord;
    ownerId: string;
    adopterId: string;
  }> {
    const conv = await this.assertParticipant(conversationId, userId);
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { conversationId, senderId: userId, body },
        select: MESSAGE_SELECT,
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
        select: { id: true },
      }),
    ]);
    return { message, ownerId: conv.ownerId, adopterId: conv.adopterId };
  }

  private async assertParticipant(conversationId: string, userId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { ownerId: true, adopterId: true },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.ownerId !== userId && conv.adopterId !== userId) {
      throw new ForbiddenException("You're not part of this conversation");
    }
    return conv;
  }
}
