import { a as __toESM } from "../_runtime.mjs";
import { Dt as Vector3, c as require_jsx_runtime, l as require_react } from "../_libs/@react-three/drei+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/PostMatchScreen-BJu3znyt.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* LocomotionSystem — Tekken-style locomotion architecture
*
* Two completely separate movement systems:
*
* 1. PROGRAMMATIC LOCOMOTION (walking/dashing):
*    - Code manually pushes the root position along X/Z axes
*    - Walk/dash animations are purely cosmetic — they loop while code moves the capsule
*    - Root bone stays at floor zero; position is driven by velocity math
*
* 2. ROOT MOTION (lunging attacks):
*    - Code stops pushing the position
*    - The GLB animation clip contains forward displacement on the root bone
*    - Engine reads the root bone delta each frame and applies it to the collision capsule
*    - Prevents skating/sliding during complex strikes like Paul's Death Fist
*
* Root Bone Convention:
*    - Root sits at absolute zero on the floor between the character's feet
*    - Pelvis/Hips is the center of gravity — all weight-shift animations drive from here
*    - Distance between P1 and P2 is calculated from their root positions
*/
/**
* Root motion profiles for attacks that contain forward displacement.
* These are used when the GLB clip does NOT have root motion baked in —
* we synthesize the displacement from the move's frame data.
*
* Values are in world units per second of the active window.
*/
var ATTACK_ROOT_MOTION_PROFILES = {
	lightAttack: {
		forwardDisplacement: 0,
		hasRootMotion: false
	},
	heavyAttack: {
		forwardDisplacement: .35,
		hasRootMotion: true
	},
	CommandThrow: {
		forwardDisplacement: .5,
		hasRootMotion: true
	},
	power_surge: {
		forwardDisplacement: .8,
		hasRootMotion: true
	},
	quick_combo: {
		forwardDisplacement: .2,
		hasRootMotion: true
	}
};
var WALK_SPEED = 2.2;
var DASH_SPEED = 4.5;
var BACKDASH_SPEED = 3.8;
var SIDESTEP_SPEED = 1.8;
var WALK_ACCEL = 12;
var WALK_DECEL = 18;
var ROOT_MOTION_THRESHOLD = .005;
var STAGE_X_MIN = -4.5;
var STAGE_X_MAX = 4.5;
var STAGE_Z_MIN = -2;
var STAGE_Z_MAX = 2;
/**
* LocomotionSystem — manages a single fighter's position using the
* Tekken dual-system architecture.
*/
var LocomotionSystem = class {
	state;
	rootMotionAccumX = 0;
	rootMotionAccumZ = 0;
	prevRootBonePos = new Vector3();
	rootBoneInitialized = false;
	attackRootMotionActive = false;
	attackRootMotionProfile = null;
	attackRootMotionElapsed = 0;
	attackRootMotionDuration = 0;
	jumpY = 0;
	jumpV = 0;
	jumpArmed = true;
	constructor(initialX, initialZ, facing) {
		this.state = {
			rootX: initialX,
			rootZ: initialZ,
			velocityX: 0,
			velocityZ: 0,
			mode: "programmatic",
			facing
		};
	}
	get position() {
		return {
			x: this.state.rootX,
			z: this.state.rootZ
		};
	}
	get airborneY() {
		return this.jumpY;
	}
	beginJump() {
		if (this.jumpArmed && this.jumpY <= .02) {
			this.jumpV = 5.8;
			this.jumpArmed = false;
		}
	}
	/** Re-arm after the jump button is released and the fighter is on the floor. */
	armJump() {
		if (this.jumpY <= .02 && this.jumpV === 0) this.jumpArmed = true;
	}
	get velocity() {
		return {
			x: this.state.velocityX,
			z: this.state.velocityZ
		};
	}
	get mode() {
		return this.state.mode;
	}
	beginRootMotionAttack(attackKey, activeDuration) {
		const profile = ATTACK_ROOT_MOTION_PROFILES[attackKey];
		if (!profile || !profile.hasRootMotion) return;
		this.state.mode = "rootMotion";
		this.state.velocityX = 0;
		this.state.velocityZ = 0;
		this.attackRootMotionActive = true;
		this.attackRootMotionProfile = profile;
		this.attackRootMotionElapsed = 0;
		this.attackRootMotionDuration = activeDuration;
		console.log(`[Locomotion] 🥊 Root motion attack: "${attackKey}" displacement=${profile.forwardDisplacement}u over ${activeDuration.toFixed(3)}s`);
	}
	endRootMotionAttack() {
		this.state.mode = "programmatic";
		this.attackRootMotionActive = false;
		this.attackRootMotionProfile = null;
		this.attackRootMotionElapsed = 0;
		this.rootBoneInitialized = false;
	}
	updateFromRootBone(rootBoneWorldPos) {
		if (!this.rootBoneInitialized) {
			this.prevRootBonePos.copy(rootBoneWorldPos);
			this.rootBoneInitialized = true;
			return {
				dx: 0,
				dz: 0,
				hasMotion: false
			};
		}
		const dx = rootBoneWorldPos.x - this.prevRootBonePos.x;
		const dz = rootBoneWorldPos.z - this.prevRootBonePos.z;
		this.prevRootBonePos.copy(rootBoneWorldPos);
		const hasMotion = Math.abs(dx) > ROOT_MOTION_THRESHOLD || Math.abs(dz) > ROOT_MOTION_THRESHOLD;
		if (hasMotion && this.state.mode === "rootMotion") {
			this.state.rootX = Math.max(STAGE_X_MIN, Math.min(STAGE_X_MAX, this.state.rootX + dx));
			this.state.rootZ = Math.max(STAGE_Z_MIN, Math.min(STAGE_Z_MAX, this.state.rootZ + dz));
		}
		return {
			dx,
			dz,
			hasMotion
		};
	}
	update(forwardInput, strafeInput, dt, isDashing, isBackdashing) {
		if (this.state.mode === "rootMotion") {
			this.updateRootMotion(dt);
			return;
		}
		this.updateProgrammatic(forwardInput, strafeInput, dt, isDashing, isBackdashing);
	}
	updateProgrammatic(forwardInput, strafeInput, dt, isDashing, isBackdashing) {
		const maxSpeed = isDashing ? DASH_SPEED : isBackdashing ? BACKDASH_SPEED : WALK_SPEED;
		const strafeMax = SIDESTEP_SPEED;
		const targetVX = Math.abs(forwardInput) > .1 ? Math.sign(forwardInput) * maxSpeed * this.state.facing : 0;
		const targetVZ = Math.abs(strafeInput) > .1 ? Math.sign(strafeInput) * strafeMax : 0;
		this.state.velocityX = this.smoothVel(this.state.velocityX, targetVX, dt);
		this.state.velocityZ = this.smoothVel(this.state.velocityZ, targetVZ, dt);
		this.state.rootX = Math.max(STAGE_X_MIN, Math.min(STAGE_X_MAX, this.state.rootX + this.state.velocityX * dt));
		this.state.rootZ = Math.max(STAGE_Z_MIN, Math.min(STAGE_Z_MAX, this.state.rootZ + this.state.velocityZ * dt));
		if (this.jumpY > 0 || this.jumpV > 0) {
			this.jumpV -= 22 * dt;
			this.jumpY += this.jumpV * dt;
			if (this.jumpY <= 0) {
				this.jumpY = 0;
				this.jumpV = 0;
			}
		}
	}
	updateRootMotion(dt) {
		if (!this.attackRootMotionActive || !this.attackRootMotionProfile) return;
		this.attackRootMotionElapsed += dt;
		const progress = Math.min(1, this.attackRootMotionElapsed / Math.max(.001, this.attackRootMotionDuration));
		const bellCurve = Math.sin(progress * Math.PI);
		const frameDisplacement = this.attackRootMotionProfile.forwardDisplacement * bellCurve * dt / Math.max(.001, this.attackRootMotionDuration);
		this.state.rootX = Math.max(STAGE_X_MIN, Math.min(STAGE_X_MAX, this.state.rootX + frameDisplacement * this.state.facing));
		if (progress >= 1) this.endRootMotionAttack();
	}
	smoothVel(current, target, dt) {
		if (Math.abs(target) < .01) {
			const decel = WALK_DECEL * dt;
			if (current > 0) return Math.max(0, current - decel);
			if (current < 0) return Math.min(0, current + decel);
			return 0;
		}
		const accel = WALK_ACCEL * dt;
		if (current < target) return Math.min(target, current + accel);
		if (current > target) return Math.max(target, current - accel);
		return current;
	}
	setPosition(x, z) {
		this.state.rootX = x;
		this.state.rootZ = z;
		this.state.velocityX = 0;
		this.state.velocityZ = 0;
		this.endRootMotionAttack();
	}
	setFacing(facing) {
		this.state.facing = facing;
	}
	halt() {
		this.state.velocityX = 0;
		this.state.velocityZ = 0;
		this.endRootMotionAttack();
	}
	applyPushback(amount) {
		const pushX = -this.state.facing * amount;
		this.state.rootX = Math.max(STAGE_X_MIN, Math.min(STAGE_X_MAX, this.state.rootX + pushX));
	}
	clampX(x) {
		this.state.rootX = Math.max(STAGE_X_MIN, Math.min(STAGE_X_MAX, x));
		if (x <= STAGE_X_MIN && this.state.velocityX < 0 || x >= STAGE_X_MAX && this.state.velocityX > 0) this.state.velocityX = 0;
	}
};
var CHARACTER_BLOOM = {
	bannon: {
		primary: "#facc15",
		secondary: "#f97316",
		glow: "0 0 60px #facc1566, 0 0 120px #f9731633"
	},
	maime: {
		primary: "#a855f7",
		secondary: "#ec4899",
		glow: "0 0 60px #a855f766, 0 0 120px #ec489933"
	},
	kaz: {
		primary: "#3b82f6",
		secondary: "#06b6d4",
		glow: "0 0 60px #3b82f666, 0 0 120px #06b6d433"
	},
	rex: {
		primary: "#ef4444",
		secondary: "#f97316",
		glow: "0 0 60px #ef444466, 0 0 120px #f9731633"
	},
	ghost: {
		primary: "#22d3ee",
		secondary: "#818cf8",
		glow: "0 0 60px #22d3ee66, 0 0 120px #818cf833"
	},
	viper: {
		primary: "#22c55e",
		secondary: "#84cc16",
		glow: "0 0 60px #22c55e66, 0 0 120px #84cc1633"
	},
	titan: {
		primary: "#f59e0b",
		secondary: "#ef4444",
		glow: "0 0 60px #f59e0b66, 0 0 120px #ef444433"
	},
	shadow: {
		primary: "#8b5cf6",
		secondary: "#6366f1",
		glow: "0 0 60px #8b5cf666, 0 0 120px #6366f133"
	},
	default: {
		primary: "#facc15",
		secondary: "#ffffff",
		glow: "0 0 60px #facc1566, 0 0 120px #ffffff22"
	}
};
function getBloom(fighter) {
	return CHARACTER_BLOOM[fighter.id] ?? CHARACTER_BLOOM.default;
}
function Scanlines() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "absolute inset-0 pointer-events-none z-10 opacity-[0.07]",
		style: { backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.8) 2px, rgba(0,0,0,0.8) 4px)" }
	});
}
function BloomRing({ color, glow }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "absolute inset-0 rounded-full pointer-events-none",
		style: {
			background: `radial-gradient(ellipse at center, ${color}22 0%, ${color}08 50%, transparent 75%)`,
			boxShadow: glow,
			animation: "pulse 2s ease-in-out infinite"
		}
	});
}
function ConditionBadge({ condition }) {
	const s = {
		KO: {
			color: "#ef4444",
			bg: "rgba(239,68,68,0.12)",
			border: "#ef444466",
			label: "K.O."
		},
		TIMEOUT: {
			color: "#f59e0b",
			bg: "rgba(245,158,11,0.12)",
			border: "#f59e0b66",
			label: "TIME OUT"
		},
		PERFECT: {
			color: "#22c55e",
			bg: "rgba(34,197,94,0.12)",
			border: "#22c55e66",
			label: "PERFECT!"
		}
	}[condition];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "px-4 py-1 text-sm font-black tracking-[0.4em] border",
		style: {
			color: s.color,
			background: s.bg,
			borderColor: s.border,
			textShadow: `0 0 16px ${s.color}`
		},
		children: s.label
	});
}
function RoundRow({ result, p1Fighter, p2Fighter, p1Color, p2Color }) {
	const p1Pct = Math.max(0, Math.min(100, result.p1HealthRemaining / p1Fighter.hp * 100));
	const p2Pct = Math.max(0, Math.min(100, result.p2HealthRemaining / p2Fighter.hp * 100));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-3 py-2 border-b border-zinc-800/60",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "w-16 shrink-0 text-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[8px] text-zinc-500 tracking-widest",
					children: "RND"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-lg font-black text-zinc-300",
					children: result.round
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 flex flex-col gap-0.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex justify-between text-[7px] text-zinc-500",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						style: { color: p1Color },
						children: p1Fighter.name.toUpperCase()
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: Math.ceil(result.p1HealthRemaining) })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-2 bg-zinc-900 border border-zinc-700/40 overflow-hidden",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-full transition-all duration-700",
						style: {
							width: `${p1Pct}%`,
							background: result.winner === "p1" ? p1Color : "#52525b",
							boxShadow: result.winner === "p1" ? `0 0 6px ${p1Color}88` : "none"
						}
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "shrink-0 w-20 text-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[8px] font-black tracking-widest",
					style: { color: {
						KO: "#ef4444",
						TIMEOUT: "#f59e0b",
						PERFECT: "#22c55e"
					}[result.condition] ?? "#facc15" },
					children: result.condition
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-[7px] text-zinc-600",
					children: [result.durationSeconds, "s"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 flex flex-col gap-0.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex justify-between text-[7px] text-zinc-500",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: Math.ceil(result.p2HealthRemaining) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						style: { color: p2Color },
						children: p2Fighter.name.toUpperCase()
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-2 bg-zinc-900 border border-zinc-700/40 overflow-hidden",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-full ml-auto transition-all duration-700",
						style: {
							width: `${p2Pct}%`,
							background: result.winner === "p2" ? p2Color : "#52525b",
							boxShadow: result.winner === "p2" ? `0 0 6px ${p2Color}88` : "none"
						}
					})
				})]
			})
		]
	});
}
function ActionButton({ label, icon, color, onClick, primary }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		onClick,
		className: "flex flex-col items-center gap-1.5 px-4 py-3 border transition-all duration-150 active:scale-95 hover:scale-105 min-w-[80px]",
		style: {
			borderColor: primary ? color : `${color}55`,
			background: primary ? `${color}18` : "rgba(0,0,0,0.6)",
			color: primary ? color : "#a1a1aa",
			boxShadow: primary ? `0 0 20px ${color}33` : "none"
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-xl",
			children: icon
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-[8px] font-black tracking-[0.3em]",
			children: label
		})]
	});
}
function PostMatchScreen({ p1Fighter, p2Fighter, winner, condition, roundResults, p1Color, p2Color, onRematch, onCharacterSelect, onWatchReplay, onExit }) {
	const [visible, setVisible] = (0, import_react.useState)(false);
	const [showRounds, setShowRounds] = (0, import_react.useState)(false);
	const [showButtons, setShowButtons] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const t1 = setTimeout(() => setVisible(true), 100);
		const t2 = setTimeout(() => setShowRounds(true), 600);
		const t3 = setTimeout(() => setShowButtons(true), 1100);
		return () => {
			clearTimeout(t1);
			clearTimeout(t2);
			clearTimeout(t3);
		};
	}, []);
	const winnerFighter = winner === "p1" ? p1Fighter : winner === "p2" ? p2Fighter : null;
	const loserFighter = winner === "p1" ? p2Fighter : winner === "p2" ? p1Fighter : null;
	const bloom = winnerFighter ? getBloom(winnerFighter) : CHARACTER_BLOOM.default;
	const winnerColor = winner === "p1" ? p1Color : winner === "p2" ? p2Color : "#facc15";
	const totalRounds = roundResults.length;
	const p1Wins = roundResults.filter((r) => r.winner === "p1").length;
	const p2Wins = roundResults.filter((r) => r.winner === "p2").length;
	const totalDuration = roundResults.reduce((s, r) => s + r.durationSeconds, 0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 bg-black text-white font-mono overflow-hidden flex flex-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scanlines, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute top-0 left-0 right-0 h-[8%] bg-black z-20" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute bottom-0 left-0 right-0 h-[8%] bg-black z-20" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 pointer-events-none",
				style: {
					background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${bloom.primary}0d 0%, transparent 70%)`,
					transition: "opacity 1s ease",
					opacity: visible ? 1 : 0
				}
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-10 flex flex-col items-center justify-start h-full pt-[10%] pb-[10%] px-4 overflow-y-auto gap-4",
				style: {
					transition: "opacity 0.5s ease, transform 0.5s ease",
					opacity: visible ? 1 : 0,
					transform: visible ? "translateY(0)" : "translateY(20px)"
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative flex flex-col items-center gap-2 py-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BloomRing, {
							color: bloom.primary,
							glow: bloom.glow
						}), winner === "draw" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[9px] tracking-[0.6em] text-zinc-400",
								children: "MATCH RESULT"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-5xl font-black tracking-widest",
								style: {
									color: "#f59e0b",
									textShadow: "0 0 40px #f59e0b, 0 0 80px #f59e0b44"
								},
								children: "DRAW"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConditionBadge, { condition })
						] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[9px] tracking-[0.6em] text-zinc-400",
								children: "WINNER"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-4xl md:text-5xl font-black tracking-widest text-center leading-tight",
								style: {
									color: winnerColor,
									textShadow: bloom.glow.replace(/,/g, ",")
								},
								children: winnerFighter?.name.toUpperCase()
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[9px] tracking-[0.4em] text-zinc-400 mt-0.5",
								children: "WINS"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConditionBadge, { condition }),
							loserFighter && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-[8px] tracking-[0.3em] text-zinc-600 mt-1",
								children: ["defeated ", loserFighter.name.toUpperCase()]
							})
						] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-6 text-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[7px] text-zinc-500 tracking-widest",
								children: "ROUNDS"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-lg font-black text-zinc-300",
								children: totalRounds
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[7px] tracking-widest",
								style: { color: p1Color },
								children: "P1 WINS"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-lg font-black",
								style: { color: p1Color },
								children: p1Wins
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[7px] tracking-widest",
								style: { color: p2Color },
								children: "P2 WINS"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-lg font-black",
								style: { color: p2Color },
								children: p2Wins
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[7px] text-zinc-500 tracking-widest",
								children: "TIME"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-lg font-black text-zinc-300",
								children: [totalDuration, "s"]
							})] })
						]
					}),
					showRounds && roundResults.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "w-full max-w-lg border border-zinc-800/60 bg-zinc-950/80 p-3",
						style: {
							transition: "opacity 0.4s ease, transform 0.4s ease",
							opacity: showRounds ? 1 : 0,
							transform: showRounds ? "translateY(0)" : "translateY(10px)"
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[8px] tracking-[0.4em] text-zinc-500 mb-2 text-center",
							children: "ROUND SUMMARY"
						}), roundResults.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RoundRow, {
							result: r,
							p1Fighter,
							p2Fighter,
							p1Color,
							p2Color
						}, r.round))]
					}),
					showButtons && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-3 justify-center mt-2",
						style: {
							transition: "opacity 0.4s ease",
							opacity: showButtons ? 1 : 0
						},
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionButton, {
								label: "REMATCH",
								icon: "⚔️",
								color: winnerColor,
								onClick: onRematch,
								primary: true
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionButton, {
								label: "FIGHTERS",
								icon: "👤",
								color: "#60a5fa",
								onClick: onCharacterSelect
							}),
							onWatchReplay && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionButton, {
								label: "REPLAY",
								icon: "▶",
								color: "#a78bfa",
								onClick: onWatchReplay
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionButton, {
								label: "EXIT",
								icon: "✕",
								color: "#71717a",
								onClick: onExit
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute left-0 right-0 h-px z-20 pointer-events-none",
				style: {
					top: "8%",
					background: `linear-gradient(90deg, transparent, ${winnerColor}66, transparent)`
				}
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute left-0 right-0 h-px z-20 pointer-events-none",
				style: {
					bottom: "8%",
					background: `linear-gradient(90deg, transparent, ${winnerColor}66, transparent)`
				}
			})
		]
	});
}
//#endregion
export { PostMatchScreen as i, CHARACTER_BLOOM as n, LocomotionSystem as r, ATTACK_ROOT_MOTION_PROFILES as t };
