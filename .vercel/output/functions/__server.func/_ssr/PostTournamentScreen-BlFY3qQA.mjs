import { a as __toESM } from "../_runtime.mjs";
import { c as require_jsx_runtime, l as require_react } from "../_libs/@react-three/drei+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/PostTournamentScreen-BlFY3qQA.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var FACTION_COLOR = {
	alliance: "#1d4ed8",
	corporate: "#dc2626",
	chaos: "#7c3aed",
	independent: "#d97706"
};
var RANK_TIERS = [
	{
		tier: "BRONZE",
		min: 0,
		color: "#cd7f32"
	},
	{
		tier: "SILVER",
		min: 100,
		color: "#94a3b8"
	},
	{
		tier: "GOLD",
		min: 250,
		color: "#facc15"
	},
	{
		tier: "PLATINUM",
		min: 500,
		color: "#67e8f9"
	},
	{
		tier: "DIAMOND",
		min: 800,
		color: "#a78bfa"
	},
	{
		tier: "LEGEND",
		min: 1200,
		color: "#f97316"
	}
];
function getRankColor(tier) {
	return RANK_TIERS.find((r) => r.tier === tier.toUpperCase())?.color ?? "#94a3b8";
}
/** Compute earned rewards based on performance */
function computeRewards(stats, isChampion, rankPointsEarned) {
	const rewards = [];
	rewards.push({
		label: "RANK POINTS",
		value: `+${rankPointsEarned} RP`,
		color: "#facc15"
	});
	if (isChampion) {
		rewards.push({
			label: "CHAMPION TITLE",
			value: "BRUTAL FIST CHAMPION",
			color: "#facc15"
		});
		rewards.push({
			label: "COSMETIC UNLOCK",
			value: "GOLD AURA EFFECT",
			color: "#fbbf24"
		});
	}
	if (stats.wins >= 5) rewards.push({
		label: "MASTERY BONUS",
		value: `${stats.wins}× WIN BADGE`,
		color: "#4ade80"
	});
	if (stats.currentStreak >= 3) rewards.push({
		label: "STREAK BONUS",
		value: `${stats.currentStreak}× STREAK TITLE`,
		color: "#f97316"
	});
	if (stats.totalRounds >= 7) rewards.push({
		label: "ENDURANCE BADGE",
		value: "FULL BRACKET CLEARED",
		color: "#67e8f9"
	});
	return rewards;
}
/** Generate deterministic replay frames from a RoundResult */
function generateReplayFrames(result, p1MaxHp, p2MaxHp) {
	const frames = [];
	const totalTicks = 120;
	const playerDmg = result.playerDamage ?? 80;
	const opponentDmg = result.opponentDamage ?? 80;
	Math.max(0, p1MaxHp - opponentDmg);
	Math.max(0, p2MaxHp - playerDmg);
	for (let t = 0; t <= totalTicks; t++) {
		const progress = t / totalTicks;
		const approachEnd = .35;
		const fightStart = .4;
		const fightEnd = .75;
		let p1X = 15;
		let p2X = 85;
		let p1State = "idle";
		let p2State = "idle";
		let event;
		let eventSide;
		let eventDmg;
		if (progress < approachEnd) {
			const t2 = progress / approachEnd;
			p1X = 15 + t2 * 25;
			p2X = 85 - t2 * 25;
			p1State = "walk";
			p2State = "walk";
		} else if (progress < fightStart) {
			p1X = 40;
			p2X = 60;
			p1State = "idle";
			p2State = "idle";
		} else if (progress < fightEnd) {
			const t2 = (progress - fightStart) / .35;
			p1X = 38 + Math.sin(t2 * Math.PI * 4) * 4;
			p2X = 62 - Math.sin(t2 * Math.PI * 4) * 4;
			if (t2 > .2 && t2 < .25) {
				p1State = "attack";
				p2State = "hit";
				event = "hit";
				eventSide = "p2";
				eventDmg = Math.round(playerDmg * .4);
			} else if (t2 > .5 && t2 < .55) {
				p2State = "attack";
				p1State = "hit";
				event = "hit";
				eventSide = "p1";
				eventDmg = Math.round(opponentDmg * .4);
			} else if (t2 > .75 && t2 < .8) {
				if (result.playerWon) {
					p1State = "attack";
					p2State = "ko";
					event = "ko";
					eventSide = "p2";
					eventDmg = Math.round(playerDmg * .6);
				} else {
					p2State = "attack";
					p1State = "ko";
					event = "ko";
					eventSide = "p1";
					eventDmg = Math.round(opponentDmg * .6);
				}
			} else {
				p1State = "idle";
				p2State = "idle";
			}
		} else {
			p1X = result.playerWon ? 45 : 38;
			p2X = result.playerWon ? 62 : 55;
			p1State = result.playerWon ? "victory" : "ko";
			p2State = result.playerWon ? "ko" : "victory";
		}
		const healthProgress = Math.min(1, Math.max(0, (progress - fightStart) / .35));
		const p1Health = Math.round(p1MaxHp - opponentDmg * healthProgress);
		const p2Health = Math.round(p2MaxHp - playerDmg * healthProgress);
		frames.push({
			tick: t,
			p1X,
			p2X,
			p1Health,
			p2Health,
			p1State,
			p2State,
			event,
			eventSide,
			eventDmg
		});
	}
	return frames;
}
function RoundReplayViewer({ result, playerFighter, roundIndex, totalRounds, onPrev, onNext }) {
	const [playing, setPlaying] = (0, import_react.useState)(false);
	const [currentTick, setCurrentTick] = (0, import_react.useState)(0);
	const [frames, setFrames] = (0, import_react.useState)([]);
	const rafRef = (0, import_react.useRef)(0);
	const lastTimeRef = (0, import_react.useRef)(0);
	const tickRef = (0, import_react.useRef)(0);
	const p1Color = FACTION_COLOR[playerFighter.factionAlignment];
	const p2Color = FACTION_COLOR[result.opponent.factionAlignment];
	const p1MaxHp = playerFighter.hp;
	const p2MaxHp = result.opponent.hp;
	(0, import_react.useEffect)(() => {
		const f = generateReplayFrames(result, p1MaxHp, p2MaxHp);
		setFrames(f);
		setCurrentTick(0);
		tickRef.current = 0;
		setPlaying(false);
		cancelAnimationFrame(rafRef.current);
	}, [
		result,
		p1MaxHp,
		p2MaxHp
	]);
	(0, import_react.useEffect)(() => {
		if (!playing || frames.length === 0) return;
		const loop = (now) => {
			if (now - lastTimeRef.current >= 33) {
				lastTimeRef.current = now;
				tickRef.current = Math.min(tickRef.current + 1, frames.length - 1);
				setCurrentTick(tickRef.current);
				if (tickRef.current >= frames.length - 1) {
					setPlaying(false);
					return;
				}
			}
			rafRef.current = requestAnimationFrame(loop);
		};
		rafRef.current = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(rafRef.current);
	}, [playing, frames]);
	const handlePlay = () => {
		if (currentTick >= frames.length - 1) {
			tickRef.current = 0;
			setCurrentTick(0);
		}
		setPlaying(true);
	};
	const handleScrub = (e) => {
		let t = parseInt(e.target.value, 10);
		tickRef.current = t;
		setCurrentTick(t);
		setPlaying(false);
		cancelAnimationFrame(rafRef.current);
	};
	const frame = frames[currentTick] ?? frames[0];
	if (!frame) return null;
	const p1HealthPct = Math.max(0, Math.min(100, frame.p1Health / p1MaxHp * 100));
	const p2HealthPct = Math.max(0, Math.min(100, frame.p2Health / p2MaxHp * 100));
	const getHpColor = (pct) => pct > 50 ? "#facc15" : pct > 25 ? "#f97316" : "#ef4444";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onPrev,
						disabled: roundIndex === 0,
						className: "text-[8px] font-black tracking-widest px-3 py-1.5 border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all",
						children: "◀ PREV"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[7px] text-zinc-600 tracking-widest",
								children: "ROUND REPLAY"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-sm font-black text-white",
								children: [
									"RND ",
									result.round,
									" / ",
									totalRounds
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-[8px] font-black mt-0.5",
								style: { color: result.playerWon ? "#4ade80" : result.winner === "draw" ? "#94a3b8" : "#f87171" },
								children: [result.playerWon ? "▶ WIN" : result.winner === "draw" ? "— DRAW" : "✕ LOSS", result.aiResolved && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ml-1 text-zinc-700",
									children: "⚡"
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onNext,
						disabled: roundIndex === totalRounds - 1,
						className: "text-[8px] font-black tracking-widest px-3 py-1.5 border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all",
						children: "NEXT ▶"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative w-full overflow-hidden border border-zinc-800",
				style: {
					height: 160,
					background: "linear-gradient(180deg, #0a0a12 0%, #111118 60%, #0d0d0d 100%)"
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute bottom-8 left-0 right-0 h-px bg-zinc-800" }),
					[
						20,
						40,
						60,
						80
					].map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute top-0 bottom-0 w-px bg-zinc-900/50",
						style: { left: `${x}%` }
					}, x)),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute top-0 bottom-0 w-px",
						style: {
							left: "50%",
							background: "#facc1530"
						}
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute transition-all duration-100",
						style: {
							left: `${frame.p1X}%`,
							bottom: 8,
							transform: "translateX(-50%)"
						},
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative flex flex-col items-center",
							children: [
								frame.event && frame.eventSide === "p1" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "absolute -inset-2 rounded-full animate-ping",
									style: { background: `${p1Color}40` }
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "w-6 h-10 rounded-sm relative",
									style: {
										background: frame.p1State === "ko" ? "#ef444460" : frame.p1State === "attack" ? `${p1Color}cc` : frame.p1State === "hit" ? "#ffffff40" : `${p1Color}80`,
										border: `1px solid ${p1Color}`,
										boxShadow: frame.p1State === "attack" ? `0 0 8px ${p1Color}` : "none",
										transform: frame.p1State === "ko" ? "rotate(90deg) translateY(8px)" : "none",
										transition: "transform 0.2s"
									}
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[6px] font-black mt-0.5 whitespace-nowrap",
									style: { color: p1Color },
									children: playerFighter.name.slice(0, 6).toUpperCase()
								})
							]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute transition-all duration-100",
						style: {
							left: `${frame.p2X}%`,
							bottom: 8,
							transform: "translateX(-50%)"
						},
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative flex flex-col items-center",
							children: [
								frame.event && frame.eventSide === "p2" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "absolute -inset-2 rounded-full animate-ping",
									style: { background: `${p2Color}40` }
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "w-6 h-10 rounded-sm",
									style: {
										background: frame.p2State === "ko" ? "#ef444460" : frame.p2State === "attack" ? `${p2Color}cc` : frame.p2State === "hit" ? "#ffffff40" : `${p2Color}80`,
										border: `1px solid ${p2Color}`,
										boxShadow: frame.p2State === "attack" ? `0 0 8px ${p2Color}` : "none",
										transform: frame.p2State === "ko" ? "rotate(-90deg) translateY(8px)" : "none",
										transition: "transform 0.2s"
									}
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[6px] font-black mt-0.5 whitespace-nowrap",
									style: { color: p2Color },
									children: result.opponent.name.slice(0, 6).toUpperCase()
								})
							]
						})
					}),
					frame.event === "hit" && frame.eventDmg && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "absolute text-[10px] font-black animate-bounce",
						style: {
							left: `${frame.eventSide === "p1" ? frame.p1X : frame.p2X}%`,
							top: "20%",
							transform: "translateX(-50%)",
							color: "#facc15",
							textShadow: "0 0 8px #facc15"
						},
						children: ["-", frame.eventDmg]
					}),
					frame.event === "ko" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute text-[11px] font-black",
						style: {
							left: "50%",
							top: "15%",
							transform: "translateX(-50%)",
							color: "#facc15",
							textShadow: "0 0 12px #facc15"
						},
						children: "K.O."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute top-2 left-0 right-0 flex justify-center",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-[6px] text-zinc-700 tracking-widest",
							children: [
								"DIST: ",
								Math.round(Math.abs(frame.p2X - frame.p1X)),
								"u"
							]
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex justify-between text-[7px] mb-0.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								style: { color: p1Color },
								children: playerFighter.name.slice(0, 8).toUpperCase()
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-zinc-600",
								children: frame.p1Health
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-2 bg-zinc-900 border border-zinc-800",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-full transition-all duration-100",
								style: {
									width: `${p1HealthPct}%`,
									background: getHpColor(p1HealthPct)
								}
							})
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[7px] text-zinc-700 shrink-0",
						children: "VS"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex justify-between text-[7px] mb-0.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-zinc-600",
								children: frame.p2Health
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								style: { color: p2Color },
								children: result.opponent.name.slice(0, 8).toUpperCase()
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-2 bg-zinc-900 border border-zinc-800",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-full transition-all duration-100 ml-auto",
								style: {
									width: `${p2HealthPct}%`,
									background: getHpColor(p2HealthPct)
								}
							})
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: playing ? () => {
							setPlaying(false);
							cancelAnimationFrame(rafRef.current);
						} : handlePlay,
						className: "text-[8px] font-black tracking-widest px-4 py-2 border transition-all",
						style: {
							borderColor: playing ? "#ef4444" : "#facc15",
							color: playing ? "#ef4444" : "#facc15"
						},
						children: playing ? "⏸ PAUSE" : currentTick >= frames.length - 1 ? "↺ REPLAY" : "▶ PLAY"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "range",
						min: 0,
						max: frames.length - 1,
						value: currentTick,
						onChange: handleScrub,
						className: "flex-1 h-1 accent-yellow-400"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-[7px] text-zinc-600 w-10 text-right",
						children: [
							currentTick,
							"/",
							frames.length - 1
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "border border-zinc-900 p-2",
					style: { background: `${p1Color}08` },
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[7px] text-zinc-600 mb-1",
							children: "YOUR DAMAGE DEALT"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-lg font-black",
							style: { color: p1Color },
							children: result.playerDamage ?? "—"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1 h-1 bg-zinc-900",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-full",
								style: {
									width: `${Math.min(100, (result.playerDamage ?? 0) / 200 * 100)}%`,
									background: p1Color
								}
							})
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "border border-zinc-900 p-2",
					style: { background: `${p2Color}08` },
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[7px] text-zinc-600 mb-1",
							children: "OPP DAMAGE DEALT"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-lg font-black",
							style: { color: p2Color },
							children: result.opponentDamage ?? "—"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1 h-1 bg-zinc-900",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-full ml-auto",
								style: {
									width: `${Math.min(100, (result.opponentDamage ?? 0) / 200 * 100)}%`,
									background: p2Color
								}
							})
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border border-zinc-900 p-3 space-y-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[7px] text-zinc-600 tracking-widest mb-2",
					children: "FIGHTER COMPARISON"
				}), [
					{
						label: "STR",
						p1: playerFighter.strength,
						p2: result.opponent.strength
					},
					{
						label: "SPD",
						p1: playerFighter.speed,
						p2: result.opponent.speed
					},
					{
						label: "POI",
						p1: playerFighter.poise,
						p2: result.opponent.poise
					}
				].map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex-1 h-1.5 bg-zinc-900 flex justify-end",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-full",
								style: {
									width: `${s.p1}%`,
									background: p1Color
								}
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[7px] text-zinc-500 w-6 text-center",
							children: s.label
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex-1 h-1.5 bg-zinc-900",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-full",
								style: {
									width: `${s.p2}%`,
									background: p2Color
								}
							})
						})
					]
				}, s.label))]
			})
		]
	});
}
function PostTournamentScreen({ playerFighter, results, stats, isChampion, rankPointsEarned, rankTier, onMainMenu, onPlayAgain }) {
	const [activeTab, setActiveTab] = (0, import_react.useState)("summary");
	const [replayRoundIndex, setReplayRoundIndex] = (0, import_react.useState)(0);
	const playerColor = FACTION_COLOR[playerFighter.factionAlignment];
	const rankColor = getRankColor(rankTier);
	const rewards = computeRewards(stats, isChampion, rankPointsEarned);
	const winRate = stats.totalRounds > 0 ? Math.round(stats.wins / stats.totalRounds * 100) : 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 bg-black text-white flex flex-col font-mono overflow-hidden",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 pointer-events-none",
				style: { background: isChampion ? "radial-gradient(ellipse at 50% 0%, #facc1518 0%, transparent 60%)" : "radial-gradient(ellipse at 50% 0%, #dc262618 0%, transparent 60%)" }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 opacity-[0.03] pointer-events-none",
				style: { backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.5) 3px, rgba(255,255,255,0.5) 4px)" }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10 flex-shrink-0 border-b border-zinc-900 px-5 pt-5 pb-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[8px] tracking-[0.5em] text-zinc-600",
							children: "TOURNAMENT COMPLETE"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1 text-2xl font-black tracking-widest",
							style: {
								color: isChampion ? "#facc15" : "#ef4444",
								textShadow: `0 0 20px currentColor`
							},
							children: isChampion ? "👑 CHAMPION" : "ELIMINATED"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1 text-sm font-black",
							style: { color: playerColor },
							children: playerFighter.name.toUpperCase()
						})
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-right",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[7px] tracking-widest text-zinc-600",
								children: "NEW RANK"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xl font-black mt-0.5",
								style: { color: rankColor },
								children: rankTier
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-[8px] mt-0.5",
								style: { color: rankColor },
								children: [
									"+",
									rankPointsEarned,
									" RP"
								]
							})
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 grid grid-cols-4 gap-2 text-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border border-zinc-900 py-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xl font-black text-green-400",
								children: stats.wins
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[7px] text-zinc-600",
								children: "WINS"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border border-zinc-900 py-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xl font-black text-red-400",
								children: stats.losses
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[7px] text-zinc-600",
								children: "LOSSES"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border border-zinc-900 py-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xl font-black text-zinc-400",
								children: stats.draws
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[7px] text-zinc-600",
								children: "DRAWS"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border border-zinc-900 py-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-xl font-black text-yellow-400",
								children: [winRate, "%"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[7px] text-zinc-600",
								children: "WIN RATE"
							})]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "relative z-10 flex-shrink-0 flex border-b border-zinc-900",
				children: [
					"summary",
					"bracket",
					"rewards",
					"replay"
				].map((tab) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => setActiveTab(tab),
					className: "flex-1 py-3 text-[8px] tracking-[0.2em] font-black transition-all",
					style: {
						color: activeTab === tab ? "#fff" : "#52525b",
						borderBottom: activeTab === tab ? `2px solid ${playerColor}` : "2px solid transparent"
					},
					children: tab === "replay" ? "⏵ REPLAY" : tab.toUpperCase()
				}, tab))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10 flex-1 overflow-y-auto px-5 py-4",
				children: [
					activeTab === "summary" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[8px] tracking-[0.3em] text-zinc-600 mb-3",
							children: "MATCH SUMMARY"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "space-y-2",
							children: results.map((r, i) => {
								const oppColor = FACTION_COLOR[r.opponent.factionAlignment];
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-3 border border-zinc-900 px-3 py-2",
									style: { background: r.playerWon ? "#4ade8008" : r.winner === "draw" ? "#94a3b808" : "#f8717108" },
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-[8px] text-zinc-600 w-10",
											children: ["RND ", r.round]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-[9px] font-black",
												style: { color: oppColor },
												children: ["vs ", r.opponent.name.toUpperCase()]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[7px] text-zinc-600",
												children: r.opponent.fightingStyle.split(".")[0]
											})]
										}),
										r.playerDamage !== void 0 && r.opponentDamage !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-0.5 w-24",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-1",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-[6px] text-zinc-600 w-6",
														children: "YOU"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "flex-1 h-1 bg-zinc-900",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "h-full bg-green-500",
															style: { width: `${Math.min(100, r.playerDamage / 200 * 100)}%` }
														})
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-[6px] text-zinc-500 w-6 text-right",
														children: r.playerDamage
													})
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-1",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-[6px] text-zinc-600 w-6",
														children: "OPP"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "flex-1 h-1 bg-zinc-900",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "h-full bg-red-500",
															style: { width: `${Math.min(100, r.opponentDamage / 200 * 100)}%` }
														})
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-[6px] text-zinc-500 w-6 text-right",
														children: r.opponentDamage
													})
												]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[9px] font-black",
												style: { color: r.playerWon ? "#4ade80" : r.winner === "draw" ? "#94a3b8" : "#f87171" },
												children: r.playerWon ? "WIN" : r.winner === "draw" ? "DRAW" : "LOSS"
											}), r.aiResolved && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[7px] text-zinc-700",
												children: "⚡"
											})]
										})
									]
								}, i);
							})
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[8px] tracking-[0.3em] text-zinc-600 mb-3",
							children: "YOUR FIGHTER STATS"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "border border-zinc-900 p-3 space-y-2",
							children: [
								{
									label: "STRENGTH",
									value: playerFighter.strength,
									color: "#ef4444"
								},
								{
									label: "SPEED",
									value: playerFighter.speed,
									color: "#3b82f6"
								},
								{
									label: "POISE",
									value: playerFighter.poise,
									color: "#a78bfa"
								}
							].map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[8px] text-zinc-500 w-20",
										children: s.label
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex-1 h-1.5 bg-zinc-900",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "h-full transition-all",
											style: {
												width: `${s.value}%`,
												background: s.color
											}
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[8px] font-black w-6 text-right",
										style: { color: s.color },
										children: s.value
									})
								]
							}, s.label))
						})] })]
					}),
					activeTab === "bracket" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[8px] tracking-[0.3em] text-zinc-600 mb-3",
								children: "FINAL BRACKET OUTCOME"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "space-y-2",
								children: results.map((r, i) => {
									const oppColor = FACTION_COLOR[r.opponent.factionAlignment];
									const isLast = i === results.length - 1;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "relative",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-stretch gap-0",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "w-14 flex items-center justify-center text-[7px] text-zinc-700 border-r border-zinc-900 pr-2",
												children: ["RND ", r.round]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex-1 border border-zinc-900 ml-2 p-2",
												style: {
													borderLeftColor: r.playerWon ? "#4ade80" : r.winner === "draw" ? "#94a3b8" : "#f87171",
													borderLeftWidth: 2
												},
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center justify-between",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-[9px] font-black",
															style: { color: playerColor },
															children: playerFighter.name.toUpperCase()
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-[7px] text-zinc-600",
															children: playerFighter.factionAlignment.toUpperCase()
														})] }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-[8px] font-black text-zinc-600",
															children: "VS"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "text-right",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "text-[9px] font-black",
																style: { color: oppColor },
																children: r.opponent.name.toUpperCase()
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "text-[7px] text-zinc-600",
																children: r.opponent.factionAlignment.toUpperCase()
															})]
														})
													]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "mt-1 text-center",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[8px] font-black",
														style: { color: r.playerWon ? "#4ade80" : r.winner === "draw" ? "#94a3b8" : "#f87171" },
														children: r.playerWon ? "▶ PLAYER WINS" : r.winner === "draw" ? "— DRAW" : "✕ OPPONENT WINS"
													}), r.aiResolved && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "ml-2 text-[7px] text-zinc-700",
														children: "⚡ SIMULATED"
													})]
												})]
											})]
										}), !isLast && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute left-14 top-full w-0.5 h-2 bg-zinc-900" })]
									}, i);
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border-2 p-4 text-center mt-4",
								style: {
									borderColor: isChampion ? "#facc15" : "#ef4444",
									background: isChampion ? "#facc1508" : "#ef444408"
								},
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[8px] tracking-widest text-zinc-500 mb-1",
										children: "FINAL OUTCOME"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-2xl font-black",
										style: { color: isChampion ? "#facc15" : "#ef4444" },
										children: isChampion ? "👑 TOURNAMENT CHAMPION" : "✕ ELIMINATED"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[9px] text-zinc-500 mt-1",
										children: [
											stats.wins,
											"W · ",
											stats.losses,
											"L · ",
											stats.draws,
											"D across ",
											stats.totalRounds,
											" rounds"
										]
									})
								]
							})
						]
					}),
					activeTab === "rewards" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[8px] tracking-[0.3em] text-zinc-600 mb-3",
								children: "EARNED REWARDS"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-zinc-900 p-4",
								style: { background: `${rankColor}08` },
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[8px] tracking-widest text-zinc-600 mb-2",
										children: "RANK PROGRESSION"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[8px] text-zinc-600",
											children: "NEW TIER"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-2xl font-black mt-0.5",
											style: { color: rankColor },
											children: rankTier
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-right",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[8px] text-zinc-600",
												children: "POINTS EARNED"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-2xl font-black text-yellow-400 mt-0.5",
												children: ["+", rankPointsEarned]
											})]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "flex justify-between text-[7px] text-zinc-700 mb-1",
											children: RANK_TIERS.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												style: { color: r.tier === rankTier.toUpperCase() ? rankColor : "#3f3f46" },
												children: r.tier.slice(0, 3)
											}, r.tier))
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "h-1.5 bg-zinc-900 relative",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "absolute left-0 top-0 h-full transition-all duration-700",
												style: {
													width: `${Math.min(100, rankPointsEarned / 1200 * 100)}%`,
													background: `linear-gradient(90deg, #facc15, ${rankColor})`
												}
											})
										})]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "space-y-2",
								children: rewards.map((reward, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-3 border border-zinc-900 px-3 py-3",
									style: { background: `${reward.color}08` },
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "w-2 h-2 rounded-full flex-shrink-0",
											style: { background: reward.color }
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[8px] text-zinc-500",
												children: reward.label
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[10px] font-black mt-0.5",
												style: { color: reward.color },
												children: reward.value
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[8px] text-zinc-700",
											children: "UNLOCKED"
										})
									]
								}, i))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-zinc-900 p-3 text-center",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[7px] tracking-widest text-zinc-700",
									children: "SEASON PROGRESSION"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-[9px] text-zinc-500 mt-1",
									children: [
										stats.wins,
										" tournament wins recorded · ",
										isChampion ? "Champion badge earned" : "Keep fighting to earn champion status"
									]
								})]
							})
						]
					}),
					activeTab === "replay" && results.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[8px] tracking-[0.3em] text-zinc-600 mb-1",
								children: "ROUND-BY-ROUND REPLAY"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[7px] text-zinc-700 mb-3",
								children: "Scrub through each round to review fighter positioning, damage events, and match outcome."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-wrap gap-1.5 mb-2",
								children: results.map((r, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => setReplayRoundIndex(i),
									className: "px-2 py-1 text-[7px] font-black tracking-widest border transition-all",
									style: {
										borderColor: replayRoundIndex === i ? playerColor : "#27272a",
										color: replayRoundIndex === i ? "#fff" : "#52525b",
										background: replayRoundIndex === i ? `${playerColor}20` : "transparent"
									},
									children: [
										"R",
										r.round,
										" ",
										r.playerWon ? "✓" : r.winner === "draw" ? "—" : "✕"
									]
								}, i))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RoundReplayViewer, {
								result: results[replayRoundIndex],
								playerFighter,
								roundIndex: replayRoundIndex,
								totalRounds: results.length,
								onPrev: () => setReplayRoundIndex((i) => Math.max(0, i - 1)),
								onNext: () => setReplayRoundIndex((i) => Math.min(results.length - 1, i + 1))
							})
						]
					}),
					activeTab === "replay" && results.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-center py-12 text-zinc-700 text-[9px] tracking-widest",
						children: "NO ROUND DATA AVAILABLE"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10 flex-shrink-0 border-t border-zinc-900 p-4 flex gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: onPlayAgain,
					className: "flex-1 border-2 border-yellow-400 py-3 text-xs font-black tracking-widest text-yellow-400 hover:bg-yellow-400 hover:text-black transition-all",
					children: "PLAY AGAIN"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: onMainMenu,
					className: "flex-1 border border-zinc-700 py-3 text-xs font-black tracking-widest text-zinc-400 hover:bg-white hover:text-black transition-all",
					children: "MAIN MENU"
				})]
			})
		]
	});
}
//#endregion
export { PostTournamentScreen as default };
