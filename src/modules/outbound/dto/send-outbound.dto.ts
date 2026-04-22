import { IsArray, IsEmail, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AddressDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  name?: string;
}

class AttachmentDto {
  @IsString()
  fileName!: string;

  @IsString()
  objectKey!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  sizeBytes?: number;
}

export class SendOutboundDto {
  @IsInt()
  accountId!: number;

  @IsOptional()
  @IsInt()
  threadId?: number;

  @IsOptional()
  @IsInt()
  parentMessageId?: number;

  @IsString()
  subject!: string;

  @IsOptional()
  @IsString()
  bodyText?: string;

  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressDto)
  recipients!: AddressDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressDto)
  cc?: AddressDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressDto)
  bcc?: AddressDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  @IsOptional()
  headers?: Record<string, string>;
}