import {NextRequest} from 'next/server';
import {createReadStream, promises as fs} from 'node:fs';
import {Readable} from 'node:stream';
import {getJob} from '@/lib/jobs';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const job = await getJob(id);
  if (!job?.output) return new Response('output not found', {status: 404});

  try {
    const stat = await fs.stat(job.output.path);
    const stream = createReadStream(job.output.path);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(stat.size),
        // inline 让 <video> 元素能直接播放；<a download> 自身的属性仍会触发下载行为
        'Content-Disposition': `inline; filename="${id}.mp4"`,
        'Accept-Ranges': 'bytes',
      },
    });
  } catch {
    return new Response('failed to read', {status: 500});
  }
}
