import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CallType } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CloudStorageService } from '../beats/cloud-storage.service';
import { CommunicationService } from './communication.service';
import { CreateConversationActionDto } from './dto/create-conversation-action.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UploadCommunicationFileDto } from './dto/upload-communication-file.dto';

type UploadFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

@Controller('communication')
@UseGuards(AuthGuard('jwt'))
export class CommunicationController {
  constructor(
    private readonly communicationService: CommunicationService,
    private readonly cloudStorage: CloudStorageService,
  ) {}

  @Post('conversations')
  createConversation(@CurrentUser() user: { userId: number }, @Body() dto: CreateConversationDto) {
    return this.communicationService.createConversation(user.userId, dto);
  }

  @Post('projects/:projectId/chat')
  getOrCreateProjectChat(
    @CurrentUser() user: { userId: number },
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.communicationService.getOrCreateProjectChat(user.userId, projectId);
  }

  @Get('conversations')
  listConversations(@CurrentUser() user: { userId: number }) {
    return this.communicationService.listMyConversations(user.userId);
  }

  @Get('conversations/:conversationId/messages')
  listMessages(
    @CurrentUser() user: { userId: number },
    @Param('conversationId') conversationId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.communicationService.listMessages(user.userId, conversationId, Number(limit ?? 50), cursor);
  }

  @Get('conversations/:conversationId/messages/search')
  searchMessages(
    @CurrentUser() user: { userId: number },
    @Param('conversationId') conversationId: string,
    @Query('q') q: string,
    @Query('messageType') messageType?: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    if (!q) throw new BadRequestException('q is required');
    return this.communicationService.searchMessages(
      user.userId,
      conversationId,
      q,
      messageType,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
      Number(limit ?? 50),
    );
  }

  @Post('messages')
  sendMessage(@CurrentUser() user: { userId: number }, @Body() dto: SendMessageDto) {
    return this.communicationService.sendMessage(user.userId, dto);
  }

  @Patch('messages/:messageId')
  editMessage(
    @CurrentUser() user: { userId: number },
    @Param('messageId') messageId: string,
    @Body() body: { content: string },
  ) {
    return this.communicationService.editMessage(user.userId, messageId, body.content);
  }

  @Delete('messages/:messageId')
  deleteMessage(@CurrentUser() user: { userId: number }, @Param('messageId') messageId: string) {
    return this.communicationService.deleteMessage(user.userId, messageId);
  }

  @Post('messages/:messageId/report')
  reportMessage(
    @CurrentUser() user: { userId: number },
    @Param('messageId') messageId: string,
    @Body() body: { reason: string },
  ) {
    return this.communicationService.reportMessage(user.userId, messageId, body.reason);
  }

  @Post('users/:userId/block')
  blockUser(@CurrentUser() user: { userId: number }, @Param('userId', ParseIntPipe) blockedId: number) {
    return this.communicationService.blockUser(user.userId, blockedId);
  }

  @Delete('users/:userId/block')
  unblockUser(@CurrentUser() user: { userId: number }, @Param('userId', ParseIntPipe) blockedId: number) {
    return this.communicationService.unblockUser(user.userId, blockedId);
  }

  @Post('conversations/:conversationId/read')
  markRead(
    @CurrentUser() user: { userId: number },
    @Param('conversationId') conversationId: string,
    @Body() body: { messageId?: string },
  ) {
    return this.communicationService.markRead(user.userId, conversationId, body?.messageId);
  }

  @Post('conversations/:conversationId/delivered')
  markDelivered(@CurrentUser() user: { userId: number }, @Param('conversationId') conversationId: string) {
    return this.communicationService.markDelivered(user.userId, conversationId);
  }

  @Post('attachments/:attachmentId/access-token')
  createAttachmentAccessToken(
    @CurrentUser() user: { userId: number },
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.communicationService.createAttachmentAccessToken(user.userId, attachmentId);
  }

  @Get('attachments/access')
  resolveAttachmentAccessToken(@Query('token') token: string) {
    if (!token) throw new BadRequestException('token is required');
    return this.communicationService.resolveAttachmentAccessToken(token);
  }

  @Post('actions')
  createAction(@CurrentUser() user: { userId: number }, @Body() dto: CreateConversationActionDto) {
    return this.communicationService.createAction(user.userId, dto);
  }

  @Post('calls/start')
  startCall(
    @CurrentUser() user: { userId: number },
    @Body() body: { conversationId: string; type: CallType },
  ) {
    return this.communicationService.startCall(user.userId, body.conversationId, body.type);
  }

  @Post('calls/:callId/end')
  endCall(
    @CurrentUser() user: { userId: number },
    @Param('callId') callId: string,
    @Body() body: { reason?: string },
  ) {
    return this.communicationService.endCall(user.userId, callId, body.reason);
  }

  @Get('calls/history')
  listCallHistory(
    @CurrentUser() user: { userId: number },
    @Query('conversationId') conversationId?: string,
  ) {
    return this.communicationService.listCallHistory(user.userId, conversationId);
  }

  @Get('calls/ice-config')
  getIceConfig() {
    return this.communicationService.getIceConfig();
  }

  @Get('calls/:callId')
  getCallById(@CurrentUser() user: { userId: number }, @Param('callId') callId: string) {
    return this.communicationService.getCallById(user.userId, callId);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req, file, callback) => {
        const lower = file.originalname.toLowerCase();
        const allowedExt = [
          '.mp3',
          '.wav',
          '.m4a',
          '.ogg',
          '.mp4',
          '.mov',
          '.webm',
          '.png',
          '.jpg',
          '.jpeg',
          '.gif',
          '.webp',
        ];
        const hasAllowedExt = allowedExt.some((ext) => lower.endsWith(ext));
        const allowed =
          file.mimetype.startsWith('audio/') ||
          file.mimetype.startsWith('video/') ||
          file.mimetype.startsWith('image/');

        if (!allowed || !hasAllowedExt) {
          callback(
            new BadRequestException('Only supported audio/video/image files are allowed'),
            false,
          );
          return;
        }
        callback(null, true);
      },
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
    }),
  )
  async uploadFile(
    @CurrentUser() user: { userId: number },
    @UploadedFile() file: UploadFile,
    @Body() dto: UploadCommunicationFileDto,
  ) {
    if (!file) throw new BadRequestException('file is required');
    if (dto.conversationId) {
      await this.communicationService.ensureParticipant(dto.conversationId, user.userId);
    }

    const fileUrl = await this.cloudStorage.uploadFile(file, 'communication/files');
    return {
      fileUrl,
      fileType: file.mimetype,
      fileName: file.originalname,
      fileSize: file.size,
      conversationId: dto.conversationId ?? null,
    };
  }
}
