import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: false,
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  turbopack: {
    resolveAlias: {
      // MEASURED: without this, `next dev` answers `/` with HTTP 500 and a fatal
      // Turbopack panic - "the chunking context does not support external
      // modules (request: node:async_hooks)" - so the route never compiles and
      // an embedded preview spins forever instead of showing an error.
      //
      // The chain is app/page.tsx -> src/App -> src/lib/app-data/readiness.ts
      // -> createServerFn from @tanstack/react-start -> start-storage-context
      // -> node:async_hooks. Vite's TanStack Start plugin compiles server
      // functions out of the client bundle; Turbopack has no such transform.
      //
      // Scoped to the Next surface only. The Vite runtime, which is the real
      // game, does not read this file.
      'node:async_hooks': './src/shims/async-hooks-browser.ts',
      async_hooks: './src/shims/async-hooks-browser.ts',
    },
  },
};

export default nextConfig;
