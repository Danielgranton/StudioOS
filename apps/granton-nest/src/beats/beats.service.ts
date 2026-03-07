import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BeatPaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBeatDto } from './dto/create-beat.dto';
import { UpdateBeatDto } from './dto/update-beat.dto';
import { BeatMarketplaceQueryDto } from './dto/beat-marketplace-query.dto';
import { CreateBeatLicenseDto } from './dto/create-beat-license.dto';
import { PurchaseBeatDto } from './dto/purchase-beat.dto';

@Injectable()
export class BeatsService {
  private readonly logger = new Logger(BeatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(producerId: number, dto: CreateBeatDto) {
    return this.prisma.beat.create({
      data: {
        producerId,
        title: dto.title,
        genre: dto.genre,
        bpm: dto.bpm,
        musicalKey: dto.musicalKey,
        previewAudioUrl: dto.previewAudioUrl,
        fullAudioUrl: dto.fullAudioUrl,
        coverImageUrl: dto.coverImageUrl,
        description: dto.description,
      },
    });
  }

  async update(beatId: string, producerId: number, dto: UpdateBeatDto) {
    const beat = await this.prisma.beat.findUnique({ where: { id: beatId } });
    if (!beat) throw new NotFoundException('Beat not found');
    if (beat.producerId !== producerId) throw new ForbiddenException('You can only update your own beats');

    return this.prisma.beat.update({
      where: { id: beatId },
      data: {
        title: dto.title,
        genre: dto.genre,
        bpm: dto.bpm,
        musicalKey: dto.musicalKey,
        previewAudioUrl: dto.previewAudioUrl,
        fullAudioUrl: dto.fullAudioUrl,
        coverImageUrl: dto.coverImageUrl,
        description: dto.description,
      },
    });
  }

  async deactivate(beatId: string, producerId: number) {
    const beat = await this.prisma.beat.findUnique({ where: { id: beatId } });
    if (!beat) throw new NotFoundException('Beat not found');
    if (beat.producerId !== producerId) throw new ForbiddenException('You can only deactivate your own beats');

    return this.prisma.beat.update({
      where: { id: beatId },
      data: { isActive: false },
    });
  }

  async getMarketplaceFeed(query: BeatMarketplaceQueryDto) {
    const sortBy = query.sortBy ?? 'createdAt';
    const order = query.order ?? 'desc';

    return this.prisma.beat.findMany({
      where: {
        isActive: true,
        genre: query.genre,
        musicalKey: query.musicalKey,
        producerId: query.producerId,
        bpm: {
          gte: query.minBpm,
          lte: query.maxBpm,
        },
      },
      include: {
        producer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        licenses: {
          select: {
            id: true,
            name: true,
            price: true,
            includesWav: true,
            isExclusive: true,
          },
        },
      },
      orderBy: { [sortBy]: order },
      take: query.limit ?? 20,
      skip: query.offset ?? 0,
    });
  }

  async getBeatById(beatId: string) {
    const beat = await this.prisma.beat.findUnique({
      where: { id: beatId },
      include: {
        producer: { select: { id: true, name: true, email: true } },
        licenses: true,
      },
    });
    if (!beat) throw new NotFoundException('Beat not found');
    return beat;
  }

  async createLicense(beatId: string, producerId: number, dto: CreateBeatLicenseDto) {
    const beat = await this.prisma.beat.findUnique({ where: { id: beatId } });
    if (!beat) throw new NotFoundException('Beat not found');
    if (beat.producerId !== producerId) {
      throw new ForbiddenException('You can only add licenses to your own beats');
    }

    return this.prisma.beatLicense.create({
      data: {
        beatId,
        name: dto.name,
        price: dto.price,
        includesWav: dto.includesWav ?? false,
        isExclusive: dto.isExclusive ?? false,
      },
    });
  }

  async getLicenses(beatId: string) {
    const beat = await this.prisma.beat.findUnique({ where: { id: beatId } });
    if (!beat) throw new NotFoundException('Beat not found');

    return this.prisma.beatLicense.findMany({
      where: { beatId },
      orderBy: [{ isExclusive: 'desc' }, { price: 'asc' }],
    });
  }

  async purchaseBeat(beatId: string, artistId: number, dto: PurchaseBeatDto) {
    try {
      const purchase = await this.prisma.$transaction(async (tx) => {
        const beat = await tx.beat.findUnique({ where: { id: beatId } });
        if (!beat || !beat.isActive) throw new NotFoundException('Beat not found');
        if (beat.producerId === artistId) {
          throw new ForbiddenException('Producers cannot purchase their own beats');
        }

        const license = await tx.beatLicense.findFirst({
          where: { id: dto.licenseId, beatId },
        });
        if (!license) throw new NotFoundException('License not found for this beat');

        const exclusivePurchase = await tx.beatPurchase.findFirst({
          where: {
            beatId,
            license: { isExclusive: true },
            paymentStatus: BeatPaymentStatus.PAID,
          },
        });
        if (exclusivePurchase) {
          throw new BadRequestException('This beat is no longer available because an exclusive license was already sold');
        }

        if (license.isExclusive) {
          const hasAnyPaidPurchase = await tx.beatPurchase.count({
            where: { beatId, paymentStatus: BeatPaymentStatus.PAID },
          });
          if (hasAnyPaidPurchase > 0) {
            throw new BadRequestException('Exclusive license cannot be purchased after previous sales');
          }
        }

        return tx.beatPurchase.create({
          data: {
            artistId,
            beatId,
            licenseId: license.id,
            amountPaid: license.price,
            paymentRef: dto.paymentRef,
            paymentStatus: BeatPaymentStatus.PENDING,
          },
          include: {
            beat: true,
            license: true,
          },
        });
      });

      this.logger.log(`Created pending beat purchase ${purchase.id} for beat ${beatId}`);
      return purchase;
    } catch (error) {
      this.logger.error(`Beat purchase failed for beat ${beatId}: ${(error as Error).message}`);
      throw error;
    }
  }

  async likeBeat(beatId: string, userId: number) {
    const beat = await this.prisma.beat.findUnique({ where: { id: beatId } });
    if (!beat || !beat.isActive) throw new NotFoundException('Beat not found');

    return this.prisma.beatLike.upsert({
      where: { userId_beatId: { userId, beatId } },
      update: {},
      create: { beatId, userId },
    });
  }

  async unlikeBeat(beatId: string, userId: number) {
    const result = await this.prisma.beatLike.deleteMany({
      where: { beatId, userId },
    });
    return { removed: result.count > 0 };
  }

  async recordPlay(beatId: string, userId: number | null) {
    const beat = await this.prisma.beat.findUnique({ where: { id: beatId } });
    if (!beat) throw new NotFoundException('Beat not found');

    return this.prisma.beatPlay.create({
      data: {
        beatId,
        userId,
      },
    });
  }

  async confirmPurchasePaid(paymentRef: string) {
    const purchase = await this.prisma.beatPurchase.findUnique({
      where: { paymentRef },
      include: {
        license: true,
        beat: true,
      },
    });
    if (!purchase) {
      this.logger.warn(`No beat purchase found for paymentRef ${paymentRef}`);
      return { status: 'ignored' };
    }

    if (purchase.paymentStatus === BeatPaymentStatus.PAID) {
      return { status: 'already_processed', purchaseId: purchase.id };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.beatPurchase.update({
        where: { id: purchase.id },
        data: { paymentStatus: BeatPaymentStatus.PAID },
      });

      if (purchase.license.isExclusive) {
        await tx.beat.update({
          where: { id: purchase.beatId },
          data: { isActive: false },
        });
      }
    });

    this.logger.log(`Marked beat purchase as paid for paymentRef ${paymentRef}`);
    return { status: 'processed', purchaseId: purchase.id };
  }

