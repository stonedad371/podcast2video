'use client';

import {useEffect, useState} from 'react';
import {UploadZone, type UploadResult} from './components/UploadZone';
import {JobSummary} from './components/JobSummary';
import {SettingsModal} from './components/SettingsModal';
import {Preview} from './components/Preview';
import {RenderPanel} from './components/RenderPanel';
import type {PodcastProps} from '@/remotion/Composition';

type ConfigState = {
  minimax: {configured: boolean; masked: string | null};
  brand: string;
};

export default function Home() {
  const [job, setJob] = useState<UploadResult | null>(null);
  const [fullJob, setFullJob] = useState<FullJob | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshConfig = () =>
    fetch('/api/config')
      .then((r) => r.json())
      .then(setConfig);

  useEffect(() => {
    refreshConfig();
  }, []);

  // 上传完成后自动分析 + 生封面（基于 key 配置）
  useEffect(() => {
    if (!job || !config) return;
    const run = async () => {
      setError(null);
      // 先把基础 job 信息显示出来
      const initial = await fetch(`/api/job/${job.id}`).then((r) => r.json());
      setFullJob(initial.job);

      if (config.minimax.configured) {
        setAnalyzing(true);
        let analyzeOk = false;
        try {
          const res = await fetch(`/api/analyze/${job.id}`, {method: 'POST'});
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || '分析失败');
          setFullJob(data.job);
          analyzeOk = true;
        } catch (e) {
          // 网络 fetch failed 时后端 analyze 可能已经跑完。重新拉一次 job，
          // 如果已经写好了 chapters 就当成功（避免误报错）。
          try {
            const recheck = await fetch(`/api/job/${job.id}`).then((r) => r.json());
            if (recheck.job?.config?.chapters?.length > 0) {
              setFullJob(recheck.job);
              analyzeOk = true;
            } else {
              setError(`自动分析失败：${(e as Error).message}`);
            }
          } catch {
            setError(`自动分析失败：${(e as Error).message}`);
          }
        } finally {
          setAnalyzing(false);
        }
        if (!analyzeOk) return;

        setGeneratingCover(true);
        let coverOk = false;
        try {
          const res = await fetch(`/api/cover/${job.id}`, {method: 'POST'});
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || '生封面失败');
          setFullJob(data.job);
          coverOk = true;
        } catch (e) {
          setError((prev) =>
            prev ? `${prev}；封面失败：${(e as Error).message}` : `封面失败：${(e as Error).message}`,
          );
        } finally {
          setGeneratingCover(false);
        }

        // 前序都成功 + 用户在设置里开了"自动渲染" → 直接触发渲染
        if (coverOk && localStorage.getItem('autoRender') === 'true') {
          try {
            await fetch(`/api/render/${job.id}`, {method: 'POST'});
            // RenderPanel 自己会轮询 status，不需要再 setFullJob
          } catch (e) {
            setError((prev) =>
              prev ? `${prev}；自动渲染启动失败：${(e as Error).message}` : `自动渲染启动失败：${(e as Error).message}`,
            );
          }
        }
      }
    };
    run();
  }, [job, config]);

  const reset = () => {
    setJob(null);
    setFullJob(null);
    setError(null);
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 24px 48px',
        gap: 24,
      }}
    >
      {/* 顶部工具栏 */}
      <header
        style={{
          width: '100%',
          maxWidth: 960,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <a
          href="https://podcast.cab"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 20,
            color: '#fbbf24',
            fontWeight: 800,
            letterSpacing: 1,
            textDecoration: 'none',
            fontFamily: '"SF Mono", Menlo, monospace',
          }}
        >
          podcast.cab
        </a>
        <button
          onClick={() => setSettingsOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid #374151',
            borderRadius: 999,
            color: '#cbd5e1',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          ⚙️ 设置
          {config && (
            <span style={{color: config.minimax.configured ? '#a7f3d0' : '#9ca3af', fontSize: 11}}>
              {config.minimax.configured ? '已配置' : '未配置'}
            </span>
          )}
        </button>
      </header>

      {!job ? (
        <>
          <h1
            style={{
              fontSize: 56,
              fontWeight: 800,
              lineHeight: 1.15,
              textAlign: 'center',
              maxWidth: 900,
              marginTop: 16,
            }}
          >
            把播客做成可发布的视频
          </h1>
          <p
            style={{
              color: '#9ca3af',
              fontSize: 18,
              textAlign: 'center',
              maxWidth: 720,
              lineHeight: 1.6,
            }}
          >
            上传音频和 SRT 字幕，自动生成带封面、章节卡、金句、进度条的 9:16 短视频。
          </p>

          <UploadZone onUploaded={setJob} />

          <section
            style={{
              maxWidth: 720,
              padding: '16px 24px',
              backgroundColor: 'rgba(251, 191, 36, 0.06)',
              border: '1px solid rgba(251, 191, 36, 0.2)',
              borderRadius: 12,
              textAlign: 'center',
              fontSize: 14,
              color: '#cbd5e1',
              lineHeight: 1.6,
            }}
          >
            没有播客音频和字幕？推荐用{' '}
            <a
              href="https://yuban.yun/?ref=52UM5HD3"
              target="_blank"
              rel="noopener noreferrer"
              style={{color: '#fbbf24', textDecoration: 'underline', fontWeight: 700}}
            >
              yuban.yun
            </a>{' '}
            一键生成播客音频与时间戳字幕。
          </section>
        </>
      ) : (
        <div style={{width: '100%', maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 24}}>
          <JobSummary job={job} hasKey={config?.minimax.configured ?? false} />

          <AnalysisProgress
            analyzing={analyzing}
            generatingCover={generatingCover}
            hasKey={config?.minimax.configured ?? false}
            onOpenSettings={() => setSettingsOpen(true)}
          />

          {fullJob && <ChaptersAndQuotes job={fullJob} />}

          {fullJob?.cover && (
            <CoverPreview job={fullJob} brand={config?.brand ?? 'podcast.cab'} />
          )}

          {fullJob &&
            (() => {
              const previewProps = buildPreviewProps(fullJob, config?.brand ?? 'podcast.cab');
              return previewProps ? <Preview props={previewProps} /> : null;
            })()}

          {fullJob && (
            <RenderPanel jobId={fullJob.id} canRender={!!fullJob.cover} />
          )}

          {error && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 10,
                color: '#fca5a5',
                fontSize: 14,
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <button
            onClick={reset}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              border: '1px solid #374151',
              borderRadius: 10,
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: 14,
              alignSelf: 'flex-start',
            }}
          >
            ← 上传新文件
          </button>
        </div>
      )}

      <footer
        style={{
          marginTop: 'auto',
          paddingTop: 48,
          color: '#6b7280',
          fontSize: 14,
          textAlign: 'center',
          letterSpacing: 1,
        }}
      >
        <div>
          <a
            href="https://podcast.cab"
            target="_blank"
            rel="noopener noreferrer"
            style={{color: '#fbbf24', fontWeight: 700, fontFamily: '"SF Mono", Menlo, monospace'}}
          >
            podcast.cab
          </a>{' '}
          · 技术支持：
          <a
            href="https://yuban.yun/?ref=52UM5HD3"
            target="_blank"
            rel="noopener noreferrer"
            style={{color: '#fbbf24', fontWeight: 600}}
          >
            yuban.yun
          </a>
        </div>
      </footer>

      <SettingsModal
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          refreshConfig();
        }}
      />
    </main>
  );
}

