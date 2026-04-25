import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class InboundAddressDto {
  @IsString()
  @IsNotEmpty()
  email!: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class InboundAttachmentDto {
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  storageBucket!: string;

  @IsString()
  @IsNotEmpty()
  storageKey!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sizeBytes?: number;

  @IsOptional()
  @IsString()
  contentId?: string;

  @IsOptional()
  @IsString()
  checksumSha256?: string;

  @IsOptional()
  @IsBoolean()
  isInline?: boolean;
}

export class InboundFolderPresenceDto {
  @IsString()
  @IsNotEmpty()
  remoteFolderKey!: string;

  @IsString()
  @IsNotEmpty()
  folderName!: string;

  @IsOptional()
  @IsString()
  delimiter?: string;

  @Type(() => Number)
  @IsNumber()
  uidValidity!: number;

  @Type(() => Number)
  @IsNumber()
  imapUid!: number;

  @IsOptional()
  @IsBoolean()
  isSeen?: boolean;

  @IsOptional()
  @IsBoolean()
  isAnswered?: boolean;

  @IsOptional()
  @IsBoolean()
  isFlagged?: boolean;

  @IsOptional()
  @IsBoolean()
  isDeletedRemote?: boolean;
}

export class IngestInboundMessageDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accountId!: number;

  @IsString()
  @IsNotEmpty()
  internetMessageId!: string;

  @IsOptional()
  @IsString()
  inReplyTo?: string;

  @IsOptional()
  @IsString()
  referencesHeader?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  fromAddress?: string;

  @IsOptional()
  @IsString()
  fromName?: string;

  @IsOptional()
  @IsString()
  replyToAddress?: string;

  @IsOptional()
  @IsString()
  senderAddress?: string;

  @IsOptional()
  @IsString()
  bodyText?: string;

  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @IsOptional()
  @IsObject()
  headers?: Record<string, unknown>;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => InboundAddressDto)
  @IsArray()
  to?: InboundAddressDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => InboundAddressDto)
  @IsArray()
  cc?: InboundAddressDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => InboundAddressDto)
  @IsArray()
  bcc?: InboundAddressDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => InboundAddressDto)
  @IsArray()
  replyTo?: InboundAddressDto[];

  @IsOptional()
  @IsDateString()
  receivedAt?: string;

  @IsOptional()
  @IsDateString()
  internalDate?: string;

  @IsOptional()
  @IsDateString()
  sentAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sizeBytes?: number;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => InboundAttachmentDto)
  @IsArray()
  attachments?: InboundAttachmentDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => InboundFolderPresenceDto)
  @IsArray()
  folderPresence?: InboundFolderPresenceDto[];

  @IsOptional()
  @IsString()
  garantiaId?: string;

  @IsOptional()
  @IsString()
  matchedValue?: string;

  @IsOptional()
  @IsIn(['AUTO', 'MANUAL', 'INHERITED'])
  linkMode?: 'AUTO' | 'MANUAL' | 'INHERITED';

  @IsOptional()
  @IsString()
  linkSource?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  linkConfidence?: number;
}