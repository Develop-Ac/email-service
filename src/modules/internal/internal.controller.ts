import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { MessagesService } from '../messages/messages.service';
import { ThreadsService } from '../threads/threads.service';
import { IngestInboundMessageDto } from './dto/ingest-inbound-message.dto';
import { InternalIngestService } from './internal-ingest.service';

@Controller('internal/email')
export class InternalController {
  constructor(
    private readonly threadsService: ThreadsService,
    private readonly messagesService: MessagesService,
    private readonly internalIngestService: InternalIngestService,
  ) {}

  @Post('messages/ingest')
  ingestMessage(@Body() dto: IngestInboundMessageDto) {
    return this.internalIngestService.ingestInboundMessage(dto);
  }

  @Get('threads/:threadId')
  getThread(@Param('threadId', ParseIntPipe) threadId: number) {
    return this.threadsService.getThread(threadId);
  }

  @Get('messages/:messageId')
  getMessage(@Param('messageId', ParseIntPipe) messageId: number) {
    return this.messagesService.getMessage(messageId);
  }
}