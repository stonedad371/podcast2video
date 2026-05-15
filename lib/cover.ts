import {promises as fs} from 'node:fs';
import path from 'node:path';

const MINIMAX_ENDPOINT = 'https://api.minimaxi.com/v1/image_generation';

const COVER_PROMPT_TEMPLATE = (title: string, subtitle?: string) => `
Cinematic dark editorial illustration symbolizing the theme: "${title}"${subtitle ? `, ${subtitle}` : ''}.

Abstract, evocative, NO text and NO people. Use moody dramatic lighting, deep navy background with crimson and gold accents. Editorial illustration style with subtle film grain. Strong vertical composition with a clear focal point.

Vertical 9:16 aspect ratio.
`.trim();

export async function generateCover(opts: {
  apiKey: string;
  title: string;
  subtitle?: string;
  outPath: string;
}): Promise<{prompt: string; sizeBytes: number}> {
  const {apiKey, title, subtitle, outPath} = opts;
  const prompt = COVER_PROMPT_TEMPLATE(title, subtitle);

  const res = await fetch(MINIMAX_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'image-01',
      prompt,
      aspect_ratio: '9:16',
      n: 1,
      prompt_optimizer: true,
      // 直接拿 base64 避开 cdn.minimax.chat 二次下载（容器内 DNS 不通过它）
      response_format: 'base64',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MiniMax HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    base_resp?: {status_code?: number; status_msg?: string};
    data?: {image_base64?: string[]};
  };
  if (data.base_resp?.status_code !== 0) {
    throw new Error(`MiniMax: ${data.base_resp?.status_msg ?? '未知错误'}`);
  }
  const b64 = data.data?.image_base64?.[0];
  if (!b64) throw new Error('MiniMax 没返回 image_base64');

  const buf = Buffer.from(b64, 'base64');
  await fs.mkdir(path.dirname(outPath), {recursive: true});
  await fs.writeFile(outPath, buf);

  return {prompt, sizeBytes: buf.length};
}
