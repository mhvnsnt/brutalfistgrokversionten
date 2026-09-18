import { a as __toESM } from "../_runtime.mjs";
import { c as require_jsx_runtime, l as require_react } from "../_libs/@react-three/drei+[...].mjs";
import { a as dynamic, u as BANNON_ROSTER } from "./routes-DbIfrPB2.mjs";
import { t as DEFAULT_DEBUG_SETTINGS } from "./DebugOverlay-xyOpLM1i.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/PracticeArenaScreen-hrkurRU9.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** Schwarzerblitz clip name aliases */
var SBW_ALIASES = {
	"SBW_idle": "idle",
	"SBW_stance": "idle",
	"SBW_neutral": "idle",
	"SBW_walk_fwd": "walkForward",
	"SBW_walk_forward": "walkForward",
	"SBW_walk_back": "walkBackward",
	"SBW_walk_bwd": "walkBackward",
	"SBW_strafe_left": "strafeLeft",
	"SBW_strafe_right": "strafeRight",
	"SBW_sidestep_left": "sidestepLeft",
	"SBW_sidestep_right": "sidestepRight",
	"SBW_backdash": "Backdashing",
	"SBW_crouch": "crouch",
	"SBW_crouching": "crouch",
	"SBW_guard": "guard",
	"SBW_block": "guard",
	"SBW_guard_low": "guardLow",
	"SBW_lightAttack": "lightAttack",
	"SBW_jab": "lightAttack",
	"SBW_punch_light": "lightAttack",
	"SBW_lp": "lightAttack",
	"SBW_heavyAttack": "heavyAttack",
	"SBW_cross": "heavyAttack",
	"SBW_punch_heavy": "heavyAttack",
	"SBW_kick": "heavyAttack",
	"SBW_high_kick": "heavyAttack",
	"SBW_low_kick": "crouchLightAttack",
	"SBW_crouch_punch": "crouchLightAttack",
	"SBW_crouch_kick": "crouchHeavyAttack",
	"SBW_throw": "CommandThrow",
	"SBW_grab": "CommandThrow",
	"SBW_hit": "hit",
	"SBW_hit_reaction": "hit",
	"SBW_hit_low": "hitLow",
	"SBW_hit_high": "hitHigh",
	"SBW_knockdown": "knockdown",
	"SBW_wakeup": "wake",
	"SBW_techroll": "WakeupTechRoll",
	"SBW_backrise": "WakeupBackrise",
	"SBW_quickstand": "WakeupQuickStand",
	"SBW_victory": "victory",
	"SBW_defeat": "defeat",
	"SBW_taunt": "taunt"
};
/** Tekken-style clip name aliases (Tekken 3 Recompiled + Tekken 8 naming) */
var TEKKEN_ALIASES = {
	"T_idle": "idle",
	"T_stance": "idle",
	"T_walk_fwd": "walkForward",
	"T_walk_back": "walkBackward",
	"T_sidestep_left": "sidestepLeft",
	"T_sidestep_right": "sidestepRight",
	"T_ssl": "sidestepLeft",
	"T_ssr": "sidestepRight",
	"T_backdash": "Backdashing",
	"T_crouch": "crouch",
	"T_crouching": "crouch",
	"T_guard": "guard",
	"T_block": "guard",
	"T_1": "lightAttack",
	"T_jab": "lightAttack",
	"T_lp": "lightAttack",
	"T_2": "heavyAttack",
	"T_cross": "heavyAttack",
	"T_rp": "heavyAttack",
	"T_3": "heavyAttack",
	"T_low_kick": "crouchLightAttack",
	"T_lk": "heavyAttack",
	"T_4": "heavyAttack",
	"T_high_kick": "heavyAttack",
	"T_rk": "heavyAttack",
	"T_1_2": "lightAttack",
	"T_2_3": "heatBurst",
	"T_1_3": "CommandThrow",
	"T_2_4": "CommandThrow",
	"T_df_1_2": "rageArt",
	"T_hit": "hit",
	"T_hitstun": "hit",
	"T_hit_low": "hitLow",
	"T_hit_high": "hitHigh",
	"T_knockdown": "knockdown",
	"T_wakeup": "wake",
	"T_techroll": "WakeupTechRoll",
	"T_backrise": "WakeupBackrise",
	"T_quickstand": "WakeupQuickStand",
	"T_victory": "victory",
	"T_defeat": "defeat",
	"T_taunt": "taunt",
	"T_intro": "intro"
};
/** Bannon native clip name aliases */
var BANNON_ALIASES = {
	"bf_idle": "idle",
	"bf_stance": "idle",
	"bf_walk_fwd": "walkForward",
	"bf_walk_back": "walkBackward",
	"bf_strafe_left": "strafeLeft",
	"bf_strafe_right": "strafeRight",
	"bf_backdash": "Backdashing",
	"bf_crouch": "crouch",
	"bf_guard": "guard",
	"bf_block": "guard",
	"bf_jab": "lightAttack",
	"bf_chop": "lightAttack",
	"bf_cross": "heavyAttack",
	"bf_elbow": "heavyAttack",
	"bf_uppercut": "heavyAttack",
	"bf_low_kick": "crouchLightAttack",
	"bf_mid_kick": "heavyAttack",
	"bf_high_kick": "heavyAttack",
	"bf_spinning_kick": "heavyAttack",
	"bf_grab": "CommandThrow",
	"bf_throw": "CommandThrow",
	"bf_beastMode": "CommandThrow",
	"bf_hit_reaction": "hit",
	"bf_knockdown": "knockdown",
	"bf_hard_knockdown": "knockdown",
	"bf_wakeup": "wake",
	"bf_wakeup_kick": "wake",
	"bf_victory": "victory",
	"bf_taunt": "taunt"
};
/** Mixamo standard animation names */
var MIXAMO_ALIASES = {
	"Idle": "idle",
	"Standing Idle": "idle",
	"Combat Idle": "idle",
	"Walking": "walkForward",
	"Walking Forward": "walkForward",
	"Walking Backward": "walkBackward",
	"Strafe Left": "strafeLeft",
	"Strafe Right": "strafeRight",
	"Running": "run",
	"Sprint": "run",
	"Crouching": "crouch",
	"Crouch Idle": "crouch",
	"Blocking": "guard",
	"Jab": "lightAttack",
	"Punching": "lightAttack",
	"Punching Left": "lightAttack",
	"Punching Right": "lightAttack",
	"Jab Punch": "lightAttack",
	"Cross": "heavyAttack",
	"Hook": "heavyAttack",
	"Uppercut": "heavyAttack",
	"Kicking": "heavyAttack",
	"Kicking Left": "heavyAttack",
	"Kicking Right": "heavyAttack",
	"Kicking Forward": "heavyAttack",
	"Roundhouse Kick": "heavyAttack",
	"Spinning Kick": "heavyAttack",
	"Jump Attack": "jumpAttack",
	"Air Attack": "jumpAttack",
	"Getting Hit": "hit",
	"Hit Impact": "hit",
	"Falling Back": "knockdown",
	"Falling Forward": "knockdown",
	"Knocked Down": "knockdown",
	"Getting Up": "wake",
	"Get Up From Ground": "wake",
	"Victory": "victory",
	"Victory Pose": "victory",
	"Defeat": "defeat",
	"Taunt": "taunt"
};
/** Generic / fallback aliases */
var GENERIC_ALIASES = {
	"idle": "idle",
	"walk": "walkForward",
	"walkForward": "walkForward",
	"walkBackward": "walkBackward",
	"strafeLeft": "strafeLeft",
	"strafeRight": "strafeRight",
	"sidestepLeft": "sidestepLeft",
	"sidestepRight": "sidestepRight",
	"crouch": "crouch",
	"guard": "guard",
	"block": "guard",
	"lightAttack": "lightAttack",
	"light": "lightAttack",
	"punch": "lightAttack",
	"jab": "lightAttack",
	"heavyAttack": "heavyAttack",
	"heavy": "heavyAttack",
	"kick": "heavyAttack",
	"cross": "heavyAttack",
	"hook": "heavyAttack",
	"uppercut": "heavyAttack",
	"crouchLightAttack": "crouchLightAttack",
	"crouchHeavyAttack": "crouchHeavyAttack",
	"jumpAttack": "jumpAttack",
	"runAttack": "runAttack",
	"commandThrow": "CommandThrow",
	"grab": "CommandThrow",
	"throw": "CommandThrow",
	"hit": "hit",
	"hitstun": "hit",
	"hitLow": "hitLow",
	"hitHigh": "hitHigh",
	"knockdown": "knockdown",
	"down": "knockdown",
	"wakeup": "wake",
	"wake": "wake",
	"getup": "wake",
	"techRoll": "WakeupTechRoll",
	"backrise": "WakeupBackrise",
	"quickStand": "WakeupQuickStand",
	"backdash": "Backdashing",
	"victory": "victory",
	"win": "victory",
	"defeat": "defeat",
	"lose": "defeat",
	"taunt": "taunt",
	"intro": "intro",
	"heatBurst": "heatBurst",
	"rageArt": "rageArt",
	"powerCrush": "powerCrush"
};
var DEFAULT_FRAME_DATA = {
	idle: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 0,
		totalFrames: 60,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: 1
	},
	walkForward: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 0,
		totalFrames: 30,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .5
	},
	walkBackward: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 0,
		totalFrames: 30,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .5
	},
	strafeLeft: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 0,
		totalFrames: 20,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .33
	},
	strafeRight: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 0,
		totalFrames: 20,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .33
	},
	sidestepLeft: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 0,
		totalFrames: 15,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .25
	},
	sidestepRight: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 0,
		totalFrames: 15,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .25
	},
	crouch: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 0,
		totalFrames: 15,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .25
	},
	crouchWalk: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 0,
		totalFrames: 20,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .33
	},
	guard: {
		startupFrames: 3,
		activeFrames: 0,
		recoveryFrames: 5,
		totalFrames: 20,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .33
	},
	guardLow: {
		startupFrames: 3,
		activeFrames: 0,
		recoveryFrames: 5,
		totalFrames: 20,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .33
	},
	lightAttack: {
		startupFrames: 8,
		activeFrames: 6,
		recoveryFrames: 12,
		totalFrames: 26,
		hitboxStartFrame: 8,
		hitboxEndFrame: 14,
		damage: 80,
		isSpecial: false,
		durationSeconds: .43
	},
	heavyAttack: {
		startupFrames: 12,
		activeFrames: 8,
		recoveryFrames: 23,
		totalFrames: 43,
		hitboxStartFrame: 12,
		hitboxEndFrame: 20,
		damage: 150,
		isSpecial: false,
		durationSeconds: .72
	},
	lightKick: {
		startupFrames: 9,
		activeFrames: 7,
		recoveryFrames: 16,
		totalFrames: 32,
		hitboxStartFrame: 9,
		hitboxEndFrame: 16,
		damage: 90,
		isSpecial: false,
		durationSeconds: .53
	},
	heavyKick: {
		startupFrames: 13,
		activeFrames: 9,
		recoveryFrames: 26,
		totalFrames: 48,
		hitboxStartFrame: 13,
		hitboxEndFrame: 22,
		damage: 170,
		isSpecial: false,
		durationSeconds: .8
	},
	jump: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 0,
		totalFrames: 33,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .55
	},
	jumpForward: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 0,
		totalFrames: 33,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .55
	},
	jumpBack: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 0,
		totalFrames: 33,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .55
	},
	crouchLightAttack: {
		startupFrames: 6,
		activeFrames: 4,
		recoveryFrames: 10,
		totalFrames: 20,
		hitboxStartFrame: 6,
		hitboxEndFrame: 10,
		damage: 60,
		isSpecial: false,
		durationSeconds: .33,
		isLow: true
	},
	crouchHeavyAttack: {
		startupFrames: 10,
		activeFrames: 6,
		recoveryFrames: 18,
		totalFrames: 34,
		hitboxStartFrame: 10,
		hitboxEndFrame: 16,
		damage: 120,
		isSpecial: false,
		durationSeconds: .57,
		isLow: true
	},
	jumpAttack: {
		startupFrames: 10,
		activeFrames: 8,
		recoveryFrames: 15,
		totalFrames: 33,
		hitboxStartFrame: 10,
		hitboxEndFrame: 18,
		damage: 130,
		isSpecial: false,
		durationSeconds: .55
	},
	runAttack: {
		startupFrames: 8,
		activeFrames: 6,
		recoveryFrames: 20,
		totalFrames: 34,
		hitboxStartFrame: 8,
		hitboxEndFrame: 14,
		damage: 140,
		isSpecial: false,
		durationSeconds: .57
	},
	hit: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 15,
		totalFrames: 15,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .25
	},
	hitLow: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 12,
		totalFrames: 12,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .2
	},
	hitHigh: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 18,
		totalFrames: 18,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .3
	},
	knockdown: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 60,
		totalFrames: 60,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: 1
	},
	wake: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 30,
		totalFrames: 30,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .5
	},
	walk: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 0,
		totalFrames: 30,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .5
	},
	run: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 0,
		totalFrames: 20,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .33
	},
	dash: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 0,
		totalFrames: 15,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .25
	},
	dashForward: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 0,
		totalFrames: 15,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .25
	},
	Walking: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 0,
		totalFrames: 30,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .5
	},
	Backdashing: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 0,
		totalFrames: 17,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .28
	},
	Guard: {
		startupFrames: 3,
		activeFrames: 0,
		recoveryFrames: 5,
		totalFrames: 20,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .33
	},
	Knockdown: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 60,
		totalFrames: 60,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: 1
	},
	WakeupTechRoll: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 27,
		totalFrames: 27,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .45
	},
	WakeupBackrise: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 33,
		totalFrames: 33,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .55
	},
	WakeupQuickStand: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 18,
		totalFrames: 18,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .3
	},
	HitStun: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 15,
		totalFrames: 15,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .25
	},
	Stunned: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 20,
		totalFrames: 20,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .33
	},
	Crumple: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 60,
		totalFrames: 60,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: 1
	},
	CommandThrow: {
		startupFrames: 6,
		activeFrames: 4,
		recoveryFrames: 33,
		totalFrames: 43,
		hitboxStartFrame: 6,
		hitboxEndFrame: 10,
		damage: 220,
		isSpecial: false,
		durationSeconds: .72,
		isThrow: true
	},
	ThrowWhiff: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 30,
		totalFrames: 30,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .5
	},
	Startup: {
		startupFrames: 8,
		activeFrames: 6,
		recoveryFrames: 12,
		totalFrames: 26,
		hitboxStartFrame: 8,
		hitboxEndFrame: 14,
		damage: 80,
		isSpecial: false,
		durationSeconds: .43
	},
	Active: {
		startupFrames: 8,
		activeFrames: 6,
		recoveryFrames: 12,
		totalFrames: 26,
		hitboxStartFrame: 8,
		hitboxEndFrame: 14,
		damage: 80,
		isSpecial: false,
		durationSeconds: .43
	},
	Blockstun: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 10,
		totalFrames: 10,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .17
	},
	Hitstun: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 15,
		totalFrames: 15,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: .25
	},
	heatBurst: {
		startupFrames: 9,
		activeFrames: 12,
		recoveryFrames: 24,
		totalFrames: 45,
		hitboxStartFrame: 9,
		hitboxEndFrame: 21,
		damage: 120,
		isSpecial: true,
		durationSeconds: .75
	},
	rageArt: {
		startupFrames: 15,
		activeFrames: 18,
		recoveryFrames: 36,
		totalFrames: 69,
		hitboxStartFrame: 15,
		hitboxEndFrame: 33,
		damage: 350,
		isSpecial: true,
		durationSeconds: 1.15
	},
	powerCrush: {
		startupFrames: 12,
		activeFrames: 10,
		recoveryFrames: 28,
		totalFrames: 50,
		hitboxStartFrame: 12,
		hitboxEndFrame: 22,
		damage: 180,
		isSpecial: true,
		durationSeconds: .83
	},
	victory: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 0,
		totalFrames: 120,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: 2
	},
	defeat: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 0,
		totalFrames: 120,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: 2
	},
	taunt: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 0,
		totalFrames: 90,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: 1.5
	},
	intro: {
		startupFrames: 0,
		activeFrames: 0,
		recoveryFrames: 0,
		totalFrames: 90,
		hitboxStartFrame: 0,
		hitboxEndFrame: 0,
		damage: 0,
		isSpecial: false,
		durationSeconds: 1.5
	}
};
function resolveClipAlias(clipName) {
	if (SBW_ALIASES[clipName]) return {
		motionState: SBW_ALIASES[clipName],
		source: "schwarzerblitz"
	};
	if (TEKKEN_ALIASES[clipName]) return {
		motionState: TEKKEN_ALIASES[clipName],
		source: "tekken"
	};
	if (BANNON_ALIASES[clipName]) return {
		motionState: BANNON_ALIASES[clipName],
		source: "bannon"
	};
	if (MIXAMO_ALIASES[clipName]) return {
		motionState: MIXAMO_ALIASES[clipName],
		source: "mixamo"
	};
	if (GENERIC_ALIASES[clipName]) return {
		motionState: GENERIC_ALIASES[clipName],
		source: "generic"
	};
	const lower = clipName.toLowerCase();
	if (lower.includes("idle") || lower.includes("stance") || lower.includes("neutral")) return {
		motionState: "idle",
		source: "generic"
	};
	if (lower.includes("walk") && (lower.includes("fwd") || lower.includes("forward"))) return {
		motionState: "walkForward",
		source: "generic"
	};
	if (lower.includes("walk") && (lower.includes("back") || lower.includes("bwd"))) return {
		motionState: "walkBackward",
		source: "generic"
	};
	if (lower.includes("strafe") && lower.includes("left")) return {
		motionState: "strafeLeft",
		source: "generic"
	};
	if (lower.includes("strafe") && lower.includes("right")) return {
		motionState: "strafeRight",
		source: "generic"
	};
	if (lower.includes("sidestep") && lower.includes("left")) return {
		motionState: "sidestepLeft",
		source: "generic"
	};
	if (lower.includes("sidestep") && lower.includes("right")) return {
		motionState: "sidestepRight",
		source: "generic"
	};
	if (lower.includes("backdash") || lower.includes("backstep")) return {
		motionState: "Backdashing",
		source: "generic"
	};
	if (lower.includes("crouch") || lower.includes("duck")) return {
		motionState: "crouch",
		source: "generic"
	};
	if (lower.includes("guard") || lower.includes("block")) return {
		motionState: "guard",
		source: "generic"
	};
	if (lower.includes("crouch") && (lower.includes("punch") || lower.includes("jab"))) return {
		motionState: "crouchLightAttack",
		source: "generic"
	};
	if (lower.includes("crouch") && lower.includes("kick")) return {
		motionState: "crouchHeavyAttack",
		source: "generic"
	};
	if (lower.includes("jump") && lower.includes("attack")) return {
		motionState: "jumpAttack",
		source: "generic"
	};
	if (lower.includes("run") && lower.includes("attack")) return {
		motionState: "runAttack",
		source: "generic"
	};
	if (lower.includes("light") || lower.includes("jab") || lower.includes("punch")) return {
		motionState: "lightAttack",
		source: "generic"
	};
	if (lower.includes("heavy") || lower.includes("cross") || lower.includes("kick") || lower.includes("hook") || lower.includes("uppercut")) return {
		motionState: "heavyAttack",
		source: "generic"
	};
	if (lower.includes("heat") && lower.includes("burst")) return {
		motionState: "heatBurst",
		source: "generic"
	};
	if (lower.includes("rage") && lower.includes("art")) return {
		motionState: "rageArt",
		source: "generic"
	};
	if (lower.includes("power") && lower.includes("crush")) return {
		motionState: "powerCrush",
		source: "generic"
	};
	if (lower.includes("throw") || lower.includes("grab") || lower.includes("grapple")) return {
		motionState: "CommandThrow",
		source: "generic"
	};
	if (lower.includes("hit") || lower.includes("stun") || lower.includes("flinch")) return {
		motionState: "hit",
		source: "generic"
	};
	if (lower.includes("knock") || lower.includes("down") || lower.includes("fall")) return {
		motionState: "knockdown",
		source: "generic"
	};
	if (lower.includes("wake") || lower.includes("getup") || lower.includes("rise")) return {
		motionState: "wake",
		source: "generic"
	};
	if (lower.includes("techroll") || lower.includes("tech_roll")) return {
		motionState: "WakeupTechRoll",
		source: "generic"
	};
	if (lower.includes("backrise") || lower.includes("back_rise")) return {
		motionState: "WakeupBackrise",
		source: "generic"
	};
	if (lower.includes("quickstand") || lower.includes("quick_stand")) return {
		motionState: "WakeupQuickStand",
		source: "generic"
	};
	if (lower.includes("victory") || lower.includes("win")) return {
		motionState: "victory",
		source: "generic"
	};
	if (lower.includes("defeat") || lower.includes("lose")) return {
		motionState: "defeat",
		source: "generic"
	};
	if (lower.includes("taunt")) return {
		motionState: "taunt",
		source: "generic"
	};
	if (lower.includes("intro") || lower.includes("entrance")) return {
		motionState: "intro",
		source: "generic"
	};
	return null;
}
/**
* Build a move library entry from a clip name and fighter ID.
* Normalizes the clip to a FighterMotionState and attaches frame-data metadata.
*/
function buildMoveLibraryEntry(fighterId, clipName, loaded, errors = []) {
	const resolved = resolveClipAlias(clipName);
	const motionState = resolved?.motionState ?? "idle";
	return {
		fighterId,
		frameData: {
			motionState,
			clipName,
			source: resolved?.source ?? "generic",
			...DEFAULT_FRAME_DATA[motionState]
		},
		loaded,
		errors
	};
}
/**
* Build a complete move library for all roster fighters.
* Pass in the clip names discovered from each fighter's GLB.
*/
function buildMoveLibrary(rosterClips) {
	const entries = /* @__PURE__ */ new Map();
	let totalClips = 0;
	let loadedClips = 0;
	const globalErrors = [];
	for (const { fighterId, clipNames, loadErrors } of rosterClips) {
		const fighterEntries = [];
		for (const clipName of clipNames) {
			const entry = buildMoveLibraryEntry(fighterId, clipName, true);
			fighterEntries.push(entry);
			totalClips++;
			loadedClips++;
		}
		for (const err of loadErrors) globalErrors.push(`[${fighterId}] ${err}`);
		entries.set(fighterId, fighterEntries);
	}
	return {
		entries,
		totalClips,
		loadedClips,
		errors: globalErrors
	};
}
/**
* Get all move library entries for a specific fighter.
*/
function getFighterMoves(library, fighterId) {
	return library.entries.get(fighterId) ?? [];
}
/** Standard clip set expected for every roster fighter */
var STANDARD_CLIP_SET = [
	"bf_idle",
	"bf_walk_fwd",
	"bf_walk_back",
	"bf_crouch",
	"bf_guard",
	"bf_jab",
	"bf_cross",
	"bf_low_kick",
	"bf_high_kick",
	"bf_hit_reaction",
	"bf_knockdown",
	"bf_wakeup",
	"bf_ko"
];
/** Schwarzerblitz research clip set */
var SBW_CLIP_SET = [
	"SBW_idle",
	"SBW_walk_fwd",
	"SBW_walk_back",
	"SBW_crouch",
	"SBW_guard",
	"SBW_jab",
	"SBW_cross",
	"SBW_hit_reaction",
	"SBW_knockdown",
	"SBW_wakeup"
];
/** Tekken research clip set */
var TEKKEN_CLIP_SET = [
	"T_idle",
	"T_walk_fwd",
	"T_walk_back",
	"T_crouch",
	"T_guard",
	"T_jab",
	"T_cross",
	"T_low_kick",
	"T_high_kick",
	"T_hit",
	"T_knockdown",
	"T_wakeup"
];
var SOURCE_COLORS = {
	schwarzerblitz: "#7c3aed",
	tekken: "#1d4ed8",
	bannon: "#d97706",
	generic: "#52525b"
};
var SOURCE_LABELS = {
	schwarzerblitz: "SBW",
	tekken: "TKN",
	bannon: "BNN",
	generic: "GEN"
};
function MoveLibraryViewer({ onClose }) {
	const [selectedFighter, setSelectedFighter] = (0, import_react.useState)(BANNON_ROSTER[0].id);
	const [selectedSource, setSelectedSource] = (0, import_react.useState)("all");
	const library = (0, import_react.useMemo)(() => {
		return buildMoveLibrary(BANNON_ROSTER.map((fighter) => ({
			fighterId: fighter.id,
			clipNames: [
				...STANDARD_CLIP_SET,
				...SBW_CLIP_SET,
				...TEKKEN_CLIP_SET
			],
			loadErrors: []
		})));
	}, []);
	const fighterMoves = getFighterMoves(library, selectedFighter);
	const filteredMoves = selectedSource === "all" ? fighterMoves : fighterMoves.filter((m) => m.frameData.source === selectedSource);
	const deduped = (0, import_react.useMemo)(() => {
		const seen = /* @__PURE__ */ new Map();
		const priority = {
			bannon: 0,
			schwarzerblitz: 1,
			tekken: 2,
			generic: 3
		};
		for (const entry of filteredMoves) {
			const existing = seen.get(entry.frameData.motionState);
			if (!existing || (priority[entry.frameData.source] ?? 99) < (priority[existing.frameData.source] ?? 99)) seen.set(entry.frameData.motionState, entry);
		}
		return Array.from(seen.values());
	}, [filteredMoves]);
	const totalLoaded = library.loadedClips;
	const totalClips = library.totalClips;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 bg-[#080a10] text-white font-mono overflow-y-auto z-50",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-2xl mx-auto px-4 py-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: onClose,
							className: "text-[8px] tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors mb-3",
							children: "← BACK TO PRACTICE"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[9px] tracking-[0.5em] text-zinc-500",
								children: "ANIMATION PIPELINE"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-2xl font-black tracking-widest",
								children: "MOVE LIBRARY"
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border border-purple-900 bg-purple-900/20 px-3 py-1.5 text-right",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-[7px] text-purple-700",
									children: [
										totalLoaded,
										"/",
										totalClips,
										" CLIPS"
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[9px] font-black text-purple-400",
									children: "NORMALIZED"
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mt-1 h-px bg-zinc-800" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 text-[8px] text-zinc-600",
							children: "Animations loaded from Schwarzerblitz/Tekken research GLBs, normalized to motion states with frame-data metadata."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[8px] tracking-[0.3em] text-zinc-500 mb-2",
						children: "CLIP SOURCE"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-1.5",
						children: [
							"all",
							"schwarzerblitz",
							"tekken",
							"bannon"
						].map((src) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setSelectedSource(src),
							className: "border px-3 py-1.5 text-[8px] font-black tracking-widest transition-all",
							style: {
								borderColor: selectedSource === src ? src === "all" ? "#facc15" : SOURCE_COLORS[src] : "#27272a",
								color: selectedSource === src ? src === "all" ? "#facc15" : SOURCE_COLORS[src] : "#52525b",
								background: selectedSource === src ? `${src === "all" ? "#facc15" : SOURCE_COLORS[src]}12` : "transparent"
							},
							children: src === "all" ? "ALL" : SOURCE_LABELS[src]
						}, src))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[8px] tracking-[0.3em] text-zinc-500 mb-2",
						children: "FIGHTER"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap gap-1",
						children: BANNON_ROSTER.slice(0, 8).map((fighter) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setSelectedFighter(fighter.id),
							className: "border px-2 py-1 text-[8px] font-black transition-all",
							style: {
								borderColor: selectedFighter === fighter.id ? "#facc15" : "#27272a",
								color: selectedFighter === fighter.id ? "#facc15" : "#52525b",
								background: selectedFighter === fighter.id ? "#facc1512" : "transparent"
							},
							children: fighter.name.toUpperCase().slice(0, 8)
						}, fighter.id))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "border border-zinc-800",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-12 gap-0 border-b border-zinc-800 px-3 py-1.5 bg-zinc-900/50",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "col-span-3 text-[7px] tracking-widest text-zinc-500",
								children: "MOTION STATE"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "col-span-3 text-[7px] tracking-widest text-zinc-500",
								children: "CLIP NAME"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "col-span-1 text-[7px] tracking-widest text-zinc-500 text-center",
								children: "SRC"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "col-span-1 text-[7px] tracking-widest text-zinc-500 text-center",
								children: "S"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "col-span-1 text-[7px] tracking-widest text-zinc-500 text-center",
								children: "A"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "col-span-1 text-[7px] tracking-widest text-zinc-500 text-center",
								children: "R"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "col-span-1 text-[7px] tracking-widest text-zinc-500 text-center",
								children: "DMG"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "col-span-1 text-[7px] tracking-widest text-zinc-500 text-center",
								children: "FPS"
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "divide-y divide-zinc-900",
						children: deduped.map((entry, i) => {
							const fd = entry.frameData;
							const srcColor = SOURCE_COLORS[fd.source] ?? "#52525b";
							const isAttack = fd.damage > 0;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid grid-cols-12 gap-0 px-3 py-1.5 hover:bg-zinc-900/30 transition-colors",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "col-span-3 text-[8px] font-black",
										style: { color: isAttack ? "#facc15" : "#a1a1aa" },
										children: fd.motionState
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "col-span-3 text-[7px] text-zinc-500 truncate",
										children: fd.clipName
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "col-span-1 text-center",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[6px] font-black px-1 py-0.5",
											style: {
												color: srcColor,
												border: `1px solid ${srcColor}44`
											},
											children: SOURCE_LABELS[fd.source] ?? "GEN"
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "col-span-1 text-[7px] text-center",
										style: { color: "#facc15" },
										children: fd.startupFrames > 0 ? fd.startupFrames : "—"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "col-span-1 text-[7px] text-center",
										style: { color: "#22c55e" },
										children: fd.activeFrames > 0 ? fd.activeFrames : "—"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "col-span-1 text-[7px] text-center",
										style: { color: "#ef4444" },
										children: fd.recoveryFrames > 0 ? fd.recoveryFrames : "—"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "col-span-1 text-[7px] text-center text-zinc-400",
										children: fd.damage > 0 ? fd.damage : "—"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "col-span-1 text-[7px] text-center text-zinc-500",
										children: fd.totalFrames
									})
								]
							}, i);
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 border border-zinc-900 p-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[7px] tracking-widest text-zinc-600 mb-2",
							children: "LEGEND"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-3 text-[7px]",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									style: { color: "#facc15" },
									children: "S = Startup frames"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									style: { color: "#22c55e" },
									children: "A = Active frames (hitbox live)"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									style: { color: "#ef4444" },
									children: "R = Recovery frames"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-zinc-500",
									children: "DMG = Base damage"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-zinc-500",
									children: "FPS = Total frames at 60fps"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-wrap gap-3 mt-2 text-[7px]",
							children: Object.entries(SOURCE_LABELS).map(([src, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								style: { color: SOURCE_COLORS[src] },
								children: [
									label,
									" = ",
									src.charAt(0).toUpperCase() + src.slice(1)
								]
							}, src))
						})
					]
				}),
				library.errors.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 border border-red-900/50 p-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[7px] tracking-widest text-red-700 mb-1",
						children: "LOAD ERRORS"
					}), library.errors.slice(0, 5).map((err, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[7px] text-red-500",
						children: err
					}, i))]
				})
			]
		})
	});
}
var GameBattleArena = dynamic(() => import("./GameBattleArena-Q4F29L8T.mjs"), { ssr: false });
var DIFFICULTY_CONFIG = {
	EASY: {
		label: "EASY",
		color: "#22c55e",
		desc: "Slow AI, low damage. Perfect for learning move timing."
	},
	NORMAL: {
		label: "NORMAL",
		color: "#facc15",
		desc: "Balanced AI. Good for practicing combos and spacing."
	},
	HARD: {
		label: "HARD",
		color: "#f97316",
		desc: "Aggressive AI with punish windows. Tests your defense."
	},
	BRUTAL: {
		label: "BRUTAL",
		color: "#ef4444",
		desc: "Near-perfect AI. Only for mastery-level preparation."
	}
};
var FACTION_COLOR = {
	alliance: "#1d4ed8",
	corporate: "#dc2626",
	chaos: "#7c3aed",
	independent: "#d97706"
};
var PRACTICE_STAGES = [{
	id: "training",
	label: "TRAINING ARENA",
	desc: "Default practice stage. Clean floor, no distractions.",
	color: "#22c55e",
	isDefault: true
}, {
	id: "urban_night",
	label: "URBAN NIGHT",
	desc: "City rooftop at night. Same engine as ranked matches.",
	color: "#3b82f6"
}];
function PracticeArenaScreen({ onBack }) {
	const [phase, setPhase] = (0, import_react.useState)("SETUP");
	const [selectedFighter, setSelectedFighter] = (0, import_react.useState)(BANNON_ROSTER[0]);
	const [aiFighter, setAiFighter] = (0, import_react.useState)(BANNON_ROSTER[1] ?? BANNON_ROSTER[0]);
	const [difficulty, setDifficulty] = (0, import_react.useState)("NORMAL");
	const [selectedStage, setSelectedStage] = (0, import_react.useState)("training");
	const [showSettings, setShowSettings] = (0, import_react.useState)(false);
	const [debugSettings, setDebugSettings] = (0, import_react.useState)(DEFAULT_DEBUG_SETTINGS);
	const [showMoveLibrary, setShowMoveLibrary] = (0, import_react.useState)(false);
	const [sessionWins, setSessionWins] = (0, import_react.useState)(0);
	const [sessionLosses, setSessionLosses] = (0, import_react.useState)(0);
	DIFFICULTY_CONFIG[difficulty];
	if (showMoveLibrary) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MoveLibraryViewer, { onClose: () => setShowMoveLibrary(false) });
	if (phase === "FIGHTING") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameBattleArena, {
		p1Fighter: selectedFighter,
		p2Fighter: aiFighter,
		isPracticeMode: true,
		debugSettings,
		stageId: selectedStage,
		roundLabel: `PRACTICE · ${difficulty} · ${PRACTICE_STAGES.find((s) => s.id === selectedStage)?.label ?? selectedStage.toUpperCase()}`,
		onMatchEnd: (winner) => {
			if (winner === "p1") setSessionWins((w) => w + 1);
			else if (winner === "p2") setSessionLosses((l) => l + 1);
			setPhase("SETUP");
		},
		onBack: () => setPhase("SETUP")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 bg-[#080a10] text-white font-mono overflow-y-auto",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-2xl mx-auto px-4 py-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: onBack,
							className: "text-[8px] tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors mb-3",
							children: "← BACK"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[9px] tracking-[0.5em] text-zinc-500",
								children: "TRAINING MODE"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-3xl font-black tracking-widest",
								children: "PRACTICE ARENA"
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setShowSettings((s) => !s),
									className: "border px-3 py-1.5 text-[8px] font-black tracking-widest transition-all",
									style: {
										borderColor: showSettings ? "#facc15" : "#27272a",
										color: showSettings ? "#facc15" : "#52525b",
										background: showSettings ? "#facc1512" : "transparent"
									},
									children: "⚙ SETTINGS"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "border border-green-900 bg-green-900/20 px-3 py-1.5 text-right",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[7px] text-green-700",
										children: "NO STAT PENALTY"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[9px] font-black text-green-400",
										children: "SAFE ZONE"
									})]
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mt-1 h-px bg-zinc-800" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 text-[8px] text-zinc-600",
							children: "Full combat arena — same engine as ranked matches. Wins and losses here do not affect your tournament record or rank points."
						})
					]
				}),
				(sessionWins > 0 || sessionLosses > 0) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-4 border border-zinc-900 p-3 flex gap-6 items-center",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[7px] tracking-widest text-zinc-600",
						children: "SESSION"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-center",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-lg font-black text-green-400",
								children: sessionWins
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[7px] text-zinc-600",
								children: "WINS"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-center",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-lg font-black text-red-400",
								children: sessionLosses
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[7px] text-zinc-600",
								children: "LOSSES"
							})]
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[8px] tracking-[0.3em] text-zinc-500 mb-2",
						children: "SELECT STAGE"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-2 gap-1.5",
						children: PRACTICE_STAGES.map((stage) => {
							const isSelected = selectedStage === stage.id;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setSelectedStage(stage.id),
								className: "border p-3 text-left transition-all relative",
								style: {
									borderColor: isSelected ? stage.color : "#27272a",
									background: isSelected ? `${stage.color}12` : "transparent"
								},
								children: [
									stage.isDefault && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "absolute top-1.5 right-1.5 text-[5px] tracking-widest px-1 py-0.5",
										style: {
											color: stage.color,
											background: `${stage.color}20`
										},
										children: "DEFAULT"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[10px] font-black",
										style: { color: isSelected ? stage.color : "#a1a1aa" },
										children: stage.label
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[7px] text-zinc-600 mt-0.5",
										children: stage.desc
									})
								]
							}, stage.id);
						})
					})]
				}),
				showSettings && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-5 border border-yellow-900/50 bg-yellow-900/5 p-4 space-y-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[9px] tracking-[0.3em] text-yellow-400 font-black",
								children: "PRACTICE SETTINGS"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setShowSettings(false),
								className: "text-[8px] text-zinc-500 hover:text-zinc-300 transition-colors",
								children: "✕ CLOSE"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[9px] font-black text-zinc-300",
									children: "DEBUG OVERLAY"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[7px] text-zinc-600 mt-0.5",
									children: "Frame windows, AABB geometry, impact markers"
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setDebugSettings((s) => ({
										...s,
										enabled: !s.enabled
									})),
									className: "border px-3 py-1.5 text-[8px] font-black tracking-widest transition-all",
									style: {
										borderColor: debugSettings.enabled ? "#22c55e" : "#27272a",
										color: debugSettings.enabled ? "#22c55e" : "#52525b",
										background: debugSettings.enabled ? "#22c55e12" : "transparent"
									},
									children: debugSettings.enabled ? "ON" : "OFF"
								})]
							}), debugSettings.enabled && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "pl-3 border-l border-zinc-800 space-y-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[7px] tracking-widest text-zinc-600 mb-1",
										children: "PER-FIGHTER"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: () => setDebugSettings((s) => ({
												...s,
												showP1: !s.showP1
											})),
											className: "border px-2 py-1 text-[7px] font-black transition-all",
											style: {
												borderColor: debugSettings.showP1 ? "#1d4ed8" : "#27272a",
												color: debugSettings.showP1 ? "#1d4ed8" : "#52525b"
											},
											children: ["P1 ", debugSettings.showP1 ? "●" : "○"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: () => setDebugSettings((s) => ({
												...s,
												showP2: !s.showP2
											})),
											className: "border px-2 py-1 text-[7px] font-black transition-all",
											style: {
												borderColor: debugSettings.showP2 ? "#dc2626" : "#27272a",
												color: debugSettings.showP2 ? "#dc2626" : "#52525b"
											},
											children: ["P2 ", debugSettings.showP2 ? "●" : "○"]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[7px] tracking-widest text-zinc-600 mb-1",
										children: "LAYERS"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-wrap gap-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												onClick: () => setDebugSettings((s) => ({
													...s,
													showFrameWindows: !s.showFrameWindows
												})),
												className: "border px-2 py-1 text-[7px] font-black transition-all",
												style: {
													borderColor: debugSettings.showFrameWindows ? "#facc15" : "#27272a",
													color: debugSettings.showFrameWindows ? "#facc15" : "#52525b"
												},
												children: ["FRAME WINDOWS ", debugSettings.showFrameWindows ? "●" : "○"]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												onClick: () => setDebugSettings((s) => ({
													...s,
													showAABB: !s.showAABB
												})),
												className: "border px-2 py-1 text-[7px] font-black transition-all",
												style: {
													borderColor: debugSettings.showAABB ? "#22c55e" : "#27272a",
													color: debugSettings.showAABB ? "#22c55e" : "#52525b"
												},
												children: ["AABB ", debugSettings.showAABB ? "●" : "○"]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												onClick: () => setDebugSettings((s) => ({
													...s,
													showImpactMarkers: !s.showImpactMarkers
												})),
												className: "border px-2 py-1 text-[7px] font-black transition-all",
												style: {
													borderColor: debugSettings.showImpactMarkers ? "#f97316" : "#27272a",
													color: debugSettings.showImpactMarkers ? "#f97316" : "#52525b"
												},
												children: ["IMPACT ", debugSettings.showImpactMarkers ? "●" : "○"]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												onClick: () => setDebugSettings((s) => ({
													...s,
													showRigState: !s.showRigState
												})),
												className: "border px-2 py-1 text-[7px] font-black transition-all",
												style: {
													borderColor: debugSettings.showRigState ? "#a3e635" : "#27272a",
													color: debugSettings.showRigState ? "#a3e635" : "#52525b"
												},
												children: ["RIG STATE ", debugSettings.showRigState ? "●" : "○"]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												onClick: () => setDebugSettings((s) => ({
													...s,
													showHurtboxRegions: !s.showHurtboxRegions
												})),
												className: "border px-2 py-1 text-[7px] font-black transition-all",
												style: {
													borderColor: debugSettings.showHurtboxRegions ? "#a78bfa" : "#27272a",
													color: debugSettings.showHurtboxRegions ? "#a78bfa" : "#52525b"
												},
												children: ["HURTBOXES ", debugSettings.showHurtboxRegions ? "●" : "○"]
											})
										]
									}),
									debugSettings.showRigState && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-1 p-2 bg-zinc-900/60 border border-zinc-800 space-y-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[6px] tracking-widest text-zinc-500",
											children: "RIG STATE LEGEND"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-wrap gap-x-3 gap-y-0.5 text-[6px]",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													style: { color: "#a3e635" },
													children: "● CLIP — active animation"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													style: { color: "#22d3ee" },
													children: "● FRAME — current/total"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													style: { color: "#facc15" },
													children: "● SPEED — playback rate"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													style: { color: "#f97316" },
													children: "● XFADE — crossfade progress"
												})
											]
										})]
									}),
									debugSettings.showHurtboxRegions && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-1 p-2 bg-zinc-900/60 border border-zinc-800 space-y-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[6px] tracking-widest text-zinc-500",
											children: "HURTBOX REGIONS"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-wrap gap-x-3 gap-y-0.5 text-[6px]",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													style: { color: "#a78bfa" },
													children: "■ HEAD ×1.5"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													style: { color: "#60a5fa" },
													children: "■ TORSO ×1.0"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													style: { color: "#34d399" },
													children: "■ ARMS ×0.8"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													style: { color: "#fbbf24" },
													children: "■ LEGS ×0.7"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													style: { color: "#ef4444" },
													children: "■ HIT"
												})
											]
										})]
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "pt-2 border-t border-zinc-800",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setShowMoveLibrary(true),
								className: "w-full border border-purple-900 py-2.5 text-[8px] font-black tracking-widest text-purple-400 hover:border-purple-700 hover:text-purple-300 transition-all bg-purple-900/10",
								children: "📋 VIEW MOVE LIBRARY — GLB ANIMATION MANIFEST"
							})
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[8px] tracking-[0.3em] text-zinc-500 mb-2",
							children: "SELECT YOUR FIGHTER"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid grid-cols-2 gap-1.5",
							children: BANNON_ROSTER.slice(0, 6).map((fighter) => {
								const fColor = FACTION_COLOR[fighter.factionAlignment];
								const isSelected = selectedFighter.id === fighter.id;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => setSelectedFighter(fighter),
									className: "border p-3 text-left transition-all",
									style: {
										borderColor: isSelected ? fColor : "#27272a",
										background: isSelected ? `${fColor}12` : "transparent"
									},
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[10px] font-black",
											style: { color: isSelected ? fColor : "#a1a1aa" },
											children: fighter.name.toUpperCase()
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[7px] text-zinc-600 mt-0.5",
											children: fighter.fightingStyle.split(".")[0]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex gap-2 mt-1.5",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[7px] text-zinc-500",
													children: ["STR ", fighter.strength]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[7px] text-zinc-500",
													children: ["SPD ", fighter.speed]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[7px] text-zinc-500",
													children: ["HP ", fighter.hp]
												})
											]
										})
									]
								}, fighter.id);
							})
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[8px] tracking-[0.3em] text-zinc-500 mb-2",
							children: "SELECT OPPONENT"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid grid-cols-2 gap-1.5",
							children: BANNON_ROSTER.slice(0, 6).map((fighter) => {
								const fColor = FACTION_COLOR[fighter.factionAlignment];
								const isSelected = aiFighter.id === fighter.id;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => setAiFighter(fighter),
									className: "border p-3 text-left transition-all",
									style: {
										borderColor: isSelected ? fColor : "#27272a",
										background: isSelected ? `${fColor}12` : "transparent"
									},
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[10px] font-black",
										style: { color: isSelected ? fColor : "#a1a1aa" },
										children: fighter.name.toUpperCase()
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[7px] text-zinc-600 mt-0.5",
										children: fighter.fightingStyle.split(".")[0]
									})]
								}, fighter.id);
							})
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[8px] tracking-[0.3em] text-zinc-500 mb-2",
							children: "DIFFICULTY"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid grid-cols-2 gap-1.5",
							children: Object.keys(DIFFICULTY_CONFIG).map((d) => {
								const dc = DIFFICULTY_CONFIG[d];
								const isSelected = difficulty === d;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => setDifficulty(d),
									className: "border p-3 text-left transition-all",
									style: {
										borderColor: isSelected ? dc.color : "#27272a",
										background: isSelected ? `${dc.color}12` : "transparent"
									},
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[10px] font-black",
										style: { color: isSelected ? dc.color : "#a1a1aa" },
										children: dc.label
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[7px] text-zinc-600 mt-0.5",
										children: dc.desc
									})]
								}, d);
							})
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setPhase("FIGHTING"),
							className: "w-full border border-yellow-700 py-4 text-[10px] font-black tracking-[0.4em] text-yellow-400 hover:bg-yellow-900/20 transition-all",
							children: "▶ START PRACTICE"
						})
					]
				})
			]
		})
	});
}
//#endregion
export { PracticeArenaScreen as default };
