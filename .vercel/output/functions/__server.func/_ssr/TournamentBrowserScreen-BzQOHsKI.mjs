import { a as __toESM } from "../_runtime.mjs";
import { c as require_jsx_runtime, l as require_react } from "../_libs/@react-three/drei+[...].mjs";
import { a as dynamic, u as BANNON_ROSTER } from "./routes-DbIfrPB2.mjs";
import { a as statsService, n as TIER_LABEL, t as TIER_COLOR } from "./statsService-7dhcoGcP.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/TournamentBrowserScreen-BzQOHsKI.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var TournamentBracket = dynamic(() => import("./TournamentBracket-ChZmnajp.mjs"), { ssr: false });
var TIER_ORDER = {
	rookie: 0,
	challenger: 1,
	elite: 2,
	legend: 3
};
var TIER_DESC = {
	rookie: "Entry-level bracket. Perfect for new fighters.",
	challenger: "Mid-tier chaos. Tougher opponents, bigger rewards.",
	elite: "Elite fighters only. Seven rounds of punishment.",
	legend: "The pinnacle. Only legends compete here."
};
function TournamentCard({ tournament, onEnter }) {
	const color = TIER_COLOR[tournament.tier] ?? "#94a3b8";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border p-4 transition-all cursor-pointer group",
		style: {
			borderColor: "#27272a",
			background: "linear-gradient(135deg, #0a0a0a 0%, #111 100%)"
		},
		onMouseEnter: (e) => {
			e.currentTarget.style.borderColor = color;
		},
		onMouseLeave: (e) => {
			e.currentTarget.style.borderColor = "#27272a";
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between mb-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-sm font-black text-white tracking-wider",
						children: tournament.name.toUpperCase()
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[8px] text-zinc-500 mt-1",
						children: tournament.description
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ml-3 shrink-0 border px-2 py-1 text-[8px] font-black tracking-widest",
					style: {
						color,
						borderColor: color,
						background: `${color}15`
					},
					children: TIER_LABEL[tournament.tier] ?? tournament.tier.toUpperCase()
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-4 mb-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-center",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-base font-black text-white",
							children: tournament.maxRounds
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[7px] text-zinc-600",
							children: "ROUNDS"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-center",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-[8px] font-black text-zinc-400",
							children: [
								tournament.entryRankMin,
								"–",
								tournament.entryRankMax
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[7px] text-zinc-600",
							children: "RANK RANGE"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "flex-1" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[7px] text-zinc-600",
							children: "ACTIVE"
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: () => onEnter(tournament),
				className: "w-full border py-2.5 text-[9px] font-black tracking-widest transition-all",
				style: {
					borderColor: color,
					color
				},
				onMouseEnter: (e) => {
					e.currentTarget.style.background = color;
					e.currentTarget.style.color = "#000";
				},
				onMouseLeave: (e) => {
					e.currentTarget.style.background = "transparent";
					e.currentTarget.style.color = color;
				},
				children: "ENTER TOURNAMENT →"
			})
		]
	});
}
function FighterPicker({ selected, onSelect }) {
	const FACTION_COLOR = {
		alliance: "#1d4ed8",
		corporate: "#dc2626",
		chaos: "#7c3aed",
		independent: "#d97706"
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-[8px] tracking-[0.4em] text-zinc-600 mb-3",
			children: "SELECT YOUR FIGHTER"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1",
			children: BANNON_ROSTER.map((f) => {
				const color = FACTION_COLOR[f.factionAlignment];
				const isSelected = selected?.id === f.id;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: () => onSelect(f),
					className: "border p-2.5 text-left transition-all",
					style: {
						borderColor: isSelected ? color : "#27272a",
						background: isSelected ? `${color}20` : "transparent"
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[9px] font-black",
						style: { color: isSelected ? color : "#a1a1aa" },
						children: f.name.toUpperCase()
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[7px] text-zinc-600 mt-0.5 truncate",
						children: f.role.split("/")[0].trim()
					})]
				}, f.id);
			})
		})]
	});
}
function TournamentBrowserScreen({ onBack }) {
	const [tournaments, setTournaments] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [error, setError] = (0, import_react.useState)(null);
	const [tierFilter, setTierFilter] = (0, import_react.useState)("all");
	const [selectedTournament, setSelectedTournament] = (0, import_react.useState)(null);
	const [selectedFighter, setSelectedFighter] = (0, import_react.useState)(null);
	const [phase, setPhase] = (0, import_react.useState)("browse");
	const loadTournaments = (0, import_react.useCallback)(async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await statsService.getTournaments();
			setTournaments(data);
		} catch (e) {
			setError(e?.message ?? "Failed to load tournaments");
		} finally {
			setLoading(false);
		}
	}, []);
	(0, import_react.useEffect)(() => {
		loadTournaments();
	}, [loadTournaments]);
	const filtered = tournaments.filter((t) => tierFilter === "all" || t.tier === tierFilter).sort((a, b) => (TIER_ORDER[a.tier] ?? 0) - (TIER_ORDER[b.tier] ?? 0));
	const handleEnterTournament = (t) => {
		setSelectedTournament(t);
		setPhase("pick_fighter");
	};
	const handleStartBracket = () => {
		if (!selectedFighter) return;
		setPhase("in_bracket");
	};
	if (phase === "in_bracket" && selectedFighter) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TournamentBracket, {
		playerFighter: selectedFighter,
		onExit: () => {
			setPhase("browse");
			setSelectedTournament(null);
			setSelectedFighter(null);
		}
	});
	if (phase === "pick_fighter" && selectedTournament) {
		const color = TIER_COLOR[selectedTournament.tier] ?? "#94a3b8";
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "fixed inset-0 bg-black text-white font-mono overflow-hidden flex flex-col",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute inset-0 pointer-events-none",
					style: { background: `radial-gradient(ellipse at 50% 0%, ${color}18 0%, #000 65%)` }
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative z-10 flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-800/60 shrink-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[8px] tracking-[0.5em] text-zinc-600",
						children: "TOURNAMENT ENTRY"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-xl font-black tracking-widest mt-0.5",
						style: { color },
						children: selectedTournament.name.toUpperCase()
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setPhase("browse"),
						className: "text-[9px] tracking-widest text-zinc-600 hover:text-zinc-300 transition-colors border border-zinc-800 px-3 py-1.5",
						children: "← BACK"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative z-10 flex-1 overflow-y-auto px-5 py-4 space-y-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "border border-zinc-800 p-4",
						style: { background: "linear-gradient(135deg, #0a0a0a 0%, #111 100%)" },
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-center",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-2xl font-black text-white",
										children: selectedTournament.maxRounds
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[7px] text-zinc-600",
										children: "ROUNDS"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex-1",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[8px] text-zinc-400",
										children: TIER_DESC[selectedTournament.tier]
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "border px-2 py-1 text-[8px] font-black tracking-widest",
									style: {
										color,
										borderColor: color
									},
									children: TIER_LABEL[selectedTournament.tier]
								})
							]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "border border-zinc-800 p-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FighterPicker, {
							selected: selectedFighter,
							onSelect: setSelectedFighter
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "relative z-10 px-5 pb-5 pt-3 border-t border-zinc-800/60 shrink-0",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: handleStartBracket,
						disabled: !selectedFighter,
						className: "w-full border-2 py-4 text-sm font-black tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed",
						style: {
							borderColor: selectedFighter ? color : "#27272a",
							color: selectedFighter ? color : "#52525b"
						},
						onMouseEnter: (e) => {
							if (!selectedFighter) return;
							e.currentTarget.style.background = color;
							e.currentTarget.style.color = "#000";
						},
						onMouseLeave: (e) => {
							e.currentTarget.style.background = "transparent";
							e.currentTarget.style.color = selectedFighter ? color : "#52525b";
						},
						children: selectedFighter ? `ENTER WITH ${selectedFighter.name.toUpperCase()} →` : "SELECT A FIGHTER FIRST"
					})
				})
			]
		});
	}
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
					children: "TOURNAMENTS"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: onBack,
					className: "text-[9px] tracking-widest text-zinc-600 hover:text-zinc-300 transition-colors border border-zinc-800 px-3 py-1.5",
					children: "← BACK"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "relative z-10 flex gap-1 px-5 py-3 border-b border-zinc-800/60 overflow-x-auto shrink-0",
				children: [
					{
						id: "all",
						label: "ALL"
					},
					{
						id: "rookie",
						label: "ROOKIE"
					},
					{
						id: "challenger",
						label: "CHALLENGER"
					},
					{
						id: "elite",
						label: "ELITE"
					},
					{
						id: "legend",
						label: "LEGEND"
					}
				].map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => setTierFilter(t.id),
					className: "shrink-0 border px-3 py-1.5 text-[8px] font-black tracking-widest transition-all",
					style: {
						borderColor: tierFilter === t.id ? t.id === "all" ? "#facc15" : TIER_COLOR[t.id] ?? "#facc15" : "#27272a",
						color: tierFilter === t.id ? t.id === "all" ? "#facc15" : TIER_COLOR[t.id] ?? "#facc15" : "#52525b",
						background: tierFilter === t.id ? `${t.id === "all" ? "#facc15" : TIER_COLOR[t.id] ?? "#facc15"}15` : "transparent"
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
						children: "LOADING TOURNAMENTS..."
					})
				}) : error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex items-center justify-center h-40",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[9px] tracking-widest text-red-500",
						children: error
					})
				}) : filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex items-center justify-center h-40",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[9px] tracking-widest text-zinc-600",
						children: "NO TOURNAMENTS AVAILABLE"
					})
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-3",
					children: filtered.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TournamentCard, {
						tournament: t,
						onEnter: handleEnterTournament
					}, t.id))
				})
			})
		]
	});
}
//#endregion
export { TournamentBrowserScreen as default };
