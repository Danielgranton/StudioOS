import { MessageType } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class MessageAttachmentInputDto {
  @IsString()
  fileUrl: string;

  @IsString()
  fileType: string;

  @IsString()
  @IsOptional()
  fileName?: string;
}

export class SendMessageDto {
  @IsString()
  conversationId: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsEnum(MessageType)
  messageType: MessageType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageAttachmentInputDto)
  @IsOptional()
  attachments?: MessageAttachmentInputDto[];
}
