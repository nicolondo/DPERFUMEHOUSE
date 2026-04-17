import {
  Controller, Get, Post, Patch, Param, Body, Query, Req, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { LeadsService } from './leads.service';
import { SubmitQuestionnaireDto, CreateLeadForCustomerDto, UpdateLeadStatusDto, UpdateAppointmentDto, ConvertLeadDto } from './dto';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  // ── Public endpoints (no auth) ──

  @Get('questionnaire/:sellerCode')
  async startQuestionnaire(@Param('sellerCode') sellerCode: string) {
    return this.leadsService.startQuestionnaire(sellerCode);
  }

  @Post('questionnaire/:sellerCode')
  async submitQuestionnairePublic(
    @Param('sellerCode') sellerCode: string,
    @Body() dto: SubmitQuestionnaireDto,
  ) {
    return this.leadsService.submitQuestionnaire(sellerCode, dto);
  }

  @Post('questionnaire/:sellerCode/:leadId')
  async submitQuestionnairePersonal(
    @Param('sellerCode') sellerCode: string,
    @Param('leadId') leadId: string,
    @Body() dto: SubmitQuestionnaireDto,
  ) {
    return this.leadsService.submitQuestionnaire(sellerCode, dto, leadId);
  }

  @Get('results/:leadId')
  async getResults(@Param('leadId') leadId: string) {
    return this.leadsService.getResults(leadId);
  }

  @Post('results/:leadId/notify-contact')
  async notifySellerContact(@Param('leadId') leadId: string) {
    return this.leadsService.notifySellerContact(leadId);
  }

  // ── Seller endpoints ──

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.leadsService.findAllForSeller(user.sub, {
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      status,
      search,
    });
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@CurrentUser() user: CurrentUserPayload) {
    return this.leadsService.getStats(user.sub);
  }

  @Get('generate-link')
  @UseGuards(JwtAuthGuard)
  async generateLink(
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Query('categories') categories?: string,
  ) {
    const baseUrl = `${req.protocol}://${req.get('host')}`.replace('/api', '');
    // Use the seller-web URL from referer or a config
    const sellerWebUrl = (req.get('origin') || req.get('referer') || '').replace(/\/+$/, '');
    const categoriesArray = categories ? categories.split(',').map(c => c.trim()).filter(Boolean) : undefined;
    return this.leadsService.generatePublicLink(user.sub, sellerWebUrl || baseUrl, categoriesArray);
  }

  @Post('for-customer')
  @UseGuards(JwtAuthGuard)
  async createForCustomer(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateLeadForCustomerDto,
    @Req() req: Request,
  ) {
    const sellerWebUrl = (req.get('origin') || req.get('referer') || '').replace(/\/+$/, '');
    return this.leadsService.createForCustomer(user.sub, dto, sellerWebUrl);
  }

  @Post(':id/send-email')
  @UseGuards(JwtAuthGuard)
  async sendQuestionnaireEmail(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.leadsService.sendQuestionnaireEmail(id, user.sub);
  }

  @Post(':id/reanalyze')
  @UseGuards(JwtAuthGuard)
  async reanalyze(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.leadsService.reanalyzeLead(id, user.sub);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.leadsService.findOneForSeller(id, user.sub);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateLeadStatusDto,
  ) {
    return this.leadsService.updateStatus(id, user.sub, dto.status);
  }

  @Patch(':id/appointment')
  @UseGuards(JwtAuthGuard)
  async updateAppointment(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.leadsService.updateAppointment(id, user.sub, dto);
  }

  @Patch(':id/convert')
  @UseGuards(JwtAuthGuard)
  async convertLead(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ConvertLeadDto,
  ) {
    return this.leadsService.convertLead(id, user.sub, dto);
  }

  @Post(':id/create-customer')
  @UseGuards(JwtAuthGuard)
  async createCustomerFromLead(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.leadsService.createCustomerFromLead(id, user.sub);
  }

  // ── Admin endpoints ──

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async findAllAdmin(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('sellerId') sellerId?: string,
    @Query('search') search?: string,
  ) {
    return this.leadsService.findAllAdmin({
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      status,
      sellerId,
      search,
    });
  }

  @Get('admin/analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getAnalytics() {
    return this.leadsService.getAnalytics();
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async findOneAdmin(@Param('id') id: string) {
    return this.leadsService.findOneAdmin(id);
  }
}
