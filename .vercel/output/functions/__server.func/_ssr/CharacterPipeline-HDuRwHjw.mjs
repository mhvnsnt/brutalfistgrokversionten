import { c as getActiveRenderProfile } from "./bannonGlbRoster-Th39Z2sz.mjs";
import { Dt as Vector3, R as LinearFilter, S as Euler, _t as SRGBColorSpace, d as AnimationMixer, et as NearestFilter, gt as RepeatWrapping, m as Box3, mt as QuaternionKeyframeTrack, pt as Quaternion, u as AnimationClip, wt as TextureLoader, yt as SkeletonHelper } from "../_libs/@react-three/drei+[...].mjs";
import { a as loadBannonMotionBankVariants, i as loadBannonClipsFromPublic, o as validateRegistryCompleteness, t as AnimationSourceRegistry } from "./AnimationSourceRegistry-DmnM0DXR.mjs";
import { t as SkeletonUtils } from "../_libs/three-stdlib.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/CharacterPipeline-HDuRwHjw.js
/**
* Skinned re-exports (MAIME_skinned, MAIME_tattered_skinned) dropped their
* image buffers. Restore the authored albedo from the unskinned sibling PNG
* without replacing materials or rewriting skin weights.
*/
var SIBLING_ALBEDO = {
	"MAIME_skinned.glb": "/models/textures/MAIME_0.png",
	"MAIME_tattered_skinned.glb": "/models/textures/MAIME_tattered_0.png",
	"BANNON_rigged.glb": "/models/textures/BANNON_rigged_0.png"
};
var loader = new TextureLoader();
var cache = /* @__PURE__ */ new Map();
function fileName(modelUrl) {
	return (modelUrl.split("?")[0].split("/").pop() ?? "").trim();
}
function albedoUrlFor(modelUrl) {
	const file = fileName(modelUrl);
	if (SIBLING_ALBEDO[file]) return SIBLING_ALBEDO[file];
	const stem = file.replace(/\.glb$/i, "").replace(/_skinned$/i, "");
	if (/maime|bannon/i.test(stem)) return `/models/textures/${stem}_0.png`;
	return null;
}
function textureFor(url) {
	const hit = cache.get(url);
	if (hit) return hit;
	const tex = loader.load(url, (t) => {
		t.colorSpace = SRGBColorSpace;
		t.flipY = false;
		t.needsUpdate = true;
	});
	tex.colorSpace = SRGBColorSpace;
	tex.flipY = false;
	tex.wrapS = RepeatWrapping;
	tex.wrapT = RepeatWrapping;
	cache.set(url, tex);
	return tex;
}
function materialNeedsAlbedo(mat) {
	if (!mat) return false;
	return !mat.map;
}
function restoreAuthoredTextures(root, modelUrl) {
	const url = albedoUrlFor(modelUrl);
	if (!url) return false;
	let missing = false;
	root.traverse((child) => {
		const mesh = child;
		if (!mesh.isMesh) return;
		if ((Array.isArray(mesh.material) ? mesh.material : [mesh.material]).some((m) => materialNeedsAlbedo(m))) missing = true;
	});
	if (!missing) return false;
	const tex = textureFor(url);
	root.traverse((child) => {
		const mesh = child;
		if (!mesh.isMesh) return;
		(Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((mat) => {
			if (!mat || mat.map) return;
			const m = mat;
			m.map = tex;
			if ("color" in m && m.color) m.color.set(16777215);
			mat.needsUpdate = true;
		});
	});
	return true;
}
/**
* Only CIPHER_feral.glb is hunched. Keep it at 0.75 (25% under roster height).
* CIPHER.glb (default / green-mouth) and CIPHER_minion.glb use the universal 1.85m target.
*/
var ROSTER_HEIGHT_SCALE = { "CIPHER_feral.glb": .75 };
function rosterHeightScale(modelUrl) {
	const scale = ROSTER_HEIGHT_SCALE[decodeURIComponent(modelUrl.split("/").pop() ?? modelUrl).split("?")[0]];
	return Number.isFinite(scale) && scale > .1 ? scale : 1;
}
/**
* Universal Mixamo / mocap clip sanitizer.
*
* Fighting-game instances own facing (outer yaw) and floor plant (outer Y).
* Clips must be in-place and face the skeleton's bind forward (+Z for Mixamo).
*
* Why AI always breaks this:
*   1. Copying Mixamo hip quaternion as-is leaves ~40–90° of yaw in IDLE
*      (our IDLE.json hips.ry ≈ −0.75). Stack that with outer yaw and the
*      abs face away from the opponent while the neck still looks at them.
*   2. pose.pelvis Y (~0.91m) applied as Hips.position on a mesh already
*      planted at bind-pose height double-counts hip height → hover.
*   3. Procedural Euler banks written as ABSOLUTE local quaternions replace
*      Mixamo rest (legs rz ≈ ±π) with made-up angles → truck-hit twist.
*
* Legal operations: drop root translation, zero hip yaw, keep lean/pitch.
* Illegal: rest-pose-ignorant track rename, hip Y-π "align", bone-snap floor.
*/
var _q = new Quaternion();
var _e = new Euler();
function boneFromTrack(trackName) {
	const dot = trackName.lastIndexOf(".");
	const withoutProp = dot === -1 ? trackName : trackName.slice(0, dot);
	const pipe = withoutProp.lastIndexOf("|");
	return (pipe === -1 ? withoutProp : withoutProp.slice(pipe + 1)).replace(/^mixamorig:?/i, "");
}
function isRootBone(bone) {
	return /^(hips?|pelvis|root|armature)$/i.test(bone);
}
function stripRootPositionTracks(clip) {
	clip.tracks = clip.tracks.filter((track) => {
		if (!track.name.endsWith(".position")) return true;
		return !isRootBone(boneFromTrack(track.name));
	});
	return clip;
}
/** Zero hip yaw so the instance yaw is the only facing. Keeps X/Z lean. */
function neutralizeHipYaw(clip) {
	for (const track of clip.tracks) {
		if (!track.name.endsWith(".quaternion")) continue;
		if (!isRootBone(boneFromTrack(track.name))) continue;
		const values = track.values;
		for (let i = 0; i + 3 < values.length; i += 4) {
			_q.set(values[i], values[i + 1], values[i + 2], values[i + 3]);
			_e.setFromQuaternion(_q, "YXZ");
			_e.y = 0;
			_q.setFromEuler(_e);
			values[i] = _q.x;
			values[i + 1] = _q.y;
			values[i + 2] = _q.z;
			values[i + 3] = _q.w;
		}
	}
	return clip;
}
function sanitizeMotionClip(clip) {
	stripRootPositionTracks(clip);
	neutralizeHipYaw(clip);
	return clip;
}
/**
* Bind-relative motion. Keys from LIVE bind: q(t) = q_bind * q_delta.
* Never write absolute Mixamo/Euler banks — that replaces rest and twists
* hunched Cipher / plugin Maime / Mixamo legs (rz ≈ ±π).
*/
var _delta = new Quaternion();
var _out = new Quaternion();
var _euler = new Euler();
function collectRests(root) {
	const rests = [];
	const seen = /* @__PURE__ */ new Set();
	root.traverse((obj) => {
		if (!obj.isBone || !obj.name || seen.has(obj.name)) return;
		seen.add(obj.name);
		rests.push({
			name: obj.name,
			q: obj.quaternion.clone()
		});
	});
	return rests;
}
function boneKey(name) {
	return name.replace(/^mixamorig[:._-]*/i, "").replace(/^bip0?1[_:]?/i, "").replace(/^bone[_:]?/i, "");
}
/** Slot name (from clipFromDeltas keys) → any common rig synonym. */
var SLOT_RX = {
	RightArm: /^(rightarm|rupperarm|rightupperarm|upperarm_r|arm_r|right_arm|r_arm)$/i,
	LeftArm: /^(leftarm|lupperarm|leftupperarm|upperarm_l|arm_l|left_arm|l_arm)$/i,
	RightForeArm: /^(rightforearm|rforearm|rightlowerarm|lowerarm_r|forearm_r|r_forearm)$/i,
	LeftForeArm: /^(leftforearm|lforearm|leftlowerarm|lowerarm_l|forearm_l|l_forearm)$/i,
	RightUpLeg: /^(rightupleg|rupperleg|rightupperleg|thigh_r|upleg_r|rthigh|rightthigh|hip_r)$/i,
	LeftUpLeg: /^(leftupleg|lupperleg|leftupperleg|thigh_l|upleg_l|lthigh|leftthigh|hip_l)$/i,
	RightLeg: /^(rightleg|rlowerleg|rightlowerleg|calf_r|shin_r|rcalf)$/i,
	LeftLeg: /^(leftleg|llowerleg|leftlowerleg|calf_l|shin_l|lcalf)$/i,
	Spine: /^(spine|spine1|spine2|chest|torso|abdomen|spine_01|spine_02|spine01)$/i,
	Head: /^(head|head_01|skull|headtop)$/i
};
function match(name, re) {
	const k = boneKey(name);
	const rx = SLOT_RX[re.replace(/^\^/, "").replace(/\$$/, "")];
	if (rx) return rx.test(k);
	return new RegExp(re, "i").test(k);
}
function qMul(bind, dx, dy, dz) {
	_euler.set(dx, dy, dz, "XYZ");
	_delta.setFromEuler(_euler);
	_out.copy(bind).multiply(_delta);
	return [
		_out.x,
		_out.y,
		_out.z,
		_out.w
	];
}
function clipFromDeltas(name, semantic, duration, rests, keys, loop = true) {
	const tracks = [];
	for (const rest of rests) {
		const times = [];
		const values = [];
		let used = false;
		for (const key of keys) {
			let delta = [
				0,
				0,
				0
			];
			for (const [re, d] of Object.entries(key.d)) if (match(rest.name, re)) {
				delta = d;
				used = true;
				break;
			}
			times.push(key.t);
			values.push(...qMul(rest.q, delta[0], delta[1], delta[2]));
		}
		if (!used) continue;
		tracks.push(new QuaternionKeyframeTrack(`${rest.name}.quaternion`, times, values));
	}
	const clip = new AnimationClip(name, duration, tracks);
	clip.userData = {
		semanticState: semantic,
		clipSourceType: "BIND_RELATIVE",
		isProcedural: true,
		loop
	};
	return clip;
}
function buildBindRelativeClips(root) {
	const rests = collectRests(root);
	if (rests.length === 0) return [];
	return [
		clipFromDeltas("idle", "idle", 2, rests, [
			{
				t: 0,
				d: {
					"^Spine$": [
						.03,
						0,
						0
					],
					"^Head$": [
						-.02,
						0,
						0
					]
				}
			},
			{
				t: 1,
				d: {
					"^Spine$": [
						-.02,
						0,
						0
					],
					"^Head$": [
						.02,
						0,
						0
					]
				}
			},
			{
				t: 2,
				d: {
					"^Spine$": [
						.03,
						0,
						0
					],
					"^Head$": [
						-.02,
						0,
						0
					]
				}
			}
		]),
		clipFromDeltas("guard", "block", 1.6, rests, [
			{
				t: 0,
				d: {
					"^LeftArm$": [
						-.55,
						.12,
						.7
					],
					"^RightArm$": [
						-.55,
						-.12,
						-.7
					],
					"^LeftForeArm$": [
						-.4,
						0,
						.35
					],
					"^RightForeArm$": [
						-.4,
						0,
						-.35
					],
					"^Spine$": [
						.08,
						0,
						0
					]
				}
			},
			{
				t: .8,
				d: {
					"^LeftArm$": [
						-.6,
						.12,
						.75
					],
					"^RightArm$": [
						-.6,
						-.12,
						-.75
					],
					"^LeftForeArm$": [
						-.45,
						0,
						.4
					],
					"^RightForeArm$": [
						-.45,
						0,
						-.4
					],
					"^Spine$": [
						.1,
						0,
						0
					]
				}
			},
			{
				t: 1.6,
				d: {
					"^LeftArm$": [
						-.55,
						.12,
						.7
					],
					"^RightArm$": [
						-.55,
						-.12,
						-.7
					],
					"^LeftForeArm$": [
						-.4,
						0,
						.35
					],
					"^RightForeArm$": [
						-.4,
						0,
						-.35
					],
					"^Spine$": [
						.08,
						0,
						0
					]
				}
			}
		]),
		clipFromDeltas("attack_1", "attack_1", .42, rests, [
			{
				t: 0,
				d: {
					"^RightArm$": [
						-.4,
						.15,
						-.5
					],
					"^RightForeArm$": [
						-.3,
						0,
						-.4
					],
					"^Spine$": [
						0,
						.08,
						0
					]
				}
			},
			{
				t: .12,
				d: {
					"^RightArm$": [
						-.2,
						-.25,
						-1.35
					],
					"^RightForeArm$": [
						-.05,
						0,
						-.15
					],
					"^Spine$": [
						.08,
						.22,
						0
					],
					"^LeftArm$": [
						-.2,
						.1,
						.35
					]
				}
			},
			{
				t: .42,
				d: {
					"^RightArm$": [
						0,
						0,
						0
					],
					"^Spine$": [
						0,
						0,
						0
					]
				}
			}
		], false),
		clipFromDeltas("attack_rp", "attack_rp", .5, rests, [
			{
				t: 0,
				d: {
					"^RightArm$": [
						-.5,
						.3,
						-.4
					],
					"^LeftArm$": [
						-.25,
						.1,
						.4
					],
					"^Spine$": [
						0,
						-.12,
						0
					]
				}
			},
			{
				t: .16,
				d: {
					"^RightArm$": [
						-.15,
						-.2,
						-1.5
					],
					"^RightForeArm$": [
						-.1,
						0,
						-.2
					],
					"^Spine$": [
						.1,
						.28,
						0
					],
					"^Head$": [
						0,
						.1,
						0
					]
				}
			},
			{
				t: .5,
				d: {
					"^RightArm$": [
						0,
						0,
						0
					],
					"^Spine$": [
						0,
						0,
						0
					]
				}
			}
		], false),
		clipFromDeltas("attack_2", "attack_2", .58, rests, [
			{
				t: 0,
				d: {
					"^LeftArm$": [
						-.35,
						.2,
						.55
					],
					"^Spine$": [
						0,
						-.08,
						0
					]
				}
			},
			{
				t: .2,
				d: {
					"^LeftArm$": [
						-.2,
						-.18,
						1.2
					],
					"^LeftForeArm$": [
						-.25,
						0,
						.35
					],
					"^Spine$": [
						.08,
						.18,
						0
					]
				}
			},
			{
				t: .58,
				d: {
					"^LeftArm$": [
						0,
						0,
						0
					],
					"^Spine$": [
						0,
						0,
						0
					]
				}
			}
		], false),
		clipFromDeltas("attack_lk", "attack_lk", .5, rests, [
			{
				t: 0,
				d: {
					"^LeftUpLeg$": [
						.35,
						0,
						0
					],
					"^Spine$": [
						.05,
						0,
						0
					],
					"^LeftArm$": [
						-.2,
						0,
						.3
					]
				}
			},
			{
				t: .16,
				d: {
					"^LeftUpLeg$": [
						1.15,
						0,
						.15
					],
					"^LeftLeg$": [
						.35,
						0,
						0
					],
					"^Spine$": [
						-.08,
						.1,
						0
					],
					"^RightArm$": [
						-.3,
						0,
						-.4
					]
				}
			},
			{
				t: .5,
				d: {
					"^LeftUpLeg$": [
						0,
						0,
						0
					],
					"^Spine$": [
						0,
						0,
						0
					]
				}
			}
		], false),
		clipFromDeltas("attack_rk", "attack_rk", .62, rests, [
			{
				t: 0,
				d: {
					"^RightUpLeg$": [
						.25,
						0,
						-.2
					],
					"^Spine$": [
						0,
						-.15,
						0
					],
					"^LeftArm$": [
						-.3,
						0,
						.4
					]
				}
			},
			{
				t: .22,
				d: {
					"^RightUpLeg$": [
						1.25,
						.2,
						.35
					],
					"^RightLeg$": [
						.2,
						0,
						0
					],
					"^Spine$": [
						-.12,
						.35,
						0
					],
					"^Head$": [
						0,
						.15,
						0
					]
				}
			},
			{
				t: .62,
				d: {
					"^RightUpLeg$": [
						0,
						0,
						0
					],
					"^Spine$": [
						0,
						0,
						0
					]
				}
			}
		], false),
		clipFromDeltas("hit_reaction", "hit_reaction", .4, rests, [
			{
				t: 0,
				d: {
					"^Spine$": [
						0,
						0,
						0
					],
					"^Head$": [
						0,
						0,
						0
					]
				}
			},
			{
				t: .12,
				d: {
					"^Spine$": [
						-.18,
						.2,
						0
					],
					"^Head$": [
						-.12,
						.22,
						0
					],
					"^LeftArm$": [
						-.25,
						0,
						.3
					],
					"^RightArm$": [
						-.25,
						0,
						-.3
					]
				}
			},
			{
				t: .4,
				d: {
					"^Spine$": [
						0,
						0,
						0
					],
					"^Head$": [
						0,
						0,
						0
					]
				}
			}
		], false),
		clipFromDeltas("walk_forward", "walk_forward", .7, rests, [
			{
				t: 0,
				d: {
					"^LeftUpLeg$": [
						.55,
						0,
						0
					],
					"^RightUpLeg$": [
						-.28,
						0,
						0
					],
					"^LeftArm$": [
						.25,
						0,
						0
					],
					"^RightArm$": [
						-.25,
						0,
						0
					],
					"^Spine$": [
						.04,
						.04,
						0
					]
				}
			},
			{
				t: .35,
				d: {
					"^LeftUpLeg$": [
						-.28,
						0,
						0
					],
					"^RightUpLeg$": [
						.55,
						0,
						0
					],
					"^LeftArm$": [
						-.25,
						0,
						0
					],
					"^RightArm$": [
						.25,
						0,
						0
					],
					"^Spine$": [
						.04,
						-.04,
						0
					]
				}
			},
			{
				t: .7,
				d: {
					"^LeftUpLeg$": [
						.55,
						0,
						0
					],
					"^RightUpLeg$": [
						-.28,
						0,
						0
					],
					"^LeftArm$": [
						.25,
						0,
						0
					],
					"^RightArm$": [
						-.25,
						0,
						0
					],
					"^Spine$": [
						.04,
						.04,
						0
					]
				}
			}
		]),
		clipFromDeltas("walk_back", "walk_back", .75, rests, [
			{
				t: 0,
				d: {
					"^LeftUpLeg$": [
						-.35,
						0,
						0
					],
					"^RightUpLeg$": [
						.22,
						0,
						0
					],
					"^Spine$": [
						-.04,
						0,
						0
					]
				}
			},
			{
				t: .375,
				d: {
					"^LeftUpLeg$": [
						.22,
						0,
						0
					],
					"^RightUpLeg$": [
						-.35,
						0,
						0
					],
					"^Spine$": [
						-.04,
						0,
						0
					]
				}
			},
			{
				t: .75,
				d: {
					"^LeftUpLeg$": [
						-.35,
						0,
						0
					],
					"^RightUpLeg$": [
						.22,
						0,
						0
					],
					"^Spine$": [
						-.04,
						0,
						0
					]
				}
			}
		]),
		clipFromDeltas("run", "run", .48, rests, [
			{
				t: 0,
				d: {
					"^LeftUpLeg$": [
						.75,
						0,
						0
					],
					"^RightUpLeg$": [
						-.4,
						0,
						0
					],
					"^LeftArm$": [
						.45,
						0,
						0
					],
					"^RightArm$": [
						-.45,
						0,
						0
					],
					"^Spine$": [
						.1,
						.06,
						0
					]
				}
			},
			{
				t: .24,
				d: {
					"^LeftUpLeg$": [
						-.4,
						0,
						0
					],
					"^RightUpLeg$": [
						.75,
						0,
						0
					],
					"^LeftArm$": [
						-.45,
						0,
						0
					],
					"^RightArm$": [
						.45,
						0,
						0
					],
					"^Spine$": [
						.1,
						-.06,
						0
					]
				}
			},
			{
				t: .48,
				d: {
					"^LeftUpLeg$": [
						.75,
						0,
						0
					],
					"^RightUpLeg$": [
						-.4,
						0,
						0
					],
					"^LeftArm$": [
						.45,
						0,
						0
					],
					"^RightArm$": [
						-.45,
						0,
						0
					],
					"^Spine$": [
						.1,
						.06,
						0
					]
				}
			}
		]),
		clipFromDeltas("dash_forward", "dash_forward", .4, rests, [
			{
				t: 0,
				d: {
					"^LeftUpLeg$": [
						.85,
						0,
						0
					],
					"^RightUpLeg$": [
						-.3,
						0,
						0
					],
					"^Spine$": [
						.15,
						0,
						0
					],
					"^RightArm$": [
						-.4,
						0,
						-.4
					]
				}
			},
			{
				t: .2,
				d: {
					"^LeftUpLeg$": [
						-.3,
						0,
						0
					],
					"^RightUpLeg$": [
						.85,
						0,
						0
					],
					"^Spine$": [
						.15,
						0,
						0
					],
					"^LeftArm$": [
						-.4,
						0,
						.4
					]
				}
			},
			{
				t: .4,
				d: {
					"^LeftUpLeg$": [
						.85,
						0,
						0
					],
					"^RightUpLeg$": [
						-.3,
						0,
						0
					],
					"^Spine$": [
						.15,
						0,
						0
					]
				}
			}
		]),
		clipFromDeltas("strafe_left", "strafe_left", .7, rests, [
			{
				t: 0,
				d: {
					"^LeftUpLeg$": [
						.2,
						0,
						.4
					],
					"^RightUpLeg$": [
						-.12,
						0,
						-.25
					],
					"^Spine$": [
						0,
						0,
						.08
					]
				}
			},
			{
				t: .35,
				d: {
					"^LeftUpLeg$": [
						-.12,
						0,
						-.25
					],
					"^RightUpLeg$": [
						.2,
						0,
						.4
					],
					"^Spine$": [
						0,
						0,
						-.08
					]
				}
			},
			{
				t: .7,
				d: {
					"^LeftUpLeg$": [
						.2,
						0,
						.4
					],
					"^RightUpLeg$": [
						-.12,
						0,
						-.25
					],
					"^Spine$": [
						0,
						0,
						.08
					]
				}
			}
		]),
		clipFromDeltas("strafe_right", "strafe_right", .7, rests, [
			{
				t: 0,
				d: {
					"^LeftUpLeg$": [
						.2,
						0,
						-.4
					],
					"^RightUpLeg$": [
						-.12,
						0,
						.25
					],
					"^Spine$": [
						0,
						0,
						-.08
					]
				}
			},
			{
				t: .35,
				d: {
					"^LeftUpLeg$": [
						-.12,
						0,
						.25
					],
					"^RightUpLeg$": [
						.2,
						0,
						-.4
					],
					"^Spine$": [
						0,
						0,
						.08
					]
				}
			},
			{
				t: .7,
				d: {
					"^LeftUpLeg$": [
						.2,
						0,
						-.4
					],
					"^RightUpLeg$": [
						-.12,
						0,
						.25
					],
					"^Spine$": [
						0,
						0,
						-.08
					]
				}
			}
		]),
		clipFromDeltas("knockdown", "knockdown", .7, rests, [
			{
				t: 0,
				d: { "^Spine$": [
					0,
					0,
					0
				] }
			},
			{
				t: .35,
				d: {
					"^Spine$": [
						.55,
						0,
						0
					],
					"^Head$": [
						.3,
						0,
						0
					],
					"^LeftUpLeg$": [
						.4,
						0,
						0
					],
					"^RightUpLeg$": [
						.4,
						0,
						0
					]
				}
			},
			{
				t: .7,
				d: {
					"^Spine$": [
						.7,
						0,
						0
					],
					"^Head$": [
						.35,
						0,
						0
					],
					"^LeftUpLeg$": [
						.5,
						0,
						0
					],
					"^RightUpLeg$": [
						.5,
						0,
						0
					]
				}
			}
		], false),
		clipFromDeltas("crouch", "crouch", 1.2, rests, [{
			t: 0,
			d: {
				"^LeftUpLeg$": [
					.7,
					0,
					0
				],
				"^RightUpLeg$": [
					.7,
					0,
					0
				],
				"^Spine$": [
					.18,
					0,
					0
				],
				"^LeftArm$": [
					-.25,
					0,
					.3
				],
				"^RightArm$": [
					-.25,
					0,
					-.3
				]
			}
		}, {
			t: 1.2,
			d: {
				"^LeftUpLeg$": [
					.7,
					0,
					0
				],
				"^RightUpLeg$": [
					.7,
					0,
					0
				],
				"^Spine$": [
					.18,
					0,
					0
				],
				"^LeftArm$": [
					-.25,
					0,
					.3
				],
				"^RightArm$": [
					-.25,
					0,
					-.3
				]
			}
		}]),
		clipFromDeltas("getup", "getup", .6, rests, [{
			t: 0,
			d: {
				"^Spine$": [
					.5,
					0,
					0
				],
				"^LeftUpLeg$": [
					.4,
					0,
					0
				],
				"^RightUpLeg$": [
					.4,
					0,
					0
				]
			}
		}, {
			t: .6,
			d: { "^Spine$": [
				0,
				0,
				0
			] }
		}], false),
		clipFromDeltas("jump", "jump", .55, rests, [
			{
				t: 0,
				d: {
					"^LeftUpLeg$": [
						.25,
						0,
						0
					],
					"^RightUpLeg$": [
						.25,
						0,
						0
					],
					"^Spine$": [
						-.1,
						0,
						0
					]
				}
			},
			{
				t: .18,
				d: {
					"^LeftUpLeg$": [
						.85,
						0,
						0
					],
					"^RightUpLeg$": [
						.85,
						0,
						0
					],
					"^Spine$": [
						-.28,
						0,
						0
					],
					"^LeftArm$": [
						-.55,
						0,
						.45
					],
					"^RightArm$": [
						-.55,
						0,
						-.45
					]
				}
			},
			{
				t: .55,
				d: {
					"^LeftUpLeg$": [
						.15,
						0,
						0
					],
					"^RightUpLeg$": [
						.15,
						0,
						0
					],
					"^Spine$": [
						0,
						0,
						0
					]
				}
			}
		], false)
	];
}
function fillBindRelativeGaps(root, existing) {
	const have = /* @__PURE__ */ new Set();
	for (const clip of existing) {
		const sem = String(clip.userData?.semanticState ?? "");
		if (sem) have.add(sem);
	}
	const out = [...existing];
	for (const clip of buildBindRelativeClips(root)) {
		const sem = String(clip.userData?.semanticState ?? "");
		if (sem && have.has(sem)) continue;
		out.push(clip);
		if (sem) have.add(sem);
	}
	return out;
}
var _qSrc = new Quaternion();
var _qRest = new Quaternion();
var _qInv = new Quaternion();
var _qOut = new Quaternion();
function collectRestMap(root) {
	const map = /* @__PURE__ */ new Map();
	root.traverse((obj) => {
		if (!obj.isBone || !obj.name || map.has(obj.name)) return;
		map.set(obj.name, obj.quaternion.clone());
	});
	return map;
}
/**
* Replay a Mixamo/Euler clip as motion on the LIVE bind:
*   q(t) = q_bind * q_src(0)^-1 * q_src(t)
* t=0 stays on the planted pose (hunched Cipher stays hunched).
* Drop non-quaternion tracks — hip translation is instance-owned.
*/
function makeClipBindRelative(clip, restMap) {
	const tracks = [];
	for (const track of clip.tracks) {
		if (!track.name.endsWith(".quaternion")) continue;
		const bone = track.name.slice(0, track.name.length - 11);
		const bind = restMap.get(bone);
		if (!bind) continue;
		const values = track.values;
		if (values.length < 4) continue;
		_qRest.set(values[0], values[1], values[2], values[3]).normalize();
		if (_qRest.lengthSq() < 1e-8) continue;
		_qInv.copy(_qRest).invert();
		const out = new Float32Array(values.length);
		for (let i = 0; i + 3 < values.length; i += 4) {
			_qSrc.set(values[i], values[i + 1], values[i + 2], values[i + 3]).normalize();
			_qOut.copy(bind).multiply(_qInv).multiply(_qSrc);
			out[i] = _qOut.x;
			out[i + 1] = _qOut.y;
			out[i + 2] = _qOut.z;
			out[i + 3] = _qOut.w;
		}
		tracks.push(new QuaternionKeyframeTrack(track.name, Array.from(track.times), out));
	}
	if (tracks.length === 0) return null;
	const converted = new AnimationClip(clip.name, clip.duration, tracks);
	converted.userData = {
		...clip.userData ?? {},
		clipSourceType: "BIND_RELATIVE_BANK"
	};
	return converted;
}
/**
* AnimationRetargeter.ts
* ─────────────────────────────────────────────────────────────────────────────
* Deterministic animation retargeter that maps source animation bone names
* (Mixamo, mocap, FBX, BVH conventions) to canonical Bannon skeleton bones
* via name-based resolution — NOT UUID binding.
*
* CANONICAL BONE SET (Bannon skeleton):
*   Hips, Spine, Chest, Neck, Head,
*   LUpperArm, LForeArm, LHand,
*   RUpperArm, RForeArm, RHand,
*   LUpperLeg, LLowerLeg, LFoot,
*   RUpperLeg, RLowerLeg, RFoot
*
* ALIAS SOURCES SUPPORTED:
*   • Mixamo (mixamorigHips, mixamorigSpine, etc.)
*   • Bannon canonical names
*   • Common FBX conventions (Bip001_Pelvis, Bip01_Spine, etc.)
*   • BVH conventions (hip, abdomen, chest, etc.)
*   • Bannon mocap naming (from tools/mocap/)
*   • Schwarzerblitz naming conventions
*
* IDENTITY: SOURCE BONE NAME → canonical semantic name → TARGET SKELETON BONE
* UUIDs are NEVER used as cross-file identity — names are stable, UUIDs change
* every time a scene is cloned.
*
* Every mapping is measurable and reported:
*   source bone | canonical bone | target bone | resolved/unresolved
* ─────────────────────────────────────────────────────────────────────────────
*/
function isRootBoneName(sourceName, targetName) {
	return [sourceName, targetName].map((n) => n.replace(/^mixamorig:?/i, "").toLowerCase()).some((n) => n === "hips" || n === "hip" || n === "pelvis" || n === "root" || n === "armature");
}
var CANONICAL_BONES = [
	"Hips",
	"Spine",
	"Chest",
	"Neck",
	"Head",
	"LUpperArm",
	"LForeArm",
	"LHand",
	"RUpperArm",
	"RForeArm",
	"RHand",
	"LUpperLeg",
	"LLowerLeg",
	"LFoot",
	"RUpperLeg",
	"RLowerLeg",
	"RFoot"
];
var BONE_ALIAS_TABLE = {
	"Hips": "Hips",
	"hips": "Hips",
	"Hip": "Hips",
	"hip": "Hips",
	"Pelvis": "Hips",
	"pelvis": "Hips",
	"mixamorigHips": "Hips",
	"Bip001_Pelvis": "Hips",
	"Bip01_Pelvis": "Hips",
	"Bip001 Pelvis": "Hips",
	"Bip01 Pelvis": "Hips",
	"ROOT": "Hips",
	"Root": "Hips",
	"root": "Hips",
	"HipNode": "Hips",
	"CharacterRoot": "Hips",
	"Skeleton_Root": "Hips",
	"Armature": "Hips",
	"armature": "Hips",
	"Bannon_Hips": "Hips",
	"bannon_hips": "Hips",
	"Spine": "Spine",
	"spine": "Spine",
	"Spine1": "Spine",
	"spine1": "Spine",
	"Abdomen": "Spine",
	"abdomen": "Spine",
	"mixamorigSpine": "Spine",
	"mixamorigSpine1": "Spine",
	"Bip001_Spine": "Spine",
	"Bip01_Spine": "Spine",
	"Bip001 Spine": "Spine",
	"Bip01 Spine": "Spine",
	"LowerBack": "Spine",
	"lowerback": "Spine",
	"Bannon_Spine": "Spine",
	"Chest": "Chest",
	"chest": "Chest",
	"Spine2": "Chest",
	"spine2": "Chest",
	"Spine3": "Chest",
	"spine3": "Chest",
	"UpperBack": "Chest",
	"upperback": "Chest",
	"Torso": "Chest",
	"torso": "Chest",
	"mixamorigSpine2": "Chest",
	"mixamorigChest": "Chest",
	"Bip001_Spine1": "Chest",
	"Bip01_Spine1": "Chest",
	"Bip001 Spine1": "Chest",
	"Bip01 Spine1": "Chest",
	"Bip001_Spine2": "Chest",
	"Bip01_Spine2": "Chest",
	"Bannon_Chest": "Chest",
	"Neck": "Neck",
	"neck": "Neck",
	"Neck1": "Neck",
	"neck1": "Neck",
	"mixamorigNeck": "Neck",
	"mixamorigNeck1": "Neck",
	"Bip001_Neck": "Neck",
	"Bip01_Neck": "Neck",
	"Bip001 Neck": "Neck",
	"Bip01 Neck": "Neck",
	"Bannon_Neck": "Neck",
	"Head": "Head",
	"head": "Head",
	"Head1": "Head",
	"mixamorigHead": "Head",
	"Bip001_Head": "Head",
	"Bip01_Head": "Head",
	"Bip001 Head": "Head",
	"Bip01 Head": "Head",
	"Skull": "Head",
	"skull": "Head",
	"Bannon_Head": "Head",
	"LUpperArm": "LUpperArm",
	"LeftUpperArm": "LUpperArm",
	"leftUpperArm": "LUpperArm",
	"LeftArm": "LUpperArm",
	"leftArm": "LUpperArm",
	"Left_Arm": "LUpperArm",
	"L_Arm": "LUpperArm",
	"mixamorigLeftArm": "LUpperArm",
	"Bip001_L_UpperArm": "LUpperArm",
	"Bip01_L_UpperArm": "LUpperArm",
	"Bip001 L UpperArm": "LUpperArm",
	"Bip01 L UpperArm": "LUpperArm",
	"LeftShoulder": "LUpperArm",
	"leftShoulder": "LUpperArm",
	"mixamorigLeftShoulder": "LUpperArm",
	"Bannon_LUpperArm": "LUpperArm",
	"Arm_L": "LUpperArm",
	"arm_l": "LUpperArm",
	"LForeArm": "LForeArm",
	"LeftForeArm": "LForeArm",
	"leftForeArm": "LForeArm",
	"LeftForearm": "LForeArm",
	"Left_ForeArm": "LForeArm",
	"L_ForeArm": "LForeArm",
	"mixamorigLeftForeArm": "LForeArm",
	"Bip001_L_Forearm": "LForeArm",
	"Bip01_L_Forearm": "LForeArm",
	"Bip001 L Forearm": "LForeArm",
	"Bip01 L Forearm": "LForeArm",
	"Bannon_LForeArm": "LForeArm",
	"ForeArm_L": "LForeArm",
	"forearm_l": "LForeArm",
	"LHand": "LHand",
	"LeftHand": "LHand",
	"leftHand": "LHand",
	"Left_Hand": "LHand",
	"L_Hand": "LHand",
	"mixamorigLeftHand": "LHand",
	"Bip001_L_Hand": "LHand",
	"Bip01_L_Hand": "LHand",
	"Bip001 L Hand": "LHand",
	"Bip01 L Hand": "LHand",
	"Bannon_LHand": "LHand",
	"Hand_L": "LHand",
	"hand_l": "LHand",
	"RUpperArm": "RUpperArm",
	"RightUpperArm": "RUpperArm",
	"rightUpperArm": "RUpperArm",
	"RightArm": "RUpperArm",
	"rightArm": "RUpperArm",
	"Right_Arm": "RUpperArm",
	"R_Arm": "RUpperArm",
	"mixamorigRightArm": "RUpperArm",
	"Bip001_R_UpperArm": "RUpperArm",
	"Bip01_R_UpperArm": "RUpperArm",
	"Bip001 R UpperArm": "RUpperArm",
	"Bip01 R UpperArm": "RUpperArm",
	"RightShoulder": "RUpperArm",
	"rightShoulder": "RUpperArm",
	"mixamorigRightShoulder": "RUpperArm",
	"Bannon_RUpperArm": "RUpperArm",
	"Arm_R": "RUpperArm",
	"arm_r": "RUpperArm",
	"RForeArm": "RForeArm",
	"RightForeArm": "RForeArm",
	"rightForeArm": "RForeArm",
	"RightForearm": "RForeArm",
	"Right_ForeArm": "RForeArm",
	"R_ForeArm": "RForeArm",
	"mixamorigRightForeArm": "RForeArm",
	"Bip001_R_Forearm": "RForeArm",
	"Bip01_R_Forearm": "RForeArm",
	"Bip001 R Forearm": "RForeArm",
	"Bip01 R Forearm": "RForeArm",
	"Bannon_RForeArm": "RForeArm",
	"ForeArm_R": "RForeArm",
	"forearm_r": "RForeArm",
	"RHand": "RHand",
	"RightHand": "RHand",
	"rightHand": "RHand",
	"Right_Hand": "RHand",
	"R_Hand": "RHand",
	"mixamorigRightHand": "RHand",
	"Bip001_R_Hand": "RHand",
	"Bip01_R_Hand": "RHand",
	"Bip001 R Hand": "RHand",
	"Bip01 R Hand": "RHand",
	"Bannon_RHand": "RHand",
	"Hand_R": "RHand",
	"hand_r": "RHand",
	"LUpperLeg": "LUpperLeg",
	"LeftUpperLeg": "LUpperLeg",
	"leftUpperLeg": "LUpperLeg",
	"LeftLeg": "LUpperLeg",
	"leftLeg": "LUpperLeg",
	"Left_Leg": "LUpperLeg",
	"L_Leg": "LUpperLeg",
	"LeftUpLeg": "LUpperLeg",
	"leftUpLeg": "LUpperLeg",
	"mixamorigLeftUpLeg": "LUpperLeg",
	"Bip001_L_Thigh": "LUpperLeg",
	"Bip01_L_Thigh": "LUpperLeg",
	"Bip001 L Thigh": "LUpperLeg",
	"Bip01 L Thigh": "LUpperLeg",
	"LeftThigh": "LUpperLeg",
	"leftThigh": "LUpperLeg",
	"Bannon_LUpperLeg": "LUpperLeg",
	"UpLeg_L": "LUpperLeg",
	"uplleg_l": "LUpperLeg",
	"LLowerLeg": "LLowerLeg",
	"LeftLowerLeg": "LLowerLeg",
	"leftLowerLeg": "LLowerLeg",
	"LeftShin": "LLowerLeg",
	"leftShin": "LLowerLeg",
	"Left_Shin": "LLowerLeg",
	"mixamorigLeftLeg": "LLowerLeg",
	"Bip001_L_Calf": "LLowerLeg",
	"Bip01_L_Calf": "LLowerLeg",
	"Bip001 L Calf": "LLowerLeg",
	"Bip01 L Calf": "LLowerLeg",
	"LeftCalf": "LLowerLeg",
	"leftCalf": "LLowerLeg",
	"Bannon_LLowerLeg": "LLowerLeg",
	"Leg_L": "LLowerLeg",
	"leg_l": "LLowerLeg",
	"LFoot": "LFoot",
	"LeftFoot": "LFoot",
	"leftFoot": "LFoot",
	"Left_Foot": "LFoot",
	"L_Foot": "LFoot",
	"mixamorigLeftFoot": "LFoot",
	"Bip001_L_Foot": "LFoot",
	"Bip01_L_Foot": "LFoot",
	"Bip001 L Foot": "LFoot",
	"Bip01 L Foot": "LFoot",
	"Bannon_LFoot": "LFoot",
	"Foot_L": "LFoot",
	"foot_l": "LFoot",
	"RUpperLeg": "RUpperLeg",
	"RightUpperLeg": "RUpperLeg",
	"rightUpperLeg": "RUpperLeg",
	"RightLeg": "RUpperLeg",
	"rightLeg": "RUpperLeg",
	"Right_Leg": "RUpperLeg",
	"R_Leg": "RUpperLeg",
	"RightUpLeg": "RUpperLeg",
	"rightUpLeg": "RUpperLeg",
	"mixamorigRightUpLeg": "RUpperLeg",
	"Bip001_R_Thigh": "RUpperLeg",
	"Bip01_R_Thigh": "RUpperLeg",
	"Bip001 R Thigh": "RUpperLeg",
	"Bip01 R Thigh": "RUpperLeg",
	"RightThigh": "RUpperLeg",
	"rightThigh": "RUpperLeg",
	"Bannon_RUpperLeg": "RUpperLeg",
	"UpLeg_R": "RUpperLeg",
	"upleg_r": "RUpperLeg",
	"RLowerLeg": "RLowerLeg",
	"RightLowerLeg": "RLowerLeg",
	"rightLowerLeg": "RLowerLeg",
	"RightShin": "RLowerLeg",
	"rightShin": "RLowerLeg",
	"Right_Shin": "RLowerLeg",
	"mixamorigRightLeg": "RLowerLeg",
	"Bip001_R_Calf": "RLowerLeg",
	"Bip01_R_Calf": "RLowerLeg",
	"Bip001 R Calf": "RLowerLeg",
	"Bip01 R Calf": "RLowerLeg",
	"RightCalf": "RLowerLeg",
	"rightCalf": "RLowerLeg",
	"Bannon_RLowerLeg": "RLowerLeg",
	"Leg_R": "RLowerLeg",
	"leg_r": "RLowerLeg",
	"RFoot": "RFoot",
	"RightFoot": "RFoot",
	"rightFoot": "RFoot",
	"Right_Foot": "RFoot",
	"R_Foot": "RFoot",
	"mixamorigRightFoot": "RFoot",
	"Bip001_R_Foot": "RFoot",
	"Bip01_R_Foot": "RFoot",
	"Bip001 R Foot": "RFoot",
	"Bip01 R Foot": "RFoot",
	"Bannon_RFoot": "RFoot",
	"Foot_R": "RFoot",
	"foot_r": "RFoot"
};
var AnimationRetargeter = class {
	sourceName;
	targetName;
	/** source bone name → canonical bone */
	sourceToCanonical = /* @__PURE__ */ new Map();
	/** canonical bone → target bone name */
	canonicalToTarget = /* @__PURE__ */ new Map();
	/** source bone name → target bone name (resolved shortcut) */
	sourceToTarget = /* @__PURE__ */ new Map();
	constructor(sourceName, targetName) {
		this.sourceName = sourceName;
		this.targetName = targetName;
	}
	/**
	* Build the retarget map from source skeleton → target skeleton.
	* Uses canonical bone names as the stable intermediate identity.
	* NEVER uses UUIDs.
	*
	* @param sourceRoot  Root of the source skeleton (animation source)
	* @param targetRoot  Root of the target skeleton (the visible clone)
	* @returns RetargetReport with full mapping details
	*/
	buildMap(sourceRoot, targetRoot) {
		this.sourceToCanonical.clear();
		this.canonicalToTarget.clear();
		this.sourceToTarget.clear();
		const sourceBoneNames = [];
		sourceRoot.traverse((child) => {
			if (child.isBone && child.name) sourceBoneNames.push(child.name);
		});
		const targetBoneNames = [];
		targetRoot.traverse((child) => {
			if (child.isBone && child.name) targetBoneNames.push(child.name);
		});
		for (const srcName of sourceBoneNames) {
			const canonical = this._resolveToCanonical(srcName);
			if (canonical) this.sourceToCanonical.set(srcName, canonical);
		}
		for (const tgtName of targetBoneNames) {
			const canonical = this._resolveToCanonical(tgtName);
			if (canonical && !this.canonicalToTarget.has(canonical)) this.canonicalToTarget.set(canonical, tgtName);
		}
		const unmappedSourceBones = [];
		for (const srcName of sourceBoneNames) {
			const canonical = this.sourceToCanonical.get(srcName);
			if (canonical) {
				const tgtName = this.canonicalToTarget.get(canonical);
				if (tgtName) this.sourceToTarget.set(srcName, tgtName);
				else unmappedSourceBones.push(srcName);
			} else unmappedSourceBones.push(srcName);
		}
		const missingRequiredTargetBones = [];
		for (const canonical of CANONICAL_BONES) if (!this.canonicalToTarget.has(canonical)) missingRequiredTargetBones.push(canonical);
		const entries = sourceBoneNames.map((srcName) => {
			const canonical = this.sourceToCanonical.get(srcName) ?? null;
			const targetBone = canonical ? this.canonicalToTarget.get(canonical) ?? null : null;
			return {
				sourceBone: srcName,
				canonicalBone: canonical,
				targetBone,
				resolved: targetBone !== null
			};
		});
		const mappedBones = entries.filter((e) => e.resolved).length;
		const verdict = mappedBones === 0 ? "FAIL" : missingRequiredTargetBones.length > 0 ? "PARTIAL" : "PASS";
		const report = {
			sourceName: this.sourceName,
			targetName: this.targetName,
			totalSourceBones: sourceBoneNames.length,
			totalTargetBones: targetBoneNames.length,
			mappedBones,
			unmappedSourceBones,
			missingRequiredTargetBones,
			entries,
			resolvedTrackCount: 0,
			unresolvedTrackCount: 0,
			verdict
		};
		this._logReport(report);
		return report;
	}
	/**
	* Retarget an AnimationClip from source skeleton naming to target skeleton naming.
	* Rewrites track names: source bone name → target bone name.
	* Tracks that cannot be resolved are dropped and reported.
	*
	* @param clip  Source AnimationClip
	* @returns RetargetedClipResult with the new clip and resolution counts
	*/
	retargetClip(clip) {
		const retargetedTracks = [];
		let resolvedTracks = 0;
		let unresolvedTracks = 0;
		const unresolvedTrackNames = [];
		for (const track of clip.tracks) {
			const rawName = track.name;
			const dotIdx = rawName.lastIndexOf(".");
			const withoutProp = dotIdx !== -1 ? rawName.slice(0, dotIdx) : rawName;
			const property = dotIdx !== -1 ? rawName.slice(dotIdx + 1) : "";
			const pipeIdx = withoutProp.lastIndexOf("|");
			const sourceBoneName = pipeIdx !== -1 ? withoutProp.slice(pipeIdx + 1) : withoutProp;
			const targetBoneName = this.sourceToTarget.get(sourceBoneName);
			if (targetBoneName && property) {
				const newTrackName = `${targetBoneName}.${property}`;
				const RetargetedTrack = track.constructor;
				retargetedTracks.push(new RetargetedTrack(newTrackName, track.times, track.values, track.getInterpolation()));
				resolvedTracks++;
			} else {
				unresolvedTracks++;
				unresolvedTrackNames.push(`${clip.name}::${sourceBoneName}`);
			}
		}
		return {
			clip: new AnimationClip(clip.name, clip.duration, retargetedTracks),
			resolvedTracks,
			unresolvedTracks,
			unresolvedTrackNames
		};
	}
	/**
	* Retarget an array of AnimationClips and log full instrumentation.
	* Returns retargeted clips with per-clip and aggregate resolution counts.
	*/
	retargetClips(clips, label = "") {
		const retargetedClips = [];
		let totalResolved = 0;
		let totalUnresolved = 0;
		console.log(`\n[AnimationRetargeter] ── Retargeting ${clips.length} clip(s) ${label ? `[${label}]` : ""}`);
		for (const clip of clips) {
			const result = this.retargetClip(clip);
			retargetedClips.push(result.clip);
			totalResolved += result.resolvedTracks;
			totalUnresolved += result.unresolvedTracks;
			if (result.unresolvedTracks > 0 && totalUnresolved === result.unresolvedTracks) console.warn(`[AnimationRetargeter] ⚠️  Clip "${clip.name}": ${result.resolvedTracks} resolved / ${result.unresolvedTracks} unresolved`);
		}
		console.log(`[AnimationRetargeter] ── Summary: ${totalResolved} resolved / ${totalUnresolved} unresolved across ${clips.length} clip(s)`);
		return {
			clips: retargetedClips,
			totalResolved,
			totalUnresolved
		};
	}
	/**
	* Resolve a bone name to its canonical form using the alias table.
	* Falls back to normalized comparison if exact match not found.
	*/
	_resolveToCanonical(boneName) {
		if (BONE_ALIAS_TABLE[boneName]) return BONE_ALIAS_TABLE[boneName];
		const lower = boneName.toLowerCase();
		for (const [alias, canonical] of Object.entries(BONE_ALIAS_TABLE)) if (alias.toLowerCase() === lower) return canonical;
		const normalized = boneName.toLowerCase().replace(/mixamorig[:._-]?/g, "").replace(/[^a-z0-9]/g, "");
		for (const [alias, canonical] of Object.entries(BONE_ALIAS_TABLE)) if (alias.toLowerCase().replace(/mixamorig[:._-]?/g, "").replace(/[^a-z0-9]/g, "") === normalized) return canonical;
		return null;
	}
	_logReport(report) {
		const line = "─".repeat(60);
		console.log(`\n${line}`);
		console.log(`ANIMATION RETARGET MAP — ${report.sourceName} → ${report.targetName}`);
		console.log(line);
		console.log(`  Source bones:   ${report.totalSourceBones}`);
		console.log(`  Target bones:   ${report.totalTargetBones}`);
		console.log(`  Mapped:         ${report.mappedBones}`);
		console.log(`  Unmapped src:   ${report.unmappedSourceBones.length}`);
		console.log(`  Missing req:    ${report.missingRequiredTargetBones.length}`);
		console.log(`  Verdict:        ${report.verdict}`);
		if (report.unmappedSourceBones.length > 0) console.warn(`[AnimationRetargeter] ⚠️  Unmapped source bones (${report.unmappedSourceBones.length}): ` + report.unmappedSourceBones.slice(0, 10).join(", ") + (report.unmappedSourceBones.length > 10 ? ` +${report.unmappedSourceBones.length - 10} more` : ""));
		if (report.missingRequiredTargetBones.length > 0) console.warn(`[AnimationRetargeter] ⚠️  Missing required target bones: ` + report.missingRequiredTargetBones.join(", "));
		if (report.unmappedSourceBones.length > 0) console.log(`  unmapped ${report.unmappedSourceBones.length} / mapped ${report.mappedBones}`);
		console.log(line);
	}
};
/**
* Resolve a single bone name to its canonical Bannon skeleton name.
* Returns null if the bone name is not recognized.
*/
function resolveToCanonicalBone(boneName) {
	if (BONE_ALIAS_TABLE[boneName]) return BONE_ALIAS_TABLE[boneName];
	const lower = boneName.toLowerCase();
	for (const [alias, canonical] of Object.entries(BONE_ALIAS_TABLE)) if (alias.toLowerCase() === lower) return canonical;
	const normalized = boneName.toLowerCase().replace(/mixamorig[:._-]?/g, "").replace(/[^a-z0-9]/g, "");
	for (const [alias, canonical] of Object.entries(BONE_ALIAS_TABLE)) if (alias.toLowerCase().replace(/mixamorig[:._-]?/g, "").replace(/[^a-z0-9]/g, "") === normalized) return canonical;
	return null;
}
/** Mixamo FBX (`mixamorigHips`) and Bannon skinned GLBs (`mixamorig:Hips`) are the same bone. */
function mixamoBindKey(boneName) {
	return boneName.toLowerCase().replace(/^mixamorig[:._-]*/, "mixamorig");
}
/**
* Bind a clip's tracks to an actual target skeleton's bone names.
*
* Policy:
*   1. Exact target bone name match wins.
*   2. Mixamo colon-insensitive match (`mixamorigHips` ↔ `mixamorig:Hips`).
*   3. Else canonical alias match (mixamorigHips → Hips, etc.).
*   4. Else the track is UNRESOLVED — never rewritten onto a fake bone.
*/
function bindClipTracksToTargetBones(clip, targetBoneNames) {
	const exact = new Set(targetBoneNames);
	const mixamoExact = /* @__PURE__ */ new Map();
	const canonicalToTarget = /* @__PURE__ */ new Map();
	for (const name of targetBoneNames) {
		mixamoExact.set(mixamoBindKey(name), name);
		const canonical = resolveToCanonicalBone(name);
		if (canonical && !canonicalToTarget.has(canonical)) canonicalToTarget.set(canonical, name);
	}
	const retargetedTracks = [];
	const unresolvedTrackNames = [];
	let resolvedTracks = 0;
	let unresolvedTracks = 0;
	for (const track of clip.tracks) {
		const rawName = track.name;
		const dotIdx = rawName.lastIndexOf(".");
		const withoutProp = dotIdx !== -1 ? rawName.slice(0, dotIdx) : rawName;
		const property = dotIdx !== -1 ? rawName.slice(dotIdx + 1) : "";
		const pipeIdx = withoutProp.lastIndexOf("|");
		const sourceBoneName = pipeIdx !== -1 ? withoutProp.slice(pipeIdx + 1) : withoutProp;
		let targetBoneName = null;
		if (exact.has(sourceBoneName)) targetBoneName = sourceBoneName;
		else if (mixamoExact.has(mixamoBindKey(sourceBoneName))) targetBoneName = mixamoExact.get(mixamoBindKey(sourceBoneName)) ?? null;
		else {
			const canonical = resolveToCanonicalBone(sourceBoneName);
			targetBoneName = canonical ? canonicalToTarget.get(canonical) ?? null : null;
		}
		if (targetBoneName && property) {
			if (property === "position" && isRootBoneName(sourceBoneName, targetBoneName)) {
				unresolvedTracks++;
				continue;
			}
			const newTrackName = `${targetBoneName}.${property}`;
			const TrackCtor = track.constructor;
			retargetedTracks.push(new TrackCtor(newTrackName, track.times, track.values, track.getInterpolation()));
			resolvedTracks++;
		} else {
			unresolvedTracks++;
			unresolvedTrackNames.push(`${clip.name}::${sourceBoneName}${property ? "." + property : ""}`);
		}
	}
	const retargetedClip = new AnimationClip(clip.name, clip.duration, retargetedTracks);
	retargetedClip.userData = {
		...clip.userData ?? {},
		clipSourceType: resolvedTracks > 0 ? "RETARGETED_AUTHORED_CLIP" : "MISSING_CLIP",
		resolvedTracks,
		unresolvedTracks,
		unresolvedTrackNames
	};
	return {
		clip: retargetedClip,
		resolvedTracks,
		unresolvedTracks,
		unresolvedTrackNames
	};
}
/**
* SemanticStateAliases.ts
* Canonical semantic state alias tables shared between CharacterPipeline,
* AnimationBridge, and FighterMesh.
*/
var SEMANTIC_STATE_ALIASES = {
	idle: [
		"idle",
		"Idle",
		"IDLE",
		"BOX_IDLE",
		"STANCE_BLADED",
		"STANCE_WIDE",
		"DRUNK_IDLE_VARIATION",
		"ACTION_IDLE_TO_STANDING_IDLE",
		"neutral",
		"Neutral",
		"standing",
		"Standing",
		"stance",
		"Stance",
		"combatIdle",
		"CombatIdle",
		"idle_procedural_placeholder"
	],
	walk_forward: [
		"walk_forward",
		"walk",
		"Walk",
		"DWARF_WALK",
		"DRUNK_WALK",
		"GINGA_FORWARD",
		"LOCO_STRUT",
		"LOCO_LIGHT",
		"DRUNK_RUN_FORWARD",
		"walkForward",
		"WalkForward",
		"walking",
		"Walking",
		"walk_fwd",
		"SBW_walk_fwd",
		"walk_forward_procedural_placeholder"
	],
	walk_back: [
		"walk_back",
		"walkBack",
		"WalkBack",
		"GINGA_BACKWARD",
		"INJURED_RUN_BACKWARDS_RIGHT_TURN",
		"walkBackward",
		"WalkBackward",
		"walk_bwd",
		"SBW_walk_back",
		"walk_back_procedural_placeholder"
	],
	strafe_left: [
		"strafe_left",
		"strafeLeft",
		"StrafeLeft",
		"GINGA_SIDEWAYS_2",
		"LOCO_PROWL",
		"sidestepLeft",
		"SidestepLeft",
		"SBW_strafe_left",
		"sidestepUp"
	],
	strafe_right: [
		"strafe_right",
		"strafeRight",
		"StrafeRight",
		"CROUCH_TORCH_WALK_RIGHT",
		"INJURED_TURN_RIGHT",
		"sidestepRight",
		"SidestepRight",
		"SBW_strafe_right",
		"sidestepDown"
	],
	attack_1: [
		"attack_1",
		"lightAttack",
		"LightAttack",
		"BOXING",
		"BODY_JAB_CROSS",
		"BOXING__1_",
		"punch",
		"Punch",
		"jab",
		"Jab",
		"attack",
		"Attack",
		"LP",
		"T_1",
		"bf_jab",
		"attack_1_procedural_placeholder"
	],
	attack_rp: [
		"attack_rp",
		"heavyAttack",
		"HeavyAttack",
		"COMBO_PUNCH",
		"BOXING__2_",
		"BOXING__3_",
		"ILLEGAL_ELBOW_PUNCH",
		"ILLEGAL_ELBOW_PUNCH__1_",
		"BASEBALL_HIT",
		"cross",
		"Cross",
		"RP",
		"T_2",
		"bf_cross"
	],
	attack_2: [
		"attack_2",
		"HURRICANE_KICK",
		"DROP_KICK",
		"ILLEGAL_KNEE",
		"TIGER_FEINT_KICK",
		"BASH",
		"AU",
		"CAPOEIRA",
		"kick",
		"Kick",
		"bf_kick"
	],
	attack_lk: [
		"attack_lk",
		"lightKick",
		"LightKick",
		"DROP_KICK",
		"ILLEGAL_KNEE",
		"TIGER_FEINT_KICK",
		"LK",
		"T_3",
		"bf_lk"
	],
	attack_rk: [
		"attack_rk",
		"heavyKick",
		"HeavyKick",
		"HURRICANE_KICK",
		"AU",
		"CAPOEIRA",
		"BASH",
		"CROSS_JUMPS",
		"RK",
		"T_4",
		"bf_rk"
	],
	block: [
		"block",
		"guard",
		"Guard",
		"CENTER_BLOCK",
		"GUARD_HIGH",
		"GUARD_LOW",
		"DEFENDER",
		"ESQUIVA_4",
		"Block",
		"defend",
		"Defend",
		"SBW_guard",
		"T_guard",
		"block_procedural_placeholder"
	],
	hit_reaction: [
		"hit_reaction",
		"hit",
		"Hit",
		"HIT_REACTION",
		"HIT_TO_BODY",
		"HIT_TO_HEAD",
		"BIG_RIB_HIT",
		"HIT_ON_THE_BACK",
		"HIT_ON_SIDE_OF_HEAD",
		"BIG_BODY_BLOW",
		"hurt",
		"Hurt",
		"flinch",
		"Flinch",
		"hitstun",
		"Hitstun",
		"SBW_hit",
		"T_hit",
		"hit_reaction_procedural_placeholder"
	],
	knockdown: [
		"knockdown",
		"Knockdown",
		"FALLING_FLAT_IMPACT",
		"FALLING_FORWARD_DEATH",
		"DEFEAT",
		"DYING_BACKWARDS",
		"ko",
		"KO",
		"fall",
		"Fall",
		"SBW_knockdown",
		"T_knockdown",
		"knockdown_procedural_placeholder"
	],
	getup: [
		"getup",
		"getUp",
		"GetUp",
		"KIP_UP",
		"CORKSCREW_KIP_UP",
		"CORKSCREW_EVADE",
		"quickStand",
		"QuickStand",
		"gettingUp",
		"GettingUp",
		"T_quickstand",
		"getup_procedural_placeholder"
	],
	grapple: [
		"grapple",
		"grab",
		"Grab",
		"SUPLEX",
		"GERMANSUPLEX",
		"DDT",
		"CHOKESLAM",
		"DOUBLE_LEG_TAKEDOWN___VICTIM",
		"throw",
		"Throw",
		"SBW_throw",
		"T_1_3"
	],
	crouch: [
		"crouch",
		"Crouch",
		"STANCE_CROUCH",
		"CROUCH_IDLE_02_LOOKING_AROUND",
		"CROUCH_WALK_FORWARD",
		"duck",
		"Duck",
		"SBW_crouch",
		"T_crouch"
	],
	run: [
		"run",
		"Run",
		"DRUNK_RUN_FORWARD",
		"LOCO_LIGHT",
		"running",
		"Running",
		"sprint",
		"Sprint"
	],
	dash_forward: [
		"dash_forward",
		"dashForward",
		"DashForward",
		"dash",
		"Dash",
		"DRUNK_RUN_FORWARD"
	],
	backdash: [
		"backdash",
		"Backdash",
		"backDash",
		"BackDash",
		"GINGA_BACKWARD",
		"SBW_backdash",
		"T_backdash",
		"Backdashing"
	],
	jump: [
		"jump",
		"Jump",
		"hop",
		"Hop",
		"CROSS_JUMPS",
		"jumpForward",
		"jumpBack"
	],
	victory: [
		"victory",
		"Victory",
		"win",
		"Win",
		"BREAKDANCE_READY",
		"STANCE_WIDE",
		"victoryPose",
		"VictoryPose"
	],
	defeat: [
		"defeat",
		"Defeat",
		"DEFEAT",
		"lose",
		"Lose",
		"knockdown",
		"Knockdown"
	],
	taunt: [
		"taunt",
		"Taunt",
		"TAUNT",
		"TAUNT_CALLOUT",
		"BREAKDANCE_READY",
		"CAPOEIRA",
		"idle",
		"Idle"
	]
};
var COMBAT_STATE_TO_SEMANTIC = {
	idle: "idle",
	Neutral: "idle",
	standing: "idle",
	walk: "walk_forward",
	walkForward: "walk_forward",
	Walking: "walk_forward",
	walkBackward: "walk_back",
	strafeLeft: "strafe_left",
	strafeRight: "strafe_right",
	sidestepLeft: "strafe_left",
	sidestepRight: "strafe_right",
	Backdashing: "backdash",
	run: "run",
	dash: "dash_forward",
	dashForward: "dash_forward",
	jump: "jump",
	jumpForward: "jump",
	jumpBack: "jump",
	Jumping: "jump",
	crouch: "crouch",
	crouchWalk: "walk_forward",
	lightAttack: "attack_1",
	light: "attack_1",
	Startup: "attack_1",
	Active: "attack_1",
	heavyAttack: "attack_rp",
	heavy: "attack_rp",
	lightKick: "attack_lk",
	heavyKick: "attack_rk",
	heatBurst: "attack_rk",
	rageArt: "attack_rk",
	powerCrush: "attack_rp",
	crouchLightAttack: "attack_1",
	crouchHeavyAttack: "attack_lk",
	jumpAttack: "attack_rk",
	runAttack: "attack_rp",
	CommandThrow: "grapple",
	ThrowWhiff: "idle",
	guard: "block",
	Guard: "block",
	block: "block",
	Blockstun: "block",
	guardLow: "block",
	hit: "hit_reaction",
	Hitstun: "hit_reaction",
	HitStun: "hit_reaction",
	Stunned: "hit_reaction",
	hitLow: "hit_reaction",
	hitHigh: "hit_reaction",
	knockdown: "knockdown",
	Knockdown: "knockdown",
	ko: "knockdown",
	KO: "knockdown",
	Crumple: "knockdown",
	WakeupTechRoll: "getup",
	WakeupBackrise: "getup",
	WakeupQuickStand: "getup",
	wake: "getup",
	victory: "victory",
	defeat: "knockdown",
	taunt: "taunt",
	intro: "idle"
};
function inferSemanticStateFromClipName(clipName) {
	const lower = clipName.toLowerCase();
	for (const [semanticState, aliases] of Object.entries(SEMANTIC_STATE_ALIASES)) if (aliases.some((a) => a.toLowerCase() === lower || lower === semanticState.toLowerCase())) return semanticState;
	return null;
}
/**
* UNIVERSAL CHARACTER PIPELINE
* ─────────────────────────────────────────────────────────────────────────────
* Single authoritative character-ingestion pipeline used by BOTH Character
* Select (CharacterPortrait3D) and Combat (FighterMesh / CombatArena3D).
*
* AUTHORED SKELETON LAW
* ─────────────────────
* The native GLB is authoritative. This pipeline NEVER:
*   • generates a replacement skeleton
*   • generates synthetic bones
*   • calculates replacement vertex weights
*   • rebinds native meshes
*   • replaces Skeleton objects
*   • modifies inverse-bind matrices
*   • rewrites skinIndex/skinWeight data
*   • reparents the authored skeleton
*   • moves bones to compensate for floor placement
*   • applies character-name-specific corrective bone offsets
*
* The pipeline MAY: CLONE, VALIDATE, ANIMATE, and TRANSFORM THE OUTER INSTANCE.
*
* UNIVERSALITY LAW
* ────────────────
* No character-specific exceptions. No if(name==='Bannon'). No specialYOffset.
* Every roster member goes through the same pipeline and the same validation gates.
*
* FLOOR NORMALIZATION
* ───────────────────
* After SkeletonUtils.clone():
*   1. Update world matrices
*   2. Measure actual visible cloned SkinnedMesh geometry via Box3
*   3. Compute aggregate Box3
*   4. Read measured minimum Y
*   5. Apply compensating translation to the OUTER CHARACTER INSTANCE
*   6. Leave authored bone transforms and bind matrices untouched
*
* FACING
* ──────
* Rest-align FACE to −Z from the shoulder line (worldUp × left→right).
* Baked onto the clone. Select and combat add independent outer yaws.
* Never infer facing from mesh centroid. Never inner π on the outer group.
*
* BLOCKED ASSETS
* ──────────────
* A malformed asset becomes BLOCKED — ASSET DEFORMATION INTEGRITY FAILURE.
* The pipeline NEVER secretly compensates for a failed validation by generating
* a new rig or synthetic skeleton.
*
* Pipeline:
*   Native GLB
*   → GLTFLoader (caller's responsibility)
*   → validate authored skeleton/SkinnedMesh/skin data
*   → SkeletonUtils.clone()
*   → independent character instance
*   → instance-level spatial normalization (Box3, no bone moves)
*   → authored forward-axis determination (geometry centroid only)
*   → gameplay-facing transform (outer instance only)
*   → AnimationMixer targeting that clone
*   → visible SkinnedMesh deformation
*   → validation
*   → render
*/
/** Target character height in world units — applied uniformly to all roster members */
var PIPELINE_TARGET_HEIGHT = 1.85;
function isMixamoCompatibleRig(opts) {
	const unique = [...new Set(opts.boneNames.filter(Boolean))];
	const mixamo = unique.filter((n) => /mixamo/i.test(n)).length;
	if (opts.skinnedMeshCount > 2) return false;
	if (opts.skinJointCount > 0 && opts.skinJointCount < 40) return false;
	if (unique.length < 40) return false;
	return mixamo >= 20;
}
/**
* Plugin-skin / bind-pose GLBs (Maime). Used on SELECT only to flip the 45°
* sign — not π. Combat never calls this.
*/
function isPluginBindPose(root) {
	return !isMixamoCompatibleRig(inspectRig(root));
}
function inspectRig(root) {
	const seen = /* @__PURE__ */ new Set();
	const boneNames = [];
	let skinnedMeshCount = 0;
	let skinJointCount = 0;
	root.traverse((child) => {
		if (child.isBone && child.name && !seen.has(child.name)) {
			seen.add(child.name);
			boneNames.push(child.name);
		}
		const sm = child;
		if (sm.isSkinnedMesh) {
			skinnedMeshCount++;
			const n = sm.skeleton?.bones?.length ?? 0;
			if (n > skinJointCount) skinJointCount = n;
		}
	});
	return {
		boneNames,
		skinnedMeshCount,
		skinJointCount
	};
}
/** Bind-pose box from mesh geometry only — never helpers, bones, or lines. */
function measureVisibleGeometryBox(root) {
	const box = new Box3();
	root.updateMatrixWorld(true);
	root.traverse((child) => {
		const mesh = child;
		if (!mesh.isMesh || !mesh.geometry) return;
		const geom = mesh.geometry;
		if (!geom.boundingBox) geom.computeBoundingBox();
		if (!geom.boundingBox || geom.boundingBox.isEmpty()) return;
		const local = geom.boundingBox.clone();
		local.applyMatrix4(mesh.matrixWorld);
		box.union(local);
	});
	return box;
}
/** Snap lowest mesh vertex to Y=0. Call after scale. No extra sink. */
function plantFeetOnFloor(root) {
	root.updateMatrixWorld(true);
	const box = measureVisibleGeometryBox(root);
	if (box.isEmpty() || !Number.isFinite(box.min.y)) return;
	root.position.y -= box.min.y;
	root.updateMatrixWorld(true);
}
function preserveAuthoredMaterials(root, profile) {
	root.traverse((child) => {
		const mesh = child;
		if (!mesh.isMesh) return;
		(Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((mat) => {
			const m = mat;
			if (!m) return;
			if (m.map) {
				m.map.colorSpace = SRGBColorSpace;
				m.map.minFilter = profile.textureFilter === "nearest" ? NearestFilter : LinearFilter;
				m.map.magFilter = profile.textureFilter === "nearest" ? NearestFilter : LinearFilter;
				m.map.generateMipmaps = profile.textureFilter !== "nearest";
				m.map.needsUpdate = true;
			}
			if ("skinning" in m) m.skinning = true;
			m.needsUpdate = true;
		});
	});
}
/**
* Shoulder-line forward. Left→right × world-up = authored face direction.
* Used to rest-align every GLB to −Z (camera). No per-name exceptions.
*/
function normBoneName(name) {
	return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function findBoneByNeedles(root, needles) {
	const wanted = needles.map(normBoneName);
	let found = null;
	root.traverse((child) => {
		if (found) return;
		if (!child.name) return;
		const n = normBoneName(child.name);
		if (wanted.some((w) => n === w || n.endsWith(w))) found = child;
	});
	return found;
}
var LEFT_SHOULDER_NEEDLES = [
	"leftshoulder",
	"mixamorigleftshoulder",
	"leftclavicle",
	"claviclel",
	"shoulderl",
	"leftarm",
	"mixamorigleftarm",
	"leftupperarm",
	"upperarml",
	"upperarmleft"
];
var RIGHT_SHOULDER_NEEDLES = [
	"rightshoulder",
	"mixamorigrightshoulder",
	"rightclavicle",
	"clavicler",
	"shoulderr",
	"rightarm",
	"mixamorigrightarm",
	"rightupperarm",
	"upperarmr",
	"upperarmright"
];
function estimateRigForwardXZ(root) {
	root.updateMatrixWorld(true);
	const left = findBoneByNeedles(root, LEFT_SHOULDER_NEEDLES);
	const right = findBoneByNeedles(root, RIGHT_SHOULDER_NEEDLES);
	if (!left || !right) return null;
	const l = new Vector3();
	const r = new Vector3();
	left.getWorldPosition(l);
	right.getWorldPosition(r);
	const acrossX = r.x - l.x;
	const fwdX = r.z - l.z;
	const fwdZ = -acrossX;
	const len = Math.hypot(fwdX, fwdZ);
	if (len < 1e-5) return null;
	return {
		x: fwdX / len,
		z: fwdZ / len
	};
}
function yawToAlign(fwdX, fwdZ, targetX, targetZ) {
	let d = Math.atan2(targetX, targetZ) - Math.atan2(fwdX, fwdZ);
	while (d > Math.PI) d -= Math.PI * 2;
	while (d < -Math.PI) d += Math.PI * 2;
	return d;
}
/**
* Inner rest yaw so the authored face looks down −Z (camera at +Z).
* Select and combat apply their own OUTER yaw on top of this. Do not stack π.
*/
function determineForwardCorrection(scene) {
	const fwd = estimateRigForwardXZ(scene);
	if (!fwd) return 0;
	return yawToAlign(fwd.x, fwd.z, 0, -1);
}
/**
* Validate the authored GLB scene before cloning.
* Returns BLOCKED if the asset has structural defects that would cause
* deformation failures at runtime.
*
* FAIL CLOSED: A malformed asset must become BLOCKED, never secretly fixed.
*
* RELAXED GATE: NO_SKINNED_MESH and NO_SKELETON are warnings, not hard blocks.
* Some valid GLBs (e.g. Blender exports with certain settings) may not expose
* THREE.SkinnedMesh / THREE.Bone typed objects at the top level even though
* they have valid authored skinning data that Three.js can animate correctly.
* Only block on checks that guarantee the asset CANNOT render or animate:
*   - NO_VISIBLE_MESH   → nothing to render
*   - BONE_MATRIX_NAN   → corrupt transforms will crash the renderer
*   - SKINNED_MESH_UNBOUND (only if SkinnedMeshes ARE present but unbound)
*   - MISSING_SKIN_ATTRIBUTES (only if SkinnedMeshes ARE present but missing data)
*/
function validateAuthoredAsset(scene, animations) {
	const failingChecks = [];
	const details = [];
	const bones = [];
	const skinnedMeshes = [];
	scene.traverse((child) => {
		if (child.isBone) bones.push(child);
		if (child.isSkinnedMesh) skinnedMeshes.push(child);
	});
	let hasMesh = false;
	scene.traverse((child) => {
		const c = child;
		if (c.isMesh || c.isSkinnedMesh) hasMesh = true;
	});
	if (!hasMesh) {
		failingChecks.push("NO_VISIBLE_MESH");
		details.push("No visible mesh found in GLB — asset has no renderable geometry");
	}
	if (skinnedMeshes.length === 0) console.warn("[CharacterPipeline] ⚠️ NO_SKINNED_MESH — no THREE.SkinnedMesh found in scene. Asset may still animate if skinning data is present. Proceeding with pipeline.");
	if (bones.length === 0) console.warn("[CharacterPipeline] ⚠️ NO_SKELETON — no THREE.Bone objects found in scene. Asset may still animate if skeleton data is present. Proceeding with pipeline.");
	if (bones.length > 0) {
		if (bones.filter((b) => !b.parent?.isBone).length === 0) {
			failingChecks.push("SKELETON_NO_ROOT");
			details.push("Skeleton has no root bone — hierarchy is disconnected");
		}
	}
	for (const sm of skinnedMeshes) if (!sm.skeleton || sm.skeleton.bones.length === 0) {
		failingChecks.push("SKINNED_MESH_UNBOUND");
		details.push(`SkinnedMesh "${sm.name || "unnamed"}" has no bound skeleton`);
		break;
	}
	for (const sm of skinnedMeshes) {
		const hasSkinIndex = sm.geometry.attributes.skinIndex != null;
		const hasSkinWeight = sm.geometry.attributes.skinWeight != null;
		if (!hasSkinIndex || !hasSkinWeight) {
			failingChecks.push("MISSING_SKIN_ATTRIBUTES");
			details.push(`SkinnedMesh "${sm.name || "unnamed"}" missing ${!hasSkinIndex ? "skinIndex" : ""}${!hasSkinWeight ? " skinWeight" : ""} — authored skinning data incomplete`);
			break;
		}
	}
	for (const bone of bones) {
		bone.updateWorldMatrix(true, false);
		for (const v of bone.matrixWorld.elements) if (!isFinite(v)) {
			failingChecks.push("BONE_MATRIX_NAN");
			details.push(`Bone "${bone.name}" has NaN/Infinity in world matrix — authored skeleton is corrupt`);
			break;
		}
		if (failingChecks.includes("BONE_MATRIX_NAN")) break;
	}
	const verdict = failingChecks.length === 0 ? "PASS" : "BLOCKED";
	if (verdict === "BLOCKED") console.error(`[CharacterPipeline] ❌ BLOCKED — ASSET DEFORMATION INTEGRITY FAILURE\n  Failing checks: [${failingChecks.join(", ")}]\n  Details:\n${details.map((d) => `    • ${d}`).join("\n")}\n  DO NOT attempt synthetic rigging. Fix the source GLB asset.`);
	return {
		verdict,
		failingChecks,
		details
	};
}
/**
* Validate that every animation clip channel resolves to an actual bone in
* the cloned scene before the AnimationMixer starts.
*
* Three.js track names follow the pattern:
*   "<objectName>.<propertyPath>"   e.g. "RightArm.quaternion" *"<objectName>[<subpath>]"       e.g. "Armature|RightArm.quaternion"
*
* The resolver mirrors THREE.AnimationMixer's own name-based lookup: *   it searches the root object's subtree for an object whose .name matches
*   the track's target name.
*
* @param clonedScene  The cloned scene that the mixer will target
* @param animations   The animation clips to validate
* @param modelName    Short name used in log messages
*/
function validateAnimationChannelBones(clonedScene, animations, modelName) {
	const boneNameSet = /* @__PURE__ */ new Set();
	const allBoneNames = [];
	clonedScene.traverse((child) => {
		if (child.isBone) {
			boneNameSet.add(child.name);
			allBoneNames.push(child.name);
		}
	});
	const objectNameSet = /* @__PURE__ */ new Set();
	clonedScene.traverse((child) => {
		if (child.name) objectNameSet.add(child.name);
	});
	let totalChannels = 0;
	let resolvedChannels = 0;
	let unresolvedChannels = 0;
	const mismatches = [];
	for (const clip of animations) for (const track of clip.tracks) {
		totalChannels++;
		const rawName = track.name;
		const dotIdx = rawName.lastIndexOf(".");
		const withoutProp = dotIdx !== -1 ? rawName.slice(0, dotIdx) : rawName;
		const pipeIdx = withoutProp.lastIndexOf("|");
		const targetName = pipeIdx !== -1 ? withoutProp.slice(pipeIdx + 1) : withoutProp;
		if (objectNameSet.has(targetName)) resolvedChannels++;
		else {
			unresolvedChannels++;
			if (mismatches.length < 8) mismatches.push({
				clipName: clip.name,
				trackName: rawName,
				targetName,
				availableBones: []
			});
		}
	}
	const allResolved = unresolvedChannels === 0;
	if (animations.length === 0) console.warn(`[CharacterPipeline] ⚠️ "${modelName}" — no animation clips to validate. Character will be static (bind pose).`);
	else if (allResolved) console.log(`[CharacterPipeline] ✅ Animation channel validation PASSED — "${modelName}"\n  ${resolvedChannels}/${totalChannels} channels resolved across ${animations.length} clip(s).`);
	else console.warn(`[CharacterPipeline] ⚠️ "${modelName}" animation channels: ${resolvedChannels}/${totalChannels} resolved, ${unresolvedChannels} unmatched (fingers/toes ignored).`);
	return {
		totalChannels,
		resolvedChannels,
		unresolvedChannels,
		mismatches,
		allResolved
	};
}
/**
* Extract and retarget animation clips for a character.
*
* Steps:
*   1. Collect clips from the GLB
*   2. Build AnimationRetargeter from source skeleton → target skeleton
*   3. Apply retarget layer (source bone names → canonical → target bone names)
*   4. Run validateAnimationChannelBones() on retargeted clips
*   5. Return clips ready for mixer.clipAction()
*
* @param sourceScene   The original (un-cloned) GLB scene — used to index source bones
* @param targetScene   The cloned scene that the mixer will target
* @param glbAnimations Animation clips from the GLB
* @param modelName     Short name for logging
* @param characterId   Character identifier for bridge source lookup
*/
async function extractAndRetargetAnimations(sourceScene, targetScene, glbAnimations, modelName, characterId = "") {
	const glbClipCount = glbAnimations.length;
	let bridgeClipCount = 0;
	let retargetApplied = false;
	let retargetVerdict = "SKIPPED";
	const rig = inspectRig(targetScene);
	const mixamoOk = isMixamoCompatibleRig(rig);
	const registry = new AnimationSourceRegistry();
	const restMap = collectRestMap(targetScene);
	const ingest = (clip, semantic) => {
		const bound = bindClipTracksToTargetBones(clip, rig.boneNames);
		if (bound.resolvedTracks === 0) return null;
		sanitizeMotionClip(bound.clip);
		const relative = makeClipBindRelative(bound.clip, restMap);
		if (!relative) return null;
		const ud = relative.userData;
		const sem = semantic || String(ud.semanticState ?? resolveClipSemanticState(relative.name) ?? "");
		if (sem) ud.semanticState = sem;
		return relative;
	};
	const processedClips = [];
	for (const native of glbAnimations) {
		const converted = ingest(native.clone());
		if (converted) processedClips.push(converted);
	}
	if (processedClips.length > 0) {
		registry.registerGLBClips(processedClips, modelName, characterId);
		bridgeClipCount = processedClips.length;
	}
	try {
		const bank = await loadBannonClipsFromPublic();
		const variants = await loadBannonMotionBankVariants();
		let bankBound = 0;
		const ingestNamed = (semanticState, clip, replaceSemantic) => {
			const converted = ingest(clip, semanticState);
			if (!converted) return;
			let travel = 0;
			const qA = new Quaternion();
			const qB = new Quaternion();
			for (const track of converted.tracks) {
				if (!track.name.endsWith(".quaternion")) continue;
				const v = track.values;
				for (let i = 4; i + 3 < v.length; i += 4) {
					qA.set(v[i - 4], v[i - 3], v[i - 2], v[i - 1]);
					qB.set(v[i], v[i + 1], v[i + 2], v[i + 3]);
					travel += qA.angleTo(qB);
				}
			}
			converted.userData.angularTravelRadians = travel;
			if (replaceSemantic && (semanticState === "idle" || travel >= .35)) {
				const idx = processedClips.findIndex((c) => String(c.userData?.semanticState) === semanticState);
				if (idx >= 0) processedClips[idx] = converted;
				else processedClips.push(converted);
			} else processedClips.push(converted);
			bankBound++;
		};
		for (const [semanticState, clip] of bank) ingestNamed(semanticState, clip, true);
		for (const [key, clip] of variants) {
			if (processedClips.some((c) => c.name === clip.name || c.name === key)) continue;
			ingestNamed(String(clip.userData?.semanticState ?? "") || key, clip, false);
		}
		if (bankBound > 0) {
			retargetApplied = true;
			retargetVerdict = "PASS";
			bridgeClipCount = bankBound;
			console.log(`[CharacterPipeline] ✅ "${modelName}" bind-relative bank: ${bankBound} clip(s)`);
		}
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		console.warn(`[CharacterPipeline] ⚠️ motion bank skipped: ${message}`);
	}
	const filled = fillBindRelativeGaps(targetScene, processedClips);
	processedClips.length = 0;
	processedClips.push(...filled);
	retargetApplied = true;
	retargetVerdict = processedClips.length > 0 ? "PASS" : "SKIPPED";
	console.log(`[CharacterPipeline] 🔒 "${modelName}" clips=${processedClips.length} (mixamoOk=${mixamoOk} bones=${rig.boneNames.length})`);
	validateRegistryCompleteness(registry, characterId || modelName);
	const channelValidation = validateAnimationChannelBones(targetScene, processedClips, modelName);
	console.log(`[CharacterPipeline] 📊 "${modelName}" animation extraction complete:\n  GLB clips:        ${glbClipCount}\n  Bridge clips:     ${bridgeClipCount}\n  Total clips:      ${processedClips.length}\n  Resolved tracks:  ${channelValidation.resolvedChannels}\n  Unresolved tracks:${channelValidation.unresolvedChannels}\n  Retarget applied: ${retargetApplied}\n  Retarget verdict: ${retargetVerdict}\n  Bind-relative:    bank + fill`);
	return {
		clips: processedClips,
		glbClipCount,
		bridgeClipCount,
		resolvedTrackCount: channelValidation.resolvedChannels,
		unresolvedTrackCount: channelValidation.unresolvedChannels,
		retargetApplied,
		retargetVerdict,
		mixamoBound: mixamoOk && processedClips.length > glbClipCount
	};
}
/**
* Resolve a clip name to its semantic state using SEMANTIC_STATE_ALIASES.
* Returns null if no semantic state is found.
*/
function resolveClipSemanticState(clipName) {
	const lower = clipName.toLowerCase();
	for (const [semanticState, aliases] of Object.entries(SEMANTIC_STATE_ALIASES)) if (aliases.some((a) => a.toLowerCase() === lower || lower.includes(a.toLowerCase()))) return semanticState;
	return null;
}
/**
* runCharacterPipeline
*
* The single authoritative character-ingestion pipeline used by BOTH
* Character Select and Combat.
*
* Pipeline steps:
*   1. Validate authored skeleton/SkinnedMesh/skin data (FAIL CLOSED)
*   2. SkeletonUtils.clone() — skeleton-aware clone
*   3. Disable frustum culling on all SkinnedMeshes
*   4. Normalize skin weights (Khronos spec compliance)
*   5. Zero the cloned scene's rotation (canonical pose for measurement)
*   6. Measure actual visible geometry via Box3
*   7. Apply uniform scale to TARGET_HEIGHT
*   8. Re-measure post-scale Box3
*   9. Apply Y offset to outer instance so lowest vertex = Y=0 (floor)
*  10. Update world matrices
*  11. Determine authored forward axis from geometry centroid (NOT bone positions)
*  12. Apply PSX vertex snapping to materials
*  13. Create AnimationMixer targeting the cloned scene
*  14. Load animation clips with name-based binding (NOT UUID)
*  15. Build SkeletonHelper for diagnostic display
*
* NEVER:
*   - Generates synthetic bones
*   - Modifies authored skeleton/bind matrices
*   - Applies character-specific corrections
*   - Uses bone positions to infer facing direction
*
* @param scene - The original GLB scene from GLTFLoader (NOT modified)
* @param animations - Animation clips from the GLB
* @param modelUrl - URL for logging
* @param applyPSXShader - Whether to apply PSX vertex snapping (true for combat, false for portrait)
* @returns PipelineResult or null if BLOCKED
*/
async function runCharacterPipeline(scene, animations, modelUrl, applyPSXShader = true) {
	const modelName = modelUrl.split("/").pop() ?? modelUrl;
	const validation = validateAuthoredAsset(scene, animations);
	if (validation.verdict === "BLOCKED") {
		console.error(`[CharacterPipeline] 🚫 "${modelName}" BLOCKED — asset failed pre-clone validation.\n  Failing: [${validation.failingChecks.join(", ")}]\n  DO NOT secretly re-rig. Fix the source GLB.`);
		return null;
	}
	const cloned = SkeletonUtils.clone(scene);
	restoreAuthoredTextures(cloned, modelUrl);
	cloned.rotation.set(0, 0, 0);
	cloned.position.set(0, 0, 0);
	cloned.scale.set(1, 1, 1);
	let frustumCullingDisabled = true;
	let skinWeightsNormalized = true;
	cloned.traverse((child) => {
		const mesh = child;
		if (mesh.isMesh) {
			mesh.frustumCulled = false;
			mesh.visible = true;
		}
		const skinnedMesh = child;
		if (!skinnedMesh.isSkinnedMesh) return;
		skinnedMesh.frustumCulled = false;
		skinnedMesh.visible = true;
		if (!skinnedMesh.skeleton || skinnedMesh.skeleton.bones.length === 0) {
			console.warn(`[CharacterPipeline] ⚠️ SkinnedMesh "${skinnedMesh.name}" has no bound skeleton after SkeletonUtils.clone() — check GLB export. Deformation will not occur for this mesh.`);
			frustumCullingDisabled = false;
		} else console.log(`[CharacterPipeline] ✅ SkinnedMesh "${skinnedMesh.name}" bound to skeleton with ${skinnedMesh.skeleton.bones.length} bones after clone.`);
		(Array.isArray(skinnedMesh.material) ? skinnedMesh.material : [skinnedMesh.material]).forEach((mat) => {
			if (mat && "skinning" in mat) mat.skinning = true;
		});
	});
	const profile = getActiveRenderProfile();
	cloned.updateMatrixWorld(true);
	const rawSize = measureVisibleGeometryBox(cloned).getSize(new Vector3());
	const scale = rawSize.y > .01 ? PIPELINE_TARGET_HEIGHT / rawSize.y * rosterHeightScale(modelUrl) : 1;
	cloned.scale.setScalar(scale);
	cloned.updateMatrixWorld(true);
	const scaledBox = measureVisibleGeometryBox(cloned);
	const scaledCenter = scaledBox.getCenter(new Vector3());
	const scaledSize = scaledBox.getSize(new Vector3());
	cloned.position.set(-scaledCenter.x, 0, -scaledCenter.z);
	plantFeetOnFloor(cloned);
	if (!Number.isFinite(cloned.position.x) || !Number.isFinite(cloned.position.y) || !Number.isFinite(cloned.position.z)) cloned.position.set(0, 0, 0);
	cloned.updateMatrixWorld(true);
	cloned.rotation.y = 0;
	const forwardCorrectionY = 0;
	preserveAuthoredMaterials(cloned, profile);
	const mixer = new AnimationMixer(cloned);
	let extractionResult;
	try {
		extractionResult = await extractAndRetargetAnimations(scene, cloned, animations, modelName, modelName.replace(/[_.].*$/, "").toUpperCase());
	} catch (err) {
		console.error(`[CharacterPipeline] retarget failed for "${modelName}" — combat mesh still draws`, err);
		const filled = fillBindRelativeGaps(cloned, animations ?? []);
		extractionResult = {
			clips: filled,
			glbClipCount: animations?.length ?? 0,
			bridgeClipCount: filled.length,
			resolvedTrackCount: 0,
			unresolvedTrackCount: 0,
			retargetApplied: filled.length > 0,
			retargetVerdict: filled.length > 0 ? "PASS" : "SKIPPED",
			mixamoBound: false
		};
	}
	if (extractionResult.unresolvedTrackCount > 0) console.warn(`[CharacterPipeline] ⚠️ "${modelName}" — ${extractionResult.unresolvedTrackCount} unresolved animation channel(s) after retarget. Character may appear frozen in bind pose.`);
	const actions = {};
	for (const clip of extractionResult.clips) {
		const action = mixer.clipAction(clip, cloned);
		actions[clip.name] = action;
		const sem = String(clip.userData?.semanticState ?? "");
		if (sem) {
			if (!actions[sem]) actions[sem] = action;
			for (const alias of SEMANTIC_STATE_ALIASES[sem] ?? []) if (!actions[alias]) actions[alias] = action;
			for (const [combat, mapped] of Object.entries(COMBAT_STATE_TO_SEMANTIC)) if (mapped === sem && !actions[combat]) actions[combat] = action;
		}
	}
	console.log(`[CharacterPipeline] 🎬 "${modelName}" mixer loaded:\n  Clips:            ${extractionResult.clips.length}\n  Resolved tracks:  ${extractionResult.resolvedTrackCount}\n  Unresolved tracks:${extractionResult.unresolvedTrackCount}\n  Mixer root:       ${cloned.uuid} (${cloned.name || "cloned scene"})\n  Actions:          [${Object.keys(actions).join(", ")}]`);
	let skeletonHelper = null;
	let hasAnyBones = false;
	cloned.traverse((child) => {
		if (child.isBone) hasAnyBones = true;
	});
	if (hasAnyBones) {
		skeletonHelper = new SkeletonHelper(cloned);
		skeletonHelper.material.linewidth = 2;
		skeletonHelper.material.color.set(65416);
		skeletonHelper.visible = false;
	}
	let boneCount = 0;
	let skinnedMeshCount = 0;
	cloned.traverse((child) => {
		if (child.isBone) boneCount++;
		if (child.isSkinnedMesh) skinnedMeshCount++;
	});
	const diagnostics = {
		modelUrl,
		boneCount,
		skinnedMeshCount,
		clipCount: extractionResult.clips.length,
		measuredFloorY: scaledBox.min.y + cloned.position.y,
		measuredHeight: scaledSize.y,
		forwardCorrectionDeg: Math.round(0 / Math.PI),
		frustumCullingDisabled,
		skinWeightsNormalized,
		pipelineComplete: true
	};
	console.log(`[CharacterPipeline] ✅ "${modelName}" pipeline complete — bones=${boneCount} skinnedMeshes=${skinnedMeshCount} clips=${extractionResult.clips.length} resolved=${extractionResult.resolvedTrackCount} unresolved=${extractionResult.unresolvedTrackCount} height=${scaledSize.y.toFixed(3)} forwardCorrection=${diagnostics.forwardCorrectionDeg}° floorY=${diagnostics.measuredFloorY.toFixed(4)}`);
	return {
		scene: cloned,
		forwardCorrectionY,
		mixer,
		actions,
		skeletonHelper,
		diagnostics
	};
}
//#endregion
export { inferSemanticStateFromClipName as a, restoreAuthoredTextures as c, sanitizeMotionClip as d, validateAnimationChannelBones as f, determineForwardCorrection as i, rosterHeightScale as l, COMBAT_STATE_TO_SEMANTIC as n, isPluginBindPose as o, SEMANTIC_STATE_ALIASES as r, measureVisibleGeometryBox as s, AnimationRetargeter as t, runCharacterPipeline as u };
