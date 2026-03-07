import { Test, TestingModule } from '@nestjs/testing';
import { StudiosService } from './studios.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('StudiosService', () => {
  let service: StudiosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudiosService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<StudiosService>(StudiosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
