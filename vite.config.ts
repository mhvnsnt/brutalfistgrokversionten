import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
// @ts-expect-error JS plugin alongside the TS vite config
import { grokPwaPlugin } from "./scripts/grok-pwa-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { appEnvPlugin } from "./scripts/app-env-plugin.mjs";
import { isMigrationFile } from "./scripts/migration-plan.mjs";

/** The files `src/lib/db.ts` globs — same directory, same non-recursive scope. */
function hasGlobbedMigrations(root: string): boolean {
  try {
    return readdirSync(join(root, "migrations")).some(isMigrationFile);
  } catch {
    return false;
  }
}

/**
 * Finish PGLite bootstrap during dev-server setup (before traffic). Vite awaits
 * async `configureServer` hooks. Production: `src/lib/db` kicks `ensureDbReady`
 * on import.
 *
 * Vite awaiting the hook puts this on time-to-first-render, so an app with no
 * migrations — no schema to apply — skips it entirely rather than paying for a
 * PGLite instance it never queries.
 */
function pgliteBootstrapPlugin(): Plugin {
  return {
    name: "app-builder:pglite-bootstrap",
    apply: "serve",
    async configureServer(server) {
      // Rocket's embedded preview has auth/database disabled. Do not make the
      // first HTML response wait for PGLite migrations; the DB remains lazy
      // for code paths that explicitly use it.
      if (process.env.ROCKET_PREVIEW === "1") return;
      if (!hasGlobbedMigrations(server.config.root)) return;
      try {
        const mod = (await server.ssrLoadModule("/src/lib/db.ts")) as {
          ensureDbReady?: () => Promise<void>;
        };
        if (typeof mod.ensureDbReady === "function") {
          await mod.ensureDbReady();
        }
      } catch (err) {
        console.error("[app-builder] DB bootstrap failed:", err);
        throw err;
      }
    },
  };
}

/**
 * Live-preview OAuth popup — handled HERE so the agent never has to create a
 * `/auth/popup` route (and cannot break it by scaffolding a React page that
 * paints the full app shell in the popup).
 *
 * `signIn` (client.ts) opens `/auth/popup?providerId=…` in a top-level window.
 * This middleware runs before TanStack Start, calls `handleAuthPopupRequest`,
 * and returns the 302 / completion HTML. Deployed apps do not use the popup
 * (full-page OAuth redirect), so `apply: "serve"` is enough.
 */
function authPopupPlugin(): Plugin {
  return {
    name: "app-builder:auth-popup",
    apply: "serve",
    configureServer(server) {
      // Register immediately (not in a returned post-hook) so we run BEFORE
      // TanStack Start / the SPA HTML fallback. A model-authored
      // `src/routes/auth/popup.tsx` React page must never win this path.
      server.middlewares.use(async (req, res, next) => {
        try {
          const rawUrl = req.url ?? "";
          const pathOnly = rawUrl.split("?", 1)[0] ?? "";
          if (pathOnly !== "/auth/popup") {
            next();
            return;
          }
          if ((req.method ?? "GET").toUpperCase() !== "GET") {
            res.statusCode = 405;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("Method Not Allowed");
            return;
          }

          const host = String(
            req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:8080",
          );
          const proto = String(
            req.headers["x-forwarded-proto"] ??
              ((req.socket as { encrypted?: boolean } | undefined)?.encrypted ? "https" : "http"),
          );
          const requestHeaders = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (value === undefined) continue;
            if (Array.isArray(value)) {
              for (const v of value) requestHeaders.append(key, v);
            } else {
              requestHeaders.set(key, value);
            }
          }
          // Ensure Host is the public preview host so Better Auth's dynamic
          // baseURL / redirect_uri match the popup origin.
          if (!requestHeaders.has("host")) requestHeaders.set("host", host);

          const request = new Request(`${proto}://${host}${rawUrl}`, {
            method: "GET",
            headers: requestHeaders,
          });

          const mod = (await server.ssrLoadModule("/src/lib/auth/popup.server.ts")) as {
            handleAuthPopupRequest: (req: Request) => Promise<Response>;
          };
          const response = await mod.handleAuthPopupRequest(request);

          res.statusCode = response.status;
          // Preserve multiple Set-Cookie headers (OAuth state + session).
          const setCookies =
            typeof response.headers.getSetCookie === "function"
              ? response.headers.getSetCookie()
              : [];
          response.headers.forEach((value, key) => {
            if (key.toLowerCase() === "set-cookie") return;
            res.setHeader(key, value);
          });
          for (const cookie of setCookies) {
            res.appendHeader("set-cookie", cookie);
          }
          const body = Buffer.from(await response.arrayBuffer());
          res.end(body);
        } catch (err) {
          console.error("[app-builder] /auth/popup handler failed:", err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("auth popup failed");
          }
        }
      });
    },
  };
}

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const rocketPreview = process.env.ROCKET_PREVIEW === "1";

