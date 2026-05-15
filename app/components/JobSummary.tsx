'use client';

import type {UploadResult} from './UploadZone';

const fmtSec = (sec: number) => {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}分${String(r).padStart(2, '0')}秒`;
};

const fmtMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function JobSummary({job, hasKey}: {job: UploadResult; hasKey: boolean}) {
  const drift = (job.computed.subtitleTimeScale - 1) * 100;
  const driftText =
    Math.abs(drift) < 0.05
      ? '几乎无漂移，无需修正'
      : `${drift > 0 ? '字幕慢' : '字幕快'}约 ${Math.abs(drift).toFixed(2)}%`;

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 720,
        padding: 32,
        background: 'rgba(74,222,128,0.06)',
        border: '1px solid rgba(74,222,128,0.25)',
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <span style={{fontSize: 28}}>✅</span>
        <div>
          <div style={{color: '#a7f3d0', fontSize: 20, fontWeight: 700}}>分析完成</div>
          <div style={{color: '#6b7280', fontSize: 13, marginTop: 2, fontFamily: 'monospace'}}>
            job · {job.id.slice(0, 8)}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
        }}
      >
        <Stat label="音频时长" value={fmtSec(job.audio.durationSec)} />
        <Stat label="音频大小" value={fmtMB(job.audio.sizeBytes)} />
        <Stat label="字幕条数" value={String(job.srt.cueCount)} />
        <Stat
          label="说话人"
          value={job.srt.speakers.length > 0 ? job.srt.speakers.join(' / ') : '未标注'}
        />
        <Stat
          label="时间漂移"
          value={driftText}
          subtle={`scale = ${job.computed.subtitleTimeScale}`}
        />
        <Stat
          label="字幕末尾"
          value={fmtSec(job.srt.lastCueEndSec)}
          subtle={`差 ${(job.audio.durationSec - job.srt.lastCueEndSec).toFixed(2)} 秒`}
        />
      </div>

      <div
        style={{
          marginTop: 8,
          padding: '14px 18px',
          background: 'rgba(251,191,36,0.06)',
          border: '1px solid rgba(251,191,36,0.2)',
          borderRadius: 10,
          color: '#fde68a',
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        {hasKey ? (
          <>✓ MiniMax API key 已配置 — 接下来自动切章节 + 挑金句 + 生封面，然后预览并渲染。</>
        ) : (
          <>💡 下一步：点右上角 ⚙️ 配置 MiniMax API key — 自动切章节 + 挑金句 + 生封面，然后预览并渲染。</>
        )}
      </div>
    </div>
  );
}

function Stat({label, value, subtle}: {label: string; value: string; subtle?: string}) {
  return (
    <div>
      <div style={{color: '#6b7280', fontSize: 12, letterSpacing: 1, marginBottom: 4}}>{label}</div>
      <div style={{color: '#e5e7eb', fontSize: 18, fontWeight: 600}}>{value}</div>
      {subtle && (
        <div style={{color: '#9ca3af', fontSize: 12, marginTop: 2, fontFamily: 'monospace'}}>
          {subtle}
        </div>
      )}
    </div>
  );
}