type FullJob = {
  id: string;
  audio: {filename: string; durationSec: number};
  srt: {filename: string; speakers: string[]};
  computed: {subtitleTimeScale: number};
  config: {
    title: string;
    subtitle: string;
    accentColor: string;
    chapters: {atSec: number; title: string; imagePrompt?: string}[];
    quotes: {fromSec: number; durationSec: number; text: string}[];
    hook?: {number: string; text: string};
  };
  cover?: {path: string; sizeBytes: number};
};

function buildPreviewProps(job: FullJob, brand: string): PodcastProps | null {
  if (!job.cover) return null;
  const audioExt = job.audio.filename.split('.').pop() || 'mp3';
  const srtExt = job.srt.filename.split('.').pop() || 'srt';
  const speakers: PodcastProps['speakers'] = {};
  // 默认 主持/嘉宾 双人配色
  const palette = ['#38bdf8', '#fbbf24', '#a855f7', '#4ade80'];
  job.srt.speakers.forEach((sp, i) => {
    speakers[sp] = {
      label: sp,
      color: palette[i % palette.length],
      align: i === 0 ? 'left' : 'right',
    };
  });
  return {
    audioSrc: `/api/files/${job.id}/audio.${audioExt}`,
    srtSrc: `/api/files/${job.id}/captions.${srtExt}`,
    coverSrc: `/api/cover/${job.id}/image`,
    title: job.config.title,
    subtitle: job.config.subtitle,
    brand,
    accentColor: job.config.accentColor || '#fbbf24',
    speakers,
    subtitleOffsetSec: 0,
    subtitleTimeScale: job.computed.subtitleTimeScale,
    hook: job.config.hook ?? {number: '', text: ''},
    chapters: job.config.chapters,
    chapterImageSrcs: job.config.chapters.map(
      (_, i) => `/api/chapter-images/${job.id}/${i}/image`,
    ),
    quotes: job.config.quotes,
    hookDurationSec: job.config.hook ? 3 : 0,
    posterDurationSec: 1.0,
    introDurationSec: 5,
    outroDurationSec: 5,
    audioDurationSec: job.audio.durationSec,
  };
}

