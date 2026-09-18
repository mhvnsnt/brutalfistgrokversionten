import { a as __toESM } from "../_runtime.mjs";
import { c as require_jsx_runtime, l as require_react } from "../_libs/@react-three/drei+[...].mjs";
import { d as getAllBannonFighters } from "./routes-DbIfrPB2.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/SeasonalTournamentScreen-BdHycftd.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var TIERS = [
	{
		name: "BRONZE",
		minElo: 0,
		maxElo: 999,
		color: "#cd7f32",
		bgColor: "#1a0e00",
		borderColor: "#7c4a1a",
		reward: "Bronze Faction Skin",
		rewardType: "skin",
		icon: "🥉"
	},
	{
		name: "SILVER",
		minElo: 1e3,
		maxElo: 1499,
		color: "#c0c0c0",
		bgColor: "#111114",
		borderColor: "#6b6b6b",
		reward: "Silver Impact Effect",
		rewardType: "effect",
		icon: "🥈"
	},
	{
		name: "GOLD",
		minElo: 1500,
		maxElo: 1999,
		color: "#ffd700",
		bgColor: "#1a1400",
		borderColor: "#8b7300",
		reward: "Gold Aura Bundle",
		rewardType: "bundle",
		icon: "🥇"
	},
	{
		name: "PLATINUM",
		minElo: 2e3,
		maxElo: 2499,
		color: "#e5e4e2",
		bgColor: "#0d1014",
		borderColor: "#5a6a7a",
		reward: "Platinum Seasonal Cosmetic",
		rewardType: "seasonal",
		icon: "💎"
	},
	{
		name: "FINALS",
		minElo: 2500,
		maxElo: 9999,
		color: "#f59e0b",
		bgColor: "#1a0a00",
		borderColor: "#b45309",
		reward: "Season Champion Skin + Title",
		rewardType: "seasonal",
		icon: "🏆"
	}
];
function calcEloChange(winnerElo, loserElo, k = 32) {
	const expected = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
	return Math.round(k * (1 - expected));
}
function getTierForElo(elo) {
	return TIERS.slice().reverse().find((t) => elo >= t.minElo) ?? TIERS[0];
}
function buildParticipants(fighters, playerFighterId) {
	return fighters.slice(0, 8).map((f, i) => {
		const baseElo = 800 + (f.strength + f.speed + f.poise) * 12 + i * 40;
		const tier = getTierForElo(baseElo);
		return {
			id: f.id,
			name: f.name,
			elo: baseElo,
			tier,
			isPlayer: f.id === playerFighterId,
			wins: 0,
			losses: 0,
			eliminated: false
		};
	});
}
function buildBracket(participants) {
	const seeded = [...participants].sort((a, b) => b.elo - a.elo);
	return [[
		{
			id: "qf1",
			round: 1,
			p1: seeded[0],
			p2: seeded[7],
			winner: null,
			eloChange: 0
		},
		{
			id: "qf2",
			round: 1,
			p1: seeded[1],
			p2: seeded[6],
			winner: null,
			eloChange: 0
		},
		{
			id: "qf3",
			round: 1,
			p1: seeded[2],
			p2: seeded[5],
			winner: null,
			eloChange: 0
		},
		{
			id: "qf4",
			round: 1,
			p1: seeded[3],
			p2: seeded[4],
			winner: null,
			eloChange: 0
		}
	]];
}
function simulateMatch(match) {
	let winner;
	if (match.p1.isPlayer || match.p2.isPlayer) winner = match.p1.isPlayer ? match.p1 : match.p2;
	else {
		const p1WinProb = 1 / (1 + Math.pow(10, (match.p2.elo - match.p1.elo) / 400));
		winner = Math.random() < p1WinProb ? match.p1 : match.p2;
	}
	const loser = winner === match.p1 ? match.p2 : match.p1;
	const change = calcEloChange(winner.elo, loser.elo);
	winner.wins += 1;
	loser.losses += 1;
	loser.eliminated = true;
	winner.elo += change;
	loser.elo = Math.max(0, loser.elo - change);
	winner.tier = getTierForElo(winner.elo);
	loser.tier = getTierForElo(loser.elo);
	return {
		...match,
		winner,
		eloChange: change
	};
}
function advanceRound(rounds) {
	const lastRound = rounds[rounds.length - 1];
	if (lastRound.some((m) => !m.winner)) return rounds;
	const winners = lastRound.map((m) => m.winner);
	if (winners.length === 1) return rounds;
	const nextRound = [];
	for (let i = 0; i < winners.length; i += 2) if (winners[i + 1]) nextRound.push({
		id: `r${rounds.length + 1}m${i / 2 + 1}`,
		round: rounds.length + 1,
		p1: winners[i],
		p2: winners[i + 1],
		winner: null,
		eloChange: 0
	});
	return [...rounds, nextRound];
}
function RewardBanner({ tier, visible }) {
	if (!visible) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-x-4 top-20 z-50 border-2 p-4 font-mono text-center animate-bounce",
		style: {
			borderColor: tier.color,
			background: `${tier.bgColor}ee`,
			boxShadow: `0 0 30px ${tier.color}66`
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-2xl mb-1",
				children: tier.icon
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-[8px] tracking-[0.5em]",
				style: { color: tier.color },
				children: "TIER REWARD UNLOCKED"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-base font-black tracking-widest text-white mt-1",
				children: tier.reward
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "text-[7px] tracking-widest text-zinc-500 mt-1 uppercase",
				children: [
					tier.rewardType,
					" · ",
					tier.name,
					" TIER"
				]
			})
		]
	});
}
function MatchCard({ match, onSimulate, isActive }) {
	const p1Won = match.winner?.id === match.p1.id;
	const p2Won = match.winner?.id === match.p2.id;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border font-mono overflow-hidden transition-all duration-200",
		style: {
			borderColor: match.winner ? match.winner.tier.borderColor : isActive ? "#52525b" : "#27272a",
			background: "#0a0a0a"
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between px-3 py-2 border-b",
				style: {
					borderColor: "#1a1a1a",
					background: p1Won ? `${match.p1.tier.bgColor}` : "transparent"
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[7px] tracking-widest text-zinc-600",
							children: match.p1.tier.icon
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] font-black tracking-wider",
							style: { color: p1Won ? match.p1.tier.color : p1Won === false && match.winner ? "#52525b" : "#d4d4d8" },
							children: match.p1.name.toUpperCase()
						}),
						match.p1.isPlayer && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[6px] tracking-widest text-yellow-400 border border-yellow-800 px-1",
							children: "YOU"
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[8px] text-zinc-600",
							children: match.p1.elo
						}),
						p1Won && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-[8px] text-green-400",
							children: ["+", match.eloChange]
						}),
						!p1Won && match.winner && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-[8px] text-red-500",
							children: ["-", match.eloChange]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between px-3 py-2",
				style: { background: p2Won ? `${match.p2.tier.bgColor}` : "transparent" },
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[7px] tracking-widest text-zinc-600",
							children: match.p2.tier.icon
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] font-black tracking-wider",
							style: { color: p2Won ? match.p2.tier.color : p2Won === false && match.winner ? "#52525b" : "#d4d4d8" },
							children: match.p2.name.toUpperCase()
						}),
						match.p2.isPlayer && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[6px] tracking-widest text-yellow-400 border border-yellow-800 px-1",
							children: "YOU"
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[8px] text-zinc-600",
							children: match.p2.elo
						}),
						p2Won && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-[8px] text-green-400",
							children: ["+", match.eloChange]
						}),
						!p2Won && match.winner && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-[8px] text-red-500",
							children: ["-", match.eloChange]
						})
					]
				})]
			}),
			!match.winner && isActive && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: () => onSimulate(match.id),
				className: "w-full py-1.5 text-[8px] tracking-[0.4em] font-black border-t border-zinc-800 text-yellow-400 hover:bg-yellow-400/10 transition-colors",
				children: "▶ FIGHT"
			}),
			match.winner && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "w-full py-1 text-[7px] tracking-[0.4em] text-center border-t",
				style: {
					borderColor: "#1a1a1a",
					color: match.winner.tier.color
				},
				children: [match.winner.name.toUpperCase(), " ADVANCES"]
			})
		]
	});
}
function TierProgressBar({ participant }) {
	if (!participant) return null;
	const tier = participant.tier;
	const nextTier = TIERS[TIERS.indexOf(tier) + 1];
	const progress = nextTier ? (participant.elo - tier.minElo) / (nextTier.minElo - tier.minElo) * 100 : 100;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "font-mono",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between mb-1",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-base",
					children: tier.icon
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-[8px] tracking-[0.4em]",
					style: { color: tier.color },
					children: [tier.name, " TIER"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-[7px] text-zinc-600",
					children: ["ELO: ", participant.elo]
				})] })]
			}), nextTier && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "text-right",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-[7px] text-zinc-600",
					children: ["NEXT: ", nextTier.name]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-[7px]",
					style: { color: nextTier.color },
					children: [nextTier.minElo - participant.elo, " ELO away"]
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "h-1.5 bg-zinc-900 rounded-full overflow-hidden",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "h-full rounded-full transition-all duration-700",
				style: {
					width: `${Math.min(100, progress)}%`,
					background: tier.color
				}
			})
		})]
	});
}
function SeasonalTournamentScreen({ onBack, playerFighterId = "bannon" }) {
	const fighters = getAllBannonFighters();
	const [participants] = (0, import_react.useState)(() => buildParticipants(fighters, playerFighterId));
	const [rounds, setRounds] = (0, import_react.useState)(() => buildBracket(participants));
	const [rewardTier, setRewardTier] = (0, import_react.useState)(null);
	const [showReward, setShowReward] = (0, import_react.useState)(false);
	const [champion, setChampion] = (0, import_react.useState)(null);
	const [activeTab, setActiveTab] = (0, import_react.useState)("bracket");
	const playerParticipant = (0, import_react.useMemo)(() => participants.find((p) => p.isPlayer) ?? null, [participants]);
	const isRoundComplete = rounds[rounds.length - 1].every((m) => m.winner !== null);
	const tournamentOver = champion !== null;
	const handleSimulate = (0, import_react.useCallback)((matchId) => {
		setRounds((prev) => {
			return prev.map((round) => round.map((m) => m.id === matchId ? simulateMatch({ ...m }) : m));
		});
	}, []);
	const handleAdvanceRound = (0, import_react.useCallback)(() => {
		setRounds((prev) => {
			const advanced = advanceRound(prev);
			const lastRound = advanced[advanced.length - 1];
			if (advanced.length > prev.length && lastRound.length === 0) {
				const finalsMatch = prev[prev.length - 1][0];
				if (finalsMatch?.winner) {
					setChampion(finalsMatch.winner);
					if (finalsMatch.winner.isPlayer) {
						const tier = getTierForElo(finalsMatch.winner.elo);
						setRewardTier(tier);
						setShowReward(true);
						setTimeout(() => setShowReward(false), 4e3);
					}
				}
			}
			if (lastRound.length === 1 && !lastRound[0].winner) {
				const finalsMatch = lastRound[0];
				if (finalsMatch.p1.isPlayer || finalsMatch.p2.isPlayer) {
					const playerTier = playerParticipant?.tier;
					if (playerTier && TIERS.indexOf(playerTier) >= TIERS.indexOf(TIERS[3])) {
						setRewardTier(playerTier);
						setShowReward(true);
						setTimeout(() => setShowReward(false), 3500);
					}
				}
			}
			return advanced;
		});
	}, [playerParticipant]);
	const roundLabels = [
		"QUARTER-FINALS",
		"SEMI-FINALS",
		"FINALS"
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 bg-[#080808] text-white font-mono flex flex-col overflow-hidden",
		children: [
			rewardTier && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RewardBanner, {
				tier: rewardTier,
				visible: showReward
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between px-4 py-3 border-b border-zinc-900 shrink-0",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onBack,
						className: "text-[9px] tracking-[0.4em] text-zinc-600 hover:text-white transition-colors",
						children: "← BACK"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-center",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[7px] tracking-[0.5em] text-zinc-600",
							children: "SEASON 1"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-sm font-black tracking-[0.2em] text-yellow-400",
							children: "BRUTAL FIST CHAMPIONSHIP"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[7px] tracking-widest text-zinc-700 text-right",
						children: "ELO BRACKET"
					})
				]
			}),
			playerParticipant && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "px-4 py-3 border-b border-zinc-900 bg-zinc-950 shrink-0",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TierProgressBar, { participant: playerParticipant })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex border-b border-zinc-900 shrink-0",
				children: [
					"bracket",
					"tiers",
					"standings"
				].map((tab) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => setActiveTab(tab),
					className: "flex-1 py-2.5 text-[8px] tracking-[0.4em] font-black transition-colors",
					style: {
						color: activeTab === tab ? "#f59e0b" : "#52525b",
						borderBottom: activeTab === tab ? "2px solid #f59e0b" : "2px solid transparent"
					},
					children: tab.toUpperCase()
				}, tab))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 overflow-y-auto",
				children: [
					activeTab === "bracket" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-4 space-y-6",
						children: [tournamentOver && champion && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border-2 p-4 text-center",
							style: {
								borderColor: "#f59e0b",
								background: "#1a0a00",
								boxShadow: "0 0 30px #f59e0b44"
							},
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-2xl mb-1",
									children: "🏆"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[8px] tracking-[0.5em] text-yellow-600",
									children: "SEASON CHAMPION"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xl font-black tracking-widest text-yellow-400 mt-1",
									children: champion.name.toUpperCase()
								}),
								champion.isPlayer && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[8px] tracking-widest text-green-400 mt-2",
									children: "✓ SEASON COSMETICS UNLOCKED"
								})
							]
						}), rounds.map((round, rIdx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[8px] tracking-[0.5em] text-zinc-600 mb-3",
								children: roundLabels[rIdx] ?? `ROUND ${rIdx + 1}`
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "space-y-2",
								children: round.map((match) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MatchCard, {
									match,
									onSimulate: handleSimulate,
									isActive: rIdx === rounds.length - 1
								}, match.id))
							}),
							rIdx === rounds.length - 1 && isRoundComplete && !tournamentOver && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: handleAdvanceRound,
								className: "w-full mt-3 py-3 border-2 border-yellow-600 text-yellow-400 text-[9px] tracking-[0.4em] font-black hover:bg-yellow-400/10 transition-colors",
								children: [
									"ADVANCE TO ",
									roundLabels[rIdx + 1] ?? "FINALS",
									" →"
								]
							})
						] }, rIdx))]
					}),
					activeTab === "tiers" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-4 space-y-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[8px] tracking-[0.4em] text-zinc-600 mb-4",
							children: "CLIMB TIERS BY WINNING MATCHES. EACH TIER UNLOCKS EXCLUSIVE COSMETICS."
						}), TIERS.map((tier) => {
							const isCurrentTier = playerParticipant?.tier.name === tier.name;
							const isUnlocked = playerParticipant ? playerParticipant.elo >= tier.minElo : false;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border p-4 transition-all",
								style: {
									borderColor: isCurrentTier ? tier.color : tier.borderColor,
									background: isCurrentTier ? tier.bgColor : "#0a0a0a",
									boxShadow: isCurrentTier ? `0 0 20px ${tier.color}33` : "none"
								},
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-start justify-between gap-3",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-2xl",
												children: tier.icon
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-sm font-black tracking-widest",
												style: { color: tier.color },
												children: tier.name
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-[7px] text-zinc-600 mt-0.5",
												children: [
													tier.minElo,
													"–",
													tier.maxElo === 9999 ? "∞" : tier.maxElo,
													" ELO"
												]
											})] })]
										}),
										isCurrentTier && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[6px] tracking-widest border px-2 py-0.5 shrink-0",
											style: {
												borderColor: tier.color,
												color: tier.color
											},
											children: "CURRENT"
										}),
										!isCurrentTier && isUnlocked && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[6px] tracking-widest text-green-500 border border-green-900 px-2 py-0.5 shrink-0",
											children: "CLEARED"
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3 border-t pt-3",
									style: { borderColor: "#1a1a1a" },
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[7px] tracking-[0.4em] text-zinc-600 mb-1",
										children: "TIER REWARD"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[8px]",
												children: tier.rewardType === "skin" ? "👕" : tier.rewardType === "effect" ? "✨" : tier.rewardType === "bundle" ? "📦" : "🌟"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[9px] font-black tracking-wider",
												style: { color: isUnlocked ? tier.color : "#52525b" },
												children: tier.reward
											}),
											isUnlocked && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[6px] text-green-400 ml-auto",
												children: "✓ UNLOCKED"
											})
										]
									})]
								})]
							}, tier.name);
						})]
					}),
					activeTab === "standings" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[8px] tracking-[0.4em] text-zinc-600 mb-4",
							children: "CURRENT STANDINGS — ELO SEEDED"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "space-y-1",
							children: [...participants].sort((a, b) => b.elo - a.elo).map((p, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-3 px-3 py-2.5 border transition-all",
								style: {
									borderColor: p.isPlayer ? p.tier.borderColor : "#1f1f1f",
									background: p.isPlayer ? p.tier.bgColor : "#0a0a0a"
								},
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[9px] font-black w-5 text-center",
										style: { color: idx === 0 ? "#ffd700" : idx === 1 ? "#c0c0c0" : idx === 2 ? "#cd7f32" : "#52525b" },
										children: idx + 1
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-base",
										children: p.tier.icon
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] font-black tracking-wider",
													style: { color: p.eliminated ? "#52525b" : p.isPlayer ? p.tier.color : "#d4d4d8" },
													children: p.name.toUpperCase()
												}),
												p.isPlayer && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[6px] tracking-widest text-yellow-400 border border-yellow-800 px-1",
													children: "YOU"
												}),
												p.eliminated && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[6px] tracking-widest text-red-800 border border-red-900 px-1",
													children: "OUT"
												})
											]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-[7px] text-zinc-700 mt-0.5",
											children: [
												"W:",
												p.wins,
												" L:",
												p.losses
											]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-right",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[9px] font-black",
											style: { color: p.tier.color },
											children: p.elo
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[6px] text-zinc-700",
											children: "ELO"
										})]
									})
								]
							}, p.id))
						})]
					})
				]
			})
		]
	});
}
//#endregion
export { SeasonalTournamentScreen as default };
