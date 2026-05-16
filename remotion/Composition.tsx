import React, {useEffect, useMemo, useState} from 'react';
import {z} from 'zod';
import {zColor} from '@remotion/zod-types';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {useAudioData, visualizeAudio} from '@remotion/media-utils';
import {parseSrt, type Cue} from '../lib/parseSrt';

const speakerStyleSchema = z.object({
  label: z.string(),
  color: zColor(),
  align: z.enum(['left', 'center', 'right']),
});
const chapterSchema = z.object({
  atSec: z.number(),
  title: z.string(),
  imagePrompt: z.string().optional(),
});
const quoteSchema = z.object({fromSec: z.number(), durationSec: z.number(), text: z.string()});

export const podcastSchema = z.object({
  audioSrc: z.string(),
  srtSrc: z.string(),
  coverSrc: z.string(),
  title: z.string(),
  subtitle: z.string(),
  brand: z.string(),
  accentColor: zColor(),
  speakers: z.record(z.string(), speakerStyleSchema),
  subtitleOffsetSec: z.number(),
  subtitleTimeScale: z.number(),
  chapters: z.array(chapterSchema),
  chapterImageSrcs: z.array(z.string()),
  quotes: z.array(quoteSchema),
  posterDurationSec: z.number(),
  outroDurationSec: z.number(),
  audioDurationSec: z.number(),
});

export type SpeakerStyle = z.infer<typeof speakerStyleSchema>;
export type PodcastProps = z.infer<typeof podcastSchema>;

const CHAPTER_BANNER_SEC = 3.5;
const secToFrames = (sec: number, fps: number) => Math.round(sec * fps);

export const PodcastVertical: React.FC<PodcastProps> = (props) => {
  const {fps} = useVideoConfig();
  const posterFrames = secToFrames(props.posterDurationSec, fps);
  const audioFrames = secToFrames(props.audioDurationSec, fps);
  const outroFrames = secToFrames(props.outroDurationSec, fps);

  return (
    <AbsoluteFill style={{backgroundColor: '#06090f'}}>
      <Sequence durationInFrames={posterFrames}>
        <VPoster {...props} />
      </Sequence>
      <Sequence from={posterFrames} durationInFrames={audioFrames}>
        <VMain {...props} />
      </Sequence>
      <Sequence from={posterFrames + audioFrames} durationInFrames={outroFrames}>
        <VOutro {...props} />
      </Sequence>
    </AbsoluteFill>
  );
};

const VPoster: React.FC<PodcastProps> = ({coverSrc, title, subtitle, accentColor, brand}) => (
  <AbsoluteFill style={{backgroundColor: '#06090f'}}>
    <Img src={coverSrc} style={{width: '100%', height: '100%', objectFit: 'cover', opacity: 0.78}} />
    <AbsoluteFill
      style={{
        background:
          'linear-gradient(180deg, rgba(6,9,15,0.35) 0%, rgba(6,9,15,0.15) 35%, rgba(6,9,15,0.55) 65%, rgba(6,9,15,0.95) 100%)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        top: 110,
        left: 60,
        right: 60,
        display: 'flex',
        justifyContent: 'space-between',
        color: '#cbd5e1',
        fontSize: 30,
        letterSpacing: 8,
        fontFamily: '"SF Mono", Menlo, monospace',
        textTransform: 'uppercase',
      }}
    >
      <span style={{color: '#f87171'}}>● REC</span>
      <span style={{color: accentColor, fontWeight: 700, textTransform: 'uppercase'}}>{brand}</span>
    </div>
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 60px',
        fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
      }}
    >
      <div
        style={{
          color: accentColor,
          fontSize: 34,
          letterSpacing: 6,
          fontWeight: 800,
          marginBottom: 32,
          fontFamily: '"SF Mono", Menlo, monospace',
        }}
      >
        {brand}
      </div>
      <div
        style={{
          color: '#fff',
          fontSize: 118,
          fontWeight: 800,
          lineHeight: 1.12,
          textAlign: 'center',
          textShadow: '0 6px 50px rgba(0,0,0,0.75)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          maxWidth: 980,
        }}
      >
        {title}
      </div>
      <div
        style={{
          color: '#e5e7eb',
          fontSize: 52,
          marginTop: 32,
          letterSpacing: 4,
          textShadow: '0 2px 24px rgba(0,0,0,0.7)',
          textAlign: 'center',
        }}
      >
        {subtitle}
      </div>
      <div
        style={{
          width: 180,
          height: 5,
          backgroundColor: accentColor,
          marginTop: 56,
          boxShadow: `0 0 40px ${accentColor}`,
        }}
      />
    </AbsoluteFill>
  </AbsoluteFill>
);

