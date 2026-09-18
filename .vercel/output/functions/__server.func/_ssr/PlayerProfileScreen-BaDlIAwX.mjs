import { a as __toESM } from "../_runtime.mjs";
import { c as require_jsx_runtime, l as require_react } from "../_libs/@react-three/drei+[...].mjs";
import { l as useAuth, u as BANNON_ROSTER } from "./routes-DbIfrPB2.mjs";
import { t as createClient } from "./client-CENlhkXr.mjs";
import { n as ReplayScrubber, r as fetchReplaysFromSupabase } from "./MatchRecorder-m6dleRHv.mjs";
import { a as statsService, i as getRankTier } from "./statsService-7dhcoGcP.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/PlayerProfileScreen-BaDlIAwX.js
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
function getMasteryLevel(wins) {
	return Math.min(10, 1 + Math.floor(wins / 3));
}
var RARITY_COLOR = {
	COMMON: "#94a3b8",
	RARE: "#3b82f6",
	EPIC: "#a855f7",
	LEGENDARY: "#facc15"
};
var RARITY_GLOW = {
	COMMON: "transparent",
	RARE: "rgba(59,130,246,0.15)",
	EPIC: "rgba(168,85,247,0.15)",
	LEGENDARY: "rgba(250,204,21,0.15)"
};
var TIER_COLORS = {
	bronze: "#cd7f32",
	silver: "#94a3b8",
	gold: "#facc15",
	platinum: "#67e8f9",
	diamond: "#a78bfa",
	legend: "#f97316"
};
function buildMarketplace(totalWins, isChampion, masteryMap) {
	const maxMastery = Math.max(0, ...Object.values(masteryMap));
	return [
		{
			id: "default_attire",
			name: "DEFAULT ATTIRE",
			type: "OUTFIT",
			rarity: "COMMON",
			color: "#94a3b8",
			price: 0,
			unlocked: true,
			purchased: true,
			description: "Standard issue fighter uniform."
		},
		{
			id: "faction_banner",
			name: "FACTION BANNER",
			type: "BANNER",
			rarity: "COMMON",
			color: "#3b82f6",
			price: 200,
			unlocked: totalWins >= 1,
			purchased: totalWins >= 1,
			milestoneReq: "1 tournament win",
			description: "Display your faction allegiance in the arena."
		},
		{
			id: "iron_gloves",
			name: "IRON FIST GLOVES",
			type: "ACCESSORY",
			rarity: "COMMON",
			color: "#6b7280",
			price: 350,
			unlocked: totalWins >= 3,
			purchased: totalWins >= 3,
			milestoneReq: "3 tournament wins",
			description: "Reinforced combat gloves for serious fighters."
		},
		{
			id: "brutal_aura",
			name: "BRUTAL AURA",
			type: "EFFECT",
			rarity: "RARE",
			color: "#ef4444",
			price: 750,
			unlocked: totalWins >= 5,
			purchased: totalWins >= 5,
			milestoneReq: "5 tournament wins",
			description: "A crimson energy field that pulses with every hit."
		},
		{
			id: "shadow_attire",
			name: "SHADOW ATTIRE",
			type: "OUTFIT",
			rarity: "RARE",
			color: "#7c3aed",
			price: 900,
			unlocked: totalWins >= 10,
			purchased: totalWins >= 10,
			milestoneReq: "10 tournament wins",
			description: "Dark tactical outfit worn by underground champions."
		},
		{
			id: "mastery_badge_3",
			name: "VETERAN BADGE",
			type: "BADGE",
			rarity: "RARE",
			color: "#0ea5e9",
			price: 600,
			unlocked: maxMastery >= 3,
			purchased: maxMastery >= 3,
			masteryReq: 3,
			milestoneReq: "Reach Mastery LV 3 with any fighter",
			description: "Awarded to fighters who have mastered the basics."
		},
		{
			id: "void_aura",
			name: "VOID AURA",
			type: "EFFECT",
			rarity: "EPIC",
			color: "#8b5cf6",
			price: 1500,
			unlocked: totalWins >= 15,
			purchased: false,
			milestoneReq: "15 tournament wins",
			description: "Dimensional rift energy — your strikes tear through reality."
		},
		{
			id: "mastery_outfit_5",
			name: "ELITE COMBAT SUIT",
			type: "OUTFIT",
			rarity: "EPIC",
			color: "#06b6d4",
			price: 1800,
			unlocked: maxMastery >= 5,
			purchased: false,
			masteryReq: 5,
			milestoneReq: "Reach Mastery LV 5 with any fighter",
			description: "High-tech suit worn only by elite-tier combatants."
		},
		{
			id: "legend_badge",
			name: "LEGEND BADGE",
			type: "BADGE",
			rarity: "EPIC",
			color: "#f97316",
			price: 2e3,
			unlocked: totalWins >= 20,
			purchased: totalWins >= 20,
			milestoneReq: "20 tournament wins",
			description: "Reserved for those who have left their mark on the circuit."
		},
		{
			id: "champion_crown",
			name: "CHAMPION CROWN",
			type: "TITLE",
			rarity: "LEGENDARY",
			color: "#facc15",
			price: 0,
			unlocked: isChampion,
			purchased: isChampion,
			milestoneReq: "Win a full tournament bracket",
			description: "Only true champions may wear this. Cannot be purchased."
		},
		{
			id: "gold_aura",
			name: "GOLD AURA",
			type: "EFFECT",
			rarity: "LEGENDARY",
			color: "#fbbf24",
			price: 3500,
			unlocked: isChampion,
			purchased: false,
			milestoneReq: "Win a tournament bracket",
			description: "The aura of a champion — blinding golden energy."
		},
		{
			id: "mastery_legendary",
			name: "GRANDMASTER ATTIRE",
			type: "OUTFIT",
			rarity: "LEGENDARY",
			color: "#facc15",
			price: 5e3,
			unlocked: maxMastery >= 8,
			purchased: false,
			masteryReq: 8,
			milestoneReq: "Reach Mastery LV 8 with any fighter",
			description: "The ultimate fighter aesthetic. Worn only by grandmasters."
		},
		{
			id: "season1_outfit",
			name: "SEASON 1: IRON CIRCUIT",
			type: "OUTFIT",
			rarity: "EPIC",
			color: "#f97316",
			price: 2500,
			unlocked: totalWins >= 8,
			purchased: false,
			seasonal: true,
			seasonTag: "SEASON 1",
			milestoneReq: "8 wins during Season 1",
			description: "Limited season outfit from the inaugural Iron Circuit."
		},
		{
			id: "season1_banner",
			name: "SEASON 1: IRON BANNER",
			type: "BANNER",
			rarity: "RARE",
			color: "#f97316",
			price: 1200,
			unlocked: totalWins >= 5,
			purchased: false,
			seasonal: true,
			seasonTag: "SEASON 1",
			milestoneReq: "5 wins during Season 1",
			description: "Commemorative banner from the first season."
		},
		{
			id: "bundle_starter",
			name: "ROOKIE BUNDLE",
			type: "BUNDLE",
			rarity: "RARE",
			color: "#22c55e",
			price: 800,
			unlocked: totalWins >= 1,
			purchased: false,
			milestoneReq: "1 tournament win",
			bundleItems: [
				"Faction Banner",
				"Iron Fist Gloves",
				"Veteran Badge"
			],
			description: "Everything a new champion needs. 3 items at a discount."
		},
		{
			id: "bundle_elite",
			name: "ELITE BUNDLE",
			type: "BUNDLE",
			rarity: "EPIC",
			color: "#a855f7",
			price: 3200,
			unlocked: maxMastery >= 5,
			purchased: false,
			masteryReq: 5,
			milestoneReq: "Mastery LV 5 + 15 wins",
			bundleItems: [
				"Void Aura",
				"Elite Combat Suit",
				"Legend Badge"
			],
			description: "The elite fighter package. Mastery LV 5 required."
		}
	];
}
function getSeasonAchievements(wins, losses, draws, isChampion, streak) {
	return [
		{
			name: "FIRST BLOOD",
			desc: "Win your first tournament match",
			color: "#ef4444",
			earned: wins >= 1
		},
		{
			name: "ON A ROLL",
			desc: "Win 3 matches in a row",
			color: "#f97316",
			earned: streak >= 3
		},
		{
			name: "IRON WILL",
			desc: "Complete 5 tournament rounds",
			color: "#94a3b8",
			earned: wins + losses + draws >= 5
		},
		{
			name: "DOMINANT",
			desc: "Win 10 tournament matches",
			color: "#facc15",
			earned: wins >= 10
		},
		{
			name: "CHAMPION",
			desc: "Win a full tournament bracket",
			color: "#facc15",
			earned: isChampion
		},
		{
			name: "VETERAN",
			desc: "Play 20 total rounds",
			color: "#67e8f9",
			earned: wins + losses + draws >= 20
		},
		{
			name: "UNSTOPPABLE",
			desc: "Achieve a 5-match win streak",
			color: "#a78bfa",
			earned: streak >= 5
		},
		{
			name: "LEGEND",
			desc: "Win 25 tournament matches",
			color: "#f97316",
			earned: wins >= 25
		}
	];
}
function PlayerProfileScreen({ onBack }) {
	const { user } = useAuth();
	const [activeTab, setActiveTab] = (0, import_react.useState)("career");
	const [fighterStats, setFighterStats] = (0, import_react.useState)([]);
	const [rankPoints, setRankPoints] = (0, import_react.useState)(0);
	const [rankTier, setRankTier] = (0, import_react.useState)("BRONZE");
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [marketFilter, setMarketFilter] = (0, import_react.useState)("ALL");
	const [selectedItem, setSelectedItem] = (0, import_react.useState)(null);
	const [purchasedIds, setPurchasedIds] = (0, import_react.useState)(/* @__PURE__ */ new Set());
	const [brutalCoins] = (0, import_react.useState)(1250);
	const [playerEloRows, setPlayerEloRows] = (0, import_react.useState)([]);
	const [tierHistory, setTierHistory] = (0, import_react.useState)([]);
	const [h2hRecords, setH2HRecords] = (0, import_react.useState)([]);
	const [cosmeticTimeline, setCosmeticTimeline] = (0, import_react.useState)([]);
	const [eloLoading, setEloLoading] = (0, import_react.useState)(false);
	const [replays, setReplays] = (0, import_react.useState)([]);
	const [replaysLoading, setReplaysLoading] = (0, import_react.useState)(false);
	const [selectedReplay, setSelectedReplay] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (!user?.id) {
			setLoading(false);
			return;
		}
		Promise.all([statsService.getFighterStats(user.id), statsService.getCurrentRank(user.id)]).then(([fs, rank]) => {
			const rows = (fs ?? []).map((f) => ({
				fighterId: f.fighterId,
				fighterName: f.fighterName,
				wins: f.totalWins ?? 0,
				losses: f.totalLosses ?? 0,
				draws: f.totalDraws ?? 0,
				streak: f.bestStreak ?? 0,
				tournamentWon: f.tournamentsWon > 0
			}));
			setFighterStats(rows);
			if (rank) {
				setRankPoints(rank.rankPoints ?? 0);
				setRankTier(rank.rankTier ?? getRankTier(rank.rankPoints ?? 0));
			}
			setLoading(false);
		}).catch(() => setLoading(false));
	}, [user?.id]);
	(0, import_react.useEffect)(() => {
		if (!user?.id || activeTab !== "elo" && activeTab !== "h2h") return;
		setEloLoading(true);
		const supabase = createClient();
		Promise.all([
			supabase.from("player_elo").select("*").eq("user_id", user.id).order("elo_rating", { ascending: false }),
			supabase.from("tier_climb_history").select("*").eq("user_id", user.id).order("recorded_at", { ascending: false }).limit(30),
			supabase.from("head_to_head_records").select("*").eq("user_id", user.id).order("last_played_at", { ascending: false }).limit(20),
			supabase.from("cosmetic_unlocks").select("*").eq("user_id", user.id).order("unlocked_at", { ascending: false })
		]).then(([eloRes, tierRes, h2hRes, cosRes]) => {
			if (eloRes.data) setPlayerEloRows(eloRes.data.map((r) => ({
				fighterId: r.fighter_id,
				fighterName: r.fighter_name,
				eloRating: r.elo_rating,
				tier: r.tier,
				wins: r.wins,
				losses: r.losses,
				draws: r.draws,
				winStreak: r.win_streak
			})));
			if (tierRes.data) setTierHistory(tierRes.data.map((r) => ({
				id: r.id,
				fighterId: r.fighter_id,
				fighterName: r.fighter_name,
				fromTier: r.from_tier,
				toTier: r.to_tier,
				eloAtChange: r.elo_at_change,
				direction: r.direction,
				recordedAt: r.recorded_at
			})));
			if (h2hRes.data) setH2HRecords(h2hRes.data.map((r) => ({
				id: r.id,
				opponentId: r.opponent_id,
				opponentName: r.opponent_name,
				userFighterId: r.user_fighter_id,
				opponentFighterId: r.opponent_fighter_id,
				wins: r.wins,
				losses: r.losses,
				draws: r.draws,
				lastPlayedAt: r.last_played_at
			})));
			if (cosRes.data) setCosmeticTimeline(cosRes.data.map((r) => ({
				id: r.id,
				cosmeticId: r.cosmetic_id,
				cosmeticName: r.cosmetic_name,
				cosmeticType: r.cosmetic_type,
				rarity: r.rarity,
				unlockSource: r.unlock_source,
				unlockContext: r.unlock_context,
				unlockedAt: r.unlocked_at
			})));
			setEloLoading(false);
		}).catch(() => setEloLoading(false));
	}, [user?.id, activeTab]);
	(0, import_react.useEffect)(() => {
		if (!user?.id || activeTab !== "replays") return;
		setReplaysLoading(true);
		fetchReplaysFromSupabase(user.id).then((data) => {
			setReplays(data);
			setReplaysLoading(false);
		}).catch(() => setReplaysLoading(false));
	}, [user?.id, activeTab]);
	const totalWins = fighterStats.reduce((s, f) => s + (f.wins ?? 0), 0);
	const totalLosses = fighterStats.reduce((s, f) => s + (f.losses ?? 0), 0);
	const totalDraws = fighterStats.reduce((s, f) => s + (f.draws ?? 0), 0);
	const totalRounds = totalWins + totalLosses + totalDraws;
	const winRate = totalRounds > 0 ? Math.round(totalWins / totalRounds * 100) : 0;
	const isChampion = fighterStats.some((f) => f.tournamentWon);
	const maxStreak = fighterStats.reduce((m, f) => Math.max(m, f.streak ?? 0), 0);
	const rankColor = getRankColor(rankTier);
	const masteryMap = {};
	for (const fs of fighterStats) masteryMap[fs.fighterId] = getMasteryLevel(fs.wins);
	const marketplace = buildMarketplace(totalWins, isChampion, masteryMap);
	const achievements = getSeasonAchievements(totalWins, totalLosses, totalDraws, isChampion, maxStreak);
	const earnedCount = achievements.filter((a) => a.earned).length;
	const allItems = marketplace.map((item) => ({
		...item,
		purchased: item.purchased || purchasedIds.has(item.id)
	}));
	const filteredItems = allItems.filter((item) => {
		if (marketFilter === "ALL") return true;
		if (marketFilter === "SEASONAL") return item.seasonal;
		if (marketFilter === "BUNDLE") return item.type === "BUNDLE";
		if (marketFilter === "UNLOCKED") return item.unlocked;
		return item.type === marketFilter;
	});
	function handlePurchase(item) {
		if (!item.unlocked || item.purchased || item.price === 0) return;
		if (brutalCoins < item.price) return;
		setPurchasedIds((prev) => /* @__PURE__ */ new Set([...prev, item.id]));
		setSelectedItem(null);
	}
	const bestElo = playerEloRows.length > 0 ? Math.max(...playerEloRows.map((r) => r.eloRating)) : rankPoints;
	const bestEloTier = playerEloRows.length > 0 ? playerEloRows.sort((a, b) => b.eloRating - a.eloRating)[0]?.tier ?? "bronze" : "bronze";
	if (loading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 bg-black text-white flex items-center justify-center font-mono",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-[9px] tracking-[0.45em] text-zinc-600 animate-pulse",
			children: "LOADING PROFILE..."
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 bg-black text-white flex flex-col font-mono overflow-hidden",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 pointer-events-none",
				style: { background: `radial-gradient(ellipse at 50% 0%, ${rankColor}12 0%, transparent 55%)` }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 opacity-[0.03] pointer-events-none",
				style: { backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.5) 3px, rgba(255,255,255,0.5) 4px)" }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10 flex-shrink-0 border-b border-zinc-900 px-5 pt-5 pb-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onBack,
						className: "text-[8px] tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors mb-3",
						children: "← BACK"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[8px] tracking-[0.5em] text-zinc-600",
							children: "PLAYER PROFILE"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1 text-xl font-black tracking-widest text-white",
							children: user?.email ? user.email.split("@")[0].toUpperCase() : "FIGHTER"
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-right",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[7px] tracking-widest text-zinc-600",
									children: "RANK"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xl font-black mt-0.5",
									style: { color: rankColor },
									children: rankTier
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-[8px] text-zinc-600 mt-0.5",
									children: [rankPoints, " RP"]
								}),
								playerEloRows.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-[7px] mt-0.5",
									style: { color: TIER_COLORS[bestEloTier] ?? "#94a3b8" },
									children: ["ELO ", bestElo]
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 grid grid-cols-4 gap-2 text-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-zinc-900 py-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xl font-black text-green-400",
									children: totalWins
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[7px] text-zinc-600",
									children: "WINS"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-zinc-900 py-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xl font-black text-red-400",
									children: totalLosses
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[7px] text-zinc-600",
									children: "LOSSES"
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
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-zinc-900 py-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xl font-black text-zinc-400",
									children: totalRounds
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[7px] text-zinc-600",
									children: "ROUNDS"
								})]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "relative z-10 flex-shrink-0 flex border-b border-zinc-900 overflow-x-auto",
				children: [
					"career",
					"progression",
					"elo",
					"h2h",
					"mastery",
					"cosmetics",
					"season",
					"replays"
				].map((tab) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => setActiveTab(tab),
					className: "flex-shrink-0 px-3 py-3 text-[7px] tracking-[0.2em] font-black transition-all",
					style: {
						color: activeTab === tab ? "#fff" : "#52525b",
						borderBottom: activeTab === tab ? `2px solid ${rankColor}` : "2px solid transparent"
					},
					children: tab === "elo" ? "ELO" : tab === "h2h" ? "H2H" : tab.toUpperCase()
				}, tab))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10 flex-1 overflow-y-auto px-5 py-4",
				children: [
					activeTab === "progression" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[8px] tracking-[0.3em] text-zinc-600 mb-3",
								children: "RANK PROGRESSION & WIN STREAKS"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-zinc-900 p-4",
								style: { background: `${rankColor}08` },
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[8px] tracking-widest text-zinc-600 mb-3",
										children: "CUMULATIVE RANK PROGRESSION"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex items-end gap-1 h-20 mb-2",
										children: RANK_TIERS.map((r, i) => {
											const isReached = rankPoints >= r.min;
											const isCurrent = rankTier.toUpperCase() === r.tier;
											const barHeight = isReached ? `${20 + i * 16}%` : "8%";
											return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex-1 flex flex-col items-center gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "w-full transition-all duration-700 relative",
													style: {
														height: barHeight,
														background: isReached ? r.color : "#1c1c1e",
														boxShadow: isCurrent ? `0 0 8px ${r.color}88` : "none",
														minHeight: "4px"
													},
													children: isCurrent && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full",
														style: { background: r.color }
													})
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[5px] tracking-widest",
													style: { color: isReached ? r.color : "#3f3f46" },
													children: r.tier.slice(0, 3)
												})]
											}, r.tier);
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex justify-between text-[7px] text-zinc-600",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "0 RP" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "font-black",
												style: { color: rankColor },
												children: [rankPoints, " RP CURRENT"]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "1200 RP" })
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-2 h-1.5 bg-zinc-900",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "h-full transition-all duration-700",
											style: {
												width: `${Math.min(100, rankPoints / 1200 * 100)}%`,
												background: `linear-gradient(90deg, #cd7f32, #94a3b8, #facc15, #67e8f9, #a78bfa, ${rankColor})`
											}
										})
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-zinc-900 p-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[8px] tracking-widest text-zinc-600 mb-3",
										children: "WIN STREAKS"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-2 gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "border border-zinc-900 p-3 text-center",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-3xl font-black text-yellow-400",
												children: maxStreak
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[7px] text-zinc-600 mt-1",
												children: "BEST STREAK"
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "border border-zinc-900 p-3 text-center",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-3xl font-black text-orange-400",
												children: fighterStats.reduce((m, f) => Math.max(m, f.streak ?? 0), 0)
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[7px] text-zinc-600 mt-1",
												children: "CURRENT STREAK"
											})]
										})]
									}),
									fighterStats.filter((f) => f.streak > 0).length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-3 space-y-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[7px] text-zinc-700 mb-1",
											children: "ACTIVE STREAKS BY FIGHTER"
										}), fighterStats.filter((f) => f.streak > 0).map((fs, i) => {
											const fighter = BANNON_ROSTER.find((f) => f.id === fs.fighterId);
											const fColor = fighter ? FACTION_COLOR[fighter.factionAlignment] : "#94a3b8";
											return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-between border border-zinc-900 px-3 py-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[9px] font-black",
													style: { color: fColor },
													children: fs.fighterName.toUpperCase()
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-1",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-orange-400 text-[10px]",
														children: "🔥"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "text-[10px] font-black text-orange-400",
														children: [fs.streak, "×"]
													})]
												})]
											}, i);
										})]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-zinc-900 p-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[8px] tracking-widest text-zinc-600 mb-3",
									children: "SEASON-OVER-SEASON COMPARISON"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "space-y-3",
									children: [
										{
											label: "TOTAL WINS",
											s1: Math.max(0, totalWins - 3),
											s2: totalWins,
											color: "#22c55e"
										},
										{
											label: "WIN RATE",
											s1: Math.max(0, winRate - 8),
											s2: winRate,
											color: "#facc15",
											suffix: "%"
										},
										{
											label: "RANK POINTS",
											s1: Math.max(0, rankPoints - 120),
											s2: rankPoints,
											color: rankColor
										},
										{
											label: "BEST STREAK",
											s1: Math.max(0, maxStreak - 1),
											s2: maxStreak,
											color: "#f97316"
										}
									].map((row, i) => {
										const improved = row.s2 >= row.s1;
										const delta = row.s2 - row.s1;
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-between mb-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[7px] text-zinc-600",
													children: row.label
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-[7px] font-black",
													style: { color: improved ? "#22c55e" : "#ef4444" },
													children: [
														improved ? "▲" : "▼",
														" ",
														Math.abs(delta),
														row.suffix ?? ""
													]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex gap-1 items-center",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-[6px] text-zinc-700 w-10 text-right",
														children: "S1"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "flex-1 h-2 bg-zinc-900",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "h-full bg-zinc-700 transition-all",
															style: { width: `${Math.min(100, row.s1 / Math.max(1, row.s2) * 100)}%` }
														})
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "text-[7px] text-zinc-500 w-8",
														children: [row.s1, row.suffix ?? ""]
													})
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex gap-1 items-center mt-0.5",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-[6px] text-zinc-700 w-10 text-right",
														children: "S2"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "flex-1 h-2 bg-zinc-900",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "h-full transition-all",
															style: {
																width: "100%",
																background: row.color
															}
														})
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "text-[7px] font-black w-8",
														style: { color: row.color },
														children: [row.s2, row.suffix ?? ""]
													})
												]
											})
										] }, i);
									})
								})]
							}),
							tierHistory.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-zinc-900 p-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[8px] tracking-widest text-zinc-600 mb-3",
									children: "TIER CLIMB TIMELINE"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "relative",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute left-3 top-0 bottom-0 w-px bg-zinc-800" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "space-y-3 pl-8",
										children: tierHistory.slice(0, 8).map((entry, i) => {
											const isUp = entry.direction === "up";
											const toColor = TIER_COLORS[entry.toTier] ?? "#94a3b8";
											return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "relative",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "absolute -left-5 top-1 w-2 h-2 rounded-full border-2",
													style: {
														background: toColor,
														borderColor: toColor
													}
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "border border-zinc-900 px-3 py-2",
													style: { background: `${toColor}06` },
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-center justify-between",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex items-center gap-2",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-[10px] font-black",
																style: { color: isUp ? "#22c55e" : "#ef4444" },
																children: isUp ? "▲" : "▼"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																className: "text-[9px] font-black",
																style: { color: toColor },
																children: [
																	entry.fromTier.toUpperCase(),
																	" → ",
																	entry.toTier.toUpperCase()
																]
															})]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[7px] text-zinc-600",
															children: new Date(entry.recordedAt).toLocaleDateString()
														})]
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "text-[7px] text-zinc-600 mt-0.5",
														children: [
															entry.fighterName,
															" · ",
															entry.eloAtChange,
															" ELO"
														]
													})]
												})]
											}, i);
										})
									})]
								})]
							})
						]
					}),
					activeTab === "elo" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[8px] tracking-[0.3em] text-zinc-600 mb-3",
							children: "ELO RATINGS & RANK PROGRESS"
						}), eloLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-center py-8 text-zinc-700 text-[9px] animate-pulse",
							children: "LOADING ELO DATA..."
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							playerEloRows.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "space-y-2",
								children: playerEloRows.map((row, i) => {
									const tierColor = TIER_COLORS[row.tier] ?? "#94a3b8";
									const total = row.wins + row.losses + row.draws;
									const wr = total > 0 ? Math.round(row.wins / total * 100) : 0;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "border p-3",
										style: {
											borderColor: `${tierColor}40`,
											background: `${tierColor}06`
										},
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-between mb-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[10px] font-black",
													style: { color: tierColor },
													children: row.fighterName.toUpperCase()
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-[7px] text-zinc-600 mt-0.5",
													children: [row.tier.toUpperCase(), " TIER"]
												})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-right",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-2xl font-black",
														style: { color: tierColor },
														children: row.eloRating
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-[7px] text-zinc-600",
														children: "ELO"
													})]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "grid grid-cols-4 gap-1 text-center mb-2",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "border border-zinc-900 py-1",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-[10px] font-black text-green-400",
															children: row.wins
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-[6px] text-zinc-700",
															children: "W"
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "border border-zinc-900 py-1",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-[10px] font-black text-red-400",
															children: row.losses
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-[6px] text-zinc-700",
															children: "L"
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "border border-zinc-900 py-1",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-[10px] font-black text-zinc-500",
															children: row.draws
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-[6px] text-zinc-700",
															children: "D"
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "border border-zinc-900 py-1",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "text-[10px] font-black text-yellow-400",
															children: [wr, "%"]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-[6px] text-zinc-700",
															children: "WR"
														})]
													})
												]
											}),
											row.winStreak > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-[7px] font-black",
												style: { color: tierColor },
												children: [
													"🔥 ",
													row.winStreak,
													"× WIN STREAK"
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "mt-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex justify-between text-[6px] text-zinc-700 mb-1",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "TIER PROGRESS" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [row.eloRating, " ELO"] })]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "h-1 bg-zinc-900",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "h-full transition-all duration-700",
														style: {
															width: `${Math.min(100, (row.eloRating - (TIER_COLORS[row.tier] ? 0 : 0)) / 400 * 100)}%`,
															background: tierColor
														}
													})
												})]
											})
										]
									}, i);
								})
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-center py-6 text-zinc-700 text-[9px] tracking-widest border border-zinc-900",
								children: [
									"NO ELO DATA YET",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-zinc-800",
										children: "JOIN RANKED QUEUE TO BEGIN"
									})
								]
							}),
							tierHistory.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[8px] tracking-[0.3em] text-zinc-600 mb-2 mt-4",
								children: "TIER CLIMB HISTORY"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "space-y-1.5",
								children: tierHistory.slice(0, 10).map((entry, i) => {
									const isUp = entry.direction === "up";
									const toColor = TIER_COLORS[entry.toTier] ?? "#94a3b8";
									const fromColor = TIER_COLORS[entry.fromTier] ?? "#52525b";
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between border border-zinc-900 px-3 py-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[10px] font-black",
												style: { color: isUp ? "#22c55e" : "#ef4444" },
												children: isUp ? "▲" : "▼"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-1",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[8px] font-black",
														style: { color: fromColor },
														children: entry.fromTier.toUpperCase()
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[7px] text-zinc-700",
														children: "→"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[8px] font-black",
														style: { color: toColor },
														children: entry.toTier.toUpperCase()
													})
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[7px] text-zinc-600",
												children: entry.fighterName
											})] })]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-right",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-[8px] font-black",
												style: { color: toColor },
												children: [entry.eloAtChange, " ELO"]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[6px] text-zinc-700",
												children: new Date(entry.recordedAt).toLocaleDateString()
											})]
										})]
									}, i);
								})
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-zinc-900 p-4 mt-2",
								style: { background: `${rankColor}08` },
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[8px] tracking-widest text-zinc-600 mb-2",
										children: "SEASONAL RANK PROGRESS"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between mb-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-2xl font-black",
											style: { color: rankColor },
											children: rankTier
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-[9px] text-zinc-500",
											children: [rankPoints, " RP"]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex justify-between text-[7px] text-zinc-700 mb-1",
										children: RANK_TIERS.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											style: { color: r.tier === rankTier.toUpperCase() ? rankColor : "#3f3f46" },
											children: r.tier.slice(0, 3)
										}, r.tier))
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "h-1.5 bg-zinc-900",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "h-full transition-all duration-700",
											style: {
												width: `${Math.min(100, rankPoints / 1200 * 100)}%`,
												background: `linear-gradient(90deg, #facc15, ${rankColor})`
											}
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-2 text-[7px] text-zinc-700",
										children: [
											"Next tier: ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-zinc-400 font-black",
												children: RANK_TIERS.find((r) => r.min > rankPoints)?.tier ?? "MAX RANK"
											}),
											RANK_TIERS.find((r) => r.min > rankPoints) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "ml-1",
												children: [
													"(",
													RANK_TIERS.find((r) => r.min > rankPoints).min - rankPoints,
													" RP needed)"
												]
											})
										]
									})
								]
							})
						] })]
					}),
					activeTab === "h2h" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[8px] tracking-[0.3em] text-zinc-600 mb-3",
								children: "HEAD-TO-HEAD RECORDS"
							}),
							eloLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-center py-8 text-zinc-700 text-[9px] animate-pulse",
								children: "LOADING H2H DATA..."
							}) : h2hRecords.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "space-y-2",
								children: h2hRecords.map((record, i) => {
									const total = record.wins + record.losses + record.draws;
									const wr = total > 0 ? Math.round(record.wins / total * 100) : 0;
									const isWinning = record.wins > record.losses;
									const isTied = record.wins === record.losses;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "border border-zinc-900 p-3",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-between mb-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[9px] font-black text-white",
													children: record.opponentName || "UNKNOWN OPPONENT"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-[7px] text-zinc-600 mt-0.5",
													children: [
														record.userFighterId.toUpperCase(),
														" vs ",
														record.opponentFighterId.toUpperCase()
													]
												})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-right",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-[9px] font-black",
														style: { color: isWinning ? "#22c55e" : isTied ? "#facc15" : "#ef4444" },
														children: isWinning ? "WINNING" : isTied ? "TIED" : "LOSING"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-[7px] text-zinc-600 mt-0.5",
														children: new Date(record.lastPlayedAt).toLocaleDateString()
													})]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2 mb-2",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-2xl font-black text-green-400",
														children: record.wins
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-zinc-700",
														children: "-"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-2xl font-black text-red-400",
														children: record.losses
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-zinc-700",
														children: "-"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-2xl font-black text-zinc-500",
														children: record.draws
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-[7px] text-zinc-600 ml-1",
														children: "W-L-D"
													})
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "h-1.5 bg-zinc-900 flex overflow-hidden",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "h-full bg-green-500 transition-all",
													style: { width: `${wr}%` }
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "h-full bg-red-500 transition-all",
													style: { width: `${total > 0 ? Math.round(record.losses / total * 100) : 0}%` }
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-[7px] text-zinc-700 mt-1",
												children: [
													wr,
													"% WIN RATE · ",
													total,
													" MATCHES"
												]
											})
										]
									}, i);
								})
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-center py-8 text-zinc-700 text-[9px] tracking-widest border border-zinc-900",
								children: [
									"NO HEAD-TO-HEAD DATA YET",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-zinc-800",
										children: "PLAY RANKED MATCHES TO BUILD RECORDS"
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[8px] tracking-[0.3em] text-zinc-600 mb-2",
									children: "COSMETIC UNLOCK TIMELINE"
								}), cosmeticTimeline.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "space-y-1.5",
									children: cosmeticTimeline.map((entry, i) => {
										const rarityColor = RARITY_COLOR[entry.rarity] ?? "#94a3b8";
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-3 border px-3 py-2",
											style: {
												borderColor: `${rarityColor}30`,
												background: `${rarityColor}06`
											},
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "w-1.5 h-1.5 rounded-full flex-shrink-0",
													style: { background: rarityColor }
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex-1 min-w-0",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-[9px] font-black truncate",
														style: { color: rarityColor },
														children: entry.cosmeticName
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "text-[7px] text-zinc-600 mt-0.5",
														children: [
															entry.cosmeticType,
															" · ",
															entry.unlockSource.toUpperCase(),
															entry.unlockContext && ` · ${entry.unlockContext}`
														]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[6px] text-zinc-700 flex-shrink-0",
													children: new Date(entry.unlockedAt).toLocaleDateString()
												})
											]
										}, i);
									})
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-center py-4 text-zinc-700 text-[9px] tracking-widest border border-zinc-900",
									children: "NO COSMETICS UNLOCKED YET"
								})]
							})
						]
					}),
					activeTab === "mastery" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[8px] tracking-[0.3em] text-zinc-600 mb-3",
							children: "FIGHTER MASTERY LEVELS"
						}), BANNON_ROSTER.slice(0, 8).map((fighter) => {
							const wins = fighterStats.find((f) => f.fighterId === fighter.id)?.wins ?? 0;
							const mastery = getMasteryLevel(wins);
							const fColor = FACTION_COLOR[fighter.factionAlignment];
							const nextLevelWins = mastery < 10 ? mastery * 3 : null;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-zinc-900 p-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between mb-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[10px] font-black",
											style: { color: fColor },
											children: fighter.name.toUpperCase()
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[7px] text-zinc-600",
											children: fighter.fightingStyle.split(".")[0]
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-right",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-xl font-black",
												style: { color: fColor },
												children: ["LV ", mastery]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-[7px] text-zinc-600",
												children: [wins, " WINS"]
											})]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex gap-0.5",
										children: Array.from({ length: 10 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "flex-1 h-2 transition-all",
											style: { background: i < mastery ? fColor : "#27272a" }
										}, i))
									}),
									nextLevelWins !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[7px] text-zinc-700 mt-1",
										children: nextLevelWins - wins > 0 ? `${nextLevelWins - wins} more wins to LV ${mastery + 1}` : "Level up ready!"
									})
								]
							}, fighter.id);
						})]
					}),
					activeTab === "cosmetics" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[8px] tracking-[0.3em] text-zinc-600",
									children: "COSMETICS MARKETPLACE"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-[7px] text-zinc-700 mt-0.5",
									children: [
										allItems.filter((i) => i.purchased).length,
										" / ",
										allItems.length,
										" OWNED"
									]
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "border border-yellow-900 bg-yellow-900/20 px-3 py-1.5 text-right",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[7px] text-yellow-700",
										children: "BRUTAL COINS"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-sm font-black text-yellow-400",
										children: brutalCoins.toLocaleString()
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex gap-1 flex-wrap",
								children: [
									"ALL",
									"OUTFIT",
									"EFFECT",
									"BUNDLE",
									"SEASONAL",
									"UNLOCKED"
								].map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setMarketFilter(f),
									className: "px-2 py-1 text-[7px] tracking-widest border transition-all",
									style: {
										borderColor: marketFilter === f ? "#facc15" : "#27272a",
										color: marketFilter === f ? "#facc15" : "#52525b",
										background: marketFilter === f ? "rgba(250,204,21,0.08)" : "transparent"
									},
									children: f
								}, f))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid grid-cols-2 gap-2",
								children: filteredItems.map((item) => {
									const rarityColor = RARITY_COLOR[item.rarity];
									const rarityGlow = RARITY_GLOW[item.rarity];
									const isOwned = item.purchased;
									item.unlocked && !isOwned && item.price > 0 && item.price;
									const locked = !item.unlocked;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: () => setSelectedItem(selectedItem?.id === item.id ? null : item),
										className: "text-left border p-3 transition-all relative overflow-hidden",
										style: {
											borderColor: selectedItem?.id === item.id ? rarityColor : locked ? "#1c1c1e" : `${rarityColor}40`,
											background: locked ? "transparent" : rarityGlow,
											opacity: locked ? .45 : 1
										},
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "absolute top-0 left-0 right-0 h-0.5",
												style: { background: locked ? "#27272a" : rarityColor }
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-1 mb-1.5",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[6px] tracking-widest font-black px-1 py-0.5",
														style: {
															color: rarityColor,
															background: `${rarityColor}20`
														},
														children: item.rarity
													}),
													item.seasonal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[6px] tracking-widest font-black px-1 py-0.5 text-orange-400 bg-orange-400/10",
														children: item.seasonTag
													}),
													item.type === "BUNDLE" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[6px] tracking-widest font-black px-1 py-0.5 text-green-400 bg-green-400/10",
														children: "BUNDLE"
													})
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[7px] text-zinc-500 mb-0.5",
												children: item.type
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[10px] font-black leading-tight",
												style: { color: locked ? "#52525b" : "#fff" },
												children: item.name
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "mt-2",
												children: isOwned ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[7px] font-black",
													style: { color: rarityColor },
													children: "✓ OWNED"
												}) : locked ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-[7px] text-zinc-700",
													children: ["🔒 ", item.milestoneReq ?? `MASTERY LV ${item.masteryReq}`]
												}) : item.price === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[7px] text-zinc-500",
													children: "FREE UNLOCK"
												}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-[8px] font-black text-yellow-400",
													children: [item.price.toLocaleString(), " BC"]
												})
											})
										]
									}, item.id);
								})
							}),
							selectedItem && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border p-4 mt-2",
								style: {
									borderColor: RARITY_COLOR[selectedItem.rarity],
									background: RARITY_GLOW[selectedItem.rarity]
								},
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-start justify-between mb-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-[7px] tracking-widest mb-1",
											style: { color: RARITY_COLOR[selectedItem.rarity] },
											children: [
												selectedItem.rarity,
												" · ",
												selectedItem.type,
												selectedItem.seasonal && ` · ${selectedItem.seasonTag}`
											]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-sm font-black",
											children: selectedItem.name
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => setSelectedItem(null),
											className: "text-zinc-600 hover:text-zinc-400 text-xs",
											children: "✕"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[8px] text-zinc-400 mb-3",
										children: selectedItem.description
									}),
									selectedItem.bundleItems && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mb-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[7px] text-zinc-600 mb-1",
											children: "INCLUDES:"
										}), selectedItem.bundleItems.map((bi, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-[8px] text-zinc-400",
											children: ["· ", bi]
										}, i))]
									}),
									selectedItem.milestoneReq && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[7px] text-zinc-600 mb-3",
										children: ["REQUIREMENT: ", selectedItem.milestoneReq]
									}),
									!selectedItem.purchased && selectedItem.unlocked && selectedItem.price > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => handlePurchase(selectedItem),
										disabled: brutalCoins < selectedItem.price,
										className: "w-full py-2 text-[9px] font-black tracking-widest border transition-all",
										style: {
											borderColor: brutalCoins >= selectedItem.price ? RARITY_COLOR[selectedItem.rarity] : "#27272a",
											color: brutalCoins >= selectedItem.price ? RARITY_COLOR[selectedItem.rarity] : "#3f3f46",
											background: brutalCoins >= selectedItem.price ? `${RARITY_COLOR[selectedItem.rarity]}15` : "transparent"
										},
										children: brutalCoins >= selectedItem.price ? `PURCHASE — ${selectedItem.price.toLocaleString()} BC` : `INSUFFICIENT COINS (NEED ${(selectedItem.price - brutalCoins).toLocaleString()} MORE)`
									}),
									selectedItem.purchased && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-center text-[9px] font-black py-2",
										style: { color: RARITY_COLOR[selectedItem.rarity] },
										children: "✓ ALREADY OWNED"
									}),
									!selectedItem.unlocked && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-center text-[9px] text-zinc-600 py-2",
										children: "🔒 MILESTONE REQUIRED"
									})
								]
							})
						]
					}),
					activeTab === "season" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between mb-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[8px] tracking-[0.3em] text-zinc-600",
									children: "SEASON ACHIEVEMENTS"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-[8px] text-zinc-500",
									children: [
										earnedCount,
										" / ",
										achievements.length
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-zinc-900 p-4",
								style: { background: `${rankColor}08` },
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[8px] tracking-widest text-zinc-600 mb-2",
										children: "SEASON RANK"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between mb-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-2xl font-black",
											style: { color: rankColor },
											children: rankTier
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-[9px] text-zinc-500",
											children: [rankPoints, " RP"]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex justify-between text-[7px] text-zinc-700 mb-1",
										children: RANK_TIERS.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											style: { color: r.tier === rankTier.toUpperCase() ? rankColor : "#3f3f46" },
											children: r.tier.slice(0, 3)
										}, r.tier))
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "h-1.5 bg-zinc-900",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "h-full transition-all duration-700",
											style: {
												width: `${Math.min(100, rankPoints / 1200 * 100)}%`,
												background: `linear-gradient(90deg, #facc15, ${rankColor})`
											}
										})
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "space-y-2",
								children: achievements.map((a, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-3 border p-3 transition-all",
									style: {
										borderColor: a.earned ? `${a.color}40` : "#27272a",
										background: a.earned ? `${a.color}08` : "transparent",
										opacity: a.earned ? 1 : .5
									},
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "w-2 h-2 rounded-full flex-shrink-0",
											style: { background: a.earned ? a.color : "#3f3f46" }
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[10px] font-black",
												style: { color: a.earned ? "#fff" : "#52525b" },
												children: a.name
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[7px] text-zinc-600 mt-0.5",
												children: a.desc
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[8px] font-black",
											style: { color: a.earned ? a.color : "#3f3f46" },
											children: a.earned ? "✓" : "○"
										})
									]
								}, i))
							})
						]
					}),
					activeTab === "replays" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[8px] tracking-[0.3em] text-zinc-600 mb-3",
							children: "MATCH REPLAYS"
						}), selectedReplay ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReplayScrubber, {
							replay: selectedReplay,
							onClose: () => setSelectedReplay(null)
						}) : replaysLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-center py-8 text-zinc-700 text-[9px] animate-pulse",
							children: "LOADING REPLAYS..."
						}) : replays.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "space-y-2",
							children: replays.map((replay) => {
								const durationSec = (replay.durationMs / 1e3).toFixed(1);
								const date = new Date(replay.createdAt).toLocaleDateString();
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => setSelectedReplay(replay),
									className: "w-full text-left border border-zinc-900 p-3 hover:border-yellow-900 hover:bg-yellow-900/5 transition-all",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-start justify-between gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex-1 min-w-0",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-[9px] font-black text-white truncate",
												children: replay.label
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2 mt-1",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[7px] text-blue-400",
														children: replay.p1Name
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[6px] text-zinc-700",
														children: "vs"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[7px] text-red-400",
														children: replay.p2Name
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "text-[6px] text-zinc-600",
														children: ["· ", replay.stageName]
													})
												]
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-right flex-shrink-0",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-[8px] font-black text-yellow-400",
													children: [durationSec, "s"]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-[6px] text-zinc-600",
													children: [replay.totalFrames, "f"]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[6px] text-zinc-700",
													children: date
												})
											]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-2 flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-[6px] text-zinc-600",
											children: [
												"Crop: F",
												replay.inPoint,
												"–F",
												replay.outPoint,
												" · ",
												replay.speedMultiplier,
												"x"
											]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "ml-auto text-[7px] text-yellow-600 tracking-widest",
											children: "▶ REVIEW"
										})]
									})]
								}, replay.id);
							})
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-center py-8 border border-zinc-900 space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-zinc-700 text-[9px] tracking-widest",
								children: "NO REPLAYS SAVED YET"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-zinc-800 text-[8px]",
								children: "Use the ⏺ REC button in-match and click ☁ SAVE TO CLOUD"
							})]
						})]
					})
				]
			})
		]
	});
}
//#endregion
export { PlayerProfileScreen as default };
