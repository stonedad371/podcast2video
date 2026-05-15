import {NextRequest, NextResponse} from 'next/server';
import {getJob} from '@/lib/jobs';
import {loadKeys} from '@/lib/config';
import {ensureChapterImages} from '@/lib/chapter-images';

export const runtime = 'nodejs';
export const maxDuration = 600;

// GET：把当前 job 的每章 imageStatus 汇总返回，供 UI 轮询
export async function GET(_req: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({error: 'job not found'}, {status: 404});
  return NextResponse.json({
    chapters: job.config.chapters.map((c, i) => ({
      index: i,
      title: c.title,
      status: c.imageStatus ?? 'pending',
      hint: c.imageHint ?? '',
      prompt: c.imagePrompt ?? '',
      error: c.imageError,
    })),
  });
}

// POST：批量为所有 imageStatus !== 'done' 的章节生图（分析后自动触发；重复调安全）
export async function POST(_req: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({error: 'job not found'}, {status: 404});

  const keys = await loadKeys();
  if (!keys.minimax) {
    return NextResponse.json({error: '未配置 MiniMax API key'}, {status: 412});
  }
  if (job.config.chapters.length === 0) {
    return NextResponse.json({error: '没有章节，请先分析'}, {status: 400});
  }

  // 后台跑，立即返回。前端轮询 GET 拿状态。
  void ensureChapterImages({job, apiKey: keys.minimax}).catch((err) => {
    console.error('[chapter-images] batch failed:', err);
  });

  return NextResponse.json({ok: true, total: job.config.chapters.length});
}
