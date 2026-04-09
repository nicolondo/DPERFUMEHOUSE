import { Injectable, Logger } from '@nestjs/common';

const FRAGELLA_BASE = 'https://api.fragella.com/api/v1';
const FRAGELLA_API_KEY =
  '6ffd45fd4d94593193d6c261dbb4dfb1badff626901009329cf2a7687bfa348e';

export interface FragellaFragrance {
  Name: string;
  Brand: string;
  Year: string;
  rating: string;
  Country: string;
  Popularity: string;
  'Price Value': string;
  Confidence: string;
  'Image URL': string;
  Gender: string;
  Price: string;
  Longevity: string;
  Sillage: string;
  OilType: string;
  'Season Ranking': { name: string; score: number }[];
  'Occasion Ranking': { name: string; score: number }[];
  'General Notes': string[];
  'Main Accords': string[];
  'Main Accords Percentage': Record<string, string>;
  Notes: {
    Top: { name: string; imageUrl: string }[];
    Middle: { name: string; imageUrl: string }[];
    Base: { name: string; imageUrl: string }[];
  };
  'Image Fallbacks'?: string[];
  'Purchase URL'?: string;
}

export interface FragellaSearchResult {
  id: string;
  name: string;
  brand: string;
  image: string | null;
  year: string;
  gender: string;
}

export interface FragellaProfile {
  name: string;
  brand: string;
  year: string;
  rating: string;
  gender: string;
  longevity: string;
  sillage: string;
  oilType: string;
  popularity: string;
  priceValue: string;
  seasonRanking: { name: string; score: number }[];
  occasionRanking: { name: string; score: number }[];
  generalNotes: string[];
  mainAccords: string[];
  mainAccordsPercentage: Record<string, string>;
  notes: {
    top: string[];
    middle: string[];
    base: string[];
  };
}

@Injectable()
export class FragellaService {
  private readonly logger = new Logger(FragellaService.name);

  async search(query: string, limit = 6): Promise<FragellaSearchResult[]> {
    if (!query || query.trim().length < 3) return [];

    try {
      const url = `${FRAGELLA_BASE}/fragrances?search=${encodeURIComponent(query.trim())}&limit=${limit}`;
      const data = await this.fetchApi<FragellaFragrance[]>(url);
      if (!data) return [];

      return data.map((f, i) => ({
        id: `fragella-${i}-${f.Name.replace(/\s+/g, '-').toLowerCase()}`,
        name: f.Name,
        brand: f.Brand,
        image: f['Image URL'] || null,
        year: f.Year,
        gender: f.Gender,
      }));
    } catch (err) {
      this.logger.error('Fragella search error', err);
      return [];
    }
  }

  async getProfile(fragranceName: string): Promise<FragellaProfile | null> {
    if (!fragranceName || fragranceName.trim().length < 3) return null;

    try {
      const url = `${FRAGELLA_BASE}/fragrances?search=${encodeURIComponent(fragranceName.trim())}&limit=1`;
      const data = await this.fetchApi<FragellaFragrance[]>(url);
      if (!data || data.length === 0) return null;

      const f = data[0];
      return {
        name: f.Name,
        brand: f.Brand,
        year: f.Year,
        rating: f.rating,
        gender: f.Gender,
        longevity: f.Longevity,
        sillage: f.Sillage,
        oilType: f.OilType,
        popularity: f.Popularity,
        priceValue: f['Price Value'],
        seasonRanking: f['Season Ranking'] || [],
        occasionRanking: f['Occasion Ranking'] || [],
        generalNotes: f['General Notes'] || [],
        mainAccords: f['Main Accords'] || [],
        mainAccordsPercentage: f['Main Accords Percentage'] || {},
        notes: {
          top: f.Notes?.Top?.map((n) => n.name) || [],
          middle: f.Notes?.Middle?.map((n) => n.name) || [],
          base: f.Notes?.Base?.map((n) => n.name) || [],
        },
      };
    } catch (err) {
      this.logger.error(`Fragella profile error for "${fragranceName}"`, err);
      return null;
    }
  }

  async getSimilar(fragranceName: string, limit = 5): Promise<FragellaProfile[]> {
    if (!fragranceName || fragranceName.trim().length < 3) return [];

    try {
      const url = `${FRAGELLA_BASE}/fragrances/similar?name=${encodeURIComponent(fragranceName.trim())}&limit=${limit}`;
      const data = await this.fetchApi<{ similar_to: string; similar_fragrances: FragellaFragrance[] }>(url);
      if (!data?.similar_fragrances) return [];

      return data.similar_fragrances.map((f) => ({
        name: f.Name,
        brand: f.Brand,
        year: f.Year,
        rating: f.rating,
        gender: f.Gender,
        longevity: f.Longevity,
        sillage: f.Sillage,
        oilType: f.OilType,
        popularity: f.Popularity,
        priceValue: f['Price Value'],
        seasonRanking: f['Season Ranking'] || [],
        occasionRanking: f['Occasion Ranking'] || [],
        generalNotes: f['General Notes'] || [],
        mainAccords: f['Main Accords'] || [],
        mainAccordsPercentage: f['Main Accords Percentage'] || {},
        notes: {
          top: f.Notes?.Top?.map((n) => n.name) || [],
          middle: f.Notes?.Middle?.map((n) => n.name) || [],
          base: f.Notes?.Base?.map((n) => n.name) || [],
        },
      }));
    } catch (err) {
      this.logger.error(`Fragella similar error for "${fragranceName}"`, err);
      return [];
    }
  }

  private async fetchApi<T>(url: string): Promise<T | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, {
        headers: { 'x-api-key': FRAGELLA_API_KEY },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        if (res.status === 404) return null;
        this.logger.warn(`Fragella API ${res.status}: ${url}`);
        return null;
      }
      return await res.json() as T;
    } catch (err: any) {
      clearTimeout(timeout);
      if (err?.name === 'AbortError') {
        this.logger.warn(`Fragella API timeout: ${url}`);
      }
      return null;
    }
  }
}
