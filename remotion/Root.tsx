import React from 'react';
import {Composition} from 'remotion';
import {PodcastVertical, podcastSchema, type PodcastProps} from './Composition';

const DEFAULT_PROPS: PodcastProps = {
  audioSrc: 'http://localhost:3000/empty.mp3',
  srtSrc: 'http://localhost:3000/empty.srt',
  coverSrc: 'http://localhost:3000/empty.jpg',
  title: '播客标题',
  subtitle: '副标题',
  accentColor: '#fbbf24',
  speakers: {
    主持: {label: '主持', color: '#38bdf8', align: 'left'},
    嘉宾: {label: '嘉宾', color: '#fbbf24', align: 'right'},
  },
  subtitleOffsetSec: 0,
  subtitleTimeScale: 1,
  hook: {number: '8 年', text: '他亏了 8 年，才搞懂这一件事'},
  chapters: [{atSec: 0, title: '第一章'}],
  chapterImageSrcs: [],
  quotes: [],
  hookDurationSec: 3,
  posterDurationSec: 1,
  introDurationSec: 5,
  outroDurationSec: 5,
  audioDurationSec: 60,
};

export const Root: React.FC = () => {
  return (
    <Composition
      id="PodcastVertical"
      component={PodcastVertical}
      schema={podcastSchema}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={2100}
      defaultProps={DEFAULT_PROPS}
      calculateMetadata={({props}) => {
        const total =
          props.hookDurationSec +
          props.posterDurationSec +
          props.introDurationSec +
          props.audioDurationSec +
          props.outroDurationSec;
        return {durationInFrames: Math.ceil(total * 30)};
      }}
    />
  );
};
