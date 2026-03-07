  import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
  import { AuthGuard } from '@nestjs/passport';
  import { Role } from '@prisma/client';
  import { CurrentUser } from '../auth/decorators/current-user.decorator';
  import { Roles } from '../roles/roles.decorator';
  import { RolesGuard } from '../roles/roles.guard';
  import { BeatsService } from './beats.service';
  import { BeatMarketplaceQueryDto } from './dto/beat-marketplace-query.dto';
  import { CreateBeatDto } from './dto/create-beat.dto';

  @Controller('beats')
  export class BeatsController {
    constructor(private readonly beatsService: BeatsService) {}

    @Post('upload')
    @Roles(Role.PRODUCER)
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    async uploadBeat(
      @CurrentUser() user: { userId: number },
      @Body() createBeatDto: CreateBeatDto,
    ) {
      return this.beatsService.create(user.userId, createBeatDto);
    }

    @Get('marketplace')
    async getBeats(@Query() query: BeatMarketplaceQueryDto) {
      return this.beatsService.getMarketplaceFeed(query);
    }

    @Get(':id')
    async getBeat(@Param('id') id: string) {
      return this.beatsService.getBeatById(id);
    }
  }
