import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  listMessages(@Query() query: PaginationQueryDto) {
    return this.messagesService.listMessages(query);
  }

  @Get('unlinked')
  listUnlinked(@Query() query: PaginationQueryDto) {
    return this.messagesService.listUnlinked(query);
  }

  @Get(':messageId')
  getMessage(@Param('messageId', ParseIntPipe) messageId: number) {
    return this.messagesService.getMessage(messageId);
  }
}