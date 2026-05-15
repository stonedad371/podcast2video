import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Remotion 的 bundler/renderer 是服务端 Node 库，包含 webpack 自身和原生 loader，
  // 不能让 Next.js 的 webpack 把它打进 bundle。
  serverExternalPackages: ['@remotion/bundler', '@remotion/renderer'],
  // Remotion 渲染时 Chromium 从内置 bundle server（http://localhost:3001）加载页面，
  // 但 <Img>/<Audio>/<fetch> 拉的是 http://127.0.0.1:3000/api/...——跨域。
  // 给资源路由打开 CORS，让 Chromium 能拉到。
  async headers() {
    return [
      {
        source: '/api/:route(files|cover|chapter-images)/:path*',
        headers: [
          {key: 'Access-Control-Allow-Origin', value: '*'},
          {key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS'},
        ],
      },
    ];
  },
};

export default nextConfig;
