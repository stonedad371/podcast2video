import {NextRequest, NextResponse} from 'next/server';
import {loadKeys, saveKeys, maskKey, type ApiKeys} from '@/lib/config';

export const runtime = 'nodejs';

export async function GET() {
  const keys = await loadKeys();
  return NextResponse.json({
    minimax: {
      configured: !!keys.minimax,
      masked: maskKey(keys.minimax),
    },
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<ApiKeys>;
  await saveKeys(body);
  const keys = await loadKeys();
  return NextResponse.json({
    minimax: {configured: !!keys.minimax, masked: maskKey(keys.minimax)},
  });
}
