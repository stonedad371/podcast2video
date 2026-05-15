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
      response_format: 'url',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MiniMax HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    base_resp?: {status_code?: number; status_msg?: string};
    data?: {image_urls?: string[]};
  };
  if (data.base_resp?.status_code !== 0) {
    throw new Error(`MiniMax: ${data.base_resp?.status_msg ?? '未知错误'}`);
  }
  const url = data.data?.image_urls?.[0];
  if (!url) throw new Error('MiniMax 没返回 image_urls');

  // 下载图片
  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`下载图片失败 HTTP ${imgRes.status}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  await fs.mkdir(path.dirname(outPath), {recursive: true});
  await fs.writeFile(outPath, buf);

  return {prompt, sizeBytes: buf.length};
}
