import { a as __toESM } from "../_runtime.mjs";
import { t as BANNON_GLB_PLAYABLE_MODELS } from "./bannonGlbRoster-Th39Z2sz.mjs";
import { c as require_jsx_runtime, l as require_react } from "../_libs/@react-three/drei+[...].mjs";
import { d as getAllBannonFighters, l as useAuth, u as BANNON_ROSTER } from "./routes-DbIfrPB2.mjs";
import { t as createClient } from "./client-CENlhkXr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/MatchmakingQueueScreen-BWw74LVw.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* CosmeticUnlockSystem — Auto-grants cosmetic unlocks on ranked match wins
* based on opponent tier, win streak, and milestone thresholds.
*/
var WIN_MILESTONES = [
	{
		wins: 1,
		reward: {
			id: "milestone_1win",
			name: "FIRST BLOOD BANNER",
			type: "BANNER",
			rarity: "COMMON",
			color: "#ef4444",
			unlockReason: "First ranked win"
		}
	},
	{
		wins: 5,
		reward: {
			id: "milestone_5wins",
			name: "BRUTAL AURA",
			type: "EFFECT",
			rarity: "RARE",
			color: "#ef4444",
			unlockReason: "5 ranked wins"
		}
	},
	{
		wins: 10,
		reward: {
			id: "milestone_10wins",
			name: "SHADOW ATTIRE",
			type: "OUTFIT",
			rarity: "RARE",
			color: "#7c3aed",
			unlockReason: "10 ranked wins"
		}
	},
	{
		wins: 15,
		reward: {
			id: "milestone_15wins",
			name: "VOID AURA",
			type: "EFFECT",
			rarity: "EPIC",
			color: "#8b5cf6",
			unlockReason: "15 ranked wins"
		}
	},
	{
		wins: 25,
		reward: {
			id: "milestone_25wins",
			name: "LEGEND TITLE",
			type: "TITLE",
			rarity: "LEGENDARY",
			color: "#facc15",
			unlockReason: "25 ranked wins"
		}
	},
	{
		wins: 50,
		reward: {
			id: "milestone_50wins",
			name: "GRANDMASTER ATTIRE",
			type: "OUTFIT",
			rarity: "LEGENDARY",
			color: "#facc15",
			unlockReason: "50 ranked wins — Grandmaster"
		}
	}
];
var STREAK_REWARDS = [
	{
		streak: 3,
		reward: {
			id: "streak_3",
			name: "HOT STREAK BADGE",
			type: "BADGE",
			rarity: "RARE",
			color: "#f97316",
			unlockReason: "3-win streak"
		}
	},
	{
		streak: 5,
		reward: {
			id: "streak_5",
			name: "UNSTOPPABLE AURA",
			type: "EFFECT",
			rarity: "EPIC",
			color: "#a855f7",
			unlockReason: "5-win streak"
		}
	},
	{
		streak: 10,
		reward: {
			id: "streak_10",
			name: "STREAK LEGEND TITLE",
			type: "TITLE",
			rarity: "LEGENDARY",
			color: "#facc15",
			unlockReason: "10-win streak"
		}
	}
];
var TIER_UPSET_REWARDS = {
	gold: {
		id: "tier_upset_gold",
		name: "GOLD SLAYER BADGE",
		type: "BADGE",
		rarity: "RARE",
		color: "#facc15",
		unlockReason: "Beat a Gold tier opponent"
	},
	platinum: {
		id: "tier_upset_platinum",
		name: "PLATINUM BREAKER EFFECT",
		type: "EFFECT",
		rarity: "EPIC",
		color: "#67e8f9",
		unlockReason: "Beat a Platinum tier opponent"
	},
	diamond: {
		id: "tier_upset_diamond",
		name: "DIAMOND CRUSHER OUTFIT",
		type: "OUTFIT",
		rarity: "EPIC",
		color: "#a78bfa",
		unlockReason: "Beat a Diamond tier opponent"
	},
	legend: {
		id: "tier_upset_legend",
		name: "LEGEND SLAYER TITLE",
		type: "TITLE",
		rarity: "LEGENDARY",
		color: "#f97316",
		unlockReason: "Beat a Legend tier opponent"
	}
};
var RARITY_COLOR = {
	COMMON: "#94a3b8",
	RARE: "#3b82f6",
	EPIC: "#a855f7",
	LEGENDARY: "#facc15"
};
/**
* Evaluate which cosmetics should be auto-granted for a ranked win.
* Returns array of rewards to grant (deduplication handled by caller).
*/
function evaluateCosmeticUnlocks(result) {
	if (!result.isRankedWin) return [];
	const rewards = [];
	for (const milestone of WIN_MILESTONES) if (result.totalWins === milestone.wins) rewards.push(milestone.reward);
	for (const streakReward of STREAK_REWARDS) if (result.winStreak === streakReward.streak) rewards.push(streakReward.reward);
	const opponentTierLower = result.opponentTier.toLowerCase();
	if (TIER_UPSET_REWARDS[opponentTierLower]) rewards.push(TIER_UPSET_REWARDS[opponentTierLower]);
	return rewards;
}
/**
* Persist cosmetic unlock to Supabase cosmetic_unlocks table.
*/
async function persistCosmeticUnlock(userId, reward, context) {
	await createClient().from("cosmetic_unlocks").insert({
		user_id: userId,
		cosmetic_id: reward.id,
		cosmetic_name: reward.name,
		cosmetic_type: reward.type,
		rarity: reward.rarity,
		unlock_source: "ranked_win",
		unlock_context: context,
		unlocked_at: (/* @__PURE__ */ new Date()).toISOString()
	});
}
function CosmeticUnlockBanner({ rewards, onDismiss }) {
	const [visible, setVisible] = (0, import_react.useState)(true);
	const [currentIdx, setCurrentIdx] = (0, import_react.useState)(0);
	(0, import_react.useEffect)(() => {
		if (rewards.length === 0) return;
		const timer = setTimeout(() => {
			if (currentIdx < rewards.length - 1) setCurrentIdx((i) => i + 1);
			else {
				setVisible(false);
				onDismiss();
			}
		}, 3500);
		return () => clearTimeout(timer);
	}, [
		currentIdx,
		rewards.length,
		onDismiss
	]);
	if (!visible || rewards.length === 0) return null;
	const reward = rewards[currentIdx];
	const rarityColor = RARITY_COLOR[reward.rarity] ?? "#94a3b8";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-[100] flex items-center justify-center pointer-events-none",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "pointer-events-auto mx-4 border-2 p-5 text-center font-mono max-w-xs w-full",
			style: {
				borderColor: rarityColor,
				background: `rgba(0,0,0,0.95)`,
				boxShadow: `0 0 40px ${rarityColor}44, 0 0 80px ${rarityColor}22`
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute top-0 left-0 right-0 h-0.5",
					style: { background: rarityColor }
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[7px] tracking-[0.5em] mb-2",
					style: { color: rarityColor },
					children: "COSMETIC UNLOCKED"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[8px] tracking-widest text-zinc-500 mb-1",
					children: reward.type
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-xl font-black tracking-widest mb-2",
					style: { color: rarityColor },
					children: reward.name
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[7px] tracking-widest mb-3",
					style: { color: `${rarityColor}88` },
					children: reward.rarity
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[8px] text-zinc-500 mb-4",
					children: reward.unlockReason
				}),
				rewards.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-[6px] text-zinc-700 mb-3",
					children: [
						currentIdx + 1,
						" / ",
						rewards.length
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => {
						if (currentIdx < rewards.length - 1) setCurrentIdx((i) => i + 1);
						else {
							setVisible(false);
							onDismiss();
						}
					},
					className: "text-[7px] tracking-[0.3em] border px-4 py-2 transition-all hover:bg-white/5",
					style: {
						borderColor: `${rarityColor}60`,
						color: rarityColor
					},
					children: currentIdx < rewards.length - 1 ? "NEXT ▶" : "COLLECT"
				})
			]
		})
	});
}
/**
* Call triggerUnlockCheck after a ranked win to auto-evaluate and show banners.
*/
function useRankedCosmeticUnlocks(userId) {
	const [pendingRewards, setPendingRewards] = (0, import_react.useState)([]);
	const grantedIds = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	return {
		pendingRewards,
		triggerUnlockCheck: (0, import_react.useCallback)(async (result) => {
			if (!userId) return;
			const newRewards = evaluateCosmeticUnlocks(result).filter((r) => !grantedIds.current.has(r.id));
			if (newRewards.length === 0) return;
			newRewards.forEach((r) => grantedIds.current.add(r.id));
			setPendingRewards(newRewards);
			for (const reward of newRewards) await persistCosmeticUnlock(userId, reward, result.unlockReason ?? result.opponentTier);
		}, [userId]),
		dismissRewards: (0, import_react.useCallback)(() => {
			setPendingRewards([]);
		}, [])
	};
}
function StatusBadge({ ok, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: `inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider
        ${ok ? "bg-green-900/60 text-green-300 border border-green-700" : "bg-red-900/60 text-red-300 border border-red-700"}`,
		children: [
			ok ? "✓" : "✗",
			" ",
			label
		]
	});
}
function ClipRow({ name, trackCount }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2 py-0.5 border-b border-zinc-800/50 last:border-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-zinc-400 font-mono text-[10px] flex-1 truncate",
			children: name
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "text-zinc-600 font-mono text-[9px] shrink-0",
			children: [trackCount, " tracks"]
		})]
	});
}
function FighterRigCard({ result }) {
	const [expanded, setExpanded] = (0, import_react.useState)(false);
	const statusColor = result.skeletonValid ? "border-green-800 bg-green-950/20" : result.ok ? "border-yellow-800 bg-yellow-950/20" : "border-red-800 bg-red-950/20";
	const statusLabel = result.skeletonValid ? "✅ VALID" : result.ok ? "⚠️ ISSUES" : "❌ ERROR";
	const statusLabelColor = result.skeletonValid ? "text-green-400" : result.ok ? "text-yellow-400" : "text-red-400";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `border rounded-sm overflow-hidden ${statusColor}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				onClick: () => setExpanded((e) => !e),
				className: "w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors text-left",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: `font-mono text-xs font-bold shrink-0 ${statusLabelColor}`,
						children: statusLabel
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-xs text-white flex-1 truncate",
						children: result.fighterName
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "font-mono text-[10px] text-zinc-500 shrink-0",
						children: [
							result.boneCount,
							" bones · ",
							result.clipCount,
							" clips"
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-zinc-600 text-xs shrink-0",
						children: expanded ? "▲" : "▼"
					})
				]
			}),
			result.error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "px-3 py-1 bg-red-950/40 border-t border-red-900",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-[10px] text-red-300",
					children: result.error
				})
			}),
			result.flags.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "px-3 py-1 border-t border-zinc-800 flex flex-wrap gap-1",
				children: result.flags.map((flag, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "font-mono text-[9px] text-yellow-300 bg-yellow-950/40 border border-yellow-800 px-1.5 py-0.5 rounded",
					children: ["⚑ ", flag]
				}, i))
			}),
			expanded && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-t border-zinc-800 px-3 py-2 space-y-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[9px] font-mono text-zinc-500 tracking-widest mb-1.5",
							children: "SKELETON"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-1.5 mb-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, {
									ok: result.hasSkin,
									label: "SKIN"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, {
									ok: result.hasRootBone,
									label: "ROOT BONE"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, {
									ok: result.boneCount > 0,
									label: `${result.boneCount} BONES`
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, {
									ok: result.skeletonValid,
									label: "VALID RIG"
								})
							]
						}),
						result.armatureName && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "font-mono text-[10px] text-zinc-400",
							children: ["Armature: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-zinc-200",
								children: result.armatureName
							})]
						})
					] }),
					result.bones.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-[9px] font-mono text-zinc-500 tracking-widest mb-1",
						children: [
							"BONES (",
							result.bones.length,
							")"
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "max-h-28 overflow-y-auto bg-zinc-950/60 rounded px-2 py-1",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-wrap gap-1",
							children: result.bones.map((bone) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[9px] text-zinc-400 bg-zinc-800/60 px-1 rounded",
								children: bone.name
							}, bone.index))
						})
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-[9px] font-mono text-zinc-500 tracking-widest mb-1",
						children: [
							"ANIMATION CLIPS (",
							result.clipCount,
							")"
						]
					}), result.clips.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-mono text-[10px] text-red-400",
						children: "No animation clips found"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "max-h-32 overflow-y-auto bg-zinc-950/60 rounded px-2 py-1",
						children: result.clips.map((clip, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ClipRow, {
							name: clip.name,
							trackCount: clip.trackCount
						}, i))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-mono text-[9px] text-zinc-600 truncate",
						children: result.url
					})
				]
			})
		]
	});
}
function SummaryBar({ summary }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid grid-cols-3 gap-2 mb-4",
		children: [
			{
				label: "VALID RIGS",
				value: summary.valid,
				color: "text-green-400"
			},
			{
				label: "ISSUES",
				value: summary.invalid,
				color: "text-yellow-400"
			},
			{
				label: "FETCH ERRORS",
				value: summary.fetchErrors,
				color: "text-red-400"
			},
			{
				label: "NO SKIN",
				value: summary.noSkin,
				color: "text-orange-400"
			},
			{
				label: "NO CLIPS",
				value: summary.noAnimations,
				color: "text-purple-400"
			},
			{
				label: "TOTAL",
				value: summary.total,
				color: "text-zinc-300"
			}
		].map(({ label, value, color }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "bg-zinc-900 border border-zinc-800 rounded-sm p-2 text-center",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: `font-mono text-lg font-black ${color}`,
				children: value
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "font-mono text-[8px] text-zinc-600 tracking-widest",
				children: label
			})]
		}, label))
	});
}
function GLBRigInspector() {
	const [results, setResults] = (0, import_react.useState)([]);
	const [summary, setSummary] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const [filter, setFilter] = (0, import_react.useState)("all");
	const [exportData, setExportData] = (0, import_react.useState)(null);
	const fighters = (0, import_react.useMemo)(() => getAllBannonFighters(), []);
	const runInspection = (0, import_react.useCallback)(async () => {
		setLoading(true);
		setError(null);
		setResults([]);
		setSummary(null);
		setExportData(null);
		try {
			const payload = { fighters: fighters.map((f) => ({
				id: f.id,
				name: f.name,
				url: f.portraitUrl
			})) };
			const res = await fetch("/api/glb-rig-inspector", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload)
			});
			if (!res.ok) {
				const text = await res.text();
				throw new Error(`API error ${res.status}: ${text}`);
			}
			const data = await res.json();
			setResults(data.results ?? []);
			setSummary(data.summary ?? null);
			console.log("[GLBRigInspector] Inspection complete:", data.summary);
		} catch (err) {
			setError(String(err));
			console.error("[GLBRigInspector] Inspection failed:", err);
		} finally {
			setLoading(false);
		}
	}, [fighters]);
	const filteredResults = (0, import_react.useMemo)(() => {
		if (filter === "valid") return results.filter((r) => r.skeletonValid);
		if (filter === "issues") return results.filter((r) => r.ok && !r.skeletonValid);
		if (filter === "errors") return results.filter((r) => !r.ok);
		return results;
	}, [results, filter]);
	const handleExport = (0, import_react.useCallback)(() => {
		const report = {
			generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
			summary,
			results
		};
		const json = JSON.stringify(report, null, 2);
		setExportData(json);
		const blob = new Blob([json], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `glb-rig-report-${Date.now()}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}, [summary, results]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "bg-zinc-950 border border-zinc-800 rounded-sm overflow-hidden",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "font-mono text-xs font-black tracking-[0.3em] text-white",
				children: "🦴 GLB RIG INSPECTOR"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "font-mono text-[9px] text-zinc-500 mt-0.5",
				children: "Backend bone count · armature · clip list · skeleton validity"
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [results.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: handleExport,
					className: "font-mono text-[9px] text-zinc-400 border border-zinc-700 px-2 py-1 hover:border-zinc-500 hover:text-zinc-200 transition-colors",
					children: "↓ EXPORT JSON"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: runInspection,
					disabled: loading,
					className: `font-mono text-xs font-bold px-4 py-1.5 border transition-colors
              ${loading ? "border-zinc-700 text-zinc-600 cursor-not-allowed" : "border-yellow-600 text-yellow-400 hover:bg-yellow-950/40 hover:border-yellow-400"}`,
					children: loading ? "⟳ SCANNING..." : "▶ RUN INSPECTION"
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "p-4",
			children: [
				!loading && results.length === 0 && !error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-center py-8",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-zinc-600 font-mono text-xs tracking-widest mb-2",
							children: [fighters.length, " FIGHTERS IN ROSTER"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-zinc-700 font-mono text-[10px]",
							children: "Click RUN INSPECTION to scan all GLB rigs for bone count, armature, clips, and skeleton validity."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3 text-zinc-800 font-mono text-[9px]",
							children: "Flags models with missing bones or broken rigging before combat loads."
						})
					]
				}),
				loading && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-center py-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-yellow-400 font-mono text-xs animate-pulse tracking-widest",
						children: [
							"SCANNING ",
							fighters.length,
							" GLB FILES..."
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2 text-zinc-600 font-mono text-[10px]",
						children: "Fetching and parsing binary GLTF chunks server-side"
					})]
				}),
				error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-red-950/40 border border-red-800 rounded-sm p-3 mb-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-mono text-xs text-red-300 font-bold mb-1",
						children: "INSPECTION FAILED"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-mono text-[10px] text-red-400",
						children: error
					})]
				}),
				results.length > 0 && summary && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SummaryBar, { summary }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-1 mb-3",
						children: [
							"all",
							"valid",
							"issues",
							"errors"
						].map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setFilter(f),
							className: `font-mono text-[9px] px-2 py-1 border transition-colors tracking-widest
                    ${filter === f ? "border-zinc-500 text-zinc-200 bg-zinc-800" : "border-zinc-800 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400"}`,
							children: [
								f.toUpperCase(),
								" (",
								f === "all" ? results.length : f === "valid" ? summary.valid : f === "issues" ? summary.invalid : summary.fetchErrors,
								")"
							]
						}, f))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-1.5 max-h-[500px] overflow-y-auto pr-1",
						children: filteredResults.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-center py-4 font-mono text-[10px] text-zinc-600",
							children: "No fighters match this filter"
						}) : filteredResults.map((result) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FighterRigCard, { result }, result.fighterId))
					})
				] })
			]
		})]
	});
}
var TIER_CONFIG = {
	bronze: {
		label: "BRONZE",
		color: "#cd7f32",
		eloMin: 0,
		eloMax: 899,
		glow: "rgba(205,127,50,0.15)"
	},
	silver: {
		label: "SILVER",
		color: "#94a3b8",
		eloMin: 900,
		eloMax: 1099,
		glow: "rgba(148,163,184,0.15)"
	},
	gold: {
		label: "GOLD",
		color: "#facc15",
		eloMin: 1100,
		eloMax: 1299,
		glow: "rgba(250,204,21,0.15)"
	},
	platinum: {
		label: "PLATINUM",
		color: "#67e8f9",
		eloMin: 1300,
		eloMax: 1599,
		glow: "rgba(103,232,249,0.15)"
	},
	diamond: {
		label: "DIAMOND",
		color: "#a78bfa",
		eloMin: 1600,
		eloMax: 1999,
		glow: "rgba(167,139,250,0.15)"
	},
	legend: {
		label: "LEGEND",
		color: "#f97316",
		eloMin: 2e3,
		eloMax: 9999,
		glow: "rgba(249,115,22,0.15)"
	}
};
function estimateWaitTime(queueCount, tier) {
	if (queueCount === 0) return "2–5 min";
	if (queueCount === 1) return "< 30 sec";
	if (queueCount <= 3) return "< 1 min";
	return "< 2 min";
}
function MatchmakingQueueScreen({ onBack, onMatchFound }) {
	const { user } = useAuth();
	const supabase = createClient();
	const { pendingRewards, triggerUnlockCheck, dismissRewards } = useRankedCosmeticUnlocks(user?.id);
	const [selectedFighterId, setSelectedFighterId] = (0, import_react.useState)("");
	const [selectedTier, setSelectedTier] = (0, import_react.useState)("bronze");
	const [playerElo, setPlayerElo] = (0, import_react.useState)(1e3);
	const [inQueue, setInQueue] = (0, import_react.useState)(false);
	const [queueEntryId, setQueueEntryId] = (0, import_react.useState)(null);
	const [queueEntries, setQueueEntries] = (0, import_react.useState)([]);
	const [waitSeconds, setWaitSeconds] = (0, import_react.useState)(0);
	const [notifications, setNotifications] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [matchFound, setMatchFound] = (0, import_react.useState)(null);
	const waitTimerRef = (0, import_react.useRef)(null);
	const subscriptionRef = (0, import_react.useRef)(null);
	const playableFighters = BANNON_ROSTER.filter((f) => BANNON_GLB_PLAYABLE_MODELS.some((m) => m.id === f.id));
	(0, import_react.useEffect)(() => {
		if (!user?.id || !selectedFighterId) return;
		supabase.from("player_elo").select("elo_rating, tier").eq("user_id", user.id).eq("fighter_id", selectedFighterId).maybeSingle().then(({ data }) => {
			if (data) {
				setPlayerElo(data.elo_rating);
				setSelectedTier(data.tier);
			} else {
				setPlayerElo(1e3);
				setSelectedTier("bronze");
			}
		});
	}, [user?.id, selectedFighterId]);
	(0, import_react.useEffect)(() => {
		if (playableFighters.length > 0 && !selectedFighterId) setSelectedFighterId(playableFighters[0].id);
	}, [playableFighters.length]);
	const addNotification = (0, import_react.useCallback)((message, type = "info") => {
		const notif = {
			id: Math.random().toString(36).slice(2),
			message,
			type,
			timestamp: Date.now()
		};
		setNotifications((prev) => [notif, ...prev.slice(0, 4)]);
		setTimeout(() => {
			setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
		}, 5e3);
	}, []);
	(0, import_react.useEffect)(() => {
		const channel = supabase.channel("active_match_queue_realtime").on("postgres_changes", {
			event: "*",
			schema: "public",
			table: "active_match_queue"
		}, (payload) => {
			const row = payload.new;
			const oldRow = payload.old;
			if (payload.eventType === "INSERT") {
				const entry = {
					id: row.id,
					userId: row.user_id,
					fighterName: row.fighter_name,
					fighterId: row.fighter_id,
					eloRating: row.elo_rating,
					tier: row.tier,
					status: row.status,
					joinedAt: row.joined_at
				};
				setQueueEntries((prev) => {
					if (prev.some((e) => e.id === entry.id)) return prev;
					return [...prev, entry];
				});
				if (row.user_id !== user?.id) addNotification(`${row.fighter_name} joined the ${row.tier.toUpperCase()} queue`, "info");
			}
			if (payload.eventType === "UPDATE") {
				setQueueEntries((prev) => prev.map((e) => e.id === row.id ? {
					...e,
					status: row.status,
					matchedWith: row.matched_with,
					matchedFighterName: row.matched_fighter_name
				} : e));
				if (row.user_id === user?.id && row.status === "matched" && row.matched_fighter_name) {
					setMatchFound({
						id: row.id,
						userId: row.user_id,
						fighterName: row.fighter_name,
						fighterId: row.fighter_id,
						eloRating: row.elo_rating,
						tier: row.tier,
						status: "matched",
						joinedAt: row.joined_at,
						matchedFighterName: row.matched_fighter_name
					});
					addNotification(`MATCH FOUND! vs ${row.matched_fighter_name}`, "success");
					setInQueue(false);
					if (waitTimerRef.current) clearInterval(waitTimerRef.current);
				}
				if (row.status === "matched" && row.user_id !== user?.id && oldRow?.status === "waiting") addNotification(`Match started: ${row.fighter_name} vs ${row.matched_fighter_name ?? "opponent"}`, "info");
			}
			if (payload.eventType === "DELETE") setQueueEntries((prev) => prev.filter((e) => e.id !== oldRow?.id));
		}).subscribe();
		subscriptionRef.current = channel;
		return () => {
			supabase.removeChannel(channel);
		};
	}, [user?.id, addNotification]);
	(0, import_react.useEffect)(() => {
		supabase.from("active_match_queue").select("*").eq("status", "waiting").order("joined_at", { ascending: true }).then(({ data }) => {
			if (data) setQueueEntries(data.map((r) => ({
				id: r.id,
				userId: r.user_id,
				fighterName: r.fighter_name,
				fighterId: r.fighter_id,
				eloRating: r.elo_rating,
				tier: r.tier,
				status: r.status,
				joinedAt: r.joined_at
			})));
		});
	}, []);
	(0, import_react.useEffect)(() => {
		if (inQueue) {
			setWaitSeconds(0);
			waitTimerRef.current = setInterval(() => setWaitSeconds((s) => s + 1), 1e3);
		} else if (waitTimerRef.current) clearInterval(waitTimerRef.current);
		return () => {
			if (waitTimerRef.current) clearInterval(waitTimerRef.current);
		};
	}, [inQueue]);
	async function joinQueue() {
		if (!user?.id || !selectedFighterId || loading) return;
		setLoading(true);
		const fighter = playableFighters.find((f) => f.id === selectedFighterId);
		if (!fighter) {
			setLoading(false);
			return;
		}
		await supabase.from("active_match_queue").update({ status: "cancelled" }).eq("user_id", user.id).eq("status", "waiting");
		const { data, error } = await supabase.from("active_match_queue").insert({
			user_id: user.id,
			fighter_id: fighter.id,
			fighter_name: fighter.name,
			elo_rating: playerElo,
			tier: selectedTier,
			status: "waiting"
		}).select("id").single();
		if (!error && data) {
			setQueueEntryId(data.id);
			setInQueue(true);
			addNotification(`Joined ${selectedTier.toUpperCase()} queue as ${fighter.name}`, "success");
		} else addNotification("Failed to join queue. Try again.", "warning");
		setLoading(false);
	}
	async function leaveQueue() {
		if (!queueEntryId || loading) return;
		setLoading(true);
		await supabase.from("active_match_queue").update({ status: "cancelled" }).eq("id", queueEntryId);
		setInQueue(false);
		setQueueEntryId(null);
		setWaitSeconds(0);
		addNotification("Left the queue", "info");
		setLoading(false);
	}
	function formatWait(secs) {
		const m = Math.floor(secs / 60);
		const s = secs % 60;
		return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
	}
	const tierEntries = queueEntries.filter((e) => e.tier === selectedTier && e.status === "waiting");
	const tierConfig = TIER_CONFIG[selectedTier];
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 bg-black text-white flex items-center justify-center font-mono",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "text-center space-y-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[8px] tracking-[0.45em] text-zinc-600",
					children: "RANKED MATCHMAKING"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-sm font-black text-zinc-400",
					children: "SIGN IN TO JOIN THE QUEUE"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: onBack,
					className: "text-[8px] tracking-widest text-zinc-600 hover:text-zinc-400 border border-zinc-800 px-4 py-2",
					children: "← BACK"
				})
			]
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 bg-black text-white flex flex-col font-mono overflow-hidden",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 pointer-events-none",
				style: { background: `radial-gradient(ellipse at 50% 0%, ${tierConfig.color}10 0%, transparent 60%)` }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 opacity-[0.025] pointer-events-none",
				style: { backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.5) 3px, rgba(255,255,255,0.5) 4px)" }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute top-4 right-4 z-50 space-y-2 pointer-events-none",
				style: { maxWidth: "240px" },
				children: notifications.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "border px-3 py-2 text-[8px] tracking-wide font-black animate-pulse",
					style: {
						borderColor: n.type === "success" ? "#22c55e" : n.type === "warning" ? "#f97316" : "#3f3f46",
						color: n.type === "success" ? "#22c55e" : n.type === "warning" ? "#f97316" : "#94a3b8",
						background: "rgba(0,0,0,0.9)"
					},
					children: n.message
				}, n.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10 flex-shrink-0 border-b border-zinc-900 px-5 pt-5 pb-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: onBack,
					className: "text-[8px] tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors mb-3",
					children: "← BACK"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[8px] tracking-[0.5em] text-zinc-600",
						children: "RANKED MATCHMAKING"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-1 text-xl font-black tracking-widest",
						children: "QUEUE POOL"
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-right",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[7px] tracking-widest text-zinc-600",
								children: "YOUR ELO"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xl font-black mt-0.5",
								style: { color: tierConfig.color },
								children: playerElo
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[8px] mt-0.5",
								style: { color: tierConfig.color },
								children: selectedTier.toUpperCase()
							})
						]
					})]
				})]
			}),
			matchFound && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-20 flex-shrink-0 border-b-2 px-5 py-4",
				style: {
					borderColor: "#22c55e",
					background: "rgba(34,197,94,0.08)"
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[8px] tracking-[0.4em] text-green-400 mb-1",
						children: "MATCH FOUND"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-lg font-black text-white",
						children: [
							matchFound.fighterName.toUpperCase(),
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-zinc-600",
								children: "VS"
							}),
							" ",
							(matchFound.matchedFighterName ?? "OPPONENT").toUpperCase()
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-3 mt-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => {
								if (user?.id) triggerUnlockCheck({
									userId: user.id,
									fighterId: selectedFighterId,
									fighterName: BANNON_ROSTER.find((f) => f.id === selectedFighterId)?.name ?? selectedFighterId,
									opponentTier: matchFound?.tier ?? selectedTier,
									winStreak: 1,
									totalWins: 1,
									isRankedWin: true
								});
								onMatchFound?.(matchFound.fighterId, matchFound.matchedFighterName ?? "");
								setMatchFound(null);
							},
							className: "flex-1 py-2 text-[9px] font-black tracking-widest border border-green-500 text-green-400 hover:bg-green-500 hover:text-black transition-all",
							children: "ENTER MATCH"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setMatchFound(null),
							className: "px-4 py-2 text-[9px] font-black tracking-widest border border-zinc-700 text-zinc-500 hover:text-zinc-300 transition-all",
							children: "DECLINE"
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10 flex-1 overflow-y-auto px-5 py-4 space-y-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[8px] tracking-[0.3em] text-zinc-600 mb-2",
						children: "SELECT FIGHTER"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-3 gap-1.5",
						children: playableFighters.slice(0, 6).map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => !inQueue && setSelectedFighterId(f.id),
							disabled: inQueue,
							className: "border py-2 px-2 text-left transition-all",
							style: {
								borderColor: selectedFighterId === f.id ? tierConfig.color : "#27272a",
								background: selectedFighterId === f.id ? `${tierConfig.color}12` : "transparent",
								opacity: inQueue && selectedFighterId !== f.id ? .4 : 1
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[8px] font-black truncate",
								style: { color: selectedFighterId === f.id ? "#fff" : "#71717a" },
								children: f.name.toUpperCase()
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[6px] text-zinc-700 mt-0.5 truncate",
								children: f.factionAlignment.toUpperCase()
							})]
						}, f.id))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[8px] tracking-[0.3em] text-zinc-600 mb-2",
						children: "BRACKET TIER"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-3 gap-1.5",
						children: Object.keys(TIER_CONFIG).map((tier) => {
							const cfg = TIER_CONFIG[tier];
							const count = queueEntries.filter((e) => e.tier === tier && e.status === "waiting").length;
							const isMyTier = tier === selectedTier;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => !inQueue && setSelectedTier(tier),
								disabled: inQueue,
								className: "border py-2 px-2 text-left transition-all relative",
								style: {
									borderColor: isMyTier ? cfg.color : "#27272a",
									background: isMyTier ? cfg.glow : "transparent",
									opacity: inQueue && !isMyTier ? .4 : 1
								},
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[8px] font-black",
										style: { color: isMyTier ? cfg.color : "#52525b" },
										children: cfg.label
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[6px] text-zinc-700 mt-0.5",
										children: [
											cfg.eloMin,
											"–",
											cfg.eloMax === 9999 ? "∞" : cfg.eloMax,
											" ELO"
										]
									}),
									count > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "absolute top-1 right-1 text-[6px] font-black px-1",
										style: {
											color: cfg.color,
											background: `${cfg.color}20`
										},
										children: count
									})
								]
							}, tier);
						})
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "border p-4 space-y-3",
						style: {
							borderColor: inQueue ? tierConfig.color : "#27272a",
							background: inQueue ? tierConfig.glow : "transparent"
						},
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[8px] tracking-[0.3em] text-zinc-600",
									children: "QUEUE STATUS"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-sm font-black mt-0.5",
									style: { color: inQueue ? tierConfig.color : "#52525b" },
									children: inQueue ? "SEARCHING..." : "STANDBY"
								})] }), inQueue && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-right",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[7px] text-zinc-600",
										children: "WAIT TIME"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-lg font-black",
										style: { color: tierConfig.color },
										children: formatWait(waitSeconds)
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between text-[8px]",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-zinc-600",
										children: "IN POOL: "
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-black",
										style: { color: tierConfig.color },
										children: tierEntries.length
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-zinc-700",
										children: " fighters"
									})
								] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-zinc-600",
									children: "EST. WAIT: "
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-black text-zinc-400",
									children: estimateWaitTime(tierEntries.length, selectedTier)
								})] })]
							}),
							inQueue ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: leaveQueue,
								disabled: loading,
								className: "w-full py-3 text-[9px] font-black tracking-widest border border-red-900 text-red-500 hover:bg-red-900/20 transition-all",
								children: loading ? "LEAVING..." : "LEAVE QUEUE"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: joinQueue,
								disabled: loading || !selectedFighterId,
								className: "w-full py-3 text-[9px] font-black tracking-widest border transition-all",
								style: {
									borderColor: selectedFighterId ? tierConfig.color : "#27272a",
									color: selectedFighterId ? tierConfig.color : "#3f3f46",
									background: selectedFighterId ? `${tierConfig.color}10` : "transparent"
								},
								children: loading ? "JOINING..." : `JOIN ${selectedTier.toUpperCase()} QUEUE`
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between mb-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-[8px] tracking-[0.3em] text-zinc-600",
							children: ["LIVE POOL — ", selectedTier.toUpperCase()]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-[7px] text-zinc-700",
							children: [tierEntries.length, " WAITING"]
						})]
					}), tierEntries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "border border-zinc-900 py-6 text-center",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[8px] text-zinc-700 tracking-widest",
							children: "NO FIGHTERS IN THIS TIER"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[7px] text-zinc-800 mt-1",
							children: "BE THE FIRST TO JOIN"
						})]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-1.5",
						children: tierEntries.map((entry) => {
							const isMe = entry.userId === user?.id;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between border px-3 py-2",
								style: {
									borderColor: isMe ? tierConfig.color : "#27272a",
									background: isMe ? `${tierConfig.color}08` : "transparent"
								},
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-[9px] font-black",
									style: { color: isMe ? tierConfig.color : "#a1a1aa" },
									children: [entry.fighterName.toUpperCase(), isMe && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "ml-2 text-[6px] text-zinc-600",
										children: "YOU"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-[7px] text-zinc-700 mt-0.5",
									children: ["ELO ", entry.eloRating]
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-right",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[7px] text-zinc-600",
										children: [Math.floor((Date.now() - new Date(entry.joinedAt).getTime()) / 1e3), "s"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "w-1.5 h-1.5 rounded-full ml-auto mt-1 animate-pulse",
										style: { background: tierConfig.color }
									})]
								})]
							}, entry.id);
						})
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "border border-zinc-900 p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[7px] tracking-[0.3em] text-zinc-700 mb-2",
								children: "MATCHMAKING RANGE"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-[8px] text-zinc-500",
								children: [
									"Matches players within ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-zinc-300 font-black",
										children: "±150 ELO"
									}),
									" of your rating. After ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-zinc-300 font-black",
										children: "2 minutes"
									}),
									", range expands to ±300."
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[7px] text-zinc-700",
									children: "YOUR RANGE:"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-[8px] font-black",
									style: { color: tierConfig.color },
									children: [
										Math.max(100, playerElo - 150),
										" – ",
										playerElo + 150
									]
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "border border-zinc-900 p-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[7px] tracking-[0.3em] text-zinc-700 mb-2",
							children: "PRE-QUEUE RIG VALIDATION"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GLBRigInspector, {})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CosmeticUnlockBanner, {
				rewards: pendingRewards,
				onDismiss: dismissRewards
			})
		]
	});
}
//#endregion
export { MatchmakingQueueScreen as default };
