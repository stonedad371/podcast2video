'use client';

import {useEffect, useState} from 'react';

type RenderState = {
  status: 'queued' | 'bundling' | 'rendering' | 'done' | 'failed';
  progress: number;
  stage?: 'bundling' | 'rendering';
  startedAt: number;
  completedAt?: number;
  error?: string;
};

type StatusResponse = {
  render: RenderState | null;
  output: {sizeBytes: number} | null;
};

export function RenderPanel({jobId, canRender}: {jobId: string; canRender: boolean}) {
  const [state, setState] = useState<StatusResponse | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // 初次加载状态
  useEffect(() => {
    fetch(`/api/render/${jobId}/status`)
      .then((r) => r.json())
      .then(setState);
  }, [jobId]);

  // 渲染中轮询
  useEffect(() => {
    if (!state?.render) return;
    const s = state.render.status;
    if (s === 'done' || s === 'failed') return;
    const t = setInterval(async () => {
      const next = await fetch(`/api/render/${jobId}/status`).then((r) => r.json());
      setState(next);
      if (next.render?.status === 'done' || next.render?.status === 'failed') {
        clearInterval(t);
      }
    }, 1500);
    return () => clearInterval(t);
  }, [jobId, state]);

  const start = async () => {
    setStartError(null);
    setStarting(true);
    try {
      const res = await fetch(`/api/render/${jobId}`, {method: 'POST'});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '启动渲染失败');
      const next = await fetch(`/api/render/${jobId}/status`).then((r) => r.json());
      setState(next);
    } catch (err) {
      setStartError((err as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const isRunning =
    state?.render?.status === 'queued' ||
    state?.render?.status === 'bundling' ||
    state?.render?.status === 'rendering';

  return (
    <div
      style={{
        padding: 24,
        background: 'rgba(251, 191, 36, 0.06)',
        border: '1px solid rgba(251, 191, 36, 0.25)',
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div>
          <div style={{color: '#fbbf24', fontSize: 14, letterSpacing: 4, fontWeight: 700}}>
            生成视频
          </div>
          <div style={{color: '#9ca3af', fontSize: 13, marginTop: 4}}>
            服务端渲染，4 分钟视频约 3–5 分钟
          </div>
        </div>
        {!isRunning && (
          <button
            onClick={start}
            disabled={!canRender || starting}
            style={{
              padding: '14px 28px',
              background:
                !canRender || starting
                  ? '#4b5563'
                  : state?.render?.status === 'done'
                    ? 'rgba(74,222,128,0.15)'
                    : 'linear-gradient(90deg, #fbbf24, #f59e0b)',
              border:
                state?.render?.status === 'done' ? '1px solid rgba(74,222,128,0.4)' : 'none',
              borderRadius: 12,
              color: state?.render?.status === 'done' ? '#a7f3d0' : '#0b0f17',
              fontSize: 16,
              fontWeight: 800,
              cursor: !canRender || starting ? 'not-allowed' : 'pointer',
              letterSpacing: 2,
            }}
          >
            {starting
              ? '启动中…'
              : state?.render?.status === 'done'
                ? '重新生成'
                : !canRender
                  ? '先准备好封面'
                  : '🎬 开始生成'}
          </button>
        )}
      </div>

      {startError && (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 10,
            color: '#fca5a5',
            fontSize: 13,
          }}
        >
          ⚠️ {startError}
        </div>
      )}

      {state?.render && state.render.status !== 'done' && state.render.status !== 'failed' && (
        <ProgressView render={state.render} />
      )}

      {state?.render?.status === 'failed' && (
        <div
          style={{
            padding: '12px 16px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 10,
            color: '#fca5a5',
            fontSize: 14,
          }}
        >
          ✗ 渲染失败：{state.render.error || '未知错误'}
        </div>
      )}

      {state?.render?.status === 'done' && state.output && (
        <DoneView jobId={jobId} sizeBytes={state.output.sizeBytes} />
      )}
    </div>
  );
}

function ProgressView({render}: {render: RenderState}) {
  const pct = Math.round(render.progress * 100);
  const label =
    render.status === 'queued'
      ? '排队中…'
      : render.status === 'bundling'
        ? '打包前端代码…'
        : `渲染中 ${pct}%`;
  const elapsed = ((Date.now() - render.startedAt) / 1000).toFixed(0);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          color: '#cbd5e1',
          fontSize: 13,
          marginBottom: 8,
        }}
      >
        <span>{label}</span>
        <span style={{fontFamily: 'monospace'}}>已用 {elapsed}s</span>
      </div>
      <div
        style={{
          height: 8,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #fbbf24, #f59e0b)',
            transition: 'width 0.3s',
          }}
        />
      </div>
    </div>
  );
}

function DoneView({jobId, sizeBytes}: {jobId: string; sizeBytes: number}) {
  const sizeMB = (sizeBytes / 1024 / 1024).toFixed(1);
  return (
    <div
      style={{
        padding: 16,
        background: 'rgba(74,222,128,0.08)',
        border: '1px solid rgba(74,222,128,0.3)',
        borderRadius: 12,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div>
        <div style={{color: '#a7f3d0', fontSize: 16, fontWeight: 700}}>✓ 生成完毕</div>
        <div style={{color: '#9ca3af', fontSize: 13, marginTop: 4}}>视频大小 {sizeMB} MB</div>
      </div>
      <a
        href={`/api/render/${jobId}/download`}
        download={`${jobId}.mp4`}
        style={{
          padding: '12px 24px',
          background: '#4ade80',
          color: '#0b0f17',
          borderRadius: 10,
          textDecoration: 'none',
          fontWeight: 700,
          letterSpacing: 1,
        }}
      >
        ⬇ 下载 MP4
      </a>
    </div>
  );
}
