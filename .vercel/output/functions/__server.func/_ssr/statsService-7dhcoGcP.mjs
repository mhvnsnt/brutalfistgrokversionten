import { t as createClient } from "./client-CENlhkXr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/statsService-7dhcoGcP.js
function isSchemaError(error) {
	if (!error) return false;
	if (error.code && typeof error.code === "string") {
		const cls = error.code.substring(0, 2);
		if (cls === "42" || cls === "08") return true;
		if (cls === "23") return false;
	}
	if (error.message) return /relation.*does not exist|column.*does not exist|function.*does not exist|syntax error|type.*does not exist/i.test(error.message);
	return false;
}
var statsService = {
	async getTournaments() {
		const supabase = createClient();
		try {
			const { data, error } = await supabase.from("tournaments").select("*").eq("is_active", true).order("created_at", { ascending: true });
			if (error) {
				if (isSchemaError(error)) throw error;
				return [];
			}
			return (data || []).map((r) => ({
				id: r.id,
				name: r.name,
				description: r.description,
				tier: r.tier,
				maxRounds: r.max_rounds,
				entryRankMin: r.entry_rank_min,
				entryRankMax: r.entry_rank_max,
				isActive: r.is_active,
				createdAt: r.created_at
			}));
		} catch (e) {
			if (isSchemaError(e)) throw e;
			return [];
		}
	},
	async createSession(params) {
		const supabase = createClient();
		try {
			const { data, error } = await supabase.from("tournament_sessions").insert({
				user_id: params.userId,
				tournament_id: params.tournamentId,
				fighter_id: params.fighterId,
				fighter_name: params.fighterName
			}).select("id").single();
			if (error) {
				if (isSchemaError(error)) throw error;
				return null;
			}
			return data?.id ?? null;
		} catch (e) {
			if (isSchemaError(e)) throw e;
			return null;
		}
	},
	async completeSession(params) {
		const supabase = createClient();
		try {
			const { error } = await supabase.from("tournament_sessions").update({
				wins: params.wins,
				losses: params.losses,
				draws: params.draws,
				rounds_played: params.roundsPlayed,
				is_champion: params.isChampion,
				is_eliminated: params.isEliminated,
				rank_points_earned: params.rankPointsEarned,
				completed_at: (/* @__PURE__ */ new Date()).toISOString()
			}).eq("id", params.sessionId);
			if (error && isSchemaError(error)) throw error;
		} catch (e) {
			if (isSchemaError(e)) throw e;
		}
	},
	async getUserSessions(userId) {
		const supabase = createClient();
		try {
			const { data, error } = await supabase.from("tournament_sessions").select("*, tournaments(name, tier)").eq("user_id", userId).order("started_at", { ascending: false });
			if (error) {
				if (isSchemaError(error)) throw error;
				return [];
			}
			return (data || []).map((r) => ({
				id: r.id,
				userId: r.user_id,
				tournamentId: r.tournament_id,
				tournamentName: r.tournaments?.name,
				tournamentTier: r.tournaments?.tier,
				fighterId: r.fighter_id,
				fighterName: r.fighter_name,
				wins: r.wins,
				losses: r.losses,
				draws: r.draws,
				roundsPlayed: r.rounds_played,
				isChampion: r.is_champion,
				isEliminated: r.is_eliminated,
				rankPointsEarned: r.rank_points_earned,
				startedAt: r.started_at,
				completedAt: r.completed_at
			}));
		} catch (e) {
			if (isSchemaError(e)) throw e;
			return [];
		}
	},
	async saveMatchResult(params) {
		const supabase = createClient();
		try {
			const { error } = await supabase.from("match_results").insert({
				session_id: params.sessionId,
				user_id: params.userId,
				round_number: params.roundNumber,
				opponent_fighter_id: params.opponentFighterId,
				opponent_fighter_name: params.opponentFighterName,
				outcome: params.outcome
			});
			if (error && isSchemaError(error)) throw error;
		} catch (e) {
			if (isSchemaError(e)) throw e;
		}
	},
	async getUserMatchHistory(userId, limit = 50) {
		const supabase = createClient();
		try {
			const { data, error } = await supabase.from("match_results").select("*").eq("user_id", userId).order("played_at", { ascending: false }).limit(limit);
			if (error) {
				if (isSchemaError(error)) throw error;
				return [];
			}
			return (data || []).map((r) => ({
				id: r.id,
				sessionId: r.session_id,
				userId: r.user_id,
				roundNumber: r.round_number,
				opponentFighterId: r.opponent_fighter_id,
				opponentFighterName: r.opponent_fighter_name,
				outcome: r.outcome,
				playedAt: r.played_at
			}));
		} catch (e) {
			if (isSchemaError(e)) throw e;
			return [];
		}
	},
	async upsertFighterStats(params) {
		const supabase = createClient();
		try {
			const { error } = await supabase.rpc("upsert_fighter_stats", {
				p_user_id: params.userId,
				p_fighter_id: params.fighterId,
				p_fighter_name: params.fighterName,
				p_wins: params.wins,
				p_losses: params.losses,
				p_draws: params.draws,
				p_tournament_entered: params.tournamentEntered,
				p_tournament_won: params.tournamentWon,
				p_streak: params.streak
			});
			if (error && isSchemaError(error)) throw error;
		} catch (e) {
			if (isSchemaError(e)) throw e;
		}
	},
	async getFighterStats(userId) {
		const supabase = createClient();
		try {
			const { data, error } = await supabase.from("fighter_stats").select("*").eq("user_id", userId).order("total_matches", { ascending: false });
			if (error) {
				if (isSchemaError(error)) throw error;
				return [];
			}
			return (data || []).map((r) => ({
				id: r.id,
				userId: r.user_id,
				fighterId: r.fighter_id,
				fighterName: r.fighter_name,
				totalWins: r.total_wins,
				totalLosses: r.total_losses,
				totalDraws: r.total_draws,
				totalMatches: r.total_matches,
				tournamentsEntered: r.tournaments_entered,
				tournamentsWon: r.tournaments_won,
				bestStreak: r.best_streak,
				updatedAt: r.updated_at
			}));
		} catch (e) {
			if (isSchemaError(e)) throw e;
			return [];
		}
	},
	async getCurrentRank(userId) {
		const supabase = createClient();
		try {
			const { data, error } = await supabase.from("player_ranks").select("*").eq("user_id", userId).order("recorded_at", { ascending: false }).limit(1).maybeSingle();
			if (error) {
				if (isSchemaError(error)) throw error;
				return null;
			}
			if (!data) return null;
			return {
				id: data.id,
				userId: data.user_id,
				rankPoints: data.rank_points,
				rankTier: data.rank_tier,
				recordedAt: data.recorded_at
			};
		} catch (e) {
			if (isSchemaError(e)) throw e;
			return null;
		}
	},
	async getRankHistory(userId) {
		const supabase = createClient();
		try {
			const { data, error } = await supabase.from("player_ranks").select("*").eq("user_id", userId).order("recorded_at", { ascending: true });
			if (error) {
				if (isSchemaError(error)) throw error;
				return [];
			}
			return (data || []).map((r) => ({
				id: r.id,
				userId: r.user_id,
				rankPoints: r.rank_points,
				rankTier: r.rank_tier,
				recordedAt: r.recorded_at
			}));
		} catch (e) {
			if (isSchemaError(e)) throw e;
			return [];
		}
	},
	async recordRank(userId, rankPoints, rankTier) {
		const supabase = createClient();
		try {
			const { error } = await supabase.from("player_ranks").insert({
				user_id: userId,
				rank_points: rankPoints,
				rank_tier: rankTier
			});
			if (error && isSchemaError(error)) throw error;
		} catch (e) {
			if (isSchemaError(e)) throw e;
		}
	}
};
function calcRankPoints(wins, losses, isChampion) {
	return wins * 100 - losses * 30 + (isChampion ? 500 : 0);
}
function getRankTier(points) {
	if (points >= 5e3) return "legend";
	if (points >= 2e3) return "elite";
	if (points >= 500) return "challenger";
	return "rookie";
}
var TIER_COLOR = {
	rookie: "#94a3b8",
	challenger: "#f59e0b",
	elite: "#ef4444",
	legend: "#facc15"
};
var TIER_LABEL = {
	rookie: "ROOKIE",
	challenger: "CHALLENGER",
	elite: "ELITE",
	legend: "LEGEND"
};
//#endregion
export { statsService as a, getRankTier as i, TIER_LABEL as n, calcRankPoints as r, TIER_COLOR as t };
