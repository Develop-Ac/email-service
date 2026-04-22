import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ThreadsService } from './threads.service';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';

@Controller('threads')
export class ThreadsController {
  constructor(private readonly threadsService: ThreadsService) {}

  @Get()
  listThreads(@Query() query: PaginationQueryDto) {
    return this.threadsService.listThreads(query);
  }

  @Get(':threadId')
  getThread(@Param('threadId', ParseIntPipe) threadId: number) {
    return this.threadsService.getThread(threadId);
  }
}