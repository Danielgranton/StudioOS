import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

function createPrismaClientOptions() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Add it to apps/granton-nest/.env before starting Nest.',
    );
  }

  if (
    connectionString.startsWith('prisma://') ||
    connectionString.startsWith('prisma+postgres://')
  ) {
    return { accelerateUrl: connectionString };
  }

  if (
    connectionString.startsWith('postgres://') ||
    connectionString.startsWith('postgresql://')
  ) {
    return {
      adapter: new PrismaPg({ connectionString }),
    };
  }

  throw new Error(
    `Unsupported DATABASE_URL protocol in "${connectionString}". Use postgresql://..., prisma://..., or prisma+postgres://...`,
  );
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super(createPrismaClientOptions());
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
