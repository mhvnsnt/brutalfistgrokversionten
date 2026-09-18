import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: false,
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],

  webpack(config, { dev }) {
if (dev) {
    config.module.rules.push({
      test: /\.(jsx|tsx)$/,
      exclude: [/node_modules/],
      use: [{
        loader: '@dhiwise/component-tagger/nextLoader',
      }],
    });
  }

    return config;
  }
};

export default nextConfig;
