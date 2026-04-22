import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Controller('mail-accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  listAccounts() {
    return this.accountsService.listAccounts();
  }

  @Post()
  createAccount(@Body() dto: CreateAccountDto) {
    return this.accountsService.createAccount(dto);
  }

  @Patch(':accountId')
  updateAccount(@Param('accountId', ParseIntPipe) accountId: number, @Body() dto: UpdateAccountDto) {
    return this.accountsService.updateAccount(accountId, dto);
  }

  @Patch(':accountId/inactivate')
  inactivateAccount(@Param('accountId', ParseIntPipe) accountId: number) {
    return this.accountsService.inactivateAccount(accountId);
  }

  @Delete(':accountId')
  deleteAccount(@Param('accountId', ParseIntPipe) accountId: number) {
    return this.accountsService.deleteAccount(accountId);
  }
}