import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'podcast.cab · 播客视频生成器',
  description: '上传音频和字幕，一键生成带封面/章节/金句的可发布视频。podcast.cab 出品。',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
