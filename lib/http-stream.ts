import {createReadStream, promises as fs} from 'node:fs';
import {Readable} from 'node:stream';

export type StreamFileOptions = {
  filePath: string;
  contentType: string;
  rangeHeader: string | null;
  extraHeaders?: Record<string, string>;
};

function parseRange(rangeHeader: string, size: number): {start: number; end: number} | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!m) return null;
  const startStr = m[1];
  const endStr = m[2];
  let start: number;
  let end: number;
  if (startStr === '' && endStr === '') return null;
  if (startStr === '') {
    // suffix: 最后 N 字节
    const suffix = Number.parseInt(endStr, 10);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number.parseInt(startStr, 10);
    end = endStr === '' ? size - 1 : Number.parseInt(endStr, 10);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  }
  if (start < 0 || start >= size || end < start) return null;
  end = Math.min(end, size - 1);
  return {start, end};
}

// 流式返回文件，支持 Range（音频/视频 seek、大文件不爆内存）。
export async function streamFileResponse(opts: StreamFileOptions): Promise<Response> {
  let stat;
  try {
    stat = await fs.stat(opts.filePath);
  } catch {
    return new Response('not found', {status: 404});
  }
  const size = stat.size;
  const baseHeaders: Record<string, string> = {
    'Content-Type': opts.contentType,
    'Accept-Ranges': 'bytes',
    ...(opts.extraHeaders ?? {}),
  };

  if (opts.rangeHeader) {
    const range = parseRange(opts.rangeHeader, size);
    if (!range) {
      return new Response('Invalid Range', {
        status: 416,
        headers: {...baseHeaders, 'Content-Range': `bytes */${size}`},
      });
    }
    const {start, end} = range;
    const chunkSize = end - start + 1;
    const nodeStream = createReadStream(opts.filePath, {start, end});
    return new Response(Readable.toWeb(nodeStream) as ReadableStream, {
      status: 206,
      headers: {
        ...baseHeaders,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': String(chunkSize),
      },
    });
  }

  const nodeStream = createReadStream(opts.filePath);
  return new Response(Readable.toWeb(nodeStream) as ReadableStream, {
    status: 200,
    headers: {
      ...baseHeaders,
      'Content-Length': String(size),
    },
  });
}
