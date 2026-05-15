import {NextRequest, NextResponse} from 'next/server';
import {promises as fs} from 'node:fs';
import {getJob, updateJob} from '@/lib/jobs';
import {parseSrt} from '@/lib/parseSrt';
import {loadKeys} from '@/lib/config';
import {analyzeWithLLM} from '@/lib/analyze';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(_req: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({error: 'job not found'}, {status: 404});

  const keys = await loadKeys();
  if (!keys.minimax) {
    return NextResponse.json(
      {error: '未配置 MiniMax API key，请在设置里填入'},
      {status: 412},
    );
  }

  try {
    const srtText = await fs.readFile(job.srt.path, 'utf-8');
    const cues = parseSrt(srtText);
    const result = await analyzeWithLLM({
      apiKey: keys.minimax,
      cues,
      title: job.config.title,
      subtitle: job.config.subtitle,
    });

    // 仅在用户没填时用 LLM 自动产的兜底（尊重用户输入）
    const finalTitle = job.config.title?.trim() ? job.config.title : result.title;
    const finalSubtitle = job.config.subtitle?.trim() ? job.config.subtitle : result.subtitle;

    const updated = await updateJob(id, {
      config: {
        ...job.config,
        title: finalTitle,
        subtitle: finalSubtitle,
        chapters: result.chapters,
        quotes: result.quotes,
      },
    });

    return NextResponse.json({job: updated});
  } catch (err) {
    return NextResponse.json(
      {error: `分析失败：${(err as Error).message}`},
      {status: 500},
    );
  }
}
