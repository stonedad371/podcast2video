import {NextRequest, NextResponse} from 'next/server';
import {getJob, updateJob} from '@/lib/jobs';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({error: 'not found'}, {status: 404});
  return NextResponse.json({job});
}

export async function PATCH(req: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const patch = await req.json();
  const job = await updateJob(id, patch);
  if (!job) return NextResponse.json({error: 'not found'}, {status: 404});
  return NextResponse.json({job});
}
