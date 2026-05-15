'use client';

import {useRef, useState} from 'react';

export type UploadResult = {
  id: string;
  audio: {filename: string; durationSec: number; sizeBytes: number};
  srt: {filename: string; cueCount: number; speakers: string[]; lastCueEndSec: number};
  computed: {subtitleTimeScale: number};
};

export function UploadZone({onUploaded}: {onUploaded: (job: UploadResult) => void}) {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [srtFile, setSrtFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const acceptFile = (file: File) => {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'].includes(ext)) {
      setAudioFile(file);
    } else if (['srt', 'vtt'].includes(ext)) {
      setSrtFile(file);
    } else {
      setError(`不识别的文件：${file.name}（请用 mp3/wav 等音频 或 srt 字幕）`);
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    setError(null);
    Array.from(e.dataTransfer.files).forEach(acceptFile);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setError(null);
    Array.from(e.target.files).forEach(acceptFile);
  };

  const submit = async () => {
    if (!audioFile || !srtFile) {
      setError('需要同时选择音频和字幕');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('audio', audioFile);
      form.append('srt', srtFile);
      if (title) form.append('title', title);
      if (subtitle) form.append('subtitle', subtitle);
      const res = await fetch('/api/upload', {method: 'POST', body: form});
      if (!res.ok) {
        const j = await res.json().catch(() => ({error: '上传失败'}));
        throw new Error(j.error || '上传失败');
      }
      const data = await res.json();
      onUploaded({
        id: data.job.id,
        audio: data.job.audio,
        srt: data.job.srt,
        computed: data.job.computed,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 24}}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInput.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#fbbf24' : '#374151'}`,
          borderRadius: 16,
          padding: '48px 32px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.02)',
          transition: 'all 0.15s',
        }}
      >
        <div style={{fontSize: 48, marginBottom: 12}}>📂</div>
        <div style={{color: '#e5e7eb', fontSize: 20, fontWeight: 600, marginBottom: 8}}>
          拖入或点击选择文件
        </div>
        <div style={{color: '#9ca3af', fontSize: 14}}>
          需要：1 个音频（mp3 / wav / m4a / ...）+ 1 个字幕（srt）
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept=".mp3,.wav,.m4a,.aac,.ogg,.flac,.srt,.vtt"
          onChange={onFileChange}
          style={{display: 'none'}}
        />
      </div>

      <div style={{display: 'flex', gap: 16}}>
        <FileBadge icon="🎵" label="音频" file={audioFile} onClear={() => setAudioFile(null)} />
        <FileBadge icon="💬" label="字幕" file={srtFile} onClear={() => setSrtFile(null)} />
      </div>

      <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        <input
          type="text"
          placeholder="视频标题（可留空，默认「播客标题」）"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={inputStyle}
        />
        <input
          type="text"
          placeholder="副标题（可留空）"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          style={inputStyle}
        />
      </div>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.35)',
            borderRadius: 10,
            color: '#fca5a5',
            fontSize: 14,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={!audioFile || !srtFile || uploading}
        style={{
          padding: '16px 24px',
          background: uploading ? '#4b5563' : 'linear-gradient(90deg, #fbbf24, #f59e0b)',
          color: '#0b0f17',
          border: 'none',
          borderRadius: 12,
          fontSize: 18,
          fontWeight: 700,
          cursor: uploading || !audioFile || !srtFile ? 'not-allowed' : 'pointer',
          opacity: !audioFile || !srtFile ? 0.5 : 1,
          letterSpacing: 2,
        }}
      >
        {uploading ? '分析中…' : '上传并分析'}
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '14px 18px',
  fontSize: 16,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid #374151',
  borderRadius: 10,
  color: '#e5e7eb',
  fontFamily: 'inherit',
};

function FileBadge({
  icon,
  label,
  file,
  onClear,
}: {
  icon: string;
  label: string;
  file: File | null;
  onClear: () => void;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: file ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${file ? 'rgba(74,222,128,0.35)' : '#374151'}`,
        borderRadius: 10,
        fontSize: 14,
      }}
    >
      <span style={{fontSize: 24}}>{icon}</span>
      <div style={{flex: 1, minWidth: 0}}>
        <div style={{color: '#9ca3af', fontSize: 12, marginBottom: 2}}>{label}</div>
        <div
          style={{
            color: file ? '#a7f3d0' : '#6b7280',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {file?.name || '未选择'}
        </div>
      </div>
      {file && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#9ca3af',
            cursor: 'pointer',
            fontSize: 18,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
