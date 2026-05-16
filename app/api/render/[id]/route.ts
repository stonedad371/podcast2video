import {NextRequest, NextResponse} from 'next/server';
import path from 'node:path';
import {promises as fs} from 'node:fs';
import {getJob, updateJob, OUTPUT_DIR, ensureDirs} from '@/lib/jobs';
import {renderVideo} from '@/lib/render';
import {ensureChapterImages} from '@/lib/chapter-images';
import {loadKeys, getBrand, getSubtitleOffset, getDefaultLayout} from '@/lib/config';
import {LAYOUT_DIMENSIONS} from '@/lib/jobs';
import type {PodcastProps} from '@/remotion/Composition';

export const runtime = 'nodejs';
export const maxDuration = 600;

function buildProps(
  job: Awaited<ReturnType<typeof getJob>>,
  baseUrl: string,
  brand: string,
  subtitleOffsetSec: number,
): PodcastProps {
  if (!job) throw new Error('no job');
  if (!job.cover) throw new Error('封面图还没生成，请先在主页生成封面');
  const audioExt = path.extname(job.audio.path).slice(1) || 'mp3';
  const srtExt = path.extname(job.srt.path).slice(1) || 'srt';
  const speakers: PodcastProps['speakers'] = {};
  const palette = ['#38bdf8', '#fbbf24', '#a855f7', '#4ade80'];
  job.srt.speakers.forEach((sp, i) => {
    speakers[sp] = {
      label: sp,
      color: palette[i % palette.length],
      align: i === 0 ? 'left' : 'right',
    };
  });
  return {
    audioSrc: `${baseUrl}/api/files/${job.id}/audio.${audioExt}`,
    srtSrc: `${baseUrl}/api/files/${job.id}/captions.${srtExt}`,
    coverSrc: `${baseUrl}/api/cover/${job.id}/image`,
    title: job.config.title,
    subtitle: job.config.subtitle,
    brand,
    accentColor: job.config.accentColor || '#fbbf24',
    speakers,
    // ASR 出的 SRT 通常比"开口听感"早 200-300ms，用户在设置里可调
    subtitleOffsetSec,
    // 线性拉伸让 SRT 末尾对齐音频末尾（避免末尾 ~1s 漂移）
    subtitleTimeScale: job.computed.subtitleTimeScale,
    chapters: job.config.chapters,
    // quotes 跟 cue 用同一时间轴 → 一起乘 scale 才能让 inQuote 判断不错位
    quotes: job.config.quotes.map((q) => ({
      ...q,
      fromSec: q.fromSec * job.computed.subtitleTimeScale,
      durationSec: q.durationSec * job.computed.subtitleTimeScale,
    })),
    chapterImageSrcs: job.config.chapters.map(
      (_, i) => `${baseUrl}/api/chapter-images/${job.id}/${i}/image`,
    ),
    posterDurationSec: 0.6, // 给平台抓首帧 + 用户视觉留一帧封面缓冲，不再硬切
    outroDurationSec: 5,
    audioDurationSec: job.audio.durationSec,
  };
}

