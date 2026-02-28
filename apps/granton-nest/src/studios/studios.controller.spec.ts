import { Test, TestingModule } from '@nestjs/testing';
import { StudiosController } from './studios.controller';

describe('StudiosController', () => {
  let controller: StudiosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudiosController],
    }).compile();

    controller = module.get<StudiosController>(StudiosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
