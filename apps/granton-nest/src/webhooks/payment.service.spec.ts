import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  it('routes beat purchase webhook to beats service', async () => {
    const prisma = {
      project: { findFirst: jest.fn(), update: jest.fn() },
      sessionBooking: { findFirst: jest.fn(), update: jest.fn() },
    };
    const notificationService = {
      sendArtistConfirmation: jest.fn(),
    };
    const beatsService = {
      confirmPurchasePaid: jest.fn().mockResolvedValue({ status: 'processed', purchaseId: 'p1' }),
    };

    const service = new PaymentService(prisma as any, notificationService as any, beatsService as any);
    const result = await service.processPayment({
      type: 'beat_purchase',
      paymentRef: 'pay_100',
    });

    expect(beatsService.confirmPurchasePaid).toHaveBeenCalledWith('pay_100');
    expect(result).toEqual({ status: 'processed', purchaseId: 'p1' });
  });

  it('processes session booking deposit as half payment', async () => {
    const prisma = {
      project: { findFirst: jest.fn(), update: jest.fn() },
      sessionBooking: {
        findFirst: jest.fn().mockResolvedValue({ id: 1, totalAmount: 0 }),
        update: jest.fn(),
      },
    };
    const notificationService = {
      sendArtistConfirmation: jest.fn(),
    };
    const beatsService = {
      confirmPurchasePaid: jest.fn(),
    };

    const service = new PaymentService(prisma as any, notificationService as any, beatsService as any);
    const result = await service.processPayment({
      type: 'session_booking',
      bookingRef: 'book_1',
      paymentRef: 'pay_1',
      totalAmount: 100000,
      phase: 'deposit',
    });

    expect(prisma.sessionBooking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalAmount: 100000,
          depositAmount: 50000,
          balanceAmount: 50000,
          paymentStatus: 'BOOKED',
        }),
      }),
    );
    expect(result).toEqual({
      status: 'processed',
      paymentStage: 'deposit',
      amountPaidNow: 50000,
      amountRemaining: 50000,
    });
  });
});
