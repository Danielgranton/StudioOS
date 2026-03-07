import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Cron } from '@nestjs/schedule';
import {
  AuditEventType,
  CallStatus,
  CallType,
  ConversationActionType,
  ConversationType,
  DeliveryStatus,
  MessageType,
  ModerationStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CommunicationRealtimeService } from './communication-realtime.service';
import { CreateConversationActionDto } from './dto/create-conversation-action.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class CommunicationService {
  private readonly logger = new Logger(CommunicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly realtime: CommunicationRealtimeService,
    private readonly jwt: JwtService,
  ) {}

  private async audit(actorId: number, eventType: AuditEventType, targetId?: string, metadata?: object) {
    await this.prisma.auditLog.create({
      data: {
        actorId,
        eventType,
        targetId,
        metadata,
      },
    });
  }

  private async assertParticipant(conversationId: string, userId: number) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant || participant.leftAt) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }
    return participant;
  }

  async ensureParticipant(conversationId: string, userId: number) {
    await this.assertParticipant(conversationId, userId);
  }

  private async assertCallParticipant(callId: string, userId: number) {
    const call = await this.prisma.callSession.findUnique({
      where: { id: callId },
      select: {
        id: true,
        conversationId: true,
        status: true,
      },
    });
    if (!call) throw new NotFoundException('Call session not found');
    await this.assertParticipant(call.conversationId, userId);
    return call;
  }

  async assertCallParticipantInConversation(callId: string, conversationId: string, userId: number) {
    const call = await this.assertCallParticipant(callId, userId);
    if (call.conversationId !== conversationId) {
      throw new ForbiddenException('Call does not belong to this conversation');
    }
    return call;
  }

  private async assertNotBlockedInConversation(conversationId: string, senderId: number) {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, leftAt: null },
      select: { userId: true },
    });
    const ids = participants.map((p) => p.userId).filter((id) => id !== senderId);
    if (!ids.length) return;

    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: senderId, blockedId: { in: ids } },
          { blockerId: { in: ids }, blockedId: senderId },
        ],
      },
    });
    if (block) throw new ForbiddenException('Messaging is blocked for this conversation');
  }

  async createConversation(userId: number, dto: CreateConversationDto) {
    const participantIds = Array.from(new Set([userId, ...(dto.participantIds || [])]));
    if (participantIds.length < 2) throw new BadRequestException('A conversation requires at least 2 participants');

    if (dto.type === ConversationType.PROJECT_CHAT && !dto.projectId) {
      throw new BadRequestException('projectId is required for PROJECT_CHAT');
    }

    if (dto.type === ConversationType.GENERAL_CHAT && participantIds.length !== 2) {
      throw new BadRequestException('GENERAL_CHAT supports exactly 2 participants');
    }

    if (dto.type === ConversationType.GENERAL_CHAT) {
      const existing = await this.prisma.conversation.findFirst({
        where: {
          type: ConversationType.GENERAL_CHAT,
          participants: { every: { userId: { in: participantIds }, leftAt: null } },
        },
        include: { participants: true },
      });
      if (existing && existing.participants.length === 2) return existing;
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        type: dto.type,
        projectId: dto.projectId,
        bookingRef: dto.bookingRef,
        beatId: dto.beatId,
        artistId: dto.artistId,
        producerId: dto.producerId,
        createdById: userId,
        participants: { create: participantIds.map((pid) => ({ userId: pid })) },
      },
      include: {
        participants: {
          include: { user: { select: { id: true, name: true, role: true } } },
        },
      },
    });
    await this.audit(userId, AuditEventType.CONVERSATION_CREATED, conversation.id, { type: dto.type });
    return conversation;
  }

  async getOrCreateProjectChat(userId: number, projectId: number) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (![project.artistId, project.producerId].includes(userId)) {
      throw new ForbiddenException('Only project participants can access project chat');
    }

    const existing = await this.prisma.conversation.findFirst({
      where: { type: ConversationType.PROJECT_CHAT, projectId },
      include: { participants: { select: { userId: true } } },
    });
    if (existing) return existing;

    return this.createConversation(userId, {
      type: ConversationType.PROJECT_CHAT,
      projectId,
      artistId: project.artistId,
      producerId: project.producerId,
      participantIds: [project.artistId, project.producerId],
    });
  }

  async listMyConversations(userId: number) {
    return this.prisma.conversation.findMany({
      where: { participants: { some: { userId, leftAt: null } } },
      include: {
        participants: { include: { user: { select: { id: true, name: true, role: true } } } },
        messages: {
          where: { moderationStatus: { not: ModerationStatus.DELETED } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: { id: true, name: true, role: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async listMessages(userId: number, conversationId: string, limit = 50, cursor?: string) {
    await this.assertParticipant(conversationId, userId);
    const take = Math.min(Math.max(limit, 1), 100);
    const rows = await this.prisma.message.findMany({
      where: {
        conversationId,
        moderationStatus: { not: ModerationStatus.DELETED },
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
        attachments: true,
        deliveries: { where: { userId }, select: { status: true, readAt: true, deliveredAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return rows.reverse();
  }

  async searchMessages(
    userId: number,
    conversationId: string,
    q: string,
    messageType?: MessageType,
    from?: Date,
    to?: Date,
    limit = 50,
  ) {
    await this.assertParticipant(conversationId, userId);
    return this.prisma.message.findMany({
      where: {
        conversationId,
        moderationStatus: { not: ModerationStatus.DELETED },
        content: { contains: q, mode: 'insensitive' },
        ...(messageType ? { messageType } : {}),
        ...(from || to ? { createdAt: { gte: from, lte: to } } : {}),
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
        attachments: true,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  async sendMessage(userId: number, dto: SendMessageDto) {
    await this.assertParticipant(dto.conversationId, userId);
    await this.assertNotBlockedInConversation(dto.conversationId, userId);
    if (!dto.content && (!dto.attachments || dto.attachments.length === 0)) {
      throw new BadRequestException('Message must have content or attachments');
    }

    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId: dto.conversationId, leftAt: null, userId: { not: userId } },
      select: { userId: true },
    });

    const message = await this.prisma.message.create({
      data: {
        conversationId: dto.conversationId,
        senderId: userId,
        content: dto.content,
        messageType: dto.messageType || MessageType.TEXT,
        attachments: dto.attachments?.length
          ? { create: dto.attachments.map((a) => ({ fileUrl: a.fileUrl, fileType: a.fileType, fileName: a.fileName })) }
          : undefined,
        deliveries: {
          create: participants.map((p) => ({ userId: p.userId, status: DeliveryStatus.SENT })),
        },
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
        attachments: true,
      },
    });

    await this.prisma.conversation.update({ where: { id: dto.conversationId }, data: { updatedAt: new Date() } });
    await this.prisma.conversationParticipant.updateMany({
      where: { conversationId: dto.conversationId, leftAt: null, userId: { not: userId } },
      data: { unreadCount: { increment: 1 } },
    });

    const recipientIds = participants.map((p) => p.userId);
    await this.notifications.createBulkNotifications(recipientIds, NotificationType.NEW_MESSAGE, 'You have a new message', {
      conversationId: dto.conversationId,
      messageId: message.id,
    });

    await this.audit(userId, AuditEventType.MESSAGE_CREATED, message.id, { conversationId: dto.conversationId });
    this.realtime.emitConversationMessage(dto.conversationId, message);
    return message;
  }

  async editMessage(userId: number, messageId: string, content: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) throw new ForbiddenException('You can only edit your own message');
    await this.assertParticipant(message.conversationId, userId);

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { content, editedAt: new Date(), moderationStatus: ModerationStatus.EDITED },
    });
    await this.audit(userId, AuditEventType.MESSAGE_EDITED, messageId, { conversationId: message.conversationId });
    this.realtime.emitConversationMessage(message.conversationId, { event: 'message:edited', message: updated });
    return updated;
  }

  async deleteMessage(userId: number, messageId: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) throw new ForbiddenException('You can only delete your own message');

    const deleted = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        content: null,
        deletedAt: new Date(),
        moderationStatus: ModerationStatus.DELETED,
      },
    });
    await this.audit(userId, AuditEventType.MESSAGE_DELETED, messageId, { conversationId: message.conversationId });
    this.realtime.emitConversationMessage(message.conversationId, { event: 'message:deleted', messageId });
    return deleted;
  }

  async reportMessage(userId: number, messageId: string, reason: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');
    await this.assertParticipant(message.conversationId, userId);

    const report = await this.prisma.messageReport.create({
      data: { messageId, reporterId: userId, reason },
    });
    await this.prisma.message.update({
      where: { id: messageId },
      data: { moderationStatus: ModerationStatus.FLAGGED, moderatedAt: new Date(), moderatedById: userId },
    });
    await this.audit(userId, AuditEventType.MESSAGE_REPORTED, messageId, { reason });
    return report;
  }

  async blockUser(blockerId: number, blockedId: number) {
    if (blockerId === blockedId) throw new BadRequestException('Cannot block yourself');
    const block = await this.prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      update: {},
      create: { blockerId, blockedId },
    });
    await this.audit(blockerId, AuditEventType.USER_BLOCKED, blockedId.toString());
    return block;
  }

  async unblockUser(blockerId: number, blockedId: number) {
    await this.prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
    await this.audit(blockerId, AuditEventType.USER_UNBLOCKED, blockedId.toString());
    return { removed: true };
  }

  async markDelivered(userId: number, conversationId: string) {
    await this.assertParticipant(conversationId, userId);
    await this.prisma.messageDelivery.updateMany({
      where: {
        userId,
        status: DeliveryStatus.SENT,
        message: { conversationId },
      },
      data: { status: DeliveryStatus.DELIVERED, deliveredAt: new Date() },
    });
    return { delivered: true };
  }

  async markRead(userId: number, conversationId: string, messageId?: string) {
    await this.assertParticipant(conversationId, userId);
    const lastMessage = messageId
      ? await this.prisma.message.findUnique({ where: { id: messageId } })
      : await this.prisma.message.findFirst({ where: { conversationId }, orderBy: { createdAt: 'desc' } });
    if (!lastMessage) return { read: false };

    await this.prisma.$transaction(async (tx) => {
      await tx.messageDelivery.updateMany({
        where: { userId, message: { conversationId } },
        data: { status: DeliveryStatus.READ, readAt: new Date(), deliveredAt: new Date() },
      });
      await tx.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { lastReadMessageId: lastMessage.id, lastReadAt: new Date(), unreadCount: 0 },
      });
    });
    return { read: true, messageId: lastMessage.id };
  }

  async createAction(userId: number, dto: CreateConversationActionDto) {
    await this.assertParticipant(dto.conversationId, userId);
    const action = await this.prisma.conversationAction.create({
      data: {
        conversationId: dto.conversationId,
        messageId: dto.messageId,
        actorId: userId,
        actionType: dto.actionType,
        payload: dto.payload as Prisma.InputJsonValue | undefined,
      },
    });

    if (
      dto.actionType === ConversationActionType.BOOKING_REQUEST_ACCEPTED ||
      dto.actionType === ConversationActionType.BOOKING_REQUEST_DECLINED
    ) {
      const requestActionId = String((dto.payload as { requestActionId?: string } | undefined)?.requestActionId ?? '');
      if (!requestActionId) {
        throw new BadRequestException('requestActionId is required for booking decision actions');
      }
    }

    const actionToNotificationType: Partial<Record<ConversationActionType, NotificationType>> = {
      BOOKING_REQUEST_SENT: NotificationType.BOOKING_REQUEST,
      PAYMENT_REQUEST_SENT: NotificationType.PAYMENT_REQUEST,
      PROJECT_STATUS_CHANGED: NotificationType.PROJECT_UPDATE,
      BEAT_SHARED: NotificationType.BEAT_SHARED,
    };

    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId: dto.conversationId, leftAt: null, userId: { not: userId } },
      select: { userId: true },
    });
    const notificationType = actionToNotificationType[dto.actionType] ?? NotificationType.PROJECT_UPDATE;
    await this.notifications.createBulkNotifications(
      participants.map((p) => p.userId),
      notificationType,
      `Conversation action: ${dto.actionType}`,
      { conversationId: dto.conversationId, actionId: action.id },
    );
    await this.audit(userId, AuditEventType.ACTION_CREATED, action.id, { actionType: dto.actionType });
    return action;
  }

  async startCall(userId: number, conversationId: string, type: CallType) {
    await this.assertParticipant(conversationId, userId);
    await this.assertNotBlockedInConversation(conversationId, userId);

    const active = await this.prisma.callSession.findFirst({
      where: {
        conversationId,
        status: { in: [CallStatus.RINGING, CallStatus.ACTIVE] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (active) {
      throw new BadRequestException('Another call is already in progress for this conversation');
    }

    const call = await this.prisma.callSession.create({
      data: {
        conversationId,
        initiatorId: userId,
        type,
      },
    });

    const recipients = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, leftAt: null, userId: { not: userId } },
      select: { userId: true },
    });

    await this.notifications.createBulkNotifications(
      recipients.map((p) => p.userId),
      NotificationType.INCOMING_CALL,
      `Incoming ${type.toLowerCase()} call`,
      {
        conversationId,
        callId: call.id,
        type,
      },
    );

    await this.audit(userId, AuditEventType.ACTION_CREATED, call.id, {
      action: 'call_started',
      conversationId,
      type,
    });
    this.logger.log(JSON.stringify({ event: 'call_started', userId, conversationId, callId: call.id, type }));

    return call;
  }

  async answerCall(userId: number, callId: string, accepted: boolean) {
    const call = await this.assertCallParticipant(callId, userId);
    if (call.status !== CallStatus.RINGING) {
      throw new BadRequestException('Call is no longer ringing');
    }

    if (!accepted) {
      const rejected = await this.prisma.callSession.update({
        where: { id: callId },
        data: {
          status: CallStatus.REJECTED,
          endedAt: new Date(),
          endedById: userId,
          endedReason: 'rejected',
        },
      });
      await this.audit(userId, AuditEventType.ACTION_CREATED, callId, { action: 'call_rejected' });
      this.logger.log(JSON.stringify({ event: 'call_rejected', userId, conversationId: call.conversationId, callId }));
      return rejected;
    }

    const answered = await this.prisma.callSession.update({
      where: { id: callId },
      data: {
        status: CallStatus.ACTIVE,
        acceptedAt: new Date(),
      },
    });
    await this.audit(userId, AuditEventType.ACTION_CREATED, callId, { action: 'call_answered' });
    this.logger.log(JSON.stringify({ event: 'call_answered', userId, conversationId: call.conversationId, callId }));
    return answered;
  }

  async endCall(userId: number, callId: string, reason?: string) {
    const call = await this.assertCallParticipant(callId, userId);
    if (
      call.status === CallStatus.ENDED ||
      call.status === CallStatus.REJECTED ||
      call.status === CallStatus.MISSED
    ) {
      return this.prisma.callSession.findUnique({ where: { id: callId } });
    }

    const nextStatus = call.status === CallStatus.RINGING ? CallStatus.MISSED : CallStatus.ENDED;
    const ended = await this.prisma.callSession.update({
      where: { id: callId },
      data: {
        status: nextStatus,
        endedAt: new Date(),
        endedById: userId,
        endedReason: reason ?? (nextStatus === CallStatus.MISSED ? 'no_answer' : 'ended'),
      },
    });

    if (nextStatus === CallStatus.MISSED) {
      const recipients = await this.prisma.conversationParticipant.findMany({
        where: { conversationId: call.conversationId, leftAt: null, userId: { not: userId } },
        select: { userId: true },
      });
      await this.notifications.createBulkNotifications(
        recipients.map((p) => p.userId),
        NotificationType.MISSED_CALL,
        'Missed call',
        {
          conversationId: call.conversationId,
          callId,
        },
      );
    }

    await this.audit(userId, AuditEventType.ACTION_CREATED, callId, { action: 'call_ended', status: nextStatus });
    this.logger.log(
      JSON.stringify({ event: 'call_ended', userId, conversationId: call.conversationId, callId, status: nextStatus }),
    );
    return ended;
  }

  async listCallHistory(userId: number, conversationId?: string) {
    const where = conversationId
      ? { conversationId, conversation: { participants: { some: { userId, leftAt: null } } } }
      : { conversation: { participants: { some: { userId, leftAt: null } } } };

    return this.prisma.callSession.findMany({
      where,
      include: {
        initiator: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getCallById(userId: number, callId: string) {
    const call = await this.prisma.callSession.findUnique({
      where: { id: callId },
      include: {
        initiator: { select: { id: true, name: true, role: true } },
      },
    });
    if (!call) throw new NotFoundException('Call not found');
    await this.assertParticipant(call.conversationId, userId);
    return call;
  }

  getIceConfig() {
    const stunUrl = process.env.WEBRTC_STUN_URL ?? 'stun:stun.l.google.com:19302';
    const turnUrl = process.env.WEBRTC_TURN_URL;
    const turnUsername = process.env.WEBRTC_TURN_USERNAME;
    const turnCredential = process.env.WEBRTC_TURN_CREDENTIAL;

    const iceServers: Array<{ urls: string; username?: string; credential?: string }> = [{ urls: stunUrl }];
    if (turnUrl && turnUsername && turnCredential) {
      iceServers.push({
        urls: turnUrl,
        username: turnUsername,
        credential: turnCredential,
      });
    }
    return { iceServers };
  }

  @Cron('*/30 * * * * *')
  async expireRingingCalls() {
    const cutoff = new Date(Date.now() - 45_000);
    const stale = await this.prisma.callSession.findMany({
      where: {
        status: CallStatus.RINGING,
        createdAt: { lte: cutoff },
      },
      select: { id: true, conversationId: true, initiatorId: true },
      take: 100,
    });
    if (!stale.length) return;

    for (const call of stale) {
      await this.prisma.callSession.updateMany({
        where: { id: call.id, status: CallStatus.RINGING },
        data: {
          status: CallStatus.MISSED,
          endedAt: new Date(),
          endedReason: 'timeout',
        },
      });

      const recipients = await this.prisma.conversationParticipant.findMany({
        where: { conversationId: call.conversationId, leftAt: null, userId: { not: call.initiatorId } },
        select: { userId: true },
      });
      await this.notifications.createBulkNotifications(
        recipients.map((p) => p.userId),
        NotificationType.MISSED_CALL,
        'Missed call',
        { conversationId: call.conversationId, callId: call.id, reason: 'timeout' },
      );
      this.logger.log(JSON.stringify({ event: 'call_missed_timeout', conversationId: call.conversationId, callId: call.id }));
    }
  }

  async createAttachmentAccessToken(userId: number, attachmentId: string) {
    const attachment = await this.prisma.messageAttachment.findUnique({
      where: { id: attachmentId },
      include: { message: { select: { conversationId: true } } },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    await this.assertParticipant(attachment.message.conversationId, userId);

    const token = this.jwt.sign(
      {
        kind: 'attachment_access',
        attachmentId,
        userId,
      },
      {
        secret: process.env.JWT_SECRET ?? 'dev-secret',
        expiresIn: '5m',
      },
    );
    return { token, expiresIn: 300 };
  }

  async resolveAttachmentAccessToken(token: string) {
    let payload: { kind?: string; attachmentId?: string } | null = null;
    try {
      payload = this.jwt.verify(token, { secret: process.env.JWT_SECRET ?? 'dev-secret' }) as {
        kind?: string;
        attachmentId?: string;
      };
    } catch {
      throw new ForbiddenException('Invalid or expired attachment token');
    }
    if (!payload?.attachmentId || payload.kind !== 'attachment_access') {
      throw new ForbiddenException('Invalid attachment token');
    }

    const attachment = await this.prisma.messageAttachment.findUnique({ where: { id: payload.attachmentId } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    return {
      fileUrl: attachment.fileUrl,
      fileType: attachment.fileType,
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
    };
  }
}
