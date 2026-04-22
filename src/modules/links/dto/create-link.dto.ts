import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateLinkDto {
  @IsString()
  @IsIn(['THREAD', 'MESSAGE'])
  targetType!: 'THREAD' | 'MESSAGE';

  @IsNumber()
  targetId!: number;

  @IsString()
  @IsNotEmpty()
  entityType!: string;

  @IsString()
  @IsNotEmpty()
  entityId!: string;

  @IsOptional()
  @IsString()
  matchedValue?: string;
}