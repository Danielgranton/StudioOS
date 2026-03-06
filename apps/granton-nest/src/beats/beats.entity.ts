import { Beat as PrismaBeat } from '@prisma/client';

// You can create a class or interface representing a Beat
export class BeatEntity implements PrismaBeat {
  id: string;
  producerId: number;
  title: string;
  genre: string | null;
  bpm: number | null;
  musicalKey: string | null;
  description: string | null;
  coverImageUrl: string | null;
  previewAudioUrl: string;
  fullAudioUrl: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<BeatEntity>) {
    Object.assign(this, partial);
  }
}