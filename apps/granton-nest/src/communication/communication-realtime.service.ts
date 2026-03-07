import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class CommunicationRealtimeService {
  private readonly logger = new Logger(CommunicationRealtimeService.name);
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  emitConversationMessage(conversationId: string, payload: unknown) {
    if (this.server) {
      this.server.to(`conversation:${conversationId}`).emit('message:new', payload);
      return;
    }
    return { conversationId, payload };
  }

  emitConversationTyping(conversationId: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(`conversation:${conversationId}`).emit('message:typing', payload);
  }

  emitConversationRead(conversationId: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(`conversation:${conversationId}`).emit('message:read', payload);
  }

  emitConversationDelivered(conversationId: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(`conversation:${conversationId}`).emit('message:delivered', payload);
  }

  emitCallIncoming(conversationId: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(`conversation:${conversationId}`).emit('call:incoming', payload);
  }

  emitCallOffer(conversationId: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(`conversation:${conversationId}`).emit('call:offer', payload);
  }

  emitCallAnswer(conversationId: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(`conversation:${conversationId}`).emit('call:answer', payload);
  }

  emitIceCandidate(conversationId: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(`conversation:${conversationId}`).emit('call:ice-candidate', payload);
  }

  emitCallEnded(conversationId: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(`conversation:${conversationId}`).emit('call:ended', payload);
  }

  emitCallBusy(conversationId: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(`conversation:${conversationId}`).emit('call:busy', payload);
  }

  emitCallParticipantJoined(conversationId: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(`conversation:${conversationId}`).emit('call:participant-joined', payload);
  }

  emitCallParticipantLeft(conversationId: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(`conversation:${conversationId}`).emit('call:participant-left', payload);
  }
}
