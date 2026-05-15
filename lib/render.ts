import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import type {PodcastProps} from '@/remotion/Composition';

const BUNDLE_DIR = process.env.REMOTION_BUNDLE_DIR || '/tmp/podcast-cab-bundle';

// 只在生产模式缓存 serveUrl——dev 模式不缓存，让改了 remotion/Composition.tsx 后立刻生效，
// 不需要重启容器
let cachedServeUrl: string | null = null;

async function getServeUrl(): Promise<string> {
  if (process.env.NODE_ENV === 'production' && cachedServeUrl) return cachedServeUrl;
  const entryPoint = path.resolve(process.cwd(), 'remotion/index.ts');
  const serveUrl = await bundle({
    entryPoint,
    outDir: BUNDLE_DIR,
    webpackOverride: (config) => config,
  });
  if (process.env.NODE_ENV === 'production') cachedServeUrl = serveUrl;
  return serveUrl;
}

export type RenderOptions = {
  inputProps: PodcastProps;
  outputPath: string;
  onProgress?: (stage: 'bundling' | 'rendering', progress: number) => void;
};

export async function renderVideo({inputProps, outputPath, onProgress}: RenderOptions): Promise<void> {
  onProgress?.('bundling', 0);
  const serveUrl = await getServeUrl();
  onProgress?.('bundling', 1);

  const composition = await selectComposition({
    serveUrl,
    id: 'PodcastVertical',
    inputProps,
  });

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    onProgress: ({progress}) => onProgress?.('rendering', progress),
    chromiumOptions: {
      headless: true,
    },
  });
}