const VMain: React.FC<PodcastProps> = (props) => {
  const {
    audioSrc,
    srtSrc,
    coverSrc,
    accentColor,
    title,
    brand,
    speakers,
    subtitleOffsetSec,
    subtitleTimeScale,
    chapters,
    chapterImageSrcs,
    quotes,
    audioDurationSec,
  } = props;
  const {fps} = useVideoConfig();

  const [cues, setCues] = useState<Cue[]>([]);
  const [handle] = useState(() => delayRender('Loading SRT'));

  useEffect(() => {
    fetch(srtSrc)
      .then((r) => r.text())
      .then((text) => {
        setCues(parseSrt(text));
        continueRender(handle);
      })
      .catch(() => continueRender(handle));
  }, [srtSrc, handle]);

  return (
    <AbsoluteFill style={{backgroundColor: '#0b0f17'}}>
      <Audio
        src={audioSrc}
        volume={(f) =>
          // 极轻淡入（3 帧 = 0.1s），避免吞掉播客第一句直接说话的开头
          interpolate(f, [0, 3], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
        }
      />

      <VCoverBackground
        coverSrc={coverSrc}
        chapters={chapters}
        chapterImageSrcs={chapterImageSrcs}
        accentColor={accentColor}
      />
      <VAmbientParticles accentColor={accentColor} />
      <VTopProgress audioDurationSec={audioDurationSec} accentColor={accentColor} chapters={chapters} />
      <VBrandBar accentColor={accentColor} title={title} brand={brand} />
      <VPersistentChapterLabel chapters={chapters} accentColor={accentColor} />
      <VWaveform audioSrc={audioSrc} accentColor={accentColor} />

      {cues.map((cue) => {
        const rawStart = cue.startSec * subtitleTimeScale + subtitleOffsetSec;
        const rawEnd = cue.endSec * subtitleTimeScale + subtitleOffsetSec;
        // clamp 到 [0, audioDurationSec)——cue 末尾超出音频时长会被 VMain 截，
        // 不 clamp 的话最后一条字幕会缺一截 / 错位到 Outro
        const start = Math.max(0, Math.min(audioDurationSec, rawStart));
        const end = Math.max(start, Math.min(audioDurationSec, rawEnd));
        if (end - start < 0.05) return null; // 太短的（被 clamp 完全掉了）就跳过
        const from = secToFrames(start, fps);
        const dur = Math.max(1, secToFrames(end - start, fps));
        const style =
          (cue.speaker && speakers[cue.speaker]) || {
            label: cue.speaker ?? '',
            color: '#e5e7eb',
            align: 'center' as const,
          };
        return (
          <Sequence key={cue.index} from={from} durationInFrames={dur}>
            <VSubtitleLine
              text={cue.text}
              duration={dur}
              style={style}
              cueStartSec={start}
              quotes={quotes}
            />
          </Sequence>
        );
      })}

      {chapters.map((ch, i) => (
        <Sequence
          key={`ch-${i}`}
          from={secToFrames(ch.atSec, fps)}
          durationInFrames={secToFrames(CHAPTER_BANNER_SEC, fps)}
        >
          <VChapterBanner index={i + 1} title={ch.title} accentColor={accentColor} />
        </Sequence>
      ))}

      {quotes.map((q, i) => (
        <Sequence
          key={`q-${i}`}
          from={secToFrames(q.fromSec, fps)}
          durationInFrames={secToFrames(q.durationSec, fps)}
        >
          <VKeyQuote text={q.text} accentColor={accentColor} />
        </Sequence>
      ))}

      <VProgressBar audioDurationSec={audioDurationSec} accentColor={accentColor} />
    </AbsoluteFill>
  );
};

const VCoverBackground: React.FC<{
  coverSrc: string;
  chapters: PodcastProps['chapters'];
  chapterImageSrcs: string[];
  accentColor: string;
}> = ({coverSrc, chapters, chapterImageSrcs, accentColor}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const curSec = frame / fps;
  // Ken Burns 全局缓慢 zoom-in：4 分钟累计 ~1.6x
  const globalScale = 1 + frame * 0.00008;

  // 4 个方向让相邻章节图 KB 移动方向不同，cross-fade 时观感像换了视角
  const directions = [
    {x: 1, y: 1}, // 右下
    {x: -1, y: 1}, // 左下
    {x: 1, y: -1}, // 右上
    {x: -1, y: -1}, // 左上
  ];

  // 每个章节图作底图的 opacity：从 atSec 起 0.8s 淡入，下一章 atSec 前 0.8s 淡出
  const chapterOpacities = chapters.map((ch, i) => {
    const start = ch.atSec;
    const end = i < chapters.length - 1 ? chapters[i + 1].atSec : Infinity;
    const fadeIn = interpolate(curSec, [start, start + 0.8], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const fadeOut =
      end < Infinity
        ? interpolate(curSec, [end - 0.8, end], [1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        : 1;
    return fadeIn * fadeOut;
  });

  // 第一章 atSec=0 时（最常见情况）直接关 cover，避免双层叠加亮闪
  const firstAt = chapters[0]?.atSec ?? 0;
  const baseCoverOpacity =
    chapters.length === 0
      ? 0.95
      : firstAt <= 0.05
        ? 0
        : interpolate(curSec, [firstAt, firstAt + 0.8], [0.95, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

  // 章节切换柔光 flash：在每个章节 atSec 后 0.4s 内有个 accent-color 全屏淡光
  const flashOpacity = chapters
    .filter((ch) => ch.atSec > 0.1)
    .reduce((max, ch) => {
      const v = interpolate(curSec, [ch.atSec - 0.05, ch.atSec + 0.15, ch.atSec + 0.4], [0, 0.28, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      return Math.max(max, v);
    }, 0);

  return (
    <>
      <AbsoluteFill style={{overflow: 'hidden'}}>
        <Img
          src={coverSrc}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${globalScale * 1.05})`,
            opacity: baseCoverOpacity,
          }}
        />
        {chapterImageSrcs.map((src, i) => {
          if (!src || chapterOpacities[i] <= 0.001) return null;
          const dir = directions[i % directions.length];
          // 章节内本地 frame：让每章独立做 Ken Burns 平移，方向不同
          const inChapterSec = Math.max(0, curSec - chapters[i].atSec);
          // 每秒平移 0.6px，60s 章节末累计 ~36px（视频 1080 宽里 3.3% 移动）
          const tx = dir.x * inChapterSec * 0.6;
          const ty = dir.y * inChapterSec * 0.4;
          // 局部 zoom 让本章更"活"，叠加全局 zoom
          const localScale = globalScale * (1 + inChapterSec * 0.0003);
          return (
            <Img
              key={i}
              src={src}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: `scale(${localScale}) translate(${tx}px, ${ty}px)`,
                opacity: chapterOpacities[i] * 0.95,
              }}
            />
          );
        })}
      </AbsoluteFill>
      {flashOpacity > 0.005 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at center, ${accentColor}, transparent 70%)`,
            opacity: flashOpacity,
            mixBlendMode: 'screen',
          }}
        />
      )}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(6,9,15,0.6) 0%, rgba(6,9,15,0.3) 35%, rgba(6,9,15,0.55) 60%, rgba(6,9,15,0.95) 100%)',
        }}
      />
    </>
  );
};

