import { IsNotEmpty, IsString } from 'class-validator';

export class PurchaseBeatDto {
  @IsString()
  @IsNotEmpty()
  licenseId: string;

  @IsString()
  @IsNotEmpty()
  paymentRef: string;
}