function AnalysisProgress({
  analyzing,
  generatingCover,
  hasKey,
  onOpenSettings,
}: {
  analyzing: boolean;
  generatingCover: boolean;
  hasKey: boolean;
  onOpenSettings: () => void;
}) {
  if (!hasKey) {
    return (
      <div
        style={{
          padding: 20,
          background: 'rgba(239,68,68,0.06)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 12,
          color: '#fca5a5',
          fontSize: 14,
          textAlign: 'center',
        }}
      >
        没配 MiniMax API key，自动章节 / 金句 / 封面都跳过了。{' '}
        <button
          onClick={onOpenSettings}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fbbf24',
            cursor: 'pointer',
            textDecoration: 'underline',
            fontSize: 14,
          }}
        >
          去配置
        </button>
      </div>
    );
  }
  if (!analyzing && !generatingCover) return null;
  return (
    <div
      style={{
        padding: 16,
        background: 'rgba(251,191,36,0.08)',
        border: '1px solid rgba(251,191,36,0.3)',
        borderRadius: 12,
        color: '#fde68a',
        fontSize: 14,
        display: 'flex',
        gap: 16,
        alignItems: 'center',
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          border: '3px solid rgba(251,191,36,0.25)',
          borderTopColor: '#fbbf24',
          borderRadius: '50%',
          animation: 'spin 0.9s linear infinite',
          flexShrink: 0,
        }}
      />
      <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
        {analyzing && (
          <div>
            🤖 LLM 分析中：切章节 + 挑金句…
            <span style={{color: '#9ca3af', fontSize: 12, marginLeft: 8}}>
              通常 15-40 秒，请耐心等
            </span>
          </div>
        )}
        {generatingCover && (
          <div>
            🎨 LLM 生成封面中…
            <span style={{color: '#9ca3af', fontSize: 12, marginLeft: 8}}>
              约 15-30 秒
            </span>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ChaptersAndQuotes({job}: {job: FullJob}) {
  const {chapters, quotes} = job.config;
  if (chapters.length === 0 && quotes.length === 0) return null;
  return (
    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16}}>
      <Panel title={`章节 (${chapters.length})`}>
        {chapters.length > 0 ? (
          chapters.map((c, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 12,
                padding: '10px 0',
                borderBottom: '1px solid #1f2937',
                fontSize: 14,
              }}
            >
              <span
                style={{
                  color: '#fbbf24',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  minWidth: 70,
                }}
              >
                {fmt(c.atSec)}
              </span>
              <span style={{color: '#e5e7eb', flex: 1}}>{c.title}</span>
            </div>
          ))
        ) : (
          <div style={{color: '#6b7280', fontSize: 13}}>暂无章节</div>
        )}
      </Panel>
      <Panel title={`金句 (${quotes.length})`}>
        {quotes.length > 0 ? (
          quotes.map((q, i) => (
            <div
              key={i}
              style={{
                padding: '10px 0',
                borderBottom: '1px solid #1f2937',
                fontSize: 13,
              }}
            >
              <div
                style={{
                  color: '#fbbf24',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                {fmt(q.fromSec)} · {q.durationSec.toFixed(1)}s
              </div>
              <div style={{color: '#e5e7eb', whiteSpace: 'pre-wrap'}}>{q.text}</div>
            </div>
          ))
        ) : (
          <div style={{color: '#6b7280', fontSize: 13}}>暂无金句</div>
        )}
      </Panel>
    </div>
  );
}

function CoverPreview({job, brand}: {job: FullJob; brand: string}) {
  const accentColor = job.config.accentColor || '#fbbf24';
  const title = job.config.title || '播客标题';
  const subtitle = job.config.subtitle || '';

  // 模拟视频第一帧（VPoster 的迷你版本）：1080x1920 → 220x391，等比 ≈ 1:4.9
  return (
    <Panel title="AI 生成封面（视频第一帧预览）">
      <div style={{display: 'flex', gap: 20, alignItems: 'flex-start'}}>
        <div
          style={{
            position: 'relative',
            width: 220,
            height: 391,
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid #374151',
            background: '#06090f',
            flexShrink: 0,
          }}
        >
          <img
            src={`/api/cover/${job.id}/image?ts=${Date.now()}`}
            alt="cover"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.85,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(6,9,15,0.4) 0%, rgba(6,9,15,0.15) 35%, rgba(6,9,15,0.55) 65%, rgba(6,9,15,0.95) 100%)',
            }}
          />
          {/* 顶栏 ● REC / brand —— 对应 VPoster top=110 */}
          <div
            style={{
              position: 'absolute',
              top: 22,
              left: 12,
              right: 12,
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 7,
              letterSpacing: 1.5,
              fontFamily: '"SF Mono", Menlo, monospace',
              textTransform: 'uppercase',
            }}
          >
            <span style={{color: '#f87171'}}>● REC</span>
            <span style={{color: accentColor, fontWeight: 700}}>{brand}</span>
          </div>
          {/* 中间标题 / 副标题 */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '0 14px',
              fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
            }}
          >
            <div
              style={{
                color: accentColor,
                fontSize: 8,
                letterSpacing: 1.5,
                fontWeight: 800,
                marginBottom: 8,
                fontFamily: '"SF Mono", Menlo, monospace',
              }}
            >
              {brand}
            </div>
            <div
              style={{
                color: '#fff',
                fontSize: 26,
                fontWeight: 800,
                lineHeight: 1.1,
                textAlign: 'center',
                textShadow: '0 2px 12px rgba(0,0,0,0.75)',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {title}
            </div>
            {subtitle && (
              <div
                style={{
                  color: '#e5e7eb',
                  fontSize: 11,
                  marginTop: 8,
                  letterSpacing: 1,
                  textAlign: 'center',
                  textShadow: '0 1px 6px rgba(0,0,0,0.7)',
                }}
              >
                {subtitle}
              </div>
            )}
            <div
              style={{
                width: 36,
                height: 2,
                backgroundColor: accentColor,
                marginTop: 12,
                boxShadow: `0 0 8px ${accentColor}`,
              }}
            />
          </div>
        </div>
        <div style={{flex: 1, color: '#9ca3af', fontSize: 13, lineHeight: 1.6}}>
          视频第一帧预览：标题 / 副标题 / 品牌都会叠在这张 AI 图上。
          <br />
          <br />
          想改标题或副标题：在上传时填，或留空让 LLM 自动生成。
          <br />
          想改品牌：右上角 ⚙️ 设置。
        </div>
      </div>
    </Panel>
  );
}

function Panel({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <div
      style={{
        padding: 20,
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid #1f2937',
        borderRadius: 12,
      }}
    >
      <div
        style={{
          color: '#cbd5e1',
          fontSize: 14,
          fontWeight: 700,
          marginBottom: 12,
          letterSpacing: 2,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function fmt(sec: number) {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
