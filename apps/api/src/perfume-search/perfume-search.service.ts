import { Injectable } from '@nestjs/common';
import { FragellaService } from '../fragella/fragella.service';

export interface PerfumeSearchResult {
  id: string;
  name: string;
  brand: string;
  slug: string;
  image: string | null;
}

@Injectable()
export class PerfumeSearchService {
  constructor(private readonly fragella: FragellaService) {}

  async search(query: string, limit = 6): Promise<PerfumeSearchResult[]> {
    const results = await this.fragella.search(query, limit);
    return results.map((r) => ({
      id: r.id,
      name: r.name,
      brand: r.brand,
      slug: r.name.replace(/\s+/g, '-').toLowerCase(),
      image: r.image ? r.image.replace(/\.jpg$/, '.webp') : null,
    }));
  }
}
