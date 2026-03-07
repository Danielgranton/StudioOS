import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateBeatLicenseDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  price: number;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  includesWav?: boolean;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isExclusive?: boolean;
}
