import { a as __toESM } from "../_runtime.mjs";
import { a as getPlayableAttires, i as getGlbEntryForFighter, o as resolveGlbUrl, t as BANNON_GLB_PLAYABLE_MODELS } from "./bannonGlbRoster-Th39Z2sz.mjs";
import { G as LoopRepeat, W as LoopOnce, a as useFrame, c as require_jsx_runtime, i as Canvas, l as require_react, n as OrbitControls, r as useGLTF, t as Grid } from "../_libs/@react-three/drei+[...].mjs";
import { r as SEMANTIC_STATE_ALIASES, u as runCharacterPipeline } from "./CharacterPipeline-HDuRwHjw.mjs";
import { n as classifyClipSource, r as runAnimationIntegrityGate, t as AutoRigDetector } from "./AnimationIntegrityGate-Cj6H6q3Y.mjs";
import { d as getAllBannonFighters } from "./routes-DbIfrPB2.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/AnimationTestArena-CeV9-9_i.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var SEMANTIC_STATES = [
	"idle",
	"walk_forward",
	"walk_back",
	"strafe_left",
	"strafe_right",
	"attack_1",
	"attack_2",
	"block",
	"hit_reaction",
	"knockdown",
	"getup",
	"grapple"
];
var CLIP_SOURCE_COLORS = {
	AUTHORED_CLIP: "#22c55e",
	RETARGETED_AUTHORED_CLIP: "#3b82f6",
	PLACEHOLDER_TEST_CLIP: "#f59e0b",
	MISSING_CLIP: "#ef4444"
};
var CLIP_SOURCE_LABELS = {
	AUTHORED_CLIP: "AUTHORED",
	RETARGETED_AUTHORED_CLIP: "RETARGETED",
	PLACEHOLDER_TEST_CLIP: "PLACEHOLDER",
	MISSING_CLIP: "MISSING"
};
function resolveClipForSemanticState(semanticState, availableClips) {
	const aliases = SEMANTIC_STATE_ALIASES[semanticState] ?? [semanticState];
	let found = availableClips.find((c) => aliases.some((a) => c.toLowerCase() === a.toLowerCase()));
	if (found) return {
		clipName: found,
		sourceType: classifyClipSource(found)
	};
	found = availableClips.find((c) => c.toLowerCase().includes(semanticState.replace("_", "").toLowerCase()) || c.toLowerCase().includes(semanticState.toLowerCase()));
	if (found) return {
		clipName: found,
		sourceType: classifyClipSource(found)
	};
	found = availableClips.find((c) => c.toLowerCase().includes("idle"));
	if (found) return {
		clipName: found,
		sourceType: classifyClipSource(found)
	};
	return {
		clipName: availableClips[0] ?? null,
		sourceType: availableClips[0] ? classifyClipSource(availableClips[0]) : "MISSING_CLIP"
	};
}
function CharacterViewerInner({ modelUrl, currentSemanticState, onReady, onClipChange }) {
	const { scene, animations } = useGLTF(modelUrl, true, true);
	const normalizedRef = (0, import_react.useRef)(null);
	const groupRef = (0, import_react.useRef)(null);
	const readyFiredRef = (0, import_react.useRef)(false);
	const lastStateRef = (0, import_react.useRef)("");
	(0, import_react.useEffect)(() => {
		if (!scene) return;
		AutoRigDetector.analyze(scene, animations);
		let cancelled = false;
		runCharacterPipeline(scene, animations, modelUrl, false).then((result) => {
			if (cancelled) return;
			if (!result) {
				console.error(`[AnimTestArena] BLOCKED — "${modelUrl}" failed pipeline`);
				return;
			}
			normalizedRef.current = {
				scene: result.scene,
				forwardCorrectionY: result.forwardCorrectionY,
				mixer: result.mixer,
				actions: result.actions
			};
			const { clipName } = resolveClipForSemanticState("idle", Object.keys(result.actions));
			if (clipName && result.actions[clipName]) {
				const action = result.actions[clipName];
				action.setLoop(LoopRepeat, Infinity);
				action.reset().play();
			}
			const integrityReport = runAnimationIntegrityGate({
				characterName: modelUrl.split("/").pop()?.replace(".glb", "").toUpperCase() ?? "UNKNOWN",
				clonedScene: result.scene,
				mixer: result.mixer,
				actions: result.actions,
				activeClipName: clipName
			});
			if (!readyFiredRef.current) {
				readyFiredRef.current = true;
				onReady(normalizedRef.current, integrityReport);
			}
			return () => {
				cancelled = true;
			};
		});
	}, [scene, modelUrl]);
	(0, import_react.useEffect)(() => {
		const normalized = normalizedRef.current;
		if (!normalized) return;
		if (currentSemanticState === lastStateRef.current) return;
		lastStateRef.current = currentSemanticState;
		const { clipName, sourceType } = resolveClipForSemanticState(currentSemanticState, Object.keys(normalized.actions));
		console.log(`[AnimTestArena] 🎬 STATE: "${currentSemanticState}" → clip="${clipName ?? "NONE"}" [${sourceType}]`);
		onClipChange(clipName, sourceType);
		if (!clipName || !normalized.actions[clipName]) {
			console.warn(`[AnimTestArena] ⚠️ MISSING_CLIP for semantic state "${currentSemanticState}"`);
			return;
		}
		const currentAction = Object.values(normalized.actions).find((a) => a?.isRunning());
		const nextAction = normalized.actions[clipName];
		const isLoop = [
			"idle",
			"walk_forward",
			"walk_back",
			"strafe_left",
			"strafe_right",
			"block"
		].includes(currentSemanticState);
		nextAction.setLoop(isLoop ? LoopRepeat : LoopOnce, isLoop ? Infinity : 1);
		nextAction.clampWhenFinished = !isLoop;
		nextAction.reset();
		if (currentAction && currentAction !== nextAction) {
			currentAction.crossFadeTo(nextAction, .1, true);
			nextAction.play();
		} else nextAction.fadeIn(.1).play();
	}, [currentSemanticState, onClipChange]);
	useFrame((_, delta) => {
		const normalized = normalizedRef.current;
		if (normalized) normalized.mixer.update(delta);
		if (groupRef.current) groupRef.current.position.set(0, 0, 0);
	});
	const normalized = normalizedRef.current;
	if (!normalized) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("group", {
		ref: groupRef,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("group", {
			rotation: [
				0,
				normalized.forwardCorrectionY,
				0
			],
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("primitive", { object: normalized.scene })
		})
	});
}
function CharacterViewer(props) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
		fallback: null,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CharacterViewerInner, { ...props })
	});
}
function AnimationTestArena({ onBack }) {
	const uniqueFighters = getAllBannonFighters().filter((f, i, arr) => arr.findIndex((x) => x.id === f.id) === i);
	const [selectedFighter, setSelectedFighter] = (0, import_react.useState)(null);
	const [modelUrl, setModelUrl] = (0, import_react.useState)(null);
	const [currentStateIndex, setCurrentStateIndex] = (0, import_react.useState)(0);
	const [isAutoCycling, setIsAutoCycling] = (0, import_react.useState)(false);
	const [cycleInterval, setCycleInterval] = (0, import_react.useState)(2e3);
	const [integrityReport, setIntegrityReport] = (0, import_react.useState)(null);
	const [currentClipName, setCurrentClipName] = (0, import_react.useState)(null);
	const [currentClipSource, setCurrentClipSource] = (0, import_react.useState)("MISSING_CLIP");
	const [showLog, setShowLog] = (0, import_react.useState)(false);
	const autoCycleRef = (0, import_react.useRef)(null);
	const currentSemanticState = SEMANTIC_STATES[currentStateIndex];
	const handleSelectFighter = (0, import_react.useCallback)((fighter) => {
		setSelectedFighter(fighter);
		setIntegrityReport(null);
		setCurrentClipName(null);
		setCurrentClipSource("MISSING_CLIP");
		setCurrentStateIndex(0);
		const glbEntry = getGlbEntryForFighter(fighter.id, fighter.model) ?? BANNON_GLB_PLAYABLE_MODELS.find((e) => e.id === fighter.id);
		const url = glbEntry ? resolveGlbUrl(glbEntry.model, glbEntry.overrideUrl) : fighter.portraitUrl;
		setModelUrl(url);
		console.log(`[AnimTestArena] 🎭 Selected fighter: ${fighter.name} → ${url}`);
	}, []);
	const handleSelectAttire = (0, import_react.useCallback)((fighter, model) => {
		const entry = getGlbEntryForFighter(fighter.id, model);
		if (!entry) return;
		setSelectedFighter({
			...fighter,
			model: entry.model,
			attire: entry.attire,
			portraitUrl: resolveGlbUrl(entry.model, entry.overrideUrl)
		});
		setIntegrityReport(null);
		setCurrentClipName(null);
		setCurrentClipSource("MISSING_CLIP");
		setCurrentStateIndex(0);
		const url = resolveGlbUrl(entry.model, entry.overrideUrl);
		setModelUrl(url);
		console.log(`[AnimTestArena] 👕 Attire: ${entry.attire} → ${url}`);
	}, []);
	const goToState = (0, import_react.useCallback)((index) => {
		const clamped = (index % SEMANTIC_STATES.length + SEMANTIC_STATES.length) % SEMANTIC_STATES.length;
		setCurrentStateIndex(clamped);
		console.log(`[AnimTestArena] ▶️ Semantic state: "${SEMANTIC_STATES[clamped]}" (${clamped + 1}/${SEMANTIC_STATES.length})`);
	}, []);
	const prevState = (0, import_react.useCallback)(() => goToState(currentStateIndex - 1), [currentStateIndex, goToState]);
	const nextState = (0, import_react.useCallback)(() => goToState(currentStateIndex + 1), [currentStateIndex, goToState]);
	(0, import_react.useEffect)(() => {
		if (autoCycleRef.current) clearInterval(autoCycleRef.current);
		if (isAutoCycling && modelUrl) autoCycleRef.current = setInterval(() => {
			setCurrentStateIndex((i) => (i + 1) % SEMANTIC_STATES.length);
		}, cycleInterval);
		return () => {
			if (autoCycleRef.current) clearInterval(autoCycleRef.current);
		};
	}, [
		isAutoCycling,
		cycleInterval,
		modelUrl
	]);
	(0, import_react.useEffect)(() => {
		const handleKey = (e) => {
			if (e.key === "ArrowLeft" || e.key === "a") prevState();
			if (e.key === "ArrowRight" || e.key === "d") nextState();
			if (e.key === " ") setIsAutoCycling((v) => !v);
		};
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [prevState, nextState]);
	const handleReady = (0, import_react.useCallback)((result, report) => {
		setIntegrityReport(report);
		console.log(`[AnimTestArena] ✅ Character ready — verdict: ${report.verdict}`);
	}, []);
	const handleClipChange = (0, import_react.useCallback)((clipName, sourceType) => {
		setCurrentClipName(clipName);
		setCurrentClipSource(sourceType);
	}, []);
	const verdictColor = integrityReport ? integrityReport.verdict === "PASS" ? "#22c55e" : integrityReport.verdict === "TEST_ONLY" ? "#f59e0b" : integrityReport.verdict === "BLOCKED" ? "#ef4444" : "#94a3b8" : "#94a3b8";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 bg-[#0a0c12] text-white font-mono flex flex-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-[#0d1018]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onBack,
						className: "text-xs tracking-widest text-zinc-500 hover:text-white transition-colors border border-zinc-700 px-3 py-1",
						children: "← BACK"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-center",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[10px] tracking-[0.4em] text-zinc-500",
							children: "ANIMATION TEST ARENA"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs tracking-widest text-yellow-400",
							children: "MOVESET CREATION SCENE"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-[9px] tracking-widest text-zinc-600",
						children: [SEMANTIC_STATES.length, " STATES"]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-1 overflow-hidden",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "w-48 border-r border-zinc-800 bg-[#0d1018] overflow-y-auto flex-shrink-0",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "px-3 py-2 text-[9px] tracking-widest text-zinc-500 border-b border-zinc-800",
								children: "SELECT FIGHTER"
							}),
							uniqueFighters.map((fighter) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => handleSelectFighter(fighter),
								className: `w-full text-left px-3 py-2 text-xs border-b border-zinc-900 transition-colors ${selectedFighter?.id === fighter.id ? "bg-yellow-400/10 text-yellow-400 border-l-2 border-l-yellow-400" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "font-bold tracking-wider truncate",
									children: fighter.name.toUpperCase()
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[9px] text-zinc-600 truncate",
									children: fighter.fightingStyle.split("/")[0]
								})]
							}, fighter.id)),
							selectedFighter && getPlayableAttires(selectedFighter.id).length > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "px-3 py-2 border-t border-zinc-800",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[9px] tracking-widest text-zinc-500 mb-1",
									children: "ATTIRE"
								}), getPlayableAttires(selectedFighter.id).map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => handleSelectAttire(selectedFighter, entry.model),
									className: `w-full text-left px-2 py-1 text-[10px] truncate mb-0.5 border ${selectedFighter.model === entry.model ? "border-yellow-400 text-yellow-300 bg-yellow-400/10" : "border-zinc-800 text-zinc-500 hover:text-zinc-300"}`,
									children: (entry.attire ?? "Default").toUpperCase()
								}, entry.model))]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1 relative",
						children: [
							!modelUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "absolute inset-0 flex items-center justify-center",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-center",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-zinc-600 text-xs tracking-widest mb-2",
										children: "SELECT A FIGHTER"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-zinc-800 text-[10px]",
										children: "to begin animation testing"
									})]
								})
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Canvas, {
								camera: {
									position: [
										0,
										1.5,
										3.5
									],
									fov: 50
								},
								gl: { antialias: true },
								style: { background: "#0a0c12" },
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ambientLight", { intensity: .6 }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("directionalLight", {
										position: [
											3,
											5,
											3
										],
										intensity: 1.2,
										castShadow: true
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("directionalLight", {
										position: [
											-3,
											3,
											-3
										],
										intensity: .4,
										color: "#4466ff"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Grid, {
										args: [10, 10],
										cellSize: .5,
										cellThickness: .5,
										cellColor: "#1a1f2e",
										sectionSize: 2,
										sectionThickness: 1,
										sectionColor: "#2a3050",
										fadeDistance: 8,
										fadeStrength: 1,
										followCamera: false,
										infiniteGrid: true
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CharacterViewer, {
										modelUrl,
										currentSemanticState,
										onReady: handleReady,
										onClipChange: handleClipChange
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrbitControls, {
										target: [
											0,
											1,
											0
										],
										minDistance: 1.5,
										maxDistance: 8,
										enablePan: false
									})
								]
							}),
							modelUrl && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "absolute top-3 left-1/2 -translate-x-1/2 text-center pointer-events-none",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[10px] tracking-widest text-zinc-500",
										children: [
											currentStateIndex + 1,
											" / ",
											SEMANTIC_STATES.length
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-2xl font-black tracking-widest text-white mt-1",
										children: currentSemanticState.toUpperCase().replace("_", " ")
									}),
									currentClipName && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-1 text-[10px] tracking-wider px-2 py-0.5 rounded",
										style: {
											color: CLIP_SOURCE_COLORS[currentClipSource],
											background: `${CLIP_SOURCE_COLORS[currentClipSource]}22`
										},
										children: [
											CLIP_SOURCE_LABELS[currentClipSource],
											": ",
											currentClipName
										]
									}),
									!currentClipName && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-1 text-[10px] tracking-wider text-red-400",
										children: "⚠️ MISSING_CLIP — no animation for this state"
									})
								]
							}),
							modelUrl && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: prevState,
										className: "w-10 h-10 bg-zinc-800/90 border border-zinc-700 text-white text-lg hover:bg-zinc-700 transition-colors",
										children: "←"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => setIsAutoCycling((v) => !v),
										className: `px-4 h-10 border text-xs tracking-widest transition-colors ${isAutoCycling ? "bg-yellow-400/20 border-yellow-400 text-yellow-400" : "bg-zinc-800/90 border-zinc-700 text-zinc-400 hover:text-white"}`,
										children: isAutoCycling ? "⏸ PAUSE" : "▶ AUTO"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: nextState,
										className: "w-10 h-10 bg-zinc-800/90 border border-zinc-700 text-white text-lg hover:bg-zinc-700 transition-colors",
										children: "→"
									})
								]
							}),
							modelUrl && isAutoCycling && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[9px] text-zinc-500 tracking-widest",
									children: "SPEED"
								}), [
									500,
									1e3,
									2e3,
									3e3
								].map((ms) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setCycleInterval(ms),
									className: `px-2 py-0.5 text-[9px] border transition-colors ${cycleInterval === ms ? "border-yellow-400 text-yellow-400" : "border-zinc-700 text-zinc-500 hover:text-white"}`,
									children: ms < 1e3 ? `${ms}ms` : `${ms / 1e3}s`
								}, ms))]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "w-64 border-l border-zinc-800 bg-[#0d1018] overflow-y-auto flex-shrink-0",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "px-3 py-2 text-[9px] tracking-widest text-zinc-500 border-b border-zinc-800 flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "INTEGRITY GATE" }), integrityReport && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[9px] font-bold tracking-widest px-1.5 py-0.5",
									style: {
										color: verdictColor,
										background: `${verdictColor}22`
									},
									children: integrityReport.verdict
								})]
							}),
							!integrityReport ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "px-3 py-4 text-[10px] text-zinc-600",
								children: modelUrl ? "Loading..." : "Select a fighter"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "px-3 py-2 space-y-3 text-[10px]",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-1",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[9px] tracking-widest text-zinc-500 mb-1",
												children: "ASSET"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
												label: "VISIBLE MESHES",
												value: integrityReport.visibleMeshCount
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
												label: "SKINNED MESHES",
												value: integrityReport.skinnedMeshCount,
												warn: integrityReport.skinnedMeshCount === 0
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
												label: "SKELETON BONES",
												value: integrityReport.skeletonBoneCount,
												warn: integrityReport.skeletonBoneCount === 0
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-1",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[9px] tracking-widest text-zinc-500 mb-1",
												children: "CLIP SOURCES"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
												label: "TOTAL CLIPS",
												value: integrityReport.animationClipCount
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
												label: "AUTHORED",
												value: integrityReport.authoredClipCount,
												color: integrityReport.authoredClipCount > 0 ? "#22c55e" : void 0
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
												label: "RETARGETED",
												value: integrityReport.retargetedClipCount,
												color: integrityReport.retargetedClipCount > 0 ? "#3b82f6" : void 0
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
												label: "PLACEHOLDER",
												value: integrityReport.placeholderClipCount,
												color: integrityReport.placeholderClipCount > 0 ? "#f59e0b" : void 0,
												warn: integrityReport.placeholderClipCount > 0 && integrityReport.authoredClipCount === 0
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
												label: "MISSING",
												value: integrityReport.missingClipCount,
												warn: integrityReport.missingClipCount > 0
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-1",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[9px] tracking-widest text-zinc-500 mb-1",
												children: "TRACKS"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
												label: "TOTAL",
												value: integrityReport.totalTrackCount
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
												label: "RESOLVED",
												value: integrityReport.resolvedTrackCount,
												color: "#22c55e"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
												label: "UNRESOLVED",
												value: integrityReport.unresolvedTrackCount,
												warn: integrityReport.unresolvedTrackCount > 0
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-1",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[9px] tracking-widest text-zinc-500 mb-1",
												children: "ACTIVE CLIP"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[10px] break-all",
												style: { color: CLIP_SOURCE_COLORS[integrityReport.activeClipSourceType] },
												children: integrityReport.activeClipName ?? "NONE"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-[9px] text-zinc-500",
												children: [
													"[",
													CLIP_SOURCE_LABELS[integrityReport.activeClipSourceType],
													"]"
												]
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-1",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[9px] tracking-widest text-zinc-500 mb-1",
												children: "BONE TRAVEL"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
												label: "MAX DIST",
												value: `${integrityReport.maxBoneTravelMetres.toFixed(4)}m`,
												warn: integrityReport.maxBoneTravelMetres < 1e-4
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
												label: "MAX ROT",
												value: `${integrityReport.maxBoneRotationDegrees.toFixed(2)}°`,
												warn: integrityReport.maxBoneRotationDegrees < .01
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[9px] tracking-widest text-zinc-500 mb-1",
											children: "MIXER"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
											label: "ROOT = CLONE",
											value: integrityReport.mixerRootIsVisibleClone ? "YES ✅" : "NO ❌",
											warn: !integrityReport.mixerRootIsVisibleClone
										})]
									}),
									integrityReport.warningChecks.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[9px] tracking-widest text-zinc-500 mb-1",
											children: "WARNINGS"
										}), integrityReport.warningChecks.map((w) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-[9px] text-yellow-400",
											children: ["⚠️ ", w]
										}, w))]
									}),
									integrityReport.failingChecks.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[9px] tracking-widest text-zinc-500 mb-1",
											children: "FAILURES"
										}), integrityReport.failingChecks.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-[9px] text-red-400",
											children: ["❌ ", f]
										}, f))]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => setShowLog((v) => !v),
										className: "w-full text-[9px] tracking-widest text-zinc-500 border border-zinc-700 py-1 hover:text-white hover:border-zinc-500 transition-colors",
										children: showLog ? "HIDE LOG" : "SHOW LOG"
									}),
									showLog && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "bg-black/50 border border-zinc-800 p-2 max-h-48 overflow-y-auto",
										children: integrityReport.logLines.map((line, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[8px] text-zinc-400 leading-relaxed whitespace-pre-wrap",
											children: line
										}, i))
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border-t border-zinc-800 mt-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "px-3 py-2 text-[9px] tracking-widest text-zinc-500",
									children: "ALL STATES"
								}), SEMANTIC_STATES.map((state, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => goToState(i),
									className: `w-full text-left px-3 py-1.5 text-[10px] border-b border-zinc-900 transition-colors ${i === currentStateIndex ? "bg-yellow-400/10 text-yellow-400" : "text-zinc-500 hover:text-white hover:bg-zinc-800/30"}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-zinc-700 mr-2",
										children: String(i + 1).padStart(2, "0")
									}), state.toUpperCase().replace("_", " ")]
								}, state))]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "px-4 py-1.5 border-t border-zinc-800 bg-[#0d1018] flex items-center gap-6 text-[9px] text-zinc-600",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "← → NAVIGATE STATES" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "SPACE AUTO-CYCLE" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "ORBIT DRAG TO ROTATE" }),
					integrityReport && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						style: { color: verdictColor },
						children: [
							"VERDICT: ",
							integrityReport.verdict,
							integrityReport.verdict === "TEST_ONLY" && " (placeholder only — not real animation)"
						]
					})
				]
			})
		]
	});
}
function Row({ label, value, warn = false, color }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center justify-between",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-zinc-600",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "font-bold",
			style: { color: color ?? (warn ? "#f59e0b" : "#e2e8f0") },
			children: value
		})]
	});
}
//#endregion
export { AnimationTestArena as default };
