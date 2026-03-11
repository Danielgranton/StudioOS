import { ForbiddenException } from '@nestjs/common';
import { CallStatus, CallType } from '@prisma/client';
import { CommunicationService } from './communication.service';

describe('CommunicationService', () => {
  const makeService = () => {
    const prisma = {
      auditLog: { create: jest.fn() },
      conversationParticipant: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      userBlock: { findFirst: jest.fn() },
      callSession: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      message: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      messageDelivery: { updateMany: jest.fn() },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    const notifications = {
      createBulkNotifications: jest.fn().mockResolvedValue({ count: 0 }),
    };

    const realtime = {
      emitConversationMessage: jest.fn(),
    };

    const jwt = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const service = new CommunicationService(prisma as any, notifications as any, realtime as any, jwt as any);
    return { service, prisma, notifications };
  };

  it('rejects call start when user is not a participant', async () => {
    const { service, prisma } = makeService();
    prisma.conversationParticipant.findUnique.mockResolvedValue(null);

    await expect(service.startCall(5, 'conv_1', CallType.AUDIO)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects call start when participants are blocked', async () => {
    const { service, prisma } = makeService();
    prisma.conversationParticipant.findUnique.mockResolvedValue({ userId: 5, leftAt: null });
    prisma.conversationParticipant.findMany.mockResolvedValue([{ userId: 9 }]);
    prisma.userBlock.findFirst.mockResolvedValue({ id: 'block_1' });

    await expect(service.startCall(5, 'conv_1', CallType.VIDEO)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('supports call lifecycle ringing -> active -> ended', async () => {
    const { service, prisma } = makeService();

    prisma.conversationParticipant.findUnique.mockResolvedValue({ userId: 5, leftAt: null });
    prisma.conversationParticipant.findMany.mockResolvedValue([{ userId: 9 }]);
    prisma.userBlock.findFirst.mockResolvedValue(null);
    prisma.callSession.findFirst.mockResolvedValue(null);
    prisma.callSession.create.mockResolvedValue({
      id: 'call_1',
      conversationId: 'conv_1',
      initiatorId: 5,
      type: CallType.AUDIO,
      createdAt: new Date(),
    });

    await service.startCall(5, 'conv_1', CallType.AUDIO);

    prisma.callSession.findUnique
      .mockResolvedValueOnce({ id: 'call_1', conversationId: 'conv_1', status: CallStatus.RINGING })
      .mockResolvedValueOnce({ id: 'call_1', conversationId: 'conv_1', status: CallStatus.ACTIVE });

    prisma.callSession.update
      .mockResolvedValueOnce({ id: 'call_1', status: CallStatus.ACTIVE, acceptedAt: new Date() })
      .mockResolvedValueOnce({ id: 'call_1', status: CallStatus.ENDED, endedAt: new Date() });

    const answered = await service.answerCall(9, 'call_1', true);
    expect(answered.status).toBe(CallStatus.ACTIVE);

    const ended = await service.endCall(9, 'call_1', 'user_hangup');
    expect(ended.status).toBe(CallStatus.ENDED);
  });

  it('marks messages as read and resets unread counter', async () => {
    const { service, prisma } = makeService();

    prisma.conversationParticipant.findUnique.mockResolvedValue({ userId: 7, leftAt: null });
    prisma.message.findFirst.mockResolvedValue({ id: 'msg_9' });
    prisma.messageDelivery.updateMany.mockResolvedValue({ count: 1 });
    prisma.conversationParticipant.update.mockResolvedValue({});

    const result = await service.markRead(7, 'conv_1');

    expect(result).toEqual({ read: true, messageId: 'msg_9' });
    expect(prisma.messageDelivery.updateMany).toHaveBeenCalled();
    expect(prisma.conversationParticipant.update).toHaveBeenCalled();
  });
});
