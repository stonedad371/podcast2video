import {NextRequest, NextResponse} from 'next/server';
import {getJob} from '@/lib/jobs';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({error: 'job not found'}, {status: 404});
  return NextResponse.json({
    render: job.render ?? null,
    output: job.output ?? null,
  });
}
