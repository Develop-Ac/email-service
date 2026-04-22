import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

interface MailAccountRow {
  id: number;
  tenant_key: string;
  context_type: string;
  account_name: string;
  email_address: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  auth_secret_ref: string;
  sync_enabled: boolean;
  send_enabled: boolean;
  status_code: string;
  has_received_messages: boolean;
  last_connection_check_at: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class AccountsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listAccounts() {
    const result = await this.databaseService.query<MailAccountRow>(`
      SELECT a.*,
             EXISTS (
               SELECT 1
               FROM email_core.mail_message m
               WHERE m.account_id = a.id
               LIMIT 1
             ) AS has_received_messages
      FROM email_core.mail_account a
      ORDER BY created_at DESC
    `);

    return result.rows.map((row) => this.mapRow(row));
  }

  async createAccount(dto: CreateAccountDto) {
    const hasActiveAccount = await this.databaseService.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM email_core.mail_account
          WHERE tenant_key = $1
            AND context_type = $2
            AND status_code = 'ACTIVE'
            AND (sync_enabled = true OR send_enabled = true)
        ) AS exists
      `,
      [dto.tenantKey, dto.contextType ?? 'GARANTIA'],
    );

    if (hasActiveAccount.rows[0]?.exists) {
      throw new ConflictException(
        `Ja existe uma conta ativa para a caixa ${dto.tenantKey}. Inative a conta atual antes de cadastrar outra.`,
      );
    }

    const result = await this.databaseService.query<MailAccountRow>(
      `
        INSERT INTO email_core.mail_account (
          tenant_key,
          context_type,
          account_name,
          email_address,
          imap_host,
          imap_port,
          imap_secure,
          smtp_host,
          smtp_port,
          smtp_secure,
          auth_secret_ref,
          sync_enabled,
          send_enabled,
          status_code
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'ACTIVE')
        RETURNING *, false AS has_received_messages
      `,
      [
        dto.tenantKey,
        dto.contextType ?? 'GARANTIA',
        dto.accountName,
        dto.emailAddress,
        dto.imapHost,
        dto.imapPort,
        dto.imapSecure,
        dto.smtpHost,
        dto.smtpPort,
        dto.smtpSecure,
        dto.authSecretRef,
        dto.syncEnabled ?? true,
        dto.sendEnabled ?? true,
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  async inactivateAccount(accountId: number) {
    const result = await this.databaseService.query<MailAccountRow>(
      `
        UPDATE email_core.mail_account a
        SET status_code = 'DISABLED',
            sync_enabled = false,
            send_enabled = false,
            updated_at = NOW()
        WHERE a.id = $1
        RETURNING a.*,
          EXISTS (
            SELECT 1
            FROM email_core.mail_message m
            WHERE m.account_id = a.id
            LIMIT 1
          ) AS has_received_messages
      `,
      [accountId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Conta de e-mail nao encontrada.');
    }

    return this.mapRow(result.rows[0]);
  }

  async updateAccount(accountId: number, dto: UpdateAccountDto) {
    const existing = await this.databaseService.query<MailAccountRow>(
      `
        SELECT a.*,
          EXISTS (
            SELECT 1
            FROM email_core.mail_message m
            WHERE m.account_id = a.id
            LIMIT 1
          ) AS has_received_messages
        FROM email_core.mail_account a
        WHERE a.id = $1
      `,
      [accountId],
    );

    const current = existing.rows[0];
    if (!current) {
      throw new NotFoundException('Conta de e-mail nao encontrada.');
    }

    const targetTenantKey = dto.tenantKey ?? current.tenant_key;
    const targetContextType = dto.contextType ?? current.context_type;
    const willBeActive =
      (dto.syncEnabled ?? current.sync_enabled) ||
      (dto.sendEnabled ?? current.send_enabled) ||
      current.status_code === 'ACTIVE';

    if (willBeActive) {
      const hasActiveAccount = await this.databaseService.query<{ exists: boolean }>(
        `
          SELECT EXISTS (
            SELECT 1
            FROM email_core.mail_account
            WHERE tenant_key = $1
              AND context_type = $2
              AND status_code = 'ACTIVE'
              AND (sync_enabled = true OR send_enabled = true)
              AND id <> $3
          ) AS exists
        `,
        [targetTenantKey, targetContextType, accountId],
      );

      if (hasActiveAccount.rows[0]?.exists) {
        throw new ConflictException(
          `Ja existe uma conta ativa para a caixa ${targetTenantKey}. Inative a conta atual antes de editar.`,
        );
      }
    }

    const result = await this.databaseService.query<MailAccountRow>(
      `
        UPDATE email_core.mail_account a
        SET tenant_key = COALESCE($2, a.tenant_key),
            context_type = COALESCE($3, a.context_type),
            account_name = COALESCE($4, a.account_name),
            email_address = COALESCE($5, a.email_address),
            imap_host = COALESCE($6, a.imap_host),
            imap_port = COALESCE($7, a.imap_port),
            imap_secure = COALESCE($8, a.imap_secure),
            smtp_host = COALESCE($9, a.smtp_host),
            smtp_port = COALESCE($10, a.smtp_port),
            smtp_secure = COALESCE($11, a.smtp_secure),
            auth_secret_ref = COALESCE($12, a.auth_secret_ref),
            sync_enabled = COALESCE($13, a.sync_enabled),
            send_enabled = COALESCE($14, a.send_enabled),
            status_code = CASE
              WHEN COALESCE($13, a.sync_enabled) = false AND COALESCE($14, a.send_enabled) = false THEN 'DISABLED'
              ELSE 'ACTIVE'
            END,
            updated_at = NOW()
        WHERE a.id = $1
        RETURNING a.*,
          EXISTS (
            SELECT 1
            FROM email_core.mail_message m
            WHERE m.account_id = a.id
            LIMIT 1
          ) AS has_received_messages
      `,
      [
        accountId,
        dto.tenantKey ?? null,
        dto.contextType ?? null,
        dto.accountName ?? null,
        dto.emailAddress ?? null,
        dto.imapHost ?? null,
        dto.imapPort ?? null,
        dto.imapSecure ?? null,
        dto.smtpHost ?? null,
        dto.smtpPort ?? null,
        dto.smtpSecure ?? null,
        dto.authSecretRef ?? null,
        dto.syncEnabled ?? null,
        dto.sendEnabled ?? null,
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  async deleteAccount(accountId: number) {
    const hasMessages = await this.databaseService.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM email_core.mail_message
          WHERE account_id = $1
          LIMIT 1
        ) AS exists
      `,
      [accountId],
    );

    if (hasMessages.rows[0]?.exists) {
      throw new ConflictException('Conta com mensagens recebidas nao pode ser excluida. Inative a conta.');
    }

    const result = await this.databaseService.query<{ id: number }>(
      `
        DELETE FROM email_core.mail_account
        WHERE id = $1
        RETURNING id
      `,
      [accountId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Conta de e-mail nao encontrada.');
    }

    return { ok: true, deletedAccountId: accountId };
  }

  private mapRow(row: MailAccountRow) {
    return {
      id: row.id,
      tenantKey: row.tenant_key,
      contextType: row.context_type,
      accountName: row.account_name,
      emailAddress: row.email_address,
      imap: {
        host: row.imap_host,
        port: row.imap_port,
        secure: row.imap_secure,
      },
      smtp: {
        host: row.smtp_host,
        port: row.smtp_port,
        secure: row.smtp_secure,
      },
      authSecretRef: row.auth_secret_ref,
      syncEnabled: row.sync_enabled,
      sendEnabled: row.send_enabled,
      statusCode: row.status_code,
      hasReceivedMessages: row.has_received_messages,
      lastConnectionCheckAt: row.last_connection_check_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}