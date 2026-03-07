import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { BadRequestException, Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { CallType, MessageType } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { CommunicationService } from './communication.service';
import { CommunicationRealtimeService } from './communication-realtime.service';

type AuthenticatedSocket = Socket & { data: { userId?: number } };

@WebSocketGateway({
  namespace: 'communication',
  cors: { origin: '*' },
})
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
export class CommunicationGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(CommunicationGateway.name);
  private readonly rateLimits = new Map<string, number[]>();

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly communicationService: CommunicationService,
    private readonly realtime: CommunicationRealtimeService,
    private readonly jwt: JwtService,
  ) {}

  afterInit() {
    this.realtime.setServer(this.server);
  }

  handleConnection(client: AuthenticatedSocket) {
    const authHeader = (client.handshake.headers.authorization as string | undefined) ?? '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const token = (client.handshake.auth?.token as string | undefined) ?? bearerToken;
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwt.verify(token, { secret: process.env.JWT_SECRET ?? 'dev-secret' }) as {
        sub?: number;
      };
      const userId = Number(payload?.sub);
      if (!Number.isFinite(userId) || userId <= 0) {
        client.disconnect(true);
        return;
      }
      client.data.userId = userId;
      this.logger.debug(`Socket connected user=${userId} id=${client.id}`);
    } catch {
      client.disconnect(true);
    }
  }

  private enforceRateLimit(userId: number, key: string, maxHits: number, windowMs: number) {
    const now = Date.now();
    const bucketKey = `${userId}:${key}`;
    const hits = (this.rateLimits.get(bucketKey) ?? []).filter((ts) => now - ts < windowMs);
    if (hits.length >= maxHits) {
      throw new BadRequestException(`Rate limit exceeded for ${key}`);
    }
    hits.push(now);
    this.rateLimits.set(bucketKey, hits);
  }

  @SubscribeMessage('conversation:join')
  async joinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) throw new BadRequestException('Unauthenticated socket');
    await this.communicationService.ensureParticipant(body.conversationId, userId);
    await client.join(`conversation:${body.conversationId}`);
    await this.communicationService.markDelivered(userId, body.conversationId);
    this.realtime.emitConversationDelivered(body.conversationId, {
      conversationId: body.conversationId,
      userId,
      deliveredAt: new Date().toISOString(),
    });
    return { joined: true, conversationId: body.conversationId };
  }

  @SubscribeMessage('conversation:leave')
  async leaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    await client.leave(`conversation:${body.conversationId}`);
    return { left: true, conversationId: body.conversationId };
  }

  @SubscribeMessage('message:send')
  async sendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    body: {
      conversationId: string;
      content?: string;
      messageType?: MessageType;
      attachments?: Array<{ fileUrl: string; fileType: string; fileName?: string }>;
    },
  ) {
    const userId = client.data.userId;
    if (!userId) throw new BadRequestException('Unauthenticated socket');

    return this.communicationService.sendMessage(userId, {
      conversationId: body.conversationId,
      content: body.content,
      messageType: body.messageType ?? MessageType.TEXT,
      attachments: body.attachments,
    });
  }

  @SubscribeMessage('messages:list')
  async listMessages(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId: string; limit?: number },
  ) {
    const userId = client.data.userId;
    if (!userId) throw new BadRequestException('Unauthenticated socket');
    return this.communicationService.listMessages(userId, body.conversationId, body.limit ?? 50);
  }

  @SubscribeMessage('message:typing')
  async typing(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId: string; isTyping: boolean },
  ) {
    const userId = client.data.userId;
    if (!userId) throw new BadRequestException('Unauthenticated socket');
    await this.communicationService.ensureParticipant(body.conversationId, userId);

    this.realtime.emitConversationTyping(body.conversationId, {
      conversationId: body.conversationId,
      userId,
      isTyping: body.isTyping,
    });
    return { delivered: true };
  }

  @SubscribeMessage('message:read')
  async read(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId: string; messageId?: string },
  ) {
    const userId = client.data.userId;
    if (!userId) throw new BadRequestException('Unauthenticated socket');
    await this.communicationService.ensureParticipant(body.conversationId, userId);

    this.realtime.emitConversationRead(body.conversationId, {
      conversationId: body.conversationId,
      userId,
      messageId: body.messageId,
      readAt: new Date().toISOString(),
    });
    await this.communicationService.markRead(userId, body.conversationId, body.messageId);
    return { delivered: true };
  }

  @SubscribeMessage('call:start')
  async startCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId: string; type: CallType },
  ) {
    const userId = client.data.userId;
    if (!userId) throw new BadRequestException('Unauthenticated socket');
    this.enforceRateLimit(userId, 'call:start', 4, 60_000);
    const call = await this.communicationService.startCall(userId, body.conversationId, body.type);
    this.realtime.emitCallIncoming(body.conversationId, {
      conversationId: body.conversationId,
      callId: call.id,
      initiatorId: userId,
      type: call.type,
      startedAt: call.createdAt.toISOString(),
    });
    return call;
  }

  @SubscribeMessage('call:offer')
  async relayOffer(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId: string; callId: string; sdp: unknown },
  ) {
    const userId = client.data.userId;
    if (!userId) throw new BadRequestException('Unauthenticated socket');
    this.enforceRateLimit(userId, 'call:offer', 30, 10_000);
    await this.communicationService.assertCallParticipantInConversation(body.callId, body.conversationId, userId);
    this.realtime.emitCallOffer(body.conversationId, {
      conversationId: body.conversationId,
      callId: body.callId,
      fromUserId: userId,
      sdp: body.sdp,
    });
    return { delivered: true };
  }

  @SubscribeMessage('call:answer')
  async answerCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId: string; callId: string; accepted?: boolean; sdp?: unknown },
  ) {
    const userId = client.data.userId;
    if (!userId) throw new BadRequestException('Unauthenticated socket');
    this.enforceRateLimit(userId, 'call:answer', 20, 10_000);
    await this.communicationService.assertCallParticipantInConversation(body.callId, body.conversationId, userId);
    const accepted = body.accepted !== false;
    const call = await this.communicationService.answerCall(userId, body.callId, accepted);
    this.realtime.emitCallAnswer(body.conversationId, {
      conversationId: body.conversationId,
      callId: body.callId,
      fromUserId: userId,
      accepted,
      status: call.status,
      acceptedAt: call.acceptedAt?.toISOString() ?? null,
      endedAt: call.endedAt?.toISOString() ?? null,
      sdp: body.sdp,
    });
    if (accepted) {
      this.realtime.emitCallParticipantJoined(body.conversationId, {
        conversationId: body.conversationId,
        callId: body.callId,
        userId,
        at: new Date().toISOString(),
      });
    } else {
      this.realtime.emitCallBusy(body.conversationId, {
        conversationId: body.conversationId,
        callId: body.callId,
        userId,
      });
    }
    return call;
  }

  @SubscribeMessage('call:ice-candidate')
  async relayIceCandidate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId: string; callId: string; candidate: unknown },
  ) {
    const userId = client.data.userId;
    if (!userId) throw new BadRequestException('Unauthenticated socket');
    this.enforceRateLimit(userId, 'call:ice-candidate', 120, 10_000);
    await this.communicationService.assertCallParticipantInConversation(body.callId, body.conversationId, userId);
    this.realtime.emitIceCandidate(body.conversationId, {
      conversationId: body.conversationId,
      callId: body.callId,
      fromUserId: userId,
      candidate: body.candidate,
    });
    return { delivered: true };
  }

  @SubscribeMessage('call:reject')
  async rejectCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId: string; callId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) throw new BadRequestException('Unauthenticated socket');
    this.enforceRateLimit(userId, 'call:reject', 20, 10_000);
    await this.communicationService.assertCallParticipantInConversation(body.callId, body.conversationId, userId);
    const call = await this.communicationService.answerCall(userId, body.callId, false);
    this.realtime.emitCallEnded(body.conversationId, {
      conversationId: body.conversationId,
      callId: body.callId,
      fromUserId: userId,
      status: call.status,
      endedAt: call.endedAt?.toISOString() ?? null,
      reason: call.endedReason,
    });
    this.realtime.emitCallBusy(body.conversationId, {
      conversationId: body.conversationId,
      callId: body.callId,
      userId,
    });
    return call;
  }

  @SubscribeMessage('call:end')
  async endCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId: string; callId: string; reason?: string },
  ) {
    const userId = client.data.userId;
    if (!userId) throw new BadRequestException('Unauthenticated socket');
    this.enforceRateLimit(userId, 'call:end', 20, 10_000);
    await this.communicationService.assertCallParticipantInConversation(body.callId, body.conversationId, userId);
    const call = await this.communicationService.endCall(userId, body.callId, body.reason);
    this.realtime.emitCallEnded(body.conversationId, {
      conversationId: body.conversationId,
      callId: body.callId,
      fromUserId: userId,
      status: call?.status,
      endedAt: call?.endedAt?.toISOString?.() ?? null,
      reason: call?.endedReason ?? null,
    });
    this.realtime.emitCallParticipantLeft(body.conversationId, {
      conversationId: body.conversationId,
      callId: body.callId,
      userId,
      at: new Date().toISOString(),
    });
    return call;
  }
}
