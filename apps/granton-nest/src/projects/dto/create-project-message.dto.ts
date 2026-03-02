import { IsNotEmpty, IsString } from "class-validator";

export class CreateProjectMessageDto {
  @IsString()
  @IsNotEmpty()
  message: string;
}
