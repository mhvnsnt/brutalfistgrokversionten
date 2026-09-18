import { Dt as Vector3 } from "../_libs/@react-three/drei+[...].mjs";
import { n as disposeBoundsTree, t as computeBoundsTree } from "../_libs/three-mesh-bvh.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/BoneHitboxSystem-D2yRyfrH.js
/**
* BoneHitboxSystem — Tekken-style bone-parented hitbox spheres
*
* Tekken does NOT use a giant pill-shaped hitbox for combat.
* Collision spheres are parented directly to specific bones in the skeleton:
*   - RightHand  → fist hitbox (punches)
*   - LeftHand   → fist hitbox (left punches)
*   - RightFoot  → kick hitbox (right kicks)
*   - LeftFoot   → kick hitbox (left kicks)
*   - Head       → head hitbox (headbutts, also hurtbox)
*
* When a punch is thrown, the hitbox sphere travels exactly where the bone goes.
* This is resolved per-frame by reading the bone's world-space position from the
* THREE.SkinnedMesh skeleton.
*
* Startup / Active / Recovery:
*   - Startup: hitbox sphere is OFF (bone moving into position)
*   - Active:  hitbox sphere is ON (frames 11-13 of a 10-frame startup punch)
*   - Recovery: hitbox sphere is OFF (arm pulling back)
*
* Hit Stop (Impact Freeze):
*   When a heavy attack lands, both fighters' animations are temporarily paused
*   for HIT_STOP_DURATION_MS milliseconds to give the hit massive weight.
*   After hit stop, the knockback animation plays.
*/
/**
* Standard humanoid bone name aliases.
* We search for these in the skeleton to find the right bone.
* Covers Mixamo, Rigify, and custom naming conventions.
*/
var BONE_NAME_ALIASES = {
	RightHand: [
		"RightHand",
		"mixamorigRightHand",
		"Hand_R",
		"hand_r",
		"R_Hand",
		"RHand",
		"right_hand",
		"RightWrist",
		"Bip01_R_Hand"
	],
	LeftHand: [
		"LeftHand",
		"mixamorigLeftHand",
		"Hand_L",
		"hand_l",
		"L_Hand",
		"LHand",
		"left_hand",
		"LeftWrist",
		"Bip01_L_Hand"
	],
	RightFoot: [
		"RightFoot",
		"mixamorigRightFoot",
		"Foot_R",
		"foot_r",
		"R_Foot",
		"RFoot",
		"right_foot",
		"RightAnkle",
		"Bip01_R_Foot"
	],
	LeftFoot: [
		"LeftFoot",
		"mixamorigLeftFoot",
		"Foot_L",
		"foot_l",
		"L_Foot",
		"LFoot",
		"left_foot",
		"LeftAnkle",
		"Bip01_L_Foot"
	],
	Head: [
		"Head",
		"mixamorigHead",
		"head",
		"HEAD",
		"Bip01_Head",
		"HeadTop_End",
		"Neck1",
		"neck_01"
	],
	Hips: [
		"Hips",
		"mixamorigHips",
		"hips",
		"Pelvis",
		"pelvis",
		"Root",
		"root",
		"Bip01_Pelvis",
		"Spine",
		"spine"
	],
	Spine: [
		"Spine",
		"mixamorigSpine",
		"spine",
		"Spine1",
		"spine_01",
		"Chest",
		"chest",
		"Bip01_Spine"
	]
};
var ATTACK_HITBOX_CONFIGS = {
	lightAttack: {
		activeBones: ["RightHand"],
		radius: .18,
		attackLevel: "mid",
		damage: 80
	},
	heavyAttack: {
		activeBones: ["RightHand", "LeftHand"],
		radius: .22,
		attackLevel: "high",
		damage: 150
	},
	CommandThrow: {
		activeBones: ["RightHand", "LeftHand"],
		radius: .3,
		attackLevel: "mid",
		damage: 220
	},
	lk_attack: {
		activeBones: ["LeftFoot"],
		radius: .2,
		attackLevel: "low",
		damage: 90
	},
	rk_attack: {
		activeBones: ["RightFoot"],
		radius: .2,
		attackLevel: "mid",
		damage: 100
	},
	headbutt: {
		activeBones: ["Head"],
		radius: .25,
		attackLevel: "high",
		damage: 120
	}
};
/**
* Hit Stop duration in milliseconds.
* When a heavy attack lands, both fighters' animations freeze for this duration.
* Light attacks: shorter freeze. Heavy/special: longer freeze.
*/
var HIT_STOP_DURATIONS = {
	lightAttack: 80,
	heavyAttack: 140,
	CommandThrow: 180,
	special: 200
};
var BoneHitboxSystem = class {
	boneMap = /* @__PURE__ */ new Map();
	activeSpheres = [];
	hitRegisteredThisSwing = false;
	hitStopActive = false;
	hitStopTimer = 0;
	hitStopDuration = 0;
	rootBone = null;
	prevRootWorldPos = new Vector3();
	rootBoneInitialized = false;
	/**
	* Initialize bone map from a skinned mesh skeleton.
	* Call once after the GLB model is loaded.
	*/
	initFromSkeleton(object) {
		this.boneMap.clear();
		this.rootBone = null;
		const allBones = [];
		object.traverse((child) => {
			if (child.isBone) allBones.push(child);
		});
		if (allBones.length === 0) object.traverse((child) => {
			const sm = child;
			if (sm.isSkinnedMesh && sm.skeleton) sm.skeleton.bones.forEach((b) => allBones.push(b));
		});
		console.log(`[BoneHitbox] 🦴 Found ${allBones.length} bones in skeleton`);
		for (const slot of Object.keys(BONE_NAME_ALIASES)) {
			const aliases = BONE_NAME_ALIASES[slot];
			let found = null;
			for (const alias of aliases) {
				const bone = allBones.find((b) => b.name === alias || b.name.toLowerCase() === alias.toLowerCase());
				if (bone) {
					found = bone;
					break;
				}
			}
			if (!found) {
				const slotLower = slot.toLowerCase();
				found = allBones.find((b) => b.name.toLowerCase().includes(slotLower)) ?? null;
			}
			this.boneMap.set(slot, found);
			if (found) console.log(`[BoneHitbox] ✅ ${slot} → "${found.name}"`);
			else console.warn(`[BoneHitbox] ⚠️ ${slot} → NOT FOUND (will use AABB fallback)`);
		}
		this.rootBone = this.boneMap.get("Hips") ?? allBones[0] ?? null;
		if (this.rootBone) console.log(`[BoneHitbox] 🎯 Root bone: "${this.rootBone.name}"`);
		object.traverse((child) => {
			const mesh = child;
			if (!mesh.isMesh || !mesh.geometry) return;
			const geom = mesh.geometry;
			if (geom.boundsTree) return;
			geom.computeBoundsTree = computeBoundsTree;
			geom.disposeBoundsTree = disposeBoundsTree;
			geom.computeBoundsTree();
		});
		console.log("[BoneHitbox] 📦 three-mesh-bvh bounds trees built for combat meshes");
	}
	/**
	* Activate hitbox spheres for an attack.
	* Called when the animation enters the Active window.
	*/
	activateAttack(attackKey) {
		const config = ATTACK_HITBOX_CONFIGS[attackKey] ?? ATTACK_HITBOX_CONFIGS.lightAttack;
		this.hitRegisteredThisSwing = false;
		this.activeSpheres = config.activeBones.map((slot) => ({
			boneSlot: slot,
			radius: config.radius,
			localOffset: new Vector3(0, 0, 0),
			damage: config.damage,
			attackLevel: config.attackLevel,
			active: true,
			worldCenter: new Vector3()
		}));
		console.log(`[BoneHitbox] ⚡ Activated hitboxes for "${attackKey}": [${config.activeBones.join(", ")}]`);
	}
	/**
	* Deactivate all hitbox spheres.
	* Called when the animation exits the Active window.
	*/
	deactivateAll() {
		this.activeSpheres = [];
		this.hitRegisteredThisSwing = false;
	}
	/**
	* Update sphere world positions from bone transforms.
	* Must be called every frame AFTER the animation mixer updates.
	*/
	update(dt) {
		if (this.hitStopActive) {
			this.hitStopTimer -= dt * 1e3;
			if (this.hitStopTimer <= 0) {
				this.hitStopActive = false;
				console.log("[BoneHitbox] ✅ Hit stop ended");
			}
		}
		for (const sphere of this.activeSpheres) {
			const bone = this.boneMap.get(sphere.boneSlot);
			if (bone) {
				bone.getWorldPosition(sphere.worldCenter);
				sphere.worldCenter.add(sphere.localOffset);
			}
		}
		if (this.rootBone) {
			const worldPos = new Vector3();
			this.rootBone.getWorldPosition(worldPos);
			if (!this.rootBoneInitialized) {
				this.prevRootWorldPos.copy(worldPos);
				this.rootBoneInitialized = true;
			}
		}
	}
	/**
	* Get root bone world position delta since last frame.
	* Used for root motion pass-through.
	*/
	getRootBoneDelta() {
		if (!this.rootBone) return {
			dx: 0,
			dz: 0,
			hasMotion: false
		};
		const worldPos = new Vector3();
		this.rootBone.getWorldPosition(worldPos);
		const dx = worldPos.x - this.prevRootWorldPos.x;
		const dz = worldPos.z - this.prevRootWorldPos.z;
		this.prevRootWorldPos.copy(worldPos);
		return {
			dx,
			dz,
			hasMotion: Math.abs(dx) > .001 || Math.abs(dz) > .001
		};
	}
	/**
	* Check if any active hitbox sphere overlaps with an opponent's position.
	* Uses sphere-vs-capsule test for the opponent's body.
	*
	* @param opponentX - Opponent root X
	* @param opponentZ - Opponent root Z
	* @param opponentHeight - Opponent capsule height (default 1.85)
	* @param opponentRadius - Opponent capsule radius (default 0.3)
	*/
	checkCollision(opponentX, opponentZ, opponentHeight = 1.85, opponentRadius = .3) {
		if (this.hitRegisteredThisSwing || this.activeSpheres.length === 0) return {
			hit: false,
			sphere: null
		};
		for (const sphere of this.activeSpheres) {
			if (!sphere.active) continue;
			const capCenterY = opponentHeight * .5;
			const dx = sphere.worldCenter.x - opponentX;
			const dz = sphere.worldCenter.z - opponentZ;
			sphere.worldCenter.y - capCenterY;
			const xzDist = Math.sqrt(dx * dx + dz * dz);
			const inXZ = xzDist < sphere.radius + opponentRadius;
			const inY = sphere.worldCenter.y >= -.1 && sphere.worldCenter.y <= opponentHeight + .1;
			if (inXZ && inY) {
				this.hitRegisteredThisSwing = true;
				console.log(`[BoneHitbox] 💥 HIT! bone=${sphere.boneSlot} pos=(${sphere.worldCenter.x.toFixed(2)},${sphere.worldCenter.y.toFixed(2)},${sphere.worldCenter.z.toFixed(2)}) xzDist=${xzDist.toFixed(3)} r=${sphere.radius}`);
				return {
					hit: true,
					sphere
				};
			}
		}
		return {
			hit: false,
			sphere: null
		};
	}
	/**
	* Trigger hit stop freeze.
	* Both fighters' animation mixers should pause for hitStopMs.
	*/
	triggerHitStop(attackKey) {
		const duration = HIT_STOP_DURATIONS[attackKey] ?? 80;
		this.hitStopActive = true;
		this.hitStopTimer = duration;
		this.hitStopDuration = duration;
		console.log(`[BoneHitbox] ❄️ Hit stop: ${duration}ms for "${attackKey}"`);
		return duration;
	}
	get isHitStopActive() {
		return this.hitStopActive;
	}
	get hitStopProgress() {
		if (!this.hitStopActive || this.hitStopDuration <= 0) return 1;
		return 1 - this.hitStopTimer / this.hitStopDuration;
	}
	/** Get all active sphere positions for debug visualization */
	getActiveSpheres() {
		return this.activeSpheres.filter((s) => s.active);
	}
	/** Get bone map status for debug overlay */
	getBoneMapStatus() {
		const status = {};
		for (const [slot, bone] of this.boneMap.entries()) status[slot] = bone ? bone.name : "NOT FOUND";
		return status;
	}
	reset() {
		this.deactivateAll();
		this.hitStopActive = false;
		this.hitStopTimer = 0;
		this.rootBoneInitialized = false;
	}
};
//#endregion
export { BoneHitboxSystem as n, HIT_STOP_DURATIONS as r, BONE_NAME_ALIASES as t };
