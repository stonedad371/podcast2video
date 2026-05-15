import {NextRequest, NextResponse} from 'next/server';
import {
  loadKeys,
  saveKeys,
  maskKey,
  loadPrefs,
  savePrefs,
  DEFAULT_BRAND,
  type ApiKeys,
  type Preferences,
} from '@/lib/config';

export const runtime = 'nodejs';

export async function GET() {
  const keys = await loadKeys();
  const prefs = await loadPrefs();
  return NextResponse.json({
    minimax: {
      configured: !!keys.minimax,
      masked: maskKey(keys.minimax),
    },
    brand: prefs.brand || DEFAULT_BRAND,
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<ApiKeys> & Partial<Preferences>;
  const {brand, ...keyFields} = body;
  if (Object.keys(keyFields).length > 0) {
    await saveKeys(keyFields);
  }
  if (brand !== undefined) {
    await savePrefs({brand});
  }
  const keys = await loadKeys();
  const prefs = await loadPrefs();
  return NextResponse.json({
    minimax: {configured: !!keys.minimax, masked: maskKey(keys.minimax)},
    brand: prefs.brand || DEFAULT_BRAND,
  });
}
