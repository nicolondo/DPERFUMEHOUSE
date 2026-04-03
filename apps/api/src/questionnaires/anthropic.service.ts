import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

interface AnalysisInput {
  answers: Record<string, any>;
  fragranceProfiles: any[];
  clientName?: string;
  clientGender?: string; // inferred from name
  sellerName: string;
  sellerGender?: string;
}

interface FragranceRecommendation {
  productVariantId: string;
  name: string;
  compatibility: number; // 0-100
  mainArgument: string;
  objectionHandling: string;
  presentationOrder: number;
}

interface AnalysisResult {
  clientProfile: {
    summary: string;
    olfactivePreferences: string;
    personality: string;
    occasion: string;
    climate: string;
    dislikes: string[];
  };
  recommendations: FragranceRecommendation[];
  sellerScript: {
    iceBreaker: string;
    opening: string;
    closingTip: string;
    objections: Record<string, string>;
  };
  giftContext?: {
    recipient: string;
    suggestion: string;
  };
}

@Injectable()
export class AnthropicService {
  private readonly logger = new Logger(AnthropicService.name);

  constructor(private readonly settingsService: SettingsService) {}

  async analyzeQuestionnaire(input: AnalysisInput): Promise<AnalysisResult> {
    const apiKey = await this.settingsService.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured in settings');
    }

    const catalogDescription = input.fragranceProfiles.map((fp) => {
      return `- ${fp.productVariant?.name || fp.name} (ID: ${fp.productVariantId})
  Familia: ${fp.familiaOlfativa}${fp.subfamilia ? '/' + fp.subfamilia : ''}
  Género: ${fp.genero}
  Intensidad: ${fp.intensidad}
  Contexto: ${fp.contextoIdeal || 'versátil'}
  Clima: ${fp.climaIdeal || 'universal'}
  Personalidad: ${fp.perfilPersonalidad || 'versátil'}
  Notas: ${fp.notasDestacadas || 'N/A'}
  Equivalencia: ${fp.equivalencia || 'N/A'}
  Frase: ${fp.frasePositionamiento || 'N/A'}
  Tags negativos: ${fp.tagsNegativos?.join(', ') || 'ninguno'}`;
    }).join('\n\n');

    const genderContext = this.buildGenderContext(
      input.sellerName,
      input.sellerGender,
      input.clientName,
      input.clientGender,
    );

    const systemPrompt = `Eres un experto consultor de perfumería de nicho para D Perfume House, marca colombiana de perfumería artesanal árabe (MATAI). Tu trabajo es analizar las respuestas de un cuestionario de fragancias y recomendar los 3 mejores perfumes del catálogo.

${genderContext}

CATÁLOGO DISPONIBLE:
${catalogDescription}

REGLAS:
1. Recomienda EXACTAMENTE 3 perfumes del catálogo, ordenados por compatibilidad (mayor a menor)
2. La compatibilidad es un % de 0-100 basado en qué tan bien encaja con las preferencias
3. El guion de ventas debe ser natural, colombiano, cálido — NO corporativo
4. Las objeciones deben anticipar "es muy caro", "no conozco la marca", "huele diferente online"
5. Si es para regalo, adapta argumentos al receptor
6. Infiere el clima de la ciudad del cliente para mejorar recomendaciones
7. Si mencionan un perfume que les gusta, cruza con las equivalencias del catálogo
8. Responde SOLO en JSON válido, sin markdown ni comentarios`;

