import {NextRequest, NextResponse} from 'next/server';
import path from 'node:path';
import {getJob, updateJob, jobUploadDir} from '@/lib/jobs';
import {loadKeys} from '@/lib/config';
import {generateCover} from '@/lib/cover';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(_req: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({error: 'job not found'}, {status: 404});

  const keys = await loadKeys();
  if (!keys.minimax) {
    return NextResponse.json(
      {error: '未配置图像 LLM API key，请在设置里填入'},
      {status: 412},
    );
  }

  try {
    const outPath = path.join(jobUploadDir(id), 'cover.jpg');
    const {sizeBytes} = await generateCover({
      apiKey: keys.minimax,
      title: job.config.title,
      subtitle: job.config.subtitle,
      outPath,
    });
    const updated = await updateJob(id, {
      cover: {path: outPath, sizeBytes},
    });
    return NextResponse.json({job: updated});
  } catch (err) {
    return NextResponse.json(
      {error: `生成封面失败：${(err as Error).message}`},
      {status: 500},
    );
  }
}
