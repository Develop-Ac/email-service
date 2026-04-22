import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { LinksService } from './links.service';
import { CreateLinkDto } from './dto/create-link.dto';
import { RevokeLinkDto } from './dto/revoke-link.dto';

@Controller()
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Post('links')
  createManualLink(@Body() dto: CreateLinkDto) {
    return this.linksService.createManualLink(dto);
  }

  @Post('links/:linkId/revoke')
  revokeLink(@Param('linkId', ParseIntPipe) linkId: number, @Body() dto: RevokeLinkDto) {
    return this.linksService.revokeLink(linkId, dto);
  }
}