import {NextRequest, NextResponse} from 'next/server';
import {
  loadKeys,
  saveKeys,
  maskKey,
  loadPrefs,
  savePrefs,
  DEFAULT_BRAND,
  DEFAULT_SUBTITLE_OFFSET,
  DEFAULT_LAYOUT,
  type ApiKeys,
  type Preferences,
} from '@/lib/config';

export const runtime = 'nodejs';

function shape(keys: ApiKeys, prefs: Preferences) {
  return {
    minimax: {configured: !!keys.minimax, masked: maskKey(keys.minimax)},
    brand: prefs.brand || DEFAULT_BRAND,
    subtitleOffsetSec: prefs.subtitleOffsetSec ?? DEFAULT_SUBTITLE_OFFSET,
    defaultLayout: prefs.defaultLayout ?? DEFAULT_LAYOUT,
  };
}

export async function GET() {
  const keys = await loadKeys();
  const prefs = await loadPrefs();
  return NextResponse.json(shape(keys, prefs));
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<ApiKeys> & Partial<Preferences>;
  const {brand, subtitleOffsetSec, defaultLayout, ...keyFields} = body;
  if (Object.keys(keyFields).length > 0) {
    await saveKeys(keyFields);
  }
  if (brand !== undefined || subtitleOffsetSec !== undefined || defaultLayout !== undefined) {
    await savePrefs({brand, subtitleOffsetSec, defaultLayout});
  }
  const keys = await loadKeys();
  const prefs = await loadPrefs();
  return NextResponse.json(shape(keys, prefs));
}
