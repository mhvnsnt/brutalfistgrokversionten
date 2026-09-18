import { a as __toESM } from "../_runtime.mjs";
import { c as require_jsx_runtime, l as require_react } from "../_libs/@react-three/drei+[...].mjs";
import { t as createClient } from "./client-CENlhkXr.mjs";
import { n as TIER_LABEL, t as TIER_COLOR } from "./statsService-7dhcoGcP.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/LeaderboardScreen-C2vbp3GZ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var RANK_TIERS = [
	{
		tier: "legend",
		label: "LEGEND",
		min: 5e3,
		color: "#facc15"
	},
	{
		tier: "elite",
		label: "ELITE",
		min: 2e3,
		color: "#ef4444"
	},
	{
		tier: "challenger",
		label: "CHALLENGER",
		min: 500,
		color: "#f59e0b"
	},
	{
		tier: "rookie",
		label: "ROOKIE",
		min: 0,
		color: "#94a3b8"
	}
];
function getMedalColor(rank) {
	if (rank === 1) return "#facc15";
	if (rank === 2) return "#94a3b8";
	if (rank === 3) return "#cd7f32";
	return "#3f3f46";
}
function LeaderboardScreen({ onBack }) {
	const [tab, setTab] = (0, import_react.useState)("players");
	const [playerRows, setPlayerRows] = (0, import_react.useState)([]);
	const [fighterRows, setFighterRows] = (0, import_react.useState)([]);
	const [seasonRows, setSeasonRows] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [error, setError] = (0, import_react.useState)(null);
	const [liveConnected, setLiveConnected] = (0, import_react.useState)(false);
	const [lastUpdated, setLastUpdated] = (0, import_react.useState)(null);
	const [flashRow, setFlashRow] = (0, import_react.useState)(null);
	const channelRef = (0, import_react.useRef)(null);
	async function loadData(silent = false) {
		if (!silent) setLoading(true);
		setError(null);
		const supabase = createClient();
		try {
			const { data: fsData, error: fsErr } = await supabase.from("fighter_stats").select("user_id, total_wins, total_losses, total_draws, total_matches").order("total_wins", { ascending: false }).limit(50);
			if (fsErr) throw fsErr;
			const userMap = {};
			for (const row of fsData ?? []) {
				if (!userMap[row.user_id]) userMap[row.user_id] = {
					wins: 0,
					losses: 0,
					draws: 0,
					matches: 0
				};
				userMap[row.user_id].wins += row.total_wins ?? 0;
				userMap[row.user_id].losses += row.total_losses ?? 0;
				userMap[row.user_id].draws += row.total_draws ?? 0;
				userMap[row.user_id].matches += row.total_matches ?? 0;
			}
			const playerList = Object.entries(userMap).map(([userId, s]) => ({
				userId,
				displayName: `PLAYER_${userId.slice(0, 6).toUpperCase()}`,
				wins: s.wins,
				losses: s.losses,
				draws: s.draws,
				totalMatches: s.matches,
				winRate: s.matches > 0 ? s.wins / s.matches * 100 : 0
			})).sort((a, b) => b.winRate - a.winRate).slice(0, 10);
			setPlayerRows(playerList);
			const { data: fData, error: fErr } = await supabase.from("fighter_stats").select("fighter_id, fighter_name, total_wins, total_matches").order("total_wins", { ascending: false }).limit(100);
			if (fErr) throw fErr;
			const fighterMap = {};
			for (const row of fData ?? []) {
				if (!fighterMap[row.fighter_id]) fighterMap[row.fighter_id] = {
					name: row.fighter_name,
					wins: 0,
					matches: 0
				};
				fighterMap[row.fighter_id].wins += row.total_wins ?? 0;
				fighterMap[row.fighter_id].matches += row.total_matches ?? 0;
			}
			const fighterList = Object.entries(fighterMap).map(([fighterId, s]) => ({
				fighterId,
				fighterName: s.name,
				totalWins: s.wins,
				totalMatches: s.matches
			})).sort((a, b) => b.totalWins - a.totalWins).slice(0, 10);
			setFighterRows(fighterList);
			const { data: rankData, error: rankErr } = await supabase.from("player_ranks").select("user_id, rank_points, rank_tier, recorded_at").order("rank_points", { ascending: false }).limit(100);
			if (rankErr) throw rankErr;
			const rankMap = {};
			for (const row of rankData ?? []) if (!rankMap[row.user_id] || row.rank_points > rankMap[row.user_id].points) rankMap[row.user_id] = {
				points: row.rank_points,
				tier: row.rank_tier
			};
			const seasonList = Object.entries(rankMap).map(([userId, r]) => ({
				userId,
				displayName: `PLAYER_${userId.slice(0, 6).toUpperCase()}`,
				rankPoints: r.points,
				rankTier: r.tier
			})).sort((a, b) => b.rankPoints - a.rankPoints).slice(0, 10);
			setSeasonRows(seasonList);
			setLastUpdated(/* @__PURE__ */ new Date());
		} catch (e) {
			setError(e?.message ?? "Failed to load leaderboard");
		} finally {
			setLoading(false);
		}
	}
	(0, import_react.useEffect)(() => {
		loadData();
		const supabase = createClient();
		const channel = supabase.channel("leaderboard-live").on("postgres_changes", {
			event: "*",
			schema: "public",
			table: "fighter_stats"
		}, (payload) => {
			const changedUserId = payload.new?.user_id ?? payload.old?.user_id;
			if (changedUserId) {
				setFlashRow(changedUserId);
				setTimeout(() => setFlashRow(null), 1200);
			}
			loadData(true);
		}).on("postgres_changes", {
			event: "*",
			schema: "public",
			table: "player_ranks"
		}, (payload) => {
			const changedUserId = payload.new?.user_id ?? payload.old?.user_id;
			if (changedUserId) {
				setFlashRow(changedUserId);
				setTimeout(() => setFlashRow(null), 1200);
			}
			loadData(true);
		}).subscribe((status) => {
			setLiveConnected(status === "SUBSCRIBED");
		});
		channelRef.current = channel;
		return () => {
			supabase.removeChannel(channel);
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 bg-[#0a0c12] text-white font-mono overflow-y-auto",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-2xl mx-auto px-4 py-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[9px] tracking-[0.5em] text-zinc-500 mb-1",
							children: "GLOBAL"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-3xl font-black tracking-widest",
								children: "LEADERBOARD"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "w-2 h-2 rounded-full",
									style: {
										background: liveConnected ? "#22c55e" : "#52525b",
										boxShadow: liveConnected ? "0 0 6px #22c55e" : "none",
										animation: liveConnected ? "pulse 2s infinite" : "none"
									}
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[8px] tracking-widest",
									style: { color: liveConnected ? "#22c55e" : "#52525b" },
									children: liveConnected ? "LIVE" : "OFFLINE"
								})]
							})]
						}),
						lastUpdated && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-[7px] text-zinc-700 mt-1",
							children: ["UPDATED ", lastUpdated.toLocaleTimeString([], {
								hour: "2-digit",
								minute: "2-digit",
								second: "2-digit"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mt-1 h-px bg-zinc-800" })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex gap-1 mb-6",
					children: [
						{
							key: "players",
							label: "TOP PLAYERS"
						},
						{
							key: "fighters",
							label: "TOP FIGHTERS"
						},
						{
							key: "season",
							label: "SEASON RANK"
						}
					].map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setTab(t.key),
						className: `flex-1 py-2 text-[9px] tracking-widest border transition-all ${tab === t.key ? "border-yellow-400 text-yellow-400 bg-yellow-400/10" : "border-zinc-700 text-zinc-500 hover:border-zinc-500"}`,
						children: t.label
					}, t.key))
				}),
				loading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-col items-center justify-center py-20 gap-3",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-yellow-400 text-xs tracking-widest animate-pulse",
						children: "LOADING STATS..."
					})
				}),
				error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "border border-red-800 bg-red-900/20 px-4 py-3 text-[9px] text-red-400 mb-4",
					children: error
				}),
				!loading && !error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					tab === "players" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[8px] tracking-[0.4em] text-zinc-500 mb-3",
						children: "TOP 10 — WIN RATE"
					}), playerRows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-center py-12 text-zinc-600 text-xs",
						children: "NO PLAYER DATA YET"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-1",
						children: playerRows.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3 border px-3 py-2 transition-all duration-300",
							style: {
								borderColor: flashRow === row.userId ? "#facc15" : "#27272a",
								background: flashRow === row.userId ? "rgba(250,204,21,0.06)" : "transparent"
							},
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "w-6 h-6 flex items-center justify-center text-[10px] font-black border",
									style: {
										borderColor: getMedalColor(i + 1),
										color: getMedalColor(i + 1)
									},
									children: i + 1
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex-1 min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-xs font-black tracking-widest truncate",
										children: row.displayName
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[7px] text-zinc-500",
										children: [
											row.wins,
											"W / ",
											row.losses,
											"L / ",
											row.draws,
											"D · ",
											row.totalMatches,
											" MATCHES"
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-right",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-sm font-black",
										style: { color: row.winRate >= 60 ? "#22c55e" : row.winRate >= 40 ? "#facc15" : "#ef4444" },
										children: [row.winRate.toFixed(1), "%"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[7px] text-zinc-600",
										children: "WIN RATE"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "w-16 h-1.5 bg-zinc-800 rounded overflow-hidden",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "h-full rounded",
										style: {
											width: `${row.winRate}%`,
											background: row.winRate >= 60 ? "#22c55e" : row.winRate >= 40 ? "#facc15" : "#ef4444"
										}
									})
								})
							]
						}, row.userId))
					})] }),
					tab === "fighters" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[8px] tracking-[0.4em] text-zinc-500 mb-3",
						children: "TOP 10 — TOTAL WINS"
					}), fighterRows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-center py-12 text-zinc-600 text-xs",
						children: "NO FIGHTER DATA YET"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-1",
						children: fighterRows.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3 border border-zinc-800 px-3 py-2 hover:border-zinc-600 transition-all",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "w-6 h-6 flex items-center justify-center text-[10px] font-black border",
									style: {
										borderColor: getMedalColor(i + 1),
										color: getMedalColor(i + 1)
									},
									children: i + 1
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex-1 min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-xs font-black tracking-widest truncate",
										children: row.fighterName.toUpperCase()
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[7px] text-zinc-500",
										children: [row.totalMatches, " TOTAL MATCHES"]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-right",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-sm font-black text-yellow-400",
										children: row.totalWins
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[7px] text-zinc-600",
										children: "WINS"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "w-16 h-1.5 bg-zinc-800 rounded overflow-hidden",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "h-full bg-yellow-400 rounded",
										style: { width: `${Math.min(100, row.totalWins / Math.max(1, fighterRows[0].totalWins) * 100)}%` }
									})
								})
							]
						}, row.fighterId))
					})] }),
					tab === "season" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[8px] tracking-[0.4em] text-zinc-500 mb-3",
							children: "SEASON RANK STANDINGS"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid grid-cols-4 gap-1 mb-4",
							children: RANK_TIERS.map((tier) => {
								const count = seasonRows.filter((r) => r.rankTier === tier.tier).length;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "border border-zinc-800 px-2 py-2 text-center",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[8px] font-black tracking-widest",
											style: { color: tier.color },
											children: tier.label
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-lg font-black mt-1",
											style: { color: tier.color },
											children: count
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-[7px] text-zinc-600",
											children: [tier.min, "+ PTS"]
										})
									]
								}, tier.tier);
							})
						}),
						seasonRows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-center py-12 text-zinc-600 text-xs",
							children: "NO RANK DATA YET"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "space-y-1",
							children: seasonRows.map((row, i) => {
								const tierColor = TIER_COLOR[row.rankTier] ?? "#94a3b8";
								const tierLabel = TIER_LABEL[row.rankTier] ?? row.rankTier.toUpperCase();
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-3 border px-3 py-2 transition-all duration-300",
									style: {
										borderColor: flashRow === row.userId ? "#facc15" : "#27272a",
										background: flashRow === row.userId ? "rgba(250,204,21,0.06)" : "transparent"
									},
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "w-6 h-6 flex items-center justify-center text-[10px] font-black border",
											style: {
												borderColor: getMedalColor(i + 1),
												color: getMedalColor(i + 1)
											},
											children: i + 1
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex-1 min-w-0",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-xs font-black tracking-widest truncate",
												children: row.displayName
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[7px]",
												style: { color: tierColor },
												children: tierLabel
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-right",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-sm font-black",
												style: { color: tierColor },
												children: row.rankPoints.toLocaleString()
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[7px] text-zinc-600",
												children: "RANK PTS"
											})]
										})
									]
								}, row.userId);
							})
						})
					] })
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-8",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onBack,
						className: "w-full border border-zinc-700 py-4 text-sm font-black tracking-widest hover:border-zinc-500 transition-all",
						children: "← BACK"
					})
				})
			]
		})
	});
}
//#endregion
export { LeaderboardScreen as default };
