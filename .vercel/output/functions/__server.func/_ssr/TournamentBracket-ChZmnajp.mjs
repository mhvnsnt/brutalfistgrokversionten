import { a as __toESM } from "../_runtime.mjs";
import { c as require_jsx_runtime, l as require_react } from "../_libs/@react-three/drei+[...].mjs";
import { a as dynamic, l as useAuth, u as BANNON_ROSTER } from "./routes-DbIfrPB2.mjs";
import { a as statsService, i as getRankTier, r as calcRankPoints } from "./statsService-7dhcoGcP.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/TournamentBracket-ChZmnajp.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var GameBattleArena = dynamic(() => import("./GameBattleArena-Q4F29L8T.mjs"), { ssr: false });
var FACTION_COLOR = {
	alliance: "#1d4ed8",
	corporate: "#dc2626",
	chaos: "#7c3aed",
	independent: "#d97706"
};
function buildOpponentQueue(playerFighter) {
	const pool = [...BANNON_ROSTER].filter((f) => f.id !== playerFighter.id);
	for (let i = pool.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[pool[i], pool[j]] = [pool[j], pool[i]];
	}
	return pool.slice(0, 7);
}
/**
* AI MATCHUP RESOLUTION ENGINE
* Simulates a fight outcome using fighter stats and matchup logic.
* Returns winner, simulated damage values, and a brief narrative.
*
* Factors:
*   - strength × 0.35 + speed × 0.30 + poise × 0.20 + hp × 0.15 = base score
*   - Faction matchup modifier (alliance beats corporate, chaos beats alliance, etc.)
*   - Random variance ±15% to keep outcomes unpredictable
*/
function resolveMatchupAI(player, opponent) {
	const score = (f) => f.strength * .35 + f.speed * .3 + f.poise * .2 + f.hp / 1e4 * 15;
	const FACTION_ADVANTAGE = {
		alliance: "corporate",
		corporate: "chaos",
		chaos: "independent",
		independent: "alliance"
	};
	let playerScore = score(player);
	let opponentScore = score(opponent);
	if (FACTION_ADVANTAGE[player.factionAlignment] === opponent.factionAlignment) playerScore *= 1.08;
	else if (FACTION_ADVANTAGE[opponent.factionAlignment] === player.factionAlignment) opponentScore *= 1.08;
	playerScore *= .85 + Math.random() * .3;
	opponentScore *= .85 + Math.random() * .3;
	const diff = playerScore - opponentScore;
	const winner = Math.abs(diff) < 2 ? "draw" : diff > 0 ? "p1" : "p2";
	const totalDmg = 160 + Math.floor(Math.random() * 80);
	const playerShare = winner === "p1" ? .55 + Math.random() * .15 : .35 + Math.random() * .15;
	const playerDamage = Math.floor(totalDmg * playerShare);
	return {
		winner,
		playerDamage,
		opponentDamage: totalDmg - playerDamage
	};
}
function StatBar({ label, value, max, color }) {
	const pct = Math.min(100, value / max * 100);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-[9px] text-zinc-500 w-14 shrink-0",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex-1 h-1.5 bg-zinc-800 relative",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute left-0 top-0 h-full transition-all duration-500",
					style: {
						width: `${pct}%`,
						background: color
					}
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-[9px] font-black w-6 text-right",
				style: { color },
				children: value
			})
		]
	});
}
function TournamentBracket({ playerFighter, onExit, onTournamentEnd }) {
	const { user } = useAuth();
	const [opponents] = (0, import_react.useState)(() => buildOpponentQueue(playerFighter));
	const [phase, setPhase] = (0, import_react.useState)("bracket_view");
	const [currentRound, setCurrentRound] = (0, import_react.useState)(0);
	const [results, setResults] = (0, import_react.useState)([]);
	const [lastResult, setLastResult] = (0, import_react.useState)(null);
	const [stats, setStats] = (0, import_react.useState)({
		wins: 0,
		losses: 0,
		draws: 0,
		totalRounds: 0,
		currentStreak: 0
	});
	const [sessionId, setSessionId] = (0, import_react.useState)(null);
	const [isAutoResolving, setIsAutoResolving] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!user?.id) return;
		statsService.getTournaments().then((ts) => {
			const t = ts[0];
			if (!t) return;
			statsService.createSession({
				userId: user.id,
				tournamentId: t.id,
				fighterId: playerFighter.id,
				fighterName: playerFighter.name
			}).then((id) => {
				if (id) setSessionId(id);
			});
		});
	}, [
		user?.id,
		playerFighter.id,
		playerFighter.name
	]);
	const currentOpponent = opponents[currentRound] ?? null;
	const totalRounds = opponents.length;
	const handleMatchEnd = (0, import_react.useCallback)((winner, aiResolved = false, playerDamage, opponentDamage) => {
		const playerWon = winner === "p1";
		const isDraw = winner === "draw";
		const result = {
			round: currentRound + 1,
			opponent: opponents[currentRound],
			winner,
			playerWon,
			aiResolved,
			playerDamage,
			opponentDamage
		};
		setLastResult(result);
		setResults((prev) => [...prev, result]);
		setStats((prev) => ({
			wins: prev.wins + (playerWon ? 1 : 0),
			losses: prev.losses + (!playerWon && !isDraw ? 1 : 0),
			draws: prev.draws + (isDraw ? 1 : 0),
			totalRounds: prev.totalRounds + 1,
			currentStreak: playerWon ? prev.currentStreak + 1 : 0
		}));
		if (user?.id && sessionId) statsService.saveMatchResult({
			sessionId,
			userId: user.id,
			roundNumber: currentRound + 1,
			opponentFighterId: opponents[currentRound].id,
			opponentFighterName: opponents[currentRound].name,
			outcome: playerWon ? "win" : isDraw ? "draw" : "loss"
		});
		setPhase("round_result");
	}, [
		currentRound,
		opponents,
		user?.id,
		sessionId
	]);
	/** Auto-resolve the current round using AI matchup logic */
	const handleAutoResolve = (0, import_react.useCallback)(() => {
		if (!currentOpponent) return;
		setIsAutoResolving(true);
		setTimeout(() => {
			const { winner, playerDamage, opponentDamage } = resolveMatchupAI(playerFighter, currentOpponent);
			setIsAutoResolving(false);
			handleMatchEnd(winner, true, playerDamage, opponentDamage);
		}, 900);
	}, [
		currentOpponent,
		playerFighter,
		handleMatchEnd
	]);
	const persistSessionEnd = (0, import_react.useCallback)((finalStats, isChampion, isEliminated) => {
		if (!user?.id || !sessionId) return;
		const pts = calcRankPoints(finalStats.wins, finalStats.losses, isChampion);
		const tier = getRankTier(pts);
		statsService.completeSession({
			sessionId,
			wins: finalStats.wins,
			losses: finalStats.losses,
			draws: finalStats.draws,
			roundsPlayed: finalStats.totalRounds,
			isChampion,
			isEliminated,
			rankPointsEarned: pts
		});
		statsService.upsertFighterStats({
			userId: user.id,
			fighterId: playerFighter.id,
			fighterName: playerFighter.name,
			wins: finalStats.wins,
			losses: finalStats.losses,
			draws: finalStats.draws,
			tournamentEntered: true,
			tournamentWon: isChampion,
			streak: finalStats.currentStreak
		});
		statsService.recordRank(user.id, pts, tier);
		return {
			pts,
			tier
		};
	}, [
		user?.id,
		sessionId,
		playerFighter.id,
		playerFighter.name
	]);
	const handleNextRound = (0, import_react.useCallback)(() => {
		if (!lastResult) return;
		if (!lastResult.playerWon && lastResult.winner !== "draw") {
			const rankData = persistSessionEnd(stats, false, true);
			if (onTournamentEnd) {
				const pts = rankData?.pts ?? calcRankPoints(stats.wins, stats.losses, false);
				const tier = rankData?.tier ?? getRankTier(pts);
				onTournamentEnd({
					playerFighter,
					results: [...results, lastResult].filter((r, i, arr) => arr.findIndex((x) => x.round === r.round) === i),
					stats,
					isChampion: false,
					rankPointsEarned: pts,
					rankTier: tier
				});
			} else setPhase("eliminated");
			return;
		}
		const nextRound = currentRound + 1;
		if (nextRound >= totalRounds) {
			const rankData = persistSessionEnd(stats, true, false);
			if (onTournamentEnd) {
				const pts = rankData?.pts ?? calcRankPoints(stats.wins, stats.losses, true);
				const tier = rankData?.tier ?? getRankTier(pts);
				onTournamentEnd({
					playerFighter,
					results,
					stats,
					isChampion: true,
					rankPointsEarned: pts,
					rankTier: tier
				});
			} else setPhase("champion");
		} else {
			setCurrentRound(nextRound);
			setPhase("bracket_view");
		}
	}, [
		lastResult,
		currentRound,
		totalRounds,
		stats,
		results,
		persistSessionEnd,
		onTournamentEnd,
		playerFighter
	]);
	const playerColor = FACTION_COLOR[playerFighter.factionAlignment];
	if (phase === "fighting" && currentOpponent) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameBattleArena, {
		p1Fighter: playerFighter,
		p2Fighter: currentOpponent,
		onMatchEnd: (w) => handleMatchEnd(w),
		onBack: () => setPhase("bracket_view"),
		roundLabel: `ROUND ${currentRound + 1} / ${totalRounds}`
	});
	if (phase === "round_result" && lastResult) {
		const opp = lastResult.opponent;
		const oppColor = FACTION_COLOR[opp.factionAlignment];
		const won = lastResult.playerWon;
		const draw = lastResult.winner === "draw";
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "fixed inset-0 bg-black text-white flex flex-col items-center justify-center font-mono overflow-hidden",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 pointer-events-none",
				style: { background: won ? "radial-gradient(ellipse at 50% 50%, #1d4ed822 0%, transparent 70%)" : "radial-gradient(ellipse at 50% 50%, #dc262622 0%, transparent 70%)" }
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10 flex flex-col items-center gap-6 w-[min(90vw,480px)]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-5xl font-black tracking-widest animate-pulse",
						style: {
							color: won ? "#facc15" : draw ? "#94a3b8" : "#ef4444",
							textShadow: `0 0 30px currentColor`
						},
						children: won ? "VICTORY" : draw ? "DRAW" : "DEFEAT"
					}),
					lastResult.aiResolved && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[8px] tracking-[0.3em] text-zinc-600 border border-zinc-800 px-3 py-1",
						children: "⚡ AI SIMULATED · STATS-BASED RESOLUTION"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-4 w-full",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex-1 text-center",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[9px] tracking-widest text-zinc-500",
										children: "YOU"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-lg font-black mt-1",
										style: { color: playerColor },
										children: playerFighter.name.toUpperCase()
									}),
									lastResult.playerDamage !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[9px] text-green-400 mt-1",
										children: [lastResult.playerDamage, " DMG"]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-2xl font-black text-zinc-600",
								children: "VS"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex-1 text-center",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[9px] tracking-widest text-zinc-500",
										children: "OPPONENT"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-lg font-black mt-1",
										style: { color: oppColor },
										children: opp.name.toUpperCase()
									}),
									lastResult.opponentDamage !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[9px] text-red-400 mt-1",
										children: [lastResult.opponentDamage, " DMG"]
									})
								]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "w-full border border-zinc-800 p-4 space-y-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[9px] tracking-[0.3em] text-zinc-500 mb-3",
								children: "TOURNAMENT STATS"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid grid-cols-3 gap-3 text-center",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-2xl font-black text-green-400",
										children: stats.wins
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[8px] text-zinc-600",
										children: "WINS"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-2xl font-black text-red-400",
										children: stats.losses
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[8px] text-zinc-600",
										children: "LOSSES"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-2xl font-black text-yellow-400",
										children: stats.currentStreak
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[8px] text-zinc-600",
										children: "STREAK"
									})] })
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 text-[8px] text-zinc-600 text-center",
								children: [
									"ROUND ",
									lastResult.round,
									" / ",
									totalRounds,
									" · ",
									totalRounds - lastResult.round,
									" REMAINING"
								]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: handleNextRound,
						className: "w-full border-2 px-6 py-4 text-sm font-black tracking-widest transition-all",
						style: {
							borderColor: won ? playerColor : "#ef4444",
							color: won ? playerColor : "#ef4444"
						},
						onMouseEnter: (e) => {
							e.currentTarget.style.background = won ? playerColor : "#ef4444";
							e.currentTarget.style.color = "#000";
						},
						onMouseLeave: (e) => {
							e.currentTarget.style.background = "transparent";
							e.currentTarget.style.color = won ? playerColor : "#ef4444";
						},
						children: won || draw ? currentRound + 1 >= totalRounds ? "→ FINAL RESULTS" : `→ ROUND ${currentRound + 2}` : "→ CONTINUE"
					})
				]
			})]
		});
	}
	if (phase === "champion") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 bg-black text-white flex flex-col items-center justify-center font-mono overflow-hidden",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 pointer-events-none",
				style: { background: "radial-gradient(ellipse at 50% 40%, #facc1530 0%, transparent 65%)" }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 opacity-5 pointer-events-none",
				style: { backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 4px)" }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10 flex flex-col items-center gap-6 w-[min(90vw,520px)]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-5xl",
						children: "👑"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[10px] tracking-[0.5em] text-zinc-500",
						children: "BRUTAL FIST TOURNAMENT"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-5xl font-black tracking-widest",
						style: {
							color: "#facc15",
							textShadow: "0 0 40px #facc15, 0 0 80px #facc1544"
						},
						children: "CHAMPION"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-3xl font-black tracking-widest mt-2",
						style: {
							color: playerColor,
							textShadow: `0 0 20px ${playerColor}`
						},
						children: playerFighter.name.toUpperCase()
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[9px] text-zinc-500",
						children: playerFighter.role
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "w-full border border-yellow-400/30 p-5 space-y-3 mt-2",
						style: { background: "linear-gradient(135deg, #facc1508 0%, transparent 100%)" },
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[9px] tracking-[0.3em] text-yellow-400/70 mb-4",
								children: "FINAL RECORD"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid grid-cols-4 gap-2 text-center",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-3xl font-black text-green-400",
										children: stats.wins
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[8px] text-zinc-600",
										children: "WINS"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-3xl font-black text-red-400",
										children: stats.losses
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[8px] text-zinc-600",
										children: "LOSSES"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-3xl font-black text-zinc-400",
										children: stats.draws
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[8px] text-zinc-600",
										children: "DRAWS"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-3xl font-black text-yellow-400",
										children: totalRounds
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[8px] text-zinc-600",
										children: "ROUNDS"
									})] })
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-4 space-y-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[8px] tracking-widest text-zinc-600 mb-2",
									children: "ROUND HISTORY"
								}), results.map((r, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 text-[8px]",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-zinc-600 w-14",
											children: ["RND ", r.round]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-black w-12",
											style: { color: r.playerWon ? "#4ade80" : r.winner === "draw" ? "#94a3b8" : "#f87171" },
											children: r.playerWon ? "WIN" : r.winner === "draw" ? "DRAW" : "LOSS"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-zinc-500",
											children: ["vs ", r.opponent.name]
										}),
										r.aiResolved && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-zinc-700",
											children: "⚡"
										})
									]
								}, i))]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onExit,
						className: "flex-1 w-full border border-zinc-700 px-4 py-3 text-xs font-black tracking-widest hover:bg-white hover:text-black transition-all",
						children: "MAIN MENU"
					})
				]
			})
		]
	});
	if (phase === "eliminated") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 bg-black text-white flex flex-col items-center justify-center font-mono overflow-hidden",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "absolute inset-0 pointer-events-none",
			style: { background: "radial-gradient(ellipse at 50% 50%, #dc262618 0%, transparent 65%)" }
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative z-10 flex flex-col items-center gap-6 w-[min(90vw,480px)]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[10px] tracking-[0.5em] text-zinc-500",
					children: "TOURNAMENT OVER"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-5xl font-black tracking-widest",
					style: {
						color: "#ef4444",
						textShadow: "0 0 30px #ef4444"
					},
					children: "ELIMINATED"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-lg font-black text-zinc-400",
					children: playerFighter.name.toUpperCase()
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-full border border-zinc-800 p-5 space-y-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[9px] tracking-[0.3em] text-zinc-500 mb-3",
							children: "FINAL RECORD"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-3 gap-3 text-center",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-3xl font-black text-green-400",
									children: stats.wins
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[8px] text-zinc-600",
									children: "WINS"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-3xl font-black text-red-400",
									children: stats.losses
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[8px] text-zinc-600",
									children: "LOSSES"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-3xl font-black text-zinc-400",
									children: stats.totalRounds
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[8px] text-zinc-600",
									children: "ROUNDS"
								})] })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 space-y-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[8px] tracking-widest text-zinc-600 mb-2",
								children: "ROUND HISTORY"
							}), results.map((r, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2 text-[8px]",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-zinc-600 w-14",
										children: ["RND ", r.round]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-black w-12",
										style: { color: r.playerWon ? "#4ade80" : r.winner === "draw" ? "#94a3b8" : "#f87171" },
										children: r.playerWon ? "WIN" : r.winner === "draw" ? "DRAW" : "LOSS"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-zinc-500",
										children: ["vs ", r.opponent.name]
									}),
									r.aiResolved && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-zinc-700",
										children: "⚡"
									})
								]
							}, i))]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: onExit,
					className: "flex-1 w-full border border-zinc-700 px-4 py-3 text-xs font-black tracking-widest hover:bg-white hover:text-black transition-all",
					children: "MAIN MENU"
				})
			]
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 bg-black text-white flex flex-col items-center justify-center font-mono overflow-hidden",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 pointer-events-none",
				style: { background: "radial-gradient(ellipse at 50% 30%, #1c1c2e 0%, #000 70%)" }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 opacity-5",
				style: { backgroundImage: `repeating-linear-gradient(90deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 1px, transparent 1px, transparent 80px),
          repeating-linear-gradient(0deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 1px, transparent 1px, transparent 80px)` }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10 flex flex-col items-center gap-5 w-[min(92vw,520px)]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[9px] tracking-[0.5em] text-zinc-500",
						children: "BRUTAL FIST TOURNAMENT"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-2xl font-black tracking-widest text-white",
						children: [
							"ROUND ",
							currentRound + 1,
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-zinc-600",
								children: ["/ ", totalRounds]
							})
						]
					}),
					currentOpponent && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "w-full flex items-center gap-4 border border-zinc-800 p-4",
						style: { background: "linear-gradient(135deg, #0a0a0a 0%, #111 100%)" },
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex-1 text-center",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[8px] tracking-widest text-zinc-600 mb-1",
										children: "YOU"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-xl font-black",
										style: { color: playerColor },
										children: playerFighter.name.toUpperCase()
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[8px] text-zinc-600 mt-1",
										children: playerFighter.fightingStyle.split(".")[0]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-2 space-y-0.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatBar, {
											label: "STR",
											value: playerFighter.strength,
											max: 100,
											color: playerColor
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatBar, {
											label: "SPD",
											value: playerFighter.speed,
											max: 100,
											color: playerColor
										})]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-col items-center",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-3xl font-black text-red-500",
									children: "VS"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex-1 text-center",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[8px] tracking-widest text-zinc-600 mb-1",
										children: "OPPONENT"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-xl font-black",
										style: { color: FACTION_COLOR[currentOpponent.factionAlignment] },
										children: currentOpponent.name.toUpperCase()
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[8px] text-zinc-600 mt-1",
										children: currentOpponent.fightingStyle.split(".")[0]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-2 space-y-0.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatBar, {
											label: "STR",
											value: currentOpponent.strength,
											max: 100,
											color: FACTION_COLOR[currentOpponent.factionAlignment]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatBar, {
											label: "SPD",
											value: currentOpponent.speed,
											max: 100,
											color: FACTION_COLOR[currentOpponent.factionAlignment]
										})]
									})
								]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "w-full",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[8px] tracking-widest text-zinc-600 mb-2",
								children: "BRACKET PROGRESS"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex gap-1",
								children: opponents.map((opp, i) => {
									const result = results.find((r) => r.round === i + 1);
									const isCurrent = i === currentRound;
									const isFuture = i > currentRound;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex-1 h-8 border flex items-center justify-center text-[7px] font-black transition-all",
										style: {
											borderColor: isCurrent ? "#facc15" : result?.playerWon ? "#4ade80" : result && !result.playerWon ? "#f87171" : "#27272a",
											background: isCurrent ? "#facc1515" : result?.playerWon ? "#4ade8010" : result ? "#f8717110" : "transparent",
											color: isCurrent ? "#facc15" : result?.playerWon ? "#4ade80" : result ? "#f87171" : "#3f3f46"
										},
										title: opp.name,
										children: isFuture && !result ? "?" : result?.playerWon ? "W" : result ? "L" : isCurrent ? "▶" : "?"
									}, opp.id);
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex gap-1 mt-0.5",
								children: opponents.map((opp, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex-1 text-[6px] text-zinc-700 text-center truncate",
									children: i <= currentRound ? opp.name.split(" ")[0] : "???"
								}, opp.id))
							})
						]
					}),
					stats.totalRounds > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-6 text-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xl font-black text-green-400",
								children: stats.wins
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[8px] text-zinc-600",
								children: "WINS"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xl font-black text-red-400",
								children: stats.losses
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[8px] text-zinc-600",
								children: "LOSSES"
							})] }),
							stats.currentStreak > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-xl font-black text-yellow-400",
								children: [stats.currentStreak, "×"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[8px] text-zinc-600",
								children: "STREAK"
							})] })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "w-full flex gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setPhase("fighting"),
							className: "flex-1 border-2 border-yellow-400 px-4 py-4 text-base font-black tracking-widest text-yellow-400 hover:bg-yellow-400 hover:text-black transition-all",
							children: "FIGHT →"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: handleAutoResolve,
							disabled: isAutoResolving,
							className: "border-2 border-zinc-600 px-4 py-4 text-xs font-black tracking-widest text-zinc-400 hover:border-zinc-400 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed",
							title: "Auto-resolve using fighter stats",
							children: isAutoResolving ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "animate-pulse",
								children: "⚡ SIM..."
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "⚡ AUTO" })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onExit,
						className: "text-[9px] text-zinc-700 hover:text-zinc-400 tracking-widest transition-colors",
						children: "← EXIT TOURNAMENT"
					})
				]
			})
		]
	});
}
//#endregion
export { TournamentBracket as default };
