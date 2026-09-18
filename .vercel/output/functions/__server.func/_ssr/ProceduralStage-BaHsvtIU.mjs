import { a as __toESM } from "../_runtime.mjs";
import { a as useFrame, c as require_jsx_runtime, ct as PlaneGeometry, l as require_react } from "../_libs/@react-three/drei+[...].mjs";
import { r as resolveStageConfig } from "./StageConfig-DJ4pMRhO.mjs";
import { t as createNoise2D } from "../_libs/simplex-noise.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ProceduralStage-BaHsvtIU.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var FLOOR_WIDTH = 24;
var FLOOR_DEPTH = 10;
var P1_X = -1.8;
var P2_X = 1.8;
function TrainingStage({ p1Color, p2Color }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			rotation: [
				-Math.PI / 2,
				0,
				0
			],
			position: [
				0,
				0,
				0
			],
			receiveShadow: true,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [FLOOR_WIDTH, FLOOR_DEPTH] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: "#111111",
				roughness: .85,
				metalness: .15
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("gridHelper", {
			args: [
				FLOOR_WIDTH,
				24,
				"#222222",
				"#1a1a1a"
			],
			position: [
				0,
				.002,
				0
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				0,
				.003,
				0
			],
			rotation: [
				-Math.PI / 2,
				0,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [.04, FLOOR_DEPTH] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: "#facc15",
				emissive: "#facc15",
				emissiveIntensity: .4
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				0,
				3,
				-5
			],
			receiveShadow: true,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [FLOOR_WIDTH, 8] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: "#0a0a0a",
				roughness: 1
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				-12,
				3,
				0
			],
			rotation: [
				0,
				Math.PI / 2,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [FLOOR_DEPTH, 8] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: "#080808",
				roughness: 1
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				FLOOR_WIDTH / 2,
				3,
				0
			],
			rotation: [
				0,
				-Math.PI / 2,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [FLOOR_DEPTH, 8] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: "#080808",
				roughness: 1
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pointLight", {
			position: [
				P1_X,
				.5,
				0
			],
			intensity: 1.2,
			color: p1Color,
			distance: 4,
			decay: 2
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pointLight", {
			position: [
				P2_X,
				.5,
				0
			],
			intensity: 1.2,
			color: p2Color,
			distance: 4,
			decay: 2
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pointLight", {
			position: [
				0,
				6,
				-4
			],
			intensity: .6,
			color: "#1a1a2e",
			distance: 20,
			decay: 1
		})
	] });
}
function NeonStrip({ position, rotation, width, color, flickerSpeed = 1.3 }) {
	const lightRef = (0, import_react.useRef)(null);
	useFrame(({ clock }) => {
		if (!lightRef.current) return;
		const t = clock.elapsedTime * flickerSpeed;
		const flicker = .85 + .15 * Math.sin(t * 7.3) * Math.sin(t * 3.1);
		lightRef.current.intensity = 1.8 * flicker;
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", {
		position,
		rotation,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [
			width,
			.06,
			.06
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
			color,
			emissive: color,
			emissiveIntensity: 2.5
		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pointLight", {
			ref: lightRef,
			color,
			intensity: 1.8,
			distance: 6,
			decay: 2
		})]
	});
}
function BrickWallPanel({ position, rotation, width, height }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", {
		position,
		rotation,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
				receiveShadow: true,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [width, height] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
					color: "#1a1210",
					roughness: .95,
					metalness: 0
				})]
			}),
			Array.from({ length: Math.floor(height / .35) }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
				position: [
					0,
					-height / 2 + i * .35 + .175,
					.01
				],
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [width, .02] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
					color: "#0d0b09",
					roughness: 1
				})]
			}, `h${i}`)),
			Array.from({ length: Math.floor(height / .35) }).map((_, row) => Array.from({ length: Math.floor(width / .7) + 1 }).map((_, col) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
				position: [
					-width / 2 + col * .7 + (row % 2 === 0 ? 0 : .35),
					-height / 2 + row * .35 + .175,
					.012
				],
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [.02, .33] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
					color: "#0d0b09",
					roughness: 1
				})]
			}, `v${row}-${col}`)))
		]
	});
}
function ChainlinkFence({ position, rotation, width, height }) {
	const posts = Math.floor(width / 2.5) + 1;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", {
		position,
		rotation,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [width, height] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: "#080808",
				roughness: 1,
				transparent: true,
				opacity: .7
			})] }),
			Array.from({ length: posts }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
				position: [
					-width / 2 + i * (width / (posts - 1)),
					0,
					.05
				],
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [
					.06,
					height,
					.06
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
					color: "#2a2a2a",
					roughness: .6,
					metalness: .8
				})]
			}, `post${i}`)),
			[
				height / 2 - .1,
				0,
				-height / 2 + .1
			].map((y, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
				position: [
					0,
					y,
					.05
				],
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [
					width,
					.05,
					.05
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
					color: "#2a2a2a",
					roughness: .6,
					metalness: .8
				})]
			}, `rail${i}`))
		]
	});
}
function UrbanNightStage({ p1Color, p2Color }) {
	const P1_X = -1.8;
	const P2_X = 1.8;
	const FLOOR_W = 22;
	const FLOOR_D = 12;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			rotation: [
				-Math.PI / 2,
				0,
				0
			],
			position: [
				0,
				0,
				0
			],
			receiveShadow: true,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [FLOOR_W, FLOOR_D] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: "#1c1c1c",
				roughness: .92,
				metalness: .08
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				0,
				.003,
				0
			],
			rotation: [
				-Math.PI / 2,
				0,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [.03, FLOOR_D] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: "#141414",
				roughness: 1
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				-3,
				.003,
				0
			],
			rotation: [
				-Math.PI / 2,
				.15,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [.02, 5] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: "#141414",
				roughness: 1
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				4,
				.003,
				-1
			],
			rotation: [
				-Math.PI / 2,
				-.1,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [.02, 4] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: "#141414",
				roughness: 1
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				0,
				.004,
				0
			],
			rotation: [
				-Math.PI / 2,
				0,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [.05, FLOOR_D] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: "#facc15",
				emissive: "#facc15",
				emissiveIntensity: .15,
				transparent: true,
				opacity: .4
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				0,
				0,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("sphereGeometry", { args: [
				45,
				32,
				16
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshBasicMaterial", {
				color: "#050508",
				side: 1
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				0,
				4,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("cylinderGeometry", { args: [
				28,
				28,
				20,
				32,
				1,
				true
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshBasicMaterial", {
				color: "#0a0810",
				side: 1,
				transparent: true,
				opacity: .95
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrickWallPanel, {
			position: [
				0,
				3.5,
				-9
			],
			width: 22,
			height: 9
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrickWallPanel, {
			position: [
				-10,
				3.5,
				-4
			],
			rotation: [
				0,
				Math.PI / 2,
				0
			],
			width: 10,
			height: 9
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrickWallPanel, {
			position: [
				10,
				3.5,
				-4
			],
			rotation: [
				0,
				-Math.PI / 2,
				0
			],
			width: 10,
			height: 9
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChainlinkFence, {
			position: [
				0,
				2.5,
				-8.5
			],
			width: 22,
			height: 5
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NeonStrip, {
			position: [
				0,
				6.8,
				-8.8
			],
			width: 18,
			color: "#7c3aed",
			flickerSpeed: .9
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NeonStrip, {
			position: [
				-6,
				4.2,
				-8.7
			],
			width: 6,
			color: "#9333ea",
			flickerSpeed: 1.7
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NeonStrip, {
			position: [
				6,
				4.2,
				-8.7
			],
			width: 6,
			color: "#9333ea",
			flickerSpeed: 1.4
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NeonStrip, {
			position: [
				-8,
				.3,
				-7
			],
			rotation: [
				0,
				Math.PI / 2,
				0
			],
			width: 3,
			color: "#eab308",
			flickerSpeed: 2.1
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NeonStrip, {
			position: [
				8,
				.3,
				-7
			],
			rotation: [
				0,
				-Math.PI / 2,
				0
			],
			width: 3,
			color: "#eab308",
			flickerSpeed: 1.8
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NeonStrip, {
			position: [
				-9,
				3,
				-8.4
			],
			rotation: [
				0,
				Math.PI / 2,
				0
			],
			width: 2,
			color: "#06b6d4",
			flickerSpeed: 1.1
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NeonStrip, {
			position: [
				9,
				3,
				-8.4
			],
			rotation: [
				0,
				-Math.PI / 2,
				0
			],
			width: 2,
			color: "#dc2626",
			flickerSpeed: 1.6
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ambientLight", {
			intensity: .04,
			color: "#1a1020"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("spotLight", {
			position: [
				0,
				9,
				3
			],
			"target-position": [
				0,
				0,
				0
			],
			intensity: 4.5,
			color: "#6d28d9",
			angle: .35,
			penumbra: .5,
			distance: 18,
			decay: 1.5,
			castShadow: true,
			"shadow-mapSize-width": 1024,
			"shadow-mapSize-height": 1024
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("spotLight", {
			position: [
				-8,
				7,
				1
			],
			"target-position": [
				-4,
				0,
				-6
			],
			intensity: 3,
			color: "#7c3aed",
			angle: .45,
			penumbra: .7,
			distance: 20,
			decay: 1.5
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("spotLight", {
			position: [
				8,
				6,
				2
			],
			"target-position": [
				3,
				0,
				-2
			],
			intensity: 3.5,
			color: "#ca8a04",
			angle: .4,
			penumbra: .6,
			distance: 16,
			decay: 1.5
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("spotLight", {
			position: [
				0,
				5,
				-7
			],
			"target-position": [
				0,
				1,
				0
			],
			intensity: 2,
			color: "#1e40af",
			angle: .5,
			penumbra: .8,
			distance: 14,
			decay: 2
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pointLight", {
			position: [
				P1_X,
				.4,
				0
			],
			intensity: 1.5,
			color: p1Color,
			distance: 5,
			decay: 2
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pointLight", {
			position: [
				P2_X,
				.4,
				0
			],
			intensity: 1.5,
			color: p2Color,
			distance: 5,
			decay: 2
		})
	] });
}
function xmur3(str) {
	let h = 1779033703 ^ str.length;
	for (let i = 0; i < str.length; i++) {
		h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
		h = h << 13 | h >>> 19;
	}
	return () => {
		h = Math.imul(h ^ h >>> 16, 2246822507);
		h = Math.imul(h ^ h >>> 13, 3266489909);
		return (h ^= h >>> 16) >>> 0;
	};
}
function mulberry32(a) {
	return function() {
		let t = a += 1831565813;
		t = Math.imul(t ^ t >>> 15, t | 1);
		t ^= t + Math.imul(t ^ t >>> 7, t | 61);
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
var INDOOR = /* @__PURE__ */ new Set([
	"dojo",
	"wrestling_ring",
	"mma_octagon",
	"steel_cage",
	"subway"
]);
var UNIQUE_OUTDOOR = /* @__PURE__ */ new Set([
	"industrial",
	"ghetto_streets",
	"junkyard",
	"sky_crane",
	"spike_pit",
	"acid_pit",
	"grinder_pit",
	"gang_brawl"
]);
function ProceduralStage({ stageId, p1Color, p2Color, seed }) {
	const cfg = resolveStageConfig(stageId);
	const resolvedId = cfg.id;
	const rng = (0, import_react.useMemo)(() => mulberry32(xmur3(`${seed ?? "brutal"}:${resolvedId}`)()), [seed, resolvedId]);
	const noise2D = (0, import_react.useMemo)(() => createNoise2D(rng), [rng]);
	const halfW = Number.isFinite(cfg.boundaryX) ? cfg.boundaryX : 8;
	const halfD = Number.isFinite(cfg.boundaryZ) ? cfg.boundaryZ : 6;
	const floorW = Math.min(28, Math.max(10, halfW * 2.4));
	const floorD = Math.min(18, Math.max(8, halfD * 2.2));
	const indoor = INDOOR.has(resolvedId);
	const uniqueOutdoor = UNIQUE_OUTDOOR.has(resolvedId);
	const hideGeneric = indoor || uniqueOutdoor;
	const accent = cfg.accentColor;
	const ground = (0, import_react.useMemo)(() => {
		const geo = new PlaneGeometry(floorW, floorD, indoor ? 8 : 32, indoor ? 6 : 20);
		geo.rotateX(-Math.PI / 2);
		if (!indoor) {
			const pos = geo.attributes.position;
			for (let i = 0; i < pos.count; i++) {
				const x = pos.getX(i);
				const z = pos.getZ(i);
				const ring = Math.max(Math.abs(x) / (floorW * .18), Math.abs(z) / (floorD * .22));
				if (ring < 1) continue;
				const n = noise2D(x * .12, z * .12) * .18 + noise2D(x * .35, z * .35) * .07;
				pos.setY(i, n * Math.min(1, (ring - 1) * 1.4));
			}
			pos.needsUpdate = true;
			geo.computeVertexNormals();
		}
		return geo;
	}, [
		floorW,
		floorD,
		noise2D,
		indoor
	]);
	const buildings = (0, import_react.useMemo)(() => {
		if (hideGeneric) return [];
		const items = [];
		const count = 10 + Math.floor(rng() * 8);
		for (let i = 0; i < count; i++) {
			const side = rng() < .5 ? -1 : 1;
			items.push({
				pos: [
					side * (floorW * .42 + rng() * 4.2),
					(2.4 + rng() * 7.5) / 2,
					(rng() - .5) * floorD * .95
				],
				scale: [
					1.1 + rng() * 2.2,
					2.4 + rng() * 7.5,
					1.1 + rng() * 2.2
				],
				rot: rng() * .2,
				windows: rng() > .35
			});
		}
		return items;
	}, [
		rng,
		floorW,
		floorD,
		hideGeneric
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ambientLight", {
			intensity: cfg.ambientIntensity,
			color: cfg.ambientColor
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("directionalLight", {
			position: [
				6,
				10,
				4
			],
			intensity: 1.35,
			color: cfg.primaryLightColor
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("directionalLight", {
			position: [
				-5,
				6,
				-3
			],
			intensity: .45,
			color: cfg.fillLightColor
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pointLight", {
			position: [
				0,
				4.2,
				0
			],
			intensity: .8,
			color: accent,
			distance: 18
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pointLight", {
			position: [
				-4,
				2.4,
				3
			],
			intensity: .55,
			color: p1Color,
			distance: 10
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pointLight", {
			position: [
				4,
				2.4,
				3
			],
			intensity: .55,
			color: p2Color,
			distance: 10
		}),
		!indoor && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("mesh", {
			geometry: ground,
			receiveShadow: true,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: cfg.bgColor,
				roughness: .92,
				metalness: .08
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				0,
				18,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("sphereGeometry", { args: [
				42,
				16,
				12
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshBasicMaterial", {
				color: cfg.ambientColor,
				side: 1
			})]
		}),
		resolvedId === "dojo" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DojoHall, { accent }),
		resolvedId === "wrestling_ring" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WrestlingRing, { accent }),
		resolvedId === "mma_octagon" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OctagonCage, { accent }),
		resolvedId === "steel_cage" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SteelCage, { accent }),
		resolvedId === "subway" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SubwayStation, { accent }),
		resolvedId === "sky_crane" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SkyCrane, { accent }),
		resolvedId === "ghetto_streets" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GhettoStreet, { accent }),
		resolvedId === "industrial" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IndustrialFloor, { accent }),
		resolvedId === "junkyard" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Junkyard, { accent }),
		resolvedId === "spike_pit" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SpikePit, { accent }),
		resolvedId === "acid_pit" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AcidPit, { accent }),
		resolvedId === "grinder_pit" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GrinderPit, { accent }),
		resolvedId === "gang_brawl" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GangBrawl, { accent }),
		buildings.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("group", {
			position: p.pos,
			rotation: [
				0,
				p.rot,
				0
			],
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: p.scale }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: i % 2 === 0 ? "#1b1b20" : "#101014",
				roughness: .85,
				metalness: .12,
				emissive: p.windows ? accent : "#000000",
				emissiveIntensity: p.windows ? .12 : 0
			})] })
		}, `b${i}`))
	] });
}
function Box({ p, s, c, r = .9, m = .1, e, ei = 0, rot }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
		position: p,
		rotation: rot,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: s }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
			color: c,
			roughness: r,
			metalness: m,
			emissive: e ?? "#000",
			emissiveIntensity: ei
		})]
	});
}
function Cyl({ p, args, c, r = .6, m = .4, e, ei = 0, rot }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
		position: p,
		rotation: rot,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("cylinderGeometry", { args: [
			args[0],
			args[1],
			args[2],
			args[3] ?? 8
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
			color: c,
			roughness: r,
			metalness: m,
			emissive: e ?? "#000",
			emissiveIntensity: ei
		})]
	});
}
function DojoHall({ accent }) {
	const mats = [];
	for (let x = -3; x <= 3; x++) for (let z = -2; z <= 2; z++) mats.push(/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
		p: [
			x * 1.15,
			.02,
			z * 1.15
		],
		s: [
			1.08,
			.04,
			1.08
		],
		c: (x + z) % 2 === 0 ? "#6b3a1f" : "#5a3018",
		r: .95
	}, `${x}${z}`));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				0,
				0
			],
			s: [
				10,
				.06,
				8
			],
			c: "#3a2414",
			r: .95
		}),
		mats,
		[-4.4, 4.4].map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				x,
				2.1,
				0
			],
			s: [
				.18,
				4.2,
				8
			],
			c: "#2a1a10",
			r: .9
		}), [
			-2.4,
			0,
			2.4
		].map((z) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				x,
				1.7,
				z
			],
			s: [
				.06,
				3.2,
				1.6
			],
			c: "#d8c9a4",
			r: .7,
			e: "#fff4d6",
			ei: .12
		}, z))] }, x)),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				2.1,
				-3.9
			],
			s: [
				10,
				4.2,
				.18
			],
			c: "#2a1a10"
		}),
		[
			-3,
			-1,
			1,
			3
		].map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
			p: [
				x,
				2.1,
				-3.7
			],
			args: [
				.16,
				.18,
				4.2,
				8
			],
			c: "#4a3018",
			r: .85,
			m: .05
		}, x)),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				4.3,
				0
			],
			s: [
				10.4,
				.16,
				8.4
			],
			c: "#1a1008"
		}),
		[
			-2,
			0,
			2
		].map((z) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				4.15,
				z
			],
			s: [
				10,
				.12,
				.18
			],
			c: "#3a2814"
		}, z)),
		[-2.6, 2.6].map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
				p: [
					x,
					3.55,
					-2.2
				],
				args: [
					.12,
					.12,
					.18,
					8
				],
				c: "#1a1008"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
				position: [
					x,
					3.35,
					-2.2
				],
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("sphereGeometry", { args: [
					.22,
					10,
					10
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
					color: accent,
					emissive: accent,
					emissiveIntensity: 1.6
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pointLight", {
				position: [
					x,
					3.2,
					-2.2
				],
				intensity: .7,
				color: accent,
				distance: 7
			})
		] }, x)),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				2.4,
				-3.72
			],
			s: [
				1.4,
				1.1,
				.08
			],
			c: "#1a0800",
			e: accent,
			ei: .25
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				3.15,
				-3.72
			],
			s: [
				2.2,
				.08,
				.28
			],
			c: "#5a3820"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				-3.6,
				1.1,
				-3.55
			],
			s: [
				1.6,
				2,
				.12
			],
			c: "#3a2414"
		}),
		[
			-.35,
			0,
			.35
		].map((y, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				-3.6,
				.7 + y,
				-3.42
			],
			s: [
				1.35,
				.04,
				.04
			],
			c: "#c4b48a",
			m: .6
		}, i)),
		[-1.6, 1.6].map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				x,
				.08,
				2.4
			],
			s: [
				.7,
				.08,
				.7
			],
			c: "#8a2a2a",
			r: .95
		}, x))
	] });
}
function WrestlingRing({ accent }) {
	const w = 8;
	const d = 8;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				-.35,
				0
			],
			s: [
				9.6,
				.7,
				9.6
			],
			c: "#1a1a1e",
			m: .3
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				.04,
				0
			],
			s: [
				w,
				.08,
				d
			],
			c: "#c4c4cc",
			r: .7
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				0,
				.09,
				0
			],
			rotation: [
				-Math.PI / 2,
				0,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ringGeometry", { args: [
				1.55,
				1.7,
				32
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: accent,
				emissive: accent,
				emissiveIntensity: .35
			})]
		}),
		[
			.42,
			.82,
			1.22
		].map((y, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [[-1, 1].map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				y,
				d / 2 * s
			],
			s: [
				w,
				.045,
				.045
			],
			c: i === 1 ? "#f4f4f8" : accent,
			e: accent,
			ei: .25
		}, `z${s}`)), [-1, 1].map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				w / 2 * s,
				y,
				0
			],
			s: [
				.045,
				.045,
				d
			],
			c: i === 1 ? "#f4f4f8" : accent,
			e: accent,
			ei: .25
		}, `x${s}`))] }, y)),
		[-1, 1].map((x) => [-1, 1].map((z) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
			p: [
				w / 2 * x,
				.75,
				d / 2 * z
			],
			args: [
				.11,
				.14,
				1.5,
				8
			],
			c: "#d0d0d4",
			m: .75,
			r: .25
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				w / 2 * x,
				1.42,
				d / 2 * z
			],
			s: [
				.32,
				.22,
				.32
			],
			c: "#111114"
		})] }, `${x}${z}`))),
		Array.from({ length: 18 }).map((_, i) => {
			const side = i < 9 ? -1 : 1;
			const t = i % 9 / 8;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
				position: [
					side * 5.35,
					.85,
					-3.6 + t * 7.2
				],
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("capsuleGeometry", { args: [
					.16,
					.7,
					4,
					6
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
					color: i % 3 === 0 ? "#2a1010" : "#121214",
					roughness: 1
				})]
			}, i);
		}),
		[
			-2.4,
			0,
			2.4
		].map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				x,
				6.4,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [
				1.8,
				.08,
				1.2
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: "#f4f4f0",
				emissive: "#fff8e8",
				emissiveIntensity: 1.4
			})]
		}, x)),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				-5.4,
				.15,
				0
			],
			s: [
				1.4,
				.12,
				.55
			],
			c: "#3a3a40"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				-5.4,
				.45,
				0
			],
			s: [
				.12,
				.7,
				.55
			],
			c: "#2a2a30"
		})
	] });
}
function OctagonCage({ accent }) {
	const radius = 5.6;
	const sides = 8;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				0,
				.02,
				0
			],
			rotation: [
				-Math.PI / 2,
				0,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circleGeometry", { args: [5.449999999999999, 8] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: "#2a2a24",
				roughness: .85
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				0,
				.05,
				0
			],
			rotation: [
				-Math.PI / 2,
				0,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ringGeometry", { args: [
				1.4,
				1.55,
				32
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: accent,
				emissive: accent,
				emissiveIntensity: .4
			})]
		}),
		Array.from({ length: sides }).map((_, i) => {
			const a = i / sides * Math.PI * 2 + Math.PI / sides;
			const x = Math.cos(a) * radius;
			const z = Math.sin(a) * radius;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", {
				position: [
					x,
					0,
					z
				],
				rotation: [
					0,
					-a,
					0
				],
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
						p: [
							0,
							1.55,
							0
						],
						s: [
							radius * .82,
							3.1,
							.06
						],
						c: "#111114",
						m: .55,
						r: .35,
						e: accent,
						ei: .04
					}),
					Array.from({ length: 7 }).map((_, r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
						p: [
							0,
							.35 + r * .4,
							.02
						],
						s: [
							radius * .8,
							.02,
							.02
						],
						c: "#8a8a90",
						m: .8
					}, r)),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
						p: [
							radius * .4,
							1.55,
							0
						],
						args: [
							.09,
							.11,
							3.1,
							6
						],
						c: "#c4c4c8",
						m: .7
					})
				]
			}, i);
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				0,
				3.2,
				0
			],
			rotation: [
				-Math.PI / 2,
				0,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ringGeometry", { args: [
				5.3999999999999995,
				radius,
				8
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: "#2a2a30",
				metalness: .7,
				roughness: .3
			})]
		})
	] });
}
function SteelCage({ accent }) {
	const size = 7.4;
	const bars = 16;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				.02,
				0
			],
			s: [
				size,
				.06,
				size
			],
			c: "#1a1a1e",
			m: .4
		}),
		[-1, 1].map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [Array.from({ length: bars }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
			p: [
				-3.45 + i / 15 * 6.9,
				1.9,
				size / 2 * s
			],
			args: [
				.035,
				.035,
				3.8,
				5
			],
			c: "#9aa0a8",
			m: .85,
			r: .2
		}, `z${i}`)), Array.from({ length: bars }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
			p: [
				size / 2 * s,
				1.9,
				-3.45 + i / 15 * 6.9
			],
			args: [
				.035,
				.035,
				3.8,
				5
			],
			c: "#9aa0a8",
			m: .85,
			r: .2
		}, `x${i}`))] }, s)),
		[-1, 1].map((x) => [-1, 1].map((z) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
			p: [
				size / 2 * x,
				2,
				size / 2 * z
			],
			args: [
				.12,
				.14,
				4,
				6
			],
			c: "#c8ccd0",
			m: .8
		}, `${x}${z}`))),
		Array.from({ length: 10 }).map((_, i) => Array.from({ length: 10 }).map((_, j) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				-7.4 / 2 + .4 + i * (6.6000000000000005 / 9),
				3.85,
				-7.4 / 2 + .4 + j * (6.6000000000000005 / 9)
			],
			s: [
				.04,
				.04,
				6.6000000000000005 / 9
			],
			c: "#7a8088",
			m: .8
		}, `${i}-${j}`))),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pointLight", {
			position: [
				0,
				4.2,
				0
			],
			intensity: 1.1,
			color: accent,
			distance: 12
		})
	] });
}
function SubwayStation({ accent }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				.02,
				0
			],
			s: [
				14,
				.08,
				7
			],
			c: "#2a2a28",
			r: .8
		}),
		Array.from({ length: 18 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				-6.4 + i * .75,
				.06,
				0
			],
			s: [
				.08,
				.02,
				7
			],
			c: "#3a3a36"
		}, i)),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				.07,
				1.55
			],
			s: [
				14,
				.04,
				.18
			],
			c: accent,
			e: accent,
			ei: .9
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				.07,
				-1.55
			],
			s: [
				14,
				.04,
				.18
			],
			c: accent,
			e: accent,
			ei: .9
		}),
		[-1.85, 1.85].map((z) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				-.55,
				z
			],
			s: [
				16,
				.08,
				.14
			],
			c: "#8a8a90",
			m: .9,
			r: .15
		}, z)),
		Array.from({ length: 12 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				-7 + i * 1.3,
				-.62,
				0
			],
			s: [
				.12,
				.06,
				4.1
			],
			c: "#3a3020"
		}, i)),
		[
			-5.2,
			-1.7,
			1.7,
			5.2
		].map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
			p: [
				x,
				2.2,
				-3.15
			],
			args: [
				.28,
				.32,
				4.4,
				10
			],
			c: "#4a4a48",
			r: .7
		}, x)),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				2.4,
				-3.4
			],
			s: [
				14,
				4.8,
				.2
			],
			c: "#1c1c1a"
		}),
		[
			-4,
			0,
			4
		].map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				x,
				2.3,
				-3.28
			],
			s: [
				2.4,
				1.3,
				.04
			],
			c: "#0a0a0c",
			e: accent,
			ei: .15
		}, x)),
		[-3.4, 3.4].map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				x,
				.45,
				-2.4
			],
			s: [
				1.6,
				.08,
				.45
			],
			c: "#3a3a32"
		}, x)),
		[
			-6,
			-2,
			2,
			6
		].map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				x,
				3.7,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [
				1.4,
				.08,
				.5
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: "#f0e8c0",
				emissive: "#fff4cc",
				emissiveIntensity: 1.2
			})]
		}, x)),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", {
			position: [
				3.4,
				-.15,
				2.35
			],
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
					p: [
						0,
						.7,
						0
					],
					s: [
						6.4,
						1.4,
						1.1
					],
					c: "#2a2418",
					m: .35
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
					p: [
						3.1,
						.55,
						0
					],
					s: [
						.4,
						1.1,
						1.05
					],
					c: "#1a1814"
				}),
				[
					-2.2,
					-.6,
					1
				].map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
					p: [
						x,
						.85,
						.56
					],
					s: [
						1.1,
						.55,
						.04
					],
					c: "#0a0a08",
					e: accent,
					ei: .08
				}, x)),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
					p: [
						-2.4,
						.18,
						.45
					],
					args: [
						.18,
						.18,
						.22,
						10
					],
					c: "#3a3a38",
					m: .7,
					rot: [
						Math.PI / 2,
						0,
						0
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
					p: [
						2.2,
						.18,
						.45
					],
					args: [
						.18,
						.18,
						.22,
						10
					],
					c: "#3a3a38",
					m: .7,
					rot: [
						Math.PI / 2,
						0,
						0
					]
				})
			]
		})
	] });
}
function SkyCrane({ accent }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				.04,
				0
			],
			s: [
				8.5,
				.08,
				6.2
			],
			c: "#3a3a38",
			m: .55
		}),
		Array.from({ length: 9 }).map((_, i) => Array.from({ length: 7 }).map((_, j) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				-3.6 + i * .9,
				.08,
				-2.4 + j * .8
			],
			s: [
				.82,
				.03,
				.72
			],
			c: "#2a2a28",
			m: .6
		}, `${i}${j}`))),
		[-4.1, 4.1].map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				x,
				.55,
				0
			],
			s: [
				.12,
				1.1,
				6.2
			],
			c: accent,
			e: accent,
			ei: .2
		}, x)),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				7.2,
				-1.4
			],
			s: [
				18,
				.28,
				.28
			],
			c: "#c4b48a",
			m: .65
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				-6.5,
				3.6,
				-1.4
			],
			s: [
				.28,
				7.2,
				.28
			],
			c: "#c4b48a",
			m: .65
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				6.5,
				3.6,
				-1.4
			],
			s: [
				.28,
				7.2,
				.28
			],
			c: "#c4b48a",
			m: .65
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
			p: [
				0,
				7.55,
				-1.4
			],
			args: [
				.35,
				.4,
				.5,
				8
			],
			c: "#8a8070",
			m: .7
		}),
		Array.from({ length: 8 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				-10 + i * 3.2,
				-8,
				-14
			],
			s: [
				2.2,
				6 + i % 3 * 2.4,
				2.2
			],
			c: "#0a1824"
		}, i)),
		Array.from({ length: 6 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				-3.2 + i * 1.1,
				.1,
				2.85
			],
			s: [
				.7,
				.03,
				.18
			],
			c: i % 2 === 0 ? accent : "#111108",
			e: i % 2 === 0 ? accent : "#000",
			ei: i % 2 === 0 ? .4 : 0
		}, `w${i}`)),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
			p: [
				2.4,
				5.2,
				-1.4
			],
			args: [
				.04,
				.04,
				4,
				6
			],
			c: "#8a8070",
			m: .7
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				2.4,
				3.15,
				-1.4
			],
			s: [
				.35,
				.45,
				.18
			],
			c: "#3a3a32",
			m: .6
		})
	] });
}
function GhettoStreet({ accent }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				.03,
				0
			],
			s: [
				4.2,
				.04,
				16
			],
			c: "#16161a",
			r: .75
		}),
		[-2.15, 2.15].map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				x,
				.05,
				0
			],
			s: [
				.08,
				.02,
				16
			],
			c: accent,
			e: accent,
			ei: .55
		}, x)),
		[
			-4,
			0,
			4
		].map((z) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				.05,
				z
			],
			s: [
				.35,
				.02,
				1.1
			],
			c: "#c8b84a",
			e: "#c8b84a",
			ei: .3
		}, z)),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				-5.4,
				.7,
				-2.2
			],
			s: [
				1.5,
				1.4,
				.9
			],
			c: "#1a3a22",
			r: .95
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				-5.4,
				1.45,
				-2.2
			],
			s: [
				1.55,
				.08,
				.95
			],
			c: "#111114"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				6.2,
				.55,
				1.6
			],
			s: [
				2.8,
				1.1,
				1.3
			],
			c: "#1a1a22",
			m: .35
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
			p: [
				5.1,
				.35,
				1.6
			],
			args: [
				.32,
				.32,
				.7,
				10
			],
			c: "#222",
			m: .2,
			rot: [
				0,
				0,
				Math.PI / 2
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
			p: [
				7.3,
				.35,
				1.6
			],
			args: [
				.32,
				.32,
				.7,
				10
			],
			c: "#222",
			m: .2,
			rot: [
				0,
				0,
				Math.PI / 2
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				6.2,
				.95,
				1.2
			],
			s: [
				2.4,
				.08,
				.9
			],
			c: "#0c0c10"
		}),
		[-6, 6].map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
				p: [
					x,
					1.6,
					-4.5
				],
				args: [
					.06,
					.08,
					3.2,
					6
				],
				c: "#2a2a30",
				m: .6
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
				position: [
					x,
					3.15,
					-4.5
				],
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("sphereGeometry", { args: [
					.16,
					8,
					8
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
					color: "#f0d080",
					emissive: "#f0d080",
					emissiveIntensity: 2
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pointLight", {
				position: [
					x,
					3,
					-4.5
				],
				intensity: .7,
				color: "#f0d080",
				distance: 8
			})
		] }, x)),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				-6.4,
				2.2,
				3.2
			],
			s: [
				.08,
				3.4,
				4.2
			],
			c: "#1a1210"
		}),
		[
			[
				-1,
				1.6,
				3.2
			],
			[
				.4,
				2.4,
				3.2
			],
			[
				-.6,
				2.9,
				3.2
			]
		].map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p,
			s: [
				1.4,
				.7,
				.04
			],
			c: i === 1 ? accent : "#2a0a14",
			e: accent,
			ei: .2
		}, i)),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
			p: [
				4.8,
				.45,
				-3.2
			],
			args: [
				.28,
				.32,
				.9,
				8
			],
			c: "#3a2a18"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				4.8,
				.95,
				-3.2
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("sphereGeometry", { args: [
				.16,
				8,
				8
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: "#ff6a20",
				emissive: "#ff6a20",
				emissiveIntensity: 1.4
			})]
		})
	] });
}
function IndustrialFloor({ accent }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				.02,
				0
			],
			s: [
				12,
				.08,
				8
			],
			c: "#2a2418",
			m: .35
		}),
		Array.from({ length: 6 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				-5 + i * 2,
				.07,
				0
			],
			s: [
				.7,
				.04,
				8
			],
			c: i % 2 === 0 ? accent : "#111108",
			e: i % 2 === 0 ? accent : "#000",
			ei: i % 2 === 0 ? .35 : 0
		}, i)),
		[-1, 1].map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				1.1,
				3.6 * s
			],
			s: [
				12,
				.08,
				.08
			],
			c: "#c4b48a",
			m: .6
		}, s)),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				-5.6,
				3.1,
				-1
			],
			s: [
				8,
				.28,
				.28
			],
			c: "#4a4038",
			m: .7,
			rot: [
				0,
				0,
				Math.PI / 2
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				5.4,
				2.5,
				1.2
			],
			s: [
				6,
				.22,
				.22
			],
			c: "#3a3834",
			m: .75,
			rot: [
				0,
				0,
				Math.PI / 2
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
			p: [
				-4.2,
				.55,
				2.4
			],
			args: [
				.45,
				.5,
				1.1,
				10
			],
			c: "#3a3028",
			m: .5
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
			p: [
				4.6,
				.7,
				-2.2
			],
			args: [
				.55,
				.6,
				1.4,
				10
			],
			c: "#2a2824",
			m: .55
		}),
		[-3, 3].map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				x,
				4.6,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [
				.8,
				.12,
				.8
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: "#ffcc66",
				emissive: "#ffaa22",
				emissiveIntensity: 1.5
			})]
		}, x))
	] });
}
function Junkyard({ accent }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
		[
			{
				p: [
					-6.2,
					.55,
					-2.2
				],
				rot: .4,
				c: "#3a2018"
			},
			{
				p: [
					-5.8,
					1.5,
					-2
				],
				rot: -.2,
				c: "#2a2a22"
			},
			{
				p: [
					6.4,
					.5,
					1.6
				],
				rot: .7,
				c: "#1a2a1a"
			},
			{
				p: [
					6.1,
					1.4,
					1.8
				],
				rot: .15,
				c: "#3a3a28"
			},
			{
				p: [
					-5.2,
					.45,
					2.6
				],
				rot: -.5,
				c: "#2a1818"
			}
		].map((car, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", {
			position: car.p,
			rotation: [
				.05,
				car.rot,
				.08
			],
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
					p: [
						0,
						0,
						0
					],
					s: [
						2.4,
						.7,
						1.2
					],
					c: car.c,
					r: .9
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
					p: [
						0,
						.5,
						0
					],
					s: [
						1.5,
						.5,
						1.15
					],
					c: car.c,
					r: .9
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
					p: [
						-.8,
						-.25,
						.55
					],
					args: [
						.28,
						.28,
						.18,
						8
					],
					c: "#111",
					rot: [
						Math.PI / 2,
						0,
						0
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
					p: [
						.8,
						-.25,
						.55
					],
					args: [
						.28,
						.28,
						.18,
						8
					],
					c: "#111",
					rot: [
						Math.PI / 2,
						0,
						0
					]
				})
			]
		}, i)),
		[
			[
				-6.8,
				.5,
				.4
			],
			[
				7,
				.6,
				-2.4
			],
			[
				5.2,
				.35,
				3.2
			]
		].map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: p,
			rotation: [
				.2,
				i,
				.1
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dodecahedronGeometry", { args: [.7 + i * .15, 0] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: "#2a241c",
				roughness: .95
			})]
		}, i)),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
			p: [
				0,
				4.2,
				-4
			],
			args: [
				.18,
				.18,
				8.4,
				6
			],
			c: "#8a8070",
			m: .6
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				0,
				7.8,
				-4
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("sphereGeometry", { args: [
				.7,
				8,
				8
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: accent,
				metalness: .7,
				roughness: .35
			})]
		})
	] });
}
function SpikePit({ accent }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				.04,
				-2.6
			],
			s: [
				10,
				.08,
				3.2
			],
			c: "#2a1a1a"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				.04,
				2.6
			],
			s: [
				10,
				.08,
				3.2
			],
			c: "#2a1a1a"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				-4.6,
				.04,
				0
			],
			s: [
				1.4,
				.08,
				8
			],
			c: "#2a1a1a"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				4.6,
				.04,
				0
			],
			s: [
				1.4,
				.08,
				8
			],
			c: "#2a1a1a"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				0,
				-1.6,
				0
			],
			rotation: [
				-Math.PI / 2,
				0,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [8, 4.4] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: "#1a0000",
				emissive: accent,
				emissiveIntensity: .15
			})]
		}),
		Array.from({ length: 28 }).map((_, i) => {
			const x = (i % 7 - 3) * .85;
			const z = (Math.floor(i / 7) - 1.5) * .9;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
				p: [
					x,
					-.85,
					z
				],
				args: [
					.04,
					.16,
					1.5,
					5
				],
				c: "#c8c8d0",
				m: .7,
				r: .25
			}, i);
		})
	] });
}
function AcidPit({ accent }) {
	const mat = (0, import_react.useRef)(null);
	useFrame(({ clock }) => {
		if (mat.current) mat.current.emissiveIntensity = .45 + Math.sin(clock.elapsedTime * 2.2) * .2;
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				.06,
				0
			],
			s: [
				3.2,
				.12,
				8
			],
			c: "#3a3a32",
			m: .5
		}),
		[-1.7, 1.7].map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				x,
				.45,
				0
			],
			s: [
				.1,
				.9,
				8
			],
			c: "#5a5a50",
			m: .55
		}, x)),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				0,
				-1.4,
				0
			],
			rotation: [
				-Math.PI / 2,
				0,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circleGeometry", { args: [3.8, 24] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				ref: mat,
				color: accent,
				emissive: accent,
				emissiveIntensity: .55,
				roughness: .25,
				metalness: .2
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
			p: [
				-4.4,
				1.6,
				-2
			],
			args: [
				.16,
				.16,
				3.2,
				8
			],
			c: "#4a5a38",
			m: .5
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
			p: [
				4.2,
				1.2,
				1.6
			],
			args: [
				.12,
				.12,
				2.4,
				8
			],
			c: "#3a4a30",
			m: .5
		})
	] });
}
function GrinderPit({ accent }) {
	const g1 = (0, import_react.useRef)(null);
	const g2 = (0, import_react.useRef)(null);
	useFrame((_, dt) => {
		if (g1.current) g1.current.rotation.z += dt * 1.6;
		if (g2.current) g2.current.rotation.z -= dt * 1.2;
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				.05,
				0
			],
			s: [
				3.4,
				.1,
				8
			],
			c: "#2a2018",
			m: .45
		}),
		[-1.8, 1.8].map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				x,
				.5,
				0
			],
			s: [
				.12,
				1,
				8
			],
			c: "#c4b48a",
			m: .6
		}, x)),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", {
			ref: g1,
			position: [
				-1.2,
				-1.6,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
				p: [
					0,
					0,
					0
				],
				args: [
					1.3,
					1.3,
					.35,
					16
				],
				c: "#4a4038",
				m: .7,
				rot: [
					Math.PI / 2,
					0,
					0
				]
			}), Array.from({ length: 8 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
				p: [
					Math.cos(i / 8 * Math.PI * 2) * 1.15,
					Math.sin(i / 8 * Math.PI * 2) * 1.15,
					0
				],
				s: [
					.18,
					.55,
					.28
				],
				c: accent,
				e: accent,
				ei: .3,
				rot: [
					0,
					0,
					i / 8 * Math.PI * 2
				]
			}, i))]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", {
			ref: g2,
			position: [
				1.2,
				-1.6,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
				p: [
					0,
					0,
					0
				],
				args: [
					1.1,
					1.1,
					.35,
					16
				],
				c: "#3a3834",
				m: .7,
				rot: [
					Math.PI / 2,
					0,
					0
				]
			}), Array.from({ length: 8 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
				p: [
					Math.cos(i / 8 * Math.PI * 2) * .95,
					Math.sin(i / 8 * Math.PI * 2) * .95,
					0
				],
				s: [
					.16,
					.45,
					.26
				],
				c: "#c4b48a",
				rot: [
					0,
					0,
					i / 8 * Math.PI * 2
				]
			}, i))]
		})
	] });
}
function GangBrawl({ accent }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				.03,
				0
			],
			s: [
				18,
				.06,
				14
			],
			c: "#121014",
			r: .9
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				.05,
				0
			],
			s: [
				3.6,
				.04,
				14
			],
			c: "#1a1a16"
		}),
		[-1.9, 1.9].map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				x,
				.07,
				0
			],
			s: [
				.08,
				.02,
				14
			],
			c: accent,
			e: accent,
			ei: .7
		}, x)),
		[
			-5,
			-1.5,
			2,
			5.5
		].map((z) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				0,
				.07,
				z
			],
			s: [
				.28,
				.02,
				.9
			],
			c: "#c8b84a",
			e: "#c8b84a",
			ei: .25
		}, z)),
		[-1, 1].map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				s * 7.2,
				1.2,
				0
			],
			s: [
				.06,
				2.4,
				12
			],
			c: "#1a1a1e",
			m: .55,
			r: .4,
			e: accent,
			ei: .05
		}), Array.from({ length: 9 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
			p: [
				s * 7.2,
				1.2,
				-5.2 + i * 1.3
			],
			args: [
				.05,
				.06,
				2.4,
				6
			],
			c: "#8a8a90",
			m: .75
		}, i))] }, s)),
		[
			[-4.2, 3.6],
			[5.1, -3.2],
			[-5.4, -2.4]
		].map(([x, z], i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cyl, {
				p: [
					x,
					.5,
					z
				],
				args: [
					.32,
					.36,
					1,
					10
				],
				c: "#2a1a10"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
				position: [
					x,
					1.08,
					z
				],
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("sphereGeometry", { args: [
					.2 + i * .03,
					8,
					8
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
					color: "#ff4a10",
					emissive: "#ff6a20",
					emissiveIntensity: 1.8
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pointLight", {
				position: [
					x,
					1.15,
					z
				],
				intensity: .85,
				color: "#ff6a20",
				distance: 6
			})
		] }, i)),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				6.4,
				1.4,
				3.2
			],
			s: [
				.12,
				2.8,
				4.4
			],
			c: "#140810",
			e: accent,
			ei: .22
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				-6.6,
				1.6,
				2.8
			],
			s: [
				.1,
				3.2,
				3.6
			],
			c: "#1a1214"
		}),
		[[
			-6.55,
			1.8,
			2.2
		], [
			-6.55,
			2.6,
			3.4
		]].map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p,
			s: [
				.06,
				.7,
				1.3
			],
			c: i === 0 ? accent : "#2a0a14",
			e: accent,
			ei: .28
		}, i)),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
			p: [
				5.8,
				.55,
				-1.2
			],
			s: [
				2.2,
				1.1,
				1.1
			],
			c: "#1a1a22",
			m: .3
		})
	] });
}
//#endregion
export { TrainingStage as n, UrbanNightStage as r, ProceduralStage as t };
