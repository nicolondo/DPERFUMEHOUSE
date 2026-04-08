import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SellerProductLinksService } from './seller-product-links.service';
import { GenerateLinkDto, PurchaseDto } from './dto';

@Controller('seller-product-links')
export class SellerProductLinksController {
  constructor(private readonly service: SellerProductLinksService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  generate(@Request() req, @Body() dto: GenerateLinkDto) {
    return this.service.generate(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Request() req) {
    return this.service.findAll(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  deactivate(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.service.deactivate(id, req.user.id);
  }

  // Public endpoints (no auth)
  @Get('public/:code')
  getPublic(@Param('code') code: string) {
    return this.service.getPublic(code);
  }

  @Post('public/:code/purchase')
  purchase(@Param('code') code: string, @Body() dto: PurchaseDto) {
    return this.service.purchase(code, dto);
  }
}