const VTopProgress: React.FC<{
  audioDurationSec: number;
  accentColor: string;
  chapters: PodcastProps['chapters'];
}> = ({audioDurationSec, accentColor, chapters}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const curSec = Math.min(audioDurationSec, frame / fps);
  const progress = Math.max(0, Math.min(1, curSec / audioDurationSec));
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.10)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${progress * 100}%`,
          background: `linear-gradient(90deg, ${accentColor}77, ${accentColor})`,
          boxShadow: `0 0 18px ${accentColor}`,
        }}
      />
      {chapters.map((ch, i) => {
        if (ch.atSec <= 0 || ch.atSec >= audioDurationSec) return null;
        const left = (ch.atSec / audioDurationSec) * 100;
        const passed = curSec >= ch.atSec;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: -4,
              width: 4,
              height: 14,
              transform: 'translateX(-50%)',
              backgroundColor: passed ? accentColor : '#fff',
              border: '1px solid rgba(0,0,0,0.6)',
              boxShadow: passed
                ? `0 0 10px ${accentColor}, 0 0 0 1px rgba(0,0,0,0.4)`
                : '0 0 0 1px rgba(0,0,0,0.4)',
              borderRadius: 1.5,
            }}
          />
        );
      })}
    </div>
  );
};

const VBrandBar: React.FC<{accentColor: string; title: string; brand: string}> = ({
  accentColor,
  title,
  brand,
}) => (
  <>
    <div
      style={{
        position: 'absolute',
        top: 120,
        left: 60,
        right: 60,
        display: 'flex',
        justifyContent: 'space-between',
        color: '#cbd5e1',
        fontSize: 26,
        letterSpacing: 6,
        fontFamily: '"SF Mono", Menlo, monospace',
        textTransform: 'uppercase',
      }}
    >
      <span style={{color: '#f87171'}}>● REC</span>
      <span style={{color: accentColor, fontWeight: 700}}>{brand}</span>
    </div>
    <div
      style={{
        position: 'absolute',
        top: 180,
        left: 60,
        right: 60,
        textAlign: 'center',
        color: '#fff',
        fontSize: 64,
        fontWeight: 800,
        letterSpacing: 2,
        lineHeight: 1.15,
        textShadow: '0 4px 24px rgba(0,0,0,0.85)',
        fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
        // 最多 2 行，超长 ellipsis——下面 480 处有章节胶囊，不能让标题撞上去
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}
    >
      {title}
    </div>
  </>
);

const VPersistentChapterLabel: React.FC<{
  chapters: PodcastProps['chapters'];
  accentColor: string;
}> = ({chapters, accentColor}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const curSec = frame / fps;
  let activeIdx = -1;
  for (let i = 0; i < chapters.length; i++) {
    if (curSec >= chapters[i].atSec) activeIdx = i;
    else break;
  }
  if (activeIdx < 0) return null;
  const active = chapters[activeIdx];
  // 章节切入瞬间 VChapterBanner 占据顶部 3.5s——这里让持续标签等 banner 谢幕后再进场，
  // 避免顶部「品牌条 + 标题 + 持续标签 + 章节胶囊」四样同时拥挤。
  const enterSec = curSec - active.atSec - CHAPTER_BANNER_SEC;
  const enter = Math.min(1, Math.max(0, enterSec / 0.6));
  const slideY = (1 - enter) * 24;
  return (
    <div
      style={{
        position: 'absolute',
        top: 360,
        left: 60,
        right: 60,
        display: 'flex',
        justifyContent: 'center',
        opacity: enter,
        transform: `translateY(${slideY}px)`,
        fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 18,
          backgroundColor: 'rgba(6, 9, 15, 0.88)',
          padding: '14px 28px',
          borderRadius: 999,
          border: `1px solid ${accentColor}55`,
          boxShadow: `0 8px 28px rgba(0,0,0,0.4)`,
        }}
      >
        <span
          style={{color: accentColor, fontSize: 26, fontWeight: 800, letterSpacing: 3}}
        >
          CH {String(activeIdx + 1).padStart(2, '0')}
        </span>
        <span style={{color: accentColor, opacity: 0.4, fontSize: 24}}>·</span>
        <span style={{color: '#fff', fontSize: 30, fontWeight: 600}}>{active.title}</span>
      </div>
    </div>
  );
};

const nextPow2 = (n: number) => {
  let p = 32;
  while (p < n) p *= 2;
  return p;
};

const VWaveform: React.FC<{audioSrc: string; accentColor: string}> = ({audioSrc, accentColor}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const audioData = useAudioData(audioSrc);
  const bars = useMemo(() => {
    // 32 个频段：低频→高频。直接画的话，低频集中左侧、高频在右，看着像"只有左边在动"。
    // 取前 16 个频段做镜像（mirror[15..0] + mirror[0..15]），让低频聚在中央、高频对称到两侧，
    // 视觉上从中央向外发散，对称居中震动。
    if (!audioData) return new Array(32).fill(0.1);
    const samples = nextPow2(32);
    const spectrum = visualizeAudio({
      fps,
      frame,
      audioData,
      numberOfSamples: samples,
      smoothing: true,
    }).slice(0, 16);
    return [...spectrum.slice().reverse(), ...spectrum];
  }, [audioData, fps, frame]);
  return (
    <div
      style={{
        position: 'absolute',
        top: 750,
        left: 0,
        right: 0,
        height: 110,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          width: 900,
          height: '100%',
          justifyContent: 'center',
        }}
      >
        {bars.map((v, i) => {
          // 字幕背景会盖住波形 → 把波形挪到字幕上方 + 缩矮，避开 overlap
          const h = Math.max(6, Math.min(96, v * 360));
          return (
            <div
              key={i}
              style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4}}
            >
              <div
                style={{
                  width: 22,
                  height: h,
                  background: `linear-gradient(180deg, ${accentColor}, ${accentColor}aa)`,
                  borderRadius: '11px 11px 0 0',
                  boxShadow: `0 0 28px ${accentColor}aa`,
                }}
              />
              <div
                style={{
                  width: 22,
                  height: h * 0.45,
                  background: `linear-gradient(0deg, transparent, ${accentColor}66)`,
                  borderRadius: '0 0 11px 11px',
                  opacity: 0.5,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const VSubtitleLine: React.FC<{
  text: string;
  duration: number;
  style: SpeakerStyle;
  cueStartSec: number;
  quotes: PodcastProps['quotes'];
}> = ({text, duration, style, cueStartSec, quotes}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const baseOpacity = interpolate(frame, [0, 4, duration - 4, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const absoluteSec = cueStartSec + frame / fps;
  const inQuote = quotes.some(
    (q) => absoluteSec >= q.fromSec - 0.2 && absoluteSec <= q.fromSec + q.durationSec + 0.2,
  );
  const opacity = baseOpacity * (inQuote ? 0 : 1);
  const y = interpolate(frame, [0, 8], [16, 0], {extrapolateRight: 'clamp'});

  return (
    <div
      style={{
        position: 'absolute',
        top: 900,
        left: 60,
        right: 60,
        height: 540,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          backgroundColor: 'rgba(6, 9, 15, 0.92)',
          color: '#fff',
          fontSize: 64,
          lineHeight: 1.4,
          padding: '32px 40px',
          borderRadius: 20,
          opacity,
          transform: `translateY(${y}px)`,
          fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
          textAlign: 'center',
          whiteSpace: 'pre-wrap',
          borderTop: `4px solid ${style.color}`,
          boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
          maxHeight: 460,
          overflow: 'hidden',
        }}
      >
        {style.label && (
          <div
            style={{
              color: style.color,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: 4,
              marginBottom: 14,
              opacity: 0.95,
            }}
          >
            {style.label.toUpperCase()}
          </div>
        )}
        {text}
      </div>
    </div>
  );
};

const VChapterBanner: React.FC<{index: number; title: string; accentColor: string}> = ({
  index,
  title,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const slideIn = interpolate(frame, [0, 12], [-50, 0], {extrapolateRight: 'clamp'});
  const opacity = interpolate(
    frame,
    [0, 10, durationInFrames - 12, durationInFrames],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
  return (
    <div
      style={{
        position: 'absolute',
        top: 540,
        left: 60,
        right: 60,
        display: 'flex',
        justifyContent: 'center',
        opacity,
        transform: `translateY(${slideIn}px)`,
        fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          backgroundColor: 'rgba(6, 9, 15, 0.95)',
          borderRadius: 18,
          border: `1px solid ${accentColor}77`,
          boxShadow: `0 24px 80px ${accentColor}44`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            backgroundColor: accentColor,
            color: '#0b0f17',
            fontSize: 36,
            fontWeight: 800,
            padding: '24px 30px',
            display: 'flex',
            alignItems: 'center',
            letterSpacing: 3,
          }}
        >
          CH {String(index).padStart(2, '0')}
        </div>
        <div
          style={{
            color: '#fff',
            fontSize: 48,
            fontWeight: 700,
            padding: '22px 32px',
            display: 'flex',
            alignItems: 'center',
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>
      </div>
    </div>
  );
};

const VKeyQuote: React.FC<{text: string; accentColor: string}> = ({text, accentColor}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const fadeIn = spring({frame, fps, from: 0, to: 1, config: {damping: 16, stiffness: 110}});
  const fadeOut = interpolate(frame, [durationInFrames - 20, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = fadeIn * fadeOut;
  // 金句不再全屏暗化遮盖——做成中段卡片（字幕在金句时间窗已被 hidden，让出位置）
  return (
    <div
      style={{
        position: 'absolute',
        top: 900,
        left: 60,
        right: 60,
        display: 'flex',
        justifyContent: 'center',
        opacity,
        transform: `translateY(${(1 - fadeIn) * 30}px)`,
        fontFamily: '"Noto Serif SC", "PingFang SC", serif',
        // 金句和字幕容器共占 top:900——显式拔高 z-index 避免 inQuote 偶发错位时字幕盖金句
        zIndex: 10,
      }}
    >
      <div
        style={{
          position: 'relative',
          maxWidth: 920,
          padding: '40px 56px',
          backgroundColor: 'rgba(6, 9, 15, 0.92)',
          borderRadius: 22,
          border: `1px solid ${accentColor}55`,
          boxShadow: `0 24px 80px rgba(0,0,0,0.5), 0 0 40px ${accentColor}33`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -8,
            left: 24,
            color: accentColor,
            fontSize: 140,
            lineHeight: 1,
            fontFamily: 'serif',
            opacity: 0.55,
            textShadow: `0 0 40px ${accentColor}88`,
          }}
        >
          "
        </div>
        <div
          style={{
            color: '#fff',
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.3,
            textAlign: 'center',
            textShadow: '0 4px 24px rgba(0,0,0,0.7)',
          }}
        >
          {text}
        </div>
        <div
          style={{
            margin: '24px auto 0',
            width: 70,
            height: 3,
            backgroundColor: accentColor,
            boxShadow: `0 0 16px ${accentColor}`,
          }}
        />
      </div>
    </div>
  );
};

const fmt = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};

const VProgressBar: React.FC<{audioDurationSec: number; accentColor: string}> = ({
  audioDurationSec,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const curSec = Math.min(audioDurationSec, frame / fps);
  const progress = Math.max(0, Math.min(1, curSec / audioDurationSec));
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 60,
          right: 60,
          bottom: 80,
          display: 'flex',
          justifyContent: 'space-between',
          color: '#cbd5e1',
          fontSize: 30,
          fontFamily: '"SF Mono", Menlo, monospace',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: 2,
        }}
      >
        <span>{fmt(curSec)}</span>
        <span style={{color: '#9ca3af'}}>{fmt(audioDurationSec)}</span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 5,
          backgroundColor: 'rgba(255,255,255,0.08)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${progress * 100}%`,
            background: `linear-gradient(90deg, ${accentColor}aa, ${accentColor})`,
            boxShadow: `0 0 20px ${accentColor}`,
          }}
        />
      </div>
    </>
  );
};

