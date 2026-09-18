import { a as __toESM } from "../_runtime.mjs";
import { c as require_jsx_runtime, l as require_react } from "../_libs/@react-three/drei+[...].mjs";
import { l as useAuth } from "./routes-DbIfrPB2.mjs";
import { a as statsService, n as TIER_LABEL, t as TIER_COLOR } from "./statsService-7dhcoGcP.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/TournamentStatsScreen-BnZNwY8c.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function generateRoundData(match) {
	const seed = match.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
	const rounds = Math.max(1, seed % 3 + 1);
	const result = [];
	let playerDmgTotal = 0;
	let opponentDmgTotal = 0;
	for (let i = 0; i < rounds; i++) {
		const roundSeed = seed + i * 137;
		const playerDmg = 40 + roundSeed % 55;
		const opponentDmg = 40 + roundSeed * 7 % 55;
		const roundWinner = playerDmg > opponentDmg ? "player" : playerDmg < opponentDmg ? "opponent" : "draw";
		playerDmgTotal += playerDmg;
		opponentDmgTotal += opponentDmg;
		result.push({
			round: i + 1,
			playerDmg,
			opponentDmg,
			winner: roundWinner
		});
	}
	return {
		rounds: result,
		playerDmgTotal,
		opponentDmgTotal
	};
}
function MatchDetailModal({ match, onClose, onReplay }) {
	const { rounds, playerDmgTotal, opponentDmgTotal } = generateRoundData(match);
	const outcomeColor = match.outcome === "win" ? "#4ade80" : match.outcome === "draw" ? "#94a3b8" : "#f87171";
	const outcomeLabel = match.outcome === "win" ? "VICTORY" : match.outcome === "draw" ? "DRAW" : "DEFEAT";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 flex items-center justify-center",
		style: { background: "rgba(0,0,0,0.88)" },
		onClick: onClose,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative w-[min(92vw,420px)] bg-[#0a0a0a] border border-zinc-800 font-mono overflow-hidden",
			onClick: (e) => e.stopPropagation(),
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-0.5 w-full",
					style: { background: outcomeColor }
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "px-5 pt-4 pb-3 border-b border-zinc-800/60 flex items-start justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[7px] tracking-[0.5em] text-zinc-600",
							children: "MATCH DETAIL"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-lg font-black tracking-widest text-white mt-0.5",
							children: ["vs ", match.opponentFighterName.toUpperCase()]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[8px] tracking-widest mt-1",
							style: { color: outcomeColor },
							children: outcomeLabel
						})
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onClose,
						className: "text-zinc-700 hover:text-zinc-300 transition-colors text-lg leading-none mt-1",
						"aria-label": "Close",
						children: "✕"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "px-5 pt-4 pb-3 border-b border-zinc-800/60",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[8px] tracking-[0.4em] text-zinc-600 mb-3",
						children: "ROUND BREAKDOWN"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-2",
						children: rounds.map((r) => {
							const playerPct = Math.round(r.playerDmg / (r.playerDmg + r.opponentDmg) * 100);
							const opponentPct = 100 - playerPct;
							const rColor = r.winner === "player" ? "#4ade80" : r.winner === "draw" ? "#94a3b8" : "#f87171";
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-zinc-800/60 p-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between mb-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-[8px] font-black text-zinc-500",
											children: ["ROUND ", r.round]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[8px] font-black tracking-widest",
											style: { color: rColor },
											children: r.winner === "player" ? "YOU WIN" : r.winner === "draw" ? "DRAW" : "OPPONENT WINS"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex h-1.5 overflow-hidden bg-zinc-900 mb-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "h-full transition-all duration-500",
											style: {
												width: `${playerPct}%`,
												background: "#4ade80"
											}
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "h-full transition-all duration-500",
											style: {
												width: `${opponentPct}%`,
												background: "#f87171"
											}
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-[8px]",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-green-400 font-black",
												children: r.playerDmg
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-zinc-700 ml-1",
												children: "DMG DEALT"
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-[8px]",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-zinc-700 mr-1",
												children: "OPPONENT"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-red-400 font-black",
												children: r.opponentDmg
											})]
										})]
									})
								]
							}, r.round);
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "px-5 pt-4 pb-3 border-b border-zinc-800/60",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[8px] tracking-[0.4em] text-zinc-600 mb-3",
							children: "DAMAGE STATS"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-2 gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-zinc-800 p-3 text-center",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-2xl font-black text-green-400",
									children: playerDmgTotal
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[7px] text-zinc-600 mt-1",
									children: "TOTAL DEALT"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-zinc-800 p-3 text-center",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-2xl font-black text-red-400",
									children: opponentDmgTotal
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[7px] text-zinc-600 mt-1",
									children: "TOTAL TAKEN"
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[7px] text-zinc-600 mb-1.5",
									children: "DAMAGE EFFICIENCY"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex h-1.5 overflow-hidden bg-zinc-900",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "h-full",
										style: {
											width: `${Math.round(playerDmgTotal / (playerDmgTotal + opponentDmgTotal) * 100)}%`,
											background: outcomeColor
										}
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-between mt-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[7px] text-zinc-600",
										children: "YOU"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[7px] text-zinc-600",
										children: match.opponentFighterName.toUpperCase()
									})]
								})
							]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "px-5 pt-3 pb-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between mb-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-[7px] text-zinc-700",
							children: [
								"ROUND ",
								match.roundNumber,
								" · ",
								new Date(match.playedAt).toLocaleDateString("en-US", {
									month: "short",
									day: "numeric",
									year: "numeric"
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[7px] text-zinc-700",
							children: new Date(match.playedAt).toLocaleTimeString("en-US", {
								hour: "2-digit",
								minute: "2-digit"
							})
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2",
						children: [onReplay && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: onReplay,
							className: "flex-1 py-3 text-[9px] font-black tracking-widest border border-yellow-400/60 text-yellow-400 hover:bg-yellow-400 hover:text-black transition-all",
							children: "▶ REPLAY"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: onClose,
							className: "flex-1 py-3 text-[9px] font-black tracking-widest border border-zinc-700 text-zinc-500 hover:border-zinc-400 hover:text-zinc-200 transition-all",
							children: "CLOSE"
						})]
					})]
				})
			]
		})
	});
}
function WinRateBar({ wins, total }) {
	const pct = total > 0 ? Math.round(wins / total * 100) : 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex-1 h-1.5 bg-zinc-800 relative overflow-hidden",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute left-0 top-0 h-full transition-all duration-700",
				style: {
					width: `${pct}%`,
					background: pct >= 60 ? "#4ade80" : pct >= 40 ? "#facc15" : "#f87171"
				}
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "text-[9px] font-black w-8 text-right",
			style: { color: pct >= 60 ? "#4ade80" : pct >= 40 ? "#facc15" : "#f87171" },
			children: [pct, "%"]
		})]
	});
}
function RankBadge({ tier, points }) {
	const color = TIER_COLOR[tier] ?? "#94a3b8";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "inline-flex items-center gap-2 border px-3 py-1.5",
		style: {
			borderColor: color,
			background: `${color}15`
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "w-2 h-2 rounded-full",
				style: { background: color }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-[10px] font-black tracking-widest",
				style: { color },
				children: TIER_LABEL[tier] ?? tier.toUpperCase()
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "text-[9px] text-zinc-500",
				children: [points, " PTS"]
			})
		]
	});
}
function TournamentStatsScreen({ onBack }) {
	const { user } = useAuth();
	const [tab, setTab] = (0, import_react.useState)("overview");
	const [sessions, setSessions] = (0, import_react.useState)([]);
	const [matches, setMatches] = (0, import_react.useState)([]);
	const [fighterStats, setFighterStats] = (0, import_react.useState)([]);
	const [rankHistory, setRankHistory] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [error, setError] = (0, import_react.useState)(null);
	const [selectedMatch, setSelectedMatch] = (0, import_react.useState)(null);
	const loadData = (0, import_react.useCallback)(async () => {
		if (!user?.id) return;
		setLoading(true);
		setError(null);
		try {
			const [s, m, f, r] = await Promise.all([
				statsService.getUserSessions(user.id),
				statsService.getUserMatchHistory(user.id, 100),
				statsService.getFighterStats(user.id),
				statsService.getRankHistory(user.id)
			]);
			setSessions(s);
			setMatches(m);
			setFighterStats(f);
			setRankHistory(r);
		} catch (e) {
			setError(e?.message ?? "Failed to load stats");
		} finally {
			setLoading(false);
		}
	}, [user?.id]);
	(0, import_react.useEffect)(() => {
		loadData();
	}, [loadData]);
	const totalWins = sessions.reduce((a, s) => a + s.wins, 0);
	const totalLosses = sessions.reduce((a, s) => a + s.losses, 0);
	const totalDraws = sessions.reduce((a, s) => a + s.draws, 0);
	const totalMatches = totalWins + totalLosses + totalDraws;
	const totalTournaments = sessions.length;
	const championships = sessions.filter((s) => s.isChampion).length;
	const currentRank = rankHistory.length > 0 ? rankHistory[rankHistory.length - 1] : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 bg-black text-white font-mono overflow-hidden flex flex-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 pointer-events-none",
				style: { background: "radial-gradient(ellipse at 50% 0%, #1c1c2e 0%, #000 70%)" }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 opacity-[0.03] pointer-events-none",
				style: { backgroundImage: `repeating-linear-gradient(90deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 1px, transparent 1px, transparent 80px),
            repeating-linear-gradient(0deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 1px, transparent 1px, transparent 80px)` }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10 flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-800/60 shrink-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[8px] tracking-[0.5em] text-zinc-600",
					children: "BRUTAL FIST"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-xl font-black tracking-widest text-white mt-0.5",
					children: "TOURNAMENT STATS"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [currentRank && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RankBadge, {
						tier: currentRank.rankTier,
						points: currentRank.rankPoints
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onBack,
						className: "text-[9px] tracking-widest text-zinc-600 hover:text-zinc-300 transition-colors border border-zinc-800 px-3 py-1.5",
						children: "← BACK"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "relative z-10 flex border-b border-zinc-800/60 shrink-0",
				children: [
					{
						id: "overview",
						label: "OVERVIEW"
					},
					{
						id: "fighters",
						label: "FIGHTERS"
					},
					{
						id: "history",
						label: "HISTORY"
					},
					{
						id: "rank",
						label: "RANK"
					}
				].map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => setTab(t.id),
					className: "flex-1 py-2.5 text-[9px] tracking-widest font-black transition-all",
					style: {
						color: tab === t.id ? "#facc15" : "#52525b",
						borderBottom: tab === t.id ? "2px solid #facc15" : "2px solid transparent"
					},
					children: t.label
				}, t.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "relative z-10 flex-1 overflow-y-auto px-5 py-4",
				children: loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex items-center justify-center h-40",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[9px] tracking-widest text-zinc-600 animate-pulse",
						children: "LOADING STATS..."
					})
				}) : error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex items-center justify-center h-40",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[9px] tracking-widest text-red-500",
						children: error
					})
				}) : !user ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-col items-center justify-center h-40 gap-3",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[9px] tracking-widest text-zinc-500",
						children: "SIGN IN TO TRACK YOUR STATS"
					})
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					tab === "overview" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-zinc-800 p-4",
								style: { background: "linear-gradient(135deg, #0a0a0a 0%, #111 100%)" },
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[8px] tracking-[0.4em] text-zinc-600 mb-4",
										children: "CUMULATIVE RECORD"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "grid grid-cols-4 gap-3 text-center",
										children: [
											{
												val: totalWins,
												label: "WINS",
												color: "#4ade80"
											},
											{
												val: totalLosses,
												label: "LOSSES",
												color: "#f87171"
											},
											{
												val: totalDraws,
												label: "DRAWS",
												color: "#94a3b8"
											},
											{
												val: totalMatches,
												label: "MATCHES",
												color: "#facc15"
											}
										].map(({ val, label, color }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-3xl font-black",
											style: { color },
											children: val
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[7px] text-zinc-600 mt-1",
											children: label
										})] }, label))
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[8px] text-zinc-600 mb-1.5",
											children: "WIN RATE"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WinRateBar, {
											wins: totalWins,
											total: totalMatches
										})]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-zinc-800 p-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[8px] tracking-[0.4em] text-zinc-600 mb-4",
									children: "TOURNAMENT RECORD"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-2 gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "border border-zinc-800 p-3 text-center",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-2xl font-black text-white",
											children: totalTournaments
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[7px] text-zinc-600 mt-1",
											children: "ENTERED"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "border border-yellow-400/30 p-3 text-center",
										style: { background: "#facc1508" },
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-2xl font-black text-yellow-400",
											children: championships
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[7px] text-zinc-600 mt-1",
											children: "CHAMPIONSHIPS"
										})]
									})]
								})]
							}),
							sessions.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-zinc-800 p-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[8px] tracking-[0.4em] text-zinc-600 mb-3",
									children: "RECENT TOURNAMENTS"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "space-y-2",
									children: sessions.slice(0, 5).map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-3 py-1.5 border-b border-zinc-900",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex-1 min-w-0",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[9px] font-black text-white truncate",
													children: s.tournamentName ?? "Tournament"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-[7px] text-zinc-600 mt-0.5",
													children: [
														s.fighterName,
														" · ",
														s.roundsPlayed,
														" rounds"
													]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2 shrink-0",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "text-[8px] font-black text-green-400",
														children: [s.wins, "W"]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "text-[8px] font-black text-red-400",
														children: [s.losses, "L"]
													}),
													s.isChampion && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[8px]",
														children: "👑"
													})
												]
											}),
											s.tournamentTier && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[7px] font-black tracking-widest px-1.5 py-0.5 border shrink-0",
												style: {
													color: TIER_COLOR[s.tournamentTier] ?? "#94a3b8",
													borderColor: TIER_COLOR[s.tournamentTier] ?? "#94a3b8"
												},
												children: (s.tournamentTier ?? "").toUpperCase()
											})
										]
									}, s.id))
								})]
							}),
							sessions.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-zinc-800 p-8 text-center",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[9px] tracking-widest text-zinc-600",
									children: "NO TOURNAMENT DATA YET"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[8px] text-zinc-700 mt-2",
									children: "ENTER A TOURNAMENT TO START TRACKING"
								})]
							})
						]
					}),
					tab === "fighters" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-3",
						children: fighterStats.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "border border-zinc-800 p-8 text-center",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[9px] tracking-widest text-zinc-600",
								children: "NO FIGHTER DATA YET"
							})
						}) : fighterStats.map((f) => {
							const wr = f.totalMatches > 0 ? Math.round(f.totalWins / f.totalMatches * 100) : 0;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-zinc-800 p-4",
								style: { background: "linear-gradient(135deg, #0a0a0a 0%, #111 100%)" },
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-start justify-between mb-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-sm font-black text-white",
											children: f.fighterName.toUpperCase()
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-[7px] text-zinc-600 mt-0.5",
											children: [
												f.totalMatches,
												" MATCHES · ",
												f.tournamentsEntered,
												" TOURNAMENTS"
											]
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-right",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-lg font-black",
												style: { color: wr >= 60 ? "#4ade80" : wr >= 40 ? "#facc15" : "#f87171" },
												children: [wr, "%"]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[7px] text-zinc-600",
												children: "WIN RATE"
											})]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WinRateBar, {
										wins: f.totalWins,
										total: f.totalMatches
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-4 gap-2 mt-3 text-center",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-base font-black text-green-400",
												children: f.totalWins
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[7px] text-zinc-600",
												children: "W"
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-base font-black text-red-400",
												children: f.totalLosses
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[7px] text-zinc-600",
												children: "L"
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-base font-black text-yellow-400",
												children: f.bestStreak
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[7px] text-zinc-600",
												children: "STREAK"
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-base font-black text-yellow-400",
												children: f.tournamentsWon
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[7px] text-zinc-600",
												children: "TITLES"
											})] })
										]
									})
								]
							}, f.id);
						})
					}),
					tab === "history" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1",
						children: [matches.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "border border-zinc-800 p-8 text-center",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[9px] tracking-widest text-zinc-600",
								children: "NO MATCH HISTORY YET"
							})
						}) : matches.map((m, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setSelectedMatch(m),
							className: "w-full flex items-center gap-3 py-2 border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors text-left px-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[7px] text-zinc-700 w-5 text-right shrink-0",
									children: i + 1
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[8px] font-black w-10 shrink-0",
									style: { color: m.outcome === "win" ? "#4ade80" : m.outcome === "draw" ? "#94a3b8" : "#f87171" },
									children: m.outcome.toUpperCase()
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex-1 min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[8px] text-zinc-400",
										children: "vs "
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[8px] font-black text-white",
										children: m.opponentFighterName
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[7px] text-zinc-700 shrink-0",
									children: new Date(m.playedAt).toLocaleDateString("en-US", {
										month: "short",
										day: "numeric"
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[7px] text-zinc-700 shrink-0",
									children: "›"
								})
							]
						}, m.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "pt-2 text-center",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[7px] tracking-widest text-zinc-700",
								children: "TAP A MATCH TO VIEW DETAILS"
							})
						})]
					}),
					tab === "rank" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-zinc-800 p-5 text-center",
								style: { background: "linear-gradient(135deg, #0a0a0a 0%, #111 100%)" },
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[8px] tracking-[0.4em] text-zinc-600 mb-3",
									children: "CURRENT RANK"
								}), currentRank ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-4xl font-black tracking-widest",
									style: { color: TIER_COLOR[currentRank.rankTier] ?? "#94a3b8" },
									children: TIER_LABEL[currentRank.rankTier] ?? currentRank.rankTier.toUpperCase()
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-xl font-black text-white mt-2",
									children: [currentRank.rankPoints, " PTS"]
								})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[9px] text-zinc-600",
									children: "NO RANK YET — COMPLETE A TOURNAMENT"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-zinc-800 p-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[8px] tracking-[0.4em] text-zinc-600 mb-3",
									children: "RANK TIERS"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "space-y-2",
									children: [
										{
											tier: "legend",
											label: "LEGEND",
											min: "5000+",
											color: "#facc15"
										},
										{
											tier: "elite",
											label: "ELITE",
											min: "2000–4999",
											color: "#ef4444"
										},
										{
											tier: "challenger",
											label: "CHALLENGER",
											min: "500–1999",
											color: "#f59e0b"
										},
										{
											tier: "rookie",
											label: "ROOKIE",
											min: "0–499",
											color: "#94a3b8"
										}
									].map(({ tier, label, min, color }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between py-2 border-b border-zinc-900",
										style: { opacity: currentRank?.rankTier === tier ? 1 : .5 },
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "w-2 h-2 rounded-full",
												style: { background: color }
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[9px] font-black",
												style: { color },
												children: label
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-[8px] text-zinc-600",
											children: [min, " PTS"]
										})]
									}, tier))
								})]
							}),
							rankHistory.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-zinc-800 p-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[8px] tracking-[0.4em] text-zinc-600 mb-3",
									children: "PROGRESSION"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "space-y-1",
									children: rankHistory.slice(-10).reverse().map((r, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-3 py-1.5 border-b border-zinc-900",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "w-2 h-2 rounded-full shrink-0",
												style: { background: TIER_COLOR[r.rankTier] ?? "#94a3b8" }
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[8px] font-black",
													style: { color: TIER_COLOR[r.rankTier] ?? "#94a3b8" },
													children: [r.rankPoints, " PTS"]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[7px] text-zinc-700 ml-2",
													children: (r.rankTier ?? "").toUpperCase()
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[7px] text-zinc-700",
												children: new Date(r.recordedAt).toLocaleDateString("en-US", {
													month: "short",
													day: "numeric"
												})
											})
										]
									}, r.id))
								})]
							})
						]
					})
				] })
			}),
			selectedMatch && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MatchDetailModal, {
				match: selectedMatch,
				onClose: () => setSelectedMatch(null)
			})
		]
	});
}
//#endregion
export { TournamentStatsScreen as default };
