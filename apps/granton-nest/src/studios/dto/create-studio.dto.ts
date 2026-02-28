import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateStudioDto {
    @IsString()
    studioName: string;

    @IsString()
    location: string;

    @IsArray()
    services: string[];

    @IsOptional()
    pricing: string;

    @IsString()
    availability: string;
}