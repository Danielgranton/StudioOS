import { BeatPaymentStatus } from '@prisma/client';
import { BeatsService } from './beats.service';

describe('BeatsService', () => {
  const createPrismaMock = () => {
    const prisma = {
      $transaction: jest.fn(),
      beat: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      beatLicense: {
        findFirst: jest.fn(),
      },
      beatPurchase: {
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      beatLike: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      beatPlay: {
        create: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(prisma));
    return prisma;
  };

  it('rejects producer buying own beat', async () => {
    const prisma = createPrismaMock();
    prisma.beat.findUnique.mockResolvedValue({ id: 'b1', isActive: true, producerId: 7 });
    const service = new BeatsService(prisma as any);

    await expect(
      service.purchaseBeat('b1', 7, { licenseId: 'l1', paymentRef: 'pay_1' }),
    ).rejects.toThrow('Producers cannot purchase their own beats');
  });

  it('creates purchase with pending status', async () => {
    const prisma = createPrismaMock();
    prisma.beat.findUnique.mockResolvedValue({ id: 'b1', isActive: true, producerId: 10 });
    prisma.beatLicense.findFirst.mockResolvedValue({
      id: 'l1',
      isExclusive: false,
      price: 9000,
    });
    prisma.beatPurchase.findFirst.mockResolvedValue(null);
    prisma.beatPurchase.create.mockResolvedValue({ id: 'p1' });
    const service = new BeatsService(prisma as any);

    await service.purchaseBeat('b1', 2, { licenseId: 'l1', paymentRef: 'pay_2' });

    expect(prisma.beatPurchase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentStatus: BeatPaymentStatus.PENDING,
          paymentRef: 'pay_2',
        }),
      }),
    );
  });

  it('upserts likes idempotently', async () => {
    const prisma = createPrismaMock();
    prisma.beat.findUnique.mockResolvedValue({ id: 'b1', isActive: true });
    prisma.beatLike.upsert.mockResolvedValue({ id: 'like1' });
    const service = new BeatsService(prisma as any);

    await service.likeBeat('b1', 3);

    expect(prisma.beatLike.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_beatId: { userId: 3, beatId: 'b1' } },
      }),
    );
  });

  it('confirmPurchasePaid ignores unknown payment ref', async () => {
    const prisma = createPrismaMock();
    prisma.beatPurchase.findUnique.mockResolvedValue(null);
    const service = new BeatsService(prisma as any);

    await expect(service.confirmPurchasePaid('missing_ref')).resolves.toEqual({ status: 'ignored' });
  });

  it('confirmPurchasePaid marks purchase paid and deactivates exclusive beat', async () => {
    const prisma = createPrismaMock();
    prisma.beatPurchase.findUnique.mockResolvedValue({
      id: 'p1',
      beatId: 'b1',
      paymentStatus: BeatPaymentStatus.PENDING,
      license: { isExclusive: true },
      beat: { id: 'b1' },
    });
    prisma.beatPurchase.update.mockResolvedValue({});
    prisma.beat.update.mockResolvedValue({});
    const service = new BeatsService(prisma as any);

    await service.confirmPurchasePaid('pay_3');

    expect(prisma.beatPurchase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { paymentStatus: BeatPaymentStatus.PAID },
      }),
    );
    expect(prisma.beat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isActive: false },
      }),
    );
  });
});
