import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../roles/roles.decorator';
import { RolesGuard } from '../roles/roles.guard';
import { BeatsService } from './beats.service';
import { CloudStorageService } from './cloud-storage.service';
import { BeatMarketplaceQueryDto } from './dto/beat-marketplace-query.dto';
import { CreateBeatLicenseDto } from './dto/create-beat-license.dto';
import { CreateBeatDto } from './dto/create-beat.dto';
import { PurchaseBeatDto } from './dto/purchase-beat.dto';
import { UpdateBeatDto } from './dto/update-beat.dto';
import { UploadBeatDto } from './dto/upload-beat.dto';

type UploadFile = {
  buffer: Buffer;
  originalname: string;
};

@Controller('beats')
export class BeatsController {
  constructor(
    private readonly beatsService: BeatsService,
    private readonly cloudStorageService: CloudStorageService,
  ) {}

  @Post('upload')
  @Roles(Role.PRODUCER)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'previewAudio', maxCount: 1 },
        { name: 'fullAudio', maxCount: 1 },
        { name: 'coverImage', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        fileFilter: (_req, file, callback) => {
          const audioFields = new Set(['previewAudio', 'fullAudio']);
          const imageFields = new Set(['coverImage']);

          if (audioFields.has(file.fieldname) && file.mimetype.startsWith('audio/')) {
            callback(null, true);
            return;
          }
          if (imageFields.has(file.fieldname) && file.mimetype.startsWith('image/')) {
            callback(null, true);
            return;
          }

          callback(new BadRequestException(`Invalid file type for ${file.fieldname}`), false);
        },
        limits: {
          fileSize: 25 * 1024 * 1024,
        },
      },
    ),
  )
  async uploadBeat(
    @CurrentUser() user: { userId: number },
    @Body() body: UploadBeatDto,
    @UploadedFiles()
    files: {
      previewAudio?: UploadFile[];
      fullAudio?: UploadFile[];
      coverImage?: UploadFile[];
    },
  ) {
    const previewAudioFile = files.previewAudio?.[0];
    const fullAudioFile = files.fullAudio?.[0];
    const coverImageFile = files.coverImage?.[0];

    if (!previewAudioFile || !fullAudioFile) {
      throw new BadRequestException('previewAudio and fullAudio files are required');
    }

    const previewAudioUrl = await this.cloudStorageService.uploadFile(previewAudioFile, 'beats/previews');
    const fullAudioUrl = await this.cloudStorageService.uploadFile(fullAudioFile, 'beats/full');
    const coverImageUrl = coverImageFile
      ? await this.cloudStorageService.uploadFile(coverImageFile, 'beats/covers')
      : undefined;

    const createBeatDto: CreateBeatDto = {
      title: body.title,
      genre: body.genre,
      bpm: body.bpm,
      musicalKey: body.musicalKey,
      description: body.description,
      previewAudioUrl,
      fullAudioUrl,
      coverImageUrl,
    };

    return this.beatsService.create(user.userId, createBeatDto);
  }

  @Get('marketplace')
  async getBeats(@Query() query: BeatMarketplaceQueryDto) {
    return this.beatsService.getMarketplaceFeed(query);
  }

  @Get('producer/me')
  @Roles(Role.PRODUCER)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async myBeats(@CurrentUser() user: { userId: number }) {
    return this.beatsService.producerBeats(user.userId);
  }

  @Get('producer/dashboard')
  @Roles(Role.PRODUCER)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async dashboard(@CurrentUser() user: { userId: number }) {
    return this.beatsService.producerDashboard(user.userId);
  }

  @Post(':id/licenses')
  @Roles(Role.PRODUCER)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async createLicense(
    @Param('id') id: string,
    @CurrentUser() user: { userId: number },
    @Body() dto: CreateBeatLicenseDto,
  ) {
    return this.beatsService.createLicense(id, user.userId, dto);
  }

  @Patch(':id')
  @Roles(Role.PRODUCER)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async updateBeat(
    @Param('id') id: string,
    @CurrentUser() user: { userId: number },
    @Body() dto: UpdateBeatDto,
  ) {
    return this.beatsService.update(id, user.userId, dto);
  }

  @Get(':id/licenses')
  async getLicenses(@Param('id') id: string) {
    return this.beatsService.getLicenses(id);
  }

  @Post(':id/purchase')
  @Roles(Role.ARTIST, Role.USER)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async purchaseBeat(
    @Param('id') id: string,
    @CurrentUser() user: { userId: number },
    @Body() dto: PurchaseBeatDto,
  ) {
    return this.beatsService.purchaseBeat(id, user.userId, dto);
  }

  @Post(':id/like')
  @UseGuards(AuthGuard('jwt'))
  async likeBeat(@Param('id') id: string, @CurrentUser() user: { userId: number }) {
    return this.beatsService.likeBeat(id, user.userId);
  }

  @Delete(':id/like')
  @UseGuards(AuthGuard('jwt'))
  async unlikeBeat(@Param('id') id: string, @CurrentUser() user: { userId: number }) {
    return this.beatsService.unlikeBeat(id, user.userId);
  }

  @Post(':id/play')
  async playBeat(@Param('id') id: string, @Req() req: { user?: { userId: number } }) {
    return this.beatsService.recordPlay(id, req?.user?.userId ?? null);
  }

  @Patch(':id/deactivate')
  @Roles(Role.PRODUCER)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async deactivateBeat(@Param('id') id: string, @CurrentUser() user: { userId: number }) {
    return this.beatsService.deactivate(id, user.userId);
  }

  @Get(':id')
  async getBeat(@Param('id') id: string) {
    return this.beatsService.getBeatById(id);
  }
}
