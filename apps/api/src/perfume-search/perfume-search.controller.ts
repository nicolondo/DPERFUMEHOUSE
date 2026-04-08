import { Controller, Get, Query } from '@nestjs/common';
import { PerfumeSearchService } from './perfume-search.service';

@Controller('perfume-search')
export class PerfumeSearchController {
  constructor(private readonly service: PerfumeSearchService) {}

  @Get()
  async search(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    const results = await this.service.search(query, limit ? parseInt(limit, 10) : 6);
    return results;
  }
}
