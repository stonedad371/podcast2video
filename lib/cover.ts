import {promises as fs} from 'node:fs';
import path from 'node:path';

const MINIMAX_ENDPOINT = 'https://api.minimaxi.com/v1/image_generation';

const COVER_PROMPT_TEMPLATE = (title: string, subtitle?: string) => `
Cinematic dark editorial illustration symbolizing the theme: "${title}"${subtitle ? `, ${subtitle}` : ''}.

Abstract, evocative, NO text and NO people. Use moody dramatic lighting, deep navy background with crimson and gold accents. Editorial illustration style with subtle film grain. Strong vertical composition with a clear focal point.

Vertical 9:16 aspect ratio.
`.trim();

async function callMiniMaxImage(opts: {
  apiKey: string;
  prompt: string;
  responseFormat: 'url' | 'base64';
}) {
  const res = await fetch(MINIMAX_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'image-01',
      prompt: opts.prompt,
      aspect_ratio: '9:16',
      n: 1,
      prompt_optimizer: true,
      response_format: opts.responseFormat,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MiniMax HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    base_resp?: {status_code?: number; status_msg?: string};
    // 不同响应格式 / 文档版本会用不同字段名，下面在调用方兼容
    data?: Record<string, unknown>;
  };
  if (data.base_resp?.status_code !== 0) {
    throw new Error(`MiniMax: ${data.base_resp?.status_msg ?? '未知错误'}`);
  }
  return data.data ?? {};
}

function pickArrayField(d: Record<string, unknown>, keys: string[]): string[] | null {
  for (const k of keys) {
    const v = d[k];
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string') return v as string[];
  }
  return null;
}

// 通用 MiniMax 9:16 生图函数：传任意 prompt 出一张 jpg 到 outPath
// 优先用 url 模式（结构稳定），下载失败 fallback base64
export async function generateImage(opts: {
  apiKey: string;
  prompt: string;
  outPath: string;
}): Promise<{sizeBytes: number}> {
  const {apiKey, prompt, outPath} = opts;

  let buf: Buffer | null = null;

  // 路径 A：url 模式 + 服务端下载
  try {
    const data = await callMiniMaxImage({apiKey, prompt, responseFormat: 'url'});
    const urls = pickArrayField(data, ['image_urls', 'images_url', 'image_url']);
    if (!urls) {
      console.error('[minimax] url-mode unexpected response keys:', Object.keys(data));
      throw new Error('MiniMax url 模式：响应里没有 image_urls');
    }
    const imgRes = await fetch(urls[0]);
    if (!imgRes.ok) throw new Error(`下载图片失败 HTTP ${imgRes.status}`);
    buf = Buffer.from(await imgRes.arrayBuffer());
  } catch (errUrl) {
    console.warn('[minimax] url-mode failed, falling back to base64:', errUrl);
    // 路径 B：base64 模式，兼容多种可能的字段名
    const data = await callMiniMaxImage({apiKey, prompt, responseFormat: 'base64'});
    const b64Arr = pickArrayField(data, [
      'image_base64',
      'images_base64',
      'image_b64',
      'images_b64',
      'b64_json',
    ]);
    if (!b64Arr) {
      console.error('[minimax] base64-mode unexpected response keys:', Object.keys(data));
      throw new Error(
        `MiniMax base64 模式：响应里没有 image_base64（实际字段：${Object.keys(data).join(', ')}）`,
      );
    }
    buf = Buffer.from(b64Arr[0], 'base64');
  }

  await fs.mkdir(path.dirname(outPath), {recursive: true});
  await fs.writeFile(outPath, buf);
  return {sizeBytes: buf.length};
}

export async function generateCover(opts: {
  apiKey: string;
  title: string;
  subtitle?: string;
  outPath: string;
}): Promise<{prompt: string; sizeBytes: number}> {
  const {apiKey, title, subtitle, outPath} = opts;
  const prompt = COVER_PROMPT_TEMPLATE(title, subtitle);
  const {sizeBytes} = await generateImage({apiKey, prompt, outPath});
  return {prompt, sizeBytes};
}