/* ============================================================ */
const VOutro: React.FC<PodcastProps> = ({title, accentColor, coverSrc}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const fadeIn = spring({frame, fps, from: 0, to: 1, config: {damping: 16}});
  const lineWidth = interpolate(frame, [10, 40], [0, 360], {extrapolateRight: 'clamp'});
  const farewellSpring = spring({frame: frame - 30, fps, from: 0, to: 1, config: {damping: 14}});
  const tagSpring = spring({frame: frame - 50, fps, from: 0, to: 1, config: {damping: 14}});
  // 互动引导（关注 / 点赞 / 评论 / 收藏）—— 错开 spring 让 4 个 icon 像跳一下进场
  const ctaSpring = (delayFrames: number) =>
    spring({frame: frame - delayFrames, fps, from: 0, to: 1, config: {damping: 12, stiffness: 180}});
  const fadeOut = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ctas = [
    {emoji: '👀', label: '关注', delay: 70},
    {emoji: '👍', label: '点赞', delay: 78},
    {emoji: '💬', label: '评论', delay: 86},
    {emoji: '⭐️', label: '收藏', delay: 94},
  ];
  return (
    <AbsoluteFill style={{backgroundColor: '#06090f', opacity: fadeOut}}>
      <Img
        src={coverSrc}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.35,
          filter: 'blur(4px)',
        }}
      />
      <AbsoluteFill
        style={{
          background: 'linear-gradient(180deg, rgba(6,9,15,0.7) 0%, rgba(6,9,15,0.9) 100%)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '0 60px',
          fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
        }}
      >
        <div style={{color: '#9ca3af', fontSize: 32, letterSpacing: 12, opacity: fadeIn}}>
          END OF EPISODE
        </div>
        <div
          style={{
            width: lineWidth,
            height: 4,
            backgroundColor: accentColor,
            margin: '40px 0',
            boxShadow: `0 0 28px ${accentColor}`,
          }}
        />
        <div
          style={{
            color: '#fff',
            fontSize: 140,
            fontWeight: 800,
            opacity: farewellSpring,
            transform: `translateY(${(1 - farewellSpring) * 24}px)`,
            textShadow: '0 6px 40px rgba(0,0,0,0.7)',
          }}
        >
          感谢收听
        </div>
        <div
          style={{
            color: '#cbd5e1',
            fontSize: 44,
            marginTop: 40,
            opacity: tagSpring,
            textAlign: 'center',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            maxWidth: 920,
          }}
        >
          《{title}》
        </div>

        {/* 互动引导：关注 / 点赞 / 评论 / 收藏 */}
        <div
          style={{
            display: 'flex',
            gap: 56,
            marginTop: 80,
          }}
        >
          {ctas.map((cta) => {
            const s = ctaSpring(cta.delay);
            return (
              <div
                key={cta.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  opacity: s,
                  transform: `scale(${0.7 + s * 0.3}) translateY(${(1 - s) * 16}px)`,
                }}
              >
                <div
                  style={{
                    width: 130,
                    height: 130,
                    borderRadius: '50%',
                    background: `linear-gradient(180deg, ${accentColor}22, ${accentColor}11)`,
                    border: `2px solid ${accentColor}88`,
                    boxShadow: `0 0 36px ${accentColor}55`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 70,
                  }}
                >
                  {cta.emoji}
                </div>
                <div
                  style={{
                    color: '#fff',
                    fontSize: 30,
                    fontWeight: 700,
                    letterSpacing: 4,
                  }}
                >
                  {cta.label}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * 浮动尘埃粒子层——给底图加点"活气"，比 Ken Burns 更柔和的动态元素。
 * 用确定性 PRNG（Math.sin）生成 28 个粒子的初始位置/大小/速度，
 * 每帧根据 frame 计算 y 位置（从底向上缓慢漂浮）。
 */
const PARTICLE_COUNT = 28;
const rand = (i: number, salt: number) => {
  const v = Math.sin((i + 1) * salt) * 43758.5453;
  return v - Math.floor(v);
};

const VAmbientParticles: React.FC<{accentColor: string}> = ({accentColor}) => {
  const frame = useCurrentFrame();
  const particles = useMemo(
    () =>
      Array.from({length: PARTICLE_COUNT}, (_, i) => ({
        x: rand(i, 12.9898) * 100,
        initialY: rand(i, 78.233) * 100,
        size: 2 + rand(i, 39.337) * 5,
        speed: 0.015 + rand(i, 91.171) * 0.022,
        baseOpacity: 0.12 + rand(i, 27.611) * 0.25,
        // 用 frame 偏移生成轻微闪烁
        flickerSpeed: 0.03 + rand(i, 51.5) * 0.05,
        flickerPhase: rand(i, 83.1) * Math.PI * 2,
      })),
    [],
  );

  return (
    <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}}>
      {particles.map((p, i) => {
        const y = (((p.initialY - frame * p.speed) % 100) + 100) % 100;
        const flicker = 0.6 + 0.4 * Math.sin(frame * p.flickerSpeed + p.flickerPhase);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${y}%`,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              backgroundColor: accentColor,
              opacity: p.baseOpacity * flicker,
              boxShadow: `0 0 ${p.size * 2.5}px ${accentColor}99`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

