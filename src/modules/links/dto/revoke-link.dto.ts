import { IsNotEmpty, IsString } from 'class-validator';

export class RevokeLinkDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}