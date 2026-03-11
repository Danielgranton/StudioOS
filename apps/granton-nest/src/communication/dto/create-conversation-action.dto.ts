import { ConversationActionType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateConversationActionDto {
  @IsString()
  conversationId: string;

  @IsString()
  @IsOptional()
  messageId?: string;

  @IsEnum(ConversationActionType)
  actionType: ConversationActionType;

  @IsOptional()
  payload?: Record<string, unknown>;
}
