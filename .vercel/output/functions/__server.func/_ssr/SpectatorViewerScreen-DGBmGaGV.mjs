import { a as __toESM } from "../_runtime.mjs";
import { c as require_jsx_runtime, l as require_react } from "../_libs/@react-three/drei+[...].mjs";
import { l as useAuth } from "./routes-DbIfrPB2.mjs";
import { t as createClient } from "./client-CENlhkXr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/SpectatorViewerScreen-DGBmGaGV.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var CHAT_COLORS = [
	"#facc15",
	"#22d3ee",
	"#a855f7",
	"#f97316",
	"#22c55e",
	"#ef4444",
	"#3b82f6",
	"#ec4899"
];
function getUserColor(userId) {
	let hash = 0;
	for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
	return CHAT_COLORS[Math.abs(hash) % CHAT_COLORS.length];
}
function buildMockMatch() {
	return {
		id: "mock-live-001",
		p1Name: "SHADOW_WOLF",
		p2Name: "IRON_FIST_99",
		p1Fighter: "Bannon",
		p2Fighter: "Maime",
		p1Health: 780,
		p2Health: 620,
		p1MaxHealth: 1e3,
		p2MaxHealth: 1e3,
		stage: "Urban Night",
		round: 2,
		timer: 67,
		status: "live",
		startedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
}
var MOCK_CHAT_SEED = [
	{
		id: "1",
		userId: "u1",
		username: "BrutalFan",
		text: "P1 is dominating this round!",
		timestamp: Date.now() - 8e3,
		color: "#facc15"
	},
	{
		id: "2",
		userId: "u2",
		username: "FightWatcher",
		text: "That combo was insane 🔥",
		timestamp: Date.now() - 6e3,
		color: "#22d3ee"
	},
	{
		id: "3",
		userId: "u3",
		username: "IronFistFan",
		text: "P2 needs to guard more",
		timestamp: Date.now() - 4e3,
		color: "#a855f7"
	},
	{
		id: "4",
		userId: "u4",
		username: "ArenaObserver",
		text: "Round 2 is heating up!",
		timestamp: Date.now() - 2e3,
		color: "#f97316"
	}
];
function SpectatorViewerScreen({ onBack }) {
	const { user } = useAuth();
	const [match, setMatch] = (0, import_react.useState)(buildMockMatch());
	const [chatMessages, setChatMessages] = (0, import_react.useState)(MOCK_CHAT_SEED);
	const [chatInput, setChatInput] = (0, import_react.useState)("");
	const [replayClips, setReplayClips] = (0, import_react.useState)([]);
	const [activeTab, setActiveTab] = (0, import_react.useState)("live");
	const [isExporting, setIsExporting] = (0, import_react.useState)(false);
	const [exportedClip, setExportedClip] = (0, import_react.useState)(null);
	const chatEndRef = (0, import_react.useRef)(null);
	const supabase = createClient();
	(0, import_react.useEffect)(() => {
		const interval = setInterval(() => {
			setMatch((prev) => {
				if (prev.status === "ended") return prev;
				const newTimer = Math.max(0, prev.timer - 1);
				const p1Dmg = Math.random() < .15 ? Math.floor(Math.random() * 40 + 10) : 0;
				const p2Dmg = Math.random() < .18 ? Math.floor(Math.random() * 35 + 8) : 0;
				const newP1 = Math.max(0, prev.p1Health - p2Dmg);
				const newP2 = Math.max(0, prev.p2Health - p1Dmg);
				if (p1Dmg > 30 || p2Dmg > 30) {
					const clip = {
						id: `clip-${Date.now()}`,
						matchId: prev.id,
						label: p1Dmg > p2Dmg ? `${prev.p1Name} HEAVY HIT` : `${prev.p2Name} COUNTER`,
						timestamp: Date.now(),
						p1Health: newP1,
						p2Health: newP2,
						event: p1Dmg > p2Dmg ? "heavy_hit" : "counter"
					};
					setReplayClips((clips) => [clip, ...clips.slice(0, 9)]);
				}
				if (p1Dmg > 35) {
					const msg = {
						id: `auto-${Date.now()}`,
						userId: "system",
						username: "ARENA",
						text: `💥 ${prev.p1Name} lands a heavy hit! -${p1Dmg} HP`,
						timestamp: Date.now(),
						color: "#ef4444"
					};
					setChatMessages((msgs) => [...msgs.slice(-49), msg]);
				}
				if (p2Dmg > 35) {
					const msg = {
						id: `auto-${Date.now()}-2`,
						userId: "system",
						username: "ARENA",
						text: `⚡ ${prev.p2Name} counter attack! -${p2Dmg} HP`,
						timestamp: Date.now(),
						color: "#22d3ee"
					};
					setChatMessages((msgs) => [...msgs.slice(-49), msg]);
				}
				const ended = newP1 <= 0 || newP2 <= 0 || newTimer <= 0;
				return {
					...prev,
					p1Health: newP1,
					p2Health: newP2,
					timer: newTimer,
					status: ended ? "ended" : "live",
					winner: ended ? newP1 <= 0 ? prev.p2Name : newP2 <= 0 ? prev.p1Name : newP1 > newP2 ? prev.p1Name : prev.p2Name : void 0
				};
			});
		}, 1e3);
		return () => clearInterval(interval);
	}, []);
	(0, import_react.useEffect)(() => {
		chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [chatMessages]);
	(0, import_react.useEffect)(() => {
		const channel = supabase.channel("spectator-chat").on("broadcast", { event: "chat_message" }, (payload) => {
			const msg = payload.payload;
			setChatMessages((prev) => [...prev.slice(-49), msg]);
		}).subscribe();
		return () => {
			supabase.removeChannel(channel);
		};
	}, [supabase]);
	const sendChat = (0, import_react.useCallback)(() => {
		if (!chatInput.trim()) return;
		const username = user?.email?.split("@")[0]?.toUpperCase() ?? "SPECTATOR";
		const msg = {
			id: `${Date.now()}-${Math.random()}`,
			userId: user?.id ?? "anon",
			username,
			text: chatInput.trim(),
			timestamp: Date.now(),
			color: getUserColor(user?.id ?? "anon")
		};
		setChatMessages((prev) => [...prev.slice(-49), msg]);
		supabase.channel("spectator-chat").send({
			type: "broadcast",
			event: "chat_message",
			payload: msg
		});
		setChatInput("");
	}, [
		chatInput,
		user,
		supabase
	]);
	const exportClip = (0, import_react.useCallback)((clip) => {
		setIsExporting(true);
		setTimeout(() => {
			const clipData = JSON.stringify({
				matchId: clip.matchId,
				label: clip.label,
				timestamp: new Date(clip.timestamp).toISOString(),
				p1Health: clip.p1Health,
				p2Health: clip.p2Health,
				event: clip.event,
				exportedBy: user?.email ?? "anonymous"
			}, null, 2);
			const blob = new Blob([clipData], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			setExportedClip(url);
			setIsExporting(false);
		}, 1200);
	}, [user]);
	const p1Pct = Math.max(0, match.p1Health / match.p1MaxHealth * 100);
	const p2Pct = Math.max(0, match.p2Health / match.p2MaxHealth * 100);
	const getBarColor = (pct) => pct > 50 ? "#22c55e" : pct > 25 ? "#f97316" : "#ef4444";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 bg-black text-white flex flex-col font-mono overflow-hidden",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 pointer-events-none opacity-[0.03]",
				style: { backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.5) 3px, rgba(255,255,255,0.5) 4px)" }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10 flex-shrink-0 border-b border-zinc-900 px-4 pt-4 pb-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between mb-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: onBack,
							className: "text-[8px] tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors",
							children: "← BACK"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[8px] tracking-[0.4em] text-red-400",
								children: match.status === "live" ? "LIVE" : "MATCH ENDED"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[7px] tracking-widest text-zinc-600",
							children: match.stage.toUpperCase()
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between mb-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[9px] font-black text-cyan-400",
										children: match.p1Name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[7px] text-zinc-500",
										children: match.p1Fighter
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "h-3 bg-zinc-900 border border-zinc-800",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "h-full transition-all duration-300",
										style: {
											width: `${p1Pct}%`,
											background: getBarColor(p1Pct)
										}
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-[6px] text-zinc-600 mt-0.5",
									children: [match.p1Health, " HP"]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col items-center shrink-0 w-16",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-[7px] text-zinc-600",
									children: ["RND ", match.round]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xl font-black tabular-nums",
									style: { color: match.timer <= 10 ? "#ef4444" : "#facc15" },
									children: String(match.timer).padStart(2, "0")
								}),
								match.status === "ended" && match.winner && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-[6px] font-black text-yellow-400 text-center leading-tight mt-0.5",
									children: [
										match.winner,
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
										"WINS"
									]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between mb-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[7px] text-zinc-500",
										children: match.p2Fighter
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[9px] font-black text-purple-400",
										children: match.p2Name
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "h-3 bg-zinc-900 border border-zinc-800",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "h-full transition-all duration-300 ml-auto",
										style: {
											width: `${p2Pct}%`,
											background: getBarColor(p2Pct)
										}
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-[6px] text-zinc-600 mt-0.5 text-right",
									children: [match.p2Health, " HP"]
								})
							]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10 flex-shrink-0 mx-4 mt-3 border border-zinc-800 overflow-hidden",
				style: {
					height: "140px",
					background: "linear-gradient(135deg, #0a0a14 0%, #0d0010 50%, #0a0a0a 100%)"
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute inset-0 flex items-center justify-center",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative w-full h-full",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute bottom-8 left-0 right-0 h-px bg-zinc-800" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "absolute bottom-8 left-[28%] flex flex-col items-center",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "w-6 h-12 rounded-t-full border border-cyan-400/40",
										style: { background: "linear-gradient(180deg, #22d3ee22, #22d3ee08)" }
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[5px] text-cyan-400 mt-1 tracking-widest",
										children: match.p1Name.slice(0, 6)
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "absolute bottom-8 right-[28%] flex flex-col items-center",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "w-6 h-12 rounded-t-full border border-purple-400/40",
										style: { background: "linear-gradient(180deg, #a855f722, #a855f708)" }
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[5px] text-purple-400 mt-1 tracking-widest",
										children: match.p2Name.slice(0, 6)
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "absolute bottom-6 left-1/4 right-1/4 h-1 opacity-30",
									style: {
										background: "linear-gradient(90deg, #22d3ee, transparent, #a855f7)",
										filter: "blur(4px)"
									}
								})
							]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute top-2 left-2 text-[6px] tracking-widest text-zinc-600 border border-zinc-800 px-1.5 py-0.5 bg-black/60",
						children: "OBSERVER CAM · READ-ONLY"
					}),
					match.status === "live" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "absolute top-2 right-2 flex items-center gap-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1 h-1 rounded-full bg-red-500 animate-pulse" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[6px] text-red-400 tracking-widest",
							children: "LIVE"
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "relative z-10 flex-shrink-0 flex border-b border-zinc-900 mx-4 mt-2",
				children: ["live", "clips"].map((tab) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => setActiveTab(tab),
					className: "flex-1 py-2 text-[7px] tracking-[0.3em] font-black transition-all",
					style: {
						color: activeTab === tab ? "#fff" : "#52525b",
						borderBottom: activeTab === tab ? "2px solid #facc15" : "2px solid transparent"
					},
					children: tab === "live" ? "💬 LIVE CHAT" : "🎬 REPLAY CLIPS"
				}, tab))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10 flex-1 overflow-hidden flex flex-col mx-4 mb-4",
				children: [activeTab === "live" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 overflow-y-auto py-2 space-y-1.5",
					children: [chatMessages.map((msg) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[7px] font-black flex-shrink-0 mt-0.5",
							style: { color: msg.color },
							children: msg.username
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[8px] text-zinc-300 flex-1 leading-relaxed",
							children: msg.text
						})]
					}, msg.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { ref: chatEndRef })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-shrink-0 flex gap-2 pt-2 border-t border-zinc-900",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "text",
						value: chatInput,
						onChange: (e) => setChatInput(e.target.value),
						onKeyDown: (e) => {
							if (e.key === "Enter") sendChat();
						},
						placeholder: user ? "TYPE A MESSAGE..." : "SIGN IN TO CHAT",
						disabled: !user,
						maxLength: 120,
						className: "flex-1 bg-zinc-900 border border-zinc-800 px-3 py-2 text-[8px] text-white placeholder-zinc-700 focus:outline-none focus:border-zinc-600 disabled:opacity-40"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: sendChat,
						disabled: !user || !chatInput.trim(),
						className: "px-3 py-2 text-[7px] font-black tracking-widest border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-all disabled:opacity-30",
						children: "SEND"
					})]
				})] }), activeTab === "clips" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 overflow-y-auto py-2 space-y-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-[7px] text-zinc-600 tracking-widest mb-2",
							children: [replayClips.length, " CLIPS RECORDED · TAP TO EXPORT"]
						}),
						replayClips.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-center py-8 text-zinc-700 text-[9px] tracking-widest border border-zinc-900",
							children: [
								"NO CLIPS YET",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-zinc-800",
									children: "CLIPS ARE RECORDED ON SIGNIFICANT HITS"
								})
							]
						}),
						replayClips.map((clip) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border border-zinc-800 p-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between mb-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[9px] font-black text-white",
									children: clip.label
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-[7px] text-zinc-600 mt-0.5",
									children: [
										new Date(clip.timestamp).toLocaleTimeString(),
										" · P1: ",
										clip.p1Health,
										"HP · P2: ",
										clip.p2Health,
										"HP"
									]
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => exportClip(clip),
									disabled: isExporting,
									className: "px-2 py-1 text-[7px] font-black tracking-widest border border-zinc-700 text-zinc-400 hover:text-yellow-400 hover:border-yellow-700 transition-all disabled:opacity-40",
									children: isExporting ? "..." : "⬇ EXPORT"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex-1 h-1 bg-zinc-900",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "h-full bg-cyan-500 transition-all",
										style: { width: `${clip.p1Health / match.p1MaxHealth * 100}%` }
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex-1 h-1 bg-zinc-900",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "h-full bg-purple-500 transition-all ml-auto",
										style: { width: `${clip.p2Health / match.p2MaxHealth * 100}%` }
									})
								})]
							})]
						}, clip.id)),
						exportedClip && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border border-green-900 p-3 bg-green-900/10",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[8px] font-black text-green-400 mb-1",
								children: "✓ CLIP EXPORTED"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								href: exportedClip,
								download: "brutal-fist-clip.json",
								className: "text-[7px] text-green-600 hover:text-green-400 underline",
								onClick: () => setTimeout(() => setExportedClip(null), 2e3),
								children: "DOWNLOAD CLIP DATA"
							})]
						})
					]
				})]
			})
		]
	});
}
//#endregion
export { SpectatorViewerScreen as default };
