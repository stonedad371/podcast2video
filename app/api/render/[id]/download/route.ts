import {NextRequest} from 'next/server';
import {getJob} from '@/lib/jobs';
import {streamFileResponse} from '@/lib/http-stream';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const job = await getJob(id);
  if (!job?.output) return new Response('output not found', {status: 404});

  return streamFileResponse({
    filePath: job.output.path,
    contentType: 'video/mp4',
    rangeHeader: req.headers.get('range'),
    extraHeaders: {
      // inline 让 <video> 元素能直接播放；<a download> 自身的属性仍会触发下载
      'Content-Disposition': `inline; filename="${id}.mp4"`,
    },
  });
}
