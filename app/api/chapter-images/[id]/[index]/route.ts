import {NextRequest, NextResponse} from 'next/server';
import {getJob} from '@/lib/jobs';
import {loadKeys} from '@/lib/config';
import {generateOneChapterImage} from '@/lib/chapter-images';

export const runtime = 'nodejs';
export const maxDuration = 180;

// POST：单张章节图重新生成（强制走 LLM 综合产新 imagePrompt，再调 image-01）
// body: { hint?: string }  —— 用户给的中文/英文补充提示，可空
export async function POST(
  req: NextRequest,
  {params}: {params: Promise<{id: string; index: string}>},
) {
  const {id, index} = await params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({error: 'job not found'}, {status: 404});

  const idx = Number.parseInt(index, 10);
  if (!Number.isInteger(idx) || idx < 0 || idx >= job.config.chapters.length) {
    return NextResponse.json({error: '章节越界'}, {status: 400});
  }
  const ch = job.config.chapters[idx];
  if (ch.imageStatus === 'generating') {
    return NextResponse.json({error: '这一章正在生成中，请稍等'}, {status: 409});
  }

  const keys = await loadKeys();
  if (!keys.minimax) {
    return NextResponse.json({error: '未配置 MiniMax API key'}, {status: 412});
  }

  const body = (await req.json().catch(() => ({}))) as {hint?: string};

  void generateOneChapterImage({
    jobId: id,
    index: idx,
    apiKey: keys.minimax,
    regenerate: true,
    hint: body.hint,
  }).catch((err) => {
    console.error(`[chapter-images] regenerate ${idx} failed:`, err);
  });

  return NextResponse.json({ok: true, index: idx});
}
