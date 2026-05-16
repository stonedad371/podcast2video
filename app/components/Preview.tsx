'use client';

import {Player} from '@remotion/player';
import {PodcastVertical, type PodcastProps} from '@/remotion/Composition';

type LayoutKey = 'vertical' | 'square' | 'horizontal';

const LAYOUT_PRESETS: Record<
  LayoutKey,
  {width: number; height: number; aspectRatio: string; previewWidth: number; label: string}
> = {
  vertical: {width: 1080, height: 1920, aspectRatio: '9 / 16', previewWidth: 360, label: '9:16 竖屏'},
  square: {width: 1080, height: 1080, aspectRatio: '1 / 1', previewWidth: 480, label: '1:1 方形'},
  horizontal: {width: 1920, height: 1080, aspectRatio: '16 / 9', previewWidth: 640, label: '16:9 横屏'},
};

export function Preview({props, layout = 'vertical'}: {props: PodcastProps; layout?: LayoutKey}) {
  const fps = 30;
  const totalSec =
    props.posterDurationSec + props.audioDurationSec + props.outroDurationSec;
  const durationInFrames = Math.max(1, Math.ceil(totalSec * fps));
  const preset = LAYOUT_PRESETS[layout];

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
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 12,
        }}
      >
        <div style={{color: '#cbd5e1', fontSize: 14, fontWeight: 700, letterSpacing: 2}}>
          实时预览
        </div>
        <div style={{color: '#9ca3af', fontSize: 12, fontFamily: 'monospace'}}>
          {preset.label} · {preset.width}×{preset.height}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 24,
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            width: preset.previewWidth,
            aspectRatio: preset.aspectRatio,
            backgroundColor: '#000',
            borderRadius: 12,
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <Player
            component={PodcastVertical}
            durationInFrames={durationInFrames}
            fps={fps}
            compositionWidth={preset.width}
            compositionHeight={preset.height}
            inputProps={props}
            initialFrame={0}
            style={{width: '100%', height: '100%'}}
            controls
            clickToPlay
            showVolumeControls
          />
        </div>
        <div
          style={{
            flex: 1,
            color: '#9ca3af',
            fontSize: 13,
            lineHeight: 1.7,
          }}
        >
          <div style={{color: '#e5e7eb', marginBottom: 8, fontWeight: 600}}>
            播放器是浏览器实时预览，不是已生成的视频
          </div>
          每一帧都是 React 组件按当前帧号渲染出来的，可以拖时间轴看任意位置的画面。
          <br />
          <br />
          总长 {Math.round(totalSec)} 秒，{durationInFrames} 帧 @ {fps}fps
          <ul style={{marginTop: 16, paddingLeft: 18, color: '#cbd5e1'}}>
            <li>
              <span style={{color: '#fbbf24'}}>1 帧</span> 首帧封面（平台抓这帧当缩略图）
            </li>
            <li>
              <span style={{color: '#fbbf24'}}>{Math.round(props.audioDurationSec)}s</span> 主体（字幕 / 章节图 / 金句）
            </li>
            <li>
              <span style={{color: '#fbbf24'}}>{props.outroDurationSec}s</span> 片尾
            </li>
          </ul>
          {layout !== 'vertical' && (
            <div
              style={{
                marginTop: 14,
                padding: '10px 12px',
                background: 'rgba(251,191,36,0.08)',
                border: '1px solid rgba(251,191,36,0.3)',
                borderRadius: 8,
                color: '#fde68a',
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              ⚠️ {preset.label} 布局精调还在路上——目前用竖屏的元素位置，会有越界/挤压。
              出片可用但视觉不完美。要稳定出片建议先用 9:16。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
