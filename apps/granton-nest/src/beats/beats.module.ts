import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BeatsController } from './beats.controller';
import { BeatsService } from './beats.service';
import { CloudStorageService } from './cloud-storage.service';

@Module({
  imports: [PrismaModule],
  providers: [BeatsService, CloudStorageService],
  controllers: [BeatsController],
  exports: [BeatsService, CloudStorageService],
})
export class BeatsModule {}
