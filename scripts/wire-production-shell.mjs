#!/usr/bin/env node
/**
 * Nitro inlines the source index.html as the production document. That file
 * points at /src/rocket-main.tsx, which is not a built module, so the browser
 * gets HTML for a script request. After vite build, point the renderer at the
 * emitted client shell (createRoot), never the TanStack hydrate entry.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const staticDir = join(root, ".vercel/output/static");
const renderer = join(
  root,
  ".vercel/output/functions/__server.func/_chunks/renderer-template.mjs",
);

function findCreateRootEntry() {
  const assets = join(staticDir, "assets");
  if (!existsSync(assets)) return null;
  for (const name of readdirSync(assets)) {
    if (!name.endsWith(".js")) continue;
    const text = readFileSync(join(assets, name), "utf8");
    if (text.includes("Preview runtime error")) return `/assets/${name}`;
  }
  return null;
}

function shellHtml() {
  const emitted = join(staticDir, "index.html");
  if (existsSync(emitted)) {
    const html = readFileSync(emitted, "utf8");
    if (!html.includes("/src/rocket-main.tsx") && html.includes("/assets/")) return html;
  }
  const entry = findCreateRootEntry();
  if (!entry) return null;
  const cssName = existsSync(join(staticDir, "assets"))
    ? readdirSync(join(staticDir, "assets")).find(
        (name) => name.endsWith(".css") && (name.startsWith("styles-") || name.startsWith("index-")),
      )
    : null;
  const css = cssName ? `\n    <link rel="stylesheet" href="/assets/${cssName}" />` : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0a0a0b" />
    <meta name="description" content="Brutal Fist — 3D PS1-style fighting game with the Bannon roster." />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="manifest" href="/__grok/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/__grok/icon-180.png" />${css}
    <title>Brutal Fist</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${entry}"></script>
  </body>
</html>
`;
}

if (!existsSync(renderer)) {
  console.error("[wire-production-shell] no renderer template; build did not emit a server");
  process.exit(1);
}

const html = shellHtml();
if (!html) {
  console.error("[wire-production-shell] no createRoot client shell in the build");
  process.exit(1);
}

const source = readFileSync(renderer, "utf8");
const importLine =
  source.match(/import\s*\{[^}]*HTTPResponse[^}]*\}\s*from\s*"[^"]+";/)?.[0] ??
  `import { r as HTTPResponse } from "../_libs/h3+rou3+srvx.mjs";`;
const rewritten = `${importLine}
var rendererTemplate = () => new HTTPResponse(${JSON.stringify(html)}, { headers: { "content-type": "text/html; charset=utf-8" } });
function renderIndexHTML() {
  return rendererTemplate();
}
export { renderIndexHTML as default };
`;
if (!source.includes("HTTPResponse") && !source.includes("renderIndexHTML")) {
  console.error("[wire-production-shell] renderer template shape changed");
  process.exit(1);
}
writeFileSync(renderer, rewritten);
if (html.includes("/src/rocket-main.tsx")) {
  console.error("[wire-production-shell] shell still points at the source module");
  process.exit(1);
}
console.log("[wire-production-shell] production document loads the built client");
