'use client';

import {Player} from '@remotion/player';
import {PodcastVertical, type PodcastProps} from '@/remotion/Composition';

export function Preview({props}: {props: PodcastProps}) {
  const fps = 30;
  // 时间轴：Poster + Main + Outro
  const totalSec =
    props.posterDurationSec + props.audioDurationSec + props.outroDurationSec;
  const durationInFrames = Math.max(1, Math.ceil(totalSec * fps));
  const posterStartFrame = 0;

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
        实时预览
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
            width: 360,
            aspectRatio: '9 / 16',
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
            compositionWidth={1080}
            compositionHeight={1920}
            inputProps={props}
            initialFrame={posterStartFrame}
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
        </div>
      </div>
    </div>
  );
}
