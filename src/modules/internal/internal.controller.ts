import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { MessagesService } from '../messages/messages.service';
import { ThreadsService } from '../threads/threads.service';

@Controller('internal/email')
export class InternalController {
  constructor(
    private readonly threadsService: ThreadsService,
    private readonly messagesService: MessagesService,
  ) {}

  @Get('threads/:threadId')
  getThread(@Param('threadId', ParseIntPipe) threadId: number) {
    return this.threadsService.getThread(threadId);
  }

  @Get('messages/:messageId')
  getMessage(@Param('messageId', ParseIntPipe) messageId: number) {
    return this.messagesService.getMessage(messageId);
  }
}