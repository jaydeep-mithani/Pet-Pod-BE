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
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequestUser } from '../auth/types';
import { ChatGateway } from '../chat/chat.gateway';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListMessagesQuery } from './dto/list-messages.query';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('Conversations')
@ApiCookieAuth('pp_access')
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly chat: ChatGateway,
  ) {}

  @ApiOperation({ summary: 'List the current user’s conversations.' })
  @Get()
  list(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.conversations.list(user.id);
  }

  @ApiOperation({
    summary:
      'Create or return the existing conversation between the current user (adopter) and the rehomer of the given pet.',
  })
  @Post()
  @HttpCode(HttpStatus.OK)
  createOrGet(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreateConversationDto,
  ) {
    return this.conversations.createOrGet(user.id, dto.petId);
  }

  @ApiOperation({
    summary: 'Fetch a conversation by id (must be a participant).',
  })
  @Get(':id')
  getById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.conversations.getById(id, user.id);
  }

  @ApiOperation({ summary: 'Paginated message history for a conversation.' })
  @Get(':id/messages')
  listMessages(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query() query: ListMessagesQuery,
  ) {
    return this.conversations.listMessages(id, user.id, query);
  }

  @ApiOperation({ summary: 'Send a message. Also broadcasts via Socket.IO.' })
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

  @ApiOperation({ summary: 'Mark all messages in the conversation delivered.' })
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

  @ApiOperation({ summary: 'Mark all messages in the conversation read.' })
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
