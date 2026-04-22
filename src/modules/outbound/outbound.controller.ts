import { Body, Controller, Post } from '@nestjs/common';
import { OutboundService } from './outbound.service';
import { SendOutboundDto } from './dto/send-outbound.dto';

@Controller('outbound')
export class OutboundController {
  constructor(private readonly outboundService: OutboundService) {}

  @Post()
  send(@Body() dto: SendOutboundDto) {
    return this.outboundService.send(dto);
  }
}