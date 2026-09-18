import { a as __toESM } from "../_runtime.mjs";
import { c as require_jsx_runtime, l as require_react } from "../_libs/@react-three/drei+[...].mjs";
import { d as getAllBannonFighters } from "./routes-DbIfrPB2.mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { a as string, i as object, t as _enum } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/PhotoBoothScreen-DhZVeNcf.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var Input = object({
	prompt: string().min(8).max(1200),
	imageBase64: string().max(6e6).optional(),
	mode: _enum(["portrait", "stage"]).default("portrait")
});
var generateBoothArt = createServerFn({ method: "POST" }).validator((input) => Input.parse(input)).handler(createSsrRpc("3a26ed3112df3c87e18fd433b94bd4b6b51bb3fac9f6521cf1ac8721970e38aa"));
function pixelateDataUrl(src, cells = 64) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			const small = document.createElement("canvas");
			small.width = cells;
			small.height = cells;
			const sctx = small.getContext("2d");
			if (!sctx) {
				reject(/* @__PURE__ */ new Error("no 2d"));
				return;
			}
			sctx.imageSmoothingEnabled = false;
			sctx.drawImage(img, 0, 0, cells, cells);
			const out = document.createElement("canvas");
			out.width = 256;
			out.height = 256;
			const octx = out.getContext("2d");
			if (!octx) {
				reject(/* @__PURE__ */ new Error("no 2d"));
				return;
			}
			octx.imageSmoothingEnabled = false;
			octx.drawImage(small, 0, 0, 256, 256);
			resolve(out.toDataURL("image/png"));
		};
		img.onerror = () => reject(/* @__PURE__ */ new Error("image load failed"));
		img.src = src;
	});
}
/** Shrink a photo to a ControlNet-sized JPEG so the booth request stays under the payload cap. */
function downscaleDataUrl(src, maxEdge = 768, quality = .82) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
			const w = Math.max(1, Math.round(img.width * scale));
			const h = Math.max(1, Math.round(img.height * scale));
			const c = document.createElement("canvas");
			c.width = w;
			c.height = h;
			const ctx = c.getContext("2d");
			if (!ctx) {
				reject(/* @__PURE__ */ new Error("no 2d"));
				return;
			}
			ctx.drawImage(img, 0, 0, w, h);
			resolve(c.toDataURL("image/jpeg", quality));
		};
		img.onerror = () => reject(/* @__PURE__ */ new Error("image load failed"));
		img.src = src;
	});
}
var KEY = "bf-booth-gallery-v1";
var MUG_KEY = "bf-select-mugs-v1";
function loadBoothGallery() {
	try {
		return JSON.parse(localStorage.getItem(KEY) ?? "[]");
	} catch {
		return [];
	}
}
function saveBoothShot(shot) {
	const next = [shot, ...loadBoothGallery()].slice(0, 24);
	localStorage.setItem(KEY, JSON.stringify(next));
	return next;
}
function setSelectMugOverride(fighterId, concept) {
	const map = (() => {
		try {
			return JSON.parse(localStorage.getItem(MUG_KEY) ?? "{}");
		} catch {
			return {};
		}
	})();
	map[fighterId] = concept;
	localStorage.setItem(MUG_KEY, JSON.stringify(map));
	window.dispatchEvent(new Event("bf-select-mugs"));
}
var POSES = [
	{
		id: "bust",
		label: "SELECT BUST",
		extra: "three-quarter bust, chin slightly down, eyes on camera"
	},
	{
		id: "guard",
		label: "GUARD STANCE",
		extra: "hands up in a fighting guard, weight on back foot"
	},
	{
		id: "victory",
		label: "VICTORY",
		extra: "one fist raised, roar, sweat and rim light"
	},
	{
		id: "stage",
		label: "STAGE PLATE",
		extra: ""
	}
];
function PhotoBoothScreen({ onBack }) {
	const fighters = (0, import_react.useMemo)(() => getAllBannonFighters(), []);
	const [pose, setPose] = (0, import_react.useState)(POSES[0].id);
	const [fighterId, setFighterId] = (0, import_react.useState)(fighters[0]?.id ?? "bannon");
	const [prompt, setPrompt] = (0, import_react.useState)("Underground wrestling champion, scarred, midnight leather, cold steel light");
	const [fileData, setFileData] = (0, import_react.useState)();
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const [concept, setConcept] = (0, import_react.useState)(null);
	const [pixel, setPixel] = (0, import_react.useState)(null);
	const [gallery, setGallery] = (0, import_react.useState)(() => typeof window === "undefined" ? [] : loadBoothGallery());
	const fighter = fighters.find((f) => f.id === fighterId);
	const isStage = pose === "stage";
	async function onFile(file) {
		const reader = new FileReader();
		reader.onload = () => setFileData(String(reader.result ?? ""));
		reader.readAsDataURL(file);
	}
	async function generate() {
		setBusy(true);
		setError(null);
		const poseMeta = POSES.find((p) => p.id === pose);
		const full = isStage ? `Fighting game arena: ${prompt}` : `${fighter?.name ?? "Fighter"}, ${fighter?.fightingStyle ?? "striker"}. ${poseMeta?.extra}. ${prompt}`;
		let control = fileData;
		if (!control && !isStage && fighter?.conceptArtUrl) try {
			control = await downscaleDataUrl(fighter.conceptArtUrl, 768);
		} catch {
			control = void 0;
		}
		else if (control) try {
			control = await downscaleDataUrl(control, 768);
		} catch {}
		const result = await generateBoothArt({ data: {
			prompt: full,
			imageBase64: control?.includes(",") ? control.split(",")[1] : control,
			mode: isStage ? "stage" : "portrait"
		} });
		if (!result.ok) {
			setError(result.error);
			setBusy(false);
			return;
		}
		const pix = await pixelateDataUrl(result.image, 64);
		setConcept(result.image);
		setPixel(pix);
		const shot = {
			id: `${Date.now()}`,
			createdAt: Date.now(),
			mode: isStage ? "stage" : "portrait",
			prompt: full,
			concept: result.image,
			pixel: pix,
			fighterId: isStage ? void 0 : fighterId
		};
		setGallery(saveBoothShot(shot));
		setBusy(false);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 overflow-auto bg-bg text-fg font-mono",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex min-h-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "flex items-end justify-between gap-4 border-b border-border pb-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[10px] tracking-[0.35em] text-subtle",
							children: "CONTROLNET BOOTH"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "mt-1 text-3xl font-semibold tracking-tight",
							children: "PHOTO STUDIO"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 max-w-xl text-sm text-muted",
							children: "Pose reference in, high-res concept art out. Pixel copies stay for in-fight HUD. Select boxes always use the clean plate."
						})
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onBack,
						className: "h-10 rounded-[var(--radius-sm)] border border-border px-4 text-xs tracking-[0.2em] text-muted hover:text-fg",
						children: "BACK"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "space-y-4 rounded-[var(--radius-lg)] border border-border bg-surface p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid grid-cols-2 gap-2 sm:grid-cols-4",
								children: POSES.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setPose(p.id),
									className: `h-10 rounded-[var(--radius-sm)] border text-[10px] tracking-[0.16em] ${pose === p.id ? "border-accent bg-elevated text-fg" : "border-border text-subtle hover:text-fg"}`,
									children: p.label
								}, p.id))
							}),
							!isStage && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "block text-[10px] tracking-[0.2em] text-subtle",
								children: ["FIGHTER", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
									value: fighterId,
									onChange: (e) => setFighterId(e.target.value),
									className: "mt-2 h-10 w-full rounded-[var(--radius-sm)] border border-border bg-bg px-3 text-sm text-fg",
									children: fighters.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: f.id,
										children: f.name
									}, f.id))
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "block text-[10px] tracking-[0.2em] text-subtle",
								children: ["POSE / CONTROL PHOTO", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "file",
									accept: "image/*",
									className: "mt-2 block w-full text-xs text-muted",
									onChange: (e) => {
										const file = e.target.files?.[0];
										if (file) onFile(file);
									}
								})]
							}),
							fileData && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: fileData,
								alt: "",
								className: "h-28 w-28 rounded-[var(--radius-sm)] object-cover"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "block text-[10px] tracking-[0.2em] text-subtle",
								children: ["LOOK", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
									value: prompt,
									onChange: (e) => setPrompt(e.target.value),
									rows: 4,
									className: "mt-2 w-full rounded-[var(--radius-md)] border border-border bg-bg p-3 text-sm text-fg"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								disabled: busy,
								onClick: () => void generate(),
								className: "h-11 w-full rounded-[var(--radius-md)] bg-accent text-sm font-semibold tracking-[0.18em] text-accent-fg disabled:opacity-50",
								children: busy ? "EXPOSING…" : "SHOOT"
							}),
							error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-sm text-p2",
								children: error
							}),
							concept && !isStage && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => {
									setSelectMugOverride(fighterId, concept);
								},
								className: "h-10 w-full rounded-[var(--radius-sm)] border border-border text-[10px] tracking-[0.2em] text-muted hover:text-fg",
								children: "USE ON SELECT GRID"
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "grid gap-3 sm:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figure", {
							className: "overflow-hidden rounded-[var(--radius-lg)] border border-border bg-elevated",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("figcaption", {
								className: "px-3 py-2 text-[10px] tracking-[0.25em] text-subtle",
								children: "CONCEPT / SELECT"
							}), concept ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: concept,
								alt: "Concept art",
								className: "aspect-[3/4] w-full object-cover"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex aspect-[3/4] items-center justify-center text-xs tracking-[0.2em] text-subtle",
								children: "NO PLATE"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figure", {
							className: "overflow-hidden rounded-[var(--radius-lg)] border border-border bg-elevated",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("figcaption", {
								className: "px-3 py-2 text-[10px] tracking-[0.25em] text-subtle",
								children: "PIXEL / IN-GAME"
							}), pixel ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: pixel,
								alt: "Pixel sprite",
								className: "aspect-[3/4] w-full object-cover",
								style: { imageRendering: "pixelated" }
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex aspect-[3/4] items-center justify-center text-xs tracking-[0.2em] text-subtle",
								children: "NO SPRITE"
							})]
						})]
					})]
				}),
				gallery.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-3 text-[10px] tracking-[0.3em] text-subtle",
					children: "SESSION ROLLS"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid grid-cols-3 gap-2 sm:grid-cols-6",
					children: gallery.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => {
							setConcept(g.concept);
							setPixel(g.pixel);
						},
						className: "overflow-hidden rounded-[var(--radius-sm)] border border-border",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: g.concept,
							alt: "",
							className: "aspect-square w-full object-cover"
						})
					}, g.id))
				})] })
			]
		})
	});
}
//#endregion
export { PhotoBoothScreen as default };
