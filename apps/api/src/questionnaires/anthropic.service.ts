import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { FragellaProfile } from '../fragella/fragella.service';

interface AnalysisInput {
  answers: Record<string, any>;
  fragranceProfiles: any[];
  clientName?: string;
  clientGender?: string; // inferred from name
  sellerName: string;
  sellerGender?: string;
  language?: string; // 'es' | 'en', default 'es'
  clientPerfumeProfile?: FragellaProfile | null; // Fragella data for the perfume the client likes
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
    personalInsights: string;
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

  /** Strip markdown code fences (```json ... ```) that Claude sometimes adds */
  private stripCodeFences(text: string): string {
    const trimmed = text.trim();
    const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
    return match ? match[1].trim() : trimmed;
  }

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
    );

    const isEnglish = input.language === 'en';

    const languageRule = isEnglish
      ? `\n12. IMPORTANT LANGUAGE RULE: The client chose ENGLISH.
   - clientProfile.summary and clientProfile.personalInsights → IN ENGLISH (shown to the client on the results page)
   - Each recommendation MUST include an extra field "clientArgument" → IN ENGLISH (a short 1-2 sentence sales pitch shown to the client on the results page)
   - mainArgument, objectionHandling → ALWAYS IN SPANISH (these are for the seller's briefing)
   - sellerScript (iceBreaker, opening, closingTip, objections) → ALWAYS IN SPANISH (seller-facing)
   - giftContext → ALWAYS IN SPANISH (seller-facing)
   The briefing is for the Colombian seller and must be 100% in Spanish. Only the fields the client sees should be in English.`
      : '';

    // Build Fragella intelligence block if we have client's preferred perfume data
    const fragellaBlock = input.clientPerfumeProfile
      ? `\nINTELIGENCIA DE FRAGANCIA DEL CLIENTE (datos técnicos del perfume que el cliente dice que le gusta):
Nombre: ${input.clientPerfumeProfile.name} — ${input.clientPerfumeProfile.brand} (${input.clientPerfumeProfile.year})
Género: ${input.clientPerfumeProfile.gender} | Tipo: ${input.clientPerfumeProfile.oilType || 'N/A'}
Longevidad: ${input.clientPerfumeProfile.longevity} | Sillage: ${input.clientPerfumeProfile.sillage}
Rating: ${input.clientPerfumeProfile.rating}/5 | Popularidad: ${input.clientPerfumeProfile.popularity}
Acordes principales: ${input.clientPerfumeProfile.mainAccords.join(', ')}
Fuerza de acordes: ${Object.entries(input.clientPerfumeProfile.mainAccordsPercentage).map(([k, v]) => `${k}: ${v}`).join(', ')}
Notas generales: ${input.clientPerfumeProfile.generalNotes.join(', ')}
Notas Top: ${input.clientPerfumeProfile.notes.top.join(', ') || 'N/A'}
Notas Corazón: ${input.clientPerfumeProfile.notes.middle.join(', ') || 'N/A'}
Notas Base: ${input.clientPerfumeProfile.notes.base.join(', ') || 'N/A'}
Ranking estacional: ${input.clientPerfumeProfile.seasonRanking.map((s) => `${s.name}: ${s.score.toFixed(2)}`).join(', ')}
Ranking por ocasión: ${input.clientPerfumeProfile.occasionRanking.map((o) => `${o.name}: ${o.score.toFixed(2)}`).join(', ')}
`
      : '';

    const fragellaRule = input.clientPerfumeProfile
      ? `\n13. ANÁLISIS PROFUNDO DE FRAGANCIA FAVORITA: Se te proporcionan datos técnicos reales del perfume que el cliente mencionó que le gusta. USA esta información para:
   - Identificar los ACORDES DOMINANTES que le atraen (ej: si su perfume favorito es "sweet + woody", busca estos acordes en tu catálogo)
   - Considerar las NOTAS específicas (top/corazón/base) como pistas de sus preferencias reales
   - Usar el RANKING ESTACIONAL para validar contra la ciudad/clima del cliente (si su perfume favorito es verano y vive en Cartagena, eso confirma la preferencia)
   - Usar el RANKING POR OCASIÓN para validar contra la ocasión que eligió en el cuestionario
   - La LONGEVIDAD y SILLAGE del perfume favorito indican qué espera el cliente: si usa algo de longevidad "Long Lasting" y sillage "Strong", no le recomiendes algo sutil
   - Menciona estos datos técnicos en el briefing del vendedor para que suene como un experto: "Tu perfume favorito tiene acordes de [x], que es exactamente lo que encontrás en [recomendación]"
   - Si el perfume favorito NO coincide con lo que eligió en el cuestionario (ej: dice que quiere algo fresco pero su perfume favorito es dulce y pesado), señálalo en el briefing como insight valioso`
      : '';

    const systemPrompt = `Eres un experto consultor de perfumería de nicho para D Perfume House, marca colombiana de perfumería artesanal árabe (MATAI). Tu trabajo es analizar las respuestas de un cuestionario de fragancias y recomendar los 3 mejores perfumes del catálogo.

${genderContext}
${fragellaBlock}
CATÁLOGO DISPONIBLE:
${catalogDescription}

REGLAS:
1. Recomienda EXACTAMENTE 3 perfumes del catálogo, ordenados por compatibilidad (mayor a menor)
2. La compatibilidad es un % de 0-100 basado en qué tan bien encaja con las preferencias
3. El guion de ventas debe ser natural, colombiano, cálido — NO corporativo
4. Las objeciones deben anticipar "es muy caro", "no conozco la marca", "huele diferente online"
0. REGLA DE GÉNERO ABSOLUTA: El catálogo ya está PRE-FILTRADO por género del cliente. NUNCA recomiendes fragancias de género incorrecto. Si el cliente es hombre, JAMÁS recomiendes fragancias "femenino". Si el cliente es mujer, JAMÁS recomiendes "masculino". Las "unisex" son válidas para cualquier género. Esta regla es inviolable y tiene prioridad sobre CUALQUIER otra consideración.
5. MODO REGALO: Si answers.forWhom === 'gift', las respuestas del cuestionario describen al RECEPTOR del regalo, NO al comprador. En particular:
   - giftRecipient indica la relación (pareja, mamá/papá, amigo, familiar, colega, otro)
   - giftRecipientGender indica el género del receptor → usa esto para filtrar fragancias masculinas/femeninas/unisex
   - giftRecipientAge indica la edad del receptor → adapta el tono del briefing a esa edad, NO a la del comprador
   - giftOccasion indica la ocasión del regalo (cumpleaños, aniversario, día de la madre, navidad, san valentín, graduación, sin ocasión, otro día especial) → personaliza argumentos de venta con la ocasión
   - giftRecipientPerfume es el perfume favorito del receptor (puede ser "no sé") → cruza con equivalencias si lo conocen
   - giftExperience y giftIntensity pueden ser "no_se" → si es "no_se", amplía el rango de recomendaciones y explícalo
   - giftRecipientStyle describe la personalidad del receptor → úsalo como info de estilo
   - El briefing del vendedor debe dirigirse al COMPRADOR pero hablar del receptor: "Para tu [relación], que es [personalidad] y tiene [edad], te recomendamos..."
   - En giftContext, incluye: recipient (descripción del receptor), suggestion (cómo presentar el regalo)
   - NO uses campos de self-flow (age, style, identity, hobbyWeekend, dresscode, dislikes) que no existen en modo regalo
6. PERSONALIZACIÓN POR CIUDAD Y CULTURA: Analiza la ciudad del cliente en profundidad:
   - Infiere el CLIMA (tropical/cálido para Barranquilla, Cartagena, Santa Marta; templado para Bogotá, Manizales; primaveral para Medellín, Cali; frío de montaña para Tunja, Pasto)
   - Considera la CULTURA LOCAL (costeños prefieren frescura y protagonismo, paisas valoran elegancia y presentación, rolos buscan sofisticación, caleños aprecian sensualidad y dulzura, etc.)
   - Si la ciudad es internacional, adapta según el clima y cultura del país (Miami: tropical/latino, New York: cosmopolita/frío, Madrid: mediterráneo/clásico, etc.)
   - Usa esto para PRIORIZAR fragancias que funcionen en ese contexto climático y cultural
   - Menciona la ciudad en el briefing del vendedor: "Como vivís en [ciudad], donde el clima es [x], te recomendamos..."
7. Si mencionan un perfume que les gusta, cruza con las equivalencias del catálogo
8. Usa las respuestas personales (hobbyWeekend, dresscode, perfumeMemory) para personalizar argumentos de venta — menciona sus hobbies, estilo de vestir y recuerdos como conexiones emocionales
9. El iceBreaker y opening DEBEN incluir referencias personales del cliente (por ejemplo su hobby, su forma de vestirse, o su recuerdo olfativo) para que el vendedor conecte de inmediato
10. ADAPTA EL TONO DEL BRIEFING SEGÚN LA EDAD del cliente:
   - 18-25: tono fresco, directo, usa expresiones juveniles colombianas, referencias a tendencias y redes sociales
   - 26-35: tono seguro y moderno, habla de estilo de vida, carrera, momentos sociales
   - 36-45: tono sofisticado pero cercano, habla de calidad, exclusividad, autoconocimiento
   - 46-55: tono respetuoso y elegante, enfatiza tradición, refinamiento, experiencia
   - 55+: tono cálido y deferente, habla de clásicos, legado, momentos memorables
   El vendedor debe sentir que el guion fue escrito PARA la edad de ese cliente específico.
11. Responde SOLO en JSON válido, sin markdown ni comentarios
12. REGLA DE IDIOMA OBLIGATORIA: TODO el briefing, guion del vendedor, argumentos de venta, manejo de objeciones y perfil del cliente debe estar 100% en ESPAÑOL. NO uses palabras en inglés bajo ninguna circunstancia. Traduce cualquier término técnico al español (por ejemplo: usa "notas de salida" en vez de "top notes", "estela" en vez de "sillage", "duración" en vez de "longevity", "acuerdo" en vez de "accord", "amaderado" en vez de "woody", "fresco" en vez de "fresh", "dulce" en vez de "sweet", "cítrico" en vez de "citrus", "floral" en vez de "floral", "especiado" en vez de "spicy", "oriental" en vez de "oriental", "rompehielo" en vez de "icebreaker", "script" en vez de "script"). El vendedor colombiano necesita un guion completamente en español.${fragellaRule}${languageRule}`;

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
    "ageRange": "Rango de edad del cliente",
    "dislikes": ["lista", "de", "notas", "que", "no", "le", "gustan"],
    "personalInsights": "2-3 oraciones con datos personales del cliente que el vendedor puede usar como argumentos de venta (su hobby, estilo de vestir, recuerdos olfativos). Ej: 'Le gusta salir con amigos, viste smart casual y tiene un recuerdo especial con el café. Perfecto para conectar con fragancias cálidas que evocan momentos sociales.'"
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
  }${input.answers?.forWhom === 'gift' ? `,
  "giftContext": {
    "recipient": "Descripción del receptor del regalo basada en giftRecipient, giftRecipientGender, giftRecipientAge y giftRecipientStyle",
    "suggestion": "Sugerencia de cómo presentar/envolver el regalo según la ocasión (giftOccasion)"
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

      const parsed = JSON.parse(this.stripCodeFences(content)) as AnalysisResult;
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

  async enrichFromFragellaData(equivalencia: string, fragellaProfile: any): Promise<any> {
    const apiKey = await this.settingsService.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured in settings');
    }

    const systemPrompt = `Eres un experto perfumista con conocimiento profundo de miles de fragancias famosas. Combinas datos estructurados de bases de datos de perfumería (Fragrantica, Basenotes, etc.) con tu propio conocimiento sobre fragancias para construir perfiles de venta completos, precisos y atractivos. NUNCA incluyas información de precios, costos, valores monetarios ni rangos de precio en ningún campo. Responde SOLO con JSON válido, sin texto adicional.`;

    const seasonTop = fragellaProfile.seasonRanking
      ?.sort((a: any, b: any) => b.score - a.score)
      .slice(0, 3)
      .map((s: any) => `${s.name}(${s.score}%)`)
      .join(', ') || 'N/A';

    const occasionTop = fragellaProfile.occasionRanking
      ?.sort((a: any, b: any) => b.score - a.score)
      .slice(0, 3)
      .map((o: any) => `${o.name}(${o.score}%)`)
      .join(', ') || 'N/A';

    const fragellaBlock = `### Datos de Fragella para "${fragellaProfile.name}" de ${fragellaProfile.brand}
- Género: ${fragellaProfile.gender}
- Longevidad: ${fragellaProfile.longevity}
- Proyección (sillage): ${fragellaProfile.sillage}
- Notas de salida (Top): ${fragellaProfile.notes?.top?.join(', ') || 'N/A'}
- Notas de corazón (Middle): ${fragellaProfile.notes?.middle?.join(', ') || 'N/A'}
- Notas de fondo (Base): ${fragellaProfile.notes?.base?.join(', ') || 'N/A'}
- Acordes principales: ${fragellaProfile.mainAccords?.join(', ') || 'N/A'}
- Notas generales: ${fragellaProfile.generalNotes?.join(', ') || 'N/A'}
- Temporadas destacadas: ${seasonTop}
- Ocasiones destacadas: ${occasionTop}`;

    const userPrompt = `Perfume equivalente famoso: "${equivalencia}"

${fragellaBlock}

Usa TODOS estos datos de Fragella más tu propio conocimiento sobre este perfume (de Fragrantica, Basenotes y otras fuentes reconocidas) para completar el siguiente perfil de venta. Sé específico, atractivo y útil para un vendedor que va a presentar este perfume a clientes. NO incluyas precios, costos ni valores monetarios en ningún campo.

Responde con un JSON con TODOS los campos:
{
  "familiaOlfativa": "familia olfativa principal en español (Floral, Amaderado, Oriental, Frutal, Gourmand, Cítrico, Aromático, Chipre, Ambarado, etc.)",
  "subfamilia": "subfamilia o matiz específico (ej: Floral Frutal, Amaderado Especiado, Oriental Dulce, etc.)",
  "genero": "Masculino | Femenino | Unisex",
  "intensidad": "Suave | Moderada | Intensa | Muy Intensa",
  "notasDestacadas": "lista de notas separadas por coma en formato: salida: X, Y; corazón: A, B; fondo: C, D",
  "descripcionDetallada": "descripción sensorial rica y vendedora de 2-3 oraciones para que un vendedor la use con el cliente",
  "contextoIdeal": "cuándo usar este perfume (evento, momento del día, ocasión)",
  "climaIdeal": "clima y temporada ideal para usarlo",
  "perfilPersonalidad": "perfil de la persona que lo usaría (2-3 adjetivos descriptivos)",
  "duracionEstimada": "duración estimada concreta en horas (ej: 6-8 horas, +10 horas)",
  "frasePositionamiento": "frase corta y poderosa de marketing, máx 10 palabras, en español",
  "tagsNegativos": ["array de 2-5 características que podrían disgustar a ciertos clientes"]
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
          max_tokens: 1500,
          messages: [{ role: 'user', content: userPrompt }],
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

      return JSON.parse(this.stripCodeFences(content));
    } catch (error: any) {
      this.logger.error(`Failed to enrich from Fragella data: ${error.message}`);
      throw error;
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

      return JSON.parse(this.stripCodeFences(content));
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

      return JSON.parse(this.stripCodeFences(content));
    } catch (error: any) {
      this.logger.error(`Failed to parse PDF: ${error.message}`);
      throw error;
    }
  }

  async extractFromPyramidImage(base64: string, mimeType: string): Promise<any> {
    const apiKey = await this.settingsService.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured in settings');
    }

    const systemPrompt = `Eres un experto perfumista. Analizas imágenes o documentos de pirámides olfativas y extraes información estructurada de fragancias. Responde SOLO con JSON válido.`;

    const textContent = `Analiza esta pirámide olfativa o imagen de fragancia y extrae la información disponible. Devuelve un JSON con los campos que puedas identificar (deja null si no está disponible):
{
  "familiaOlfativa": "familia olfativa principal (ej: Floral, Amaderado, Oriental, Frutal, etc.)",
  "subfamilia": "subfamilia o matiz (ej: Floral-Frutal, Amaderado-Especiado, etc.)",
  "genero": "Masculino | Femenino | Unisex",
  "intensidad": "Suave | Moderada | Intensa | Muy Intensa",
  "notasDestacadas": "lista de notas de salida, corazón y fondo separadas por coma",
  "descripcionDetallada": "descripción sensorial de 2-3 oraciones para un vendedor",
  "contextoIdeal": "cuando usar (ej: Cenas, eventos nocturnos, uso diario)",
  "climaIdeal": "clima recomendado (ej: Templado, frío, cálido)",
  "perfilPersonalidad": "perfil de quien lo usaría (ej: Sofisticado, aventurero, clásico)",
  "duracionEstimada": "duración estimada (ej: 8-12 horas)",
  "frasePositionamiento": "frase corta de marketing",
  "tagsNegativos": ["array", "de", "características", "que podrían disgustar"]
}`;

    const contentBlock =
      mimeType === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
        : { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } };

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
          max_tokens: 1500,
          messages: [
            {
              role: 'user',
              content: [contentBlock, { type: 'text', text: textContent }],
            },
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

      return JSON.parse(this.stripCodeFences(content));
    } catch (error: any) {
      this.logger.error(`Failed to extract from pyramid image: ${error.message}`);
      throw error;
    }
  }

  private buildGenderContext(
    sellerName: string,
    sellerGender?: string,
    clientName?: string,
  ): string {
    const parts: string[] = [];

    if (sellerName) {
      const sellerLabel = sellerGender === 'femenino' ? 'vendedora' : sellerGender === 'masculino' ? 'vendedor' : 'vendedor(a)';
      parts.push(`El/La ${sellerLabel} se llama ${sellerName}.`);
    }

    if (clientName) {
      parts.push(`El/La cliente se llama ${clientName}. Infiere su género por el nombre para adaptar el tono.`);
    }

    if (parts.length > 0) {
      parts.push('Adapta el lenguaje del guion de ventas según el género del vendedor y del cliente.');
    }

    return parts.join(' ');
  }
}
