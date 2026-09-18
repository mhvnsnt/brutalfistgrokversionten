import { c as require_jsx_runtime } from "../_libs/@react-three/drei+[...].mjs";
import { d as getAllBannonFighters } from "./routes-DbIfrPB2.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ConceptArtGallery-BR6LBoln.js
var import_jsx_runtime = require_jsx_runtime();
function ConceptArtGallery({ onBack }) {
	const fighters = getAllBannonFighters().filter((f, i, arr) => arr.findIndex((x) => x.id === f.id) === i);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 overflow-auto bg-bg text-fg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto max-w-6xl px-4 py-6 md:px-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "mb-6 flex items-end justify-between border-b border-border pb-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-mono text-[10px] tracking-[0.35em] text-subtle",
						children: "ART BOOK"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-1 text-3xl font-semibold tracking-tight",
						children: "CONCEPT vs PIXEL"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 max-w-xl text-sm text-muted",
						children: "Select-screen plates stay full resolution. Pixel copies are the in-fight HUD sprites — same identity, different surface."
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: onBack,
					className: "h-10 rounded-[var(--radius-sm)] border border-border px-4 font-mono text-xs tracking-[0.2em] text-muted hover:text-fg",
					children: "BACK"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
				children: fighters.map((f) => {
					const concept = f.conceptArtUrl ?? `/portraits/concept/${f.id}.jpg?v=ai3`;
					const pixel = f.pixelPortrait ?? `/portraits/pixel/${f.id}.png`;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
						className: "overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: concept,
								alt: `${f.name} concept`,
								className: "aspect-square w-full object-cover"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: pixel,
								alt: `${f.name} pixel`,
								className: "aspect-square w-full object-cover",
								style: { imageRendering: "pixelated" }
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between px-3 py-2 font-mono",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-sm tracking-[0.12em]",
								children: f.name.toUpperCase()
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] tracking-[0.2em] text-subtle",
								children: "HQ / 64"
							})]
						})]
					}, f.id);
				})
			})]
		})
	});
}
//#endregion
export { ConceptArtGallery as default };
