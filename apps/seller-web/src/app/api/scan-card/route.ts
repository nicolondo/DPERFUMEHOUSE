import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('scan-card: ANTHROPIC_API_KEY is not set');
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const { image, mediaType } = await req.json();
    if (!image) return NextResponse.json({ error: 'No image' }, { status: 400 });

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const safeType = validTypes.includes(mediaType) ? mediaType : 'image/jpeg';

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: safeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
              data: image,
            },
          },
          {
            type: 'text',
            text: 'Extract the credit card details from this image. Return ONLY a JSON object with these exact fields: "number" (16 digits, no spaces), "expiry" (MM/YY format), "name" (cardholder name as shown on card). Use empty string for any field not clearly visible. Respond with ONLY the JSON, no other text. Example: {"number":"4111111111111111","expiry":"12/26","name":"JOHN DOE"}',
          },
        ],
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return NextResponse.json({});

    const data = JSON.parse(match[0]);
    return NextResponse.json({
      number: typeof data.number === 'string' ? data.number.replace(/\D/g, '').substring(0, 16) : '',
      expiry: typeof data.expiry === 'string' ? data.expiry : '',
      name: typeof data.name === 'string' ? data.name : '',
    });
  } catch (err) {
    console.error('scan-card error:', err);
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 });
  }
}
