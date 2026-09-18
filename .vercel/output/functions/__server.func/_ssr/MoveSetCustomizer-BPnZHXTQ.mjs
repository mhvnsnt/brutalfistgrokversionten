import { a as __toESM } from "../_runtime.mjs";
import { c as require_jsx_runtime, l as require_react } from "../_libs/@react-three/drei+[...].mjs";
import { d as getAllBannonFighters, f as getBannonFighter } from "./routes-DbIfrPB2.mjs";
import { a as getMoveById, i as getCharacterMoveSet, n as assignMoveToSlot, o as resetAllMoveSlots, r as getAvailableMovesForSlot, s as resetMoveSlot, t as MOVE_SLOT_CONFIG } from "./CharacterMoveSetSystem-D6bJ_Wug.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/MoveSetCustomizer-BPnZHXTQ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var FACTION_COLORS = {
	alliance: "bg-blue-900 text-blue-200 border-blue-700",
	corporate: "bg-red-900 text-red-200 border-red-700",
	chaos: "bg-purple-900 text-purple-200 border-purple-700",
	independent: "bg-yellow-900 text-yellow-200 border-yellow-700"
};
function FactionBadge({ alignment }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: `text-xs px-2 py-0.5 rounded border font-mono uppercase tracking-wider ${FACTION_COLORS[alignment]}`,
		children: {
			alliance: "Alliance",
			corporate: "Corporate",
			chaos: "Chaos",
			independent: "Independent"
		}[alignment]
	});
}
function CharacterCard({ fighter, selected, customized, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		onClick,
		className: `w-full text-left p-3 rounded-lg border transition-all duration-150 ${selected ? "border-yellow-500 bg-gray-800 shadow-lg shadow-yellow-900/30" : "border-gray-700 bg-gray-900 hover:border-gray-500 hover:bg-gray-800"}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between mb-1",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: `font-bold text-sm ${selected ? "text-yellow-400" : "text-white"}`,
				children: fighter.name
			}), customized && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-xs text-green-400 font-mono",
				children: "✦ CUSTOM"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-2 flex-wrap",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FactionBadge, { alignment: fighter.factionAlignment }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-xs text-gray-400 font-mono",
				children: fighter.role.split("/")[0].trim()
			})]
		})]
	});
}
function MoveSlotRow({ slot, label, currentMoveId, defaultMoveId, isCustomized, availableMoves, onAssign, onReset }) {
	const currentMove = currentMoveId ? getMoveById(currentMoveId) : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `flex items-center gap-2 p-2 rounded-lg border ${isCustomized ? "border-green-800 bg-green-950/30" : "border-gray-800 bg-gray-900/50"}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "w-32 shrink-0",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-xs text-gray-400 font-mono uppercase tracking-wide",
					children: label
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex-1 min-w-0",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
					value: currentMoveId ?? "",
					onChange: (e) => onAssign(slot, e.target.value),
					className: "w-full bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1 font-mono focus:outline-none focus:border-yellow-500",
					children: availableMoves.map((move) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
						value: move.id,
						children: [move.displayName, move.inputSequence ? ` [${move.inputSequence}]` : ""]
					}, move.id))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "w-24 shrink-0 text-right",
				children: currentMove && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-xs text-gray-500 font-mono",
					children: currentMove.damage > 0 ? `${currentMove.damage}dmg` : "—"
				})
			}),
			isCustomized && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: () => onReset(slot),
				className: "shrink-0 text-xs text-red-400 hover:text-red-300 font-mono px-1",
				title: "Reset to default",
				children: "↺"
			})
		]
	});
}
function MoveSetCustomizer({ onClose, onConfirm, initialCharacterId }) {
	const fighters = (0, import_react.useMemo)(() => getAllBannonFighters(), []);
	const [selectedId, setSelectedId] = (0, import_react.useState)(initialCharacterId ?? fighters[0]?.id ?? "");
	const [moveSets, setMoveSets] = (0, import_react.useState)(() => {
		const map = /* @__PURE__ */ new Map();
		fighters.forEach((f) => {
			const ms = getCharacterMoveSet(f.id);
			if (ms) map.set(f.id, ms);
		});
		return map;
	});
	const [activeCategory, setActiveCategory] = (0, import_react.useState)("all");
	const selectedFighter = (0, import_react.useMemo)(() => getBannonFighter(selectedId), [selectedId]);
	const selectedMoveSet = moveSets.get(selectedId);
	const handleAssign = (0, import_react.useCallback)((slot, moveId) => {
		const updated = assignMoveToSlot(selectedId, slot, moveId);
		if (updated) setMoveSets((prev) => new Map(prev).set(selectedId, updated));
	}, [selectedId]);
	const handleReset = (0, import_react.useCallback)((slot) => {
		const updated = resetMoveSlot(selectedId, slot);
		if (updated) setMoveSets((prev) => new Map(prev).set(selectedId, updated));
	}, [selectedId]);
	const handleResetAll = (0, import_react.useCallback)(() => {
		const updated = resetAllMoveSlots(selectedId);
		if (updated) setMoveSets((prev) => new Map(prev).set(selectedId, updated));
	}, [selectedId]);
	const handleConfirm = (0, import_react.useCallback)(() => {
		if (selectedMoveSet && onConfirm) onConfirm(selectedId, selectedMoveSet);
	}, [
		selectedId,
		selectedMoveSet,
		onConfirm
	]);
	const categories = (0, import_react.useMemo)(() => {
		return ["all", ...Array.from(new Set(MOVE_SLOT_CONFIG.map((c) => c.category)))];
	}, []);
	const filteredSlots = (0, import_react.useMemo)(() => {
		if (activeCategory === "all") return MOVE_SLOT_CONFIG;
		return MOVE_SLOT_CONFIG.filter((c) => c.category === activeCategory);
	}, [activeCategory]);
	if (!selectedFighter || !selectedMoveSet) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-6xl h-full max-h-[90vh] bg-gray-950 border border-gray-700 rounded-xl flex flex-col overflow-hidden shadow-2xl",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900 shrink-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-xl font-bold text-yellow-400 font-mono tracking-wider uppercase",
					children: "Move Set Customizer"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-gray-500 font-mono mt-0.5",
					children: "Assign moves from the full catalog to each character slot"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-3",
					children: [
						selectedMoveSet.isCustomized && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: handleResetAll,
							className: "px-4 py-2 text-sm font-mono text-red-400 border border-red-800 rounded hover:bg-red-900/30 transition-colors",
							children: "Reset All"
						}),
						onConfirm && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: handleConfirm,
							className: "px-4 py-2 text-sm font-mono text-black bg-yellow-400 rounded hover:bg-yellow-300 transition-colors font-bold",
							children: "Confirm"
						}),
						onClose && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: onClose,
							className: "px-4 py-2 text-sm font-mono text-gray-400 border border-gray-700 rounded hover:bg-gray-800 transition-colors",
							children: "Close"
						})
					]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-1 overflow-hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-56 shrink-0 border-r border-gray-800 bg-gray-950 overflow-y-auto p-3 flex flex-col gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-gray-600 font-mono uppercase tracking-wider px-1 mb-1",
						children: [
							"Roster (",
							fighters.length,
							")"
						]
					}), fighters.map((fighter) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CharacterCard, {
						fighter,
						selected: fighter.id === selectedId,
						customized: moveSets.get(fighter.id)?.isCustomized ?? false,
						onClick: () => setSelectedId(fighter.id)
					}, fighter.id))]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 flex flex-col overflow-hidden",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "px-6 py-4 border-b border-gray-800 bg-gray-900/50 shrink-0",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start justify-between gap-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex-1",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-3 mb-2",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
													className: "text-lg font-bold text-white",
													children: selectedFighter.name
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FactionBadge, { alignment: selectedFighter.factionAlignment }),
												selectedMoveSet.isCustomized && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-xs text-green-400 font-mono",
													children: [
														"✦ ",
														selectedMoveSet.customizedSlots.length,
														" slot",
														selectedMoveSet.customizedSlots.length !== 1 ? "s" : "",
														" customized"
													]
												})
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "text-xs text-gray-400 leading-relaxed max-w-2xl",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-yellow-600 font-mono",
												children: "Style: "
											}), selectedFighter.fightingStyle]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-xs text-gray-500 leading-relaxed max-w-2xl mt-1",
											children: selectedFighter.personality
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "shrink-0 grid grid-cols-2 gap-x-6 gap-y-1 text-xs font-mono",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-gray-500",
											children: "HP"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-white",
											children: selectedFighter.hp.toLocaleString()
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-gray-500",
											children: "Speed"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-white",
											children: selectedFighter.speed
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-gray-500",
											children: "Strength"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-white",
											children: selectedFighter.strength
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-gray-500",
											children: "Poise"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-white",
											children: selectedFighter.poise
										})
									]
								})]
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "px-6 py-2 border-b border-gray-800 bg-gray-950 shrink-0 flex gap-2 overflow-x-auto",
							children: categories.map((cat) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setActiveCategory(cat),
								className: `px-3 py-1 text-xs font-mono rounded uppercase tracking-wide whitespace-nowrap transition-colors ${activeCategory === cat ? "bg-yellow-500 text-black font-bold" : "text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-white"}`,
								children: cat
							}, cat))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-2",
							children: filteredSlots.map((slotConfig) => {
								const currentMoveId = selectedMoveSet[slotConfig.slot];
								const defaultMoveId = selectedFighter.defaultMoveSet[slotConfig.slot];
								const isCustomized = selectedMoveSet.customizedSlots.includes(slotConfig.slot);
								const availableMoves = getAvailableMovesForSlot(slotConfig.slot);
								return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MoveSlotRow, {
									slot: slotConfig.slot,
									label: slotConfig.label,
									currentMoveId,
									defaultMoveId,
									isCustomized,
									availableMoves,
									onAssign: handleAssign,
									onReset: handleReset
								}, slotConfig.slot);
							})
						})
					]
				})]
			})]
		})
	});
}
//#endregion
export { MoveSetCustomizer as default };
