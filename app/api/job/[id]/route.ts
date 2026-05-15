import {NextRequest, NextResponse} from 'next/server';
import {getJob, updateJob, type Chapter, type Quote} from '@/lib/jobs';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({error: 'not found'}, {status: 404});
  return NextResponse.json({job});
}

// 客户端只允许改 config 里的展示字段。
// 不能让客户端 PATCH job.cover.path / job.output.path / job.audio.path 等——
// 那些字段被 file/cover/download 路由直接拿去 readFile，能造成任意文件读取。
type AllowedConfigPatch = Partial<{
  title: string;
  subtitle: string;
  accentColor: string;
  chapters: Chapter[];
  quotes: Quote[];
}>;

function sanitizeConfig(input: unknown): AllowedConfigPatch | null {
  if (!input || typeof input !== 'object') return null;
  const src = input as Record<string, unknown>;
  const out: AllowedConfigPatch = {};
  if (typeof src.title === 'string') out.title = src.title;
  if (typeof src.subtitle === 'string') out.subtitle = src.subtitle;
  if (typeof src.accentColor === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(src.accentColor)) {
    out.accentColor = src.accentColor;
  }
  if (Array.isArray(src.chapters)) {
    out.chapters = src.chapters
      .filter((c): c is Chapter =>
        !!c && typeof (c as Chapter).atSec === 'number' && typeof (c as Chapter).title === 'string',
      )
      .map((c) => ({
        atSec: c.atSec,
        title: c.title,
        ...(typeof c.imagePrompt === 'string' ? {imagePrompt: c.imagePrompt} : {}),
      }));
  }
  if (Array.isArray(src.quotes)) {
    out.quotes = src.quotes.filter(
      (q): q is Quote =>
        !!q &&
        typeof (q as Quote).fromSec === 'number' &&
        typeof (q as Quote).durationSec === 'number' &&
        typeof (q as Quote).text === 'string',
    );
  }
  return out;
}

export async function PATCH(req: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const body = (await req.json()) as {config?: unknown};
  const configPatch = sanitizeConfig(body?.config);
  if (!configPatch) {
    return NextResponse.json({error: 'PATCH 只允许更新 config 下的展示字段'}, {status: 400});
  }
  const job = await updateJob(id, (j) => ({
    config: {...j.config, ...configPatch},
  }));
  if (!job) return NextResponse.json({error: 'not found'}, {status: 404});
  return NextResponse.json({job});
}
