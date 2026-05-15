import {NextRequest} from 'next/server';
import {createReadStream, promises as fs} from 'node:fs';
import {Readable} from 'node:stream';
import {chapterImagePath} from '@/lib/chapter-images';
import {getJob} from '@/lib/jobs';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  {params}: {params: Promise<{id: string; index: string}>},
) {
  const {id, index} = await params;
  const job = await getJob(id);
  if (!job) return new Response('job not found', {status: 404});

  const idx = Number.parseInt(index, 10);
  if (!Number.isInteger(idx) || idx < 0 || idx >= job.config.chapters.length) {
    return new Response('bad index', {status: 400});
  }

  const p = chapterImagePath(id, idx);
  try {
    const stat = await fs.stat(p);
    const stream = createReadStream(p);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(stat.size),
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new Response('chapter image not found', {status: 404});
  }
}