  async producerDashboard(producerId: number) {
    const beats = await this.prisma.beat.findMany({
      where: { producerId },
      include: {
        _count: {
          select: {
            likes: true,
            plays: true,
            purchases: true,
            licenses: true,
          },
        },
        purchases: {
          where: { paymentStatus: BeatPaymentStatus.PAID },
          select: {
            amountPaid: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const beatsWithRevenue = beats.map((beat) => {
      const revenue = beat.purchases.reduce((sum, p) => sum + p.amountPaid, 0);
      return {
        id: beat.id,
        title: beat.title,
        isActive: beat.isActive,
        genre: beat.genre,
        bpm: beat.bpm,
        musicalKey: beat.musicalKey,
        createdAt: beat.createdAt,
        likes: beat._count.likes,
        plays: beat._count.plays,
        purchases: beat._count.purchases,
        licenses: beat._count.licenses,
        revenue,
      };
    });

    const summary = beatsWithRevenue.reduce(
      (acc, beat) => {
        acc.totalBeats += 1;
        acc.activeBeats += beat.isActive ? 1 : 0;
        acc.totalRevenue += beat.revenue;
        acc.totalLikes += beat.likes;
        acc.totalPlays += beat.plays;
        acc.totalPurchases += beat.purchases;
        return acc;
      },
      {
        totalBeats: 0,
        activeBeats: 0,
        totalRevenue: 0,
        totalLikes: 0,
        totalPlays: 0,
        totalPurchases: 0,
      },
    );

    return {
      summary,
      beats: beatsWithRevenue,
    };
  }

  async producerBeats(producerId: number) {
    return this.prisma.beat.findMany({
      where: { producerId },
      orderBy: { createdAt: 'desc' },
      include: {
        licenses: true,
        _count: {
          select: {
            likes: true,
            plays: true,
            purchases: true,
          },
        },
      },
    });
  }
}
