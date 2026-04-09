import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateProposalDto, UpdateProposalDto } from './dto';

@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);
  private readonly sellerAppUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {
    this.sellerAppUrl = this.configService.get<string>(
      'SELLER_APP_URL',
      'http://localhost:3000',
    );
  }

  private readonly itemInclude = {
    variant: {
      select: {
        id: true,
        name: true,
        price: true,
        sku: true,
        categoryName: true,
        attributes: true,
        images: { where: { isPrimary: true }, take: 1 },
        fragranceProfile: {
          select: {
            familiaOlfativa: true,
            subfamilia: true,
            intensidad: true,
            contextoIdeal: true,
            climaIdeal: true,
            perfilPersonalidad: true,
            notasDestacadas: true,
            descripcionDetallada: true,
            duracionEstimada: true,
            frasePositionamiento: true,
            genero: true,
            notasAdicionales: true,
          },
        },
      },
    },
  };

  async create(sellerId: string, dto: CreateProposalDto) {
    const proposal = await this.prisma.proposal.create({
      data: {
        sellerId,
        customerId: dto.customerId || null,
        title: dto.title || null,
        message: dto.message || null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        items: {
          create: dto.items.map((item, idx) => ({
            variantId: item.variantId,
            sellerNote: item.sellerNote || null,
            sortOrder: item.sortOrder ?? idx,
          })),
        },
      },
      include: {
        customer: { select: { id: true, name: true, phone: true, phoneCode: true, email: true } },
        seller: { select: { name: true } },
        items: { include: this.itemInclude, orderBy: { sortOrder: 'asc' } },
      },
    });

    // Send email to customer if they have an email
    this.sendProposalEmail(proposal).catch((err) =>
      this.logger.error(`Failed to send proposal email: ${err.message}`),
    );

    return proposal;
  }

  async findAll(sellerId: string, params: { page?: number; pageSize?: number; search?: string }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = { sellerId };
    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { customer: { name: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.proposal.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          customer: { select: { id: true, name: true, phone: true, phoneCode: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.proposal.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit: pageSize, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findOne(id: string, sellerId: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, phone: true, phoneCode: true } },
        seller: { select: { id: true, name: true, phone: true, phoneCode: true, sellerCode: true } },
        items: { include: this.itemInclude, orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!proposal) throw new NotFoundException('Propuesta no encontrada');
    if (proposal.sellerId !== sellerId) throw new ForbiddenException();
    return proposal;
  }

  async findOnePublic(id: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
      include: {
        seller: { select: { id: true, name: true, phone: true, phoneCode: true, sellerCode: true } },
        customer: { select: { id: true, name: true } },
        items: { include: this.itemInclude, orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!proposal) throw new NotFoundException('Propuesta no encontrada');
    return proposal;
  }

  async update(id: string, sellerId: string, dto: UpdateProposalDto) {
    const proposal = await this.prisma.proposal.findUnique({ where: { id } });
    if (!proposal) throw new NotFoundException('Propuesta no encontrada');
    if (proposal.sellerId !== sellerId) throw new ForbiddenException();

    return this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.proposalItem.deleteMany({ where: { proposalId: id } });
        await tx.proposalItem.createMany({
          data: dto.items.map((item, idx) => ({
            proposalId: id,
            variantId: item.variantId,
            sellerNote: item.sellerNote || null,
            sortOrder: item.sortOrder ?? idx,
          })),
        });
      }

      return tx.proposal.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.message !== undefined && { message: dto.message }),
          ...(dto.expiresAt !== undefined && { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }),
        },
        include: {
          customer: { select: { id: true, name: true, phone: true, phoneCode: true } },
          items: { include: this.itemInclude, orderBy: { sortOrder: 'asc' } },
        },
      });
    });
  }

  async remove(id: string, sellerId: string) {
    const proposal = await this.prisma.proposal.findUnique({ where: { id } });
    if (!proposal) throw new NotFoundException('Propuesta no encontrada');
    if (proposal.sellerId !== sellerId) throw new ForbiddenException();
    await this.prisma.proposal.delete({ where: { id } });
    return { deleted: true };
  }

  async incrementView(id: string) {
    const proposal = await this.prisma.proposal.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
      select: { sellerId: true, viewCount: true, customer: { select: { name: true } } },
    });

    // Push notification only on first view
    if (proposal.viewCount === 1 && proposal.sellerId) {
      this.notificationsService.notifyProposalViewed(
        proposal.sellerId,
        proposal.customer?.name || 'Cliente',
        id,
      ).catch((err) => this.logger.error(`Push notify failed: ${err.message}`));
    }

    return { ok: true };
  }

  private async sendProposalEmail(proposal: any): Promise<void> {
    const email = proposal.customer?.email;
    if (!email) return;

    const customerName = proposal.customer?.name?.split(' ')[0] || '';
    const sellerName = proposal.seller?.name || 'tu asesor';
    const proposalUrl = `${this.sellerAppUrl}/p/${proposal.id}`;
    const logoUrl = `${this.sellerAppUrl}/icons/logo-email.png`;

    const productRows = (proposal.items || [])
      .map((item: any) => {
        const v = item.variant;
        const img = v?.images?.[0]?.url || v?.images?.[0]?.thumbnailUrl || '';
        const fp = v?.fragranceProfile;
        const price = new Intl.NumberFormat('es-CO', {
          style: 'currency', currency: 'COP', maximumFractionDigits: 0,
        }).format(parseFloat(v?.price || '0'));

        return `
          <tr>
            <td style="padding:16px 0;border-bottom:1px solid #2a2215;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td width="70" valign="top">
                    ${img
                      ? `<img src="${img}" width="60" height="60" alt="${v?.name || ''}" style="border-radius:12px;object-fit:cover;display:block;" />`
                      : `<div style="width:60px;height:60px;border-radius:12px;background:#1a150e;"></div>`
                    }
                  </td>
                  <td valign="top" style="padding-left:12px;">
                    <p style="margin:0;font-size:15px;font-weight:600;color:#e8c891;">${v?.name || ''}</p>
                    ${fp?.familiaOlfativa ? `<p style="margin:4px 0 0;font-size:12px;color:#d3a86f;">✦ ${fp.familiaOlfativa}${fp.intensidad ? ` · ${fp.intensidad}` : ''}</p>` : ''}
                    ${fp?.duracionEstimada ? `<p style="margin:2px 0 0;font-size:11px;color:#8a7a65;">⏱ ${fp.duracionEstimada}</p>` : ''}
                    <p style="margin:6px 0 0;font-size:14px;font-weight:700;color:#d3a86f;">${price}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>body{margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#0f0b05;}</style>
</head><body style="margin:0;padding:0;background:#0f0b05;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0f0b05;">
<tr><td align="center" style="padding:24px 16px;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;">
    <!-- Logo -->
    <tr><td align="center" style="padding:0 0 24px;">
      <img src="${logoUrl}" width="140" alt="D Perfume House" style="display:block;" />
    </td></tr>
    <!-- Card -->
    <tr><td style="background:#16110a;border-radius:16px;border:1px solid #2a2215;padding:32px 24px;">
      <p style="margin:0;font-size:14px;color:#8a7a65;">✨ Selección especial</p>
      <h1 style="margin:8px 0 0;font-size:24px;font-weight:300;color:#fff7eb;">
        ${customerName ? `${customerName}, ` : ''}<span style="color:#d3a86f;font-weight:500;">${proposal.title || 'tu propuesta de perfumes'}</span>
      </h1>
      <p style="margin:8px 0 24px;font-size:13px;color:#8a7a65;">Preparada por ${sellerName}</p>

      ${proposal.message ? `<div style="background:#1a150e;border-radius:12px;padding:16px;margin-bottom:24px;border-left:3px solid #d3a86f;">
        <p style="margin:0;font-size:13px;color:#d6c3a8;font-style:italic;">"${proposal.message}"</p>
      </div>` : ''}

      <!-- Products -->
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        ${productRows}
      </table>

      <!-- CTA -->
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:28px;">
        <tr><td align="center">
          <a href="${proposalUrl}" style="display:inline-block;background:linear-gradient(135deg,#d3a86f,#b8894f);color:#0f0b05;font-weight:700;font-size:15px;padding:14px 40px;border-radius:50px;text-decoration:none;">
            Ver Propuesta Completa
          </a>
        </td></tr>
      </table>

      <p style="margin:20px 0 0;font-size:11px;color:#5a4f40;text-align:center;">
        Pedí tu muestra y probá antes de comprar 🌿
      </p>
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:24px 0;text-align:center;">
      <p style="margin:0;font-size:11px;color:#3a3228;">&copy; ${new Date().getFullYear()} D Perfume House &middot; Perfumería Artesanal Árabe</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

    const subject = `${sellerName} te preparó una selección de perfumes ✨`;
    await this.emailService.send(email, subject, html);
    this.logger.log(`Proposal email sent to ${email} for proposal ${proposal.id}`);
  }
}
