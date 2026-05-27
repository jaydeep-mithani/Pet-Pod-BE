import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequestUser } from '../auth/types';
import { ChatGateway } from '../chat/chat.gateway';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListMessagesQuery } from './dto/list-messages.query';
import { SendMessageDto } from './dto/send-message.dto';

@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly chat: ChatGateway,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.conversations.list(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  createOrGet(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreateConversationDto,
  ) {
    return this.conversations.createOrGet(user.id, dto.petId);
  }

  @Get(':id')
  getById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.conversations.getById(id, user.id);
  }

  @Get(':id/messages')
  listMessages(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query() query: ListMessagesQuery,
  ) {
    return this.conversations.listMessages(id, user.id, query);
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: SendMessageDto,
  ) {
    const { message, ownerId, adopterId } =
      await this.conversations.sendMessage(id, user.id, dto.body);
    this.chat.emitMessageCreated(message, { ownerId, adopterId });
    return message;
  }

  @Post(':id/delivered')
  @HttpCode(HttpStatus.OK)
  async markDelivered(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    const result = await this.conversations.markAllDelivered(id, user.id);
    this.chat.emitMessagesDelivered({
      conversationId: result.conversationId,
      recipientId: user.id,
      messageIds: result.messageIds,
      deliveredAt: result.deliveredAt,
      ownerId: result.ownerId,
      adopterId: result.adopterId,
    });
    return { messageIds: result.messageIds, deliveredAt: result.deliveredAt };
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    const result = await this.conversations.markAllRead(id, user.id);
    this.chat.emitMessagesRead({
      conversationId: result.conversationId,
      readerId: user.id,
      messageIds: result.messageIds,
      readAt: result.readAt,
      ownerId: result.ownerId,
      adopterId: result.adopterId,
    });
    return { messageIds: result.messageIds, readAt: result.readAt };
  }
}