    const userPrompt = `Respuestas del cuestionario:
${JSON.stringify(input.answers, null, 2)}

${input.clientName ? `Nombre del cliente: ${input.clientName}` : ''}

Genera el análisis completo en este formato JSON exacto:
{
  "clientProfile": {
    "summary": "Resumen de 1-2 oraciones del perfil olfativo del cliente",
    "olfactivePreferences": "Preferencias olfativas detectadas",
    "personality": "Tipo de personalidad/estilo",
    "occasion": "Ocasión principal de uso",
    "climate": "Clima inferido de la ciudad",
    "dislikes": ["lista", "de", "notas", "que", "no", "le", "gustan"]
  },
  "recommendations": [
    {
      "productVariantId": "uuid del producto",
      "name": "Nombre del perfume",
      "compatibility": 92,
      "mainArgument": "Argumento principal de venta personalizado",
      "objectionHandling": "Cómo manejar la objeción más probable",
      "presentationOrder": 1
    }
  ],
  "sellerScript": {
    "iceBreaker": "Frase para romper el hielo basada en las respuestas",
    "opening": "Guion de apertura personalizado para la cita",
    "closingTip": "Tip de cierre basado en el estilo del cliente",
    "objections": {
      "precio": "Manejo de objeción de precio",
      "marca": "Manejo de objeción de marca desconocida",
      "olor": "Manejo de 'huele diferente de lo que esperaba'"
    }
  }${input.answers?.isForGift ? `,
  "giftContext": {
    "recipient": "Descripción del receptor",
    "suggestion": "Sugerencia adicional para regalo"
  }` : ''}
}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [
            { role: 'user', content: userPrompt },
          ],
          system: systemPrompt,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Anthropic API error: ${response.status} ${errorText}`);
        throw new Error(`Anthropic API error: ${response.status}`);
      }

      const data: any = await response.json();
      const content = data.content?.[0]?.text;
      if (!content) {
        throw new Error('Empty response from Anthropic');
      }

      const parsed = JSON.parse(content) as AnalysisResult;
      return parsed;
    } catch (error: any) {
      this.logger.error(`Failed to analyze questionnaire: ${error.message}`);
      throw error;
    }
  }

  async inferGenderFromName(name: string): Promise<string> {
    const apiKey = await this.settingsService.get('ANTHROPIC_API_KEY');
    if (!apiKey) return 'unknown';

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 50,
          messages: [
            {
              role: 'user',
              content: `¿El nombre "${name}" es típicamente masculino o femenino en Colombia/Latinoamérica? Responde SOLO con una palabra: "masculino" o "femenino". Si no estás seguro, responde "unknown".`,
            },
          ],
        }),
      });

      if (!response.ok) return 'unknown';

      const data: any = await response.json();
      const text = data.content?.[0]?.text?.trim().toLowerCase();
      if (text === 'masculino' || text === 'femenino') return text;
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  async enrichFragranceProfile(profile: any, equivalencia?: string): Promise<any> {
    const apiKey = await this.settingsService.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured in settings');
    }

    const systemPrompt = `Eres un experto perfumista. Te doy un perfil parcial de una fragancia y su equivalencia con un perfume famoso (si la tiene). Completa SOLO los campos vacíos/null. Responde en JSON.`;

    const userPrompt = `Perfil actual:
${JSON.stringify(profile, null, 2)}

${equivalencia ? `Equivalencia con perfume famoso: ${equivalencia}` : 'Sin equivalencia conocida.'}

Completa los campos que estén vacíos o null. Mantén los que ya tienen valor. Campos posibles:
- subfamilia (subcategoría de la familia olfativa)
- intensidad (baja|media|alta)
- contextoIdeal (diario|nocturno|casual|versátil)
- climaIdeal (frío|templado|cálido|universal)
- perfilPersonalidad (clásico|moderno|atrevido|relajado)
- descripcionDetallada (2-3 oraciones describiendo la fragancia para un vendedor)
- duracionEstimada (ej: "6-8 horas")
- tagsNegativos (array de notas/características que podrían disgustar: ["dulce", "fuerte", etc.])
- frasePositionamiento (frase corta de marketing)

Responde SOLO con el JSON de los campos completados/actualizados.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [
            { role: 'user', content: userPrompt },
          ],
          system: systemPrompt,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
      }

      const data: any = await response.json();
      const content = data.content?.[0]?.text;
      if (!content) throw new Error('Empty response from Anthropic');

      return JSON.parse(content);
    } catch (error: any) {
      this.logger.error(`Failed to enrich profile: ${error.message}`);
      throw error;
    }
  }

  async parsePdfContent(textContent: string): Promise<any[]> {
    const apiKey = await this.settingsService.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured in settings');
    }

    const systemPrompt = `Eres un experto perfumista. Extraes datos estructurados de documentos de perfumería. Dado el texto de un PDF, extrae todos los perfumes mencionados con sus datos.`;

    const userPrompt = `Texto del documento:
${textContent.substring(0, 8000)}

Extrae cada perfume como un objeto JSON con estos campos (deja null si no está disponible):
- name (nombre del perfume)
- familiaOlfativa
- subfamilia
- intensidad (baja|media|alta)
- contextoIdeal (diario|nocturno|casual|versátil)
- climaIdeal (frío|templado|cálido|universal)
- perfilPersonalidad (clásico|moderno|atrevido|relajado)
- notasDestacadas (notas de salida, corazón y fondo en texto)
- descripcionDetallada
- duracionEstimada
- genero (masculino|femenino|unisex)
- equivalencia (perfume famoso equivalente, si se menciona)

Responde SOLO con un JSON array de estos objetos.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [
            { role: 'user', content: userPrompt },
          ],
          system: systemPrompt,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
      }

      const data: any = await response.json();
      const content = data.content?.[0]?.text;
      if (!content) throw new Error('Empty response from Anthropic');

      return JSON.parse(content);
    } catch (error: any) {
      this.logger.error(`Failed to parse PDF: ${error.message}`);
      throw error;
    }
  }

  private buildGenderContext(
    sellerName: string,
    sellerGender?: string,
    clientName?: string,
    clientGender?: string,
  ): string {
    const parts: string[] = [];

    if (sellerName) {
      const sellerLabel = sellerGender === 'femenino' ? 'vendedora' : sellerGender === 'masculino' ? 'vendedor' : 'vendedor(a)';
      parts.push(`El/La ${sellerLabel} se llama ${sellerName}.`);
    }

    if (clientName) {
      const clientLabel = clientGender === 'femenino' ? 'clienta' : clientGender === 'masculino' ? 'cliente' : 'cliente';
      parts.push(`El/La ${clientLabel} se llama ${clientName}.`);
    }

    if (parts.length > 0) {
      parts.push('Adapta el lenguaje del guion de ventas según el género del vendedor y del cliente.');
    }

    return parts.join(' ');
  }
}
