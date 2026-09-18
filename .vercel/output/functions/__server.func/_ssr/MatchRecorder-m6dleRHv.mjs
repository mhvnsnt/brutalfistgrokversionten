import { a as __toESM } from "../_runtime.mjs";
import { c as require_jsx_runtime, l as require_react } from "../_libs/@react-three/drei+[...].mjs";
import { l as useAuth } from "./routes-DbIfrPB2.mjs";
import { t as createClient } from "./client-CENlhkXr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/MatchRecorder-m6dleRHv.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* MatchRecorder — 30-second rolling match recorder with frame-by-frame scrub,
* tournament-ready clip export, Supabase persistence, and replay playback.
*/
var MAX_BUFFER_FRAMES = 1800;
function useMatchRecorder() {
	const bufferRef = (0, import_react.useRef)([]);
	const frameCountRef = (0, import_react.useRef)(0);
	const isRecordingRef = (0, import_react.useRef)(false);
	const startRecording = (0, import_react.useCallback)(() => {
		bufferRef.current = [];
		frameCountRef.current = 0;
		isRecordingRef.current = true;
	}, []);
	const stopRecording = (0, import_react.useCallback)(() => {
		isRecordingRef.current = false;
	}, []);
	const recordFrame = (0, import_react.useCallback)((frame) => {
		if (!isRecordingRef.current) return;
		const f = {
			...frame,
			frameIndex: frameCountRef.current++
		};
		bufferRef.current.push(f);
		if (bufferRef.current.length > MAX_BUFFER_FRAMES) bufferRef.current.shift();
	}, []);
	const getBuffer = (0, import_react.useCallback)(() => {
		return [...bufferRef.current];
	}, []);
	const isRecording = () => isRecordingRef.current;
	return {
		startRecording,
		stopRecording,
		recordFrame,
		getBuffer,
		isRecording
	};
}
async function saveReplayToSupabase(clip, userId) {
	const { error } = await createClient().from("match_replays").upsert({
		user_id: userId,
		clip_id: clip.id,
		label: clip.label,
		p1_name: clip.p1Name,
		p2_name: clip.p2Name,
		stage_name: clip.stageName,
		total_frames: clip.totalFrames,
		duration_ms: clip.durationMs,
		in_point: clip.inPoint,
		out_point: clip.outPoint,
		speed_multiplier: clip.speedMultiplier,
		frames_json: clip.frames,
		exported_at: clip.exportedAt
	}, { onConflict: "clip_id" });
	if (error) {
		console.error("[MatchRecorder] Supabase save error:", error.message);
		return {
			success: false,
			error: error.message
		};
	}
	return { success: true };
}
async function fetchReplaysFromSupabase(userId) {
	const { data, error } = await createClient().from("match_replays").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
	if (error || !data) return [];
	return data.map((r) => ({
		id: r.id,
		clipId: r.clip_id,
		label: r.label,
		p1Name: r.p1_name,
		p2Name: r.p2_name,
		stageName: r.stage_name,
		totalFrames: r.total_frames,
		durationMs: r.duration_ms,
		inPoint: r.in_point,
		outPoint: r.out_point,
		speedMultiplier: r.speed_multiplier,
		framesJson: r.frames_json ?? [],
		exportedAt: r.exported_at,
		createdAt: r.created_at
	}));
}
function ReplayScrubber({ replay, onClose }) {
	const frames = replay.framesJson;
	const [scrubIndex, setScrubIndex] = (0, import_react.useState)(replay.inPoint);
	const [inPoint, setInPoint] = (0, import_react.useState)(replay.inPoint);
	const [outPoint, setOutPoint] = (0, import_react.useState)(Math.min(replay.outPoint, frames.length - 1));
	const [speed, setSpeed] = (0, import_react.useState)(replay.speedMultiplier);
	const [isPlaying, setIsPlaying] = (0, import_react.useState)(false);
	const playIntervalRef = (0, import_react.useRef)(null);
	const totalFrames = frames.length;
	const currentFrame = frames[scrubIndex];
	(0, import_react.useEffect)(() => {
		if (!isPlaying || totalFrames === 0) {
			if (playIntervalRef.current) clearInterval(playIntervalRef.current);
			return;
		}
		const intervalMs = Math.max(8, 1e3 / 60 / speed);
		playIntervalRef.current = setInterval(() => {
			setScrubIndex((prev) => {
				const next = prev + 1;
				if (next > outPoint) return inPoint;
				return next;
			});
		}, intervalMs);
		return () => {
			if (playIntervalRef.current) clearInterval(playIntervalRef.current);
		};
	}, [
		isPlaying,
		speed,
		inPoint,
		outPoint,
		totalFrames
	]);
	if (totalFrames === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border border-zinc-800 bg-zinc-950 p-4 space-y-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-[9px] text-yellow-400 tracking-widest font-black",
				children: "REPLAY VIEWER"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: onClose,
				className: "text-zinc-600 hover:text-zinc-300 text-xs",
				children: "✕"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-[8px] text-zinc-600",
			children: "No frame data available for this replay."
		})]
	});
	const clipDurationSec = frames[outPoint] ? ((frames[outPoint]?.timestamp ?? 0) - (frames[inPoint]?.timestamp ?? 0)) / 1e3 : 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border border-yellow-900/60 bg-black/95 p-3 space-y-2",
		style: { backdropFilter: "blur(8px)" },
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[9px] text-yellow-400 tracking-widest font-black",
					children: "REPLAY VIEWER"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[7px] text-zinc-500 mt-0.5 truncate max-w-[200px]",
					children: replay.label
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: onClose,
					className: "text-zinc-600 hover:text-zinc-300 text-xs",
					children: "✕"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-3 gap-1 text-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "border border-zinc-900 py-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[8px] font-black text-blue-400",
							children: replay.p1Name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[6px] text-zinc-700",
							children: "P1"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "border border-zinc-900 py-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[7px] text-zinc-500",
							children: replay.stageName
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[6px] text-zinc-700",
							children: "STAGE"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "border border-zinc-900 py-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[8px] font-black text-red-400",
							children: replay.p2Name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[6px] text-zinc-700",
							children: "P2"
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "text-[7px] text-zinc-500 tracking-wider",
				children: [
					totalFrames,
					" frames · ",
					(replay.durationMs / 1e3).toFixed(1),
					"s total"
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "range",
					min: 0,
					max: totalFrames - 1,
					value: scrubIndex,
					onChange: (e) => {
						setIsPlaying(false);
						setScrubIndex(Number(e.target.value));
					},
					className: "w-full h-1 accent-yellow-400"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex justify-between text-[6px] text-zinc-600",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["F", frames[0]?.frameIndex ?? 0] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-yellow-400",
							children: ["F", currentFrame?.frameIndex ?? 0]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["F", frames[totalFrames - 1]?.frameIndex ?? 0] })
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => {
							setIsPlaying(false);
							setScrubIndex((i) => Math.max(0, i - 1));
						},
						className: "text-[8px] border border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white px-2 py-0.5",
						children: "◀"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setIsPlaying((p) => !p),
						className: `text-[8px] border px-2 py-0.5 flex-1 ${isPlaying ? "border-yellow-600 text-yellow-400" : "border-zinc-700 text-zinc-300 hover:text-white"}`,
						children: isPlaying ? "⏸ PAUSE" : "▶ PLAY"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => {
							setIsPlaying(false);
							setScrubIndex((i) => Math.min(totalFrames - 1, i + 1));
						},
						className: "text-[8px] border border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white px-2 py-0.5",
						children: "▶"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[7px] text-zinc-500 w-10",
						children: "SPEED"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "range",
						min: .1,
						max: 4,
						step: .1,
						value: speed,
						onChange: (e) => setSpeed(Number(e.target.value)),
						className: "flex-1 h-1 accent-yellow-400"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-[7px] text-yellow-400 w-8 text-right",
						children: [speed.toFixed(1), "x"]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[7px] text-zinc-500 tracking-wider",
						children: "REGION CROP"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[6px] text-zinc-600 mb-0.5",
									children: "IN"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "range",
									min: 0,
									max: totalFrames - 1,
									value: inPoint,
									onChange: (e) => setInPoint(Math.min(Number(e.target.value), outPoint)),
									className: "w-full h-1 accent-blue-400"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-[6px] text-blue-400",
									children: ["F", inPoint]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[6px] text-zinc-600 mb-0.5",
									children: "OUT"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "range",
									min: 0,
									max: totalFrames - 1,
									value: outPoint,
									onChange: (e) => setOutPoint(Math.max(Number(e.target.value), inPoint)),
									className: "w-full h-1 accent-red-400"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-[6px] text-red-400",
									children: ["F", outPoint]
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-[6px] text-zinc-600",
						children: [
							"Clip: ",
							outPoint - inPoint + 1,
							" frames · ",
							clipDurationSec.toFixed(2),
							"s"
						]
					})
				]
			}),
			currentFrame && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border border-zinc-800 bg-zinc-950 p-1.5 space-y-0.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[6px] text-zinc-500 tracking-wider",
						children: "FRAME DATA"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 gap-x-2 text-[6px]",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-blue-400",
								children: ["P1: ", currentFrame.p1Animation]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-red-400",
								children: ["P2: ", currentFrame.p2Animation]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-blue-300",
								children: ["HP: ", Math.ceil(currentFrame.p1Health)]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-red-300",
								children: ["HP: ", Math.ceil(currentFrame.p2Health)]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-zinc-400",
								children: ["State: ", currentFrame.p1State]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-zinc-400",
								children: ["State: ", currentFrame.p2State]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-[6px] text-zinc-600",
						children: [
							"Timer: ",
							currentFrame.roundTimer,
							"s · F",
							currentFrame.frameIndex
						]
					})
				]
			})
		]
	});
}
function PauseMenuRecorder({ p1Name, p2Name, stageName, getBuffer, isRecording, onScrubFrame }) {
	const { user } = useAuth();
	const [frames, setFrames] = (0, import_react.useState)([]);
	const [scrubIndex, setScrubIndex] = (0, import_react.useState)(0);
	const [inPoint, setInPoint] = (0, import_react.useState)(0);
	const [outPoint, setOutPoint] = (0, import_react.useState)(0);
	const [speed, setSpeed] = (0, import_react.useState)(1);
	const [isPlaying, setIsPlaying] = (0, import_react.useState)(false);
	const [exportStatus, setExportStatus] = (0, import_react.useState)(null);
	const [saveStatus, setSaveStatus] = (0, import_react.useState)(null);
	const playIntervalRef = (0, import_react.useRef)(null);
	const loadBuffer = (0, import_react.useCallback)(() => {
		const buf = getBuffer();
		setFrames(buf);
		if (buf.length > 0) {
			setScrubIndex(buf.length - 1);
			setInPoint(0);
			setOutPoint(buf.length - 1);
		}
	}, [getBuffer]);
	(0, import_react.useEffect)(() => {
		loadBuffer();
	}, [loadBuffer]);
	(0, import_react.useEffect)(() => {
		if (!isPlaying || frames.length === 0) {
			if (playIntervalRef.current) clearInterval(playIntervalRef.current);
			return;
		}
		const intervalMs = Math.max(8, 1e3 / 60 / speed);
		playIntervalRef.current = setInterval(() => {
			setScrubIndex((prev) => {
				const next = prev + 1;
				if (next > outPoint) return inPoint;
				return next;
			});
		}, intervalMs);
		return () => {
			if (playIntervalRef.current) clearInterval(playIntervalRef.current);
		};
	}, [
		isPlaying,
		speed,
		inPoint,
		outPoint,
		frames.length
	]);
	(0, import_react.useEffect)(() => {
		if (frames[scrubIndex] && onScrubFrame) onScrubFrame(frames[scrubIndex]);
	}, [
		scrubIndex,
		frames,
		onScrubFrame
	]);
	const buildClip = (0, import_react.useCallback)(() => ({
		id: `clip_${Date.now()}`,
		label: `${p1Name} vs ${p2Name} — ${stageName}`,
		p1Name,
		p2Name,
		stageName,
		frames: frames.slice(inPoint, outPoint + 1),
		inPoint,
		outPoint,
		speedMultiplier: speed,
		exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
		totalFrames: outPoint - inPoint + 1,
		durationMs: frames[outPoint] ? frames[outPoint].timestamp - (frames[inPoint]?.timestamp ?? 0) : 0
	}), [
		frames,
		inPoint,
		outPoint,
		speed,
		p1Name,
		p2Name,
		stageName
	]);
	const exportClip = (0, import_react.useCallback)(() => {
		if (frames.length === 0) return;
		const clip = buildClip();
		const blob = new Blob([JSON.stringify(clip, null, 2)], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `brutal_fist_clip_${clip.id}.json`;
		a.click();
		URL.revokeObjectURL(url);
		setExportStatus(`✓ Exported ${clip.totalFrames} frames (${(clip.durationMs / 1e3).toFixed(2)}s)`);
		setTimeout(() => setExportStatus(null), 3e3);
	}, [frames, buildClip]);
	const saveToCloud = (0, import_react.useCallback)(async () => {
		if (frames.length === 0 || !user?.id) {
			setSaveStatus("⚠ Sign in to save replays");
			setTimeout(() => setSaveStatus(null), 2500);
			return;
		}
		setSaveStatus("⏳ Saving...");
		const result = await saveReplayToSupabase(buildClip(), user.id);
		if (result.success) setSaveStatus("✓ Saved to cloud");
		else setSaveStatus(`✗ ${result.error ?? "Save failed"}`);
		setTimeout(() => setSaveStatus(null), 3e3);
	}, [
		frames,
		buildClip,
		user?.id
	]);
	const currentFrame = frames[scrubIndex];
	const totalFrames = frames.length;
	const durationSec = totalFrames > 0 ? ((frames[totalFrames - 1]?.timestamp ?? 0) - (frames[0]?.timestamp ?? 0)) / 1e3 : 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-2 font-mono",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-[9px] text-yellow-400 tracking-widest font-black",
					children: "⏺ MATCH RECORDER"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [isRecording() && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[7px] text-red-400 animate-pulse tracking-widest",
						children: "● LIVE"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-[7px] text-zinc-500",
						children: [
							totalFrames,
							" frames · ",
							durationSec.toFixed(1),
							"s"
						]
					})]
				})]
			}),
			totalFrames > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "range",
					min: 0,
					max: totalFrames - 1,
					value: scrubIndex,
					onChange: (e) => {
						setIsPlaying(false);
						setScrubIndex(Number(e.target.value));
					},
					className: "w-full h-1 accent-yellow-400"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex justify-between text-[6px] text-zinc-600",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["F", frames[0]?.frameIndex ?? 0] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-yellow-400",
							children: ["F", currentFrame?.frameIndex ?? 0]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["F", frames[totalFrames - 1]?.frameIndex ?? 0] })
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => {
							setIsPlaying(false);
							setScrubIndex((i) => Math.max(0, i - 1));
						},
						className: "text-[8px] border border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white px-2 py-0.5",
						children: "◀"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setIsPlaying((p) => !p),
						className: `text-[8px] border px-2 py-0.5 flex-1 ${isPlaying ? "border-yellow-600 text-yellow-400" : "border-zinc-700 text-zinc-300 hover:text-white"}`,
						children: isPlaying ? "⏸ PAUSE" : "▶ PLAY"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => {
							setIsPlaying(false);
							setScrubIndex((i) => Math.min(totalFrames - 1, i + 1));
						},
						className: "text-[8px] border border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white px-2 py-0.5",
						children: "▶"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[7px] text-zinc-500 w-10",
						children: "SPEED"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "range",
						min: .1,
						max: 4,
						step: .1,
						value: speed,
						onChange: (e) => setSpeed(Number(e.target.value)),
						className: "flex-1 h-1 accent-yellow-400"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-[7px] text-yellow-400 w-8 text-right",
						children: [speed.toFixed(1), "x"]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[7px] text-zinc-500 tracking-wider",
					children: "REGION CROP"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[6px] text-zinc-600 mb-0.5",
								children: "IN"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "range",
								min: 0,
								max: Math.max(0, totalFrames - 1),
								value: inPoint,
								onChange: (e) => setInPoint(Math.min(Number(e.target.value), outPoint)),
								className: "w-full h-1 accent-blue-400"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-[6px] text-blue-400",
								children: ["F", inPoint]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[6px] text-zinc-600 mb-0.5",
								children: "OUT"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "range",
								min: 0,
								max: Math.max(0, totalFrames - 1),
								value: outPoint,
								onChange: (e) => setOutPoint(Math.max(Number(e.target.value), inPoint)),
								className: "w-full h-1 accent-red-400"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-[6px] text-red-400",
								children: ["F", outPoint]
							})
						]
					})]
				})]
			}),
			currentFrame && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border border-zinc-800 bg-zinc-950 p-1.5 space-y-0.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[6px] text-zinc-500 tracking-wider",
						children: "FRAME DATA"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 gap-x-2 text-[6px]",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-blue-400",
								children: ["P1: ", currentFrame.p1Animation]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-red-400",
								children: ["P2: ", currentFrame.p2Animation]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-blue-300",
								children: ["HP: ", Math.ceil(currentFrame.p1Health)]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-red-300",
								children: ["HP: ", Math.ceil(currentFrame.p2Health)]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-[6px] text-zinc-600",
						children: [
							"Timer: ",
							currentFrame.roundTimer,
							"s · F",
							currentFrame.frameIndex
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: saveToCloud,
					disabled: totalFrames === 0,
					className: "w-full text-[8px] font-black tracking-widest border border-blue-700 text-blue-400 hover:bg-blue-900/30 py-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors",
					children: "☁ SAVE TO CLOUD"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: exportClip,
					disabled: totalFrames === 0,
					className: "w-full text-[8px] font-black tracking-widest border border-yellow-700 text-yellow-400 hover:bg-yellow-900/30 py-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors",
					children: "⬇ EXPORT CLIP"
				})]
			}),
			saveStatus && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: `text-[7px] tracking-wider ${saveStatus.startsWith("✓") ? "text-blue-400" : saveStatus.startsWith("⏳") ? "text-zinc-400" : "text-red-400"}`,
				children: saveStatus
			}),
			exportStatus && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-[7px] text-green-400 tracking-wider",
				children: exportStatus
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: loadBuffer,
				className: "w-full text-[7px] text-zinc-600 hover:text-zinc-400 border border-zinc-800 py-0.5 transition-colors",
				children: "↻ REFRESH BUFFER"
			})
		]
	});
}
//#endregion
export { useMatchRecorder as a, saveReplayToSupabase as i, ReplayScrubber as n, fetchReplaysFromSupabase as r, PauseMenuRecorder as t };
