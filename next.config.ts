import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Remotion 的 bundler/renderer 是服务端 Node 库，包含 webpack 自身和原生 loader，
  // 不能让 Next.js 的 webpack 把它打进 bundle。
  serverExternalPackages: ['@remotion/bundler', '@remotion/renderer'],
};

export default nextConfig;
