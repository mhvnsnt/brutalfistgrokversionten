import { a as __toESM } from "../_runtime.mjs";
import { a as useFrame, c as require_jsx_runtime, i as Canvas, l as require_react, o as useThree } from "../_libs/@react-three/drei+[...].mjs";
import { t as STAGE_CONFIGS } from "./StageConfig-DJ4pMRhO.mjs";
import { n as TrainingStage, r as UrbanNightStage, t as ProceduralStage } from "./ProceduralStage-BaHsvtIU.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/StageSelectScreen-CmO2HBjE.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var STAGES = [
	{
		id: "random",
		name: "RANDOM",
		subtitle: "FATE DECIDES",
		accentColor: "#f59e0b",
		bgColor: "#1c1400",
		badges: [],
		description: "Let the arena choose your fate."
	},
	{
		id: "urban_night",
		name: "URBAN NIGHT",
		subtitle: "UNDERGROUND DISTRICT",
		accentColor: "#a855f7",
		bgColor: "#0d0014",
		badges: ["WALLS"],
		description: "Neon-lit back alleys. Wall splats welcome."
	},
	{
		id: "training",
		name: "TRAINING GRID",
		subtitle: "VOID ARENA",
		accentColor: "#22d3ee",
		bgColor: "#001418",
		badges: ["WALLS"],
		description: "Infinite void. Perfect for practice."
	},
	{
		id: "dojo",
		name: "DOJO",
		subtitle: "ANCIENT TRAINING HALL",
		accentColor: "#f97316",
		bgColor: "#1a0800",
		badges: ["2 LEVELS", "BREAKABLE"],
		description: "Slam opponents through the wooden floor to the lower dojo."
	},
	{
		id: "wrestling_ring",
		name: "WRESTLING RING",
		subtitle: "THE SQUARED CIRCLE",
		accentColor: "#ef4444",
		bgColor: "#1a0000",
		badges: ["RING OUT", "NO WALLS"],
		description: "Throw them over the ropes for a ring-out KO."
	},
	{
		id: "mma_octagon",
		name: "MMA OCTAGON",
		subtitle: "THE CAGE",
		accentColor: "#facc15",
		bgColor: "#0f0f00",
		badges: ["WALLS", "CAGE"],
		description: "Eight-sided cage. No escape from wall splats."
	},
	{
		id: "steel_cage",
		name: "STEEL CAGE",
		subtitle: "NO ESCAPE",
		accentColor: "#94a3b8",
		bgColor: "#0a0a0a",
		badges: ["WALLS", "CAGE"],
		description: "Cold steel walls. Every slam echoes."
	},
	{
		id: "industrial",
		name: "INDUSTRIAL",
		subtitle: "FACTORY FLOOR",
		accentColor: "#f59e0b",
		bgColor: "#0f0800",
		badges: [
			"2 LEVELS",
			"BREAKABLE",
			"HAZARD"
		],
		description: "Break through the catwalk into molten metal below."
	},
	{
		id: "ghetto_streets",
		name: "GHETTO STREETS",
		subtitle: "BACK ALLEY BRAWL",
		accentColor: "#84cc16",
		bgColor: "#0a0f00",
		badges: [
			"RING OUT",
			"NO WALLS",
			"OPEN"
		],
		description: "Open streets. No boundaries. Ring-out anywhere."
	},
	{
		id: "junkyard",
		name: "JUNKYARD",
		subtitle: "SCRAP METAL GRAVEYARD",
		accentColor: "#78716c",
		bgColor: "#0c0a08",
		badges: [
			"2 LEVELS",
			"BREAKABLE",
			"RING OUT"
		],
		description: "Crash through scrap piles to the lower yard."
	},
	{
		id: "sky_crane",
		name: "SKY CRANE",
		subtitle: "HIGH ALTITUDE PLATFORM",
		accentColor: "#38bdf8",
		bgColor: "#00080f",
		badges: [
			"2 LEVELS",
			"BREAKABLE",
			"RING OUT"
		],
		description: "Narrow crane platform high above the city. One slip = ring-out."
	},
	{
		id: "spike_pit",
		name: "SPIKE PIT",
		subtitle: "MORTAL HAZARD",
		accentColor: "#dc2626",
		bgColor: "#0f0000",
		badges: [
			"2 LEVELS",
			"BREAKABLE",
			"⚠ SPIKES"
		],
		description: "Slam them through the floor into the spike pit below."
	},
	{
		id: "acid_pit",
		name: "ACID PIT",
		subtitle: "CORROSIVE DEPTHS",
		accentColor: "#a3e635",
		bgColor: "#030f00",
		badges: [
			"2 LEVELS",
			"BREAKABLE",
			"☣ ACID"
		],
		description: "Break the bridge. Watch them dissolve in the acid pool."
	},
	{
		id: "grinder_pit",
		name: "GRINDER PIT",
		subtitle: "INDUSTRIAL DEATH TRAP",
		accentColor: "#f97316",
		bgColor: "#0f0500",
		badges: [
			"2 LEVELS",
			"BREAKABLE",
			"⚙ GRINDER"
		],
		description: "Catwalk above spinning industrial grinders. One slam ends it."
	},
	{
		id: "gang_brawl",
		name: "GANG BRAWL",
		subtitle: "NO RULES — NO WALLS",
		accentColor: "#e879f9",
		bgColor: "#0f0014",
		badges: [
			"2 LEVELS",
			"BREAKABLE",
			"RING OUT",
			"NO WALLS"
		],
		description: "Open streets, multi-level chaos. Anything goes."
	},
	{
		id: "subway",
		name: "SUBWAY",
		subtitle: "UNDERGROUND TRANSIT",
		accentColor: "#f59e0b",
		bgColor: "#0a0800",
		badges: [
			"2 LEVELS",
			"🚇 TRAIN",
			"VAULT ESCAPE"
		],
		description: "Fight on the platform or the tracks. The train runs on its own schedule — no warnings, just chaos."
	}
];
var REAL_STAGES = STAGES.filter((s) => s.id !== "random").map((s) => s.id);
function CinematicCamera() {
	const { camera } = useThree();
	useFrame((state) => {
		const t = state.clock.elapsedTime;
		const cam = camera;
		const orbitRadius = 9;
		const angle = t * .18;
		cam.position.x = Math.sin(angle) * orbitRadius;
		cam.position.z = Math.cos(angle) * orbitRadius * .7 + 3;
		cam.position.y = 2.5 + Math.sin(t * .35) * 2.2;
		cam.lookAt(0, 1.2, 0);
		cam.fov = 60 + Math.sin(t * .22) * 4;
		cam.updateProjectionMatrix();
	});
	return null;
}
function StageGeometry({ stageId }) {
	const resolvedId = stageId === "random" ? "urban_night" : stageId;
	const accentColor = STAGE_CONFIGS[resolvedId]?.accentColor ?? "#a855f7";
	if (resolvedId === "training") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ambientLight", {
			intensity: .35,
			color: "#c8d0e0"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("directionalLight", {
			position: [
				0,
				8,
				4
			],
			intensity: 2.5,
			color: "#fff8f0"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("directionalLight", {
			position: [
				-5,
				4,
				3
			],
			intensity: .8,
			color: "#a0b8ff"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("directionalLight", {
			position: [
				0,
				5,
				-6
			],
			intensity: 1,
			color: "#ffffff"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pointLight", {
			position: [
				0,
				4,
				0
			],
			intensity: 1.5,
			color: "#22d3ee",
			distance: 12,
			decay: 2
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrainingStage, {
			p1Color: "#22d3ee",
			p2Color: "#22d3ee"
		})
	] });
	if (resolvedId === "urban_night") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UrbanNightStage, {
		p1Color: "#a855f7",
		p2Color: "#a855f7"
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProceduralStage, {
		stageId: resolvedId,
		p1Color: accentColor,
		p2Color: accentColor
	}) });
}
function Badge({ label, accentColor }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "text-[6px] font-black tracking-wider px-1 py-0.5 border leading-none",
		style: {
			borderColor: `${accentColor}66`,
			color: accentColor,
			background: `${accentColor}18`
		},
		children: label
	});
}
function StageThumbnail({ stage, isSelected, onTap }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		onClick: onTap,
		className: "relative flex-shrink-0 w-28 h-20 border-2 transition-all duration-200 active:scale-95 overflow-hidden",
		style: {
			borderColor: isSelected ? stage.accentColor : "#3f3f46",
			background: stage.bgColor,
			boxShadow: isSelected ? `0 0 18px ${stage.accentColor}55` : "none"
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 opacity-20 pointer-events-none",
				style: { backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 4px)" }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10 flex flex-col items-center justify-center h-full gap-1 px-1",
				children: [stage.id === "random" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-2xl font-black",
					style: { color: stage.accentColor },
					children: "?"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "w-8 h-8 rounded-sm opacity-70",
					style: {
						background: `radial-gradient(circle at 40% 40%, ${stage.accentColor}44, ${stage.bgColor})`,
						border: `1px solid ${stage.accentColor}44`
					}
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[7px] font-black tracking-widest text-center leading-tight",
					style: { color: isSelected ? stage.accentColor : "#a1a1aa" },
					children: stage.name
				})]
			}),
			isSelected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute bottom-0 left-0 right-0 h-0.5",
				style: { background: stage.accentColor }
			})
		]
	});
}
function StageSelectScreen({ p1Fighter, p2Fighter, onConfirm, onBack }) {
	const [selectedIdx, setSelectedIdx] = (0, import_react.useState)(1);
	const [confirming, setConfirming] = (0, import_react.useState)(false);
	const selectedStage = STAGES[selectedIdx];
	const handleConfirm = (0, import_react.useCallback)(() => {
		if (confirming) return;
		setConfirming(true);
		const finalId = selectedStage.id === "random" ? REAL_STAGES[Math.floor(Math.random() * REAL_STAGES.length)] : selectedStage.id;
		setTimeout(() => onConfirm(finalId), 600);
	}, [
		confirming,
		selectedStage,
		onConfirm
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 bg-black overflow-hidden font-mono select-none",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 z-0",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Canvas, {
					camera: {
						position: [
							0,
							3,
							9
						],
						fov: 60
					},
					gl: {
						antialias: false,
						powerPreference: "low-power"
					},
					dpr: [1, 1.5],
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CinematicCamera, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StageGeometry, { stageId: selectedStage.id })]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 z-10 pointer-events-none",
				style: { background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.75) 100%)" }
			}),
			confirming && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 z-50 bg-white animate-ping opacity-30 pointer-events-none" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-safe pt-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onBack,
						className: "text-[9px] tracking-[0.4em] text-zinc-500 hover:text-white transition-colors border border-zinc-800 px-3 py-1.5 bg-black/60",
						children: "← BACK"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[8px] tracking-[0.5em] text-zinc-600",
						children: "SELECT STAGE"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-[8px] tracking-widest text-zinc-700 text-right",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-zinc-500",
								children: p1Fighter.name.toUpperCase()
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-zinc-700 mx-1",
								children: "VS"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-zinc-500",
								children: p2Fighter.name.toUpperCase()
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none px-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[9px] tracking-[0.6em] mb-2 transition-all duration-300",
						style: { color: selectedStage.accentColor },
						children: selectedStage.subtitle
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-4xl md:text-5xl font-black tracking-[0.12em] transition-all duration-300 drop-shadow-2xl mb-3",
						style: {
							color: "#ffffff",
							textShadow: `0 0 40px ${selectedStage.accentColor}88, 0 2px 0 rgba(0,0,0,0.8)`
						},
						children: selectedStage.name
					}),
					selectedStage.description && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[9px] tracking-wider text-center max-w-xs mb-3 opacity-70",
						style: { color: selectedStage.accentColor },
						children: selectedStage.description
					}),
					selectedStage.badges.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap gap-1 justify-center",
						children: selectedStage.badges.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							label: b,
							accentColor: selectedStage.accentColor
						}, b))
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute bottom-0 left-0 right-0 z-20 pb-safe",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-24 pointer-events-none",
					style: { background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.92))" }
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-black/90 px-4 pt-3 pb-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-2 overflow-x-auto pb-3 scrollbar-hide",
						children: STAGES.map((stage, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StageThumbnail, {
							stage,
							isSelected: idx === selectedIdx,
							onTap: () => setSelectedIdx(idx)
						}, stage.id))
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: handleConfirm,
						disabled: confirming,
						className: "w-full py-4 font-black tracking-[0.3em] text-sm transition-all duration-200 active:scale-95 border-2 mt-1",
						style: {
							borderColor: confirming ? "#52525b" : selectedStage.accentColor,
							color: confirming ? "#52525b" : selectedStage.accentColor,
							background: confirming ? "rgba(0,0,0,0.4)" : `${selectedStage.accentColor}18`,
							boxShadow: confirming ? "none" : `0 0 20px ${selectedStage.accentColor}33`
						},
						children: confirming ? "LOADING ARENA..." : "▶ CONFIRM STAGE"
					})]
				})]
			})
		]
	});
}
//#endregion
export { StageSelectScreen as default };
