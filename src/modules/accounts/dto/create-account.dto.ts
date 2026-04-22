import { IsBoolean, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  tenantKey!: string;

  @IsString()
  @IsOptional()
  contextType?: string;

  @IsString()
  @IsNotEmpty()
  accountName!: string;

  @IsEmail()
  emailAddress!: string;

  @IsString()
  @IsNotEmpty()
  imapHost!: string;

  @IsInt()
  @Min(1)
  imapPort!: number;

  @IsBoolean()
  imapSecure!: boolean;

  @IsString()
  @IsNotEmpty()
  smtpHost!: string;

  @IsInt()
  @Min(1)
  smtpPort!: number;

  @IsBoolean()
  smtpSecure!: boolean;

  @IsString()
  @IsNotEmpty()
  authSecretRef!: string;

  @IsOptional()
  @IsBoolean()
  syncEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  sendEnabled?: boolean;
}