/**
 * Where the built app will be served from.
 *
 * GitHub Pages serves a project site under `/<repo>/`, not the domain root, so
 * every absolute asset URL 404s unless the build knows its base. Everything
 * else (Rocket, Vercel, a local preview) serves from `/`.
 *
 * The service worker and the manifest are deliberately SCOPE-RELATIVE, so they
 * need no build-time knowledge of this — only the bundle's own asset URLs do.
 */
const basePath = process.env.PUBLIC_BASE_PATH ?? "/";

// `0.0.0.0:8080` is the live-preview contract — don't change host/port.
// The dev server starts once `src/router.tsx` and `src/routes/` exist — see
// AGENTS.md § "First scaffold".
export default defineConfig(({ command, isPreview }) => ({
  base: basePath,
  // SET EXPLICITLY BECAUSE DEV AND THE BUILD DISAGREED WITHOUT IT.
  // MEASURED against the running dev server: `/motion/baked/index.json`
  // 404'd while `/public/motion/baked/index.json` returned 200, so the
  // public directory was being served as a literal subpath. The built
  // output has `motion/` at its root and is correct, which made this a
  // dev-only discrepancy — and a nasty one, because every local probe of
  // models, clips and manifests measured a game with no assets in it while
  // the deployed build was fine.
  publicDir: join(rootDir, "public"),
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
    // Rocket embeds this behind its own preview proxy. `hmr: false` is kept
    // for any dev-server use, but it is NOT sufficient on its own - MEASURED:
    // a Vite DEV server still injects `<script src="/@vite/client">` into the
    // HTML with hmr disabled, and that client still tries to open a socket.
    // That is why `rocket:preview` serves the BUILT bundle instead (below).
    ...(rocketPreview ? { hmr: false } : {}),
  },
  preview: {
    // Rocket's contract is 0.0.0.0:8080; everything else previews on 8081.
    host: rocketPreview ? "0.0.0.0" : "127.0.0.1",
    port: rocketPreview ? 8080 : 8081,
    strictPort: true,
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      "next/dynamic": join(rootDir, "src/shims/next-dynamic.tsx"),
    },
  },
  plugins: [
    pgliteBootstrapPlugin(),
    // Rocket gets a browser-only Vite shell: no SSR/router middleware is
    // allowed to sit on the critical path for the embedded preview.
    ...(rocketPreview ? [] : [authPopupPlugin()]),
    // Dev-only /__app-env, read by scripts/check-auth-invariant.mjs.
    appEnvPlugin(),
    // PWA head + ?install=1 tutorial page; runs before Start/Nitro.
    grokPwaPlugin(),
    tailwindcss(),
    ...(rocketPreview ? [] : [tanstackStart()]),
    // Nitro/Vercel is the deploy target for the real build. Rocket's preview
    // wants a plain static SPA it can serve with no server runtime, so the
    // server preset is skipped when ROCKET_PREVIEW is set - otherwise the
    // build emits only `.vercel/output` and there is no static shell to serve.
    ...((command === "build" || isPreview) && !rocketPreview
      ? [
          nitro({
            preset: "vercel",
            // Auto-registers server/middleware/* (the PWA install page +
            // manifest + head-tag middleware). Nitro v3 defaults serverDir to
            // false, so removing this silently unwires /?install=1 on deploys.
            serverDir: "./server",
          }),
        ]
      : []),
    viteReact(),
  ],
}));
