import { Ot as VectorKeyframeTrack, S as Euler, mt as QuaternionKeyframeTrack, pt as Quaternion, q as MathUtils, u as AnimationClip } from "../_libs/@react-three/drei+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/AnimationSourceRegistry-DmnM0DXR.js
/**
* BannonEulerMotionAdapter.ts
* ─────────────────────────────────────────────────────────────────────────────
* Converts the REAL Bannon motion-bank JSON format into THREE.AnimationClip
* quaternion tracks.
*
* Actual on-disk / GitHub format (assets/moves/clips/*.json):
*   {
*     "dur": 1.7333,
*     "keys": [
*       {
*         "t": 0.0,
*         "pose": { "pelvis": [x, y, z], ... },
*         "bones": {
*           "mixamorigHips": { "rx": -0.02, "ry": -0.60, "rz": -0.02 },
*           "mixamorigRightArm": { "rx": 0.88, "ry": -0.39, "rz": -0.67 }
*         }
*       }
*     ]
*   }
*
* This is Euler rotation (rx/ry/rz, radians, XYZ order) — NOT quaternions.
* Do not describe the Bannon source data as already being quaternion animation.
*
* OUTPUT: QuaternionKeyframeTrack per Mixamo source bone. Track names keep
* the Mixamo source names (mixamorigHips, …) so AnimationRetargeter can bind
* them against the LIVE target skeleton. Unresolved tracks are reported, never
* silently rewritten onto a fake bone.
*
* TEST_ONLY procedural clips live in BannonClipJsonAdapter and must never
* be stamped AUTHORED_CLIP.
* ─────────────────────────────────────────────────────────────────────────────
*/
var BANNON_MOTION_BANK_INDEX = "https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/moves/clips/index.json";
var BANNON_MOTION_BANK_BASE = "https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/moves/clips/";
/** Preferred Bannon motion-bank files for each required semantic combat state. */
var SEMANTIC_PREFERRED_CLIPS = {
	idle: [
		"BOX_IDLE",
		"STANCE_WIDE",
		"IDLE",
		"ACTION_IDLE_TO_STANDING_IDLE",
		"STANCE_BLADED"
	],
	walk_forward: [
		"DWARF_WALK",
		"DRUNK_WALK",
		"GINGA_FORWARD",
		"LOCO_STRUT",
		"LOCO_LIGHT"
	],
	walk_back: ["GINGA_BACKWARD", "INJURED_RUN_BACKWARDS_RIGHT_TURN"],
	strafe_left: ["GINGA_SIDEWAYS_2", "LOCO_PROWL"],
	strafe_right: ["CROUCH_TORCH_WALK_RIGHT", "INJURED_TURN_RIGHT"],
	attack_1: [
		"BOXING",
		"BODY_JAB_CROSS",
		"BOXING__1_"
	],
	attack_rp: [
		"COMBO_PUNCH",
		"BOXING__2_",
		"ILLEGAL_ELBOW_PUNCH",
		"ILLEGAL_ELBOW_PUNCH__1_",
		"BASEBALL_HIT"
	],
	attack_2: [
		"HURRICANE_KICK",
		"DROP_KICK",
		"ILLEGAL_KNEE"
	],
	attack_lk: [
		"DROP_KICK",
		"ILLEGAL_KNEE",
		"TIGER_FEINT_KICK"
	],
	attack_rk: [
		"HURRICANE_KICK",
		"AU",
		"CAPOEIRA",
		"BASH",
		"CROSS_JUMPS"
	],
	block: [
		"CENTER_BLOCK",
		"GUARD_HIGH",
		"GUARD_LOW",
		"DEFENDER",
		"ESQUIVA_4"
	],
	hit_reaction: [
		"HIT_REACTION",
		"HIT_TO_BODY",
		"HIT_TO_HEAD",
		"BIG_RIB_HIT",
		"HIT_ON_THE_BACK",
		"HIT_ON_SIDE_OF_HEAD",
		"BIG_BODY_BLOW"
	],
	knockdown: [
		"FALLING_FLAT_IMPACT",
		"FALLING_FORWARD_DEATH",
		"DEFEAT",
		"DYING_BACKWARDS"
	],
	getup: [
		"KIP_UP",
		"CORKSCREW_KIP_UP",
		"ACTION_IDLE_TO_STANDING_IDLE",
		"CORKSCREW_EVADE"
	],
	grapple: [
		"DOUBLE_LEG_TAKEDOWN___VICTIM",
		"SUPLEX",
		"GERMANSUPLEX",
		"DDT",
		"CHOKESLAM"
	],
	crouch: [
		"STANCE_CROUCH",
		"CROUCH_IDLE_02_LOOKING_AROUND",
		"CROUCH_WALK_FORWARD"
	],
	run: ["DRUNK_RUN_FORWARD", "LOCO_LIGHT"],
	dash_forward: ["DRUNK_RUN_FORWARD", "LOCO_STRUT"],
	jump: ["CROSS_JUMPS"],
	taunt: [
		"BREAKDANCE_READY",
		"STANCE_BLADED",
		"CAPOEIRA"
	],
	victory: ["BREAKDANCE_READY", "STANCE_WIDE"],
	defeat: [
		"DEFEAT",
		"DYING_BACKWARDS",
		"FALLING_FORWARD_DEATH"
	]
};
function isBannonEulerMotionBank(json) {
	if (!json || typeof json !== "object") return false;
	const rec = json;
	if (!Array.isArray(rec.keys) || rec.keys.length === 0) return false;
	const first = rec.keys[0];
	return !!first && typeof first === "object" && first.bones != null && typeof first.bones === "object";
}
function toRadians(v) {
	return Math.abs(v) > Math.PI * 2.5 ? MathUtils.degToRad(v) : v;
}
function sampleToQuaternion(sample) {
	if (sample.q && sample.q.length === 4) return new Quaternion(sample.q[0], sample.q[1], sample.q[2], sample.q[3]).normalize();
	return new Quaternion().setFromEuler(new Euler(toRadians(sample.rx ?? 0), toRadians(sample.ry ?? 0), toRadians(sample.rz ?? 0), "XYZ"));
}
function frameTime(key, index, frameRate) {
	if (Number.isFinite(key.t)) return key.t;
	return index / Math.max(1, frameRate);
}
function measureAngularTravel(times, values) {
	if (times.length < 2) return 0;
	const qA = new Quaternion();
	const qB = new Quaternion();
	let travel = 0;
	for (let i = 1; i < times.length; i++) {
		qA.set(values[(i - 1) * 4], values[(i - 1) * 4 + 1], values[(i - 1) * 4 + 2], values[(i - 1) * 4 + 3]);
		qB.set(values[i * 4], values[i * 4 + 1], values[i * 4 + 2], values[i * 4 + 3]);
		travel += qA.angleTo(qB);
	}
	return travel;
}
/**
* Convert one Bannon Euler motion-bank clip into a THREE.AnimationClip.
* Track names keep Mixamo source bone names. Provenance is AUTHORED_CLIP
* only after tracks are actually produced from rx/ry/rz (or q) samples.
*/
function convertBannonEulerMotionClip(json, clipName, semanticState) {
	const keys = [...json.keys ?? []].sort((a, b) => frameTime(a, 0, 30) - frameTime(b, 0, 30));
	const frameRate = json.frameRate ?? (keys.length > 1 ? Math.max(1, (keys.length - 1) / Math.max(.001, frameTime(keys[keys.length - 1], keys.length - 1, 30))) : 30);
	const duration = json.dur ?? json.duration ?? (keys.length ? frameTime(keys[keys.length - 1], keys.length - 1, frameRate) : 0);
	const boneNames = /* @__PURE__ */ new Set();
	for (const key of keys) for (const name of Object.keys(key.bones ?? {})) boneNames.add(name);
	const tracks = [];
	let angularTravelRadians = 0;
	for (const bone of boneNames) {
		const times = [];
		const values = [];
		keys.forEach((key, index) => {
			const sample = key.bones?.[bone];
			if (!sample) return;
			if (sample.rx == null && sample.ry == null && sample.rz == null && sample.q == null) return;
			times.push(frameTime(key, index, frameRate));
			const q = sampleToQuaternion(sample);
			values.push(q.x, q.y, q.z, q.w);
		});
		if (times.length === 0) continue;
		tracks.push(new QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
		angularTravelRadians += measureAngularTravel(times, values);
	}
	const resolvedSemantic = semanticState ?? json.semanticState ?? clipName;
	const clip = new AnimationClip(clipName, duration, tracks);
	clip.userData = {
		semanticState: resolvedSemantic,
		source: json.source ?? "BANNON_MOTION_BANK",
		license: json.license ?? "unknown",
		provenance: `BannonEulerMotionAdapter: ${clipName}`,
		sourceFormat: "BANNON_EULER_RX_RY_RZ",
		clipSourceType: tracks.length > 0 ? "RETARGETED_AUTHORED_CLIP" : "MISSING_CLIP",
		isProcedural: false,
		frameCount: keys.length,
		angularTravelRadians
	};
	return {
		clip,
		semanticState: resolvedSemantic,
		trackCount: tracks.length,
		sourceBoneNames: [...boneNames],
		frameCount: keys.length,
		duration,
		sourceFormat: "BANNON_EULER_RX_RY_RZ",
		angularTravelRadians
	};
}
function pickPreferredMotionBankFiles(index) {
	const picked = [];
	const used = /* @__PURE__ */ new Set();
	for (const [semanticState, candidates] of Object.entries(SEMANTIC_PREFERRED_CLIPS)) for (const candidate of candidates) {
		const entry = index[candidate];
		if (!entry?.file) continue;
		if (used.has(candidate)) continue;
		const bones = Number(entry.bones ?? 0);
		const bytes = Number(entry.bytes ?? 0);
		if (bones > 80 || bytes > 16e4) continue;
		picked.push({
			key: candidate,
			file: entry.file,
			semanticState
		});
		used.add(candidate);
	}
	return picked;
}
/**
* BannonClipJsonAdapter.ts
* ─────────────────────────────────────────────────────────────────────────────
* Converts Bannon motion bank JSON (assets/moves/clips/) into real Three.js
* AnimationClips with quaternion bone tracks.
*
* REAL Bannon GitHub format (video_to_clip / bake_clips output):
*   { "dur": 1.73, "keys": [{ "t": 0, "pose": {...}, "bones": { mixamorigHips: {rx,ry,rz} } }] }
* This is Euler rotation in radians (XYZ). It is NOT quaternion animation.
* convertAnyBannonClipJson() detects this via isBannonEulerMotionBank() and
* delegates to BannonEulerMotionAdapter.
*
* Legacy / adapter quaternion schema (also supported):
*   { "name", "duration", "bones": { Bone: { frames: [{ t, q, p }] } } }
*
* Track names keep Mixamo source names for Euler clips so AnimationRetargeter
* can bind them against the LIVE target skeleton. Unresolved tracks are
* reported, never rewritten onto a fake bone.
*
* PROCEDURAL placeholders are PLACEHOLDER_TEST_CLIP / TEST_ONLY and must
* never be stamped AUTHORED_CLIP or used to unlock FIGHT.
* ─────────────────────────────────────────────────────────────────────────────
*/
var BONE_NAME_ALIASES = {
	mixamorigHips: "Hips",
	Hips: "Hips",
	hips: "Hips",
	hip: "Hips",
	Pelvis: "Hips",
	pelvis: "Hips",
	ROOT: "Hips",
	Root: "Hips",
	root: "Hips",
	HipNode: "Hips",
	CharacterRoot: "Hips",
	Skeleton_Root: "Hips",
	Armature: "Hips",
	armature: "Hips",
	Bannon_Hips: "Hips",
	bannon_hips: "Hips",
	mixamorigSpine: "Spine",
	mixamorigSpine1: "Spine",
	Spine: "Spine",
	spine: "Spine",
	Spine1: "Spine",
	spine1: "Spine",
	Abdomen: "Spine",
	abdomen: "Spine",
	Bip001_Spine: "Spine",
	Bip01_Spine: "Spine",
	LowerBack: "Spine",
	Bannon_Spine: "Spine",
	mixamorigSpine2: "Chest",
	mixamorigChest: "Chest",
	Chest: "Chest",
	chest: "Chest",
	Spine2: "Chest",
	spine2: "Chest",
	Spine3: "Chest",
	spine3: "Chest",
	UpperBack: "Chest",
	Torso: "Chest",
	torso: "Chest",
	Bip001_Spine1: "Chest",
	Bip001_Spine2: "Chest",
	Bannon_Chest: "Chest",
	mixamorigNeck: "Neck",
	mixamorigNeck1: "Neck",
	Neck: "Neck",
	neck: "Neck",
	Neck1: "Neck",
	Bip001_Neck: "Neck",
	Bannon_Neck: "Neck",
	mixamorigHead: "Head",
	Head: "Head",
	head: "Head",
	Bip001_Head: "Head",
	Skull: "Head",
	skull: "Head",
	Bannon_Head: "Head",
	mixamorigLeftArm: "LUpperArm",
	mixamorigLeftShoulder: "LUpperArm",
	LUpperArm: "LUpperArm",
	LeftUpperArm: "LUpperArm",
	LeftArm: "LUpperArm",
	Left_Arm: "LUpperArm",
	L_Arm: "LUpperArm",
	Bip001_L_UpperArm: "LUpperArm",
	LeftShoulder: "LUpperArm",
	Bannon_LUpperArm: "LUpperArm",
	Arm_L: "LUpperArm",
	mixamorigLeftForeArm: "LForeArm",
	LForeArm: "LForeArm",
	LeftForeArm: "LForeArm",
	LeftForearm: "LForeArm",
	Left_ForeArm: "LForeArm",
	Bip001_L_Forearm: "LForeArm",
	Bannon_LForeArm: "LForeArm",
	ForeArm_L: "LForeArm",
	mixamorigLeftHand: "LHand",
	LHand: "LHand",
	LeftHand: "LHand",
	Left_Hand: "LHand",
	Bip001_L_Hand: "LHand",
	Bannon_LHand: "LHand",
	Hand_L: "LHand",
	mixamorigRightArm: "RUpperArm",
	mixamorigRightShoulder: "RUpperArm",
	RUpperArm: "RUpperArm",
	RightUpperArm: "RUpperArm",
	RightArm: "RUpperArm",
	Right_Arm: "RUpperArm",
	R_Arm: "RUpperArm",
	Bip001_R_UpperArm: "RUpperArm",
	RightShoulder: "RUpperArm",
	Bannon_RUpperArm: "RUpperArm",
	Arm_R: "RUpperArm",
	mixamorigRightForeArm: "RForeArm",
	RForeArm: "RForeArm",
	RightForeArm: "RForeArm",
	RightForearm: "RForeArm",
	Right_ForeArm: "RForeArm",
	Bip001_R_Forearm: "RForeArm",
	Bannon_RForeArm: "RForeArm",
	ForeArm_R: "RForeArm",
	mixamorigRightHand: "RHand",
	RHand: "RHand",
	RightHand: "RHand",
	Right_Hand: "RHand",
	Bip001_R_Hand: "RHand",
	Bannon_RHand: "RHand",
	Hand_R: "RHand",
	mixamorigLeftUpLeg: "LUpperLeg",
	LUpperLeg: "LUpperLeg",
	LeftUpperLeg: "LUpperLeg",
	LeftLeg: "LUpperLeg",
	Left_Leg: "LUpperLeg",
	Bip001_L_Thigh: "LUpperLeg",
	LeftThigh: "LUpperLeg",
	Bannon_LUpperLeg: "LUpperLeg",
	UpperLeg_L: "LUpperLeg",
	mixamorigLeftLeg: "LLowerLeg",
	LLowerLeg: "LLowerLeg",
	LeftLowerLeg: "LLowerLeg",
	LeftCalf: "LLowerLeg",
	Left_Calf: "LLowerLeg",
	Bip001_L_Calf: "LLowerLeg",
	Bannon_LLowerLeg: "LLowerLeg",
	LowerLeg_L: "LLowerLeg",
	mixamorigLeftFoot: "LFoot",
	LFoot: "LFoot",
	LeftFoot: "LFoot",
	Left_Foot: "LFoot",
	Bip001_L_Foot: "LFoot",
	Bannon_LFoot: "LFoot",
	Foot_L: "LFoot",
	mixamorigRightUpLeg: "RUpperLeg",
	RUpperLeg: "RUpperLeg",
	RightUpperLeg: "RUpperLeg",
	RightLeg: "RUpperLeg",
	Right_Leg: "RUpperLeg",
	Bip001_R_Thigh: "RUpperLeg",
	RightThigh: "RUpperLeg",
	Bannon_RUpperLeg: "RUpperLeg",
	UpperLeg_R: "RUpperLeg",
	mixamorigRightLeg: "RLowerLeg",
	RLowerLeg: "RLowerLeg",
	RightLowerLeg: "RLowerLeg",
	RightCalf: "RLowerLeg",
	Right_Calf: "RLowerLeg",
	Bip001_R_Calf: "RLowerLeg",
	Bannon_RLowerLeg: "RLowerLeg",
	LowerLeg_R: "RLowerLeg",
	mixamorigRightFoot: "RFoot",
	RFoot: "RFoot",
	RightFoot: "RFoot",
	Right_Foot: "RFoot",
	Bip001_R_Foot: "RFoot",
	Bannon_RFoot: "RFoot",
	Foot_R: "RFoot"
};
/**
* Normalize a source bone name to its canonical Bannon skeleton name.
* Returns the canonical name if found, or the original name if not mapped.
*/
function normalizeToBannonBone(sourceName) {
	return BONE_NAME_ALIASES[sourceName] ?? sourceName;
}
/**
* Convert a single BannonClipJson into a Three.js AnimationClip.
*
* Each bone's frames are converted to:
*   - QuaternionKeyframeTrack for rotation (if q present)
*   - VectorKeyframeTrack for position (if p present, typically only Hips)
*   - VectorKeyframeTrack for scale (if s present)
*
* Track names use canonical Bannon bone names so they resolve against
* the target skeleton without further retargeting.
*/
function convertBannonClipJson(json, semanticStateOverride) {
	const tracks = [];
	const mappedBones = [];
	const unmappedBones = [];
	for (const [sourceBoneName, boneTrack] of Object.entries(json.bones ?? {})) {
		const canonicalName = normalizeToBannonBone(sourceBoneName);
		const wasMapped = canonicalName !== sourceBoneName || BONE_NAME_ALIASES[sourceBoneName] !== void 0;
		if (!boneTrack?.frames?.length) continue;
		const sortedFrames = [...boneTrack.frames].sort((a, b) => a.t - b.t);
		const hasQuaternion = sortedFrames.some((f) => f.q != null);
		const hasEuler = sortedFrames.some((f) => f.rx != null || f.ry != null || f.rz != null);
		if (hasQuaternion || hasEuler) {
			const times = [];
			const values = [];
			for (const frame of sortedFrames) {
				if (frame.q == null && frame.rx == null && frame.ry == null && frame.rz == null) continue;
				times.push(frame.t);
				if (frame.q != null) values.push(frame.q[0], frame.q[1], frame.q[2], frame.q[3]);
				else {
					const absMax = Math.max(Math.abs(frame.rx ?? 0), Math.abs(frame.ry ?? 0), Math.abs(frame.rz ?? 0));
					const rx = absMax > Math.PI * 2.5 ? MathUtils.degToRad(frame.rx ?? 0) : frame.rx ?? 0;
					const ry = absMax > Math.PI * 2.5 ? MathUtils.degToRad(frame.ry ?? 0) : frame.ry ?? 0;
					const rz = absMax > Math.PI * 2.5 ? MathUtils.degToRad(frame.rz ?? 0) : frame.rz ?? 0;
					const q = new Quaternion().setFromEuler(new Euler(rx, ry, rz, "XYZ"));
					values.push(q.x, q.y, q.z, q.w);
				}
			}
			if (times.length > 0) tracks.push(new QuaternionKeyframeTrack(`${canonicalName}.quaternion`, times, values));
		}
		if (sortedFrames.some((f) => f.p != null)) {
			const times = [];
			const values = [];
			for (const frame of sortedFrames) {
				if (frame.p == null) continue;
				times.push(frame.t);
				values.push(frame.p[0], frame.p[1], frame.p[2]);
			}
			if (times.length > 0) tracks.push(new VectorKeyframeTrack(`${canonicalName}.position`, times, values));
		}
		if (sortedFrames.some((f) => f.s != null)) {
			const times = [];
			const values = [];
			for (const frame of sortedFrames) {
				if (frame.s == null) continue;
				times.push(frame.t);
				values.push(frame.s[0], frame.s[1], frame.s[2]);
			}
			if (times.length > 0) tracks.push(new VectorKeyframeTrack(`${canonicalName}.scale`, times, values));
		}
		if (tracks.length > 0) {
			if (wasMapped) mappedBones.push(`${sourceBoneName} → ${canonicalName}`);
			else unmappedBones.push(sourceBoneName);
		}
	}
	const semanticState = semanticStateOverride ?? json.semanticState ?? json.name;
	const clip = new AnimationClip(json.name, json.duration, tracks);
	clip.userData = {
		semanticState,
		source: json.source ?? "bannon_motion_bank",
		license: json.license ?? "unknown",
		provenance: `BannonClipJsonAdapter: ${json.source ?? "bannon_motion_bank"}`,
		frameRate: json.frameRate ?? 30,
		mappedBones: mappedBones.length,
		unmappedBones: unmappedBones.length,
		clipSourceType: tracks.length > 0 ? "AUTHORED_CLIP" : "MISSING_CLIP",
		isProcedural: false,
		sourceFormat: "BANNON_CLIP_JSON"
	};
	console.log(`[BannonClipJsonAdapter] ✅ Converted "${json.name}" → semantic="${semanticState}"\n  Duration: ${(json.duration ?? 0).toFixed(3)}s  Tracks: ${tracks.length}  Mapped bones: ${mappedBones.length}  Unmapped: ${unmappedBones.length}\n` + (unmappedBones.length > 0 ? `  ⚠️ Unmapped: [${unmappedBones.join(", ")}]` : ""));
	return {
		clip,
		semanticState,
		trackCount: tracks.length,
		mappedBones,
		unmappedBones,
		source: json.source ?? "bannon_motion_bank",
		license: json.license ?? "unknown"
	};
}
/**
* Convert either the real Euler motion-bank format (`dur`/`keys`/`rx,ry,rz`)
* or the quaternion `bones.frames.q` schema. Does not invent tracks.
*/
function convertAnyBannonClipJson(json, clipName, semanticState) {
	if (isBannonEulerMotionBank(json)) {
		const euler = convertBannonEulerMotionClip(json, clipName, semanticState);
		return {
			clip: euler.clip,
			semanticState: euler.semanticState,
			trackCount: euler.trackCount,
			mappedBones: euler.sourceBoneNames.map((b) => `${b} → ${normalizeToBannonBone(b)}`),
			unmappedBones: [],
			source: "BANNON_MOTION_BANK",
			license: json.license ?? "unknown"
		};
	}
	const rec = json;
	if (!rec || typeof rec !== "object" || !rec.bones) throw new Error("UNSUPPORTED_BANNON_CLIP_FORMAT");
	return convertBannonClipJson({
		...rec,
		name: rec.name ?? clipName,
		semanticState: semanticState ?? rec.semanticState
	}, semanticState);
}
var cachedMotionBank = null;
function getCachedBannonMotionBank() {
	return cachedMotionBank;
}
/**
* Load Bannon clips from a list of JSON URLs (browser-compatible).
* Used when the clips are served as static assets.
*
* @param clipUrls - Array of URLs to BannonClipJson files
* @returns Map<semanticState, AnimationClip> with AUTHORED_CLIP userData
*/
async function loadBannonClipsFromUrls(clipUrls) {
	const result = /* @__PURE__ */ new Map();
	console.log(`[BannonClipJsonAdapter] Loading ${clipUrls.length} clips from URLs`);
	const loadResults = await Promise.allSettled(clipUrls.map(async (url) => {
		let res = await fetch(url);
		if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
		return {
			url,
			json: await res.json()
		};
	}));
	for (const settled of loadResults) {
		if (settled.status === "rejected") {
			console.warn(`[BannonClipJsonAdapter] ⚠️ Failed to load clip: ${settled.reason}`);
			continue;
		}
		const { url, json } = settled.value;
		try {
			const adapted = convertAnyBannonClipJson(json, json.name ?? decodeURIComponent(url.split("/").pop() ?? "clip").replace(/\.json$/i, ""));
			adapted.clip.userData = {
				...adapted.clip.userData,
				clipSourceType: adapted.trackCount > 0 ? adapted.clip.userData?.clipSourceType ?? "AUTHORED_CLIP" : "MISSING_CLIP",
				sourceUrl: url,
				isProcedural: false
			};
			if (adapted.trackCount > 0 && !result.has(adapted.semanticState)) result.set(adapted.semanticState, adapted.clip);
		} catch (e) {
			console.error(`[BannonClipJsonAdapter] ❌ Failed to convert clip from ${url}: ${e.message}`);
		}
	}
	console.log(`[BannonClipJsonAdapter] ✅ Loaded ${result.size} AUTHORED_CLIP clips from URLs`);
	return result;
}
/**
* Load the real Bannon motion bank from GitHub (rx/ry/rz Euler keys).
* Falls back to a local /assets/moves/clips/manifest.json if present.
*
* Never stamps PLACEHOLDER_TEST_CLIP as AUTHORED_CLIP.
*/
async function loadBannonMotionBankVariants() {
	await loadBannonClipsFromPublic();
	return cachedMotionBank?.variants ?? /* @__PURE__ */ new Map();
}
async function loadBannonClipsFromPublic() {
	if (cachedMotionBank) return cachedMotionBank.clips;
	const stats = {
		indexSize: 0,
		attempted: 0,
		converted: 0,
		failed: [],
		unresolvedTrackNames: [],
		angularTravelRadians: 0,
		source: BANNON_MOTION_BANK_INDEX
	};
	try {
		const localIndexRes = await fetch("/motion/index.json");
		const githubIndexRes = localIndexRes.ok ? null : await fetch(BANNON_MOTION_BANK_INDEX);
		const indexRes = localIndexRes.ok ? localIndexRes : githubIndexRes;
		if (!indexRes || !indexRes.ok) throw new Error(`Bannon motion index HTTP ${indexRes?.status ?? "offline"}`);
		const index = await indexRes.json();
		stats.indexSize = Object.keys(index).length;
		stats.source = localIndexRes.ok ? "/motion/index.json" : BANNON_MOTION_BANK_INDEX;
		const preferred = pickPreferredMotionBankFiles(index);
		const capped = [];
		const perState = /* @__PURE__ */ new Map();
		for (const item of preferred) {
			const n = perState.get(item.semanticState) ?? 0;
			if (n >= ([
				"attack_1",
				"attack_2",
				"attack_rp",
				"attack_lk",
				"attack_rk",
				"hit_reaction",
				"grapple",
				"taunt"
			].includes(item.semanticState) ? 3 : 1)) continue;
			capped.push(item);
			perState.set(item.semanticState, n + 1);
		}
		stats.attempted = capped.length;
		const clips = /* @__PURE__ */ new Map();
		const variants = /* @__PURE__ */ new Map();
		const loaded = await Promise.allSettled(capped.map(async ({ key, file, semanticState }) => {
			const localUrl = `/motion/${encodeURIComponent(file)}`;
			let res = await fetch(localUrl);
			const url = res.ok ? localUrl : `${BANNON_MOTION_BANK_BASE}${encodeURIComponent(file)}`;
			if (!res.ok) res = await fetch(url);
			if (!res.ok) throw new Error(`${key} HTTP ${res.status}`);
			const adapted = convertAnyBannonClipJson(await res.json(), key, semanticState);
			if (adapted.trackCount === 0) throw new Error(`${key} NO_TRACKS`);
			adapted.clip.userData = {
				...adapted.clip.userData,
				clipSourceType: adapted.clip.userData?.clipSourceType ?? "RETARGETED_AUTHORED_CLIP",
				sourceUrl: url,
				sourceFile: file,
				isProcedural: false,
				semanticState
			};
			return {
				key,
				semanticState,
				adapted
			};
		}));
		for (const settled of loaded) {
			if (settled.status === "rejected") {
				stats.failed.push(String(settled.reason));
				console.warn(`[BannonClipJsonAdapter] ⚠️ Motion-bank clip failed:`, settled.reason);
				continue;
			}
			const { key, semanticState, adapted } = settled.value;
			variants.set(key, adapted.clip);
			if (!clips.has(semanticState)) {
				clips.set(semanticState, adapted.clip);
				stats.converted++;
				const travel = Number(adapted.clip.userData?.angularTravelRadians ?? 0);
				stats.angularTravelRadians += travel;
			} else stats.converted++;
		}
		cachedMotionBank = {
			clips,
			variants,
			stats
		};
		console.log(`[BannonClipJsonAdapter] 📊 Bannon Euler motion bank:\n  Index size:     ${stats.indexSize}\n  Attempted:      ${stats.attempted}\n  Converted:      ${stats.converted}\n  Failed:         ${stats.failed.length}\n  States:         [${[...clips.keys()].join(", ")}]\n  Variants:       ${variants.size}\n  Angular travel: ${stats.angularTravelRadians.toFixed(3)} rad`);
		return clips;
	} catch (error) {
		console.warn(`[BannonClipJsonAdapter] GitHub motion bank failed (${error.message}). Trying local public/ assets.`);
	}
	const MANIFEST_URL = "/assets/moves/clips/manifest.json";
	try {
		let res = await fetch(MANIFEST_URL);
		if (res.ok) {
			const local = await loadBannonClipsFromUrls(((await res.json()).clips ?? []).map((f) => f.startsWith("/") || f.startsWith("http") ? f : `/assets/moves/clips/${f}`));
			cachedMotionBank = {
				clips: local,
				variants: local,
				stats: {
					...stats,
					converted: local.size,
					source: MANIFEST_URL
				}
			};
			return local;
		}
	} catch {}
	console.warn(`[BannonClipJsonAdapter] No authored Bannon motion-bank clips loaded.`);
	cachedMotionBank = {
		clips: /* @__PURE__ */ new Map(),
		variants: /* @__PURE__ */ new Map(),
		stats
	};
	return cachedMotionBank.clips;
}
var SOURCE_PRIORITY = {
	BANNON_MOTION_BANK: 1,
	BANNON_RIG_REFERENCE: 2,
	OPEN_MOCAP: 3,
	SCHWARZERBLITZ: 4,
	NIGHTSKY_ENGINE: 5,
	TEKKEN_TOOLING: 6,
	PROCEDURAL: 99,
	UNKNOWN: 100
};
var AnimationSourceRegistry = class {
	entries = [];
	clipsByState = /* @__PURE__ */ new Map();
	sourcesByState = /* @__PURE__ */ new Map();
	/**
	* Register an animation source entry.
	* If a clip for this semantic state already exists with higher priority,
	* the new entry is ignored.
	*/
	register(entry) {
		this.entries.push(entry);
		if (entry.clip) {
			const existing = this.sourcesByState.get(entry.semanticState);
			if (!existing || entry.priority < existing.priority) {
				this.clipsByState.set(entry.semanticState, entry.clip);
				this.sourcesByState.set(entry.semanticState, entry);
				console.log(`[AnimationSourceRegistry] ✅ Registered "${entry.semanticState}" from ${entry.type} (priority=${entry.priority}, license="${entry.license}")`);
			} else console.log(`[AnimationSourceRegistry] ℹ️ Skipped "${entry.semanticState}" from ${entry.type} — existing source has higher priority (${existing.priority} < ${entry.priority})`);
		}
	}
	/**
	* Register a batch of clips from the Bannon motion bank.
	* These have the highest priority.
	*/
	registerBannonMotionBank(clips, sourceFile = "assets/moves/clips/") {
		for (const [semanticState, clip] of clips) {
			const isProcedural = clip.userData?.isProcedural === true;
			this.register({
				id: `bannon_motion_bank_${semanticState}`,
				type: isProcedural ? "PROCEDURAL" : "BANNON_MOTION_BANK",
				semanticState,
				file: sourceFile,
				sourceConvention: "bannon",
				license: "proprietary",
				provenance: `Bannon motion bank: ${sourceFile}`,
				redistributable: false,
				priority: isProcedural ? SOURCE_PRIORITY.PROCEDURAL : SOURCE_PRIORITY.BANNON_MOTION_BANK,
				clip
			});
		}
	}
	/**
	* Register clips extracted from a rigged GLB.
	*/
	registerGLBClips(clips, glbPath, characterId) {
		for (const clip of clips) {
			const semanticState = clip.userData?.semanticState ?? clip.name;
			this.register({
				id: `glb_${characterId}_${semanticState}`,
				type: "BANNON_RIG_REFERENCE",
				semanticState,
				file: glbPath,
				sourceConvention: "native",
				license: "proprietary",
				provenance: `GLB embedded animation: ${glbPath}`,
				redistributable: false,
				priority: SOURCE_PRIORITY.BANNON_RIG_REFERENCE,
				clip
			});
		}
	}
	/**
	* Register open/CC0 mocap clips.
	*/
	registerOpenMocap(clips, sourceFile, license) {
		for (const [semanticState, clip] of clips) this.register({
			id: `open_mocap_${semanticState}`,
			type: "OPEN_MOCAP",
			semanticState,
			file: sourceFile,
			sourceConvention: "mixamo",
			license,
			provenance: `Open mocap: ${sourceFile}`,
			redistributable: true,
			priority: SOURCE_PRIORITY.OPEN_MOCAP,
			clip
		});
	}
	/**
	* Register clips loaded from BannonClipJsonAdapter.loadBannonClipsFromDirectory()
	* or loadBannonClipsFromUrls(). These are classified as AUTHORED_CLIP.
	*
	* This is the primary method for wiring the Bannon motion bank into the
	* AnimationSourceRegistry with AUTHORED_CLIP verdicts.
	*
	* @param clips - Map<semanticState, AnimationClip> from BannonClipJsonAdapter
	* @param sourceDir - Source directory or URL prefix for provenance
	*/
	registerAuthoredClips(clips, sourceDir = "assets/moves/clips/") {
		let registeredCount = 0;
		let skippedCount = 0;
		for (const [semanticState, clip] of clips) {
			const isProcedural = clip.userData?.isProcedural === true;
			const clipSourceType = clip.userData?.clipSourceType ?? (isProcedural ? "PROCEDURAL" : "AUTHORED_CLIP");
			const sourceType = isProcedural ? "PROCEDURAL" : "BANNON_MOTION_BANK";
			const priority = isProcedural ? SOURCE_PRIORITY.PROCEDURAL : SOURCE_PRIORITY.BANNON_MOTION_BANK;
			const existing = this.sourcesByState.get(semanticState);
			if (existing && existing.priority <= priority) {
				skippedCount++;
				continue;
			}
			this.register({
				id: `authored_${semanticState}_${Date.now()}`,
				type: sourceType,
				semanticState,
				file: clip.userData?.sourceFile ?? clip.userData?.sourceUrl ?? sourceDir,
				sourceConvention: "bannon",
				license: clip.userData?.license ?? "proprietary",
				provenance: `BannonClipJsonAdapter: ${sourceDir} — ${clipSourceType}`,
				redistributable: false,
				priority,
				clip
			});
			registeredCount++;
		}
		console.log(`[AnimationSourceRegistry] 📥 registerAuthoredClips: ${registeredCount} registered, ${skippedCount} skipped (lower priority)`);
	}
	/**
	* Get a summary of clip source verdicts for all registered states.
	* Used by PreCombatValidationScreen and AnimationIntegrityGate.
	*
	* Returns per-state verdict: AUTHORED_CLIP | RETARGETED_AUTHORED_CLIP | PLACEHOLDER_TEST_CLIP | MISSING_CLIP
	*/
	getClipSourceVerdicts(requiredStates) {
		const verdicts = {};
		for (const state of requiredStates) {
			const source = this.sourcesByState.get(state);
			if (!source) {
				verdicts[state] = "MISSING_CLIP";
				continue;
			}
			if (source.type === "PROCEDURAL") verdicts[state] = "PLACEHOLDER_TEST_CLIP";
			else if (source.type === "BANNON_MOTION_BANK" || source.type === "OPEN_MOCAP") {
				if (source.clip?.userData?.clipSourceType === "RETARGETED_AUTHORED_CLIP") verdicts[state] = "RETARGETED_AUTHORED_CLIP";
				else verdicts[state] = "AUTHORED_CLIP";
			} else verdicts[state] = "AUTHORED_CLIP";
		}
		return verdicts;
	}
	/**
	* Check if any MISSING_CLIP verdicts exist for required states.
	* Returns the list of states with MISSING_CLIP verdict.
	*/
	getMissingClipVerdicts(requiredStates) {
		return requiredStates.filter((s) => !this.clipsByState.has(s));
	}
	/**
	* Get the best available clip for a semantic state.
	* Returns null if no clip is registered for this state.
	*/
	getClip(semanticState) {
		return this.clipsByState.get(semanticState) ?? null;
	}
	/**
	* Get all registered clips as a Map<semanticState, AnimationClip>.
	*/
	getAllClips() {
		return new Map(this.clipsByState);
	}
	/**
	* Get the source entry for a semantic state.
	*/
	getSource(semanticState) {
		return this.sourcesByState.get(semanticState) ?? null;
	}
	/**
	* Get all registered semantic states.
	*/
	getRegisteredStates() {
		return [...this.clipsByState.keys()];
	}
	/**
	* Get states that have no registered clip.
	*/
	getMissingStates(requiredStates) {
		return requiredStates.filter((s) => !this.clipsByState.has(s));
	}
	/**
	* Print a full registry report to the console.
	*/
	printReport(characterId) {
		const states = this.getRegisteredStates();
		const sources = states.map((s) => {
			const src = this.sourcesByState.get(s);
			return `  ${s.padEnd(20)} | ${(src?.type ?? "UNKNOWN").padEnd(20)} | ${src?.license ?? "unknown"}`;
		});
		console.log(`[AnimationSourceRegistry] 📋 "${characterId}" registry report:\n  Registered states: ${states.length}\n  State                | Source Type          | License\n  ${"─".repeat(60)}\n` + sources.join("\n"));
	}
	/**
	* Check if any procedural placeholders are registered.
	* Used to warn that real animation is still needed.
	*/
	hasProceduralPlaceholders() {
		for (const entry of this.sourcesByState.values()) if (entry.type === "PROCEDURAL") return true;
		return false;
	}
	/**
	* Get count of procedural placeholder clips.
	*/
	getProceduralCount() {
		let count = 0;
		for (const entry of this.sourcesByState.values()) if (entry.type === "PROCEDURAL") count++;
		return count;
	}
};
var REQUIRED_SEMANTIC_STATES = [
	"idle",
	"walk_forward",
	"walk_back",
	"strafe_left",
	"strafe_right",
	"attack_1",
	"attack_2",
	"block",
	"hit_reaction",
	"knockdown",
	"getup"
];
/**
* Validate that a registry has all required states for a playable fighter.
* Returns a report with PASS/BLOCKED verdict.
*/
function validateRegistryCompleteness(registry, characterId) {
	const missingStates = registry.getMissingStates([...REQUIRED_SEMANTIC_STATES]);
	const proceduralCount = registry.getProceduralCount();
	let registeredCount = registry.getRegisteredStates().length;
	let verdict;
	if (missingStates.length === 0 && proceduralCount === 0) verdict = "PASS";
	else if (missingStates.length === 0) verdict = "PARTIAL";
	else verdict = "BLOCKED";
	const report = `[AnimationSourceRegistry] ${verdict === "PASS" ? "✅" : verdict === "PARTIAL" ? "⚠️" : "❌"} "${characterId}" registry completeness: ${verdict}\n  Registered: ${registeredCount}/${REQUIRED_SEMANTIC_STATES.length} required states\n  Missing:    [${missingStates.join(", ") || "none"}]\n  Procedural: ${proceduralCount} placeholder(s) — replace with authored animation\n` + (verdict === "BLOCKED" ? `  ❌ BLOCKED: Fighter cannot be played without: [${missingStates.join(", ")}]` : verdict === "PARTIAL" ? `  ⚠️ PARTIAL: ${proceduralCount} procedural placeholder(s) — visible deformation but not authored motion` : `  ✅ PASS: All required states have authored animation clips`);
	console.log(report);
	return {
		verdict,
		registeredCount,
		missingStates,
		proceduralCount,
		report
	};
}
//#endregion
export { loadBannonMotionBankVariants as a, loadBannonClipsFromPublic as i, REQUIRED_SEMANTIC_STATES as n, validateRegistryCompleteness as o, getCachedBannonMotionBank as r, AnimationSourceRegistry as t };
