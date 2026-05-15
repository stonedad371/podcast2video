import {NextRequest} from 'next/server';
import {promises as fs} from 'node:fs';
import {getJob} from '@/lib/jobs';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const job = await getJob(id);
  if (!job?.cover) {
    return new Response('cover not found', {status: 404});
  }
  try {
    const data = await fs.readFile(job.cover.path);
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new Response('failed to read', {status: 500});
  }
}
