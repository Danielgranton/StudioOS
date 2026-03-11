import { IsOptional, IsString } from 'class-validator';

export class UploadCommunicationFileDto {
  @IsString()
  @IsOptional()
  conversationId?: string;
}
