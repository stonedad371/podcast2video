import {NextRequest, NextResponse} from 'next/server';
import {chatCompletion} from '@/lib/minimax-chat';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const {key} = (await req.json()) as {key: string};
  if (!key) return NextResponse.json({ok: false, error: '请填 key'}, {status: 400});

  // 一次性测两个端点：chat 和 image
  const errors: string[] = [];

  // 1. chat
  try {
    await chatCompletion({
      apiKey: key,
      messages: [{role: 'user', content: 'reply only: ok'}],
      maxTokens: 8,
      temperature: 0,
    });
  } catch (err) {
    errors.push(`文本生成：${(err as Error).message}`);
  }

  // 2. image — 直接调一次最小 prompt 看 base_resp
  try {
    const res = await fetch('https://api.minimaxi.com/v1/image_generation', {
      method: 'POST',
      headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({
        model: 'image-01',
        prompt: 'test',
        aspect_ratio: '1:1',
        n: 1,
        prompt_optimizer: false,
        response_format: 'url',
      }),
    });
    const data = await res.json();
    if (data.base_resp?.status_code !== 0) {
      errors.push(`图像生成：${data.base_resp?.status_msg ?? '未知错误'}`);
    }
  } catch (err) {
    errors.push(`图像生成：${(err as Error).message}`);
  }

  if (errors.length === 0) {
    return NextResponse.json({ok: true, message: '验证通过 · 文本 + 图像 端点都可用'});
  }
  return NextResponse.json(
    {ok: false, error: errors.join('；')},
    {status: 400},
  );
}
