import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface BankCertificateData {
  bankName: string;
  bankAccountType: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  documentNumber?: string;
  documentType?: string;
}

@Injectable()
export class CertificateAnalyzerService {
  private readonly logger = new Logger(CertificateAnalyzerService.name);
  private client: Anthropic;

  constructor(private configService: ConfigService) {
    // dotenv won't override existing env vars, so read from parsed .env directly
    const dotenv = require('dotenv');
    const parsed = dotenv.config().parsed || {};
    const apiKey = parsed.ANTHROPIC_API_KEY || this.configService.get<string>('ANTHROPIC_API_KEY');

    this.client = new Anthropic({ apiKey });
  }

  async analyzeCertificate(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<BankCertificateData> {
    this.logger.log(`Analyzing bank certificate (${mimeType}, ${fileBuffer.length} bytes)`);

    const isImage = mimeType.startsWith('image/');
    const isPdf = mimeType === 'application/pdf';

    if (!isImage && !isPdf) {
      throw new Error('Formato no soportado. Use PDF, JPG o PNG.');
    }

    const base64 = fileBuffer.toString('base64');

    const mediaType = isImage
      ? (mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp')
      : 'application/pdf';

    const content: any[] = [
      {
        type: isPdf ? 'document' : 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64,
        },
      },
      {
        type: 'text',
        text: `Analiza esta certificación bancaria colombiana y extrae la siguiente información en formato JSON estricto (sin markdown, sin backticks, solo el JSON):

{
  "bankName": "nombre del banco (ej: Bancolombia, Davivienda, BBVA, etc)",
  "bankAccountType": "ahorros o corriente",
  "bankAccountNumber": "número de cuenta completo",
  "bankAccountHolder": "nombre del titular de la cuenta",
  "documentNumber": "número de documento del titular (cédula, NIT, etc)",
  "documentType": "tipo de documento (CC, NIT, CE, PP)"
}

IMPORTANTE:
- bankAccountType DEBE ser exactamente "ahorros" o "corriente" (minúsculas)
- Si no puedes determinar algún campo, usa string vacío ""
- Responde SOLO con el JSON, sin texto adicional`,
      },
    ];

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content,
          },
        ],
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No se recibió respuesta de texto del AI');
      }

      let jsonStr = textBlock.text.trim();
      // Remove markdown code blocks if present
      jsonStr = jsonStr.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

      const parsed = JSON.parse(jsonStr) as BankCertificateData;

      this.logger.log(`Certificate analyzed successfully: ${parsed.bankName} - ${parsed.bankAccountHolder}`);

      return {
        bankName: parsed.bankName || '',
        bankAccountType: parsed.bankAccountType || '',
        bankAccountNumber: parsed.bankAccountNumber || '',
        bankAccountHolder: parsed.bankAccountHolder || '',
        documentNumber: parsed.documentNumber || '',
        documentType: parsed.documentType || '',
      };
    } catch (error: any) {
      this.logger.error('Failed to analyze certificate', error.message);
      throw new Error(`Error al analizar la certificación: ${error.message}`);
    }
  }
}
