import {
  Controller, Get, Post, Put, Param, Body, Query, UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FragranceProfilesService } from './fragrance-profiles.service';
import { CreateFragranceProfileDto, UpdateFragranceProfileDto, BulkImportDto } from './dto';

@Controller('fragrance-profiles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class FragranceProfilesController {
  constructor(private readonly service: FragranceProfilesService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.service.findAll({
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      search,
      activeOnly: activeOnly === 'true',
    });
  }

  @Get('variants')
  async getVariantsWithProfileStatus(@Query('search') search?: string) {
    return this.service.getVariantsWithProfileStatus(search);
  }

  @Get('fragella-fields')
  async getFragellaFields(@Query('equivalencia') equivalencia: string) {
    return this.service.getFragellaFields(equivalencia);
  }

  @Post('extract-from-pyramid')
  @UseInterceptors(FileInterceptor('file'))
  async extractFromPyramid(@UploadedFile() file: Express.Multer.File) {
    return this.service.extractFromPyramidImage(file.buffer, file.mimetype);
  }

  @Post('bulk-import')
  async bulkImport(@Body() dto: BulkImportDto) {
    return this.service.bulkImport(dto.profiles);
  }

  @Post('parse-pdf')
  @UseInterceptors(FileInterceptor('file'))
  async parsePdf(@UploadedFile() file: Express.Multer.File) {
    const textContent = file.buffer.toString('utf-8');
    return this.service.parsePdf(textContent);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateFragranceProfileDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateFragranceProfileDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/enrich')
  async enrich(@Param('id') id: string) {
    return this.service.enrich(id);
  }
}

