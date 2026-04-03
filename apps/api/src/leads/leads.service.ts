import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnthropicService } from '../questionnaires/anthropic.service';
import { FragranceProfilesService } from '../fragrance-profiles/fragrance-profiles.service';
import { EmailService } from '../email/email.service';
import { SubmitQuestionnaireDto, CreateLeadForCustomerDto, UpdateAppointmentDto, ConvertLeadDto } from './dto';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropicService: AnthropicService,
    private readonly fragranceProfilesService: FragranceProfilesService,
    private readonly emailService: EmailService,
  ) {}

  // ── Public endpoints (no auth) ──

  async startQuestionnaire(sellerCode: string) {
    const seller = await this.prisma.user.findFirst({
      where: { sellerCode, isActive: true },
      select: { id: true, name: true, phone: true, sellerCode: true },
    });
    if (!seller) throw new NotFoundException('Seller not found');

    return {
      sellerId: seller.id,
      sellerName: seller.name,
      sellerCode: seller.sellerCode,
    };
  }

  async submitQuestionnaire(sellerCode: string, dto: SubmitQuestionnaireDto, leadId?: string) {
    // Find seller
    const seller = await this.prisma.user.findFirst({
      where: { sellerCode, isActive: true },
      select: { id: true, name: true, gender: true, phone: true, email: true },
    });
    if (!seller) throw new NotFoundException('Seller not found');

    let lead: any;

    if (leadId) {
      // Personal mode — update existing lead
      lead = await this.prisma.lead.findUnique({
        where: { id: leadId },
        include: { customer: true },
      });
      if (!lead) throw new NotFoundException('Lead not found');

      // Client info comes from Customer
      dto.clientName = lead.customer?.name || dto.clientName || undefined;
      dto.clientEmail = lead.customer?.email || dto.clientEmail || undefined;
      dto.clientPhone = lead.customer?.phone || dto.clientPhone || undefined;
    }

    // Get all active fragrance profiles for catalog
    const fragranceProfiles = await this.fragranceProfilesService.findAllActive();

    // AI analysis (only if fragrance profiles exist)
    let analysis: any = { clientProfile: null, recommendations: [], sellerScript: null };
    if (fragranceProfiles.length > 0) {
      try {
        // Infer client gender from name
        let clientGender: string | undefined;
        if (dto.clientName) {
          clientGender = await this.anthropicService.inferGenderFromName(dto.clientName);
        }

        // Call Anthropic for analysis
        analysis = await this.anthropicService.analyzeQuestionnaire({
          answers: dto.answers,
          fragranceProfiles,
          clientName: dto.clientName,
          clientGender,
          sellerName: seller.name,
          sellerGender: seller.gender || undefined,
        });
      } catch (err) {
        this.logger.error(`AI analysis failed: ${(err as Error).message}`);
      }
    } else {
      this.logger.warn('No fragrance profiles found — skipping AI analysis');
    }

    if (leadId && lead) {
      // Update existing lead
      lead = await this.prisma.lead.update({
        where: { id: leadId },
        data: {
          status: 'RESPONDED',
          answers: dto.answers,
          aiAnalysis: analysis.clientProfile as any,
          recommendations: analysis.recommendations as any,
          sellerScript: analysis.sellerScript as any,
          budgetRange: dto.budgetRange,
          isForGift: dto.isForGift || false,
          giftRecipient: dto.giftRecipient,
          clientCity: dto.clientCity,
          respondedAt: new Date(),
        },
      });
    } else {
      // Create new lead (public mode)
      lead = await this.prisma.lead.create({
        data: {
          sellerId: seller.id,
          sellerCode,
          mode: 'PUBLIC',
          status: 'RESPONDED',
          clientName: dto.clientName,
          clientEmail: dto.clientEmail,
          clientPhone: dto.clientPhone,
          clientCity: dto.clientCity,
          answers: dto.answers,
          aiAnalysis: analysis.clientProfile as any,
          recommendations: analysis.recommendations as any,
          sellerScript: analysis.sellerScript as any,
          budgetRange: dto.budgetRange,
          isForGift: dto.isForGift || false,
          giftRecipient: dto.giftRecipient,
          respondedAt: new Date(),
        },
      });
    }

    // Send thank-you email
    if (dto.clientEmail) {
      this.sendThankYouEmail(dto.clientEmail, dto.clientName, seller.name, seller.phone || undefined, lead.id).catch(
        (err) => this.logger.error(`Failed to send thank-you email: ${err.message}`),
      );
    }

    // Notify seller
    if (seller.email) {
      this.sendSellerQuestionnaireNotification(
        seller.email, seller.name, dto.clientName, dto.clientPhone, dto.clientCity, lead.id,
      ).catch((err) => this.logger.error(`Failed to send seller notification: ${err.message}`));
    }

    return { leadId: lead.id };
  }

  async getResults(leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        status: true,
        clientName: true,
        aiAnalysis: true,
        recommendations: true,
        isForGift: true,
        giftRecipient: true,
        seller: { select: { name: true, phone: true } },
      },
    });
    if (!lead) throw new NotFoundException('Results not found');
    if (lead.status === 'SENT') throw new BadRequestException('Questionnaire not completed yet');

    // Resolve product variant info for recommendations
    const recommendations = (lead.recommendations as any[]) || [];
    const variantIds = recommendations.map((r) => r.productVariantId).filter(Boolean);

    const variants = variantIds.length > 0
      ? await this.prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: {
            id: true,
            name: true,
            price: true,
            images: { where: { isPrimary: true }, take: 1 },
          },
        })
      : [];

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const enrichedRecommendations = recommendations.map((rec) => ({
      ...rec,
      product: variantMap.get(rec.productVariantId) || null,
    }));

    return {
      id: lead.id,
      clientName: lead.clientName,
      clientProfile: lead.aiAnalysis,
      recommendations: enrichedRecommendations,
      isForGift: lead.isForGift,
      giftRecipient: lead.giftRecipient,
      seller: lead.seller,
    };
  }

  // ── Seller endpoints (authenticated) ──

  async findAllForSeller(sellerId: string, params: {
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
  }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = { sellerId };
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { clientName: { contains: params.search, mode: 'insensitive' } },
        { clientPhone: { contains: params.search, mode: 'insensitive' } },
        { clientEmail: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          customer: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.lead.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit: pageSize, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findOneForSeller(id: string, sellerId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        seller: { select: { id: true, name: true, phone: true, gender: true } },
        convertedOrder: { select: { id: true, orderNumber: true, total: true } },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.sellerId !== sellerId) throw new NotFoundException('Lead not found');

    // Resolve product images for recommendations
    const recommendations = (lead.recommendations as any[]) || [];
    const variantIds = recommendations.map((r) => r.productVariantId).filter(Boolean);
    const variants = variantIds.length > 0
      ? await this.prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: {
            id: true,
            name: true,
            price: true,
            images: { where: { isPrimary: true }, take: 1 },
          },
        })
      : [];
    const variantMap = new Map(variants.map((v) => [v.id, v]));
    const enrichedRecommendations = recommendations.map((rec) => ({
      ...rec,
      product: variantMap.get(rec.productVariantId) || null,
    }));

    return {
      ...lead,
      recommendations: enrichedRecommendations,
    };
  }

  async createForCustomer(sellerId: string, dto: CreateLeadForCustomerDto, baseUrl: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
      select: { id: true, name: true, email: true, phone: true, sellerId: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    if (customer.sellerId !== sellerId) throw new NotFoundException('Customer not found');

    const seller = await this.prisma.user.findUnique({
      where: { id: sellerId },
      select: { sellerCode: true },
    });
    if (!seller?.sellerCode) throw new BadRequestException('Seller code not configured');

    const lead = await this.prisma.lead.create({
      data: {
        sellerId,
        customerId: customer.id,
        sellerCode: seller.sellerCode,
        mode: 'PERSONAL',
        status: 'SENT',
        clientName: customer.name,
        clientEmail: customer.email,
        clientPhone: customer.phone,
      },
    });

    const questionnaireUrl = `${baseUrl}/q/${seller.sellerCode}/${lead.id}`;

    await this.prisma.lead.update({
      where: { id: lead.id },
      data: { questionnaireUrl },
    });

    return {
      lead: { ...lead, questionnaireUrl },
      whatsappMessage: this.buildWhatsAppMessage(customer.name, seller.sellerCode, questionnaireUrl),
    };
  }

  async sendQuestionnaireEmail(leadId: string, sellerId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { customer: { select: { name: true, email: true } } },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.sellerId !== sellerId) throw new NotFoundException('Lead not found');
    if (!lead.questionnaireUrl) throw new BadRequestException('Questionnaire URL not generated');
    if (!lead.customer?.email) throw new BadRequestException('Customer has no email');

    const sent = await this.emailService.sendQuestionnaire(
      lead.customer.email,
      lead.customer.name,
      lead.questionnaireUrl,
    );

    if (!sent) throw new BadRequestException('Failed to send email');
    return { success: true, email: lead.customer.email };
  }

  async generatePublicLink(sellerId: string, baseUrl: string) {
    const seller = await this.prisma.user.findUnique({
      where: { id: sellerId },
      select: { sellerCode: true, name: true },
    });
    if (!seller?.sellerCode) throw new BadRequestException('Seller code not configured');

    const url = `${baseUrl}/q/${seller.sellerCode}`;
    return {
      url,
      sellerCode: seller.sellerCode,
    };
  }

  async updateStatus(id: string, sellerId: string, status: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.sellerId !== sellerId) throw new NotFoundException('Lead not found');

    const validTransitions: Record<string, string[]> = {
      SENT: ['RESPONDED'],
      RESPONDED: ['APPOINTMENT'],
      APPOINTMENT: ['VISITED'],
      VISITED: ['CONVERTED'],
    };

    const allowed = validTransitions[lead.status];
    if (!allowed || !allowed.includes(status)) {
      throw new BadRequestException(`Cannot transition from ${lead.status} to ${status}`);
    }

    const updateData: any = { status };
    if (status === 'APPOINTMENT') updateData.appointmentAt = new Date();
    if (status === 'VISITED') updateData.visitedAt = new Date();
    if (status === 'CONVERTED') updateData.convertedAt = new Date();

    return this.prisma.lead.update({
      where: { id },
      data: updateData,
    });
  }

  async updateAppointment(id: string, sellerId: string, dto: UpdateAppointmentDto) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.sellerId !== sellerId) throw new NotFoundException('Lead not found');

    return this.prisma.lead.update({
      where: { id },
      data: {
        appointmentDate: dto.appointmentDate ? new Date(dto.appointmentDate) : undefined,
        appointmentTime: dto.appointmentTime,
        appointmentLocation: dto.appointmentLocation,
        appointmentNotes: dto.appointmentNotes,
        status: lead.status === 'RESPONDED' ? 'APPOINTMENT' : lead.status,
        appointmentAt: lead.status === 'RESPONDED' ? new Date() : undefined,
      },
    });
  }

  async convertLead(id: string, sellerId: string, dto: ConvertLeadDto) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.sellerId !== sellerId) throw new NotFoundException('Lead not found');

    return this.prisma.lead.update({
      where: { id },
      data: {
        status: 'CONVERTED',
        convertedOrderId: dto.orderId,
        convertedAt: new Date(),
      },
    });
  }

  async getStats(sellerId: string) {
    const counts = await this.prisma.lead.groupBy({
      by: ['status'],
      where: { sellerId },
      _count: true,
    });

    const statusMap: Record<string, number> = {};
    for (const c of counts) {
      statusMap[c.status] = c._count;
    }

    const total = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const responded = statusMap['RESPONDED'] || 0;

    return {
      total,
      byStatus: statusMap,
      newLeads: responded, // leads awaiting contact
    };
  }

  // ── Admin endpoints ──

  async findAllAdmin(params: {
    page?: number;
    pageSize?: number;
    status?: string;
    sellerId?: string;
    search?: string;
  }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.sellerId) where.sellerId = params.sellerId;
    if (params.search) {
      where.OR = [
        { clientName: { contains: params.search, mode: 'insensitive' } },
        { clientPhone: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          seller: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.lead.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit: pageSize, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async getAnalytics() {
    const leads = await this.prisma.lead.findMany({
      where: { status: { not: 'SENT' } },
      select: {
        status: true,
        aiAnalysis: true,
        recommendations: true,
        budgetRange: true,
        clientCity: true,
        answers: true,
        sellerId: true,
        createdAt: true,
      },
    });

    // Status distribution
    const statusCounts: Record<string, number> = {};
    leads.forEach((l) => { statusCounts[l.status] = (statusCounts[l.status] || 0) + 1; });

    // Budget distribution
    const budgetCounts: Record<string, number> = {};
    leads.forEach((l) => {
      if (l.budgetRange) budgetCounts[l.budgetRange] = (budgetCounts[l.budgetRange] || 0) + 1;
    });

    // City distribution
    const cityCounts: Record<string, number> = {};
    leads.forEach((l) => {
      if (l.clientCity) cityCounts[l.clientCity] = (cityCounts[l.clientCity] || 0) + 1;
    });

    // Most recommended products
    const productCounts: Record<string, number> = {};
    leads.forEach((l) => {
      const recs = (l.recommendations as any[]) || [];
      recs.forEach((r) => {
        if (r.name) productCounts[r.name] = (productCounts[r.name] || 0) + 1;
      });
    });

    // Conversion by seller
    const sellerStats: Record<string, { total: number; converted: number }> = {};
    leads.forEach((l) => {
      if (!sellerStats[l.sellerId]) sellerStats[l.sellerId] = { total: 0, converted: 0 };
      sellerStats[l.sellerId].total++;
      if (l.status === 'CONVERTED') sellerStats[l.sellerId].converted++;
    });

    // Weekly trend (last 8 weeks)
    const now = new Date();
    const weeklyTrend: { week: string; count: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const count = leads.filter((l) => l.createdAt >= weekStart && l.createdAt < weekEnd).length;
      weeklyTrend.push({ week: weekStart.toISOString().split('T')[0], count });
    }

    return {
      total: leads.length,
      statusDistribution: statusCounts,
      budgetDistribution: budgetCounts,
      cityDistribution: cityCounts,
      topProducts: Object.entries(productCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
      conversionBySeller: sellerStats,
      weeklyTrend,
    };
  }

  // ── Helpers ──

  private buildWhatsAppMessage(clientName: string, sellerCode: string, url: string): string {
    return `¡Hola${clientName ? ' ' + clientName.split(' ')[0] : ''}! 🌸\n\nTe preparé un cuestionario rápido para encontrar tu perfume ideal. Solo toma 2 minutos:\n\n${url}\n\n¡Contame qué te pareció! 😊`;
  }

  private async sendThankYouEmail(
    email: string,
    clientName: string | undefined,
    sellerName: string,
    sellerPhone: string | undefined,
    leadId: string,
  ) {
    const name = clientName?.split(' ')[0] || '';
    const escapedName = name.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[c] || c));
    const escapedSeller = sellerName.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[c] || c));
    const subject = '🌸 ¡Gracias por tu cuestionario de fragancias!';
    const logoUrl = 'https://pos.dperfumehouse.com/icons/logo-email.png';
    const html = `
      <!DOCTYPE html>
      <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light only">
        <meta name="supported-color-schemes" content="light only">
        <style>
          :root { color-scheme: light only; }
          body { margin: 0; padding: 0; font-family: 'Outfit', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f0b05 !important; }
          [data-ogsc] .wrapper, [data-ogsc] .header, [data-ogsc] .content, [data-ogsc] .footer { background-color: #16110a !important; }
          [data-ogsc] .title { color: #fff7eb !important; }
          [data-ogsc] .message { color: #d6c3a8 !important; }
        </style>
      </head>
      <body style="margin:0;padding:0;background-color:#0f0b05;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0f0b05;">
          <tr><td align="center" style="padding:24px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="max-width:620px;width:100%;background-color:#16110a;">
              <!-- Header -->
              <tr><td align="center" style="padding:30px 32px 20px;background-color:#16110a;">
                <img src="${logoUrl}" alt="D Perfume House" width="320" style="display:block;width:320px;max-width:80%;height:auto;" />
                <p style="margin:12px 0 0 0;color:#bfa685;letter-spacing:2px;font-size:11px;text-transform:uppercase;">Cuestionario completado</p>
              </td></tr>
              <!-- Content -->
              <tr><td style="padding:28px 32px 14px;color:#f4ece1;background-color:#16110a;">
                <span style="display:inline-block;margin-bottom:14px;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#a8e6cf;border:1px solid #3d7a5a;background-color:rgba(77,196,122,.12);">✅ Recibido</span>
                <p style="margin:0 0 12px 0;font-size:25px;line-height:1.2;color:#fff7eb;font-weight:700;">¡Hola${escapedName ? ' ' + escapedName : ''}! 🌸</p>
                <p style="margin:0 0 10px 0;font-size:15px;color:#d6c3a8;">
                  Recibimos tus respuestas y ya estamos preparando tus <strong style="color:#fff7eb;">recomendaciones personalizadas</strong> de fragancias.
                </p>
                <!-- Seller card -->
                <div style="margin:22px 0;border:1px solid #3b2c17;border-radius:12px;background-color:#1e160d;padding:20px;">
                  <p style="margin:0 0 6px 0;color:#9c8568;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Tu asesor(a) personal</p>
                  <p style="margin:0 0 8px 0;font-size:20px;font-weight:700;color:#fff7eb;">${escapedSeller}</p>
                  <p style="margin:0;font-size:14px;color:#d6c3a8;">Te contactará pronto con las opciones perfectas para ti.</p>
                  ${sellerPhone ? `<p style="margin:10px 0 0 0;font-size:14px;color:#d3a86f;">📱 ${sellerPhone}</p>` : ''}
                </div>
                <p style="margin:0 0 20px 0;font-size:15px;color:#d6c3a8;">
                  Tu asesor(a) te mostrará muestras reales para que puedas elegir con confianza. ¡La experiencia olfativa es todo! 🌿
                </p>
                <div style="border-top:1px solid #3b2c17;padding-top:16px;margin-top:10px;">
                  <p style="margin:0;font-size:13px;color:#9c8568;">
                    Si tienes alguna pregunta, no dudes en contactar a tu asesor(a).
                  </p>
                </div>
              </td></tr>
              <!-- Footer -->
              <tr><td style="padding:18px 32px 24px;color:#9c8568;font-size:12px;text-align:center;background-color:#16110a;">
                <p style="margin:4px 0;"><strong>D Perfume House</strong></p>
                <p style="margin:4px 0;">&copy; ${new Date().getFullYear()} Todos los derechos reservados.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    await this.emailService.send(email, subject, html);

    await this.prisma.lead.update({
      where: { id: leadId },
      data: { emailSentAt: new Date() },
    });
  }

  private async sendSellerQuestionnaireNotification(
    sellerEmail: string,
    sellerName: string,
    clientName: string | undefined,
    clientPhone: string | undefined,
    clientCity: string | undefined,
    leadId: string,
  ) {
    const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[c] || c));
    const firstName = sellerName.split(' ')[0];
    const client = clientName || 'Un nuevo cliente';
    const leadUrl = `https://pos.dperfumehouse.com/leads`;
    const logoUrl = 'https://pos.dperfumehouse.com/icons/logo-email.png';
    const subject = `🎯 ¡${client.split(' ')[0]} completó el cuestionario de fragancias!`;
    const html = `
      <!DOCTYPE html>
      <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light only">
        <meta name="supported-color-schemes" content="light only">
        <style>
          :root { color-scheme: light only; }
          body { margin: 0; padding: 0; font-family: 'Outfit', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f0b05 !important; }
          [data-ogsc] .wrapper, [data-ogsc] .header, [data-ogsc] .content, [data-ogsc] .footer { background-color: #16110a !important; }
          [data-ogsc] .title { color: #fff7eb !important; }
          [data-ogsc] .message { color: #d6c3a8 !important; }
        </style>
      </head>
      <body style="margin:0;padding:0;background-color:#0f0b05;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0f0b05;">
          <tr><td align="center" style="padding:24px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="max-width:620px;width:100%;background-color:#16110a;">
              <!-- Header -->
              <tr><td align="center" style="padding:30px 32px 20px;background-color:#16110a;">
                <img src="${logoUrl}" alt="D Perfume House" width="320" style="display:block;width:320px;max-width:80%;height:auto;" />
                <p style="margin:12px 0 0 0;color:#bfa685;letter-spacing:2px;font-size:11px;text-transform:uppercase;">Notificación de lead</p>
              </td></tr>
              <!-- Content -->
              <tr><td style="padding:28px 32px 14px;color:#f4ece1;background-color:#16110a;">
                <span style="display:inline-block;margin-bottom:14px;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#ffdca7;border:1px solid #7a5b2f;background-color:rgba(196,148,77,.14);">🎯 Nuevo cuestionario</span>
                <p style="margin:0 0 12px 0;font-size:25px;line-height:1.2;color:#fff7eb;font-weight:700;">¡Hola ${esc(firstName)}!</p>
                <p style="margin:0 0 16px 0;font-size:15px;color:#d6c3a8;">
                  <strong style="color:#fff7eb;">${esc(client)}</strong> acaba de completar el cuestionario de fragancias. Ya tienes sus recomendaciones personalizadas listas.
                </p>
                <!-- Client info card -->
                <div style="margin:0 0 22px 0;border:1px solid #3b2c17;border-radius:12px;background-color:#1e160d;padding:20px;">
                  <p style="margin:0 0 6px 0;color:#9c8568;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Datos del cliente</p>
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:#9c8568;width:80px;">Nombre</td>
                      <td style="padding:6px 0;font-size:14px;color:#fff7eb;font-weight:600;">${esc(client)}</td>
                    </tr>
                    ${clientPhone ? `<tr>
                      <td style="padding:6px 0;font-size:13px;color:#9c8568;width:80px;">Teléfono</td>
                      <td style="padding:6px 0;font-size:14px;color:#d3a86f;">${esc(clientPhone)}</td>
                    </tr>` : ''}
                    ${clientCity ? `<tr>
                      <td style="padding:6px 0;font-size:13px;color:#9c8568;width:80px;">Ciudad</td>
                      <td style="padding:6px 0;font-size:14px;color:#d6c3a8;">${esc(clientCity)}</td>
                    </tr>` : ''}
                  </table>
                </div>
                <p style="margin:0 0 20px 0;font-size:15px;color:#d6c3a8;">
                  Revisa los resultados y contacta al cliente lo antes posible. ¡El momento perfecto es ahora! 🔥
                </p>
                <!-- CTA Button -->
                <div style="text-align:center;margin:0 0 24px 0;">
                  <a href="${esc(leadUrl)}" style="display:inline-block;background:linear-gradient(135deg,#d3a86f 0%,#b8843f 100%);color:#1b1208;padding:16px 40px;text-decoration:none;border-radius:999px;font-weight:700;font-size:16px;letter-spacing:.5px;">Ver Resultados</a>
                </div>
                <div style="border-top:1px solid #3b2c17;padding-top:16px;margin-top:10px;">
                  <p style="margin:0;font-size:13px;color:#9c8568;">
                    Los clientes que son contactados en las primeras horas tienen 3x más probabilidad de comprar.
                  </p>
                </div>
              </td></tr>
              <!-- Footer -->
              <tr><td style="padding:18px 32px 24px;color:#9c8568;font-size:12px;text-align:center;background-color:#16110a;">
                <p style="margin:4px 0;"><strong>D Perfume House</strong></p>
                <p style="margin:4px 0;">&copy; ${new Date().getFullYear()} Todos los derechos reservados.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    await this.emailService.send(sellerEmail, subject, html);
  }
}
