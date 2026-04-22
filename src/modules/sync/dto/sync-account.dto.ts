import { IsBoolean, IsInt, IsOptional } from 'class-validator';

export class SyncAccountDto {
  @IsOptional()
  @IsInt()
  folderId?: number;

  @IsOptional()
  @IsBoolean()
  forceFullResync?: boolean;
}