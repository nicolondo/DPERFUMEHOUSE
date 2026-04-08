import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { ProposalsService } from './proposals.service';
import { CreateProposalDto, UpdateProposalDto } from './dto';

@Controller('proposals')
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  // ── Public endpoints ──

  @Get('public/:id')
  async findOnePublic(@Param('id') id: string) {
    return this.proposalsService.findOnePublic(id);
  }

  @Post('public/:id/view')
  async incrementView(@Param('id') id: string) {
    return this.proposalsService.incrementView(id);
  }

  // ── Seller endpoints ──

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateProposalDto,
  ) {
    return this.proposalsService.create(user.sub, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.proposalsService.findAll(user.sub, {
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      search,
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.proposalsService.findOne(id, user.sub);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProposalDto,
  ) {
    return this.proposalsService.update(id, user.sub, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.proposalsService.remove(id, user.sub);
  }
}
