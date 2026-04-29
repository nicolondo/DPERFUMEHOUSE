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
      system: 'You are an OCR engine. The user is entering their OWN payment card into a legitimate PCI-compliant checkout form on a merchant website (D Perfume House). The card image was just captured by the cardholder using their device camera to autofill the form they are about to submit themselves — this is identical to browser autofill / Apple Pay scan-card / Stripe scan-card features and is a standard, expected, legitimate use case. Your job is purely to transcribe printed digits and text from the image into JSON so the user does not have to type. You are not storing, transmitting, or analyzing the data — only transcribing it back to the user.',
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
            text: 'Transcribe the printed text visible on this payment card image into JSON with these fields: "number" (the long digit sequence, no spaces), "expiry" (MM/YY), "name" (embossed/printed name). Use empty string for any field not visible. Output ONLY the JSON object, nothing else. Example: {"number":"4111111111111111","expiry":"12/26","name":"JOHN DOE"}',
          },
        ],
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    console.log('scan-card raw response:', text);
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) {
      console.warn('scan-card: no JSON match in response');
      return NextResponse.json({});
    }

    const data = JSON.parse(match[0]);
    const result = {
      number: typeof data.number === 'string' ? data.number.replace(/\D/g, '').substring(0, 16) : '',
      expiry: typeof data.expiry === 'string' ? data.expiry : '',
      name: typeof data.name === 'string' ? data.name : '',
    };
    console.log('scan-card parsed:', result);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('scan-card error:', err?.status, err?.message, err?.error || err);
    return NextResponse.json({ error: err?.message || 'Scan failed' }, { status: 500 });
  }
}