export async function POST(req: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({error: 'job not found'}, {status: 404});
  if (job.render?.status === 'rendering' || job.render?.status === 'queued' || job.render?.status === 'bundling') {
    return NextResponse.json({error: '渲染已在进行中'}, {status: 409});
  }

  // Chromium 在 Remotion bundle 里 fetch 字幕/音频/封面。Docker 容器里 localhost:3010
  // （宿主机映射端口）从容器内访问不到，必须走容器内自己监听的 PORT。
  // 本地 dev 模式下 PORT 默认 3000，跟浏览器开的端口一致，也成立。
  const port = process.env.PORT || '3000';
  const origin = `http://127.0.0.1:${port}`;

  await ensureDirs();
  const outDir = path.join(OUTPUT_DIR, id);
  await fs.mkdir(outDir, {recursive: true});
  const outputPath = path.join(outDir, 'video.mp4');

  const brand = await getBrand();
  const subtitleOffsetSec = await getSubtitleOffset();
  // job 自带 layout 优先，否则用全局默认
  const layout = job.config.layout ?? (await getDefaultLayout());
  const compositionId = LAYOUT_DIMENSIONS[layout].compositionId;
  // 提前 build 一次仅为校验（封面是否就绪等）；后台 IIFE 里会重新读 job 再 build。
  try {
    buildProps(job, origin, brand, subtitleOffsetSec);
  } catch (err) {
    return NextResponse.json({error: (err as Error).message}, {status: 400});
  }

  const queuedAt = Date.now();
  await updateJob(id, {
    render: {
      status: 'queued',
      progress: 0,
      startedAt: queuedAt,
    },
  });

  // 后台跑（不阻塞响应）
  void (async () => {
    try {
      // 先生成所有章节图：缺图时 Chromium 会死循环 retry 卡住整个 render，
      // 所以这一步**必须**成功（或者整个 render 直接失败给用户明确反馈）。
      const keys = await loadKeys();
      // 用最新磁盘状态——队列入口后用户/外部可能 PATCH 过 chapters
      const freshJob = await getJob(id);
      if (!freshJob) throw new Error('job 在 render 启动前消失了');
      const chapterCount = freshJob.config.chapters.length;
      if (keys.minimax && chapterCount > 0) {
        await updateJob(id, (j) => ({
          render: {
            status: 'bundling',
            stage: 'images',
            progress: 0,
            startedAt: j.render?.startedAt ?? queuedAt,
          },
        }));
        await ensureChapterImages({
          job: freshJob,
          apiKey: keys.minimax,
          onProgress: async (done, total) => {
            await updateJob(id, (j) => ({
              render: {
                status: 'bundling',
                stage: 'images',
                progress: done / total,
                imagesDone: done,
                imagesTotal: total,
                startedAt: j.render?.startedAt ?? queuedAt,
              },
            }));
          },
        });
      }

      // 章节图齐了再用最新 job + chapters build inputProps，传给 Remotion
      const finalJob = await getJob(id);
      if (!finalJob) throw new Error('job 在 bundle 前消失了');
      const inputProps = buildProps(finalJob, origin, brand, subtitleOffsetSec);

      await updateJob(id, (j) => ({
        render: {
          status: 'bundling',
          stage: 'bundling',
          progress: 0,
          startedAt: j.render?.startedAt ?? queuedAt,
        },
      }));
      await renderVideo({
        inputProps,
        outputPath,
        compositionId,
        onProgress: async (stage, progress) => {
          // Remotion 不 await onProgress；最后一次 progress=1 回调可能晚于下面 status='done'
          // 那一步执行。guard 必须在 serialize 内基于最新磁盘状态做，否则 stale 读会失效。
          await updateJob(id, (j) => {
            if (j.render?.status === 'done' || j.render?.status === 'failed') return null;
            return {
              render: {
                ...(j.render ?? {startedAt: queuedAt, status: 'rendering' as const, progress: 0}),
                status: stage === 'bundling' ? 'bundling' : 'rendering',
                stage,
                progress,
              },
            };
          });
        },
      });
      const stat = await fs.stat(outputPath);
      await updateJob(id, (j) => ({
        output: {path: outputPath, sizeBytes: stat.size},
        render: {
          status: 'done',
          progress: 1,
          stage: 'rendering',
          startedAt: j.render?.startedAt ?? queuedAt,
          completedAt: Date.now(),
        },
      }));
    } catch (err) {
      await updateJob(id, (j) => ({
        render: {
          status: 'failed',
          progress: 0,
          startedAt: j.render?.startedAt ?? queuedAt,
          completedAt: Date.now(),
          error: (err as Error).message,
        },
      }));
    }
  })();

  return NextResponse.json({ok: true, jobId: id});
}
