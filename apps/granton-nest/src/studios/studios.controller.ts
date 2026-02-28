  import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
  import { AuthGuard } from '@nestjs/passport';
  import { CreateStudioDto } from './dto/create-studio.dto';
  import { UpdateStudioDto } from './dto/update-studio.dto';
  import { StudiosService } from './studios.service';
  import { CurrentUser } from '../auth/decorators/current-user.decorator';

  @Controller('studios')
  export class StudiosController {
    constructor(private readonly studios: StudiosService) {}

    @Post()
    @UseGuards(AuthGuard('jwt'))
    create(@Body() body: CreateStudioDto, @CurrentUser() user: { userId: number }) {
      return this.studios.create(user.userId, body);
    }

    @Get()
    list() {
      return this.studios.findAll();
    }

    @Get(':id')
    get(@Param('id') id: string) {
      return this.studios.findById(id);
    }

    @Patch(':id')
    @UseGuards(AuthGuard('jwt'))
    update(
      @Param('id') id: string,
      @Body() body: UpdateStudioDto,
      @CurrentUser() user: { userId: number },
    ) {
      return this.studios.update(id, user.userId, body);
    }
  }
