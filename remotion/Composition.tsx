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
const chapterSchema = z.object({atSec: z.number(), title: z.string()});
const quoteSchema = z.object({fromSec: z.number(), durationSec: z.number(), text: z.string()});
const hookSchema = z.object({number: z.string(), text: z.string()});

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
  hook: hookSchema,
  chapters: z.array(chapterSchema),
  chapterImageSrcs: z.array(z.string()),
  quotes: z.array(quoteSchema),
  hookDurationSec: z.number(),
  posterDurationSec: z.number(),
  introDurationSec: z.number(),
  outroDurationSec: z.number(),
  audioDurationSec: z.number(),
});

export type SpeakerStyle = z.infer<typeof speakerStyleSchema>;
export type PodcastProps = z.infer<typeof podcastSchema>;

const CHAPTER_BANNER_SEC = 3.5;
const CHAPTER_IMAGE_CARD_SEC = 1.5;
const secToFrames = (sec: number, fps: number) => Math.round(sec * fps);

export const PodcastVertical: React.FC<PodcastProps> = (props) => {
  const {fps} = useVideoConfig();
  // Hook 和 Intro 已简化掉——视频开头只保留 Poster 一帧封面。
  // hookDurationSec / introDurationSec 仍在 schema 中（向后兼容），但渲染时忽略。
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

/* ============================================================ */
const VHook: React.FC<{
  hook: PodcastProps['hook'];
  accentColor: string;
  brand: string;
}> = ({hook, accentColor, brand}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();

  // 数字弹入
  const numberSpring = spring({
    frame,
    fps,
    config: {damping: 12, stiffness: 180, mass: 0.6},
  });
  const numberScale = interpolate(numberSpring, [0, 1], [1.3, 1.0]);
  const numberOpacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 文本从下淡入
  const textOpacity = interpolate(frame, [10, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const textY = interpolate(frame, [10, 22], [40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 整体后期淡出，过渡到 Poster
  const overallOpacity = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#06090f',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 60px',
        fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
        opacity: overallOpacity,
      }}
    >
      <div
        style={{
          color: '#6b7280',
          fontSize: 26,
          letterSpacing: 8,
          fontFamily: '"SF Mono", Menlo, monospace',
          marginBottom: 48,
          textTransform: 'uppercase',
        }}
      >
        {brand}
      </div>
      <div
        style={{
          color: accentColor,
          fontSize: 280,
          fontWeight: 900,
          lineHeight: 1,
          textAlign: 'center',
          letterSpacing: -4,
          opacity: numberOpacity,
          transform: `scale(${numberScale})`,
          textShadow: `0 0 80px ${accentColor}66, 0 8px 40px rgba(0,0,0,0.6)`,
          marginBottom: 56,
        }}
      >
        {hook.number}
      </div>
      <div
        style={{
          color: '#fff',
          fontSize: 64,
          fontWeight: 700,
          lineHeight: 1.3,
          textAlign: 'center',
          maxWidth: 900,
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
          textShadow: '0 4px 20px rgba(0,0,0,0.7)',
        }}
      >
        {hook.text}
      </div>
      <div
        style={{
          width: 100,
          height: 4,
          backgroundColor: accentColor,
          marginTop: 40,
          opacity: textOpacity,
          boxShadow: `0 0 24px ${accentColor}`,
        }}
      />
    </AbsoluteFill>
  );
};

/* ============================================================ */
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
          fontSize: 130,
          fontWeight: 800,
          lineHeight: 1.1,
          textAlign: 'center',
          textShadow: '0 6px 50px rgba(0,0,0,0.75)',
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

/* ============================================================ */
const VIntro: React.FC<PodcastProps> = ({coverSrc, title, subtitle, accentColor, brand}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const titleStart = Math.max(0, durationInFrames - 45);
  const titleSpring = spring({frame: frame - titleStart, fps, from: 0, to: 1, config: {damping: 16}});
  const subSpring = spring({frame: frame - titleStart - 8, fps, from: 0, to: 1, config: {damping: 16}});
  const fadeOut = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{backgroundColor: '#06090f', opacity: fadeOut}}>
      <Img
        src={coverSrc}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.42,
          filter: 'blur(2px)',
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, ${accentColor}28, transparent 60%)`,
        }}
      />
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          opacity: titleSpring,
          padding: '0 60px',
          fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
        }}
      >
        <div
          style={{
            color: accentColor,
            fontSize: 28,
            letterSpacing: 4,
            fontWeight: 800,
            marginBottom: 28,
            fontFamily: '"SF Mono", Menlo, monospace',
          }}
        >
          {brand}
        </div>
        <div
          style={{
            color: '#fff',
            fontSize: 108,
            fontWeight: 800,
            lineHeight: 1.1,
            textAlign: 'center',
            transform: `translateY(${(1 - titleSpring) * 30}px)`,
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: '#9ca3af',
            fontSize: 44,
            marginTop: 24,
            opacity: subSpring,
            letterSpacing: 4,
            textAlign: 'center',
          }}
        >
          {subtitle}
        </div>
        <div
          style={{
            width: 140,
            height: 4,
            backgroundColor: accentColor,
            marginTop: 48,
            opacity: subSpring,
            boxShadow: `0 0 24px ${accentColor}`,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ============================================================ */
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
          interpolate(f, [0, 9], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
        }
      />

      <VCoverBackground
        coverSrc={coverSrc}
        chapters={chapters}
        chapterImageSrcs={chapterImageSrcs}
      />
      <VTopProgress audioDurationSec={audioDurationSec} accentColor={accentColor} chapters={chapters} />
      <VBrandBar accentColor={accentColor} title={title} brand={brand} />
      <VPersistentChapterLabel chapters={chapters} accentColor={accentColor} />
      <VWaveform audioSrc={audioSrc} accentColor={accentColor} />

      {cues.map((cue) => {
        const start = cue.startSec * subtitleTimeScale + subtitleOffsetSec;
        const end = cue.endSec * subtitleTimeScale + subtitleOffsetSec;
        const from = Math.max(0, secToFrames(start, fps));
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

      {chapters.map((ch, i) => {
        const src = chapterImageSrcs[i];
        if (!src) return null;
        return (
          <Sequence
            key={`ch-img-${i}`}
            from={secToFrames(ch.atSec, fps)}
            durationInFrames={secToFrames(CHAPTER_IMAGE_CARD_SEC, fps)}
          >
            <VChapterImageCard
              index={i + 1}
              title={ch.title}
              imageSrc={src}
              accentColor={accentColor}
            />
          </Sequence>
        );
      })}

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
}> = ({coverSrc, chapters, chapterImageSrcs}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const curSec = frame / fps;
  const scale = 1 + frame * 0.0003;

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

  // 第一章 atSec 之前 cover 全亮；进入第一章后淡出，让位章节图
  const baseCoverOpacity =
    chapters.length > 0
      ? interpolate(curSec, [chapters[0].atSec, chapters[0].atSec + 0.8], [0.95, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 0.95;

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
            transform: `scale(${scale})`,
            opacity: baseCoverOpacity,
          }}
        />
        {chapterImageSrcs.map((src, i) =>
          src && chapterOpacities[i] > 0.001 ? (
            <Img
              key={i}
              src={src}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: `scale(${scale})`,
                opacity: chapterOpacities[i] * 0.95,
              }}
            />
          ) : null,
        )}
      </AbsoluteFill>
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
              top: -3,
              width: 3,
              height: 12,
              transform: 'translateX(-50%)',
              backgroundColor: passed ? accentColor : 'rgba(255,255,255,0.55)',
              boxShadow: passed ? `0 0 10px ${accentColor}` : 'none',
              borderRadius: 1,
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
  const enterSec = curSec - active.atSec;
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
          backgroundColor: 'rgba(6, 9, 15, 0.72)',
          padding: '14px 28px',
          borderRadius: 999,
          backdropFilter: 'blur(8px)',
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
        top: 900,
        left: 0,
        right: 0,
        height: 260,
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
          const h = Math.max(8, Math.min(220, v * 850));
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
          backgroundColor: 'rgba(6, 9, 15, 0.85)',
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
          backdropFilter: 'blur(12px)',
          borderTop: `4px solid ${style.color}`,
          boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
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
          backgroundColor: 'rgba(6, 9, 15, 0.92)',
          borderRadius: 18,
          backdropFilter: 'blur(16px)',
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
  return (
    <AbsoluteFill
      style={{
        backgroundColor: `rgba(0, 0, 0, ${opacity * 0.78})`,
        backdropFilter: `blur(${opacity * 12}px)`,
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 60px',
      }}
    >
      <div
        style={{
          color: accentColor,
          fontSize: 220,
          lineHeight: 0.4,
          fontFamily: 'serif',
          opacity: opacity * 0.7,
          marginBottom: 48,
          textShadow: `0 0 60px ${accentColor}aa`,
        }}
      >
        “
      </div>
      <div
        style={{
          color: '#fff',
          fontSize: 100,
          fontWeight: 700,
          lineHeight: 1.3,
          textAlign: 'center',
          opacity,
          transform: `translateY(${(1 - fadeIn) * 30}px)`,
          textShadow: '0 6px 40px rgba(0,0,0,0.6)',
          fontFamily: '"Noto Serif SC", "PingFang SC", serif',
        }}
      >
        {text}
      </div>
      <div
        style={{
          width: 100,
          height: 3,
          backgroundColor: accentColor,
          marginTop: 60,
          opacity,
          boxShadow: `0 0 20px ${accentColor}`,
        }}
      />
    </AbsoluteFill>
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
  const fadeOut = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
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
          }}
        >
          《{title}》
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ============================================================ */
const VChapterImageCard: React.FC<{
  index: number;
  title: string;
  imageSrc: string;
  accentColor: string;
}> = ({index, title, imageSrc, accentColor}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  const opacity = interpolate(
    frame,
    [0, 6, durationInFrames - 10, durationInFrames],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
  const scale = interpolate(frame, [0, durationInFrames], [1.08, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleY = interpolate(frame, [0, 14], [40, 0], {extrapolateRight: 'clamp'});
  const titleOpacity = interpolate(
    frame,
    [4, 14, durationInFrames - 8, durationInFrames],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

  return (
    <AbsoluteFill style={{opacity}}>
      <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#06090f'}}>
        <Img
          src={imageSrc}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${scale})`,
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(6,9,15,0.15) 0%, rgba(6,9,15,0) 45%, rgba(6,9,15,0.55) 75%, rgba(6,9,15,0.95) 100%)',
        }}
      />
      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingBottom: 360,
          paddingLeft: 60,
          paddingRight: 60,
          fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <div
          style={{
            color: accentColor,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 8,
            fontFamily: '"SF Mono", Menlo, monospace',
            marginBottom: 18,
            textShadow: '0 2px 12px rgba(0,0,0,0.8)',
          }}
        >
          CHAPTER {String(index).padStart(2, '0')}
        </div>
        <div
          style={{
            color: '#fff',
            fontSize: 72,
            fontWeight: 800,
            lineHeight: 1.15,
            textAlign: 'center',
            textShadow: '0 4px 24px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.7)',
            maxWidth: 900,
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 28,
            width: 80,
            height: 4,
            borderRadius: 2,
            backgroundColor: accentColor,
            boxShadow: `0 0 16px ${accentColor}`,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
