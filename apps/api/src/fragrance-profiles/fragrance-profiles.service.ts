import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnthropicService } from '../questionnaires/anthropic.service';
import { FragellaService } from '../fragella/fragella.service';
import { CreateFragranceProfileDto, UpdateFragranceProfileDto } from './dto';

@Injectable()
export class FragranceProfilesService {
  private readonly logger = new Logger(FragranceProfilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropicService: AnthropicService,
    private readonly fragellaService: FragellaService,
  ) {}

  async findAll(params: { page?: number; pageSize?: number; search?: string; activeOnly?: boolean }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 50;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (params.activeOnly) where.isActive = true;
    if (params.search) {
      where.OR = [
        { productVariant: { name: { contains: params.search, mode: 'insensitive' } } },
        { familiaOlfativa: { contains: params.search, mode: 'insensitive' } },
        { equivalencia: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.fragranceProfile.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          productVariant: {
            select: { id: true, name: true, price: true, sku: true, categoryName: true, images: { where: { isPrimary: true }, take: 1 } },
          },
        },
        orderBy: { productVariant: { name: 'asc' } },
      }),
      this.prisma.fragranceProfile.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit: pageSize, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findOne(id: string) {
    const profile = await this.prisma.fragranceProfile.findUnique({
      where: { id },
      include: {
        productVariant: {
          select: { id: true, name: true, price: true, sku: true, categoryName: true, images: true },
        },
      },
    });
    if (!profile) throw new NotFoundException('Fragrance profile not found');
    return profile;
  }

  async findByVariantId(productVariantId: string) {
    return this.prisma.fragranceProfile.findUnique({
      where: { productVariantId },
      include: {
        productVariant: {
          select: { id: true, name: true, price: true, sku: true, images: { where: { isPrimary: true }, take: 1 } },
        },
      },
    });
  }

  async findAllActive() {
    return this.prisma.fragranceProfile.findMany({
      where: { isActive: true },
      include: {
        productVariant: {
          select: { id: true, name: true, price: true, sku: true, categoryName: true, images: { where: { isPrimary: true }, take: 1 } },
        },
      },
    });
  }

  async create(dto: CreateFragranceProfileDto) {
    const existing = await this.prisma.fragranceProfile.findUnique({
      where: { productVariantId: dto.productVariantId },
    });
    if (existing) throw new ConflictException('Profile already exists for this variant');

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.productVariantId },
    });
    if (!variant) throw new NotFoundException('Product variant not found');

    const completionScore = this.calculateCompletionScore(dto);

    return this.prisma.fragranceProfile.create({
      data: {
        ...dto,
        completionScore,
      },
      include: {
        productVariant: {
          select: { id: true, name: true, price: true },
        },
      },
    });
  }

  async update(id: string, dto: UpdateFragranceProfileDto) {
    const profile = await this.prisma.fragranceProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Fragrance profile not found');

    const completionScore = this.calculateCompletionScore({ ...profile, ...dto });

    return this.prisma.fragranceProfile.update({
      where: { id },
      data: {
        ...dto,
        completionScore,
        updatedAt: new Date(),
      },
      include: {
        productVariant: {
          select: { id: true, name: true, price: true },
        },
      },
    });
  }

  async bulkImport(profiles: CreateFragranceProfileDto[]) {
    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const profile of profiles) {
      try {
        const existing = await this.prisma.fragranceProfile.findUnique({
          where: { productVariantId: profile.productVariantId },
        });
        if (existing) {
          results.skipped++;
          continue;
        }
        await this.create(profile);
        results.created++;
      } catch (error) {
        results.errors.push(`${profile.productVariantId}: ${error.message}`);
      }
    }

    return results;
  }

  async enrich(id: string) {
    const profile = await this.prisma.fragranceProfile.findUnique({
      where: { id },
      include: { productVariant: { select: { name: true } } },
    });
    if (!profile) throw new NotFoundException('Fragrance profile not found');

    const enriched = await this.anthropicService.enrichFragranceProfile(
      {
        name: profile.productVariant.name,
        familiaOlfativa: profile.familiaOlfativa,
        subfamilia: profile.subfamilia,
        intensidad: profile.intensidad,
        contextoIdeal: profile.contextoIdeal,
        climaIdeal: profile.climaIdeal,
        perfilPersonalidad: profile.perfilPersonalidad,
        notasDestacadas: profile.notasDestacadas,
        descripcionDetallada: profile.descripcionDetallada,
        duracionEstimada: profile.duracionEstimada,
        tagsNegativos: profile.tagsNegativos,
        frasePositionamiento: profile.frasePositionamiento,
        genero: profile.genero,
      },
      profile.equivalencia || undefined,
    );

    const updateData: any = {};
    for (const [key, value] of Object.entries(enriched)) {
      if (value !== null && value !== undefined) {
        updateData[key] = value;
      }
    }

    const completionScore = this.calculateCompletionScore({ ...profile, ...updateData });

    return this.prisma.fragranceProfile.update({
      where: { id },
      data: {
        ...updateData,
        completionScore,
        lastEnrichedAt: new Date(),
      },
      include: {
        productVariant: {
          select: { id: true, name: true, price: true },
        },
      },
    });
  }

  async parsePdf(textContent: string) {
    return this.anthropicService.parsePdfContent(textContent);
  }

  async getVariantsWithProfileStatus(search?: string) {
    const where: any = { isActive: true, isBlocked: false };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { categoryName: { contains: search, mode: 'insensitive' } },
      ];
    }
    const variants = await this.prisma.productVariant.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        categoryName: true,
        price: true,
        images: { where: { isPrimary: true }, take: 1 },
        fragranceProfile: {
          select: { id: true, completionScore: true, isActive: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    return variants;
  }

  async extractFromPyramidImage(buffer: Buffer, mimeType: string) {
    const base64 = buffer.toString('base64');
    return this.anthropicService.extractFromPyramidImage(base64, mimeType);
  }

  async getFragellaFields(equivalencia: string) {
    const profile = await this.fragellaService.getProfile(equivalencia);
    if (!profile) return null;

    // Use AI to combine Fragella data + Claude's own knowledge about the fragrance
    return this.anthropicService.enrichFromFragellaData(equivalencia, profile);
  }

  private calculateCompletionScore(data: any): number {
    const fields = [
      'familiaOlfativa', 'subfamilia', 'intensidad', 'contextoIdeal',
      'climaIdeal', 'perfilPersonalidad', 'notasDestacadas', 'descripcionDetallada',
      'duracionEstimada', 'frasePositionamiento', 'genero', 'equivalencia',
    ];
    const tagField = 'tagsNegativos';
    let filled = 0;
    const total = fields.length + 1; // +1 for tags

    for (const field of fields) {
      if (data[field] && data[field] !== '') filled++;
    }
    if (data[tagField] && Array.isArray(data[tagField]) && data[tagField].length > 0) filled++;

    return Math.round((filled / total) * 100);
  }
}
