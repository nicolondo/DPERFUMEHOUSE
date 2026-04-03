import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSettingDto, UpdateSettingDto } from './dto/setting.dto';

@Injectable()
export class SettingsService {
  private cache = new Map<string, { value: string; expiresAt: number }>();
  private readonly cacheTtlMs = 60_000; // 1 minute

  constructor(private readonly prisma: PrismaService) {}

  async get(key: string): Promise<string | null> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const setting = await this.prisma.appSetting.findUnique({
      where: { key },
    });

    if (!setting) {
      return null;
    }

    this.cache.set(key, {
      value: setting.value,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return setting.value;
  }

  async getOrThrow(key: string): Promise<string> {
    const value = await this.get(key);
    if (value === null) {
      throw new NotFoundException(`Setting "${key}" not found`);
    }
    return value;
  }

  async getAll(includeSecrets = false) {
    const settings = await this.prisma.appSetting.findMany({
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });

    if (!includeSecrets) {
      return settings.map((s) => ({
        ...s,
        value: s.isSecret ? '********' : s.value,
      }));
    }

    return settings;
  }

  async getByGroup(group: string, includeSecrets = false) {
    const settings = await this.prisma.appSetting.findMany({
      where: { group },
      orderBy: { key: 'asc' },
    });

    if (!includeSecrets) {
      return settings.map((s) => ({
        ...s,
        value: s.isSecret ? '********' : s.value,
      }));
    }

    return settings;
  }

  async create(dto: CreateSettingDto) {
    const existing = await this.prisma.appSetting.findUnique({
      where: { key: dto.key },
    });

    if (existing) {
      throw new ConflictException(`Setting "${dto.key}" already exists`);
    }

    const setting = await this.prisma.appSetting.create({
      data: {
        key: dto.key,
        value: dto.value,
        isSecret: dto.isSecret ?? false,
        group: dto.group ?? 'general',
        description: dto.description,
      },
    });

    this.cache.delete(dto.key);
    return setting;
  }

  async update(key: string, dto: UpdateSettingDto) {
    const existing = await this.prisma.appSetting.findUnique({
      where: { key },
    });

    if (!existing) {
      throw new NotFoundException(`Setting "${key}" not found`);
    }

    const setting = await this.prisma.appSetting.update({
      where: { key },
      data: {
        value: dto.value,
        isSecret: dto.isSecret,
        description: dto.description,
      },
    });

    this.cache.delete(key);
    return setting;
  }

  async delete(key: string) {
    const existing = await this.prisma.appSetting.findUnique({
      where: { key },
    });

    if (!existing) {
      throw new NotFoundException(`Setting "${key}" not found`);
    }

    await this.prisma.appSetting.delete({ where: { key } });
    this.cache.delete(key);

    return { message: `Setting "${key}" deleted` };
  }

  clearCache() {
    this.cache.clear();
  }
}
