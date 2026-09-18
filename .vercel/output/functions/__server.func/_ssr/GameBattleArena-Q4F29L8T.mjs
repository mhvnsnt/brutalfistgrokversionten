import { a as __toESM } from "../_runtime.mjs";
import { c as require_jsx_runtime, l as require_react } from "../_libs/@react-three/drei+[...].mjs";
import { r as HIT_STOP_DURATIONS } from "./BoneHitboxSystem-D2yRyfrH.mjs";
import { a as dynamic, f as getBannonFighter, i as FighterState, l as useAuth, n as DEFAULT_TOURNAMENT_SETTINGS } from "./routes-DbIfrPB2.mjs";
import { t as useGesture } from "../_libs/use-gesture__react.mjs";
import { a as getMoveById, i as getCharacterMoveSet } from "./CharacterMoveSetSystem-D6bJ_Wug.mjs";
import { i as PostMatchScreen, r as LocomotionSystem, t as ATTACK_ROOT_MOTION_PROFILES } from "./PostMatchScreen-BJu3znyt.mjs";
import { i as tickArenaState, n as createArenaCombatState, r as resolveStageConfig } from "./StageConfig-DJ4pMRhO.mjs";
import { a as getPhaseColor, i as computeRigState, n as DEFAULT_HURTBOX_REGIONS, o as getPhaseName, r as computeFrameWindowData, s as getRegionColor, t as DEFAULT_DEBUG_SETTINGS } from "./DebugOverlay-xyOpLM1i.mjs";
import { a as useMatchRecorder, i as saveReplayToSupabase, t as PauseMenuRecorder } from "./MatchRecorder-m6dleRHv.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/GameBattleArena-Q4F29L8T.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var MAX_SAMPLES = 24;
var SchwarzerblitzInputBuffer = class {
	samples = [];
	push(frame, input) {
		this.samples.push({
			frame,
			...input
		});
		if (this.samples.length > MAX_SAMPLES) this.samples.shift();
	}
	clear() {
		this.samples.length = 0;
	}
	has(command) {
		const recent = this.samples.slice(-24);
		if (recent.length < 2) return false;
		if (command === "forward-forward") return this.hasDouble("forward");
		if (command === "back-back") return this.hasDouble("back");
		if (command === "quarter-forward") return this.hasQuarter(true);
		if (command === "quarter-back") return this.hasQuarter(false);
		return recent.some((s) => command === "forward" ? s.right && !s.left : command === "back" ? s.left && !s.right : false);
	}
	hasDouble(direction) {
		let presses = 0;
		let wasDown = false;
		for (const sample of this.samples.slice(-16)) {
			const down = direction === "forward" ? sample.right && !sample.left : sample.left && !sample.right;
			if (down && !wasDown) presses++;
			wasDown = down;
		}
		return presses >= 2;
	}
	hasQuarter(forward) {
		let sawVertical = false;
		let sawDiagonal = false;
		for (const sample of this.samples.slice(-12)) {
			const horizontal = forward ? sample.right : sample.left;
			if (sample.down) sawVertical = true;
			if (horizontal && sample.down) sawDiagonal = true;
		}
		return sawVertical && sawDiagonal;
	}
};
/**
* Shared Bannon -> Brutal Fist combat contract.
*
* These values are sourced from Bannon's architecture ledger. They are
* contracts for the browser/native boundary, not a claim that the browser
* runtime has replaced the native Jolt implementation.
*/
var BANNON_COMBAT_CONTRACT = {
	tickRate: 60,
	maxBodyVelocityMps: 3.8,
	damageScale: 8,
	maxHitStopFrames: 5,
	heavyHitStopFrames: 4,
	physicalPinShoulderToleranceM: .15,
	startingHp: 1e4,
	poise: {
		enabled: true,
		zeroBehavior: "full-body-ragdoll"
	},
	rootMotion: {
		bounded: true,
		sweptCollision: true,
		nativeOwner: "C++"
	},
	hitReaction: {
		activeRagdollBlendOnHeavy: 1,
		nativePhysicsOwner: "Jolt"
	},
	rollback: { requiredState: [
		"AnimSequenceTime",
		"CurrentBlendWeight",
		"JoltBoneTransformOffsets"
	] }
};
function hitStopFramesForImpact(force) {
	if (!Number.isFinite(force) || force <= 0) return 0;
	if (force < BANNON_COMBAT_CONTRACT.damageScale * .75) return 0;
	const normalized = Math.min(1, force / (BANNON_COMBAT_CONTRACT.damageScale * 2));
	return Math.max(3, Math.min(BANNON_COMBAT_CONTRACT.maxHitStopFrames, Math.round(3 + normalized * 2)));
}
function isPhysicalPin(leftShoulderDistanceM, rightShoulderDistanceM) {
	return Number.isFinite(leftShoulderDistanceM) && Number.isFinite(rightShoulderDistanceM) && leftShoulderDistanceM <= BANNON_COMBAT_CONTRACT.physicalPinShoulderToleranceM && rightShoulderDistanceM <= BANNON_COMBAT_CONTRACT.physicalPinShoulderToleranceM;
}
var GrappleSystem = class {
	state = {
		phase: "none",
		attackerId: null,
		defenderId: null,
		frame: 0,
		escapeMeter: 0
	};
	getState() {
		return { ...this.state };
	}
	canEngage(distanceM, defenderGuarding) {
		return Number.isFinite(distanceM) && distanceM >= .2 && distanceM <= .95 && !defenderGuarding && this.state.phase === "none";
	}
	engage(attackerId, defenderId, frame) {
		if (this.state.phase !== "none") return false;
		this.state = {
			phase: "engaged",
			attackerId,
			defenderId,
			frame,
			escapeMeter: 0
		};
		return true;
	}
	advanceControl(frame) {
		if (this.state.phase !== "engaged" && this.state.phase !== "control") return;
		this.state.phase = "control";
		this.state.frame = frame;
	}
	applyEscapeInput(amount, frame) {
		if (this.state.phase !== "engaged" && this.state.phase !== "control") return false;
		this.state.escapeMeter = Math.max(0, Math.min(100, this.state.escapeMeter + Math.max(0, amount)));
		this.state.frame = frame;
		if (this.state.escapeMeter >= 100) {
			this.state.phase = "escaped";
			return true;
		}
		return false;
	}
	attemptPin(frame, measurement) {
		if (this.state.phase !== "control" && this.state.phase !== "throw") return false;
		const valid = measurement.ringMatContact && isPhysicalPin(measurement.leftShoulderDistanceM, measurement.rightShoulderDistanceM);
		this.state.phase = valid ? "pinned" : "control";
		this.state.frame = frame;
		return valid;
	}
	release(frame) {
		this.state = {
			phase: "none",
			attackerId: null,
			defenderId: null,
			frame,
			escapeMeter: 0
		};
	}
	getContract() {
		return {
			maxVelocityMps: BANNON_COMBAT_CONTRACT.maxBodyVelocityMps,
			pinToleranceM: BANNON_COMBAT_CONTRACT.physicalPinShoulderToleranceM,
			nativePhysicsOwner: BANNON_COMBAT_CONTRACT.hitReaction.nativePhysicsOwner
		};
	}
};
var EMPTY_INPUT$1 = {
	up: false,
	down: false,
	left: false,
	right: false,
	light: false,
	heavy: false,
	guard: false,
	grapple: false,
	escape: false,
	pin: false
};
var DEFAULT_HURTBOX = {
	offsetX: 0,
	offsetZ: 0,
	width: .82,
	depth: .72
};
var LIGHT = getMoveById("light") ?? {
	startup: 4,
	active: 2,
	recovery: 10,
	damage: 12,
	hitAdvantage: 2,
	blockAdvantage: -1,
	pushback: .2,
	minRange: 0,
	maxRange: 2.4
};
var HEAVY = getMoveById("heavy") ?? {
	startup: 8,
	active: 3,
	recovery: 16,
	damage: 22,
	hitAdvantage: 1,
	blockAdvantage: -4,
	pushback: .35,
	minRange: 0,
	maxRange: 2.6
};
var GameEngine = class {
	inputBuffer = [];
	currentFrame = 0;
	p1Fighter;
	p2Fighter;
	p1MaxHealth;
	p2MaxHealth;
	p1Health;
	p2Health;
	p1Poise;
	p2Poise;
	state = FighterState.Neutral;
	p2State = FighterState.Neutral;
	stateFrameCounter = 0;
	p2StateFrameCounter = 0;
	currentMove = null;
	p2Move = null;
	p1X = -2.25;
	p1Z = 0;
	p2X = 2.25;
	p2Z = 0;
	p1Facing = 1;
	p2Facing = -1;
	p1Animation = "idle";
	p2Animation = "idle";
	grapple = new GrappleSystem();
	hitStopFrames = 0;
	maxBufferSize = 60;
	arenaX = 5.5;
	arenaZ = 2.25;
	hurtbox = DEFAULT_HURTBOX;
	p1Hitstun = 0;
	p2Hitstun = 0;
	p1Blockstun = 0;
	p2Blockstun = 0;
	p1Guard = false;
	p2Guard = false;
	commandBuffer = new SchwarzerblitzInputBuffer();
	suppressInternalHit = false;
	constructor(p1Fighter = getBannonFighter("bannon"), p2Fighter = getBannonFighter("maime")) {
		this.p1Fighter = p1Fighter;
		this.p2Fighter = p2Fighter;
		this.p1MaxHealth = p1Fighter.hp;
		this.p2MaxHealth = p2Fighter.hp;
		this.p1Health = p1Fighter.hp;
		this.p2Health = p2Fighter.hp;
		this.p1Poise = p1Fighter.poise;
		this.p2Poise = p2Fighter.poise;
		for (let i = 0; i < this.maxBufferSize; i++) this.inputBuffer.push({ ...EMPTY_INPUT$1 });
	}
	tick(currentInput) {
		if (this.isMatchOver()) return;
		this.currentFrame++;
		this.inputBuffer.shift();
		this.inputBuffer.push({ ...currentInput });
		this.commandBuffer.push(this.currentFrame, currentInput);
		if (this.hitStopFrames > 0) {
			this.hitStopFrames--;
			this.p1Animation = this.p1Animation === "ko" ? "ko" : this.p1Animation;
			this.p2Animation = this.p2Animation === "ko" ? "ko" : this.p2Animation;
			return;
		}
		this.updateFacing();
		this.updateGrapple(currentInput);
		if (this.grapple.getState().phase !== "none" && this.grapple.getState().phase !== "escaped") {
			this.updateGrappledStates();
			return;
		}
		if (this.grapple.getState().phase === "escaped") this.grapple.release(this.currentFrame);
		this.updatePlayer(currentInput);
		this.updateCpu();
		this.resolveBodySeparation();
		this.updateFacing();
		this.suppressInternalHit = false;
	}
	getSnapshot() {
		const grappleState = this.grapple.getState();
		return {
			frame: this.currentFrame,
			p1: this.snapshot(this.p1Health, this.p1X, this.p1Z, this.p1Facing, this.state, this.stateFrameCounter, this.p1Animation, this.currentMove, grappleState),
			p2: this.snapshot(this.p2Health, this.p2X, this.p2Z, this.p2Facing, this.p2State, this.p2StateFrameCounter, this.p2Animation, this.p2Move, grappleState)
		};
	}
	isMatchOver() {
		return this.p1Health <= 0 || this.p2Health <= 0;
	}
	/** SM/hitbox path — HUD health and hitstun live here. */
	applyIncomingHit(target, damage, blocked, hitstunSeconds = .3) {
		const dmg = Math.max(0, Math.round(Number.isFinite(damage) ? damage : 0));
		const frames = Math.max(6, Math.round(Math.max(.1, hitstunSeconds) * 60));
		this.hitStopFrames = Math.max(this.hitStopFrames, blocked ? 2 : 5);
		this.suppressInternalHit = true;
		if (target === "p2") {
			this.p2Health = Math.max(0, this.p2Health - dmg);
			if (this.p2Health <= 0) {
				this.p2State = FighterState.KO;
				this.p2Animation = "ko";
				this.p2Hitstun = 0;
				this.p2Blockstun = 0;
				return;
			}
			if (blocked) {
				this.p2State = FighterState.Blockstun;
				this.p2Animation = "block";
				this.p2Blockstun = frames;
				this.p2Hitstun = 0;
			} else {
				this.p2State = FighterState.Hitstun;
				this.p2Animation = "hit";
				this.p2Hitstun = frames;
				this.p2Blockstun = 0;
			}
			return;
		}
		this.p1Health = Math.max(0, this.p1Health - dmg);
		if (this.p1Health <= 0) {
			this.state = FighterState.KO;
			this.p1Animation = "ko";
			this.p1Hitstun = 0;
			this.p1Blockstun = 0;
			return;
		}
		if (blocked) {
			this.state = FighterState.Blockstun;
			this.p1Animation = "block";
			this.p1Blockstun = frames;
			this.p1Hitstun = 0;
		} else {
			this.state = FighterState.Hitstun;
			this.p1Animation = "hit";
			this.p1Hitstun = frames;
			this.p1Blockstun = 0;
		}
	}
	syncWorld(p1X, p1Z, p2X, p2Z) {
		this.p1X = p1X;
		this.p1Z = p1Z;
		this.p2X = p2X;
		this.p2Z = p2Z;
	}
	snapshot(health, x, z, facing, state, stateFrame, animation, move, grappleState) {
		return {
			health,
			x,
			z,
			facing,
			state,
			stateFrame,
			animation,
			move,
			grapplePhase: grappleState.phase,
			grappleEscapeMeter: grappleState.escapeMeter
		};
	}
	updateGrapple(input) {
		const g = this.grapple.getState();
		if (g.phase === "none" && input.grapple && this.state === FighterState.Neutral && this.p2State === FighterState.Neutral) {
			const distance = Math.hypot(this.p2X - this.p1X, this.p2Z - this.p1Z);
			if (this.grapple.canEngage(distance, this.p2Guard)) {
				this.grapple.engage("p1", "p2", this.currentFrame);
				this.state = FighterState.Grappled;
				this.p2State = FighterState.Grappled;
				this.p1Animation = "grapple";
				this.p2Animation = "grapple";
			}
			return;
		}
		if (g.phase === "engaged" || g.phase === "control") {
			if (input.escape) this.grapple.applyEscapeInput(8, this.currentFrame);
			else this.grapple.advanceControl(this.currentFrame);
			if (input.pin) this.grapple.attemptPin(this.currentFrame, this.measurePinContact());
			else if (input.heavy && g.attackerId === "p1") {
				this.grapple.advanceControl(this.currentFrame);
				this.p2Health = Math.max(0, this.p2Health - this.scaledDamage(HEAVY.damage * 1.5, this.p1Fighter));
				this.p1Animation = "throw";
				this.p2Animation = "hit";
				this.p2State = FighterState.Hitstun;
				this.p2Hitstun = 24;
				this.grapple.release(this.currentFrame);
			}
		}
	}
	updateGrappledStates() {
		const g = this.grapple.getState();
		if (g.phase === "pinned") {
			this.state = g.attackerId === "p1" ? FighterState.Neutral : FighterState.Pinned;
			this.p2State = g.defenderId === "p2" ? FighterState.Pinned : FighterState.Neutral;
			this.p1Animation = g.attackerId === "p1" ? "pin" : "idle";
			this.p2Animation = g.defenderId === "p2" ? "pin" : "idle";
			return;
		}
		this.state = g.attackerId === "p1" ? FighterState.Grappled : FighterState.Neutral;
		this.p2State = g.defenderId === "p2" ? FighterState.Grappled : FighterState.Neutral;
		this.p1Animation = g.attackerId === "p1" ? "grapple" : "idle";
		this.p2Animation = g.defenderId === "p2" ? "grapple" : "idle";
	}
	measurePinContact() {
		const distance = Math.hypot(this.p2X - this.p1X, this.p2Z - this.p1Z);
		const ringMatContact = Math.abs(this.p2X) <= this.arenaX && Math.abs(this.p2Z) <= this.arenaZ;
		const shoulderDistance = Math.max(0, distance - .15);
		return {
			leftShoulderDistanceM: shoulderDistance,
			rightShoulderDistanceM: shoulderDistance,
			ringMatContact
		};
	}
	updatePlayer(input) {
		this.p1Guard = input.guard && this.state === FighterState.Neutral;
		if (this.p1Hitstun > 0) {
			this.p1Hitstun--;
			this.state = FighterState.Hitstun;
			this.p1Animation = "hit";
			if (!this.p1Hitstun) this.state = FighterState.Neutral;
			return;
		}
		if (this.p1Blockstun > 0) {
			this.p1Blockstun--;
			this.state = FighterState.Blockstun;
			this.p1Animation = "block";
			if (!this.p1Blockstun) this.state = FighterState.Neutral;
			return;
		}
		if (this.currentMove) {
			this.stateFrameCounter++;
			if (this.state === FighterState.Startup && this.stateFrameCounter >= this.currentMove.startup) {
				this.state = FighterState.Active;
				this.stateFrameCounter = 0;
			} else if (this.state === FighterState.Active) {
				if (this.stateFrameCounter === 1) this.tryHit(true, this.currentMove);
				if (this.stateFrameCounter >= this.currentMove.active) {
					this.state = FighterState.Recovery;
					this.stateFrameCounter = 0;
				}
			} else if (this.state === FighterState.Recovery && this.stateFrameCounter >= this.currentMove.recovery) {
				this.state = FighterState.Neutral;
				this.stateFrameCounter = 0;
				this.currentMove = null;
			}
			this.p1Animation = this.currentMove?.animation ?? "light";
			return;
		}
		if (this.state !== FighterState.Neutral) return;
		if (this.p1Guard) {
			this.p1Animation = "guard";
			return;
		}
		if (input.light && this.canStartMove(LIGHT)) {
			this.startPlayerMove(LIGHT);
			return;
		}
		if (input.heavy && this.canStartMove(HEAVY)) {
			this.startPlayerMove(HEAVY);
			return;
		}
		this.movePlayer(input);
		this.p1Animation = input.left || input.right || input.up || input.down ? "walk" : "idle";
	}
	startPlayerMove(move) {
		this.currentMove = move;
		this.state = FighterState.Startup;
		this.stateFrameCounter = 0;
	}
	canStartMove(move) {
		const candidate = move;
		if (!candidate) return false;
		const distance = Math.hypot(this.p2X - this.p1X, this.p2Z - this.p1Z);
		return distance >= (candidate.minRange ?? 0) && distance <= (candidate.maxRange ?? 3);
	}
	movePlayer(input) {
		const walkSpeed = .075 * (this.p1Fighter.speed / 85);
		const sidestepSpeed = .055 * (this.p1Fighter.speed / 85);
		if (input.left) this.p1X -= walkSpeed;
		if (input.right) this.p1X += walkSpeed;
		if (input.up) this.p1Z -= sidestepSpeed;
		if (input.down) this.p1Z += sidestepSpeed;
		this.clampP1();
	}
	updateCpu() {
		if (this.p2Health <= 0) {
			this.p2State = FighterState.KO;
			this.p2Animation = "ko";
			return;
		}
		if (this.p2Hitstun > 0) {
			this.p2Hitstun--;
			this.p2State = FighterState.Hitstun;
			this.p2Animation = "hit";
			if (!this.p2Hitstun) this.p2State = FighterState.Neutral;
			return;
		}
		if (this.p2Blockstun > 0) {
			this.p2Blockstun--;
			this.p2State = FighterState.Blockstun;
			this.p2Animation = "block";
			if (!this.p2Blockstun) this.p2State = FighterState.Neutral;
			return;
		}
		const dx = this.p1X - this.p2X;
		const dz = this.p1Z - this.p2Z;
		const distance = Math.hypot(dx, dz);
		if (this.p2Move) {
			this.p2StateFrameCounter++;
			if (this.p2State === FighterState.Startup && this.p2StateFrameCounter >= this.p2Move.startup) {
				this.p2State = FighterState.Active;
				this.p2StateFrameCounter = 0;
			} else if (this.p2State === FighterState.Active) {
				if (this.p2StateFrameCounter === 1) this.tryHit(false, this.p2Move);
				if (this.p2StateFrameCounter >= this.p2Move.active) {
					this.p2State = FighterState.Recovery;
					this.p2StateFrameCounter = 0;
				}
			} else if (this.p2State === FighterState.Recovery && this.p2StateFrameCounter >= this.p2Move.recovery) {
				this.p2State = FighterState.Neutral;
				this.p2StateFrameCounter = 0;
				this.p2Move = null;
			}
			this.p2Animation = this.p2Move?.animation ?? "light";
			return;
		}
		this.p2Guard = false;
		const walkSpeed = .075 * (this.p2Fighter.speed / 85);
		const sidestepSpeed = .055 * (this.p2Fighter.speed / 85);
		if (this.p2State !== FighterState.Neutral) return;
		if (distance > 2.1) {
			if (Math.abs(dx) > .08) this.p2X += Math.sign(dx) * walkSpeed * .78;
			if (Math.abs(dz) > .08) this.p2Z += Math.sign(dz) * sidestepSpeed * .5;
			this.p2Animation = "walk";
		} else if (this.currentFrame % 75 === 0) {
			const preferred = this.currentFrame % 150 === 0 ? HEAVY : LIGHT;
			if (!this.canStartCpuMove(preferred)) return;
			this.p2Move = {
				...preferred,
				damage: this.scaledDamage(preferred.damage, this.p2Fighter)
			};
			this.p2State = FighterState.Startup;
			this.p2StateFrameCounter = 0;
		} else this.p2Animation = "idle";
		this.clampP2();
	}
	canStartCpuMove(move) {
		const candidate = move;
		if (!candidate) return false;
		const distance = Math.hypot(this.p2X - this.p1X, this.p2Z - this.p1Z);
		return distance >= (candidate.minRange ?? 0) && distance <= (candidate.maxRange ?? 3);
	}
	scaledDamage(base, fighter) {
		return Math.max(1, Math.round(base * (fighter.strength / 90)));
	}
	tryHit(attackerIsP1, move) {
		if (this.suppressInternalHit) {
			this.suppressInternalHit = false;
			return;
		}
		const hitbox = move.hitbox ?? this.legacyHitbox(move);
		const attackerX = attackerIsP1 ? this.p1X : this.p2X;
		const attackerZ = attackerIsP1 ? this.p1Z : this.p2Z;
		const attackerFacing = attackerIsP1 ? this.p1Facing : this.p2Facing;
		const defenderX = attackerIsP1 ? this.p2X : this.p1X;
		const defenderZ = attackerIsP1 ? this.p2Z : this.p1Z;
		const defenderGuard = attackerIsP1 ? this.p2Guard : this.p1Guard;
		const centerX = attackerX + attackerFacing * hitbox.offsetX;
		const centerZ = attackerZ + hitbox.offsetZ;
		const xOverlap = Math.abs(centerX - defenderX) <= (hitbox.width + this.hurtbox.width) * .5;
		const zOverlap = Math.abs(centerZ - defenderZ) <= (hitbox.depth + this.hurtbox.depth) * .5;
		if (!xOverlap || !zOverlap) return;
		const attacker = attackerIsP1 ? this.p1Fighter : this.p2Fighter;
		const defenderPoise = attackerIsP1 ? this.p2Poise : this.p1Poise;
		const damage = this.scaledDamage(hitbox.damage || move.damage, attacker);
		const push = hitbox.pushback || move.pushback;
		if (attackerIsP1) {
			this.p2Health = Math.max(0, this.p2Health - damage);
			this.p2State = defenderGuard ? FighterState.Blockstun : FighterState.Hitstun;
			this.p2Animation = defenderGuard ? "block" : "hit";
			if (defenderGuard) this.p2Blockstun = hitbox.blockstun || move.blockstun || 9;
			else {
				this.p2Hitstun = hitbox.hitstun || move.hitstun || 15;
				this.p2Poise = Math.max(0, defenderPoise - Math.max(1, Math.round(damage / 100)));
			}
			this.p2X += this.p1Facing * push;
		} else {
			this.p1Health = Math.max(0, this.p1Health - damage);
			this.state = defenderGuard ? FighterState.Blockstun : FighterState.Hitstun;
			this.p1Animation = defenderGuard ? "block" : "hit";
			if (defenderGuard) this.p1Blockstun = hitbox.blockstun || move.blockstun || 9;
			else {
				this.p1Hitstun = hitbox.hitstun || move.hitstun || 15;
				this.p1Poise = Math.max(0, this.p1Poise - Math.max(1, Math.round(damage / 100)));
			}
			this.p1X += this.p2Facing * push;
		}
		this.hitStopFrames = Math.max(this.hitStopFrames, hitStopFramesForImpact(damage));
		if (attackerIsP1 && this.p2Poise <= 0) this.p2Animation = "ko";
		if (!attackerIsP1 && this.p1Poise <= 0) this.p1Animation = "ko";
		if (attackerIsP1 && this.p2Health <= 0) {
			this.p2State = FighterState.KO;
			this.p2Animation = "ko";
		}
		if (!attackerIsP1 && this.p1Health <= 0) {
			this.state = FighterState.KO;
			this.p1Animation = "ko";
		}
	}
	legacyHitbox(move) {
		return {
			offsetX: .9,
			offsetZ: 0,
			width: 1.2,
			depth: .8,
			damage: move.damage,
			hitstun: move.hitstun ?? 15,
			blockstun: move.blockstun ?? 9,
			pushback: move.pushback,
			launch: 0
		};
	}
	resolveBodySeparation() {
		const dx = this.p2X - this.p1X;
		const dz = this.p2Z - this.p1Z;
		const distance = Math.hypot(dx, dz);
		const minimum = .72;
		if (distance <= 0 || distance >= minimum) return;
		const nx = dx / distance;
		const nz = dz / distance;
		const correction = (minimum - distance) * .5;
		this.p1X -= nx * correction;
		this.p1Z -= nz * correction;
		this.p2X += nx * correction;
		this.p2Z += nz * correction;
		this.clampP1();
		this.clampP2();
	}
	updateFacing() {
		if (this.p2X > this.p1X + .01) {
			this.p1Facing = 1;
			this.p2Facing = -1;
		} else if (this.p2X < this.p1X - .01) {
			this.p1Facing = -1;
			this.p2Facing = 1;
		}
	}
	clampP1() {
		this.p1X = Math.max(-this.arenaX, Math.min(this.arenaX, this.p1X));
		this.p1Z = Math.max(-this.arenaZ, Math.min(this.arenaZ, this.p1Z));
	}
	clampP2() {
		this.p2X = Math.max(-this.arenaX, Math.min(this.arenaX, this.p2X));
		this.p2Z = Math.max(-this.arenaZ, Math.min(this.arenaZ, this.p2Z));
	}
};
function FeedbackBubble({ event, onExpire }) {
	const timerRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		timerRef.current = setTimeout(() => onExpire(event.id), 1200);
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, [event.id, onExpire]);
	const isBlocked = event.isBlocked;
	const isCounter = event.isCounter;
	let label = "";
	let color = "#facc15";
	let size = "text-lg";
	if (isBlocked) {
		label = "BLOCKED";
		color = "#94a3b8";
		size = "text-sm";
	} else if (isCounter) {
		label = "COUNTER!";
		color = "#f97316";
		size = "text-xl";
	} else if (event.damage >= 500) {
		label = `${event.damage}`;
		color = "#ef4444";
		size = "text-2xl";
	} else if (event.damage >= 200) {
		label = `${event.damage}`;
		color = "#f97316";
		size = "text-xl";
	} else {
		label = `${event.damage}`;
		color = "#facc15";
		size = "text-lg";
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "absolute pointer-events-none z-50 flex flex-col items-center gap-0.5",
		style: {
			left: `${event.x}%`,
			top: `${event.y}%`,
			transform: "translate(-50%, -50%)",
			animation: "feedbackFloat 1.2s ease-out forwards"
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-[8px] font-mono text-zinc-400 tracking-widest whitespace-nowrap",
				children: event.moveName.toUpperCase()
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: `font-black font-mono leading-none ${size}`,
				style: {
					color,
					textShadow: `0 0 12px ${color}88, 0 2px 8px rgba(0,0,0,0.8)`
				},
				children: label
			}),
			isCounter && !isBlocked && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-[7px] font-black font-mono text-orange-400 tracking-[0.3em] border border-orange-700 px-1 bg-orange-950/60",
				children: "PUNISH"
			})
		]
	});
}
function MoveExecutionFeedback({ events, onExpire }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: `
        @keyframes feedbackFloat {
          0%   { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
          20%  { opacity: 1; transform: translate(-50%, -60%) scale(1); }
          80%  { opacity: 0.8; transform: translate(-50%, -80%) scale(0.9); }
          100% { opacity: 0; transform: translate(-50%, -100%) scale(0.8); }
        }
      ` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "absolute inset-0 pointer-events-none z-40",
		children: events.map((event) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeedbackBubble, {
			event,
			onExpire
		}, event.id))
	})] });
}
/**
* useInputBuffer — snapshot-based touch input buffer for Brutal Fist mobile controls.
*
* Returns a stable buffer object with two methods:
*   push(snapshot)  → enqueue a full InputBitmask snapshot
*   drain()         → dequeue and return all pending snapshots in FIFO order
*
* Used by MobileControls to guarantee that simultaneous D-pad + button presses
* are never silently dropped on mobile. Every pointer event pushes a full
* InputBitmask snapshot; the rAF drain loop in MobileControls flushes them
* each animation frame.
*
* Architecture:
*  - push()  → called on every pointer event (pointerdown / pointerup / drag)
*  - drain() → called once per rAF tick; returns all queued snapshots in order
*  - Fixed-size ring buffer (BUFFER_FRAMES) so allocation is O(1) and GC
*    pressure stays zero during gameplay.
*
* STABILITY GUARANTEE:
*  - The buffer object is created exactly once using a module-level singleton
*    per hook instance, stored in useRef. This guarantees push() and drain()
*    are always defined regardless of React Strict Mode double-invocations,
*    render cycles, or hot-module replacement.
*/
/** Number of snapshot frames to retain in the buffer (10 frames @ 60 fps ≈ 167 ms). */
var BUFFER_FRAMES = 10;
/**
* Returns a stable InputBuffer object with push() and drain() methods.
*
* Implementation uses a plain array queue (not a ring buffer) for maximum
* clarity and reliability. The array is bounded to BUFFER_FRAMES entries.
*
* The buffer object is created once via lazy useRef initialization and never
* recreated — identity is stable across all renders and React Strict Mode
* double-invocations.
*/
function useInputBuffer() {
	const bufferRef = (0, import_react.useRef)(null);
	if (bufferRef.current === null) {
		const queue = [];
		bufferRef.current = {
			push(snapshot) {
				if (queue.length >= BUFFER_FRAMES) queue.shift();
				queue.push({
					snapshot: { ...snapshot },
					ts: typeof performance !== "undefined" ? performance.now() : Date.now()
				});
			},
			drain() {
				if (queue.length === 0) return [];
				return queue.splice(0, queue.length);
			}
		};
	}
	return bufferRef.current;
}
/**
* MobileControls — Tekken 4-limb touch input overlay.
*
* Button layout (Tekken limb system):
*   1 (LP) = Left Punch  → Square/X
*   2 (RP) = Right Punch → Triangle/Y
*   3 (LK) = Left Kick   → Cross/A
*   4 (RK) = Right Kick  → Circle/B
*
* Combination inputs (multi-touch simultaneous press):
*   1+3 (LP+LK) → Left Throw
*   2+4 (RP+RK) → Right Throw
*   2+3 (RP+LK) → Heat Burst
*   1+2 (LP+RP) → Parry / Heavy Strike
*   3+4 (LK+RK) → Heavy Kick Combo
*
* INPUT BUFFERING:
*   Every pointer event pushes a full InputBitmask snapshot into a 10-frame
*   ring-buffer via useInputBuffer(). The game loop (or a rAF drain loop here)
*   consumes the queue in order so simultaneous D-pad + button presses that
*   arrive in the same browser event batch are never silently dropped.
*
* CRITICAL pointer-events layering:
* - The outer wrapper uses pointer-events: none so it doesn't block the 3D canvas.
* - Each individual button/pad element uses pointer-events: auto so touches register.
*/
function MobileControls({ inputRef }) {
	const buffer = useInputBuffer();
	const activePointers = (0, import_react.useRef)(/* @__PURE__ */ new Map());
	const heldLimbs = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	const heldDirs = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	const COMBO_WINDOW_MS = 80;
	const limbPressTime = (0, import_react.useRef)({});
	/** Build a full InputBitmask snapshot from current held state. */
	const buildSnapshot = (0, import_react.useCallback)(() => {
		const held = heldLimbs.current;
		const dirs = heldDirs.current;
		performance.now();
		const lp = held.has("lp");
		const rp = held.has("rp");
		const lk = held.has("lk");
		const rk = held.has("rk");
		const lpRpSimult = lp && rp && Math.abs((limbPressTime.current.lp ?? 0) - (limbPressTime.current.rp ?? 0)) <= COMBO_WINDOW_MS;
		const lkRkSimult = lk && rk && Math.abs((limbPressTime.current.lk ?? 0) - (limbPressTime.current.rk ?? 0)) <= COMBO_WINDOW_MS;
		const lpLkSimult = lp && lk && Math.abs((limbPressTime.current.lp ?? 0) - (limbPressTime.current.lk ?? 0)) <= COMBO_WINDOW_MS;
		const rpRkSimult = rp && rk && Math.abs((limbPressTime.current.rp ?? 0) - (limbPressTime.current.rk ?? 0)) <= COMBO_WINDOW_MS;
		const rpLkSimult = rp && lk && Math.abs((limbPressTime.current.rp ?? 0) - (limbPressTime.current.lk ?? 0)) <= COMBO_WINDOW_MS;
		const snapshot = {
			up: dirs.has("up"),
			down: dirs.has("down"),
			left: dirs.has("left"),
			right: dirs.has("right"),
			guard: dirs.has("guard"),
			grapple: dirs.has("grapple"),
			lp,
			rp,
			lk,
			rk,
			heatBurst: rpLkSimult,
			leftThrow: lpLkSimult && !rpLkSimult,
			rightThrow: rpRkSimult && !rpLkSimult,
			heavy: rp || rk || lpRpSimult || lkRkSimult,
			light: (lp || lk) && !lpLkSimult && !rpLkSimult
		};
		const activeInputs = [];
		if (snapshot.up) activeInputs.push("UP");
		if (snapshot.down) activeInputs.push("DOWN");
		if (snapshot.left) activeInputs.push("LEFT");
		if (snapshot.right) activeInputs.push("RIGHT");
		if (snapshot.lp) activeInputs.push("LP(1)");
		if (snapshot.rp) activeInputs.push("RP(2)");
		if (snapshot.lk) activeInputs.push("LK(3)");
		if (snapshot.rk) activeInputs.push("RK(4)");
		if (snapshot.light) activeInputs.push("LIGHT");
		if (snapshot.heavy) activeInputs.push("HEAVY");
		if (snapshot.guard) activeInputs.push("GUARD");
		if (snapshot.grapple) activeInputs.push("GRAPPLE");
		if (snapshot.heatBurst) activeInputs.push("HEAT_BURST(2+3)");
		if (snapshot.leftThrow) activeInputs.push("LEFT_THROW(1+3)");
		if (snapshot.rightThrow) activeInputs.push("RIGHT_THROW(2+4)");
		if (activeInputs.length > 0) console.log(`[MobileControls] 🎮 INPUT → [${activeInputs.join(" | ")}]`);
		return snapshot;
	}, []);
	(0, import_react.useEffect)(() => {
		let rafId;
		const drain = () => {
			if (typeof buffer.drain === "function") {
				const frames = buffer.drain();
				if (frames.length > 0 && inputRef.current) {
					const latest = frames[frames.length - 1].snapshot;
					Object.assign(inputRef.current, latest);
				}
			}
			rafId = requestAnimationFrame(drain);
		};
		rafId = requestAnimationFrame(drain);
		return () => cancelAnimationFrame(rafId);
	}, [buffer, inputRef]);
	const commitSnapshot = (0, import_react.useCallback)(() => {
		buffer.push(buildSnapshot());
	}, [buffer, buildSnapshot]);
	const handleLimbDown = (0, import_react.useCallback)((limb, inputKey) => (e) => {
		e.preventDefault();
		e.stopPropagation();
		activePointers.current.set(e.pointerId, inputKey);
		heldLimbs.current.add(limb);
		limbPressTime.current[limb] = performance.now();
		commitSnapshot();
	}, [commitSnapshot]);
	const handleLimbUp = (0, import_react.useCallback)((limb, inputKey) => (e) => {
		e.preventDefault();
		e.stopPropagation();
		activePointers.current.delete(e.pointerId);
		heldLimbs.current.delete(limb);
		commitSnapshot();
	}, [commitSnapshot]);
	const handleDirDown = (0, import_react.useCallback)((key) => (e) => {
		e.preventDefault();
		e.stopPropagation();
		heldDirs.current.add(key);
		commitSnapshot();
	}, [commitSnapshot]);
	const handleDirUp = (0, import_react.useCallback)((key) => (e) => {
		e.preventDefault();
		e.stopPropagation();
		heldDirs.current.delete(key);
		commitSnapshot();
	}, [commitSnapshot]);
	const dpadRef = (0, import_react.useRef)(null);
	const DEAD_ZONE = 16;
	useGesture({ onDrag: ({ xy: [x, y], event, first, last, target }) => {
		event.preventDefault();
		if (!dpadRef.current) return;
		const rect = dpadRef.current.getBoundingClientRect();
		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;
		const dx = x - cx;
		const dy = y - cy;
		if (last) {
			heldDirs.current.delete("up");
			heldDirs.current.delete("down");
			heldDirs.current.delete("left");
			heldDirs.current.delete("right");
			commitSnapshot();
			return;
		}
		if (Math.sqrt(dx * dx + dy * dy) < DEAD_ZONE) {
			heldDirs.current.delete("up");
			heldDirs.current.delete("down");
			heldDirs.current.delete("left");
			heldDirs.current.delete("right");
		} else {
			if (dy < -16) heldDirs.current.add("up");
			else heldDirs.current.delete("up");
			if (dy > DEAD_ZONE) heldDirs.current.add("down");
			else heldDirs.current.delete("down");
			if (dx < -16) heldDirs.current.add("left");
			else heldDirs.current.delete("left");
			if (dx > DEAD_ZONE) heldDirs.current.add("right");
			else heldDirs.current.delete("right");
		}
		commitSnapshot();
	} }, {
		target: dpadRef,
		drag: {
			pointer: { touch: true },
			preventDefault: true
		}
	});
	const btnBase = "flex items-center justify-center select-none touch-none active:opacity-70 transition-opacity";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "absolute bottom-4 left-0 w-full px-4 flex justify-between items-end z-50",
		style: { pointerEvents: "none" },
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			ref: dpadRef,
			className: "relative w-36 h-36",
			style: {
				pointerEvents: "auto",
				touchAction: "none"
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: `${btnBase} absolute top-0 left-1/2 -translate-x-1/2 w-12 h-12 bg-slate-800/80 border-2 border-slate-700 rounded-t-lg text-slate-300 text-xl font-bold`,
					style: { pointerEvents: "auto" },
					onPointerDown: handleDirDown("up"),
					onPointerUp: handleDirUp("up"),
					onPointerLeave: handleDirUp("up"),
					onPointerCancel: handleDirUp("up"),
					children: "↑"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: `${btnBase} absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-12 bg-slate-800/80 border-2 border-slate-700 rounded-b-lg text-slate-300 text-xl font-bold`,
					style: { pointerEvents: "auto" },
					onPointerDown: handleDirDown("down"),
					onPointerUp: handleDirUp("down"),
					onPointerLeave: handleDirUp("down"),
					onPointerCancel: handleDirUp("down"),
					children: "↓"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: `${btnBase} absolute top-1/2 left-0 -translate-y-1/2 w-12 h-12 bg-slate-800/80 border-2 border-slate-700 rounded-l-lg text-slate-300 text-xl font-bold`,
					style: { pointerEvents: "auto" },
					onPointerDown: handleDirDown("left"),
					onPointerUp: handleDirUp("left"),
					onPointerLeave: handleDirUp("left"),
					onPointerCancel: handleDirUp("left"),
					children: "←"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: `${btnBase} absolute top-1/2 right-0 -translate-y-1/2 w-12 h-12 bg-slate-800/80 border-2 border-slate-700 rounded-r-lg text-slate-300 text-xl font-bold`,
					style: { pointerEvents: "auto" },
					onPointerDown: handleDirDown("right"),
					onPointerUp: handleDirUp("right"),
					onPointerLeave: handleDirUp("right"),
					onPointerCancel: handleDirUp("right"),
					children: "→"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-slate-900 border-2 border-slate-950",
					style: { pointerEvents: "none" }
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative w-56 h-48",
			style: {
				pointerEvents: "auto",
				touchAction: "none"
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: `${btnBase} absolute left-4 top-0 w-14 h-14 rounded-full border-2 text-white font-black text-base shadow-lg`,
					style: {
						background: "rgba(168,85,247,0.75)",
						borderColor: "rgba(196,132,252,0.7)",
						boxShadow: "0 0 12px rgba(168,85,247,0.4)",
						pointerEvents: "auto"
					},
					onPointerDown: handleLimbDown("rp", "heavy"),
					onPointerUp: handleLimbUp("rp", "heavy"),
					onPointerLeave: handleLimbUp("rp", "heavy"),
					onPointerCancel: handleLimbUp("rp", "heavy"),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col items-center leading-none",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[11px] font-black",
							children: "2"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[6px] text-purple-200 tracking-wide",
							children: "RP"
						})]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: `${btnBase} absolute right-0 top-4 w-14 h-14 rounded-full border-2 text-white font-black text-base shadow-lg`,
					style: {
						background: "rgba(239,68,68,0.75)",
						borderColor: "rgba(252,165,165,0.7)",
						boxShadow: "0 0 12px rgba(239,68,68,0.4)",
						pointerEvents: "auto"
					},
					onPointerDown: handleLimbDown("rk", "heavy"),
					onPointerUp: handleLimbUp("rk", "heavy"),
					onPointerLeave: handleLimbUp("rk", "heavy"),
					onPointerCancel: handleLimbUp("rk", "heavy"),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col items-center leading-none",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[11px] font-black",
							children: "4"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[6px] text-red-200 tracking-wide",
							children: "RK"
						})]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: `${btnBase} absolute left-0 bottom-8 w-14 h-14 rounded-full border-2 text-white font-black text-base shadow-lg`,
					style: {
						background: "rgba(37,99,235,0.75)",
						borderColor: "rgba(147,197,253,0.7)",
						boxShadow: "0 0 12px rgba(37,99,235,0.4)",
						pointerEvents: "auto"
					},
					onPointerDown: handleLimbDown("lp", "light"),
					onPointerUp: handleLimbUp("lp", "light"),
					onPointerLeave: handleLimbUp("lp", "light"),
					onPointerCancel: handleLimbUp("lp", "light"),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col items-center leading-none",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[11px] font-black",
							children: "1"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[6px] text-blue-200 tracking-wide",
							children: "LP"
						})]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: `${btnBase} absolute right-4 bottom-4 w-14 h-14 rounded-full border-2 text-white font-black text-base shadow-lg`,
					style: {
						background: "rgba(5,150,105,0.75)",
						borderColor: "rgba(110,231,183,0.7)",
						boxShadow: "0 0 12px rgba(5,150,105,0.4)",
						pointerEvents: "auto"
					},
					onPointerDown: handleLimbDown("lk", "light"),
					onPointerUp: handleLimbUp("lk", "light"),
					onPointerLeave: handleLimbUp("lk", "light"),
					onPointerCancel: handleLimbUp("lk", "light"),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col items-center leading-none",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[11px] font-black",
							children: "3"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[6px] text-emerald-200 tracking-wide",
							children: "LK"
						})]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: `${btnBase} absolute left-1/2 -translate-x-1/2 top-0 w-10 h-8 rounded border-2 text-white font-black text-xs shadow`,
					style: {
						background: "rgba(71,85,105,0.80)",
						borderColor: "rgba(148,163,184,0.6)",
						pointerEvents: "auto"
					},
					onPointerDown: handleDirDown("guard"),
					onPointerUp: handleDirUp("guard"),
					onPointerLeave: handleDirUp("guard"),
					onPointerCancel: handleDirUp("guard"),
					children: "G"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: `${btnBase} absolute left-1/2 -translate-x-1/2 bottom-0 w-10 h-8 rounded border-2 text-white font-black text-[10px] shadow`,
					style: {
						background: "rgba(109,40,217,0.80)",
						borderColor: "rgba(196,132,252,0.6)",
						pointerEvents: "auto"
					},
					onPointerDown: handleDirDown("grapple"),
					onPointerUp: handleDirUp("grapple"),
					onPointerLeave: handleDirUp("grapple"),
					onPointerCancel: handleDirUp("grapple"),
					children: "GR"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute -bottom-5 left-0 right-0 text-center text-[5px] text-zinc-600 tracking-wide",
					style: { pointerEvents: "none" },
					children: "1+3=THROW · 2+4=THROW · 2+3=HEAT"
				})
			]
		})]
	});
}
/**
* useSoundEffects — Web Audio API synthesized sound effects
* No external files needed. All sounds generated procedurally.
*/
function useSoundEffects() {
	const ctxRef = (0, import_react.useRef)(null);
	const getCtx = (0, import_react.useCallback)(() => {
		if (typeof window === "undefined") return null;
		if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
		if (ctxRef.current.state === "suspended") ctxRef.current.resume();
		return ctxRef.current;
	}, []);
	/** Short noise burst with envelope */
	const playNoise = (0, import_react.useCallback)((duration, gainPeak, filterFreq, filterQ, pitchShift = 0) => {
		const ctx = getCtx();
		if (!ctx) return;
		const bufferSize = ctx.sampleRate * duration;
		const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
		const source = ctx.createBufferSource();
		source.buffer = buffer;
		const filter = ctx.createBiquadFilter();
		filter.type = "bandpass";
		filter.frequency.value = filterFreq + pitchShift;
		filter.Q.value = filterQ;
		const gain = ctx.createGain();
		const now = ctx.currentTime;
		gain.gain.setValueAtTime(0, now);
		gain.gain.linearRampToValueAtTime(gainPeak, now + .005);
		gain.gain.exponentialRampToValueAtTime(.001, now + duration);
		source.connect(filter);
		filter.connect(gain);
		gain.connect(ctx.destination);
		source.start(now);
		source.stop(now + duration);
	}, [getCtx]);
	/** Tone with envelope */
	const playTone = (0, import_react.useCallback)((freq, duration, gainPeak, type = "square", freqEnd) => {
		const ctx = getCtx();
		if (!ctx) return;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		const now = ctx.currentTime;
		osc.type = type;
		osc.frequency.setValueAtTime(freq, now);
		if (freqEnd !== void 0) osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration);
		gain.gain.setValueAtTime(0, now);
		gain.gain.linearRampToValueAtTime(gainPeak, now + .004);
		gain.gain.exponentialRampToValueAtTime(.001, now + duration);
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start(now);
		osc.stop(now + duration);
	}, [getCtx]);
	return {
		playLightHit: (0, import_react.useCallback)(() => {
			playNoise(.08, .6, 2200, 3, Math.random() * 200 - 100);
			playTone(180, .06, .3, "square", 90);
		}, [playNoise, playTone]),
		playHeavyHit: (0, import_react.useCallback)(() => {
			playNoise(.14, 1, 800, 2, Math.random() * 100 - 50);
			playTone(90, .12, .5, "sawtooth", 40);
			playTone(55, .18, .4, "sine", 30);
		}, [playNoise, playTone]),
		playBlock: (0, import_react.useCallback)(() => {
			playNoise(.06, .4, 3500, 5);
			playTone(320, .05, .25, "square", 280);
		}, [playNoise, playTone]),
		playCounter: (0, import_react.useCallback)(() => {
			playNoise(.1, .8, 1800, 4);
			playTone(440, .08, .4, "sawtooth", 220);
			setTimeout(() => playTone(660, .06, .3, "square", 330), 40);
		}, [playNoise, playTone]),
		playMoveExec: (0, import_react.useCallback)(() => {
			playNoise(.07, .25, 4e3, 8);
		}, [playNoise]),
		playKO: (0, import_react.useCallback)(() => {
			if (!getCtx()) return;
			playTone(55, .6, .9, "sine", 20);
			playNoise(.5, 1.2, 200, 1);
			setTimeout(() => playTone(880, .8, .5, "sine", 440), 80);
			setTimeout(() => playNoise(1.2, .6, 600, .5), 200);
		}, [
			getCtx,
			playTone,
			playNoise
		]),
		playRoundStart: (0, import_react.useCallback)(() => {
			playTone(660, .4, .7, "sine");
			setTimeout(() => playTone(880, .3, .5, "sine"), 150);
			setTimeout(() => playTone(1100, .5, .6, "sine"), 280);
		}, [playTone]),
		playVictory: (0, import_react.useCallback)(() => {
			[
				523,
				659,
				784,
				1047
			].forEach((freq, i) => {
				setTimeout(() => playTone(freq, .3, .6, "square"), i * 120);
			});
		}, [playTone]),
		playGrapple: (0, import_react.useCallback)(() => {
			playNoise(.12, .7, 400, 2);
			playTone(70, .15, .5, "sine", 50);
		}, [playNoise, playTone])
	};
}
var DEFAULT_MOVE_WINDOWS = {
	lightAttack: {
		startup: .12,
		active: .1,
		recovery: .22,
		animation: "lightAttack",
		hitboxStartFrame: 8,
		hitboxEndFrame: 14,
		totalFrames: 26,
		damage: 80
	},
	heavyAttack: {
		startup: .2,
		active: .14,
		recovery: .38,
		animation: "heavyAttack",
		hitboxStartFrame: 12,
		hitboxEndFrame: 20,
		totalFrames: 43,
		damage: 150
	},
	lightKick: {
		startup: .14,
		active: .12,
		recovery: .28,
		animation: "lightKick",
		hitboxStartFrame: 9,
		hitboxEndFrame: 16,
		totalFrames: 32,
		damage: 90,
		specialName: "Left Kick"
	},
	heavyKick: {
		startup: .22,
		active: .16,
		recovery: .42,
		animation: "heavyKick",
		hitboxStartFrame: 13,
		hitboxEndFrame: 22,
		totalFrames: 48,
		damage: 170,
		specialName: "Right Kick"
	}
};
/** Left Throw (1+3): LP+LK */
var LEFT_THROW_MOVE = {
	startup: .08,
	active: .06,
	recovery: .5,
	animation: "heavyAttack",
	hitboxStartFrame: 5,
	hitboxEndFrame: 9,
	totalFrames: 38,
	damage: 180,
	isThrow: true,
	isUnblockable: true,
	specialName: "Left Throw",
	throwComboRoute: []
};
/** Right Throw (2+4): RP+RK */
var RIGHT_THROW_MOVE = {
	startup: .08,
	active: .06,
	recovery: .5,
	animation: "heavyAttack",
	hitboxStartFrame: 5,
	hitboxEndFrame: 9,
	totalFrames: 38,
	damage: 180,
	isThrow: true,
	isUnblockable: true,
	specialName: "Right Throw",
	throwComboRoute: []
};
/** Heat Burst (2+3): RP+LK — activates Heat State */
var HEAT_BURST_MOVE = {
	startup: .15,
	active: .2,
	recovery: .4,
	animation: "heavyAttack",
	hitboxStartFrame: 9,
	hitboxEndFrame: 21,
	totalFrames: 45,
	damage: 120,
	isSpecial: true,
	specialName: "Heat Burst"
};
/** Rage Art (d/f + 1+2): available below 25% HP */
var RAGE_ART_MOVE = {
	startup: .25,
	active: .3,
	recovery: .6,
	animation: "heavyAttack",
	hitboxStartFrame: 15,
	hitboxEndFrame: 33,
	totalFrames: 69,
	damage: 350,
	isSpecial: true,
	isUnblockable: true,
	specialName: "Rage Art"
};
var COMMAND_THROW_MOVE = {
	startup: .1,
	active: .08,
	recovery: .55,
	animation: "heavyAttack",
	hitboxStartFrame: 6,
	hitboxEndFrame: 11,
	totalFrames: 43,
	damage: 220,
	isThrow: true,
	isCommandThrow: true,
	isUnblockable: true,
	grabRange: 1.4,
	specialName: "Command Throw",
	throwComboRoute: ["light", "heavy"]
};
var DEFAULT_SPECIAL_MOVES = [{
	id: "power_surge",
	name: "Power Surge",
	sequence: [
		"heavy",
		"heavy",
		"light"
	],
	move: {
		startup: .18,
		active: .22,
		recovery: .45,
		animation: "heavyAttack",
		hitboxStartFrame: 11,
		hitboxEndFrame: 24,
		totalFrames: 50,
		damage: 280,
		isSpecial: true,
		specialName: "Power Surge"
	}
}, {
	id: "quick_combo",
	name: "Quick Combo",
	sequence: [
		"light",
		"light",
		"heavy"
	],
	move: {
		startup: .1,
		active: .18,
		recovery: .3,
		animation: "lightAttack",
		hitboxStartFrame: 6,
		hitboxEndFrame: 18,
		totalFrames: 35,
		damage: 200,
		isSpecial: true,
		specialName: "Quick Combo"
	}
}];
var KNOCKDOWN_DURATION = 1.2;
var WAKEUP_BUFFER_WINDOW = .8;
var TECH_ROLL_DURATION = .45;
var BACKRISE_DURATION = .55;
var QUICKSTAND_DURATION = .3;
/** HitStun duration = active frames of the attack that landed (in seconds) */
var HITSTUN_ACTIVE_FRAME_MULTIPLIER = 1;
/** Minimum hitstun regardless of attack active frames */
var HITSTUN_MIN = .18;
/** Maximum hitstun cap */
var HITSTUN_MAX = .65;
var WALK_ACCEL = 8;
var WALK_DECEL = 14;
var BACKDASH_VELOCITY = -1;
var BACKDASH_DURATION = .28;
var BACKDASH_DECEL = 6;
/**
* Hysteresis band for walk animation gating.
* Enter walk animation only when velocity exceeds ENTER threshold.
* Exit walk animation (→ idle) only when velocity drops below EXIT threshold.
* The gap between them prevents rapid walk↔idle oscillation (jitter).
*/
var WALK_ANIM_ENTER = .18;
var WALK_ANIM_EXIT = .08;
/** Crossfade duration for walk→idle transition (frames at 60fps) */
var CROSSFADE_WALK_IDLE_FRAMES = 6;
/** Crossfade duration for strafe→backdash transition */
var CROSSFADE_STRAFE_BACKDASH_FRAMES = 4;
/** Crossfade duration for attack transitions */
var CROSSFADE_ATTACK_FRAMES = 3;
/** Crossfade duration for hit/stun transitions */
var CROSSFADE_HIT_FRAMES = 2;
/** Forward input threshold to qualify as "forward" for command throw */
var CMD_THROW_FORWARD_THRESHOLD = .5;
/** Time window (ms) within which forward + guard must be pressed */
var CMD_THROW_WINDOW_MS = 200;
/** Time window (ms) for simultaneous button presses to count as a combination */
var TEKKEN_COMBO_WINDOW_MS = 80;
var FighterStateMachine = class {
	actionState = "Idle";
	motionState = "idle";
	currentMove = null;
	moveTimer = 0;
	moveElapsed = 0;
	FPS = 60;
	queuedAction = null;
	inputBuffer = [];
	/** 10-frame input buffer at 60fps = 167ms. Holds inputs during block stun recovery. */
	BUFFER_WINDOW_MS = 167;
	hitStunTimer = 0;
	/** The attack move that caused this hitstun (for duration calculation) */
	hitStunSourceMove = null;
	stunTimer = 0;
	knockdownTimer = 0;
	wakeupBuffered = null;
	wakeupActionTimer = 0;
	wakeupActionState = null;
	walkVelocity = {
		forward: 0,
		strafe: 0
	};
	backdashTimer = 0;
	isBackdashing = false;
	commandThrowTimer = 0;
	commandThrowSucceeded = false;
	/** Pending combo route after a successful throw */
	throwComboQueue = [];
	throwComboIndex = 0;
	throwComboTimer = 0;
	grabRangeActive = false;
	grabRangeTimer = 0;
	GRAB_RANGE_DISPLAY_DURATION = .35;
	crossfadeActive = false;
	crossfadeFromClip = "idle";
	crossfadeToClip = "idle";
	crossfadeTimer = 0;
	crossfadeDuration = 0;
	inHeatState = false;
	heatTimer = 0;
	HEAT_DURATION = 10;
	/** Set externally by GameBattleArena based on current HP */
	rageArtAvailable = false;
	lpPressTime = 0;
	rpPressTime = 0;
	lkPressTime = 0;
	rkPressTime = 0;
	jumpAirTimer = 0;
	specialMoves = [...DEFAULT_SPECIAL_MOVES];
	prevInput = {
		forward: 0,
		strafe: 0,
		light: false,
		heavy: false,
		guard: false,
		crouch: false,
		grapple: false,
		escape: false,
		lp: false,
		rp: false,
		lk: false,
		rk: false,
		heatBurst: false,
		rageArt: false,
		leftThrow: false,
		rightThrow: false
	};
	forwardPressTime = 0;
	get current() {
		return this.motionState;
	}
	get action() {
		return this.actionState;
	}
	get isRecovering() {
		if (!this.currentMove) return false;
		const recoveryStart = this.currentMove.startup + this.currentMove.active;
		return this.moveElapsed >= recoveryStart;
	}
	get isInAttack() {
		return this.actionState === "Attacking";
	}
	get isStunned() {
		return this.actionState === "Stunned" || this.actionState === "Crumple";
	}
	get isKnockedDown() {
		return this.actionState === "Knockdown";
	}
	get isInHitStun() {
		return this.actionState === "HitStun";
	}
	get isInCommandThrow() {
		return this.actionState === "CommandThrow";
	}
	get isInHeatState() {
		return this.inHeatState;
	}
	/** Whether grab range visualization should be shown */
	get showGrabRange() {
		return this.grabRangeActive;
	}
	/** Grab range radius for visualization */
	get grabRangeRadius() {
		return COMMAND_THROW_MOVE.grabRange ?? 1.4;
	}
	getQueuedAction() {
		if (!this.queuedAction) return null;
		return {
			type: this.queuedAction.type,
			label: {
				light: "L",
				heavy: "H",
				guard: "G",
				grapple: "GR",
				commandThrow: "CT"
			}[this.queuedAction.type] ?? this.queuedAction.type.toUpperCase()
		};
	}
	getRecoveryProgress() {
		if (!this.currentMove || !this.isRecovering) return 0;
		const recoveryStart = this.currentMove.startup + this.currentMove.active;
		const recoveryDuration = this.currentMove.recovery;
		if (recoveryDuration <= 0) return 1;
		return Math.min(1, (this.moveElapsed - recoveryStart) / recoveryDuration);
	}
	/** Returns HitStun progress 0-1 (0 = just entered, 1 = exiting) */
	getHitStunProgress() {
		if (this.actionState !== "HitStun" || !this.hitStunSourceMove) return 0;
		const total = this.computeHitStunDuration(this.hitStunSourceMove);
		if (total <= 0) return 1;
		return Math.min(1, 1 - this.hitStunTimer / total);
	}
	getBufferedWakeup() {
		return this.wakeupBuffered;
	}
	getWalkVelocity() {
		return { ...this.walkVelocity };
	}
	/** Returns throw combo progress info for HUD */
	getThrowComboState() {
		return {
			active: this.throwComboQueue.length > 0 && this.throwComboIndex < this.throwComboQueue.length,
			route: this.throwComboQueue,
			index: this.throwComboIndex
		};
	}
	/** Returns current crossfade state for debug overlay */
	getCrossfadeState() {
		return {
			isCrossfading: this.crossfadeActive,
			fromClip: this.crossfadeFromClip,
			toClip: this.crossfadeToClip,
			progress: this.crossfadeDuration > 0 ? Math.min(1, 1 - this.crossfadeTimer / this.crossfadeDuration) : 0,
			duration: this.crossfadeDuration
		};
	}
	/** Set rage art availability based on current HP percentage */
	setRageArtAvailable(hpPercent) {
		this.rageArtAvailable = hpPercent <= .25;
	}
	registerSpecialMoves(moves) {
		this.specialMoves = [...moves, ...DEFAULT_SPECIAL_MOVES];
	}
	/**
	* Apply HitStun state. Duration is derived from the active frames of the
	* move that landed, clamped between HITSTUN_MIN and HITSTUN_MAX.
	* This replaces the old applyStun for normal hits.
	*/
	applyHitStun(sourceMove, fallbackDuration = .3) {
		const duration = sourceMove ? this.computeHitStunDuration(sourceMove) : Math.max(HITSTUN_MIN, Math.min(HITSTUN_MAX, fallbackDuration));
		this.beginCrossfade(this.motionState, "hit", CROSSFADE_HIT_FRAMES / this.FPS);
		this.actionState = "HitStun";
		this.motionState = "hit";
		this.hitStunTimer = duration;
		this.hitStunSourceMove = sourceMove;
		this.currentMove = null;
		this.moveTimer = 0;
		this.moveElapsed = 0;
		this.queuedAction = null;
		this.walkVelocity = {
			forward: 0,
			strafe: 0
		};
		this.isBackdashing = false;
		this.jumpAirTimer = 0;
		console.log(`[FSM] 💥 HitStun applied — duration=${duration.toFixed(3)}s (active=${sourceMove?.active?.toFixed(3) ?? "N/A"}s)`);
	}
	applyStun(duration, isCrumple = false) {
		if (isCrumple) {
			this.actionState = "Crumple";
			this.motionState = "knockdown";
			this.stunTimer = duration;
			this.currentMove = null;
			this.moveTimer = 0;
			this.moveElapsed = 0;
			this.queuedAction = null;
			this.walkVelocity = {
				forward: 0,
				strafe: 0
			};
			this.isBackdashing = false;
		} else this.applyHitStun(null, duration);
	}
	applyKnockdown() {
		this.actionState = "Knockdown";
		this.motionState = "knockdown";
		this.knockdownTimer = KNOCKDOWN_DURATION;
		this.wakeupBuffered = null;
		this.wakeupActionTimer = 0;
		this.wakeupActionState = null;
		this.currentMove = null;
		this.moveTimer = 0;
		this.moveElapsed = 0;
		this.queuedAction = null;
		this.walkVelocity = {
			forward: 0,
			strafe: 0
		};
		this.isBackdashing = false;
		this.throwComboQueue = [];
		this.throwComboIndex = 0;
		console.log("[FSM] ⬇️ Knockdown — wakeup buffer open in", .3999999999999999.toFixed(2), "s");
	}
	processIncomingHit(move) {
		const isGuarding = this.actionState === "Guard";
		const rawDamage = move.damage ?? 100;
		if (move.isThrow || move.isCommandThrow) {
			console.log("[FSM] 🤜 Throw — guard bypassed, full damage:", rawDamage);
			return {
				blocked: false,
				chipDamage: 0,
				guardBroken: true,
				finalDamage: rawDamage
			};
		}
		if (move.isUnblockable) {
			console.log("[FSM] 💥 Unblockable — guard bypassed, full damage:", rawDamage);
			return {
				blocked: false,
				chipDamage: 0,
				guardBroken: true,
				finalDamage: rawDamage
			};
		}
		if (isGuarding) {
			const chipDamage = Math.max(1, Math.floor(rawDamage * .05));
			console.log(`[FSM] 🛡️ Blocked — chip=${chipDamage} (5% of ${rawDamage})`);
			return {
				blocked: true,
				chipDamage,
				guardBroken: false,
				finalDamage: chipDamage
			};
		}
		return {
			blocked: false,
			chipDamage: 0,
			guardBroken: false,
			finalDamage: rawDamage
		};
	}
	checkGrabRange(selfX, opponentX, opponentActionState) {
		const grabRange = COMMAND_THROW_MOVE.grabRange ?? 1.4;
		const distance = Math.abs(selfX - opponentX);
		const inRange = distance <= grabRange;
		const throwSucceeded = inRange && !(opponentActionState === "WakeupTechRoll" || opponentActionState === "WakeupBackrise" || opponentActionState === "Knockdown");
		this.grabRangeActive = true;
		this.grabRangeTimer = this.GRAB_RANGE_DISPLAY_DURATION;
		console.log(`[FSM] 🤲 Grab range check — dist=${distance.toFixed(2)}, range=${grabRange}, inRange=${inRange}, succeeded=${throwSucceeded}`);
		return {
			inRange,
			distance,
			grabRange,
			throwSucceeded
		};
	}
	getHitboxWindow() {
		if (!this.currentMove || this.actionState !== "Attacking" && this.actionState !== "CommandThrow") return {
			active: false,
			progress: 0,
			move: null,
			currentFrame: 0
		};
		const move = this.currentMove;
		const elapsed = move.startup + move.active + move.recovery - this.moveTimer;
		const currentFrame = Math.floor(elapsed * this.FPS);
		const startFrame = move.hitboxStartFrame ?? Math.floor(move.startup * this.FPS);
		const endFrame = move.hitboxEndFrame ?? Math.floor((move.startup + move.active) * this.FPS);
		const active = currentFrame >= startFrame && currentFrame <= endFrame;
		return {
			active,
			progress: active ? (currentFrame - startFrame) / Math.max(1, endFrame - startFrame) : 0,
			move,
			currentFrame
		};
	}
	update(input, dt) {
		const now = performance.now();
		const resolvedInput = this.resolveTekkenInputs(input, now);
		const risingLight = resolvedInput.light && !this.prevInput.light;
		const risingHeavy = resolvedInput.heavy && !this.prevInput.heavy;
		const risingGuard = resolvedInput.guard && !this.prevInput.guard;
		const risingGrapple = (resolvedInput.grapple ?? false) && !(this.prevInput.grapple ?? false);
		const risingLp = (resolvedInput.lp ?? false) && !(this.prevInput.lp ?? false);
		const risingRp = (resolvedInput.rp ?? false) && !(this.prevInput.rp ?? false);
		const risingLk = (resolvedInput.lk ?? false) && !(this.prevInput.lk ?? false);
		const risingRk = (resolvedInput.rk ?? false) && !(this.prevInput.rk ?? false);
		const risingForwardPos = resolvedInput.forward > .5 && this.prevInput.forward <= .5;
		const risingForwardNeg = resolvedInput.forward < -.5 && this.prevInput.forward >= -.5;
		const risingStrafe = Math.abs(resolvedInput.strafe) > .5 && Math.abs(this.prevInput.strafe) <= .5;
		if (risingForwardPos) this.forwardPressTime = now;
		if (risingLight) this.pushBuffer("light", now);
		if (risingHeavy) this.pushBuffer("heavy", now);
		if (risingGuard) this.pushBuffer("guard", now);
		if (risingGrapple) this.pushBuffer("grapple", now);
		this.prevInput = { ...resolvedInput };
		if (this.crossfadeActive) {
			this.crossfadeTimer = Math.max(0, this.crossfadeTimer - dt);
			if (this.crossfadeTimer <= 0) this.crossfadeActive = false;
		}
		if (this.inHeatState) {
			this.heatTimer = Math.max(0, this.heatTimer - dt);
			if (this.heatTimer <= 0) {
				this.inHeatState = false;
				console.log("[FSM] 🔥 Heat State expired");
			}
		}
		if (this.grabRangeActive) {
			this.grabRangeTimer = Math.max(0, this.grabRangeTimer - dt);
			if (this.grabRangeTimer <= 0) this.grabRangeActive = false;
		}
		if (this.throwComboQueue.length > 0 && this.throwComboIndex < this.throwComboQueue.length) {
			this.throwComboTimer = Math.max(0, this.throwComboTimer - dt);
			if (this.throwComboTimer <= 0) {
				const nextHit = this.throwComboQueue[this.throwComboIndex];
				this.throwComboIndex++;
				console.log(`[FSM] ⛓️ Throw combo chain — hit ${this.throwComboIndex}/${this.throwComboQueue.length}: ${nextHit}`);
				if (nextHit === "light") {
					this.throwComboTimer = DEFAULT_MOVE_WINDOWS.lightAttack.startup + DEFAULT_MOVE_WINDOWS.lightAttack.active + DEFAULT_MOVE_WINDOWS.lightAttack.recovery;
					return this.beginAttack("lightAttack", DEFAULT_MOVE_WINDOWS.lightAttack);
				} else {
					this.throwComboTimer = DEFAULT_MOVE_WINDOWS.heavyAttack.startup + DEFAULT_MOVE_WINDOWS.heavyAttack.active + DEFAULT_MOVE_WINDOWS.heavyAttack.recovery;
					return this.beginAttack("heavyAttack", DEFAULT_MOVE_WINDOWS.heavyAttack);
				}
			}
			return this.motionState;
		} else if (this.throwComboQueue.length > 0 && this.throwComboIndex >= this.throwComboQueue.length) {
			this.throwComboQueue = [];
			this.throwComboIndex = 0;
		}
		if (this.actionState === "Knockdown") {
			this.knockdownTimer = Math.max(0, this.knockdownTimer - dt);
			if (this.knockdownTimer <= WAKEUP_BUFFER_WINDOW && this.wakeupBuffered === null) {
				if (risingForwardPos) {
					this.wakeupBuffered = "quickStand";
					console.log("[FSM] ⬆️ Wakeup buffered: quickStand");
				} else if (risingForwardNeg || risingStrafe) {
					this.wakeupBuffered = "techRoll";
					console.log("[FSM] 🔄 Wakeup buffered: techRoll");
				} else if (risingGuard) {
					this.wakeupBuffered = "backrise";
					console.log("[FSM] ↩️ Wakeup buffered: backrise");
				}
			}
			if (this.knockdownTimer <= 0) return this.executeWakeup(this.wakeupBuffered ?? "quickStand");
			return this.motionState;
		}
		if (this.wakeupActionState !== null) {
			this.wakeupActionTimer = Math.max(0, this.wakeupActionTimer - dt);
			if (this.wakeupActionTimer <= 0) {
				this.wakeupActionState = null;
				this.actionState = "Idle";
				this.motionState = "idle";
				console.log("[FSM] ✅ Wakeup action complete → Idle");
			}
			return this.motionState;
		}
		if (this.actionState === "HitStun") {
			this.hitStunTimer = Math.max(0, this.hitStunTimer - dt);
			if (this.getHitStunProgress() >= .8) {
				if (risingLight && !this.queuedAction) this.queuedAction = { type: "light" };
				if (risingHeavy && !this.queuedAction) this.queuedAction = { type: "heavy" };
				if (risingGuard && !this.queuedAction) this.queuedAction = { type: "guard" };
			}
			if (this.hitStunTimer <= 0) {
				this.hitStunSourceMove = null;
				this.actionState = "Idle";
				this.motionState = "idle";
				console.log("[FSM] ✅ HitStun expired → Idle");
				if (this.queuedAction) {
					const queued = this.queuedAction;
					this.queuedAction = null;
					return this.executeQueuedAction(queued);
				}
			}
			return this.motionState;
		}
		if (this.actionState === "Stunned" || this.actionState === "Crumple") {
			this.stunTimer = Math.max(0, this.stunTimer - dt);
			if (this.stunTimer <= 0) {
				this.actionState = "Idle";
				this.motionState = "idle";
			}
			return this.motionState;
		}
		if (this.actionState === "CommandThrow") {
			this.moveTimer = Math.max(0, this.moveTimer - dt);
			this.moveElapsed += dt;
			if (this.moveTimer <= 0) {
				this.currentMove = null;
				this.actionState = "Idle";
				this.motionState = "idle";
				this.moveElapsed = 0;
				console.log("[FSM] ✅ CommandThrow complete → Idle");
				if (this.commandThrowSucceeded && this.throwComboQueue.length > 0) {
					this.throwComboIndex = 0;
					this.throwComboTimer = .05;
					console.log("[FSM] ⛓️ Starting throw combo chain:", this.throwComboQueue);
				}
				this.commandThrowSucceeded = false;
			}
			return this.motionState;
		}
		if (this.actionState === "ThrowWhiff") {
			this.moveTimer = Math.max(0, this.moveTimer - dt);
			if (this.moveTimer <= 0) {
				this.actionState = "Idle";
				this.motionState = "idle";
				console.log("[FSM] ✅ ThrowWhiff complete → Idle");
			}
			return this.motionState;
		}
		if (this.actionState === "Attacking" && this.currentMove) {
			this.moveTimer = Math.max(0, this.moveTimer - dt);
			this.moveElapsed += dt;
			if (this.isRecovering) {
				if (risingLight && !this.queuedAction) this.queuedAction = { type: "light" };
				if (risingHeavy && !this.queuedAction) this.queuedAction = { type: "heavy" };
				if (risingGuard && !this.queuedAction) this.queuedAction = { type: "guard" };
				if (risingGrapple && !this.queuedAction) this.queuedAction = { type: "grapple" };
			}
			if (this.moveTimer <= 0) {
				this.currentMove = null;
				this.actionState = "Idle";
				this.moveElapsed = 0;
				if (this.queuedAction) {
					const queued = this.queuedAction;
					this.queuedAction = null;
					return this.executeQueuedAction(queued);
				}
			} else return this.motionState;
		}
		if (this.isBackdashing) {
			this.backdashTimer = Math.max(0, this.backdashTimer - dt);
			const decel = BACKDASH_DECEL * dt;
			if (this.walkVelocity.forward < 0) this.walkVelocity.forward = Math.min(0, this.walkVelocity.forward + decel);
			if (this.backdashTimer <= 0) {
				this.isBackdashing = false;
				this.walkVelocity.forward = 0;
				this.beginCrossfade("walkBackward", "idle", CROSSFADE_WALK_IDLE_FRAMES / this.FPS);
				this.actionState = "Idle";
				this.motionState = "idle";
			}
			return this.motionState;
		}
		if (resolvedInput.rageArt && this.rageArtAvailable && this.actionState !== "Attacking") {
			console.log("[FSM] 💢 Rage Art activated!");
			return this.beginAttack("heavyAttack", RAGE_ART_MOVE);
		}
		if (resolvedInput.heatBurst && !this.inHeatState && this.actionState !== "Attacking") {
			console.log("[FSM] 🔥 Heat Burst activated!");
			this.inHeatState = true;
			this.heatTimer = this.HEAT_DURATION;
			return this.beginAttack("heavyAttack", HEAT_BURST_MOVE);
		}
		if (resolvedInput.leftThrow && this.actionState !== "Attacking") {
			console.log("[FSM] 🤜 Left Throw (1+3)");
			return this.beginCommandThrowWithMove(LEFT_THROW_MOVE);
		}
		if (resolvedInput.rightThrow && this.actionState !== "Attacking") {
			console.log("[FSM] 🤛 Right Throw (2+4)");
			return this.beginCommandThrowWithMove(RIGHT_THROW_MOVE);
		}
		if (risingGuard && resolvedInput.forward > CMD_THROW_FORWARD_THRESHOLD) {
			if (now - this.forwardPressTime <= CMD_THROW_WINDOW_MS) {
				console.log("[FSM] 🤲 Command throw input detected (Forward+Guard)");
				return this.beginCommandThrow();
			}
		}
		const special = this.detectSpecialMove(now);
		if (special) {
			this.walkVelocity = {
				forward: 0,
				strafe: 0
			};
			return this.beginAttack(special.move.animation, special.move);
		}
		if (risingLk && !risingLp) {
			this.walkVelocity = {
				forward: 0,
				strafe: 0
			};
			return this.beginAttack("lightKick", DEFAULT_MOVE_WINDOWS.lightKick);
		}
		if (risingRk && !risingRp) {
			this.walkVelocity = {
				forward: 0,
				strafe: 0
			};
			return this.beginAttack("heavyKick", DEFAULT_MOVE_WINDOWS.heavyKick);
		}
		if (risingLp || risingLight && !risingLk && !risingRk) {
			this.walkVelocity = {
				forward: 0,
				strafe: 0
			};
			return this.beginAttack("lightAttack", DEFAULT_MOVE_WINDOWS.lightAttack);
		}
		if (risingRp || risingHeavy && !risingLk && !risingRk) {
			this.walkVelocity = {
				forward: 0,
				strafe: 0
			};
			return this.beginAttack("heavyAttack", DEFAULT_MOVE_WINDOWS.heavyAttack);
		}
		if (resolvedInput.guard) {
			this.actionState = "Guard";
			this.motionState = "guard";
			this.walkVelocity = {
				forward: 0,
				strafe: 0
			};
			return this.motionState;
		}
		if (resolvedInput.jump || this.actionState === "Jumping" || this.jumpAirTimer > 0) {
			if (resolvedInput.jump && this.jumpAirTimer <= 0) this.jumpAirTimer = .55;
			this.jumpAirTimer = Math.max(0, this.jumpAirTimer - dt);
			const airFwd = Math.abs(resolvedInput.forward) > .1 ? Math.sign(resolvedInput.forward) : 0;
			const airStr = Math.abs(resolvedInput.strafe) > .1 ? Math.sign(resolvedInput.strafe) : 0;
			this.walkVelocity.forward = this.smoothVelocity(this.walkVelocity.forward, airFwd, dt);
			this.walkVelocity.strafe = this.smoothVelocity(this.walkVelocity.strafe, airStr, dt);
			if (!resolvedInput.jump && this.jumpAirTimer <= 0) this.actionState = "Idle";
			else {
				this.actionState = "Jumping";
				this.motionState = resolvedInput.forward > .3 ? "jumpForward" : resolvedInput.forward < -.3 ? "jumpBack" : "jump";
				return this.motionState;
			}
		}
		if (resolvedInput.crouch && Math.abs(resolvedInput.forward) < .2 && Math.abs(resolvedInput.strafe) < .2) {
			this.actionState = "Idle";
			this.motionState = "crouch";
			this.walkVelocity = {
				forward: 0,
				strafe: 0
			};
			return this.motionState;
		}
		if (resolvedInput.backdashing && !this.isBackdashing) return this.beginBackdash();
		if (resolvedInput.running) {
			this.actionState = "Walking";
			this.updateWalking(resolvedInput, dt);
			this.motionState = resolvedInput.forward < 0 ? "walkBackward" : "run";
			return this.motionState;
		}
		if (resolvedInput.dashing) {
			this.actionState = "Walking";
			this.updateWalking(resolvedInput, dt);
			this.motionState = "dash";
			return this.motionState;
		}
		if (resolvedInput.forward < -.7 && this.prevInput.forward >= -.3 && !this.isBackdashing && this.actionState !== "Attacking") return this.beginBackdash();
		return this.updateWalking(resolvedInput, dt);
	}
	/**
	* Maps Tekken's 1/2/3/4 limb buttons and combination inputs to the
	* existing light/heavy/guard/throw system.
	*
	* Tekken mapping:
	*   1 (LP) → light attack
	*   2 (RP) → heavy attack
	*   3 (LK) → light attack (kick variant, same slot)
	*   4 (RK) → heavy attack (kick variant, same slot)
	*   1+3 (LP+LK) → left throw
	*   2+4 (RP+RK) → right throw
	*   1+2 (LP+RP) → parry / heavy strike
	*   3+4 (LK+RK) → heavy kick combo
	*   2+3 (RP+LK) → heat burst
	*/
	resolveTekkenInputs(input, now) {
		const resolved = { ...input };
		if (input.lp && !this.prevInput.lp) this.lpPressTime = now;
		if (input.rp && !this.prevInput.rp) this.rpPressTime = now;
		if (input.lk && !this.prevInput.lk) this.lkPressTime = now;
		if (input.rk && !this.prevInput.rk) this.rkPressTime = now;
		const lpActive = input.lp ?? false;
		const rpActive = input.rp ?? false;
		const lkActive = input.lk ?? false;
		const rkActive = input.rk ?? false;
		const lpRpSimult = lpActive && rpActive && Math.abs(this.lpPressTime - this.rpPressTime) <= TEKKEN_COMBO_WINDOW_MS;
		const lkRkSimult = lkActive && rkActive && Math.abs(this.lkPressTime - this.rkPressTime) <= TEKKEN_COMBO_WINDOW_MS;
		const lpLkSimult = lpActive && lkActive && Math.abs(this.lpPressTime - this.lkPressTime) <= TEKKEN_COMBO_WINDOW_MS;
		const rpRkSimult = rpActive && rkActive && Math.abs(this.rpPressTime - this.rkPressTime) <= TEKKEN_COMBO_WINDOW_MS;
		if (rpActive && lkActive && Math.abs(this.rpPressTime - this.lkPressTime) <= TEKKEN_COMBO_WINDOW_MS || input.heatBurst) {
			resolved.heatBurst = true;
			resolved.light = false;
			resolved.heavy = false;
		} else if (lpLkSimult || input.leftThrow) {
			resolved.leftThrow = true;
			resolved.light = false;
		} else if (rpRkSimult || input.rightThrow) {
			resolved.rightThrow = true;
			resolved.heavy = false;
		} else if (lpRpSimult) {
			resolved.heavy = true;
			resolved.light = false;
		} else if (lkRkSimult) {
			resolved.heavy = true;
			resolved.light = false;
		} else {
			if (lpActive || lkActive) resolved.light = true;
			if (rpActive || rkActive) resolved.heavy = true;
		}
		return resolved;
	}
	computeHitStunDuration(move) {
		const activeSeconds = move.active * HITSTUN_ACTIVE_FRAME_MULTIPLIER;
		return Math.max(HITSTUN_MIN, Math.min(HITSTUN_MAX, activeSeconds));
	}
	beginCrossfade(fromClip, toClip, durationSeconds) {
		if (fromClip === toClip) return;
		this.crossfadeActive = true;
		this.crossfadeFromClip = fromClip;
		this.crossfadeToClip = toClip;
		this.crossfadeDuration = durationSeconds;
		this.crossfadeTimer = durationSeconds;
	}
	beginCommandThrowWithMove(move) {
		this.actionState = "CommandThrow";
		this.motionState = "heavyAttack";
		this.currentMove = move;
		this.moveTimer = move.startup + move.active + move.recovery;
		this.moveElapsed = 0;
		this.queuedAction = null;
		this.commandThrowSucceeded = false;
		this.throwComboQueue = [...move.throwComboRoute ?? []];
		this.throwComboIndex = 0;
		this.grabRangeActive = true;
		this.grabRangeTimer = move.startup + move.active;
		return this.motionState;
	}
	beginCommandThrow() {
		this.actionState = "CommandThrow";
		this.motionState = "heavyAttack";
		this.currentMove = COMMAND_THROW_MOVE;
		this.moveTimer = COMMAND_THROW_MOVE.startup + COMMAND_THROW_MOVE.active + COMMAND_THROW_MOVE.recovery;
		this.moveElapsed = 0;
		this.queuedAction = null;
		this.commandThrowSucceeded = false;
		this.throwComboQueue = [...COMMAND_THROW_MOVE.throwComboRoute ?? []];
		this.throwComboIndex = 0;
		this.grabRangeActive = true;
		this.grabRangeTimer = COMMAND_THROW_MOVE.startup + COMMAND_THROW_MOVE.active;
		console.log("[FSM] 🤲 CommandThrow started — grab range:", COMMAND_THROW_MOVE.grabRange);
		return this.motionState;
	}
	/** Called by GameBattleArena when command throw hitbox connects */
	resolveCommandThrow(throwSucceeded) {
		this.commandThrowSucceeded = throwSucceeded;
		if (!throwSucceeded) {
			this.actionState = "ThrowWhiff";
			this.motionState = "idle";
			this.moveTimer = COMMAND_THROW_MOVE.recovery * 1.5;
			this.currentMove = null;
			this.throwComboQueue = [];
			console.log("[FSM] ❌ CommandThrow whiffed — extra recovery penalty");
		} else console.log("[FSM] ✅ CommandThrow connected — combo chain queued:", this.throwComboQueue);
	}
	updateWalking(input, dt) {
		const targetForward = Math.abs(input.forward) > .1 ? Math.sign(input.forward) * Math.min(1, Math.abs(input.forward)) : 0;
		const targetStrafe = Math.abs(input.strafe) > .1 ? Math.sign(input.strafe) * Math.min(1, Math.abs(input.strafe)) : 0;
		const prevForward = this.walkVelocity.forward;
		const prevStrafe = this.walkVelocity.strafe;
		this.walkVelocity.forward = this.smoothVelocity(this.walkVelocity.forward, targetForward, dt);
		this.walkVelocity.strafe = this.smoothVelocity(this.walkVelocity.strafe, targetStrafe, dt);
		const absForward = Math.abs(this.walkVelocity.forward);
		const absStrafe = Math.abs(this.walkVelocity.strafe);
		const exitThreshold = this.actionState === "Walking" || this.actionState === "Backdashing" ? WALK_ANIM_EXIT : WALK_ANIM_ENTER;
		if (!(absForward > exitThreshold || absStrafe > exitThreshold)) {
			if (absForward < .02) this.walkVelocity.forward = 0;
			if (absStrafe < .02) this.walkVelocity.strafe = 0;
			if ((Math.abs(prevForward) > WALK_ANIM_EXIT || Math.abs(prevStrafe) > WALK_ANIM_EXIT) && this.motionState !== "idle") this.beginCrossfade(this.motionState, "idle", CROSSFADE_WALK_IDLE_FRAMES / this.FPS);
			this.actionState = "Idle";
			this.motionState = "idle";
			return this.motionState;
		}
		this.actionState = "Walking";
		const DIRECTION_DOMINANCE_RATIO = 1.15;
		let newMotion = this.motionState;
		const forwardDominant = absForward * DIRECTION_DOMINANCE_RATIO >= absStrafe;
		const strafeDominant = absStrafe * DIRECTION_DOMINANCE_RATIO >= absForward;
		if (forwardDominant && absForward > exitThreshold) {
			if (this.walkVelocity.forward > 0) newMotion = "walkForward";
			else newMotion = "walkBackward";
		} else if (strafeDominant && absStrafe > exitThreshold) {
			if (this.walkVelocity.strafe > 0) newMotion = "strafeRight";
			else newMotion = "strafeLeft";
		}
		if (newMotion !== this.motionState) {
			const crossfadeFrames = (this.motionState === "strafeLeft" || this.motionState === "strafeRight") && newMotion === "walkBackward" ? CROSSFADE_STRAFE_BACKDASH_FRAMES : CROSSFADE_WALK_IDLE_FRAMES;
			this.beginCrossfade(this.motionState, newMotion, crossfadeFrames / this.FPS);
			this.motionState = newMotion;
		}
		return this.motionState;
	}
	smoothVelocity(current, target, dt) {
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
	beginBackdash() {
		this.isBackdashing = true;
		this.backdashTimer = BACKDASH_DURATION;
		this.walkVelocity.forward = BACKDASH_VELOCITY;
		this.walkVelocity.strafe = 0;
		this.beginCrossfade(this.motionState, "walkBackward", CROSSFADE_STRAFE_BACKDASH_FRAMES / this.FPS);
		this.actionState = "Backdashing";
		this.motionState = "walkBackward";
		console.log("[FSM] ↩️ Backdash started");
		return this.motionState;
	}
	executeWakeup(option) {
		this.wakeupBuffered = null;
		this.wakeupActionState = option;
		switch (option) {
			case "techRoll":
				this.actionState = "WakeupTechRoll";
				this.motionState = "walkForward";
				this.wakeupActionTimer = TECH_ROLL_DURATION;
				console.log("[FSM] 🔄 Wakeup: techRoll");
				break;
			case "backrise":
				this.actionState = "WakeupBackrise";
				this.motionState = "walkBackward";
				this.wakeupActionTimer = BACKRISE_DURATION;
				console.log("[FSM] ↩️ Wakeup: backrise");
				break;
			default:
				this.actionState = "WakeupQuickStand";
				this.motionState = "idle";
				this.wakeupActionTimer = QUICKSTAND_DURATION;
				console.log("[FSM] ⬆️ Wakeup: quickStand");
		}
		return this.motionState;
	}
	beginAttack(motion, move) {
		const prevState = this.motionState;
		this.beginCrossfade(this.motionState, motion, CROSSFADE_ATTACK_FRAMES / this.FPS);
		this.actionState = "Attacking";
		this.motionState = motion;
		this.currentMove = move;
		this.moveTimer = move.startup + move.active + move.recovery;
		this.moveElapsed = 0;
		this.queuedAction = null;
		console.log(`[FSM] ⚔️  STATE TRANSITION: "${prevState}" → "${motion}" [${move.specialName ?? (motion === "lightAttack" ? "lightAttack" : "heavyAttack")}] startup=${move.startup.toFixed(3)}s active=${move.active.toFixed(3)}s recovery=${move.recovery.toFixed(3)}s damage=${move.damage ?? "N/A"} isSpecial=${move.isSpecial ?? false}`);
		return motion;
	}
	executeQueuedAction(queued) {
		switch (queued.type) {
			case "light": return this.beginAttack("lightAttack", DEFAULT_MOVE_WINDOWS.lightAttack);
			case "heavy": return this.beginAttack("heavyAttack", DEFAULT_MOVE_WINDOWS.heavyAttack);
			case "commandThrow": return this.beginCommandThrow();
			case "guard":
				this.actionState = "Guard";
				this.motionState = "guard";
				return this.motionState;
			default:
				this.actionState = "Idle";
				this.motionState = "idle";
				return this.motionState;
		}
	}
	pushBuffer(key, now) {
		this.inputBuffer.push({
			key,
			timestamp: now
		});
		const cutoff = now - this.BUFFER_WINDOW_MS;
		this.inputBuffer = this.inputBuffer.filter((e) => e.timestamp >= cutoff);
		if (this.inputBuffer.length > 8) this.inputBuffer.shift();
	}
	detectSpecialMove(now) {
		const cutoff = now - this.BUFFER_WINDOW_MS;
		const recent = this.inputBuffer.filter((e) => e.timestamp >= cutoff);
		for (const special of this.specialMoves) {
			const seq = special.sequence;
			if (recent.length < seq.length) continue;
			const tail = recent.slice(-seq.length);
			if (seq.every((key, i) => tail[i].key === key)) {
				this.inputBuffer = this.inputBuffer.filter((e) => !tail.includes(e));
				return special;
			}
		}
		return null;
	}
};
/** Per-fighter body region hurtboxes (normalized 0–1 height) */
var FIGHTER_HURTBOX_REGIONS = [
	{
		region: "head",
		yMin: .78,
		yMax: 1,
		xHalfWidth: .2,
		damageMultiplier: 1.5
	},
	{
		region: "torso",
		yMin: .45,
		yMax: .78,
		xHalfWidth: .28,
		damageMultiplier: 1
	},
	{
		region: "leftArm",
		yMin: .42,
		yMax: .72,
		xHalfWidth: .4,
		damageMultiplier: .8
	},
	{
		region: "rightArm",
		yMin: .42,
		yMax: .72,
		xHalfWidth: .4,
		damageMultiplier: .8
	},
	{
		region: "leftLeg",
		yMin: 0,
		yMax: .45,
		xHalfWidth: .22,
		damageMultiplier: .7
	},
	{
		region: "rightLeg",
		yMin: 0,
		yMax: .45,
		xHalfWidth: .22,
		damageMultiplier: .7
	}
];
/** Map attack level to primary hurtbox regions it can hit */
var ATTACK_LEVEL_REGIONS = {
	high: ["head", "torso"],
	mid: [
		"torso",
		"leftArm",
		"rightArm"
	],
	low: ["leftLeg", "rightLeg"]
};
var HITBOX_DEFAULTS = {
	lightAttack: {
		offsetX: 1.15,
		offsetZ: 0,
		width: 1.8,
		depth: 1.1,
		damage: 80,
		hitstun: .25,
		blockstun: .15,
		pushback: .3,
		launch: 0,
		isSpecial: false,
		attackLevel: "mid"
	},
	heavyAttack: {
		offsetX: 1.35,
		offsetZ: 0,
		width: 2.1,
		depth: 1.2,
		damage: 150,
		hitstun: .45,
		blockstun: .25,
		pushback: .6,
		launch: .2,
		isSpecial: false,
		attackLevel: "high"
	}
};
var SPECIAL_HITBOX = {
	offsetX: 1,
	offsetZ: 0,
	width: 1.2,
	depth: .9,
	hitstun: .65,
	blockstun: .35,
	pushback: 1,
	launch: .5,
	isSpecial: true,
	attackLevel: "mid"
};
function buildHitboxFromMove(move) {
	const base = HITBOX_DEFAULTS[move.animation] ?? HITBOX_DEFAULTS.lightAttack;
	const special = move.isSpecial ? SPECIAL_HITBOX : {};
	return {
		offsetX: .6,
		offsetZ: 0,
		width: .8,
		depth: .6,
		hitstun: .25,
		blockstun: .15,
		pushback: .3,
		launch: 0,
		isSpecial: false,
		attackLevel: "mid",
		...base,
		...special,
		damage: move.damage ?? base.damage ?? 80
	};
}
/**
* Given an attack level, determine which body region was hit.
* Returns the region with the highest damage multiplier that the attack can reach.
*/
function resolveHitRegion(attackLevel) {
	const primaryRegion = ATTACK_LEVEL_REGIONS[attackLevel][0];
	return {
		region: primaryRegion,
		multiplier: FIGHTER_HURTBOX_REGIONS.find((r) => r.region === primaryRegion)?.damageMultiplier ?? 1
	};
}
/**
* Build hurtbox region state for debug overlay.
* Marks the hit region as wasHit=true.
*/
function buildHurtboxRegionState(hitRegion) {
	return DEFAULT_HURTBOX_REGIONS.map((r) => ({
		...r,
		wasHit: r.region === hitRegion
	}));
}
/**
* Manages per-fighter hitbox state.
* Call update() every frame with the current HitboxWindow from FighterStateMachine.
* Call checkCollision() to test against an opponent's position.
*
* Hitbox only becomes active when the animation reaches the hitboxStartFrame marker.
* Damage is only applied once per active window (no repeated hits per swing).
*/
var FrameDataHitboxSystem = class {
	hitboxGeometry = null;
	hitboxActive = false;
	hitRegisteredThisSwing = false;
	lastActiveFrame = -1;
	/** Last hit region for debug overlay */
	lastHitRegion = null;
	/** Hurtbox region state (updated on each hit) */
	hurtboxRegionState = DEFAULT_HURTBOX_REGIONS.map((r) => ({ ...r }));
	/** Timestamp of last hit for region flash decay */
	lastHitTimestamp = 0;
	REGION_HIT_FLASH_MS = 400;
	/** Current hitbox geometry (null when inactive) */
	get geometry() {
		return this.hitboxActive ? this.hitboxGeometry : null;
	}
	get isActive() {
		return this.hitboxActive;
	}
	/** Get current hurtbox region state for debug overlay */
	getHurtboxRegions() {
		const now = performance.now();
		if (this.lastHitRegion && now - this.lastHitTimestamp > this.REGION_HIT_FLASH_MS) {
			this.lastHitRegion = null;
			this.hurtboxRegionState = DEFAULT_HURTBOX_REGIONS.map((r) => ({
				...r,
				wasHit: false
			}));
		}
		return this.hurtboxRegionState;
	}
	/**
	* Update hitbox state from the state machine's hitbox window.
	* Must be called every frame.
	*/
	update(window) {
		if (!window.active || !window.move) {
			if (this.hitboxActive) {
				this.hitboxActive = false;
				this.hitRegisteredThisSwing = false;
				this.lastActiveFrame = -1;
			}
			return;
		}
		if (window.currentFrame < this.lastActiveFrame) this.hitRegisteredThisSwing = false;
		this.lastActiveFrame = window.currentFrame;
		if (!this.hitboxActive) {
			this.hitboxGeometry = buildHitboxFromMove(window.move);
			this.hitboxActive = true;
		}
	}
	/**
	* Check collision between this fighter's hitbox and an opponent.
	* Resolves which body region was hit and applies the damage multiplier.
	*
	* @param attackerX - Attacker world X
	* @param attackerZ - Attacker world Z
	* @param facing    - Attacker facing direction (1 = right, -1 = left)
	* @param opponentX - Opponent world X
	* @param opponentZ - Opponent world Z
	* @param opponentIsBlocking - Whether opponent is in guard state
	* @param currentFrame - Current animation frame (for logging)
	*/
	checkCollision(attackerX, attackerZ, facing, opponentX, opponentZ, opponentIsBlocking, currentFrame) {
		if (!this.hitboxActive || !this.hitboxGeometry) return null;
		if (this.hitRegisteredThisSwing) return null;
		const hb = this.hitboxGeometry;
		const hbCenterX = attackerX + hb.offsetX * facing;
		const hbCenterZ = attackerZ + hb.offsetZ;
		const dx = Math.abs(opponentX - hbCenterX);
		const dz = Math.abs(opponentZ - hbCenterZ);
		const halfW = (hb.width + 1.1) * .5;
		const halfD = (hb.depth + 1) * .5;
		if (dx > halfW || dz > halfD) return null;
		this.hitRegisteredThisSwing = true;
		const { region: hitRegion, multiplier: regionMultiplier } = resolveHitRegion(hb.attackLevel ?? "mid");
		this.lastHitRegion = hitRegion;
		this.lastHitTimestamp = performance.now();
		this.hurtboxRegionState = buildHurtboxRegionState(hitRegion);
		const baseDamage = opponentIsBlocking ? Math.floor(hb.damage * .15) : hb.damage;
		return {
			hit: true,
			damage: opponentIsBlocking ? baseDamage : Math.round(baseDamage * regionMultiplier),
			hitstun: opponentIsBlocking ? 0 : hb.hitstun,
			blockstun: opponentIsBlocking ? hb.blockstun : 0,
			pushback: hb.pushback,
			launch: opponentIsBlocking ? 0 : hb.launch,
			isSpecial: hb.isSpecial,
			hitFrame: currentFrame,
			hitRegion,
			regionMultiplier: opponentIsBlocking ? 1 : regionMultiplier
		};
	}
	/** Reset for a new round */
	reset() {
		this.hitboxGeometry = null;
		this.hitboxActive = false;
		this.hitRegisteredThisSwing = false;
		this.lastActiveFrame = -1;
		this.lastHitRegion = null;
		this.hurtboxRegionState = DEFAULT_HURTBOX_REGIONS.map((r) => ({
			...r,
			wasHit: false
		}));
	}
};
var COMBO_WINDOW_MS = 2e3;
var BASE_SCALING_PER_HIT = .1;
var MIN_MULTIPLIER = .75;
function createComboState(player) {
	return {
		count: 0,
		damageMultiplier: 1,
		lastHitTime: 0,
		active: false,
		totalDamage: 0,
		player
	};
}
/**
* Register a new hit and update combo state.
* Returns the scaled damage value and updated combo state.
*/
function registerHit(state, rawDamage, now) {
	const timeSinceLast = now - state.lastHitTime;
	const withinWindow = state.active && timeSinceLast <= COMBO_WINDOW_MS;
	let newCount;
	let newMultiplier;
	if (withinWindow) {
		newCount = state.count + 1;
		newMultiplier = Math.max(MIN_MULTIPLIER, 1 - (newCount - 1) * BASE_SCALING_PER_HIT);
	} else {
		newCount = 1;
		newMultiplier = 1;
	}
	const scaledDamage = Math.round(rawDamage * newMultiplier);
	return {
		scaledDamage,
		newState: {
			count: newCount,
			damageMultiplier: newMultiplier,
			lastHitTime: now,
			active: true,
			totalDamage: withinWindow ? state.totalDamage + scaledDamage : scaledDamage,
			player: state.player
		}
	};
}
/**
* Tick the combo system — expire combos that exceed the 2s window.
* Call this every frame.
*/
function tickComboSystem(p1Combo, p2Combo, now) {
	const expireCombo = (combo) => {
		if (!combo.active) return combo;
		if (now - combo.lastHitTime > COMBO_WINDOW_MS) return {
			...combo,
			active: false
		};
		return combo;
	};
	return {
		p1Combo: expireCombo(p1Combo),
		p2Combo: expireCombo(p2Combo)
	};
}
/** Get display label for damage scaling */
function getScalingLabel(multiplier) {
	const pct = Math.round(multiplier * 100);
	if (pct >= 100) return "";
	return `${pct}% DMG`;
}
function ComboCounterHUD({ p1Combo, p2Combo, p1Color, p2Color }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [p1Combo.active && p1Combo.count >= 2 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComboDisplay, {
		combo: p1Combo,
		color: p1Color,
		side: "left"
	}), p2Combo.active && p2Combo.count >= 2 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComboDisplay, {
		combo: p2Combo,
		color: p2Color,
		side: "right"
	})] });
}
function ComboDisplay({ combo, color, side }) {
	const scalingLabel = getScalingLabel(combo.damageMultiplier);
	const isHighCombo = combo.count >= 5;
	const isMidCombo = combo.count >= 3;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "absolute z-40 pointer-events-none",
		style: {
			bottom: "120px",
			left: side === "left" ? "12px" : "auto",
			right: side === "right" ? "12px" : "auto"
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col items-center gap-0.5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "font-black tabular-nums leading-none",
					style: {
						fontSize: isHighCombo ? "3rem" : isMidCombo ? "2.5rem" : "2rem",
						color,
						textShadow: `0 0 20px ${color}, 0 0 40px ${color}66`,
						fontFamily: "monospace"
					},
					children: combo.count
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[8px] font-black tracking-widest",
					style: { color },
					children: "HIT COMBO"
				}),
				scalingLabel && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[7px] tracking-widest px-1.5 py-0.5 border",
					style: {
						color: "#ef4444",
						borderColor: "#ef444444",
						background: "rgba(0,0,0,0.7)"
					},
					children: scalingLabel
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-[7px] text-zinc-400 font-black",
					children: [combo.totalDamage, " TOTAL"]
				})
			]
		})
	});
}
/** Renders the in-arena debug overlay — frame windows, AABB boxes, impact markers, rig state */
function DebugOverlayHUD({ settings, p1Debug, p2Debug }) {
	if (!settings.enabled) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "absolute inset-0 z-45 pointer-events-none font-mono",
		children: [
			settings.showP1 && p1Debug && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FighterDebugPanel, {
				data: p1Debug,
				settings,
				side: "left"
			}),
			settings.showP2 && p2Debug && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FighterDebugPanel, {
				data: p2Debug,
				settings,
				side: "right"
			}),
			settings.showAABB && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AABBVisualization, {
				p1Debug,
				p2Debug,
				settings
			}),
			settings.showHurtboxRegions && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HurtboxRegionVisualization, {
				p1Debug,
				p2Debug,
				settings
			}),
			settings.showImpactMarkers && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [p1Debug?.impactMarkers.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImpactMarkerDot, {
				marker: m,
				side: "right"
			}, m.id)), p2Debug?.impactMarkers.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImpactMarkerDot, {
				marker: m,
				side: "left"
			}, m.id))] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute top-20 left-1/2 transform -translate-x-1/2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[7px] tracking-widest px-2 py-0.5 border border-yellow-500/50 text-yellow-400/70 bg-black/60",
					children: "DEBUG MODE"
				})
			})
		]
	});
}
function FighterDebugPanel({ data, settings, side }) {
	const fw = data.frameWindow;
	const phaseColor = fw ? getPhaseColor(fw.phase) : "#52525b";
	const phaseName = fw ? getPhaseName(fw.phase) : "IDLE";
	const rig = data.rigState;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "absolute bottom-24 text-[8px] bg-black/85 border p-2 space-y-1.5 min-w-[160px] max-w-[200px]",
		style: {
			left: side === "left" ? "8px" : "auto",
			right: side === "right" ? "8px" : "auto",
			borderColor: phaseColor + "88"
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "text-[7px] tracking-widest",
				style: { color: phaseColor },
				children: [
					data.player.toUpperCase(),
					" · ",
					data.actionState
				]
			}),
			settings.showRigState && rig && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-t border-zinc-800 pt-1.5 space-y-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[6px] tracking-widest text-zinc-500",
						children: "GLB RIG STATE"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[7px] text-zinc-400",
							children: "CLIP"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[7px] font-black tracking-wide truncate max-w-[100px]",
							style: { color: rig.isCrossfading ? "#f97316" : "#a3e635" },
							title: rig.activeClip,
							children: rig.isCrossfading ? `${rig.fromClip}→${rig.toClip}` : rig.activeClip
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[7px] text-zinc-400",
							children: "FRAME"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-[7px] font-black text-cyan-400 tabular-nums",
							children: [
								rig.clipFrame,
								"/",
								rig.clipTotalFrames
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[7px] text-zinc-400",
							children: "SPEED"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-[7px] font-black tabular-nums",
							style: { color: rig.playbackSpeed !== 1 ? "#facc15" : "#71717a" },
							children: [rig.playbackSpeed.toFixed(2), "×"]
						})]
					}),
					rig.isCrossfading && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-0.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[6px] text-orange-400",
								children: "XFADE"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-[6px] text-orange-400 tabular-nums",
								children: [Math.round(rig.crossfadeProgress * 100), "%"]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-1.5 bg-zinc-900 border border-zinc-700 overflow-hidden",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-full transition-all duration-75",
								style: {
									width: `${rig.crossfadeProgress * 100}%`,
									background: "#f97316"
								}
							})
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-1.5 bg-zinc-900 border border-zinc-700 overflow-hidden",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-full transition-all duration-75",
							style: {
								width: `${rig.clipFrame / Math.max(1, rig.clipTotalFrames) * 100}%`,
								background: rig.isCrossfading ? "#f97316" : "#a3e635"
							}
						})
					})
				]
			}),
			settings.showFrameWindows && fw && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-t border-zinc-800 pt-1.5 space-y-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[6px] tracking-widest text-zinc-500",
						children: "FRAME DATA"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[7px]",
							style: { color: phaseColor },
							children: phaseName
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-[7px] text-zinc-400",
							children: [
								"F",
								fw.currentFrame,
								"/",
								fw.totalFrames
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "h-3 bg-zinc-900 border border-zinc-700 relative overflow-hidden flex",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-full",
								style: {
									width: `${fw.startupFrames / fw.totalFrames * 100}%`,
									background: "#facc1566",
									borderRight: "1px solid #facc1544"
								}
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-full",
								style: {
									width: `${fw.activeFrames / fw.totalFrames * 100}%`,
									background: "#22c55e66",
									borderRight: "1px solid #22c55e44"
								}
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-full flex-1",
								style: { background: "#ef444466" }
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "absolute top-0 bottom-0 w-0.5",
								style: {
									left: `${fw.currentFrame / fw.totalFrames * 100}%`,
									background: phaseColor,
									boxShadow: `0 0 4px ${phaseColor}`
								}
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2 text-[6px]",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								style: { color: "#facc15" },
								children: ["S:", fw.startupFrames]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								style: { color: "#22c55e" },
								children: ["A:", fw.activeFrames]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								style: { color: "#ef4444" },
								children: ["R:", fw.recoveryFrames]
							})
						]
					})
				]
			}),
			settings.showAABB && data.aabb && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-t border-zinc-800 pt-1 text-[7px] text-zinc-400 space-y-0.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					style: { color: data.aabb.isActive ? "#22c55e" : "#52525b" },
					children: ["AABB ", data.aabb.isActive ? "● ACTIVE" : "○ INACTIVE"]
				}), data.aabb.isActive && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-zinc-500",
					children: [
						data.aabb.width.toFixed(2),
						"w × ",
						data.aabb.depth.toFixed(2),
						"d"
					]
				})]
			})
		]
	});
}
function AABBVisualization({ p1Debug, p2Debug, settings }) {
	const worldToScreenX = (worldX) => {
		return (worldX + 3) / 6 * 80 + 10;
	};
	const worldToWidth = (worldW) => {
		return worldW / 6 * 80;
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "absolute inset-0",
		children: [
			settings.showP1 && p1Debug?.aabb?.isActive && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute border-2",
				style: {
					left: `${worldToScreenX(p1Debug.aabb.centerX) - worldToWidth(p1Debug.aabb.width) / 2}%`,
					top: "30%",
					width: `${worldToWidth(p1Debug.aabb.width)}%`,
					height: "40%",
					borderColor: "#22c55e",
					background: "#22c55e18",
					boxShadow: "0 0 8px #22c55e44"
				},
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute -top-4 left-0 text-[6px] text-green-400 whitespace-nowrap",
					children: "P1 HITBOX"
				})
			}),
			settings.showP2 && p2Debug?.aabb?.isActive && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute border-2",
				style: {
					left: `${worldToScreenX(p2Debug.aabb.centerX) - worldToWidth(p2Debug.aabb.width) / 2}%`,
					top: "30%",
					width: `${worldToWidth(p2Debug.aabb.width)}%`,
					height: "40%",
					borderColor: "#ef4444",
					background: "#ef444418",
					boxShadow: "0 0 8px #ef444444"
				},
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute -top-4 left-0 text-[6px] text-red-400 whitespace-nowrap",
					children: "P2 HITBOX"
				})
			}),
			settings.showP1 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute border border-dashed",
				style: {
					left: `${worldToScreenX(-1.8) - 3}%`,
					top: "20%",
					width: "6%",
					height: "60%",
					borderColor: "#1d4ed844"
				}
			}),
			settings.showP2 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute border border-dashed",
				style: {
					left: `${worldToScreenX(1.8) - 3}%`,
					top: "20%",
					width: "6%",
					height: "60%",
					borderColor: "#dc262644"
				}
			})
		]
	});
}
function HurtboxRegionVisualization({ p1Debug, p2Debug, settings }) {
	const worldToScreenX = (worldX) => (worldX + 3) / 6 * 80 + 10;
	const renderRegions = (regions, worldX, playerColor) => {
		const screenX = worldToScreenX(worldX);
		const fighterTopPct = 18;
		const fighterHeightPct = 62;
		return regions.map((region) => {
			const regionColor = getRegionColor(region.region, region.wasHit);
			const centerY = fighterTopPct + fighterHeightPct * (.5 - region.yOffset * .5);
			const heightPct = region.height * fighterHeightPct;
			const topPct = centerY - heightPct / 2;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute border transition-colors duration-100",
				style: {
					left: `${screenX - 3.5}%`,
					top: `${topPct}%`,
					width: "7%",
					height: `${heightPct}%`,
					borderColor: regionColor + (region.wasHit ? "ff" : "55"),
					background: region.wasHit ? regionColor + "30" : regionColor + "08",
					boxShadow: region.wasHit ? `0 0 6px ${regionColor}88` : "none"
				},
				children: region.wasHit && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute -top-3 left-1/2 -translate-x-1/2 text-[5px] font-black whitespace-nowrap",
					style: { color: regionColor },
					children: "HIT"
				})
			}, region.region);
		});
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "absolute inset-0 pointer-events-none",
		children: [settings.showP1 && p1Debug?.hurtboxRegions && renderRegions(p1Debug.hurtboxRegions, -1.8, "#1d4ed8"), settings.showP2 && p2Debug?.hurtboxRegions && renderRegions(p2Debug.hurtboxRegions, 1.8, "#dc2626")]
	});
}
function ImpactMarkerDot({ marker, side }) {
	const age = Date.now() - marker.timestamp;
	const opacity = Math.max(0, 1 - age / 1500);
	if (opacity <= 0) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "absolute pointer-events-none",
		style: {
			left: `${marker.x}%`,
			top: `${marker.y}%`,
			opacity,
			transform: "translate(-50%, -50%)"
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative w-6 h-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute top-1/2 left-0 right-0 h-px",
					style: { background: marker.isBlocked ? "#facc15" : "#ef4444" }
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute left-1/2 top-0 bottom-0 w-px",
					style: { background: marker.isBlocked ? "#facc15" : "#ef4444" }
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute inset-1 rounded-full border",
					style: { borderColor: marker.isBlocked ? "#facc15" : "#ef4444" }
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "absolute -top-4 left-1/2 transform -translate-x-1/2 text-[7px] font-black whitespace-nowrap",
			style: { color: marker.isBlocked ? "#facc15" : "#ef4444" },
			children: marker.isBlocked ? "BLK" : `-${marker.damage}`
		})]
	});
}
/**
* InputStringRecorder — Records a complete P1 input string (button presses + timing),
* loops playback infinitely so testers can analyze combos and frame-data behavior
* against a fixed opponent pattern.
*
* Architecture:
*   - Records rising-edge button presses with precise timestamps
*   - Stores the full sequence as an InputEvent array
*   - Playback: replays the sequence by injecting inputs into the game's inputRef
*   - Loop mode: restarts from frame 0 after the last input + a configurable gap
*   - Display: shows the input string as a visual notation (Z=light, X=heavy, C=guard, etc.)
*/
var KEY_LABELS = {
	light: "Z",
	heavy: "X",
	guard: "C",
	grapple: "V",
	left: "←",
	right: "→",
	up: "↑",
	down: "↓",
	up_left: "↖",
	up_right: "↗",
	escape: "ESC",
	pin: "PIN"
};
var KEY_COLORS = {
	light: "#60a5fa",
	heavy: "#f87171",
	guard: "#4ade80",
	grapple: "#facc15",
	left: "#a78bfa",
	right: "#a78bfa",
	up: "#a78bfa",
	down: "#a78bfa"
};
function InputStringRecorder({ inputRef, onPlaybackInput }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [isRecording, setIsRecording] = (0, import_react.useState)(false);
	const [isPlaying, setIsPlaying] = (0, import_react.useState)(false);
	const [loopEnabled, setLoopEnabled] = (0, import_react.useState)(true);
	const [loopGapMs, setLoopGapMs] = (0, import_react.useState)(1e3);
	const [savedStrings, setSavedStrings] = (0, import_react.useState)([]);
	const [activeStringId, setActiveStringId] = (0, import_react.useState)(null);
	const [currentLabel, setCurrentLabel] = (0, import_react.useState)("Combo 1");
	const [playbackPos, setPlaybackPos] = (0, import_react.useState)(0);
	const [playbackProgress, setPlaybackProgress] = (0, import_react.useState)(0);
	const recordingRef = (0, import_react.useRef)([]);
	const recordStartRef = (0, import_react.useRef)(0);
	const prevInputRef = (0, import_react.useRef)({
		up: false,
		down: false,
		left: false,
		right: false,
		light: false,
		heavy: false,
		guard: false,
		grapple: false,
		escape: false,
		pin: false
	});
	const playbackTimerRef = (0, import_react.useRef)(null);
	const playbackIndexRef = (0, import_react.useRef)(0);
	const playbackLoopCountRef = (0, import_react.useRef)(0);
	const [loopCount, setLoopCount] = (0, import_react.useState)(0);
	const pollIntervalRef = (0, import_react.useRef)(null);
	const startRecording = (0, import_react.useCallback)(() => {
		recordingRef.current = [];
		recordStartRef.current = performance.now();
		setIsRecording(true);
		pollIntervalRef.current = setInterval(() => {
			const now = performance.now();
			const cur = inputRef.current;
			const prev = prevInputRef.current;
			for (const key of [
				"light",
				"heavy",
				"guard",
				"grapple",
				"left",
				"right",
				"up",
				"down",
				"escape",
				"pin"
			]) {
				const curVal = cur[key] ?? false;
				if (curVal !== (prev[key] ?? false)) recordingRef.current.push({
					key,
					pressed: curVal,
					timestamp: now,
					relativeMs: now - recordStartRef.current
				});
			}
			prevInputRef.current = { ...cur };
		}, 8);
	}, [inputRef]);
	const stopRecording = (0, import_react.useCallback)(() => {
		setIsRecording(false);
		if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
		const events = recordingRef.current;
		if (events.length === 0) return;
		const totalDurationMs = events[events.length - 1].relativeMs + 200;
		const str = {
			id: `input_${Date.now()}`,
			label: currentLabel,
			events,
			totalDurationMs,
			recordedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		setSavedStrings((prev) => [...prev, str]);
		setActiveStringId(str.id);
	}, [currentLabel]);
	const stopPlayback = (0, import_react.useCallback)(() => {
		setIsPlaying(false);
		if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
		playbackIndexRef.current = 0;
		setPlaybackPos(0);
		setPlaybackProgress(0);
	}, []);
	const scheduleNextEvent = (0, import_react.useCallback)((str, index, loopStart) => {
		if (index >= str.events.length) {
			if (loopEnabled) {
				playbackLoopCountRef.current += 1;
				setLoopCount(playbackLoopCountRef.current);
				playbackTimerRef.current = setTimeout(() => {
					playbackIndexRef.current = 0;
					scheduleNextEvent(str, 0, performance.now());
				}, loopGapMs);
			} else stopPlayback();
			return;
		}
		const event = str.events[index];
		const elapsed = performance.now() - loopStart;
		const delay = Math.max(0, event.relativeMs - elapsed);
		playbackTimerRef.current = setTimeout(() => {
			const patch = { [event.key]: event.pressed };
			if (inputRef.current) inputRef.current[event.key] = event.pressed;
			onPlaybackInput?.(patch);
			playbackIndexRef.current = index + 1;
			setPlaybackPos(index + 1);
			setPlaybackProgress((index + 1) / str.events.length);
			scheduleNextEvent(str, index + 1, loopStart);
		}, delay);
	}, [
		loopEnabled,
		loopGapMs,
		inputRef,
		onPlaybackInput,
		stopPlayback
	]);
	const startPlayback = (0, import_react.useCallback)((str) => {
		stopPlayback();
		setIsPlaying(true);
		playbackLoopCountRef.current = 0;
		setLoopCount(0);
		const loopStart = performance.now();
		scheduleNextEvent(str, 0, loopStart);
	}, [stopPlayback, scheduleNextEvent]);
	(0, import_react.useEffect)(() => {
		return () => {
			if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
			if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
		};
	}, []);
	const activeString = savedStrings.find((s) => s.id === activeStringId);
	const buildNotation = (str) => {
		return str.events.filter((e) => e.pressed).map((e) => KEY_LABELS[e.key] ?? e.key.toUpperCase()).join(" → ");
	};
	const exportString = (0, import_react.useCallback)((str) => {
		const blob = new Blob([JSON.stringify(str, null, 2)], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `input_string_${str.id}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "absolute bottom-20 left-3 z-40 font-mono",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			onClick: () => setOpen((o) => !o),
			className: "text-[8px] tracking-widest border border-zinc-700 bg-black/80 text-zinc-400 hover:text-blue-400 hover:border-blue-700 px-2 py-1 transition-colors",
			children: "🎮 INPUT"
		}), open && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "absolute bottom-8 left-0 w-72 border border-zinc-700 bg-black/95 p-3 space-y-2",
			style: { backdropFilter: "blur(8px)" },
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[9px] text-blue-400 tracking-widest font-black",
						children: "INPUT RECORDER"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setOpen(false),
						className: "text-zinc-600 hover:text-zinc-300 text-xs",
						children: "✕"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex gap-1",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "text",
						value: currentLabel,
						onChange: (e) => setCurrentLabel(e.target.value),
						className: "flex-1 bg-zinc-900 border border-zinc-700 text-zinc-300 text-[8px] px-2 py-0.5 font-mono",
						placeholder: "Combo name..."
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex gap-1",
					children: !isRecording ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: startRecording,
						className: "flex-1 text-[8px] font-black border border-red-700 text-red-400 hover:bg-red-900/30 py-1 tracking-widest transition-colors",
						children: "● RECORD"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: stopRecording,
						className: "flex-1 text-[8px] font-black border border-red-500 text-red-300 bg-red-900/20 py-1 tracking-widest animate-pulse",
						children: [
							"■ STOP (",
							recordingRef.current.length,
							" events)"
						]
					})
				}),
				savedStrings.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[7px] text-zinc-500 tracking-wider",
						children: "SAVED STRINGS"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "max-h-32 overflow-y-auto space-y-1",
						children: savedStrings.map((str) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `border p-1.5 cursor-pointer transition-colors ${activeStringId === str.id ? "border-blue-600 bg-blue-950/30" : "border-zinc-800 hover:border-zinc-600"}`,
							onClick: () => setActiveStringId(str.id),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[7px] text-zinc-300 font-black",
									children: str.label
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-[6px] text-zinc-600",
									children: [
										str.events.length,
										" events · ",
										(str.totalDurationMs / 1e3).toFixed(2),
										"s"
									]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-[6px] text-zinc-500 mt-0.5 truncate",
								children: [buildNotation(str).slice(0, 60), buildNotation(str).length > 60 ? "…" : ""]
							})]
						}, str.id))
					})]
				}),
				activeString && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-1.5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border border-zinc-800 bg-zinc-950 p-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[6px] text-zinc-500 mb-1",
								children: "INPUT NOTATION"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-wrap gap-0.5",
								children: activeString.events.filter((e) => e.pressed).map((e, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[7px] font-black px-1 py-0.5 border",
									style: {
										color: KEY_COLORS[e.key] ?? "#a1a1aa",
										borderColor: (KEY_COLORS[e.key] ?? "#52525b") + "88",
										background: (KEY_COLORS[e.key] ?? "#27272a") + "22"
									},
									children: KEY_LABELS[e.key] ?? e.key.toUpperCase()
								}, i))
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex items-center gap-1 cursor-pointer",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: loopEnabled,
									onChange: (e) => setLoopEnabled(e.target.checked),
									className: "accent-blue-400"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[7px] text-zinc-400",
									children: "LOOP ∞"
								})]
							}), loopEnabled && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-1 flex-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[6px] text-zinc-600",
										children: "GAP"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "range",
										min: 200,
										max: 3e3,
										step: 100,
										value: loopGapMs,
										onChange: (e) => setLoopGapMs(Number(e.target.value)),
										className: "flex-1 h-1 accent-blue-400"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-[6px] text-blue-400",
										children: [(loopGapMs / 1e3).toFixed(1), "s"]
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex gap-1",
							children: [!isPlaying ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => startPlayback(activeString),
								className: "flex-1 text-[8px] font-black border border-blue-700 text-blue-400 hover:bg-blue-900/30 py-1 tracking-widest transition-colors",
								children: ["▶ PLAY ", loopEnabled ? "∞" : "1×"]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: stopPlayback,
								className: "flex-1 text-[8px] font-black border border-blue-500 text-blue-300 bg-blue-900/20 py-1 tracking-widest",
								children: "■ STOP"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => exportString(activeString),
								className: "text-[7px] border border-zinc-700 text-zinc-400 hover:text-yellow-400 hover:border-yellow-700 px-2 py-1 transition-colors",
								children: "⬇"
							})]
						}),
						isPlaying && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-0.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-0.5 bg-zinc-800 w-full",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "h-full bg-blue-500 transition-all",
									style: { width: `${playbackProgress * 100}%` }
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex justify-between text-[6px] text-zinc-600",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
									"Event ",
									playbackPos,
									"/",
									activeString.events.length
								] }), loopEnabled && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-blue-400",
									children: ["Loop #", loopCount + 1]
								})]
							})]
						})
					]
				})
			]
		})]
	});
}
/**
* Tekken-style directional commands.
* Camera at +Z: toward cam = down/+Z; away = up/-Z.
*
*  tap up           jump (after the double-tap window, so tap-tap can sidestep)
*  up+forward/back  jump immediately; forward/back still read while airborne
*  double-tap up    sidestep away from camera (-Z)
*  double-tap down  sidestep toward camera (+Z)
*  hold down        crouch
*  f,f              dash; hold after the second tap = run
*  b,b              Korean backdash; hold after the second tap = run back
*/
var DOUBLE_MS = 220;
var HOLD_RUN_MS = 160;
function tap() {
	return {
		last: 0,
		heldSince: 0,
		down: false
	};
}
function createTekkenStick() {
	const f = tap();
	const b = tap();
	const u = tap();
	const d = tap();
	let pendingJump = false;
	let jumpPressAt = 0;
	let jumpUntil = 0;
	let sidestepUpUntil = 0;
	let sidestepDownUntil = 0;
	let dashUntil = 0;
	let backdashUntil = 0;
	const rise = (slot, pressed, now) => {
		const rose = pressed && !slot.down;
		const fell = !pressed && slot.down;
		const dbl = rose && slot.last > 0 && now - slot.last < DOUBLE_MS;
		if (rose) {
			slot.down = true;
			slot.heldSince = now;
			slot.last = now;
		} else if (fell) slot.down = false;
		return {
			rose,
			dbl,
			fell
		};
	};
	return { resolve(held, now) {
		const F = rise(f, held.right, now);
		const B = rise(b, held.left, now);
		const U = rise(u, held.up, now);
		const D = rise(d, held.down, now);
		if (U.dbl) {
			sidestepUpUntil = now + 280;
			pendingJump = false;
			jumpUntil = 0;
		} else if (U.rose && (f.down || b.down)) {
			jumpUntil = now + 480;
			pendingJump = false;
		} else if (U.rose) {
			pendingJump = true;
			jumpPressAt = now;
		} else if (pendingJump && (f.down || b.down)) {
			jumpUntil = now + 480;
			pendingJump = false;
		} else if (pendingJump && now - jumpPressAt >= DOUBLE_MS) {
			jumpUntil = now + 480;
			pendingJump = false;
		}
		if (D.dbl) sidestepDownUntil = now + 280;
		if (F.dbl) dashUntil = now + 320;
		if (B.dbl) backdashUntil = now + 280;
		const sidestepUp = now < sidestepUpUntil;
		const sidestepDown = now < sidestepDownUntil;
		const jumping = now < jumpUntil;
		const running = f.down && now < dashUntil && now - f.heldSince > HOLD_RUN_MS;
		const runBack = b.down && now < backdashUntil && now - b.heldSince > HOLD_RUN_MS;
		const dashing = now < dashUntil && !running;
		const backdashing = now < backdashUntil && !runBack;
		let forward = 0;
		if (running || dashing) forward = 1;
		else if (runBack || backdashing) forward = -1;
		else if (f.down && !b.down) forward = 1;
		else if (b.down && !f.down) forward = -1;
		let strafe = 0;
		if (sidestepUp) strafe = -1;
		else if (sidestepDown) strafe = 1;
		return {
			forward,
			strafe,
			crouch: d.down && !sidestepDown && !jumping,
			jump: jumping,
			dashing: dashing && !running,
			backdashing: backdashing && !runBack,
			running: running || runBack
		};
	} };
}
var DEFAULT_CONFIG = {
	enabled: true,
	volume: .85,
	p1Name: "Player One",
	p2Name: "Player Two"
};
var ANNOUNCER_SCRIPT = {
	getReady: "Get ready for the next battle.",
	round1: "Round 1!",
	round2: "Round 2!",
	round3: "Round 3!",
	finalRound: "Final Round.",
	fight: "Fight!",
	ko: "K.O.!",
	doubleKo: "Double K.O.!",
	perfect: "Perfect!",
	great: "Great!",
	timeUp: "Time Up!",
	draw: "Draw.",
	p1Wins: "",
	p2Wins: "",
	kiCharge: "Ki Charge!",
	chicken: "Chicken!"
};
var LINE_COOLDOWN_MS = {
	ko: 3e3,
	doubleKo: 3e3,
	perfect: 3e3,
	great: 3e3,
	timeUp: 3e3,
	draw: 3e3,
	p1Wins: 3e3,
	p2Wins: 3e3,
	fight: 2e3,
	kiCharge: 2500,
	chicken: 2e3
};
var AnnouncerSystem = class {
	config;
	synth = null;
	lastFiredAt = /* @__PURE__ */ new Map();
	currentUtterance = null;
	audioCtx = null;
	preferredVoice = null;
	voicesLoaded = false;
	constructor(config = {}) {
		this.config = {
			...DEFAULT_CONFIG,
			...config
		};
		if (typeof window !== "undefined") {
			this.synth = window.speechSynthesis;
			this.loadVoices();
		}
	}
	loadVoices() {
		if (!this.synth) return;
		const tryLoad = () => {
			const voices = this.synth.getVoices();
			if (voices.length === 0) return;
			const preferred = voices.find((v) => v.lang.startsWith("en") && (v.name.toLowerCase().includes("male") || v.name.toLowerCase().includes("david") || v.name.toLowerCase().includes("alex") || v.name.toLowerCase().includes("daniel") || v.name.toLowerCase().includes("fred") || v.name.toLowerCase().includes("ralph"))) ?? voices.find((v) => v.lang.startsWith("en")) ?? voices[0];
			this.preferredVoice = preferred ?? null;
			this.voicesLoaded = true;
		};
		tryLoad();
		if (!this.voicesLoaded) this.synth.addEventListener("voiceschanged", tryLoad, { once: true });
	}
	updateConfig(config) {
		this.config = {
			...this.config,
			...config
		};
	}
	/** Fire a specific announcer line */
	fire(line, overrideName) {
		if (!this.config.enabled) return;
		const cooldown = LINE_COOLDOWN_MS[line] ?? 500;
		const lastFired = this.lastFiredAt.get(line) ?? 0;
		if (Date.now() - lastFired < cooldown) return;
		this.lastFiredAt.set(line, Date.now());
		let text = ANNOUNCER_SCRIPT[line];
		if (line === "p1Wins") text = `${overrideName ?? this.config.p1Name} Wins!`;
		if (line === "p2Wins") text = `${overrideName ?? this.config.p2Name} Wins!`;
		this.speak(text, line);
	}
	speak(text, line) {
		if (!this.synth) {
			this.playToneFallback(line);
			return;
		}
		this.synth.cancel();
		const utterance = new SpeechSynthesisUtterance(text);
		utterance.volume = this.config.volume;
		utterance.rate = this.getRate(line);
		utterance.pitch = this.getPitch(line);
		if (this.preferredVoice) utterance.voice = this.preferredVoice;
		this.currentUtterance = utterance;
		this.synth.speak(utterance);
	}
	getRate(line) {
		switch (line) {
			case "fight": return 1.3;
			case "ko": return .9;
			case "doubleKo": return .85;
			case "perfect": return 1;
			case "great": return 1.1;
			case "timeUp": return 1;
			case "kiCharge": return 1.2;
			case "p1Wins":
			case "p2Wins": return .95;
			default: return 1;
		}
	}
	getPitch(line) {
		switch (line) {
			case "fight": return 1.2;
			case "ko": return .7;
			case "doubleKo": return .65;
			case "perfect": return 1.3;
			case "great": return 1.1;
			case "kiCharge": return 1.15;
			case "p1Wins":
			case "p2Wins": return .9;
			default: return .85;
		}
	}
	/** Tone fallback for environments without SpeechSynthesis */
	playToneFallback(line) {
		if (typeof window === "undefined") return;
		if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
		const ctx = this.audioCtx;
		if (ctx.state === "suspended") ctx.resume();
		({
			fight: [
				440,
				660,
				880
			],
			ko: [
				220,
				165,
				110
			],
			doubleKo: [
				220,
				165,
				110,
				82
			],
			perfect: [
				523,
				659,
				784,
				1047
			],
			great: [
				440,
				554,
				659
			],
			timeUp: [
				330,
				294,
				262
			],
			draw: [330, 330],
			kiCharge: [
				440,
				550,
				660
			]
		}[line] ?? [440]).forEach((freq, i) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			const t = ctx.currentTime + i * .12;
			osc.frequency.value = freq;
			osc.type = "sine";
			gain.gain.setValueAtTime(0, t);
			gain.gain.linearRampToValueAtTime(.4, t + .02);
			gain.gain.exponentialRampToValueAtTime(.001, t + .25);
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.start(t);
			osc.stop(t + .25);
		});
	}
	stop() {
		this.synth?.cancel();
		this.currentUtterance = null;
	}
	destroy() {
		this.stop();
		this.audioCtx?.close();
	}
};
var _instance$1 = null;
function getAnnouncerSystem(config) {
	if (!_instance$1) _instance$1 = new AnnouncerSystem(config);
	else if (config) _instance$1.updateConfig(config);
	return _instance$1;
}
var KI_CHARGE_CHIP_MULTIPLIER = .15;
function createKiChargeState() {
	return {
		active: false,
		framesRemaining: 0,
		nextAttackIsCounter: false,
		blockingDisabled: false,
		chipDamageMultiplier: 0
	};
}
/**
* Check if all four limb buttons are pressed simultaneously (1+2+3+4).
* lp=1, rp=2, lk=3, rk=4
*/
function isKiChargeInput(input) {
	return !!(input.lp && input.rp && input.lk && input.rk);
}
/**
* Tick the Ki Charge state machine.
* Call every frame (dt in seconds).
* Returns updated state.
*/
function tickKiCharge(state, input, attackLanded, dt) {
	if (!state.active && isKiChargeInput(input)) return {
		active: true,
		framesRemaining: 120,
		nextAttackIsCounter: true,
		blockingDisabled: true,
		chipDamageMultiplier: KI_CHARGE_CHIP_MULTIPLIER
	};
	if (!state.active) return state;
	if (attackLanded) return createKiChargeState();
	const framesRemaining = state.framesRemaining - dt * 60;
	if (framesRemaining <= 0) return createKiChargeState();
	return {
		...state,
		framesRemaining
	};
}
/**
* Apply Ki Charge counter-hit bonus to damage.
* Counter hits deal 1.25x damage in Tekken.
*/
function applyKiChargeCounterHit(baseDamage) {
	return Math.round(baseDamage * 1.25);
}
/**
* WallSystem — Stage boundary detection, wall-splat knockback, and combo extension frames
*
* Architecture (Night Sky Engine pattern):
*  - Pure data / pure functions — no Three.js, no side effects
*  - Wall collision is checked in the decoupled combat tick
*  - Wall-splat gives attacker BONUS frames to chain a combo
*  - If attacker does NOT chain within the bonus window, defender recovers normally
*
* Tekken wall mechanics:
*  - Stage has left/right X boundaries (WALL_LEFT_X, WALL_RIGHT_X)
*  - When a fighter is knocked into the wall, they "splat" — brief stagger
*  - During wall-splat, attacker gets WALL_SPLAT_BONUS_FRAMES extra frames to continue combo
*  - If attacker chains correctly (hits during bonus window), combo continues
*  - If attacker misses the window, defender recovers with WALL_RECOVERY_FRAMES
*  - Wall-hit knockback pushes the fighter slightly away from the wall
*/
var WALL_LEFT_X = -4.5;
var WALL_RIGHT_X = 4.5;
var WALL_KNOCKBACK_VELOCITY = .08;
function createWallSplatState() {
	return {
		isSplatted: false,
		wall: null,
		splatFramesRemaining: 0,
		comboExtensionActive: false,
		comboExtensionFrames: 0,
		chainedDuringWindow: false,
		splatCount: 0
	};
}
/**
* Check if a fighter's X position has crossed a stage boundary.
* Returns collision result with clamped position and knockback.
*/
function checkWallCollision(x, velocityX) {
	if (x <= -4.5) return {
		hitWall: true,
		wall: "left",
		clampedX: -4.35,
		knockbackVelocityX: WALL_KNOCKBACK_VELOCITY
	};
	if (x >= 4.5) return {
		hitWall: true,
		wall: "right",
		clampedX: 4.35,
		knockbackVelocityX: -.08
	};
	return {
		hitWall: false,
		wall: null,
		clampedX: x,
		knockbackVelocityX: velocityX
	};
}
/**
* Apply wall-splat to a fighter.
* Called when a fighter in hit-stun collides with a wall.
* Returns updated WallSplatState for the defender and triggers combo extension for attacker.
*/
function applyWallSplat(defenderSplat, wall) {
	return {
		isSplatted: true,
		wall,
		splatFramesRemaining: 22,
		comboExtensionActive: true,
		comboExtensionFrames: 18,
		chainedDuringWindow: false,
		splatCount: defenderSplat.splatCount + 1
	};
}
/**
* Tick the wall-splat state each frame.
* Decrements stagger and bonus window counters.
*/
function tickWallSplat(splat) {
	if (!splat.isSplatted && !splat.comboExtensionActive) return splat;
	const newSplatFrames = Math.max(0, splat.splatFramesRemaining - 1);
	const newExtFrames = Math.max(0, splat.comboExtensionFrames - 1);
	return {
		...splat,
		splatFramesRemaining: newSplatFrames,
		comboExtensionFrames: newExtFrames,
		isSplatted: newSplatFrames > 0,
		comboExtensionActive: newExtFrames > 0
	};
}
function createHeatState() {
	return {
		active: false,
		framesRemaining: 0,
		activatedOnBlock: false,
		broken: false,
		breakStaggerFrames: 0,
		inRecovery: false,
		recoveryFrames: 0,
		used: false
	};
}
function createPowerCrushState() {
	return {
		active: false,
		armorActive: false,
		armorFramesRemaining: 0,
		startupFramesRemaining: 0,
		recoveryFramesRemaining: 0,
		chipDamageAbsorbed: 0
	};
}
function createRageArtState() {
	return {
		executing: false,
		usedThisMatch: false,
		available: false,
		cinematicActive: false,
		startupFramesRemaining: 0,
		recoveryFramesRemaining: 0
	};
}
/**
* Tick Heat State each frame.
*/
function tickHeat(heat) {
	if (heat.breakStaggerFrames > 0) return {
		...heat,
		breakStaggerFrames: heat.breakStaggerFrames - 1
	};
	if (heat.inRecovery) {
		const newRecovery = heat.recoveryFrames - 1;
		return {
			...heat,
			recoveryFrames: newRecovery,
			inRecovery: newRecovery > 0
		};
	}
	if (!heat.active) return heat;
	const newFrames = heat.framesRemaining - 1;
	if (newFrames <= 0) return {
		...heat,
		active: false,
		framesRemaining: 0,
		inRecovery: true,
		recoveryFrames: 30
	};
	return {
		...heat,
		framesRemaining: newFrames
	};
}
/**
* Tick Power Crush state each frame.
*/
function tickPowerCrush(pc) {
	if (!pc.active) return pc;
	if (pc.startupFramesRemaining > 0) {
		const newStartup = pc.startupFramesRemaining - 1;
		return {
			...pc,
			startupFramesRemaining: newStartup,
			armorActive: newStartup === 0
		};
	}
	if (pc.armorActive) {
		const newArmor = pc.armorFramesRemaining - 1;
		if (newArmor <= 0) return {
			...pc,
			armorActive: false,
			armorFramesRemaining: 0,
			active: false,
			recoveryFramesRemaining: 38
		};
		return {
			...pc,
			armorFramesRemaining: newArmor
		};
	}
	if (pc.recoveryFramesRemaining > 0) {
		const newRecovery = pc.recoveryFramesRemaining - 1;
		return {
			...pc,
			recoveryFramesRemaining: newRecovery
		};
	}
	return {
		...pc,
		active: false
	};
}
/**
* Update Rage Art availability based on current HP percentage.
*/
function updateRageArtAvailability(rageArt, hpPercent) {
	return {
		...rageArt,
		available: !rageArt.usedThisMatch && hpPercent <= .25
	};
}
/**
* Tick Rage Art state each frame.
*/
function tickRageArt(rageArt) {
	if (rageArt.startupFramesRemaining > 0) return {
		...rageArt,
		startupFramesRemaining: rageArt.startupFramesRemaining - 1
	};
	if (rageArt.recoveryFramesRemaining > 0) {
		const newRecovery = rageArt.recoveryFramesRemaining - 1;
		return {
			...rageArt,
			recoveryFramesRemaining: newRecovery
		};
	}
	return rageArt;
}
var THROW_GRAB_RANGE = 1.2;
var THROW_CATALOG = {
	forward_throw: {
		id: "forward_throw",
		name: "Forward Throw",
		direction: "forward",
		damage: 180,
		startupFrames: 5,
		activeFrames: 6,
		attackerRecoveryFrames: 28,
		defenderRecoveryFrames: 45,
		breakButton: "1",
		attackerAnimation: "heavyAttack",
		defenderAnimation: "knockdown",
		wallCarry: false,
		defenderPositionOffset: {
			x: 1.5,
			y: 0,
			z: 0
		}
	},
	backward_throw: {
		id: "backward_throw",
		name: "Backward Throw",
		direction: "backward",
		damage: 200,
		startupFrames: 5,
		activeFrames: 6,
		attackerRecoveryFrames: 32,
		defenderRecoveryFrames: 55,
		breakButton: "2",
		attackerAnimation: "heavyAttack",
		defenderAnimation: "knockdown",
		wallCarry: false,
		defenderPositionOffset: {
			x: -1.8,
			y: 0,
			z: 0
		}
	},
	side_throw_left: {
		id: "side_throw_left",
		name: "Side Throw Left",
		direction: "side_left",
		damage: 190,
		startupFrames: 5,
		activeFrames: 6,
		attackerRecoveryFrames: 30,
		defenderRecoveryFrames: 50,
		breakButton: "either",
		attackerAnimation: "heavyAttack",
		defenderAnimation: "knockdown",
		wallCarry: true,
		defenderPositionOffset: {
			x: 0,
			y: 0,
			z: 1.5
		}
	},
	side_throw_right: {
		id: "side_throw_right",
		name: "Side Throw Right",
		direction: "side_right",
		damage: 190,
		startupFrames: 5,
		activeFrames: 6,
		attackerRecoveryFrames: 30,
		defenderRecoveryFrames: 50,
		breakButton: "either",
		attackerAnimation: "heavyAttack",
		defenderAnimation: "knockdown",
		wallCarry: true,
		defenderPositionOffset: {
			x: 0,
			y: 0,
			z: -1.5
		}
	}
};
function createThrowState() {
	return {
		phase: "none",
		throwId: null,
		throwDef: null,
		framesRemaining: 0,
		breakWindowOpen: false,
		breakWindowFrames: 0,
		broken: false,
		connected: false,
		whiffed: false
	};
}
/**
* Check if a throw attempt is in range to connect.
* Uses simple distance check — decoupled from normal hitbox system.
*/
function checkThrowRange(attackerX, attackerZ, defenderX, defenderZ) {
	const dx = defenderX - attackerX;
	const dz = defenderZ - attackerZ;
	return Math.sqrt(dx * dx + dz * dz) <= THROW_GRAB_RANGE;
}
/**
* Tick throw state each frame.
*/
function tickThrow(throwState) {
	if (throwState.phase === "none") return throwState;
	const newBreakFrames = Math.max(0, throwState.breakWindowFrames - 1);
	const breakWindowOpen = newBreakFrames > 0;
	const newFrames = Math.max(0, throwState.framesRemaining - 1);
	if (newFrames === 0) switch (throwState.phase) {
		case "startup": return {
			...throwState,
			phase: "active",
			framesRemaining: throwState.throwDef?.activeFrames ?? 6,
			breakWindowFrames: newBreakFrames,
			breakWindowOpen
		};
		case "active": return {
			...throwState,
			phase: "whiff",
			framesRemaining: 38,
			whiffed: true,
			breakWindowFrames: 0,
			breakWindowOpen: false
		};
		case "connected":
		case "whiff":
		case "broken":
		case "recovery": return createThrowState();
		default: return createThrowState();
	}
	return {
		...throwState,
		framesRemaining: newFrames,
		breakWindowFrames: newBreakFrames,
		breakWindowOpen
	};
}
/**
* Detect which throw type to initiate based on input.
* Returns throw ID or null if no throw input detected.
*/
function detectThrowInput(input) {
	const { lp, rp, lk, rk, forward, backward } = input;
	if (forward && lp && lk) return "side_throw_right";
	if (forward && rp && rk) return "side_throw_left";
	if (rp && rk && !lp && !lk) return "backward_throw";
	if (lp && lk && !rp && !rk) return "forward_throw";
	return null;
}
/**
* Get the damage for a throw, accounting for whether it was broken.
*/
function getThrowDamage(throwId, broken) {
	if (broken) return 0;
	return THROW_CATALOG[throwId]?.damage ?? 180;
}
var JUGGLE_GRAVITY_BASE = -.015;
var JUGGLE_GRAVITY_EXPONENT = 1.08;
var SIDESTEP_WHIFF_THRESHOLD = .6;
var SIDESTEP_RETURN_SPEED = .04;
function createFighterCombatState(id, maxHealth) {
	return {
		id,
		health: maxHealth,
		maxHealth,
		position: {
			x: id === "p1" ? -1.8 : 1.8,
			y: 0,
			z: 0
		},
		airborne: {
			isAirborne: false,
			velocityY: 0,
			launchHeight: 0,
			fallAcceleration: 1
		},
		stun: {
			isStunned: false,
			stunFramesRemaining: 0,
			isBlockStun: false,
			isHitStun: false,
			isKnockdown: false
		},
		kiCharge: createKiChargeState(),
		attackRecoveryFrames: 0,
		isAttacking: false,
		frameAdvantageOnBlock: 0,
		isBlocking: false,
		sidestepZ: 0,
		isSidestepping: false,
		wallSplat: createWallSplatState(),
		heat: createHeatState(),
		powerCrush: createPowerCrushState(),
		rageArt: createRageArtState(),
		throwState: createThrowState(),
		velocityX: 0
	};
}
function createCombatMatchState(p1MaxHp, p2MaxHp) {
	return {
		p1: createFighterCombatState("p1", p1MaxHp),
		p2: createFighterCombatState("p2", p2MaxHp),
		roundTimer: 99,
		roundNumber: 1,
		matchPhase: "intro",
		hitStopFrames: 0,
		frame: 0
	};
}
function tickAirborne(airborne, position) {
	if (!airborne.isAirborne) return {
		airborne,
		position
	};
	const newFallAcceleration = airborne.fallAcceleration * JUGGLE_GRAVITY_EXPONENT;
	const newVelocityY = airborne.velocityY + JUGGLE_GRAVITY_BASE * newFallAcceleration;
	const newY = position.y + newVelocityY;
	if (newY <= .02) return {
		airborne: {
			isAirborne: false,
			velocityY: 0,
			launchHeight: airborne.launchHeight,
			fallAcceleration: 1
		},
		position: {
			...position,
			y: 0
		}
	};
	return {
		airborne: {
			...airborne,
			velocityY: newVelocityY,
			fallAcceleration: newFallAcceleration
		},
		position: {
			...position,
			y: newY
		}
	};
}
/**
* Returns true if the attack should whiff due to Z-axis sidestep.
* Linear attacks (most normals) whiff if opponent has sidestepped.
* Tracking attacks (homing moves) ignore sidestep.
*/
function checkSidestepWhiff(attackerZ, defenderZ, isTrackingAttack) {
	if (isTrackingAttack) return false;
	return Math.abs(attackerZ - defenderZ) >= SIDESTEP_WHIFF_THRESHOLD;
}
function tickStun(stun) {
	if (!stun.isStunned) return stun;
	const remaining = stun.stunFramesRemaining - 1;
	if (remaining <= 0) return {
		isStunned: false,
		stunFramesRemaining: 0,
		isBlockStun: false,
		isHitStun: false,
		isKnockdown: false
	};
	return {
		...stun,
		stunFramesRemaining: remaining
	};
}
/**
* Pure function — no side effects, no Three.js references.
* Called at fixed 60fps tick, completely independent of render frame rate.
*
* @param state   Current match state
* @param p1Input P1 input this frame
* @param p2Input P2 input this frame
* @param dt      Delta time in seconds
*/
function tickCombatState(state, p1Input, p2Input, dt) {
	if (state.matchPhase !== "fight") return state;
	if (state.hitStopFrames > 0) return {
		...state,
		hitStopFrames: state.hitStopFrames - 1
	};
	const p1Stun = tickStun(state.p1.stun);
	const p2Stun = tickStun(state.p2.stun);
	const { airborne: p1Airborne, position: p1Pos } = tickAirborne(state.p1.airborne, state.p1.position);
	const { airborne: p2Airborne, position: p2Pos } = tickAirborne(state.p2.airborne, state.p2.position);
	const p1KiCharge = tickKiCharge(state.p1.kiCharge, p1Input, p1Input.attackLanded ?? false, dt);
	const p2KiCharge = tickKiCharge(state.p2.kiCharge, p2Input, p2Input.attackLanded ?? false, dt);
	const p1SidestepZ = state.p1.sidestepZ * (1 - SIDESTEP_RETURN_SPEED * 60 * dt);
	const p2SidestepZ = state.p2.sidestepZ * (1 - SIDESTEP_RETURN_SPEED * 60 * dt);
	const p1WallSplat = tickWallSplat(state.p1.wallSplat);
	const p2WallSplat = tickWallSplat(state.p2.wallSplat);
	const p1Heat = tickHeat(state.p1.heat);
	const p2Heat = tickHeat(state.p2.heat);
	const p1PowerCrush = tickPowerCrush(state.p1.powerCrush);
	const p2PowerCrush = tickPowerCrush(state.p2.powerCrush);
	const p1RageArt = tickRageArt(updateRageArtAvailability(state.p1.rageArt, state.p1.health / state.p1.maxHealth));
	const p2RageArt = tickRageArt(updateRageArtAvailability(state.p2.rageArt, state.p2.health / state.p2.maxHealth));
	const p1ThrowState = tickThrow(state.p1.throwState);
	const p2ThrowState = tickThrow(state.p2.throwState);
	const p1VelX = state.p1.velocityX ?? 0;
	const p1WallResult = checkWallCollision(p1Pos.x + p1VelX, p1VelX);
	let p1FinalPos = { ...p1Pos };
	let p1FinalWallSplat = p1WallSplat;
	let p1FinalVelX = p1VelX * .85;
	if (p1WallResult.hitWall && state.p1.stun.isHitStun) {
		p1FinalPos = {
			...p1Pos,
			x: p1WallResult.clampedX
		};
		p1FinalWallSplat = applyWallSplat(p1WallSplat, p1WallResult.wall);
		p1FinalVelX = p1WallResult.knockbackVelocityX;
	} else if (!p1WallResult.hitWall) p1FinalPos = {
		...p1Pos,
		x: Math.max(WALL_LEFT_X, Math.min(WALL_RIGHT_X, p1Pos.x + p1VelX))
	};
	const p2VelX = state.p2.velocityX ?? 0;
	const p2WallResult = checkWallCollision(p2Pos.x + p2VelX, p2VelX);
	let p2FinalPos = { ...p2Pos };
	let p2FinalWallSplat = p2WallSplat;
	let p2FinalVelX = p2VelX * .85;
	if (p2WallResult.hitWall && state.p2.stun.isHitStun) {
		p2FinalPos = {
			...p2Pos,
			x: p2WallResult.clampedX
		};
		p2FinalWallSplat = applyWallSplat(p2WallSplat, p2WallResult.wall);
		p2FinalVelX = p2WallResult.knockbackVelocityX;
	} else if (!p2WallResult.hitWall) p2FinalPos = {
		...p2Pos,
		x: Math.max(WALL_LEFT_X, Math.min(WALL_RIGHT_X, p2Pos.x + p2VelX))
	};
	return {
		...state,
		frame: state.frame + 1,
		p1: {
			...state.p1,
			stun: p1Stun,
			airborne: p1Airborne,
			position: {
				...p1FinalPos,
				z: p1SidestepZ
			},
			kiCharge: p1KiCharge,
			isBlocking: !p1KiCharge.blockingDisabled && state.p1.isBlocking,
			sidestepZ: p1SidestepZ,
			isSidestepping: Math.abs(p1SidestepZ) >= SIDESTEP_WHIFF_THRESHOLD * .5,
			wallSplat: p1FinalWallSplat,
			heat: p1Heat,
			powerCrush: p1PowerCrush,
			rageArt: p1RageArt,
			throwState: p1ThrowState,
			velocityX: p1FinalVelX
		},
		p2: {
			...state.p2,
			stun: p2Stun,
			airborne: p2Airborne,
			position: {
				...p2FinalPos,
				z: p2SidestepZ
			},
			kiCharge: p2KiCharge,
			isBlocking: !p2KiCharge.blockingDisabled && state.p2.isBlocking,
			sidestepZ: p2SidestepZ,
			isSidestepping: Math.abs(p2SidestepZ) >= SIDESTEP_WHIFF_THRESHOLD * .5,
			wallSplat: p2FinalWallSplat,
			heat: p2Heat,
			powerCrush: p2PowerCrush,
			rageArt: p2RageArt,
			throwState: p2ThrowState,
			velocityX: p2FinalVelX
		}
	};
}
/**
* StageManager — Modular stage wipe/load system for Brutal Fist
*
* Architecture (Tekken / MK style in R3F):
*  - Each stage is a data container (StageConfig) with its own meshes, lighting, audio, physics
*  - When a stage loads, React unmounts the old component → flushes old GLB/lights/BGM
*  - Fighter variables (HP, position, input state) are preserved in a persistent cache
*  - New stage mounts with its own JSON config: lighting, BGM, boundaries, hazards
*
* Multi-tier floor breaks (Tekken / MK style):
*  - Upper floor has a destructible HP threshold
*  - Heavy slam exceeding threshold triggers Execute_Stage_Transition:
*    Phase 1: Floor mesh swapped for fractured debris particles
*    Phase 2: Collision plane disabled
*    Phase 3: Both fighters forced into Transition_Fall state, camera detaches
*    Phase 4: Land on Level 2 floor, victim takes landing damage, input restored
*
* Proximity ledge-throw overrides (Def Jam / WrestleMania XIX style):
*  - Before executing a standard throw, check if attacker is within edgeZone
*  - If inside edgeZone, override default throw → ledge_throw animation → Ring-Out KO
*
* Destructible wall breaks (Urban Reign / Def Jam style):
*  - Walls can be designated as destructible with a knockback_force threshold
*  - If force exceeds threshold: particle shatter, boundary clamp disabled, fighter flies through
*
* Crowd/fence hazard bounce (Def Jam / MK style):
*  - Outer edge of arena is a Hazard_Trigger_Volume
*  - Fighter knocked into it: 5% chip damage, hazard_bounce animation, shoved back to center
*
* Subway stage — MDickie-style independent RNG train:
*  - Train runs on its own random schedule (10–25s), NOT triggered by falling in
*  - Horn + light flicker warning 2s before crossing
*  - trainCrossing boolean true for 1s as train animates across
*  - If P1 or P2 is on tracks (Y = -1.5) during crossing → massive unblockable damage
*  - Vault-up escape: player on tracks can input Up to vault back to platform (Y = 0)
*  - After crossing, new random timer rolls and loop continues
*/
function createFighterPersistentState(id, maxHealth) {
	return {
		id,
		health: maxHealth,
		maxHealth,
		positionX: id === "p1" ? -1.8 : 1.8,
		positionY: 0,
		positionZ: 0,
		inputEnabled: true,
		levelIndex: 0
	};
}
function createFloorBreakState() {
	return {
		phase: "idle",
		triggerFighter: null,
		targetLevelIndex: 0,
		phaseFrames: 0,
		landingDamage: 0,
		cameraDetached: false,
		debrisPositions: []
	};
}
function createLedgeThrowState() {
	return {
		active: false,
		victim: null,
		phase: "idle",
		phaseFrames: 0
	};
}
function createDestructibleWallState() {
	return {
		leftWallIntact: true,
		rightWallIntact: true,
		leftShatterActive: false,
		rightShatterActive: false,
		leftShatterFrames: 0,
		rightShatterFrames: 0
	};
}
function createHazardBounceState() {
	return {
		p1BounceActive: false,
		p2BounceActive: false,
		p1BounceFrames: 0,
		p2BounceFrames: 0,
		p1TargetX: -1.8,
		p2TargetX: 1.8
	};
}
var TRAIN_HIT_DAMAGE = .4;
function createTrainHazardState(enabled) {
	const interval = 10 + Math.random() * 15;
	return {
		enabled,
		timerSeconds: interval,
		nextCrossingInterval: interval,
		warningActive: false,
		warningFrames: 0,
		trainCrossing: false,
		crossingFrames: 0,
		trainX: -20,
		p1OnTracks: false,
		p2OnTracks: false,
		p1CanVault: true,
		p2CanVault: true,
		p1VaultActive: false,
		p2VaultActive: false,
		p1VaultFrames: 0,
		p2VaultFrames: 0,
		lightsFlickering: false
	};
}
function tickTrainHazard(state, dt, p1Y, p2Y, p1InputUp, p2InputUp) {
	if (!state.enabled) return {
		state,
		fireWarning: false,
		fireCrossing: false,
		p1TrainHit: false,
		p2TrainHit: false,
		crossingEnded: false
	};
	let next = { ...state };
	let fireWarning = false;
	let fireCrossing = false;
	let p1TrainHit = false;
	let p2TrainHit = false;
	let crossingEnded = false;
	next.p1OnTracks = p1Y <= -1.2;
	next.p2OnTracks = p2Y <= -1.2;
	if (next.p1OnTracks && p1InputUp && next.p1CanVault && !next.p1VaultActive) {
		next.p1VaultActive = true;
		next.p1VaultFrames = 30;
		next.p1CanVault = false;
	}
	if (next.p2OnTracks && p2InputUp && next.p2CanVault && !next.p2VaultActive) {
		next.p2VaultActive = true;
		next.p2VaultFrames = 30;
		next.p2CanVault = false;
	}
	if (next.p1VaultActive) {
		next.p1VaultFrames = Math.max(0, next.p1VaultFrames - 1);
		if (next.p1VaultFrames === 0) {
			next.p1VaultActive = false;
			next.p1OnTracks = false;
		}
	}
	if (next.p2VaultActive) {
		next.p2VaultFrames = Math.max(0, next.p2VaultFrames - 1);
		if (next.p2VaultFrames === 0) {
			next.p2VaultActive = false;
			next.p2OnTracks = false;
		}
	}
	if (!next.p1OnTracks && !next.p1VaultActive) next.p1CanVault = true;
	if (!next.p2OnTracks && !next.p2VaultActive) next.p2CanVault = true;
	if (!next.warningActive && !next.trainCrossing) {
		next.timerSeconds -= dt;
		if (next.timerSeconds <= 2 && !next.warningActive) {
			next.warningActive = true;
			next.warningFrames = 120;
			next.lightsFlickering = true;
			fireWarning = true;
		}
	}
	if (next.warningActive) {
		next.warningFrames = Math.max(0, next.warningFrames - 1);
		next.lightsFlickering = next.warningFrames % 12 < 6;
		if (next.warningFrames === 0) {
			next.warningActive = false;
			next.trainCrossing = true;
			next.crossingFrames = 60;
			next.trainX = -20;
			next.lightsFlickering = false;
			fireCrossing = true;
		}
	}
	if (next.trainCrossing) {
		next.crossingFrames = Math.max(0, next.crossingFrames - 1);
		next.trainX = -20 + (1 - next.crossingFrames / 60) * 40;
		if (next.p1OnTracks && !next.p1VaultActive) p1TrainHit = true;
		if (next.p2OnTracks && !next.p2VaultActive) p2TrainHit = true;
		if (next.crossingFrames === 0) {
			next.trainCrossing = false;
			next.trainX = 20;
			crossingEnded = true;
			const newInterval = 10 + Math.random() * 15;
			next.timerSeconds = newInterval;
			next.nextCrossingInterval = newInterval;
		}
	}
	return {
		state: next,
		fireWarning,
		fireCrossing,
		p1TrainHit,
		p2TrainHit,
		crossingEnded
	};
}
/**
* Trigger a floor break transition.
* Called when a slam exceeds the floor's HP threshold.
*/
function triggerFloorBreak(victim, targetLevelIndex, slamDamage) {
	return {
		phase: "floor_break_debris",
		triggerFighter: victim,
		targetLevelIndex,
		phaseFrames: 20,
		landingDamage: 30,
		cameraDetached: false,
		debrisPositions: Array.from({ length: 12 }, (_, i) => ({
			x: (Math.random() - .5) * 4,
			y: 0,
			z: (Math.random() - .5) * 3,
			vx: (Math.random() - .5) * .15,
			vy: .08 + Math.random() * .12,
			vz: (Math.random() - .5) * .1
		}))
	};
}
function tickFloorBreak(prev, dt) {
	if (prev.phase === "idle") return {
		state: prev,
		phaseChanged: false,
		applyLandingDamage: false,
		transitionComplete: false
	};
	let next = { ...prev };
	let phaseChanged = false;
	let applyLandingDamage = false;
	let transitionComplete = false;
	next.phaseFrames = Math.max(0, next.phaseFrames - 1);
	next.debrisPositions = next.debrisPositions.map((d) => ({
		...d,
		x: d.x + d.vx,
		y: Math.max(-.5, d.y + d.vy - .006),
		z: d.z + d.vz,
		vy: d.vy - .006
	}));
	if (next.phaseFrames === 0) {
		phaseChanged = true;
		if (next.phase === "floor_break_debris") {
			next.phase = "floor_break_fall";
			next.phaseFrames = 90;
			next.cameraDetached = true;
		} else if (next.phase === "floor_break_fall") {
			next.phase = "floor_break_land";
			next.phaseFrames = 30;
			next.cameraDetached = false;
			applyLandingDamage = true;
		} else if (next.phase === "floor_break_land") {
			next.phase = "idle";
			next.cameraDetached = false;
			transitionComplete = true;
		}
	}
	return {
		state: next,
		phaseChanged,
		applyLandingDamage,
		transitionComplete
	};
}
var LEDGE_THROW_PROXIMITY = 1.5;
/**
* Check if a throw should be overridden with a ledge-throw.
* Returns true if attacker is within LEDGE_THROW_PROXIMITY of the ring-out boundary.
*/
function checkLedgeThrowOverride(attackerX, defenderX, stageBoundaryX, ringOutEnabled) {
	if (!ringOutEnabled || !isFinite(stageBoundaryX)) return false;
	const attackerNearEdge = Math.abs(attackerX) > stageBoundaryX - LEDGE_THROW_PROXIMITY;
	const defenderNearEdge = Math.abs(defenderX) > stageBoundaryX - LEDGE_THROW_PROXIMITY;
	return attackerNearEdge || defenderNearEdge;
}
/**
* Execute a ledge-throw override.
* Returns the initial LedgeThrowState.
*/
function executeLedgeThrow(victim) {
	return {
		active: true,
		victim,
		phase: "startup",
		phaseFrames: 20
	};
}
function tickLedgeThrow(prev) {
	if (!prev.active) return {
		state: prev,
		koVictim: null
	};
	let next = { ...prev };
	let koVictim = null;
	next.phaseFrames = Math.max(0, next.phaseFrames - 1);
	if (next.phaseFrames === 0) {
		if (next.phase === "startup") {
			next.phase = "throw";
			next.phaseFrames = 30;
		} else if (next.phase === "throw") {
			next.phase = "fall";
			next.phaseFrames = 60;
		} else if (next.phase === "fall") {
			next.phase = "ko";
			next.phaseFrames = 30;
			koVictim = next.victim;
		} else if (next.phase === "ko") {
			next.active = false;
			next.phase = "idle";
			next.victim = null;
		}
	}
	return {
		state: next,
		koVictim
	};
}
/**
* Check if a wall should break based on knockback force.
*/
function checkWallBreak(knockbackForce, wall, wallState, stageHasDestructibleWalls) {
	if (!stageHasDestructibleWalls) return false;
	if (wall === "left" && !wallState.leftWallIntact) return false;
	if (wall === "right" && !wallState.rightWallIntact) return false;
	return knockbackForce >= 180;
}
/**
* Apply wall break — disable boundary clamp, trigger particle shatter.
*/
function applyWallBreak(wallState, wall) {
	if (wall === "left") return {
		...wallState,
		leftWallIntact: false,
		leftShatterActive: true,
		leftShatterFrames: 45
	};
	return {
		...wallState,
		rightWallIntact: false,
		rightShatterActive: true,
		rightShatterFrames: 45
	};
}
function tickDestructibleWalls(prev) {
	return {
		...prev,
		leftShatterFrames: Math.max(0, prev.leftShatterFrames - 1),
		rightShatterFrames: Math.max(0, prev.rightShatterFrames - 1),
		leftShatterActive: prev.leftShatterFrames > 1,
		rightShatterActive: prev.rightShatterFrames > 1
	};
}
var HAZARD_VOLUME_THRESHOLD = .3;
/**
* Check if a fighter is inside the hazard volume (near stage edge, in knockback).
*/
function checkHazardVolume(fighterX, stageBoundaryX, isInKnockback) {
	if (!isInKnockback) return false;
	return Math.abs(fighterX) > stageBoundaryX - HAZARD_VOLUME_THRESHOLD;
}
/**
* Apply hazard bounce — freeze controls, apply chip damage, shove back to center.
*/
function applyHazardBounce(bounceState, fighter, currentX) {
	const targetX = fighter === "p1" ? -1.8 : 1.8;
	if (fighter === "p1") return {
		...bounceState,
		p1BounceActive: true,
		p1BounceFrames: 20,
		p1TargetX: targetX
	};
	return {
		...bounceState,
		p2BounceActive: true,
		p2BounceFrames: 20,
		p2TargetX: targetX
	};
}
function tickHazardBounce(prev) {
	return {
		...prev,
		p1BounceFrames: Math.max(0, prev.p1BounceFrames - 1),
		p2BounceFrames: Math.max(0, prev.p2BounceFrames - 1),
		p1BounceActive: prev.p1BounceFrames > 1,
		p2BounceActive: prev.p2BounceFrames > 1
	};
}
function createStageManagerState(stageId, p1MaxHp, p2MaxHp) {
	const config = resolveStageConfig(stageId);
	const isSubway = stageId === "subway";
	return {
		stageId,
		config,
		p1: createFighterPersistentState("p1", p1MaxHp),
		p2: createFighterPersistentState("p2", p2MaxHp),
		floorBreak: createFloorBreakState(),
		ledgeThrow: createLedgeThrowState(),
		destructibleWalls: createDestructibleWallState(),
		hazardBounce: createHazardBounceState(),
		trainHazard: createTrainHazardState(isSubway),
		isLoading: false
	};
}
/**
* GlobalAudioManager — Howler-based audio manager for Brutal Fist
*
* Architecture (Tekken audio layers):
*  - BGM channel: looping background music (menu, character select, stage fight)
*  - UI channel: menu cursor, lock-in sounds
*  - SFX channel: combat impacts (whiff, block, hit, counter, floor slam)
*  - VOX channel: fighter vocals (attack grunts, pain grunts, KO scream)
*
* Mobile optimization:
*  - All assets preloaded during VS screen transition
*  - Separate Howl instances per channel to prevent music drowning out SFX
*  - BGM crossfade: menu → stage BGM when fight loads
*  - Web Audio API fallback for procedural SFX when files not present
*
* Asset paths: public/audio/
*  - bgm/: character_select.mp3, stage_urban_night.mp3, stage_training.mp3
*  - ui/: cursor_move.mp3, lock_in.mp3
*  - sfx/: whiff.mp3, block.mp3, light_hit.mp3, heavy_hit.mp3, counter_hit.mp3, floor_slam.mp3
*  - vox/: attack_grunt.mp3, pain_grunt.mp3, ko_scream.mp3
*  - announcer/: get_ready.mp3, round_1.mp3, fight.mp3, ko.mp3, perfect.mp3, etc.
*
* NOTE: Audio files are referenced but use Web Audio API procedural fallback
* when files are not present, so the game works without audio assets.
*/
var DEFAULT_AUDIO_CONFIG = {
	masterVolume: 1,
	bgmVolume: .65,
	sfxVolume: .9,
	voxVolume: .85,
	uiVolume: .75,
	announcerVolume: .95,
	enabled: true
};
var ProceduralAudio = class {
	ctx = null;
	getCtx() {
		if (typeof window === "undefined") return null;
		if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
		if (this.ctx.state === "suspended") this.ctx.resume();
		return this.ctx;
	}
	playNoise(duration, gain, freq, q) {
		const ctx = this.getCtx();
		if (!ctx) return;
		const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
		const data = buf.getChannelData(0);
		for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
		const src = ctx.createBufferSource();
		src.buffer = buf;
		const filter = ctx.createBiquadFilter();
		filter.type = "bandpass";
		filter.frequency.value = freq;
		filter.Q.value = q;
		const gainNode = ctx.createGain();
		const now = ctx.currentTime;
		gainNode.gain.setValueAtTime(0, now);
		gainNode.gain.linearRampToValueAtTime(gain, now + .005);
		gainNode.gain.exponentialRampToValueAtTime(.001, now + duration);
		src.connect(filter);
		filter.connect(gainNode);
		gainNode.connect(ctx.destination);
		src.start(now);
		src.stop(now + duration);
	}
	playTone(freq, duration, gain, type = "sine", freqEnd) {
		const ctx = this.getCtx();
		if (!ctx) return;
		const osc = ctx.createOscillator();
		const gainNode = ctx.createGain();
		const now = ctx.currentTime;
		osc.type = type;
		osc.frequency.setValueAtTime(freq, now);
		if (freqEnd !== void 0) osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration);
		gainNode.gain.setValueAtTime(0, now);
		gainNode.gain.linearRampToValueAtTime(gain, now + .004);
		gainNode.gain.exponentialRampToValueAtTime(.001, now + duration);
		osc.connect(gainNode);
		gainNode.connect(ctx.destination);
		osc.start(now);
		osc.stop(now + duration);
	}
	whiff() {
		this.playNoise(.07, .25, 4e3, 8);
	}
	block() {
		this.playNoise(.06, .4, 3500, 5);
		this.playTone(320, .05, .25, "square", 280);
	}
	lightHit() {
		this.playNoise(.08, .6, 2200, 3);
		this.playTone(180, .06, .3, "square", 90);
	}
	heavyHit() {
		this.playNoise(.14, 1, 800, 2);
		this.playTone(90, .12, .5, "sawtooth", 40);
		this.playTone(55, .18, .4, "sine", 30);
	}
	counterHit() {
		this.playNoise(.1, .8, 1800, 4);
		this.playTone(440, .08, .4, "sawtooth", 220);
		setTimeout(() => this.playTone(660, .06, .3, "square", 330), 40);
	}
	floorSlam() {
		this.playNoise(.18, 1.2, 200, 1);
		this.playTone(55, .25, .8, "sine", 20);
	}
	wallSplat() {
		this.playNoise(.12, .9, 600, 2);
		this.playTone(80, .15, .6, "sawtooth", 40);
	}
	throwConnect() {
		this.playNoise(.12, .7, 400, 2);
		this.playTone(70, .15, .5, "sine", 50);
	}
	throwBreak() {
		this.playNoise(.08, .5, 2e3, 4);
		this.playTone(440, .1, .4, "square", 220);
	}
	heatBurstActivate() {
		this.playTone(220, .3, .7, "sawtooth", 440);
		setTimeout(() => this.playNoise(.2, .8, 1e3, 3), 100);
	}
	powerCrushAbsorb() {
		this.playNoise(.1, .6, 800, 3);
		this.playTone(160, .12, .5, "square", 80);
	}
	rageArtActivate() {
		this.playTone(55, .6, .9, "sine", 20);
		this.playNoise(.5, 1.2, 200, 1);
		setTimeout(() => this.playTone(880, .8, .5, "sine", 440), 80);
		setTimeout(() => this.playNoise(1.2, .6, 600, .5), 200);
	}
	attackGrunt() {
		this.playNoise(.06, .3, 1200, 6);
		this.playTone(280, .08, .2, "sine", 200);
	}
	painGrunt() {
		this.playNoise(.08, .4, 900, 5);
		this.playTone(200, .1, .3, "sine", 150);
	}
	koScream() {
		this.playTone(300, 1.2, .6, "sine", 80);
		this.playNoise(.8, .5, 500, 2);
	}
	cursorMove() {
		this.playTone(880, .04, .3, "square", 660);
	}
	lockIn() {
		this.playNoise(.08, .6, 1500, 4);
		this.playTone(220, .12, .5, "sawtooth", 110);
	}
	menuBack() {
		this.playTone(440, .06, .25, "square", 330);
	}
	menuConfirm() {
		this.playTone(660, .08, .4, "sine");
		setTimeout(() => this.playTone(880, .06, .3, "sine"), 80);
	}
	roundStart() {
		this.playTone(660, .4, .7, "sine");
		setTimeout(() => this.playTone(880, .3, .5, "sine"), 150);
		setTimeout(() => this.playTone(1100, .5, .6, "sine"), 280);
	}
	victory() {
		[
			523,
			659,
			784,
			1047
		].forEach((freq, i) => setTimeout(() => this.playTone(freq, .3, .6, "square"), i * 120));
	}
};
var GlobalAudioManagerClass = class {
	config = { ...DEFAULT_AUDIO_CONFIG };
	procedural = new ProceduralAudio();
	currentBGMTrack = null;
	bgmFadeTimer = null;
	announcerQueue = [];
	announcerPlaying = false;
	howlerBGM = null;
	howlerSFX = /* @__PURE__ */ new Map();
	howlerVOX = /* @__PURE__ */ new Map();
	howlerUI = /* @__PURE__ */ new Map();
	howlerAnnouncer = /* @__PURE__ */ new Map();
	howlerLoaded = false;
	/** Initialize Howler — called once on client */
	async init(config) {
		if (config) this.config = {
			...this.config,
			...config
		};
		if (typeof window === "undefined") return;
		try {
			const { Howl, Howler } = await import("../_libs/howler.mjs").then((n) => /* @__PURE__ */ __toESM(n.t()));
			Howler.volume(this.config.masterVolume);
			this.howlerLoaded = true;
			this._preloadSFX(Howl);
			this._preloadUI(Howl);
		} catch {
			console.log("[AudioManager] Howler not available, using procedural audio");
		}
	}
	_preloadSFX(Howl) {
		for (const [id, src] of Object.entries({
			whiff: "/audio/sfx/whiff.mp3",
			block: "/audio/sfx/block.mp3",
			light_hit: "/audio/sfx/light_hit.mp3",
			heavy_hit: "/audio/sfx/heavy_hit.mp3",
			counter_hit: "/audio/sfx/counter_hit.mp3",
			floor_slam: "/audio/sfx/floor_slam.mp3",
			wall_splat: "/audio/sfx/wall_splat.mp3",
			throw_connect: "/audio/sfx/throw_connect.mp3",
			throw_break: "/audio/sfx/throw_break.mp3",
			heat_burst_activate: "/audio/sfx/heat_burst_activate.mp3",
			power_crush_absorb: "/audio/sfx/power_crush_absorb.mp3",
			rage_art_activate: "/audio/sfx/rage_art_activate.mp3"
		})) try {
			this.howlerSFX.set(id, new Howl({
				src: [src],
				volume: this.config.sfxVolume,
				preload: false
			}));
		} catch {}
	}
	_preloadUI(Howl) {
		for (const [id, src] of Object.entries({
			cursor_move: "/audio/ui/cursor_move.mp3",
			lock_in: "/audio/ui/lock_in.mp3",
			menu_back: "/audio/ui/menu_back.mp3",
			menu_confirm: "/audio/ui/menu_confirm.mp3"
		})) try {
			this.howlerUI.set(id, new Howl({
				src: [src],
				volume: this.config.uiVolume,
				preload: false
			}));
		} catch {}
	}
	/** Preload all combat audio assets — call during VS screen transition */
	async preloadCombatAudio(stageId) {
		if (!this.howlerLoaded) return;
		try {
			const { Howl } = await import("../_libs/howler.mjs").then((n) => /* @__PURE__ */ __toESM(n.t()));
			for (const [id, src] of Object.entries({
				attack_grunt: "/audio/vox/attack_grunt.mp3",
				pain_grunt: "/audio/vox/pain_grunt.mp3",
				ko_scream: "/audio/vox/ko_scream.mp3",
				heat_burst_yell: "/audio/vox/heat_burst_yell.mp3",
				rage_art_yell: "/audio/vox/rage_art_yell.mp3"
			})) if (!this.howlerVOX.has(id)) try {
				const h = new Howl({
					src: [src],
					volume: this.config.voxVolume,
					preload: true
				});
				this.howlerVOX.set(id, h);
			} catch {}
			for (const line of [
				"get_ready",
				"round_1",
				"round_2",
				"round_3",
				"final_round",
				"fight",
				"ko",
				"double_ko",
				"perfect",
				"great",
				"time_up",
				"draw",
				"p1_wins",
				"p2_wins",
				"ki_charge",
				"chicken"
			]) if (!this.howlerAnnouncer.has(line)) try {
				const h = new Howl({
					src: [`/audio/announcer/${line}.mp3`],
					volume: this.config.announcerVolume,
					preload: true
				});
				this.howlerAnnouncer.set(line, h);
			} catch {}
			const stageBGMSrc = `/audio/bgm/stage_${stageId}.mp3`;
			try {
				const h = new Howl({
					src: [stageBGMSrc],
					volume: this.config.bgmVolume,
					loop: true,
					preload: true
				});
				this.howlerSFX.set(`bgm_${stageId}`, h);
			} catch {}
		} catch {}
	}
	/** Play a BGM track, crossfading from current track */
	async playBGM(track, fadeMs = 1500) {
		if (!this.config.enabled) return;
		if (this.currentBGMTrack === track) return;
		if (this.howlerBGM) {
			const oldBGM = this.howlerBGM;
			oldBGM.fade(this.config.bgmVolume, 0, fadeMs);
			setTimeout(() => oldBGM.stop(), fadeMs + 100);
		}
		this.currentBGMTrack = track;
		if (this.howlerLoaded) try {
			const { Howl } = await import("../_libs/howler.mjs").then((n) => /* @__PURE__ */ __toESM(n.t()));
			const src = `/audio/bgm/${track}.mp3`;
			this.howlerBGM = new Howl({
				src: [src],
				volume: 0,
				loop: true,
				autoplay: true
			});
			this.howlerBGM.fade(0, this.config.bgmVolume, fadeMs);
			return;
		} catch {}
		this.procedural.roundStart();
	}
	stopBGM(fadeMs = 1e3) {
		if (this.howlerBGM) {
			this.howlerBGM.fade(this.config.bgmVolume, 0, fadeMs);
			setTimeout(() => {
				this.howlerBGM?.stop();
				this.howlerBGM = null;
			}, fadeMs + 100);
		}
		this.currentBGMTrack = null;
	}
	playSFX(event) {
		if (!this.config.enabled) return;
		const howl = this.howlerSFX.get(event);
		if (howl) try {
			howl.play();
			return;
		} catch {}
		switch (event) {
			case "whiff":
				this.procedural.whiff();
				break;
			case "block":
				this.procedural.block();
				break;
			case "light_hit":
				this.procedural.lightHit();
				break;
			case "heavy_hit":
				this.procedural.heavyHit();
				break;
			case "counter_hit":
				this.procedural.counterHit();
				break;
			case "floor_slam":
				this.procedural.floorSlam();
				break;
			case "wall_splat":
				this.procedural.wallSplat();
				break;
			case "throw_connect":
				this.procedural.throwConnect();
				break;
			case "throw_break":
				this.procedural.throwBreak();
				break;
			case "heat_burst_activate":
				this.procedural.heatBurstActivate();
				break;
			case "power_crush_absorb":
				this.procedural.powerCrushAbsorb();
				break;
			case "rage_art_activate": this.procedural.rageArtActivate();
		}
	}
	playVOX(event) {
		if (!this.config.enabled) return;
		const howl = this.howlerVOX.get(event);
		if (howl) try {
			howl.play();
			return;
		} catch {}
		switch (event) {
			case "attack_grunt":
				this.procedural.attackGrunt();
				break;
			case "pain_grunt":
				this.procedural.painGrunt();
				break;
			case "ko_scream":
				this.procedural.koScream();
				break;
			case "heat_burst_yell":
				this.procedural.heatBurstActivate();
				break;
			case "rage_art_yell": this.procedural.rageArtActivate();
		}
	}
	playUI(sound) {
		if (!this.config.enabled) return;
		const howl = this.howlerUI.get(sound);
		if (howl) try {
			howl.play();
			return;
		} catch {}
		switch (sound) {
			case "cursor_move":
				this.procedural.cursorMove();
				break;
			case "lock_in":
				this.procedural.lockIn();
				break;
			case "menu_back":
				this.procedural.menuBack();
				break;
			case "menu_confirm": this.procedural.menuConfirm();
		}
	}
	playAnnouncer(line) {
		if (!this.config.enabled) return;
		const howl = this.howlerAnnouncer.get(line);
		if (howl) try {
			howl.play();
			return;
		} catch {}
		if (typeof window !== "undefined" && window.speechSynthesis) {
			const text = {
				get_ready: "Get ready for the next battle",
				round_1: "Round 1",
				round_2: "Round 2",
				round_3: "Round 3",
				final_round: "Final Round",
				fight: "Fight!",
				ko: "K.O.!",
				double_ko: "Double K.O.!",
				perfect: "Perfect!",
				great: "Great!",
				time_up: "Time Up!",
				draw: "Draw!",
				p1_wins: "Player 1 Wins!",
				p2_wins: "Player 2 Wins!",
				ki_charge: "Ki Charge!",
				chicken: "Chicken!"
			}[line];
			if (text) {
				const synth = window.speechSynthesis;
				synth.cancel();
				const utt = new SpeechSynthesisUtterance(text);
				utt.pitch = .7;
				utt.rate = .85;
				utt.volume = this.config.announcerVolume;
				synth.speak(utt);
			}
		}
	}
	updateConfig(config) {
		this.config = {
			...this.config,
			...config
		};
	}
	setEnabled(enabled) {
		this.config.enabled = enabled;
		if (!enabled) this.stopBGM(300);
	}
	getMasterVolume() {
		return this.config.masterVolume;
	}
	isEnabled() {
		return this.config.enabled;
	}
};
var _instance = null;
function getGlobalAudioManager() {
	if (!_instance) _instance = new GlobalAudioManagerClass();
	return _instance;
}
var CombatArena3D = dynamic(() => import("./CombatArena3D-Dl-xX8s6.mjs"), {
	ssr: false,
	loading: () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "w-full h-full flex items-center justify-center bg-black",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-yellow-400 text-xs tracking-widest animate-pulse font-mono",
			children: "LOADING ARENA..."
		})
	})
});
var EMPTY_INPUT = {
	up: false,
	down: false,
	left: false,
	right: false,
	light: false,
	heavy: false,
	guard: false,
	grapple: false,
	escape: false,
	pin: false
};
var FACTION_COLOR = {
	alliance: "#1d4ed8",
	corporate: "#dc2626",
	chaos: "#7c3aed",
	independent: "#d97706"
};
var SWEEP_DURATION_MS = 2e3;
var POST_MATCH_DELAY_MS = 3600;
function GameBattleArena({ p1Fighter, p2Fighter, onMatchEnd, onBack, roundLabel, p1SkinTint, p2SkinTint, settings = DEFAULT_TOURNAMENT_SETTINGS, stageId = "urban_night", debugSettings = DEFAULT_DEBUG_SETTINGS, isPracticeMode = false }) {
	const engineRef = (0, import_react.useRef)(null);
	const inputRef = (0, import_react.useRef)({ ...EMPTY_INPUT });
	const rafRef = (0, import_react.useRef)(0);
	const [frame, setFrame] = (0, import_react.useState)(0);
	const [p1Health, setP1Health] = (0, import_react.useState)(p1Fighter.hp);
	const [p2Health, setP2Health] = (0, import_react.useState)(p2Fighter.hp);
	const [p1State, setP1State] = (0, import_react.useState)("Neutral");
	const [p2State, setP2State] = (0, import_react.useState)("Neutral");
	const [p1Animation, setP1Animation] = (0, import_react.useState)("idle");
	const [p2Animation, setP2Animation] = (0, import_react.useState)("idle");
	const [ko, setKo] = (0, import_react.useState)(false);
	const [winner, setWinner] = (0, import_react.useState)(null);
	const [roundTimer, setRoundTimer] = (0, import_react.useState)(99);
	const [hitStopActive, setHitStopActive] = (0, import_react.useState)(false);
	const [arenaReady, setArenaReady] = (0, import_react.useState)(false);
	const [showPostMatch, setShowPostMatch] = (0, import_react.useState)(false);
	const [matchCondition, setMatchCondition] = (0, import_react.useState)("KO");
	const [roundResults, setRoundResults] = (0, import_react.useState)([]);
	const roundStartTimeRef = (0, import_react.useRef)(Date.now());
	const [knockdownEvent, setKnockdownEvent] = (0, import_react.useState)(void 0);
	const knockdownEventCountRef = (0, import_react.useRef)(0);
	const koHandledRef = (0, import_react.useRef)(false);
	const roundStartedRef = (0, import_react.useRef)(false);
	const sfx = useSoundEffects();
	const [feedbackEvents, setFeedbackEvents] = (0, import_react.useState)([]);
	const feedbackIdRef = (0, import_react.useRef)(0);
	const p1SMRef = (0, import_react.useRef)(new FighterStateMachine());
	const p2SMRef = (0, import_react.useRef)(new FighterStateMachine());
	const p1HitboxRef = (0, import_react.useRef)(new FrameDataHitboxSystem());
	const p2HitboxRef = (0, import_react.useRef)(new FrameDataHitboxSystem());
	const p1LocoRef = (0, import_react.useRef)(new LocomotionSystem(-1.8, 0, 1));
	const p2LocoRef = (0, import_react.useRef)(new LocomotionSystem(1.8, 0, -1));
	const p1StickRef = (0, import_react.useRef)(createTekkenStick());
	const p1JumpYRef = (0, import_react.useRef)(0);
	const p1BoneHitboxRef = (0, import_react.useRef)(null);
	const p2BoneHitboxRef = (0, import_react.useRef)(null);
	const hitStopTimerRef = (0, import_react.useRef)(0);
	const hitStopActiveRef = (0, import_react.useRef)(false);
	const [p1KiCharge, setP1KiCharge] = (0, import_react.useState)(createKiChargeState());
	const [p2KiCharge, setP2KiCharge] = (0, import_react.useState)(createKiChargeState());
	const p1KiChargeRef = (0, import_react.useRef)(createKiChargeState());
	const p2KiChargeRef = (0, import_react.useRef)(createKiChargeState());
	const combatStateRef = (0, import_react.useRef)(createCombatMatchState(p1Fighter.hp, p2Fighter.hp));
	const arenaCombatStateRef = (0, import_react.useRef)(createArenaCombatState(stageId));
	const [arenaState, setArenaState] = (0, import_react.useState)(() => createArenaCombatState(stageId));
	const [ringOutNotice, setRingOutNotice] = (0, import_react.useState)(null);
	const ringOutNoticeCountRef = (0, import_react.useRef)(0);
	const [floorBreakNotice, setFloorBreakNotice] = (0, import_react.useState)(null);
	const floorBreakNoticeCountRef = (0, import_react.useRef)(0);
	const [hazardNotice, setHazardNotice] = (0, import_react.useState)("");
	const stageManagerRef = (0, import_react.useRef)(createStageManagerState(stageId, p1Fighter.hp, p2Fighter.hp));
	const [trainWarningActive, setTrainWarningActive] = (0, import_react.useState)(false);
	const [trainCrossing, setTrainCrossing] = (0, import_react.useState)(false);
	const [trainX, setTrainX] = (0, import_react.useState)(-20);
	const [p1OnTracks, setP1OnTracks] = (0, import_react.useState)(false);
	const [p2OnTracks, setP2OnTracks] = (0, import_react.useState)(false);
	const [p1VaultPrompt, setP1VaultPrompt] = (0, import_react.useState)(false);
	const [p2VaultPrompt, setP2VaultPrompt] = (0, import_react.useState)(false);
	const [floorBreakPhase, setFloorBreakPhase] = (0, import_react.useState)("idle");
	const [debrisPositions, setDebrisPositions] = (0, import_react.useState)([]);
	const [ledgeThrowActive, setLedgeThrowActive] = (0, import_react.useState)(false);
	const [wallShatterLeft, setWallShatterLeft] = (0, import_react.useState)(false);
	const [wallShatterRight, setWallShatterRight] = (0, import_react.useState)(false);
	const [hazardBounceNotice, setHazardBounceNotice] = (0, import_react.useState)("");
	const hazardBounceNoticeTimerRef = (0, import_react.useRef)(null);
	const p1YRef = (0, import_react.useRef)(0);
	const p2YRef = (0, import_react.useRef)(0);
	const announcerRef = (0, import_react.useRef)(getAnnouncerSystem({
		p1Name: p1Fighter.name,
		p2Name: p2Fighter.name,
		enabled: settings.soundEnabled
	}));
	const announcerFiredRef = (0, import_react.useRef)({
		getReady: false,
		round: false,
		fight: false,
		ko: false
	});
	(0, import_react.useRef)(0);
	(0, import_react.useRef)(0);
	const [specialMoveNotice, setSpecialMoveNotice] = (0, import_react.useState)(null);
	const specialNoticeIdRef = (0, import_react.useRef)(0);
	const [p1QueuedAction, setP1QueuedAction] = (0, import_react.useState)(null);
	const [p1RecoveryProgress, setP1RecoveryProgress] = (0, import_react.useState)(0);
	const [p1WakeupBuffered, setP1WakeupBuffered] = (0, import_react.useState)(null);
	const [p1Combo, setP1Combo] = (0, import_react.useState)(() => createComboState("p1"));
	const [p2Combo, setP2Combo] = (0, import_react.useState)(() => createComboState("p2"));
	const p1ComboRef = (0, import_react.useRef)(createComboState("p1"));
	const p2ComboRef = (0, import_react.useRef)(createComboState("p2"));
	const [p1DebugData, setP1DebugData] = (0, import_react.useState)(null);
	const [p2DebugData, setP2DebugData] = (0, import_react.useState)(null);
	const p1ImpactMarkersRef = (0, import_react.useRef)([]);
	const p2ImpactMarkersRef = (0, import_react.useRef)([]);
	const impactMarkerIdRef = (0, import_react.useRef)(0);
	const [p1AnimTrigger, setP1AnimTrigger] = (0, import_react.useState)(0);
	const [p2AnimTrigger, setP2AnimTrigger] = (0, import_react.useState)(0);
	const p1AnimTriggerRef = (0, import_react.useRef)(0);
	const p2AnimTriggerRef = (0, import_react.useRef)(0);
	const prevP1AnimRef = (0, import_react.useRef)("idle");
	const prevP2AnimRef = (0, import_react.useRef)("idle");
	const [p1LocomotionVelocity, setP1LocomotionVelocity] = (0, import_react.useState)({
		forward: 0,
		strafe: 0
	});
	const [p2LocomotionVelocity, setP2LocomotionVelocity] = (0, import_react.useState)({
		forward: 0,
		strafe: 0
	});
	const p1VelRef = (0, import_react.useRef)({
		forward: 0,
		strafe: 0
	});
	const p2VelRef = (0, import_react.useRef)({
		forward: 0,
		strafe: 0
	});
	const { startRecording, stopRecording, recordFrame, getBuffer, isRecording } = useMatchRecorder();
	const { user } = useAuth();
	const [cinematicPhase, setCinematicPhase] = (0, import_react.useState)("sweep");
	const [isPaused, setIsPaused] = (0, import_react.useState)(false);
	const [pauseTab, setPauseTab] = (0, import_react.useState)("menu");
	(0, import_react.useEffect)(() => {
		const handleKeyDown = (e) => {
			if (e.key === "Escape" && cinematicPhase === "fight" && !ko) {
				setIsPaused((p) => !p);
				setPauseTab("menu");
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [cinematicPhase, ko]);
	const isPausedRef = (0, import_react.useRef)(false);
	(0, import_react.useEffect)(() => {
		isPausedRef.current = isPaused;
	}, [isPaused]);
	const [p1X, setP1X] = (0, import_react.useState)(-1.8);
	const [p1Y, setP1Y] = (0, import_react.useState)(0);
	const [p2X, setP2X] = (0, import_react.useState)(1.8);
	const [p1Z, setP1Z] = (0, import_react.useState)(0);
	const [p2Z, setP2Z] = (0, import_react.useState)(0);
	const p1XRef = (0, import_react.useRef)(-1.8);
	const p2XRef = (0, import_react.useRef)(1.8);
	const p1ZRef = (0, import_react.useRef)(0);
	const p2ZRef = (0, import_react.useRef)(0);
	(0, import_react.useEffect)(() => {
		const held = /* @__PURE__ */ new Set();
		const apply = () => {
			const i = inputRef.current;
			i.left = held.has("KeyA") || held.has("ArrowLeft");
			i.right = held.has("KeyD") || held.has("ArrowRight");
			i.up = held.has("KeyW") || held.has("ArrowUp");
			i.down = held.has("KeyS") || held.has("ArrowDown");
		};
		window.__controlsTest = {
			getYaw: () => -p1XRef.current,
			getSpeed: () => Math.abs(p1VelRef.current.forward) + Math.abs(p1VelRef.current.strafe) + Math.abs(p1XRef.current + 1.8) + Math.abs(p1ZRef.current),
			setKeys: (codes) => {
				held.clear();
				for (const c of codes) held.add(c);
				apply();
			}
		};
		return () => {
			delete window.__controlsTest;
		};
	}, []);
	const [damageEvent, setDamageEvent] = (0, import_react.useState)(void 0);
	const damageEventCountRef = (0, import_react.useRef)(0);
	const [wallSplatEvent, setWallSplatEvent] = (0, import_react.useState)(void 0);
	const wallSplatEventCountRef = (0, import_react.useRef)(0);
	const [heatBurstEvent, setHeatBurstEvent] = (0, import_react.useState)(void 0);
	const heatBurstEventCountRef = (0, import_react.useRef)(0);
	const [rageArtEvent, setRageArtEvent] = (0, import_react.useState)(void 0);
	const rageArtEventCountRef = (0, import_react.useRef)(0);
	const [cameraShakeOffset, setCameraShakeOffset] = (0, import_react.useState)({
		x: 0,
		y: 0
	});
	const [p1HeatActive, setP1HeatActive] = (0, import_react.useState)(false);
	const [p2HeatActive, setP2HeatActive] = (0, import_react.useState)(false);
	const [p1RageArtAvailable, setP1RageArtAvailable] = (0, import_react.useState)(false);
	const [p2RageArtAvailable, setP2RageArtAvailable] = (0, import_react.useState)(false);
	const [p1PowerCrushActive, setP1PowerCrushActive] = (0, import_react.useState)(false);
	const [p2PowerCrushActive, setP2PowerCrushActive] = (0, import_react.useState)(false);
	const audioManagerRef = (0, import_react.useRef)(getGlobalAudioManager());
	(0, import_react.useEffect)(() => {
		const p1MoveSet = getCharacterMoveSet(p1Fighter.id);
		getCharacterMoveSet(p2Fighter.id);
		const engine = new GameEngine(p1Fighter, p2Fighter);
		if (p1MoveSet?.isCustomized) {
			const lightMove = getMoveById(p1MoveSet.lightAttack);
			const heavyMove = getMoveById(p1MoveSet.heavyAttack);
			if (lightMove) engine._p1LightOverride = lightMove;
			if (heavyMove) engine._p1HeavyOverride = heavyMove;
		}
		engineRef.current = engine;
		setP1Health(p1Fighter.hp);
		setP2Health(p2Fighter.hp);
		setFrame(0);
		setKo(false);
		setWinner(null);
		setRoundTimer(99);
		koHandledRef.current = false;
		roundStartedRef.current = false;
		setShowPostMatch(false);
		roundStartTimeRef.current = Date.now();
		setRoundResults([]);
		setP1Z(0);
		setP2Z(0);
		p1ZRef.current = 0;
		p2ZRef.current = 0;
		setP1X(-1.8);
		setP2X(1.8);
		p1XRef.current = -1.8;
		p2XRef.current = 1.8;
		p1LocoRef.current = new LocomotionSystem(-1.8, 0, 1);
		p2LocoRef.current = new LocomotionSystem(1.8, 0, -1);
		p1SMRef.current = new FighterStateMachine();
		p2SMRef.current = new FighterStateMachine();
		p1SMRef.current.registerSpecialMoves(DEFAULT_SPECIAL_MOVES);
		p2SMRef.current.registerSpecialMoves(DEFAULT_SPECIAL_MOVES);
		p1HitboxRef.current.reset();
		p2HitboxRef.current.reset();
		const freshP1Combo = createComboState("p1");
		const freshP2Combo = createComboState("p2");
		p1ComboRef.current = freshP1Combo;
		p2ComboRef.current = freshP2Combo;
		setP1Combo(freshP1Combo);
		setP2Combo(freshP2Combo);
		p1ImpactMarkersRef.current = [];
		p2ImpactMarkersRef.current = [];
		const freshArenaState = createArenaCombatState(stageId);
		arenaCombatStateRef.current = freshArenaState;
		setArenaState(freshArenaState);
		setRingOutNotice(null);
		setFloorBreakNotice(null);
		setHazardNotice(freshArenaState.config.hazardLabel);
		const freshStageManager = createStageManagerState(stageId, p1Fighter.hp, p2Fighter.hp);
		stageManagerRef.current = freshStageManager;
		setTrainWarningActive(false);
		setTrainCrossing(false);
		setTrainX(-20);
		setP1OnTracks(false);
		setP2OnTracks(false);
		setP1VaultPrompt(false);
		setP2VaultPrompt(false);
		setFloorBreakPhase("idle");
		setDebrisPositions([]);
		setLedgeThrowActive(false);
		setWallShatterLeft(false);
		setWallShatterRight(false);
		setHazardBounceNotice("");
		const audioManager = audioManagerRef.current;
		audioManager.init({ enabled: settings.soundEnabled }).then(() => {
			audioManager.playBGM("character_select", 800);
		});
		setCinematicPhase("sweep");
		setArenaReady(false);
		const tRecord = window.setTimeout(() => {
			startRecording();
		}, 4500);
		const t1 = window.setTimeout(() => {
			setCinematicPhase("intro");
			audioManager.preloadCombatAudio(stageId);
		}, SWEEP_DURATION_MS);
		const t2 = window.setTimeout(() => {
			setCinematicPhase("fight");
			setArenaReady(true);
			const stageCfg = resolveStageConfig(stageId);
			audioManager.playBGM(`stage_${stageCfg.bgmTrack}`, 1200);
		}, 4500);
		return () => {
			cancelAnimationFrame(rafRef.current);
			window.clearTimeout(t1);
			window.clearTimeout(t2);
			window.clearTimeout(tRecord);
			stopRecording();
			audioManager.stopBGM(500);
		};
	}, [p1Fighter, p2Fighter]);
	(0, import_react.useEffect)(() => {
		if (roundStartedRef.current) return;
		roundStartedRef.current = true;
		const t = window.setTimeout(() => {
			if (settings.soundEnabled) sfx.playRoundStart();
		}, 4800);
		return () => window.clearTimeout(t);
	}, [sfx, settings.soundEnabled]);
	(0, import_react.useEffect)(() => {
		const announcer = announcerRef.current;
		announcer.updateConfig({
			enabled: settings.soundEnabled,
			p1Name: p1Fighter.name,
			p2Name: p2Fighter.name
		});
		announcerFiredRef.current = {
			getReady: false,
			round: false,
			fight: false,
			ko: false
		};
		const tGetReady = window.setTimeout(() => {
			if (!announcerFiredRef.current.getReady) {
				announcerFiredRef.current.getReady = true;
				announcer.fire("getReady");
			}
		}, 200);
		const tRound = window.setTimeout(() => {
			if (!announcerFiredRef.current.round) {
				announcerFiredRef.current.round = true;
				announcer.fire("round1");
			}
		}, 2300);
		const tFight = window.setTimeout(() => {
			if (!announcerFiredRef.current.fight) {
				announcerFiredRef.current.fight = true;
				announcer.fire("fight");
			}
		}, 5100);
		return () => {
			window.clearTimeout(tGetReady);
			window.clearTimeout(tRound);
			window.clearTimeout(tFight);
		};
	}, [
		p1Fighter,
		p2Fighter,
		settings.soundEnabled
	]);
	const prevP1StateRef = (0, import_react.useRef)("Neutral");
	const prevP2StateRef = (0, import_react.useRef)("Neutral");
	const prevP1HealthRef = (0, import_react.useRef)(p1Fighter.hp);
	const prevP2HealthRef = (0, import_react.useRef)(p2Fighter.hp);
	const p1Color = FACTION_COLOR[p1Fighter.factionAlignment] ?? "#facc15";
	const p2Color = FACTION_COLOR[p2Fighter.factionAlignment] ?? "#facc15";
	const [p1GrabRangeVisible, setP1GrabRangeVisible] = (0, import_react.useState)(false);
	const [p1GrabRangeRadius, setP1GrabRangeRadius] = (0, import_react.useState)(1.4);
	const [p1GrabRangeHit, setP1GrabRangeHit] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (cinematicPhase !== "fight") return;
		let lastTime = 0;
		const loop = (now) => {
			rafRef.current = requestAnimationFrame(loop);
			const engine = engineRef.current;
			if (!engine) return;
			if (now - lastTime < 15.666666666666668) return;
			const dt = Math.min((now - lastTime) / 1e3, .05);
			lastTime = now;
			const prevP1Health = prevP1HealthRef.current;
			const prevP2Health = prevP2HealthRef.current;
			const prevP1State = prevP1StateRef.current;
			const prevP2State = prevP2StateRef.current;
			const bitmask = inputRef.current;
			const cmd = p1StickRef.current.resolve({
				left: !!bitmask.left,
				right: !!bitmask.right,
				up: !!bitmask.up,
				down: !!bitmask.down
			}, now);
			const smInput = {
				forward: cmd.forward,
				strafe: cmd.strafe,
				light: bitmask.light ?? false,
				heavy: bitmask.heavy ?? false,
				guard: bitmask.guard ?? false,
				crouch: cmd.crouch,
				grapple: bitmask.grapple ?? false,
				escape: bitmask.escape ?? false,
				lp: bitmask.lp ?? false,
				rp: bitmask.rp ?? false,
				lk: bitmask.lk ?? false,
				rk: bitmask.rk ?? false,
				heatBurst: bitmask.heatBurst ?? false,
				rageArt: bitmask.rageArt ?? false,
				leftThrow: bitmask.leftThrow ?? false,
				rightThrow: bitmask.rightThrow ?? false,
				jump: cmd.jump,
				dashing: cmd.dashing,
				backdashing: cmd.backdashing,
				running: cmd.running
			};
			if (!smInput.strafe) {
				if (bitmask.sidestepBg) smInput.strafe = -1;
				else if (bitmask.sidestepFg) smInput.strafe = 1;
			}
			const p1KiInput = {
				lp: smInput.lp,
				rp: smInput.rp,
				lk: smInput.lk,
				rk: smInput.rk
			};
			const prevP1KiActive = p1KiChargeRef.current.active;
			const newP1KiCharge = tickKiCharge(p1KiChargeRef.current, p1KiInput, false, dt);
			if (!prevP1KiActive && newP1KiCharge.active) {
				announcerRef.current.fire("kiCharge");
				setSpecialMoveNotice({
					name: "Ki Charge!",
					player: "p1",
					id: ++specialNoticeIdRef.current
				});
				setTimeout(() => setSpecialMoveNotice(null), 2e3);
				console.log("[Arena] ⚡ P1 Ki Charge activated");
			}
			p1KiChargeRef.current = newP1KiCharge;
			setP1KiCharge({ ...newP1KiCharge });
			combatStateRef.current = tickCombatState(combatStateRef.current, p1KiInput, {}, dt);
			const p1X = p1XRef.current;
			const p2X = p2XRef.current;
			const prevArena = arenaCombatStateRef.current;
			const newArena = tickArenaState(prevArena, p1X, p2X, 0, 0, false, false);
			arenaCombatStateRef.current = newArena;
			if (newArena.p1RingOut && !prevArena.p1RingOut) {
				setRingOutNotice({
					player: "p1",
					count: ++ringOutNoticeCountRef.current
				});
				setP1Health(0);
			}
			if (newArena.p2RingOut && !prevArena.p2RingOut) {
				setRingOutNotice({
					player: "p2",
					count: ++ringOutNoticeCountRef.current
				});
				setP2Health(0);
			}
			if (newArena.p1FloorBreakPending && !prevArena.p1FloorBreakPending) {
				const lvl = newArena.config.levels[newArena.p1LevelIndex];
				setFloorBreakNotice({
					player: "p1",
					level: lvl?.label ?? "LOWER LEVEL",
					count: ++floorBreakNoticeCountRef.current
				});
				arenaCombatStateRef.current = {
					...newArena,
					p1FloorBreakPending: false
				};
			}
			if (newArena.p2FloorBreakPending && !prevArena.p2FloorBreakPending) {
				const lvl = newArena.config.levels[newArena.p2LevelIndex];
				setFloorBreakNotice({
					player: "p2",
					level: lvl?.label ?? "LOWER LEVEL",
					count: ++floorBreakNoticeCountRef.current
				});
				arenaCombatStateRef.current = {
					...newArena,
					p2FloorBreakPending: false
				};
			}
			if (newArena.p1InHazard) {
				const hazardDmg = newArena.config.levels[newArena.p1LevelIndex]?.hazardDamagePerSec ?? 0;
				if (hazardDmg > 0) setP1Health((h) => Math.max(0, h - hazardDmg * dt));
			}
			if (newArena.p2InHazard) {
				const hazardDmg = newArena.config.levels[newArena.p2LevelIndex]?.hazardDamagePerSec ?? 0;
				if (hazardDmg > 0) setP2Health((h) => Math.max(0, h - hazardDmg * dt));
			}
			const sm = stageManagerRef.current;
			const stageCfg = sm.config;
			if (sm.trainHazard.enabled) {
				const p1InputUp = inputRef.current.up ?? false;
				const trainResult = tickTrainHazard(sm.trainHazard, dt, p1YRef.current, p2YRef.current, p1InputUp, false);
				stageManagerRef.current = {
					...sm,
					trainHazard: trainResult.state
				};
				setTrainWarningActive(trainResult.state.warningActive);
				setTrainCrossing(trainResult.state.trainCrossing);
				setTrainX(trainResult.state.trainX);
				setP1OnTracks(trainResult.state.p1OnTracks);
				setP2OnTracks(trainResult.state.p2OnTracks);
				setP1VaultPrompt(trainResult.state.p1OnTracks && !trainResult.state.p1VaultActive);
				setP2VaultPrompt(trainResult.state.p2OnTracks && !trainResult.state.p2VaultActive);
				if (trainResult.fireWarning) {
					audioManagerRef.current.playSFX("train_horn");
					console.log("[Train] 🚇 WARNING — train incoming in 2 seconds!");
				}
				if (trainResult.p1TrainHit) {
					const trainDmg = Math.round(p1Fighter.hp * TRAIN_HIT_DAMAGE);
					setP1Health((h) => Math.max(0, h - trainDmg));
					audioManagerRef.current.playSFX("heavy_hit");
					audioManagerRef.current.playVOX("pain_grunt");
					setDamageEvent({
						count: ++damageEventCountRef.current,
						player: "p1",
						damage: trainDmg,
						isCounter: false,
						factionColor: "#f59e0b"
					});
					p1YRef.current = 0;
					p1SMRef.current.applyKnockdown();
					console.log("[Train] 🚇 P1 HIT BY TRAIN — damage:", trainDmg);
				}
				if (trainResult.p2TrainHit) {
					const trainDmg = Math.round(p2Fighter.hp * TRAIN_HIT_DAMAGE);
					setP2Health((h) => Math.max(0, h - trainDmg));
					audioManagerRef.current.playSFX("heavy_hit");
					audioManagerRef.current.playVOX("pain_grunt");
					setDamageEvent({
						count: ++damageEventCountRef.current,
						player: "p2",
						damage: trainDmg,
						isCounter: false,
						factionColor: "#f59e0b"
					});
					p2YRef.current = 0;
					p2SMRef.current.applyKnockdown();
					console.log("[Train] 🚇 P2 HIT BY TRAIN — damage:", trainDmg);
				}
				if (trainResult.crossingEnded) console.log("[Train] 🚇 Train passed. Next crossing in", Math.round(trainResult.state.nextCrossingInterval), "s");
			}
			if (sm.floorBreak.phase !== "idle") {
				const fbResult = tickFloorBreak(sm.floorBreak, dt);
				stageManagerRef.current = {
					...stageManagerRef.current,
					floorBreak: fbResult.state
				};
				setFloorBreakPhase(fbResult.state.phase);
				setDebrisPositions(fbResult.state.debrisPositions.map((d) => ({
					x: d.x,
					y: d.y,
					z: d.z
				})));
				if (fbResult.applyLandingDamage && sm.floorBreak.triggerFighter) {
					const victim = sm.floorBreak.triggerFighter;
					const landDmg = fbResult.state.landingDamage;
					if (victim === "p1") {
						setP1Health((h) => Math.max(0, h - landDmg));
						setDamageEvent({
							count: ++damageEventCountRef.current,
							player: "p1",
							damage: landDmg,
							isCounter: false,
							factionColor: "#f97316"
						});
					} else {
						setP2Health((h) => Math.max(0, h - landDmg));
						setDamageEvent({
							count: ++damageEventCountRef.current,
							player: "p2",
							damage: landDmg,
							isCounter: false,
							factionColor: "#f97316"
						});
					}
					audioManagerRef.current.playSFX("floor_slam");
					console.log("[FloorBreak] 💥 Landing damage applied to", victim, ":", landDmg);
				}
				if (fbResult.transitionComplete) console.log("[FloorBreak] ✅ Stage transition complete — input restored");
			}
			if (sm.ledgeThrow.active) {
				const ltResult = tickLedgeThrow(sm.ledgeThrow);
				stageManagerRef.current = {
					...stageManagerRef.current,
					ledgeThrow: ltResult.state
				};
				setLedgeThrowActive(ltResult.state.active);
				if (ltResult.koVictim) {
					if (ltResult.koVictim === "p1") {
						setP1Health(0);
						setRingOutNotice({
							player: "p1",
							count: ++ringOutNoticeCountRef.current
						});
					} else {
						setP2Health(0);
						setRingOutNotice({
							player: "p2",
							count: ++ringOutNoticeCountRef.current
						});
					}
					audioManagerRef.current.playSFX("floor_slam");
					announcerRef.current.fire("ko");
					console.log("[LedgeThrow] 🎯 Ring-out KO:", ltResult.koVictim);
				}
			}
			{
				const newWalls = tickDestructibleWalls(sm.destructibleWalls);
				stageManagerRef.current = {
					...stageManagerRef.current,
					destructibleWalls: newWalls
				};
				setWallShatterLeft(newWalls.leftShatterActive);
				setWallShatterRight(newWalls.rightShatterActive);
			}
			{
				const newBounce = tickHazardBounce(sm.hazardBounce);
				stageManagerRef.current = {
					...stageManagerRef.current,
					hazardBounce: newBounce
				};
				if (newBounce.p1BounceActive && newBounce.p1BounceFrames > 0) {
					const newX = p1XRef.current + (newBounce.p1TargetX - p1XRef.current) * .15;
					p1XRef.current = newX;
					p1LocoRef.current.clampX(newX);
					setP1X(newX);
				}
				if (newBounce.p2BounceActive && newBounce.p2BounceFrames > 0) {
					const newX = p2XRef.current + (newBounce.p2TargetX - p2XRef.current) * .15;
					p2XRef.current = newX;
					p2LocoRef.current.clampX(newX);
					setP2X(newX);
				}
			}
			if (!sm.ledgeThrow.active && stageCfg.ringOutEnabled && isFinite(stageCfg.boundaryX)) {
				if ((inputRef.current.grapple ?? false) && p1SMRef.current.action === "Idle") {
					if (checkLedgeThrowOverride(p1XRef.current, p2XRef.current, stageCfg.boundaryX, stageCfg.ringOutEnabled)) {
						const ledgeState = executeLedgeThrow("p2");
						stageManagerRef.current = {
							...stageManagerRef.current,
							ledgeThrow: ledgeState
						};
						setLedgeThrowActive(true);
						setSpecialMoveNotice({
							name: "LEDGE THROW!",
							player: "p1",
							id: ++specialNoticeIdRef.current
						});
						setTimeout(() => setSpecialMoveNotice(null), 2e3);
						audioManagerRef.current.playSFX("throw_connect");
						console.log("[LedgeThrow] 🎯 Ledge throw override activated!");
					}
				}
			}
			if (stageCfg.hasDestructibleWalls) {
				const smSnap = stageManagerRef.current;
				const p2WallState = combatStateRef.current.p2.wallSplat;
				if (p2WallState.isSplatted && p2WallState.wall) {
					if (checkWallBreak(Math.abs(combatStateRef.current.p2.velocityX ?? 0) * 1e3, p2WallState.wall, smSnap.destructibleWalls, true)) {
						const newWalls = applyWallBreak(smSnap.destructibleWalls, p2WallState.wall);
						stageManagerRef.current = {
							...stageManagerRef.current,
							destructibleWalls: newWalls
						};
						setSpecialMoveNotice({
							name: "WALL BREAK!",
							player: "p1",
							id: ++specialNoticeIdRef.current
						});
						setTimeout(() => setSpecialMoveNotice(null), 2e3);
						audioManagerRef.current.playSFX("wall_splat");
						console.log("[WallBreak] 💥 Wall broken:", p2WallState.wall);
					}
				}
				const p1WallState = combatStateRef.current.p1.wallSplat;
				if (p1WallState.isSplatted && p1WallState.wall) {
					if (checkWallBreak(Math.abs(combatStateRef.current.p1.velocityX ?? 0) * 1e3, p1WallState.wall, smSnap.destructibleWalls, true)) {
						const newWalls = applyWallBreak(smSnap.destructibleWalls, p1WallState.wall);
						stageManagerRef.current = {
							...stageManagerRef.current,
							destructibleWalls: newWalls
						};
						setSpecialMoveNotice({
							name: "WALL BREAK!",
							player: "p2",
							id: ++specialNoticeIdRef.current
						});
						setTimeout(() => setSpecialMoveNotice(null), 2e3);
						audioManagerRef.current.playSFX("wall_splat");
					}
				}
			}
			if (stageCfg.hazardVolume) {
				const smSnap = stageManagerRef.current;
				const hv = stageCfg.hazardVolume;
				const p1InKnockback = combatStateRef.current.p1.stun.isHitStun;
				const p2InKnockback = combatStateRef.current.p2.stun.isHitStun;
				if (!smSnap.hazardBounce.p1BounceActive && checkHazardVolume(p1XRef.current, hv.triggerX, p1InKnockback)) {
					const newBounce = applyHazardBounce(smSnap.hazardBounce, "p1", p1XRef.current);
					stageManagerRef.current = {
						...stageManagerRef.current,
						hazardBounce: newBounce
					};
					const chipDmg = Math.round(p1Fighter.hp * hv.chipDamage);
					setP1Health((h) => Math.max(0, h - chipDmg));
					setHazardBounceNotice(hv.label);
					if (hazardBounceNoticeTimerRef.current) clearTimeout(hazardBounceNoticeTimerRef.current);
					hazardBounceNoticeTimerRef.current = setTimeout(() => setHazardBounceNotice(""), 1500);
					audioManagerRef.current.playSFX("wall_splat");
					console.log("[HazardBounce] 🔥 P1 bounced by hazard volume:", hv.label);
				}
				if (!smSnap.hazardBounce.p2BounceActive && checkHazardVolume(p2XRef.current, hv.triggerX, p2InKnockback)) {
					const newBounce = applyHazardBounce(smSnap.hazardBounce, "p2", p2XRef.current);
					stageManagerRef.current = {
						...stageManagerRef.current,
						hazardBounce: newBounce
					};
					const chipDmg = Math.round(p2Fighter.hp * hv.chipDamage);
					setP2Health((h) => Math.max(0, h - chipDmg));
					setHazardBounceNotice(hv.label);
					if (hazardBounceNoticeTimerRef.current) clearTimeout(hazardBounceNoticeTimerRef.current);
					hazardBounceNoticeTimerRef.current = setTimeout(() => setHazardBounceNotice(""), 1500);
					audioManagerRef.current.playSFX("wall_splat");
					console.log("[HazardBounce] 🔥 P2 bounced by hazard volume:", hv.label);
				}
			}
			const p1HpPct = prevP1HealthRef.current / p1Fighter.hp;
			p1SMRef.current.setRageArtAvailable(p1HpPct);
			const p1SM = p1SMRef.current;
			const p1Hb = p1HitboxRef.current;
			const prevP1Action = p1SM.action;
			const p1NextMotion = p1SM.update(smInput, dt);
			const p1HbWindow = p1SM.getHitboxWindow();
			p1Hb.update(p1HbWindow);
			if (p1SM.action === "CommandThrow" && prevP1Action !== "CommandThrow") {
				const grabResult = p1SM.checkGrabRange(p1XRef.current, p2XRef.current, p2SMRef.current.action);
				setP1GrabRangeVisible(true);
				setP1GrabRangeRadius(grabResult.grabRange);
				setP1GrabRangeHit(grabResult.throwSucceeded);
				p1SM.resolveCommandThrow(grabResult.throwSucceeded);
				if (grabResult.throwSucceeded) {
					const throwDmg = COMMAND_THROW_MOVE.damage ?? 220;
					p2SMRef.current.applyKnockdown();
					p2HitboxRef.current.reset();
					console.log("[Arena] ✅ Command throw connected — damage:", throwDmg);
					if (settings.soundEnabled) sfx.playHeavyHit();
					setDamageEvent({
						count: ++damageEventCountRef.current,
						player: "p2",
						damage: throwDmg,
						isCounter: false,
						factionColor: p2Color
					});
					setFeedbackEvents((prev) => [...prev.slice(-6), {
						id: ++feedbackIdRef.current,
						moveId: "commandThrow",
						moveName: "Command Throw",
						damage: throwDmg,
						isBlocked: false,
						isCounter: false,
						player: "p1",
						x: 60 + Math.random() * 10,
						y: 20 + Math.random() * 20
					}]);
				}
				setTimeout(() => setP1GrabRangeVisible(false), 400);
			}
			if (p1SM.action === "Attacking" && prevP1Action !== "Attacking") {
				const move = p1HbWindow.move;
				if (move?.isSpecial && move.specialName) {
					setSpecialMoveNotice({
						name: move.specialName,
						player: "p1",
						id: ++specialNoticeIdRef.current
					});
					setTimeout(() => setSpecialMoveNotice(null), 1800);
					if (move.specialName === "Heat Burst") {
						const audioMgrHeat = audioManagerRef.current;
						audioMgrHeat.playSFX("heat_burst_activate");
						audioMgrHeat.playVOX("heat_burst_yell");
						setHeatBurstEvent({
							count: ++heatBurstEventCountRef.current,
							player: "p1"
						});
						setP1HeatActive(true);
						setTimeout(() => setP1HeatActive(false), 5e3);
					}
					if (move.specialName === "Rage Art") {
						const audioMgrRage = audioManagerRef.current;
						audioMgrRage.playSFX("rage_art_activate");
						audioMgrRage.playVOX("rage_art_yell");
						audioMgrRage.playAnnouncer("ki_charge");
						setRageArtEvent({
							count: ++rageArtEventCountRef.current,
							player: "p1"
						});
						setP1RageArtAvailable(false);
					}
				}
			}
			const detectedThrowId = detectThrowInput({
				lp: smInput.lp ?? false,
				rp: smInput.rp ?? false,
				lk: smInput.lk ?? false,
				rk: smInput.rk ?? false,
				forward: smInput.forward > 0,
				backward: smInput.forward < 0
			});
			if (detectedThrowId && p1SM.action === "Idle") {
				if (checkThrowRange(p1XRef.current, p1ZRef.current, p2XRef.current, p2ZRef.current)) {
					const throwDef = THROW_CATALOG[detectedThrowId];
					if (throwDef) {
						const throwDmg = getThrowDamage(detectedThrowId, false);
						p2SMRef.current.applyKnockdown();
						p2LocoRef.current.halt();
						audioManagerRef.current.playSFX("throw_connect");
						audioManagerRef.current.playVOX("attack_grunt");
						setDamageEvent({
							count: ++damageEventCountRef.current,
							player: "p2",
							damage: throwDmg,
							isCounter: false,
							factionColor: p2Color
						});
						setSpecialMoveNotice({
							name: throwDef.name,
							player: "p1",
							id: ++specialNoticeIdRef.current
						});
						setTimeout(() => setSpecialMoveNotice(null), 1500);
						setKnockdownEvent({
							count: ++knockdownEventCountRef.current,
							player: "p2"
						});
					}
				} else audioManagerRef.current.playSFX("whiff");
			}
			const p1HpPctForRage = prevP1HealthRef.current / p1Fighter.hp;
			const p2HpPctForRage = prevP2HealthRef.current / p2Fighter.hp;
			setP1RageArtAvailable(p1HpPctForRage <= .25);
			setP2RageArtAvailable(p2HpPctForRage <= .25);
			const p2SM = p2SMRef.current;
			const p2IsBlocking = p2SM.action === "Guard" && !p2KiChargeRef.current.blockingDisabled;
			const p1AttackIsLinear = !p1HbWindow.move?.isSpecial;
			const p1Hit = checkSidestepWhiff(p1ZRef.current, p2ZRef.current, !p1AttackIsLinear) ? null : p1Hb.checkCollision(p1XRef.current, p1ZRef.current, 1, p2XRef.current, p2ZRef.current, p2IsBlocking, p1HbWindow.currentFrame);
			if (p1Hit) {
				const p1KiActive = p1KiChargeRef.current.active;
				if (p1KiActive) {
					p1KiChargeRef.current = {
						...p1KiChargeRef.current,
						active: false,
						framesRemaining: 0,
						nextAttackIsCounter: false,
						blockingDisabled: false
					};
					setP1KiCharge({ ...p1KiChargeRef.current });
				}
				const p1HitMove = p1HbWindow.move;
				const guardResult = p1HitMove ? p2SMRef.current.processIncomingHit(p1HitMove) : {
					blocked: false,
					chipDamage: 0,
					guardBroken: false,
					finalDamage: p1Hit.damage
				};
				let effectiveDamage = guardResult.blocked ? p1KiActive ? Math.round(p1Hit.damage * p1KiChargeRef.current.chipDamageMultiplier) : guardResult.finalDamage : p1Hit.damage;
				if (p1KiActive && !guardResult.blocked) effectiveDamage = applyKiChargeCounterHit(effectiveDamage);
				const { scaledDamage: p1ScaledDmg, newState: newP1Combo } = registerHit(p1ComboRef.current, effectiveDamage, now);
				p1ComboRef.current = newP1Combo;
				setP1Combo({ ...newP1Combo });
				if (!guardResult.blocked) engine.applyIncomingHit("p2", p1ScaledDmg, false, p1Hit.hitstun || .3);
				if (!guardResult.blocked && p1Hit.launch > .3) {
					p2SMRef.current.applyKnockdown();
					p2LocoRef.current.halt();
					setKnockdownEvent({
						count: ++knockdownEventCountRef.current,
						player: "p2"
					});
					const slamDmg = p1Hit.damage ?? 0;
					const prevArenaSnap = arenaCombatStateRef.current;
					const afterSlam = tickArenaState(prevArenaSnap, p1XRef.current, p2XRef.current, 0, slamDmg, false, true);
					arenaCombatStateRef.current = afterSlam;
					if (afterSlam.p2FloorBreakPending && !prevArenaSnap.p2FloorBreakPending) {
						const lvl = afterSlam.config.levels[afterSlam.p2LevelIndex];
						setFloorBreakNotice({
							player: "p2",
							level: lvl?.label ?? "LOWER LEVEL",
							count: ++floorBreakNoticeCountRef.current
						});
						arenaCombatStateRef.current = {
							...afterSlam,
							p2FloorBreakPending: false
						};
						audioManagerRef.current.playSFX("floor_slam");
						const fbState = triggerFloorBreak("p2", afterSlam.p2LevelIndex, slamDmg);
						stageManagerRef.current = {
							...stageManagerRef.current,
							floorBreak: fbState
						};
						setFloorBreakPhase("floor_break_debris");
					}
				} else if (!guardResult.blocked) {
					p2SMRef.current.applyStun(p1Hit.hitstun || .3, false);
					p2LocoRef.current.applyPushback(p1Hit.pushback ?? .3);
				}
				if (guardResult.guardBroken) p2SMRef.current.applyStun(p1Hit.hitstun || .3, false);
				p2HitboxRef.current.reset();
				if (!guardResult.blocked) {
					const attackKey = p1HbWindow.move?.animation ?? "lightAttack";
					const stopMs = p1Hit.damage > 120 || p1HbWindow.move?.isSpecial ? HIT_STOP_DURATIONS[attackKey] ?? 80 : HIT_STOP_DURATIONS.lightAttack;
					hitStopTimerRef.current = stopMs / 1e3;
					hitStopActiveRef.current = true;
					setHitStopActive(true);
					console.log(`[Arena] ❄️ Hit stop triggered: ${stopMs}ms for "${attackKey}"`);
				}
				const isBlocked = guardResult.blocked;
				const isCounter = prevP2State === FighterState.Startup || prevP2State === FighterState.Active;
				if (settings.soundEnabled) {
					if (isBlocked) sfx.playBlock();
					else if (isCounter) sfx.playCounter();
					else if (p1Hit.damage > 200) sfx.playHeavyHit();
					else sfx.playLightHit();
				}
				const audioMgr = audioManagerRef.current;
				if (isBlocked) audioMgr.playSFX("block");
				else if (isCounter) {
					audioMgr.playSFX("counter_hit");
					audioMgr.playVOX("pain_grunt");
				} else if (p1Hit.damage > 200) {
					audioMgr.playSFX("heavy_hit");
					audioMgr.playVOX("pain_grunt");
				} else audioMgr.playSFX("light_hit");
				if (p1Hit.damage > 100 && !isBlocked) audioMgr.playVOX("attack_grunt");
				const p2CombatState = combatStateRef.current.p2;
				if (p2CombatState.wallSplat.isSplatted && !p2CombatState.wallSplat.chainedDuringWindow) {
					const wall = p2CombatState.wallSplat.wall;
					if (wall) {
						setWallSplatEvent({
							count: ++wallSplatEventCountRef.current,
							player: "p2",
							wall
						});
						audioMgr.playSFX("wall_splat");
						setSpecialMoveNotice({
							name: "WALL SPLAT!",
							player: "p1",
							id: ++specialNoticeIdRef.current
						});
						setTimeout(() => setSpecialMoveNotice(null), 1500);
					}
				}
				setDamageEvent({
					count: ++damageEventCountRef.current,
					player: "p2",
					damage: p1ScaledDmg,
					isCounter,
					factionColor: p2Color
				});
				setFeedbackEvents((prev) => [...prev.slice(-6), {
					id: ++feedbackIdRef.current,
					moveId: p1HbWindow.move?.animation ?? "hit",
					moveName: p1HbWindow.move?.specialName ?? (p1HbWindow.move?.animation === "heavyAttack" ? "Heavy" : "Light"),
					damage: p1ScaledDmg,
					isBlocked,
					isCounter,
					player: "p1",
					x: 65 + Math.random() * 10,
					y: 20 + Math.random() * 20
				}]);
				if (debugSettings.enabled && debugSettings.showImpactMarkers) {
					const marker = {
						id: ++impactMarkerIdRef.current,
						x: 60 + Math.random() * 10,
						y: 25 + Math.random() * 30,
						frame: p1HbWindow.currentFrame,
						timestamp: now,
						damage: p1ScaledDmg,
						isBlocked
					};
					p1ImpactMarkersRef.current = [...p1ImpactMarkersRef.current.slice(-4), marker];
				}
			}
			const p2Hb = p2HitboxRef.current;
			const p2AIInput = buildP2AIInput(mapActionToDisplayState(p2SMRef.current.action, p2SMRef.current.current, engine.p2State), engine.p1Health, engine.p2Health, p2XRef.current, p1XRef.current);
			const p2NextMotion = p2SM.update(p2AIInput, dt);
			const p2HbWindow = p2SM.getHitboxWindow();
			p2Hb.update(p2HbWindow);
			const p1IsBlocking = p1SM.action === "Guard";
			const p2Hit = p2Hb.checkCollision(p2XRef.current, p2ZRef.current, -1, p1XRef.current, p1ZRef.current, p1IsBlocking, p2HbWindow.currentFrame);
			if (p2Hit) {
				const p2HitMove = p2HbWindow.move;
				const p1GuardResult = p2HitMove ? p1SMRef.current.processIncomingHit(p2HitMove) : {
					blocked: false,
					chipDamage: 0,
					guardBroken: false,
					finalDamage: p2Hit.damage
				};
				const p1EffectiveDamage = p1GuardResult.blocked ? p1GuardResult.finalDamage : p2Hit.damage;
				const { scaledDamage: p2ScaledDmg, newState: newP2Combo } = registerHit(p2ComboRef.current, p1EffectiveDamage, now);
				p2ComboRef.current = newP2Combo;
				setP2Combo({ ...newP2Combo });
				if (!p1GuardResult.blocked) engine.applyIncomingHit("p1", p2ScaledDmg, false, p2Hit.hitstun || .3);
				if (!p1GuardResult.blocked && p2Hit.launch > .3) {
					p1SMRef.current.applyKnockdown();
					p1LocoRef.current.halt();
					setKnockdownEvent({
						count: ++knockdownEventCountRef.current,
						player: "p1"
					});
					const slamDmg = p2Hit.damage ?? 0;
					const prevArenaSnap = arenaCombatStateRef.current;
					const afterSlam = tickArenaState(prevArenaSnap, p1XRef.current, p2XRef.current, slamDmg, 0, true, false);
					arenaCombatStateRef.current = afterSlam;
					if (afterSlam.p1FloorBreakPending && !prevArenaSnap.p1FloorBreakPending) {
						const lvl = afterSlam.config.levels[afterSlam.p1LevelIndex];
						setFloorBreakNotice({
							player: "p1",
							level: lvl?.label ?? "LOWER LEVEL",
							count: ++floorBreakNoticeCountRef.current
						});
						arenaCombatStateRef.current = {
							...afterSlam,
							p1FloorBreakPending: false
						};
						audioManagerRef.current.playSFX("floor_slam");
						const fbState = triggerFloorBreak("p1", afterSlam.p1LevelIndex, slamDmg);
						stageManagerRef.current = {
							...stageManagerRef.current,
							floorBreak: fbState
						};
						setFloorBreakPhase("floor_break_debris");
					}
				} else if (!p1GuardResult.blocked) {
					p1SMRef.current.applyStun(p2Hit.hitstun || .3, false);
					p1LocoRef.current.applyPushback(p2Hit.pushback ?? .3);
				}
				if (p1GuardResult.guardBroken) p1SMRef.current.applyStun(p2Hit.hitstun || .3, false);
				p1HitboxRef.current.reset();
				if (!p1GuardResult.blocked) {
					const attackKey = p2HbWindow.move?.animation ?? "lightAttack";
					const stopMs = p2Hit.damage > 120 || p2HbWindow.move?.isSpecial ? HIT_STOP_DURATIONS[attackKey] ?? 80 : HIT_STOP_DURATIONS.lightAttack;
					hitStopTimerRef.current = stopMs / 1e3;
					hitStopActiveRef.current = true;
					setHitStopActive(true);
				}
				const isBlocked = p1GuardResult.blocked;
				const isCounter = prevP1State === FighterState.Startup || prevP1State === FighterState.Active;
				if (settings.soundEnabled) {
					if (isBlocked) sfx.playBlock();
					else if (isCounter) sfx.playCounter();
					else if (p2Hit.damage > 200) sfx.playHeavyHit();
					else sfx.playLightHit();
				}
				const audioMgr2 = audioManagerRef.current;
				if (isBlocked) audioMgr2.playSFX("block");
				else if (isCounter) {
					audioMgr2.playSFX("counter_hit");
					audioMgr2.playVOX("pain_grunt");
				} else if (p2Hit.damage > 200) {
					audioMgr2.playSFX("heavy_hit");
					audioMgr2.playVOX("pain_grunt");
				} else audioMgr2.playSFX("light_hit");
				if (p2Hit.damage > 100 && !isBlocked) audioMgr2.playVOX("attack_grunt");
				const p1CombatState = combatStateRef.current.p1;
				if (p1CombatState.wallSplat.isSplatted && !p1CombatState.wallSplat.chainedDuringWindow) {
					const wall = p1CombatState.wallSplat.wall;
					if (wall) {
						setWallSplatEvent({
							count: ++wallSplatEventCountRef.current,
							player: "p1",
							wall
						});
						audioMgr2.playSFX("wall_splat");
					}
				}
				setDamageEvent({
					count: ++damageEventCountRef.current,
					player: "p1",
					damage: p2ScaledDmg,
					isCounter,
					factionColor: p1Color
				});
				setFeedbackEvents((prev) => [...prev.slice(-6), {
					id: ++feedbackIdRef.current,
					moveId: p2HbWindow.move?.animation ?? "hit",
					moveName: p2HbWindow.move?.specialName ?? (p2HbWindow.move?.animation === "heavyAttack" ? "Heavy" : "Light"),
					damage: p2ScaledDmg,
					isBlocked,
					isCounter,
					player: "p2",
					x: 25 + Math.random() * 10,
					y: 20 + Math.random() * 20
				}]);
				if (debugSettings.enabled && debugSettings.showImpactMarkers) {
					const marker = {
						id: ++impactMarkerIdRef.current,
						x: 28 + Math.random() * 10,
						y: 25 + Math.random() * 30,
						frame: p2HbWindow.currentFrame,
						timestamp: now,
						damage: p2ScaledDmg,
						isBlocked
					};
					p2ImpactMarkersRef.current = [...p2ImpactMarkersRef.current.slice(-4), marker];
				}
			}
			const { p1Combo: tickedP1, p2Combo: tickedP2 } = tickComboSystem(p1ComboRef.current, p2ComboRef.current, now);
			if (tickedP1 !== p1ComboRef.current) {
				p1ComboRef.current = tickedP1;
				setP1Combo({ ...tickedP1 });
			}
			if (tickedP2 !== p2ComboRef.current) {
				p2ComboRef.current = tickedP2;
				setP2Combo({ ...tickedP2 });
			}
			if (debugSettings.enabled) {
				const p1Action = mapActionToDisplayState(p1SM.action, p1NextMotion, engine.state);
				const p2Action = mapActionToDisplayState(p2SM.action, p2NextMotion, engine.p2State);
				const p1Fw = computeFrameWindowData(p1HbWindow, p1SM.action);
				const p2Fw = computeFrameWindowData(p2HbWindow, p2SM.action);
				const p1Geom = p1Hb.geometry;
				const p2Geom = p2Hb.geometry;
				const p1CrossfadeState = p1SM.getCrossfadeState();
				const p2CrossfadeState = p2SM.getCrossfadeState();
				const p1ClipDuration = p1HbWindow.move ? p1HbWindow.move.startup + p1HbWindow.move.active + p1HbWindow.move.recovery : 1;
				const p2ClipDuration = p2HbWindow.move ? p2HbWindow.move.startup + p2HbWindow.move.active + p2HbWindow.move.recovery : 1;
				const p1RigState = computeRigState(p1NextMotion, p1HbWindow.move ? p1ClipDuration - (p1HbWindow.move.startup + p1HbWindow.move.active + p1HbWindow.move.recovery - p1HbWindow.currentFrame / 60) : 0, p1ClipDuration, 1, p1CrossfadeState.isCrossfading, p1CrossfadeState.progress);
				const p2RigState = computeRigState(p2NextMotion, p2HbWindow.move ? p2ClipDuration - (p2HbWindow.move.startup + p2HbWindow.move.active + p2HbWindow.move.recovery - p2HbWindow.currentFrame / 60) : 0, p2ClipDuration, 1, p2CrossfadeState.isCrossfading, p2CrossfadeState.progress);
				setP1DebugData({
					player: "p1",
					frameWindow: p1Fw,
					aabb: p1Geom ? {
						centerX: p1XRef.current + p1Geom.offsetX,
						centerZ: p1ZRef.current + p1Geom.offsetZ,
						width: p1Geom.width,
						depth: p1Geom.depth,
						isActive: p1Hb.isActive
					} : null,
					impactMarkers: p1ImpactMarkersRef.current,
					actionState: p1Action,
					rigState: p1RigState,
					hurtboxRegions: p1Hb.getHurtboxRegions()
				});
				setP2DebugData({
					player: "p2",
					frameWindow: p2Fw,
					aabb: p2Geom ? {
						centerX: p2XRef.current - p2Geom.offsetX,
						centerZ: p2ZRef.current + p2Geom.offsetZ,
						width: p2Geom.width,
						depth: p2Geom.depth,
						isActive: p2Hb.isActive
					} : null,
					impactMarkers: p2ImpactMarkersRef.current,
					actionState: p2Action,
					rigState: p2RigState,
					hurtboxRegions: p2Hb.getHurtboxRegions()
				});
			}
			engine.tick(inputRef.current);
			prevP1Health - engine.p1Health;
			prevP2Health - engine.p2Health;
			prevP1HealthRef.current = engine.p1Health;
			prevP2HealthRef.current = engine.p2Health;
			const p1DisplayState = mapActionToDisplayState(p1SM.action, p1NextMotion, engine.state);
			const p2DisplayState = mapActionToDisplayState(p2SM.action, p2NextMotion, engine.p2State);
			prevP1StateRef.current = p1DisplayState;
			prevP2StateRef.current = p2DisplayState;
			setFrame(engine.currentFrame);
			setP1Health(engine.p1Health);
			setP2Health(engine.p2Health);
			setP1State(p1DisplayState);
			setP2State(p2DisplayState);
			setP1Animation(p1NextMotion);
			setP2Animation(p2NextMotion);
			setHitStopActive(engine.hitStopFrames > 0);
			recordFrame({
				timestamp: now,
				p1State: p1DisplayState,
				p2State: p2DisplayState,
				p1Animation: p1NextMotion,
				p2Animation: p2NextMotion,
				p1Health: engine.p1Health,
				p2Health: engine.p2Health,
				p1X: p1XRef.current,
				p2X: p2XRef.current,
				p1Z: p1ZRef.current,
				p2Z: p2ZRef.current,
				p1Input: {
					light: inputRef.current.light ?? false,
					heavy: inputRef.current.heavy ?? false,
					guard: inputRef.current.guard ?? false,
					left: inputRef.current.left ?? false,
					right: inputRef.current.right ?? false,
					up: inputRef.current.up ?? false,
					down: inputRef.current.down ?? false
				},
				roundTimer
			});
			const TRIGGER_STATES = /* @__PURE__ */ new Set([
				"lightAttack",
				"heavyAttack",
				"lightKick",
				"heavyKick",
				"hit",
				"Hitstun",
				"HitStun",
				"knockdown",
				"Knockdown",
				"ko",
				"KO",
				"Crumple",
				"WakeupTechRoll",
				"WakeupBackrise",
				"WakeupQuickStand",
				"jump",
				"jumpForward",
				"jumpBack"
			]);
			const p1StateChanged = p1NextMotion !== prevP1AnimRef.current;
			const p2StateChanged = p2NextMotion !== prevP2AnimRef.current;
			if (p1StateChanged && (TRIGGER_STATES.has(p1NextMotion) || TRIGGER_STATES.has(prevP1AnimRef.current))) {
				p1AnimTriggerRef.current += 1;
				setP1AnimTrigger(p1AnimTriggerRef.current);
			}
			if (p2StateChanged && (TRIGGER_STATES.has(p2NextMotion) || TRIGGER_STATES.has(prevP2AnimRef.current))) {
				p2AnimTriggerRef.current += 1;
				setP2AnimTrigger(p2AnimTriggerRef.current);
			}
			prevP1AnimRef.current = p1NextMotion;
			prevP2AnimRef.current = p2NextMotion;
			if (hitStopActiveRef.current) {
				hitStopTimerRef.current -= dt;
				if (hitStopTimerRef.current <= 0) {
					hitStopActiveRef.current = false;
					hitStopTimerRef.current = 0;
					setHitStopActive(false);
				}
			}
			if (!hitStopActiveRef.current) {
				const p1Vel = p1SMRef.current.getWalkVelocity();
				const p2Vel = p2SMRef.current.getWalkVelocity();
				const p1IsDashing = cmd.dashing || cmd.running;
				const p1IsBackdashing = cmd.backdashing || p1SMRef.current.action === "Backdashing";
				const p2IsBackdashing = p2SMRef.current.action === "Backdashing";
				if (p1SMRef.current.action === "Attacking" || p1SMRef.current.action === "CommandThrow") {
					const attackKey = p1NextMotion;
					if (ATTACK_ROOT_MOTION_PROFILES[attackKey]?.hasRootMotion && p1LocoRef.current.mode === "programmatic") {
						const move = p1HbWindow.move;
						p1LocoRef.current.beginRootMotionAttack(attackKey, move?.active ?? .14);
					}
				} else if (p1LocoRef.current.mode === "rootMotion") p1LocoRef.current.endRootMotionAttack();
				if (cmd.jump) p1LocoRef.current.beginJump();
				else p1LocoRef.current.armJump();
				p1LocoRef.current.update(p1Vel.forward, p1Vel.strafe, dt, p1IsDashing, p1IsBackdashing);
				p2LocoRef.current.update(p2Vel.forward, p2Vel.strafe, dt, false, p2IsBackdashing);
				const MIN_SEPARATION = 1.2;
				let newP1X = p1LocoRef.current.position.x;
				let newP2X = p2LocoRef.current.position.x;
				if (newP1X > newP2X - MIN_SEPARATION) {
					const mid = (newP1X + newP2X) / 2;
					newP1X = mid - MIN_SEPARATION / 2;
					newP2X = mid + MIN_SEPARATION / 2;
					p1LocoRef.current.clampX(newP1X);
					p2LocoRef.current.clampX(newP2X);
				}
				if (Math.abs(newP1X - p1XRef.current) > .01) {
					p1XRef.current = newP1X;
					setP1X(newP1X);
				}
				const jy = p1LocoRef.current.airborneY;
				if (Math.abs(jy - p1YRef.current) > .005) {
					p1YRef.current = jy;
					p1JumpYRef.current = jy;
					setP1Y(jy);
				}
				if (Math.abs(newP2X - p2XRef.current) > .01) {
					p2XRef.current = newP2X;
					setP2X(newP2X);
				}
				const newP1Z = p1LocoRef.current.position.z;
				const newP2Z = p2LocoRef.current.position.z;
				if (Math.abs(newP1Z - p1ZRef.current) > .01) {
					p1ZRef.current = newP1Z;
					setP1Z(newP1Z);
				}
				if (Math.abs(newP2Z - p2ZRef.current) > .01) {
					p2ZRef.current = newP2Z;
					setP2Z(newP2Z);
				}
				const p1VelMag = Math.abs(p1Vel.forward) + Math.abs(p1Vel.strafe);
				const p2VelMag = Math.abs(p2Vel.forward) + Math.abs(p2Vel.strafe);
				if (Math.abs(p1VelMag - p1VelRef.current.forward) > .03) {
					p1VelRef.current = p1Vel;
					setP1LocomotionVelocity({ ...p1Vel });
				}
				if (Math.abs(p2VelMag - p2VelRef.current.forward) > .03) {
					p2VelRef.current = p2Vel;
					setP2LocomotionVelocity({ ...p2Vel });
				}
			}
			setP1QueuedAction(p1SM.getQueuedAction());
			setP1RecoveryProgress(p1SM.getRecoveryProgress());
			setP1WakeupBuffered(p1SM.getBufferedWakeup());
			if (engine.isMatchOver() && !koHandledRef.current) {
				koHandledRef.current = true;
				setKo(true);
				const w = engine.p1Health <= 0 && engine.p2Health <= 0 ? "draw" : engine.p1Health <= 0 ? "p2" : "p1";
				setWinner(w);
				cancelAnimationFrame(rafRef.current);
				if (settings.soundEnabled) sfx.playKO();
				triggerAutoSaveReplay(w);
				const announcer = announcerRef.current;
				if (!announcerFiredRef.current.ko) {
					announcerFiredRef.current.ko = true;
					const isDoubleKo = engine.p1Health <= 0 && engine.p2Health <= 0;
					const winnerHpPct = (w === "p1" ? engine.p1Health : engine.p2Health) / (w === "p1" ? p1Fighter.hp : p2Fighter.hp);
					if (isDoubleKo) {
						announcer.fire("doubleKo");
						setTimeout(() => announcer.fire("draw"), 1200);
					} else if (winnerHpPct >= .99) {
						announcer.fire("ko");
						setTimeout(() => announcer.fire("perfect"), 800);
					} else if (winnerHpPct <= .05) {
						announcer.fire("ko");
						setTimeout(() => announcer.fire("great"), 800);
					} else announcer.fire("ko");
					if (!isDoubleKo) setTimeout(() => {
						const winnerName = w === "p1" ? p1Fighter.name : p2Fighter.name;
						announcer.fire(w === "p1" ? "p1Wins" : "p2Wins", winnerName);
					}, 2200);
				}
				const cond = w === "p1" && engine.p1Health >= p1Fighter.hp * .99 || w === "p2" && engine.p2Health >= p2Fighter.hp * .99 ? "PERFECT" : "KO";
				setMatchCondition(cond);
				const elapsed = Math.round((Date.now() - roundStartTimeRef.current) / 1e3);
				const roundResult = {
					round: 1,
					winner: w,
					condition: cond,
					p1HealthRemaining: Math.max(0, engine.p1Health),
					p2HealthRemaining: Math.max(0, engine.p2Health),
					durationSeconds: elapsed
				};
				setRoundResults([roundResult]);
				setTimeout(() => {
					setCinematicPhase("victory");
					if (w !== "draw" && settings.soundEnabled) sfx.playVictory();
				}, 800);
				setTimeout(() => {
					onMatchEnd?.(w);
					setShowPostMatch(true);
				}, POST_MATCH_DELAY_MS);
			}
		};
		rafRef.current = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(rafRef.current);
	}, [
		ko,
		onMatchEnd,
		sfx,
		settings,
		cinematicPhase,
		p1Color,
		p2Color,
		p1Fighter,
		p2Fighter,
		debugSettings
	]);
	(0, import_react.useEffect)(() => {
		if (ko || cinematicPhase !== "fight") return;
		const t = window.setInterval(() => {
			setRoundTimer((prev) => {
				if (prev <= 1) {
					const engine = engineRef.current;
					if (engine && !koHandledRef.current) {
						koHandledRef.current = true;
						const w = engine.p1Health > engine.p2Health ? "p1" : engine.p2Health > engine.p1Health ? "p2" : "draw";
						setKo(true);
						setWinner(w);
						cancelAnimationFrame(rafRef.current);
						if (settings.soundEnabled) sfx.playKO();
						triggerAutoSaveReplay(w);
						const announcer = announcerRef.current;
						announcer.fire("timeUp");
						setTimeout(() => {
							if (w === "draw") announcer.fire("draw");
							else {
								const winnerName = w === "p1" ? p1Fighter.name : p2Fighter.name;
								announcer.fire(w === "p1" ? "p1Wins" : "p2Wins", winnerName);
							}
						}, 1200);
						setMatchCondition("TIMEOUT");
						const elapsed = Math.round((Date.now() - roundStartTimeRef.current) / 1e3);
						setRoundResults([{
							round: 1,
							winner: w,
							condition: "TIMEOUT",
							p1HealthRemaining: Math.max(0, engine.p1Health),
							p2HealthRemaining: Math.max(0, engine.p2Health),
							durationSeconds: elapsed
						}]);
						setTimeout(() => {
							setCinematicPhase("victory");
							if (w !== "draw" && settings.soundEnabled) sfx.playVictory();
						}, 800);
						setTimeout(() => {
							onMatchEnd?.(w);
							setShowPostMatch(true);
						}, POST_MATCH_DELAY_MS);
					}
					return 0;
				}
				return prev - 1;
			});
		}, 1e3);
		return () => window.clearInterval(t);
	}, [
		ko,
		onMatchEnd,
		sfx,
		settings,
		cinematicPhase
	]);
	(0, import_react.useEffect)(() => {
		const onKeyDown = (e) => {
			const i = inputRef.current;
			if (e.code === "ArrowLeft" || e.code === "KeyA") i.left = true;
			if (e.code === "ArrowRight" || e.code === "KeyD") i.right = true;
			if (e.code === "ArrowUp" || e.code === "KeyW") i.up = true;
			if (e.code === "ArrowDown" || e.code === "KeyS") i.down = true;
			if (e.key === "ArrowLeft") i.left = true;
			if (e.key === "ArrowRight") i.right = true;
			if (e.key === "ArrowUp") i.up = true;
			if (e.key === "ArrowDown") i.down = true;
			if (e.key === "z" || e.key === "Z") {
				i.light = true;
				i.lp = true;
			}
			if (e.key === "x" || e.key === "X") {
				i.heavy = true;
				i.rp = true;
			}
			if (e.key === "c" || e.key === "C") i.guard = true;
			if (e.key === "v" || e.key === "V") i.grapple = true;
			if (e.key === "u" || e.key === "U") i.lp = true;
			if (e.key === "i" || e.key === "I") i.rp = true;
			if (e.key === "j" || e.key === "J") i.lk = true;
			if (e.key === "k" || e.key === "K") i.rk = true;
			if (e.key === "q" || e.key === "Q") i.sidestepBg = true;
			if (e.key === "e" || e.key === "E") i.sidestepFg = true;
		};
		const onKeyUp = (e) => {
			const i = inputRef.current;
			if (e.code === "ArrowLeft" || e.code === "KeyA") i.left = false;
			if (e.code === "ArrowRight" || e.code === "KeyD") i.right = false;
			if (e.code === "ArrowUp" || e.code === "KeyW") i.up = false;
			if (e.code === "ArrowDown" || e.code === "KeyS") i.down = false;
			if (e.key === "ArrowLeft") i.left = false;
			if (e.key === "ArrowRight") i.right = false;
			if (e.key === "ArrowUp") i.up = false;
			if (e.key === "ArrowDown") i.down = false;
			if (e.key === "z" || e.key === "Z") {
				i.light = false;
				i.lp = false;
			}
			if (e.key === "x" || e.key === "X") {
				i.heavy = false;
				i.rp = false;
			}
			if (e.key === "c" || e.key === "C") i.guard = false;
			if (e.key === "v" || e.key === "V") i.grapple = false;
			if (e.key === "u" || e.key === "U") i.lp = false;
			if (e.key === "i" || e.key === "I") i.rp = false;
			if (e.key === "j" || e.key === "J") i.lk = false;
			if (e.key === "k" || e.key === "K") i.rk = false;
			if (e.key === "q" || e.key === "Q") i.sidestepBg = false;
			if (e.key === "e" || e.key === "E") i.sidestepFg = false;
		};
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
		};
	}, []);
	const p1MaxHealth = p1Fighter.hp;
	const p2MaxHealth = p2Fighter.hp;
	const p1Pct = Math.max(0, Math.min(100, p1Health / p1MaxHealth * 100));
	const p2Pct = Math.max(0, Math.min(100, p2Health / p2MaxHealth * 100));
	const getHealthBarColor = (pct) => {
		if (pct > 50) return "#facc15";
		if (pct > 25) return "#f97316";
		return "#ef4444";
	};
	const getStateLabel = (state, anim) => {
		if (state === "KO") return "KO";
		if (state === "Hitstun" || state === "Stunned") return "HIT";
		if (state === "Crumple" || state === "Knockdown") return "DOWN";
		if (state === "WakeupTechRoll") return "ROLL";
		if (state === "WakeupBackrise") return "RISE";
		if (state === "WakeupQuickStand") return "STAND";
		if (state === "Blockstun" || state === "Guard") return "BLOCK";
		if (state === "Startup" || state === "Attacking") return "ATK";
		if (state === "Active") return "ACTIVE";
		if (state === "Grappled") return "GRAPPLE";
		if (state === "Backdashing") return "DASH";
		if (state === "Walking") return "WALK";
		return anim.toUpperCase();
	};
	const winnerName = winner === "p1" ? p1Fighter.name : winner === "p2" ? p2Fighter.name : void 0;
	const autoSaveReplayRef = (0, import_react.useRef)(false);
	const triggerAutoSaveReplay = (0, import_react.useCallback)(async (winnerPlayer) => {
		if (autoSaveReplayRef.current) return;
		autoSaveReplayRef.current = true;
		stopRecording();
		const frames = getBuffer();
		if (frames.length === 0) return;
		const clip = {
			id: `auto_${Date.now()}`,
			label: `${p1Fighter.name} vs ${p2Fighter.name} — ${stageId ?? "urban_night"} [AUTO]`,
			p1Name: p1Fighter.name,
			p2Name: p2Fighter.name,
			stageName: stageId ?? "urban_night",
			frames,
			inPoint: 0,
			outPoint: frames.length - 1,
			speedMultiplier: 1,
			exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
			totalFrames: frames.length,
			durationMs: frames.length > 1 ? (frames[frames.length - 1]?.timestamp ?? 0) - (frames[0]?.timestamp ?? 0) : 0
		};
		if (user?.id) {
			const result = await saveReplayToSupabase(clip, user.id);
			if (result.success) console.log("[Arena] ☁ Auto-saved replay to Supabase:", clip.id, `(${frames.length} frames)`);
			else console.warn("[Arena] ⚠ Auto-save replay failed:", result.error);
		} else console.log("[Arena] ℹ Auto-save skipped — user not signed in");
	}, [
		p1Fighter.name,
		p2Fighter.name,
		stageId,
		user?.id,
		stopRecording,
		getBuffer
	]);
	(0, import_react.useEffect)(() => {
		autoSaveReplayRef.current = false;
	}, [p1Fighter, p2Fighter]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 bg-black text-white overflow-hidden touch-none select-none font-mono",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 z-0",
				style: {
					width: "100%",
					height: "100%"
				},
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CombatArena3D, {
					p1Fighter,
					p2Fighter,
					p1State,
					p2State,
					p1Animation,
					p2Animation,
					p1Color,
					p2Color,
					hitStopActive,
					p1SkinTint,
					p2SkinTint,
					p1Z,
					p2Z,
					cinematicPhase,
					winnerName,
					cameraFov: settings.cameraFov,
					announcerEnabled: settings.soundEnabled,
					damageEvent,
					knockdownEvent,
					stageId: stageId ?? "urban_night",
					p1AnimTrigger,
					p2AnimTrigger,
					p1LocomotionVelocity,
					p2LocomotionVelocity,
					p1X,
					p2X,
					p1Y,
					onP1BoneHitboxReady: (sys) => {
						p1BoneHitboxRef.current = sys;
					},
					onP2BoneHitboxReady: (sys) => {
						p2BoneHitboxRef.current = sys;
					},
					wallSplatEvent,
					heatBurstEvent,
					rageArtEvent,
					cameraShakeOffset
				})
			}),
			cinematicPhase === "fight" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute top-0 left-0 right-0 z-30 px-3 pt-2 pb-1 pointer-events-none",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: p1Fighter.pixelPortrait ?? `/portraits/pixel/${p1Fighter.id}.png`,
								alt: "",
								className: "h-12 w-12 shrink-0 border border-zinc-700 object-cover",
								style: { imageRendering: "pixelated" }
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex-1 flex flex-col gap-0.5",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between mb-0.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[9px] font-black tracking-[0.3em]",
											style: { color: p1Color },
											children: p1Fighter.name.toUpperCase()
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[8px] text-zinc-400",
											children: Math.ceil(p1Health).toLocaleString()
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "h-4 border border-zinc-700/60 bg-black/50 relative overflow-hidden",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "absolute left-0 top-0 h-full transition-all duration-75",
											style: {
												width: `${p1Pct}%`,
												background: getHealthBarColor(p1Pct),
												boxShadow: `0 0 8px ${getHealthBarColor(p1Pct)}88`
											}
										}), p1Pct <= 25 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 animate-pulse bg-red-500/10" })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[7px] text-zinc-300 tracking-widest h-3",
										children: getStateLabel(p1State, p1Animation)
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col items-center shrink-0 w-20",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[7px] text-zinc-300 tracking-widest text-center leading-tight",
										children: roundLabel ?? "ROUND 1"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-2xl font-black tabular-nums leading-none",
										style: {
											color: roundTimer <= 10 ? "#ef4444" : "#facc15",
											textShadow: roundTimer <= 10 ? "0 0 12px #ef4444" : "0 0 12px #facc15"
										},
										children: String(roundTimer).padStart(2, "0")
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[7px] text-zinc-400 tracking-widest",
										children: ["F", frame]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex-1 flex flex-col gap-0.5",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between mb-0.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[8px] text-zinc-400 text-right w-full",
											children: Math.ceil(p2Health).toLocaleString()
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[9px] font-black tracking-[0.3em] ml-2 whitespace-nowrap",
											style: { color: p2Color },
											children: p2Fighter.name.toUpperCase()
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "h-4 border border-zinc-700/60 bg-black/50 relative overflow-hidden",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "absolute right-0 top-0 h-full transition-all duration-75",
											style: {
												width: `${p2Pct}%`,
												background: getHealthBarColor(p2Pct),
												boxShadow: `0 0 8px ${getHealthBarColor(p2Pct)}88`
											}
										}), p2Pct <= 25 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 animate-pulse bg-red-500/10" })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[7px] text-zinc-300 tracking-widest h-3 text-right",
										children: getStateLabel(p2State, p2Animation)
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: p2Fighter.pixelPortrait ?? `/portraits/pixel/${p2Fighter.id}.png`,
								alt: "",
								className: "h-12 w-12 shrink-0 border border-zinc-700 object-cover",
								style: { imageRendering: "pixelated" }
							})
						]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComboCounterHUD, {
					p1Combo,
					p2Combo,
					p1Color,
					p2Color
				}),
				p1KiCharge.active && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "absolute z-40 pointer-events-none",
					style: {
						bottom: "28%",
						left: "12%"
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "px-3 py-1 text-[9px] font-black tracking-widest uppercase animate-pulse",
						style: {
							color: "#a78bfa",
							textShadow: "0 0 16px #a78bfa, 0 0 32px #a78bfa88",
							border: "1px solid #a78bfa44",
							background: "rgba(0,0,0,0.75)"
						},
						children: [
							"⚡ KI CHARGE · ",
							Math.ceil(p1KiCharge.framesRemaining / 60 * 10) / 10,
							"s"
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[6px] text-purple-300/70 tracking-widest mt-0.5 text-center",
						children: "NEXT HIT = COUNTER · NO BLOCK"
					})]
				}),
				p1HeatActive && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute z-40 pointer-events-none",
					style: {
						bottom: "22%",
						left: "8%"
					},
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "px-3 py-1 text-[9px] font-black tracking-widest uppercase animate-pulse",
						style: {
							color: "#f97316",
							textShadow: "0 0 16px #f97316, 0 0 32px #f9731688",
							border: "1px solid #f9731644",
							background: "rgba(0,0,0,0.75)"
						},
						children: "🔥 HEAT STATE"
					})
				}),
				p2HeatActive && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute z-40 pointer-events-none",
					style: {
						bottom: "22%",
						right: "8%"
					},
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "px-3 py-1 text-[9px] font-black tracking-widest uppercase animate-pulse",
						style: {
							color: "#f97316",
							textShadow: "0 0 16px #f97316, 0 0 32px #f9731688",
							border: "1px solid #f9731644",
							background: "rgba(0,0,0,0.75)"
						},
						children: "🔥 HEAT STATE"
					})
				}),
				p1RageArtAvailable && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute z-40 pointer-events-none",
					style: {
						bottom: "16%",
						left: "8%"
					},
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "px-3 py-1 text-[9px] font-black tracking-widest uppercase animate-pulse",
						style: {
							color: "#ef4444",
							textShadow: "0 0 16px #ef4444, 0 0 32px #ef444488",
							border: "1px solid #ef444444",
							background: "rgba(0,0,0,0.75)"
						},
						children: "💢 RAGE ART READY"
					})
				}),
				p2RageArtAvailable && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute z-40 pointer-events-none",
					style: {
						bottom: "16%",
						right: "8%"
					},
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "px-3 py-1 text-[9px] font-black tracking-widest uppercase animate-pulse",
						style: {
							color: "#ef4444",
							textShadow: "0 0 16px #ef4444, 0 0 32px #ef444488",
							border: "1px solid #ef444444",
							background: "rgba(0,0,0,0.75)"
						},
						children: "💢 RAGE ART READY"
					})
				}),
				ringOutNotice && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute z-50 pointer-events-none inset-0 flex items-center justify-center",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "px-6 py-3 text-2xl font-black tracking-[0.3em] uppercase animate-bounce",
						style: {
							color: "#facc15",
							textShadow: "0 0 30px #facc15, 0 0 60px #facc1588",
							border: "2px solid #facc1566",
							background: "rgba(0,0,0,0.85)"
						},
						children: [ringOutNotice.player === "p1" ? "P1" : "P2", " RING OUT!"]
					})
				}, ringOutNotice.count),
				floorBreakNotice && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute z-50 pointer-events-none inset-0 flex items-center justify-center",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "px-6 py-3 text-xl font-black tracking-[0.25em] uppercase",
						style: {
							color: "#f97316",
							textShadow: "0 0 24px #f97316, 0 0 48px #f9731688",
							border: "2px solid #f9731666",
							background: "rgba(0,0,0,0.85)",
							animation: "ping 0.4s ease-out"
						},
						children: ["💥 FLOOR BREAK → ", floorBreakNotice.level]
					})
				}, floorBreakNotice.count),
				hazardNotice && arenaState.config.hazardDamagePerSec > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute z-40 pointer-events-none top-[18%] left-1/2 -translate-x-1/2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "px-3 py-1 text-[8px] font-black tracking-widest uppercase animate-pulse",
						style: {
							color: "#ef4444",
							textShadow: "0 0 12px #ef4444",
							border: "1px solid #ef444466",
							background: "rgba(0,0,0,0.75)"
						},
						children: hazardNotice
					})
				}),
				trainWarningActive && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute z-50 pointer-events-none inset-0 flex items-center justify-center",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "px-8 py-4 text-2xl font-black tracking-[0.3em] uppercase animate-pulse",
						style: {
							color: "#f59e0b",
							textShadow: "0 0 30px #f59e0b, 0 0 60px #f59e0b88",
							border: "2px solid #f59e0b66",
							background: "rgba(0,0,0,0.9)"
						},
						children: "🚇 TRAIN INCOMING!"
					})
				}),
				trainCrossing && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute z-50 pointer-events-none inset-0",
					style: {
						background: "rgba(245,158,11,0.08)",
						boxShadow: "inset 0 0 80px rgba(245,158,11,0.3)"
					}
				}),
				p1OnTracks && !trainCrossing && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "absolute z-40 pointer-events-none",
					style: {
						bottom: "35%",
						left: "10%"
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "px-3 py-1.5 text-[9px] font-black tracking-widest uppercase animate-bounce",
						style: {
							color: "#22d3ee",
							textShadow: "0 0 16px #22d3ee",
							border: "1px solid #22d3ee66",
							background: "rgba(0,0,0,0.85)"
						},
						children: "↑ VAULT UP!"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[6px] text-cyan-400/60 tracking-widest text-center mt-0.5",
						children: "PRESS UP TO ESCAPE TRACKS"
					})]
				}),
				hazardBounceNotice && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute z-50 pointer-events-none top-[30%] left-1/2 -translate-x-1/2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "px-4 py-2 text-sm font-black tracking-widest uppercase animate-pulse",
						style: {
							color: "#f97316",
							textShadow: "0 0 20px #f97316",
							border: "1px solid #f9731666",
							background: "rgba(0,0,0,0.85)"
						},
						children: hazardBounceNotice
					})
				}),
				floorBreakPhase === "floor_break_fall" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute z-50 pointer-events-none inset-0",
					style: {
						background: "rgba(249,115,22,0.06)",
						boxShadow: "inset 0 0 60px rgba(249,115,22,0.2)"
					}
				}),
				wallShatterLeft && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute z-40 pointer-events-none left-0 top-0 bottom-0 w-16 animate-pulse",
					style: { background: "linear-gradient(to right, rgba(148,163,184,0.3), transparent)" }
				}),
				wallShatterRight && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute z-40 pointer-events-none right-0 top-0 bottom-0 w-16 animate-pulse",
					style: { background: "linear-gradient(to left, rgba(148,163,184,0.3), transparent)" }
				}),
				ledgeThrowActive && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute z-50 pointer-events-none inset-0 flex items-center justify-center",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "px-6 py-3 text-xl font-black tracking-[0.3em] uppercase",
						style: {
							color: "#ef4444",
							textShadow: "0 0 24px #ef4444, 0 0 48px #ef444488",
							border: "2px solid #ef444466",
							background: "rgba(0,0,0,0.9)",
							animation: "pulse 0.5s ease-in-out infinite"
						},
						children: "🎯 LEDGE THROW!"
					})
				}),
				arenaState.config.levels.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "absolute z-40 pointer-events-none top-[22%] left-1/2 -translate-x-1/2 flex gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-[7px] tracking-widest font-black",
							style: {
								color: arenaState.config.accentColor,
								opacity: .7
							},
							children: ["P1: ", arenaState.config.levels[arenaState.p1LevelIndex]?.label ?? "LEVEL 1"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[7px] text-zinc-600",
							children: "|"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-[7px] tracking-widest font-black",
							style: {
								color: arenaState.config.accentColor,
								opacity: .7
							},
							children: ["P2: ", arenaState.config.levels[arenaState.p2LevelIndex]?.label ?? "LEVEL 1"]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DebugOverlayHUD, {
					settings: debugSettings,
					p1Debug: p1DebugData,
					p2Debug: p2DebugData
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InputStringRecorder, { inputRef }),
				specialMoveNotice && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute z-40 pointer-events-none",
					style: {
						top: "18%",
						left: specialMoveNotice.player === "p1" ? "8%" : "auto",
						right: specialMoveNotice.player === "p2" ? "8%" : "auto"
					},
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "px-3 py-1 text-xs font-black tracking-widest uppercase animate-pulse",
						style: {
							color: "#facc15",
							textShadow: "0 0 20px #facc15, 0 0 40px #facc1566",
							border: "1px solid #facc1544",
							background: "rgba(0,0,0,0.7)"
						},
						children: ["⚡ ", specialMoveNotice.name]
					})
				}, specialMoveNotice.id),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "absolute bottom-32 left-4 z-40 pointer-events-none flex flex-col gap-1",
					children: [
						p1RecoveryProgress > 0 && p1RecoveryProgress < 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[7px] text-orange-400/80 tracking-widest font-black",
								children: "REC"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "w-16 h-1.5 bg-zinc-800/80 border border-zinc-700/60 overflow-hidden",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "h-full transition-all duration-75",
									style: {
										width: `${p1RecoveryProgress * 100}%`,
										background: "#f97316"
									}
								})
							})]
						}),
						p1QueuedAction && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1.5 animate-pulse",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[7px] text-yellow-400/80 tracking-widest",
								children: "QUEUED"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "px-2 py-0.5 text-[9px] font-black tracking-widest border",
								style: {
									color: p1QueuedAction.type === "light" ? "#60a5fa" : p1QueuedAction.type === "heavy" ? "#f87171" : p1QueuedAction.type === "guard" ? "#a1a1aa" : "#c084fc",
									borderColor: p1QueuedAction.type === "light" ? "#3b82f680" : p1QueuedAction.type === "heavy" ? "#ef444480" : p1QueuedAction.type === "guard" ? "#52525b80" : "#a855f780",
									background: "rgba(0,0,0,0.75)"
								},
								children: p1QueuedAction.label
							})]
						}),
						p1WakeupBuffered && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1.5 animate-pulse",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[7px] text-cyan-400/80 tracking-widest",
								children: "WAKEUP"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "px-2 py-0.5 text-[9px] font-black tracking-widest border border-cyan-500/50",
								style: {
									color: "#22d3ee",
									background: "rgba(0,0,0,0.75)"
								},
								children: p1WakeupBuffered === "techRoll" ? "ROLL" : p1WakeupBuffered === "backrise" ? "RISE" : "STAND"
							})]
						})
					]
				}),
				isPracticeMode && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MoveExecutionFeedback, {
					events: feedbackEvents,
					onExpire: (id) => setFeedbackEvents((prev) => prev.filter((e) => e.id !== id))
				}),
				ko && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-black tracking-widest animate-pulse",
						style: {
							fontSize: "clamp(4rem, 15vw, 10rem)",
							color: "#facc15",
							textShadow: "0 0 40px #facc15, 0 0 80px #facc1544",
							fontFamily: "monospace"
						},
						children: roundTimer <= 0 ? "TIME" : "K.O."
					})
				}),
				hitStopActive && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 z-40 pointer-events-none bg-white/5 animate-pulse" }),
				!ko && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MobileControls, { inputRef }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "absolute bottom-2 left-3 z-30 text-[7px] text-zinc-500 space-y-0.5 pointer-events-none",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: "ARROWS: MOVE · Z/U: 1(LP) · X/I: 2(RP) · J: 3(LK) · K: 4(RK) · C: GUARD · V: GRAPPLE · Q/E: SIDESTEP" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-zinc-600",
							children: "COMBOS: U+J=THROW · I+K=THROW · I+J=HEAT BURST · →+C=CMD THROW · SPECIAL: L+L+H or H+H+L"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-purple-500/60",
							children: "KI CHARGE: U+X+J+K (1+2+3+4) — NEXT HIT = COUNTER · NO BLOCK"
						})
					]
				}),
				p1GrabRangeVisible && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "absolute z-40 pointer-events-none",
					style: {
						bottom: "28%",
						left: "20%",
						transform: "translateX(-50%)"
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "rounded-full border-2 flex items-center justify-center transition-all duration-200",
						style: {
							width: `${p1GrabRangeRadius * 60}px`,
							height: `${p1GrabRangeRadius * 60}px`,
							borderColor: p1GrabRangeHit ? "#22c55e" : "#ef4444",
							background: p1GrabRangeHit ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.08)",
							boxShadow: p1GrabRangeHit ? "0 0 20px rgba(34,197,94,0.5)" : "0 0 16px rgba(239,68,68,0.4)"
						},
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[7px] font-black tracking-widest",
							style: { color: p1GrabRangeHit ? "#22c55e" : "#ef4444" },
							children: p1GrabRangeHit ? "GRAB!" : "WHIFF"
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-center text-[6px] mt-1 font-black tracking-widest",
						style: { color: p1GrabRangeHit ? "#22c55e" : "#ef4444" },
						children: [
							"CMD THROW · ",
							p1GrabRangeRadius.toFixed(1),
							"u"
						]
					})]
				})
			] }),
			onBack && cinematicPhase === "fight" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: onBack,
				className: "absolute top-16 left-3 z-40 text-[8px] text-zinc-400 hover:text-zinc-200 border border-zinc-700/60 hover:border-zinc-500 px-2 py-1 transition-colors bg-black/50",
				children: "← BACK"
			}),
			cinematicPhase === "fight" && !ko && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: () => {
					setIsPaused((p) => !p);
					setPauseTab("menu");
				},
				className: "absolute top-3 right-3 z-40 text-[8px] text-zinc-500 hover:text-zinc-200 border border-zinc-700/40 hover:border-zinc-500 px-2 py-1 transition-colors bg-black/50 font-mono tracking-widest",
				children: "⏸ ESC"
			}),
			isPaused && cinematicPhase === "fight" && !ko && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 z-50 flex items-center justify-center",
				style: {
					background: "rgba(0,0,0,0.82)",
					backdropFilter: "blur(6px)"
				},
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-full max-w-sm border border-zinc-700 bg-zinc-950 font-mono",
					style: { boxShadow: "0 0 40px rgba(250,204,21,0.08)" },
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border-b border-zinc-800 px-4 py-2 flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[10px] text-yellow-400 tracking-widest font-black",
								children: "⏸ PAUSED"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-[7px] text-zinc-600",
								children: [
									p1Fighter.name,
									" vs ",
									p2Fighter.name
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex border-b border-zinc-800",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setPauseTab("menu"),
								className: `flex-1 text-[8px] tracking-widest py-1.5 transition-colors ${pauseTab === "menu" ? "text-yellow-400 border-b border-yellow-600" : "text-zinc-500 hover:text-zinc-300"}`,
								children: "MENU"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setPauseTab("replay"),
								className: `flex-1 text-[8px] tracking-widest py-1.5 transition-colors ${pauseTab === "replay" ? "text-yellow-400 border-b border-yellow-600" : "text-zinc-500 hover:text-zinc-300"}`,
								children: "⏺ REPLAY"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-4",
							children: [pauseTab === "menu" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => setIsPaused(false),
										className: "w-full text-[9px] font-black tracking-widest border border-yellow-700 text-yellow-400 hover:bg-yellow-900/30 py-2 transition-colors",
										children: "▶ RESUME FIGHT"
									}),
									onBack && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => {
											setIsPaused(false);
											onBack();
										},
										className: "w-full text-[9px] font-black tracking-widest border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 py-2 transition-colors",
										children: "← QUIT MATCH"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[6px] text-zinc-700 text-center pt-1",
										children: "Press ESC to resume"
									})
								]
							}), pauseTab === "replay" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PauseMenuRecorder, {
								p1Name: p1Fighter.name,
								p2Name: p2Fighter.name,
								stageName: stageId ?? "urban_night",
								getBuffer,
								isRecording
							})]
						})
					]
				})
			}),
			showPostMatch && winner && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 z-50",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PostMatchScreen, {
					p1Fighter,
					p2Fighter,
					winner,
					condition: matchCondition,
					roundResults,
					p1Color,
					p2Color,
					onRematch: () => {
						setShowPostMatch(false);
						if (engineRef.current) {
							setP1Health(p1Fighter.hp);
							setP2Health(p2Fighter.hp);
							setKo(false);
							setWinner(null);
							setRoundTimer(99);
							koHandledRef.current = false;
							roundStartedRef.current = false;
							setRoundResults([]);
							roundStartTimeRef.current = Date.now();
							setP1X(-1.8);
							setP2X(1.8);
							p1XRef.current = -1.8;
							p2XRef.current = 1.8;
							p1LocoRef.current = new LocomotionSystem(-1.8, 0, 1);
							p2LocoRef.current = new LocomotionSystem(1.8, 0, -1);
							p1SMRef.current = new FighterStateMachine();
							p2SMRef.current = new FighterStateMachine();
							p1SMRef.current.registerSpecialMoves(DEFAULT_SPECIAL_MOVES);
							p2SMRef.current.registerSpecialMoves(DEFAULT_SPECIAL_MOVES);
							p1HitboxRef.current.reset();
							p2HitboxRef.current.reset();
							const freshP1Combo = createComboState("p1");
							const freshP2Combo = createComboState("p2");
							p1ComboRef.current = freshP1Combo;
							p2ComboRef.current = freshP2Combo;
							setP1Combo(freshP1Combo);
							setP2Combo(freshP2Combo);
						}
						setCinematicPhase("sweep");
						setArenaReady(false);
						window.setTimeout(() => setCinematicPhase("intro"), SWEEP_DURATION_MS);
						window.setTimeout(() => {
							setCinematicPhase("fight");
							setArenaReady(true);
						}, 4500);
					},
					onCharacterSelect: () => {
						setShowPostMatch(false);
						onBack?.();
					},
					onExit: () => {
						setShowPostMatch(false);
						onBack?.();
					}
				})
			})
		]
	});
}
/** Map SM ActionState + motion to a display state string */
function mapActionToDisplayState(action, motion, legacyState) {
	switch (action) {
		case "Attacking": return motion || "lightAttack";
		case "Stunned": return "Hitstun";
		case "Crumple": return "Hitstun";
		case "Guard": return motion || "guard";
		case "Walking": return motion || "Walking";
		case "Backdashing": return "Backdashing";
		case "Jumping": return motion || "jump";
		case "Knockdown": return "Knockdown";
		case "WakeupTechRoll": return "WakeupTechRoll";
		case "WakeupBackrise": return "WakeupBackrise";
		case "WakeupQuickStand": return "WakeupQuickStand";
		case "Idle": return motion === "crouch" ? "crouch" : legacyState === "KO" ? "KO" : "Neutral";
		default: return motion || legacyState;
	}
}
/** Reactive AI input for P2 — moves toward P1, attacks when in range, guards when hit */
function buildP2AIInput(p2State, p1Health, p2Health, p2X, p1X) {
	const now = performance.now();
	const isAggressive = p2Health < p1Health;
	const dist = Math.abs(p2X - p1X);
	if (p2State === "Hitstun" || p2State === "Stunned" || p2State === "Knockdown" || p2State === "WakeupTechRoll" || p2State === "WakeupBackrise" || p2State === "WakeupQuickStand") return {
		forward: 0,
		strafe: 0,
		light: false,
		heavy: false,
		guard: false,
		crouch: false
	};
	if (p2State === "Blockstun") return {
		forward: 0,
		strafe: 0,
		light: false,
		heavy: false,
		guard: true,
		crouch: false
	};
	const ATTACK_RANGE = 1.6;
	const CLOSE_RANGE = 1.3;
	const cycle = Math.floor(now / 800) % 6;
	if (dist > ATTACK_RANGE) return {
		forward: -1,
		strafe: 0,
		light: false,
		heavy: false,
		guard: false,
		crouch: false
	};
	if (dist <= CLOSE_RANGE) switch (cycle) {
		case 0:
		case 1: return {
			forward: 0,
			strafe: 0,
			light: true,
			heavy: false,
			guard: false,
			crouch: false
		};
		case 2: return {
			forward: 0,
			strafe: 0,
			light: false,
			heavy: isAggressive,
			guard: !isAggressive,
			crouch: false
		};
		case 3: return {
			forward: -1,
			strafe: 0,
			light: true,
			heavy: false,
			guard: false,
			crouch: false
		};
		case 4: return {
			forward: 0,
			strafe: 0,
			light: false,
			heavy: true,
			guard: false,
			crouch: false
		};
		case 5: return {
			forward: 1,
			strafe: 0,
			light: false,
			heavy: false,
			guard: true,
			crouch: false
		};
		default: return {
			forward: 0,
			strafe: 0,
			light: false,
			heavy: false,
			guard: false,
			crouch: false
		};
	}
	if (cycle % 3 === 0) return {
		forward: 0,
		strafe: 0,
		light: true,
		heavy: false,
		guard: false,
		crouch: false
	};
	return {
		forward: -1,
		strafe: 0,
		light: false,
		heavy: false,
		guard: false,
		crouch: false
	};
}
//#endregion
export { GameBattleArena as default };
