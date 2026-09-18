import { Dt as Vector3, Ot as VectorKeyframeTrack, S as Euler, bt as SkinnedMesh, h as BufferAttribute, m as Box3, mt as QuaternionKeyframeTrack, p as Bone, pt as Quaternion, u as AnimationClip, vt as Skeleton } from "../_libs/@react-three/drei+[...].mjs";
import { t as BONE_NAME_ALIASES } from "./BoneHitboxSystem-D2yRyfrH.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/AnimationIntegrityGate-Cj6H6q3Y.js
/**
* AutoRigDetector — Open-source rigging utility for GLB models
*
* Detects whether a GLB model has a valid humanoid rig and provides
* diagnostic information + auto-correction where possible.
*
* Supports:
*   - Mixamo rigs (mixamorigXxx naming)
*   - Rigify rigs (DEF-xxx naming)
*   - Blender default humanoid (Armature > Bone naming)
*   - Custom rigs (fuzzy name matching)
*   - T-pose detection (checks if model is in bind pose)
*   - Root bone floor-zero validation
*   - Procedural synthetic rig generation for bone-less models
*
* When rigging is missing or broken, provides:
*   - Detailed diagnostic report
*   - Instructions for free tools (Mixamo auto-rigger, Blender Rigify)
*   - Fallback AABB-based hitboxes so combat still works
*   - Procedural synthetic skeleton built from mesh bounding box
*
* Open-source tools referenced:
*   - Mixamo Auto-Rigger: https://www.mixamo.com (free, browser-based)
*   - Blender + Rigify: https://www.blender.org (free, open-source)
*   - Three.js SkeletonHelper: built-in bone visualization
*   - Schwarzerblitz engine: github.com/AndreaOrru/schwarzerblitz-engine
*   - mhvnsnt/BrutalfistbaseofTekken3Recompiled animation namespace
*/
var CRITICAL_BONES = [
	"RightHand",
	"LeftHand",
	"RightFoot",
	"LeftFoot",
	"Head",
	"Hips"
];
/** Root bone Y must be within this distance of 0 to be considered "at floor" */
var ROOT_FLOOR_THRESHOLD = .15;
/**
* AutoRigDetector — analyzes a loaded GLB scene for rig quality.
*/
var AutoRigDetector = class {
	/**
	* Analyze a loaded GLB scene and return a full diagnostic report.
	*/
	static analyze(scene, animations) {
		const allBones = [];
		let hasSkinnedMesh = false;
		scene.traverse((child) => {
			if (child.isBone) allBones.push(child);
			if (child.isSkinnedMesh) {
				hasSkinnedMesh = true;
				const sm = child;
				if (sm.skeleton) sm.skeleton.bones.forEach((b) => {
					if (!allBones.includes(b)) allBones.push(b);
				});
			}
		});
		const totalBones = allBones.length;
		const convention = this.detectConvention(allBones);
		const foundBones = {};
		const missingBones = [];
		for (const slot of CRITICAL_BONES) {
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
			if (found) foundBones[slot] = found.name;
			else missingBones.push(slot);
		}
		const rootBone = this.findRootBone(allBones);
		let rootBoneY = null;
		let hasRootAtFloor = false;
		if (rootBone) {
			const worldPos = new Vector3();
			rootBone.getWorldPosition(worldPos);
			rootBoneY = worldPos.y;
			hasRootAtFloor = Math.abs(rootBoneY) <= ROOT_FLOOR_THRESHOLD;
		}
		const isInTPose = this.detectTPose(allBones);
		const criticalFound = CRITICAL_BONES.filter((b) => foundBones[b]).length;
		let quality;
		if (totalBones === 0 || !hasSkinnedMesh) quality = "none";
		else if (criticalFound >= 4 && hasRootAtFloor) quality = "full";
		else if (criticalFound >= 2 || totalBones >= 10) quality = "partial";
		else quality = "none";
		const { recommendation, fixInstructions } = this.buildRecommendation(quality, convention, missingBones, hasRootAtFloor, animations.length > 0);
		const report = {
			quality,
			convention,
			totalBones,
			hasRootAtFloor,
			rootBoneName: rootBone?.name ?? null,
			rootBoneY,
			isInTPose,
			foundBones,
			missingBones,
			hasAnimations: animations.length > 0,
			animationClips: animations.map((a) => a.name),
			hasSkinnedMesh,
			recommendation,
			fixInstructions
		};
		console.log(`[AutoRig] 🔍 "${scene.name || "model"}" — quality=${quality} convention=${convention} bones=${totalBones} found=${criticalFound}/${CRITICAL_BONES.length} rootAtFloor=${hasRootAtFloor} tpose=${isInTPose}`);
		return report;
	}
	/**
	* Build a procedural synthetic humanoid skeleton from a mesh's bounding box.
	*
	* AGENT LAW: This is the automatic rigging path for bone-less models.
	* When a model has no bones/skinned mesh, we generate a synthetic skeleton
	* using standard humanoid proportions derived from the mesh AABB.
	* The skeleton uses Mixamo-compatible bone names so animation clips from
	* Mixamo, Schwarzerblitz, and Tekken repos can be retargeted onto it.
	*
	* Bone positions are derived from the AABB using standard human proportions:
	*   - Hips: 52% of height
	*   - Spine: 62% of height
	*   - Chest: 72% of height
	*   - Neck: 82% of height
	*   - Head: 90% of height
	*   - Shoulders: 72% height, ±25% width
	*   - Upper arms: 72% height, ±40% width
	*   - Forearms: 60% height, ±50% width
	*   - Hands: 48% height, ±55% width
	*   - Upper legs: 38% height, ±15% width
	*   - Lower legs: 20% height, ±15% width
	*   - Feet: 2% height, ±15% width
	*/
	static buildSyntheticRig(scene) {
		scene.updateMatrixWorld(true);
		const box = new Box3().setFromObject(scene);
		const size = box.getSize(new Vector3());
		const center = box.getCenter(new Vector3());
		const h = size.y;
		const w = size.x;
		const baseY = box.min.y;
		const makeBone = (name) => {
			const bone = new Bone();
			bone.name = name;
			return bone;
		};
		const hips = makeBone("mixamorigHips");
		const spine = makeBone("mixamorigSpine");
		const spine1 = makeBone("mixamorigSpine1");
		const spine2 = makeBone("mixamorigSpine2");
		const neck = makeBone("mixamorigNeck");
		const head = makeBone("mixamorigHead");
		const headTop = makeBone("mixamorigHeadTop_End");
		const leftShoulder = makeBone("mixamorigLeftShoulder");
		const leftArm = makeBone("mixamorigLeftArm");
		const leftForeArm = makeBone("mixamorigLeftForeArm");
		const leftHand = makeBone("mixamorigLeftHand");
		const rightShoulder = makeBone("mixamorigRightShoulder");
		const rightArm = makeBone("mixamorigRightArm");
		const rightForeArm = makeBone("mixamorigRightForeArm");
		const rightHand = makeBone("mixamorigRightHand");
		const leftUpLeg = makeBone("mixamorigLeftUpLeg");
		const leftLeg = makeBone("mixamorigLeftLeg");
		const leftFoot = makeBone("mixamorigLeftFoot");
		const leftToeBase = makeBone("mixamorigLeftToeBase");
		const rightUpLeg = makeBone("mixamorigRightUpLeg");
		const rightLeg = makeBone("mixamorigRightLeg");
		const rightFoot = makeBone("mixamorigRightFoot");
		const rightToeBase = makeBone("mixamorigRightToeBase");
		hips.position.set(center.x, baseY + h * .52, center.z);
		spine.position.set(0, h * .1, 0);
		spine1.position.set(0, h * .08, 0);
		spine2.position.set(0, h * .08, 0);
		neck.position.set(0, h * .08, 0);
		head.position.set(0, h * .06, 0);
		headTop.position.set(0, h * .1, 0);
		leftShoulder.position.set(-w * .12, 0, 0);
		leftArm.position.set(-w * .12, 0, 0);
		leftForeArm.position.set(-w * .12, -h * .12, 0);
		leftHand.position.set(-w * .1, -h * .12, 0);
		rightShoulder.position.set(w * .12, 0, 0);
		rightArm.position.set(w * .12, 0, 0);
		rightForeArm.position.set(w * .12, -h * .12, 0);
		rightHand.position.set(w * .1, -h * .12, 0);
		leftUpLeg.position.set(-w * .12, -h * .02, 0);
		leftLeg.position.set(0, -h * .22, 0);
		leftFoot.position.set(0, -h * .22, 0);
		leftToeBase.position.set(0, -h * .04, w * .08);
		rightUpLeg.position.set(w * .12, -h * .02, 0);
		rightLeg.position.set(0, -h * .22, 0);
		rightFoot.position.set(0, -h * .22, 0);
		rightToeBase.position.set(0, -h * .04, w * .08);
		hips.add(spine);
		spine.add(spine1);
		spine1.add(spine2);
		spine2.add(neck);
		neck.add(head);
		head.add(headTop);
		spine2.add(leftShoulder);
		leftShoulder.add(leftArm);
		leftArm.add(leftForeArm);
		leftForeArm.add(leftHand);
		spine2.add(rightShoulder);
		rightShoulder.add(rightArm);
		rightArm.add(rightForeArm);
		rightForeArm.add(rightHand);
		hips.add(leftUpLeg);
		leftUpLeg.add(leftLeg);
		leftLeg.add(leftFoot);
		leftFoot.add(leftToeBase);
		hips.add(rightUpLeg);
		rightUpLeg.add(rightLeg);
		rightLeg.add(rightFoot);
		rightFoot.add(rightToeBase);
		const allBones = [
			hips,
			spine,
			spine1,
			spine2,
			neck,
			head,
			headTop,
			leftShoulder,
			leftArm,
			leftForeArm,
			leftHand,
			rightShoulder,
			rightArm,
			rightForeArm,
			rightHand,
			leftUpLeg,
			leftLeg,
			leftFoot,
			leftToeBase,
			rightUpLeg,
			rightLeg,
			rightFoot,
			rightToeBase
		];
		const skeleton = new Skeleton(allBones);
		let attached = false;
		scene.add(hips);
		hips.updateMatrixWorld(true);
		skeleton.calculateInverses();
		scene.traverse((child) => {
			if (!child.isMesh) return;
			if (child.isSkinnedMesh) return;
			const mesh = child;
			const geometry = mesh.geometry;
			if (!geometry || !geometry.attributes.position) return;
			const posAttr = geometry.attributes.position;
			const vertexCount = posAttr.count;
			const skinIndices = new Float32Array(vertexCount * 4);
			const skinWeights = new Float32Array(vertexCount * 4);
			const boneWorldPositions = allBones.map((bone) => {
				const wp = new Vector3();
				bone.getWorldPosition(wp);
				return wp;
			});
			const vPos = new Vector3();
			const meshWorldMatrix = mesh.matrixWorld;
			for (let i = 0; i < vertexCount; i++) {
				vPos.fromBufferAttribute(posAttr, i);
				vPos.applyMatrix4(meshWorldMatrix);
				const distances = boneWorldPositions.map((bp, bIdx) => ({
					idx: bIdx,
					dist: vPos.distanceTo(bp)
				}));
				distances.sort((a, b) => a.dist - b.dist);
				const influenceCount = Math.min(4, distances.length);
				const nearest = distances.slice(0, influenceCount);
				const totalInvDist = nearest.reduce((sum, d) => sum + (d.dist > 0 ? 1 / d.dist : 1e6), 0);
				for (let j = 0; j < influenceCount; j++) {
					skinIndices[i * 4 + j] = nearest[j].idx;
					skinWeights[i * 4 + j] = nearest[j].dist > 0 ? 1 / nearest[j].dist / totalInvDist : 1;
				}
				for (let j = influenceCount; j < 4; j++) {
					skinIndices[i * 4 + j] = 0;
					skinWeights[i * 4 + j] = 0;
				}
			}
			geometry.setAttribute("skinIndex", new BufferAttribute(skinIndices, 4));
			geometry.setAttribute("skinWeight", new BufferAttribute(skinWeights, 4));
			const skinnedMesh = new SkinnedMesh(geometry, mesh.material);
			skinnedMesh.name = mesh.name;
			skinnedMesh.position.copy(mesh.position);
			skinnedMesh.rotation.copy(mesh.rotation);
			skinnedMesh.scale.copy(mesh.scale);
			skinnedMesh.matrix.copy(mesh.matrix);
			skinnedMesh.matrixWorld.copy(mesh.matrixWorld);
			skinnedMesh.bind(skeleton, skinnedMesh.matrixWorld);
			skinnedMesh.normalizeSkinWeights();
			if (mesh.parent) {
				mesh.parent.add(skinnedMesh);
				mesh.parent.remove(mesh);
			}
			attached = true;
			console.log(`[AutoRig] 🔗 Converted "${mesh.name || "mesh"}" to SkinnedMesh with ${vertexCount} vertices`);
		});
		const boneMap = /* @__PURE__ */ new Map();
		for (const bone of allBones) boneMap.set(bone.name, bone);
		console.log(`[AutoRig] 🦴 Built synthetic rig for "${scene.name || "model"}" — ${allBones.length} bones, height=${h.toFixed(2)}, width=${w.toFixed(2)}, attached=${attached}`);
		return {
			rootBone: hips,
			bones: boneMap,
			skeleton,
			attached
		};
	}
	/**
	* Detect the naming convention used by the rig.
	*/
	static detectConvention(bones) {
		if (bones.length === 0) return "none";
		const names = bones.map((b) => b.name);
		if (names.some((n) => n.startsWith("mixamorig"))) return "mixamo";
		if (names.some((n) => n.startsWith("DEF-") || n.startsWith("ORG-"))) return "rigify";
		if (names.some((n) => n.startsWith("Bip01") || n.startsWith("b_"))) return "unreal";
		if (names.some((n) => n.includes("Armature") || n === "Bone")) return "blender";
		if (bones.length > 0) return "custom";
		return "none";
	}
	/**
	* Find the root bone (lowest in hierarchy, near floor).
	*/
	static findRootBone(bones) {
		if (bones.length === 0) return null;
		const rootAliases = BONE_NAME_ALIASES["Hips"];
		for (const alias of rootAliases) {
			const bone = bones.find((b) => b.name === alias || b.name.toLowerCase() === alias.toLowerCase());
			if (bone) return bone;
		}
		const rootBones = bones.filter((b) => !b.parent || !b.parent.isBone);
		if (rootBones.length > 0) return rootBones[0];
		return bones[0];
	}
	/**
	* Detect if the model is in T-pose by checking arm bone orientations.
	* In T-pose, upper arm bones should be roughly horizontal (Y rotation near 0).
	*/
	static detectTPose(bones) {
		const armBoneNames = [
			"UpperArm",
			"upperarm",
			"Arm",
			"arm",
			"Shoulder",
			"shoulder"
		];
		const armBones = bones.filter((b) => armBoneNames.some((n) => b.name.toLowerCase().includes(n.toLowerCase())));
		if (armBones.length === 0) return false;
		return armBones.filter((b) => {
			const euler = new Euler().setFromQuaternion(b.quaternion);
			return Math.abs(euler.x) < .3 && Math.abs(euler.z) < .3;
		}).length >= armBones.length * .6;
	}
	/**
	* Build recommendation and fix instructions based on diagnostic results.
	*/
	static buildRecommendation(quality, convention, missingBones, hasRootAtFloor, hasAnimations) {
		if (quality === "full" && hasAnimations) return {
			recommendation: "✅ Rig is combat-ready. Bone hitboxes fully operational.",
			fixInstructions: []
		};
		if (quality === "none") return {
			recommendation: "⚠️ No rig detected. Synthetic rig generated automatically from mesh AABB. For best results, use Mixamo Auto-Rigger (free) to add a proper skeleton.",
			fixInstructions: [
				"1. Go to https://www.mixamo.com (free Adobe account required)",
				"2. Click \"Upload Character\" and upload your GLB/FBX/OBJ file",
				"3. Mixamo will auto-detect your mesh and apply a humanoid rig",
				"4. Place the chin marker on the chin, wrists on wrists, groin on groin",
				"5. Click \"Next\" — Mixamo auto-rigs your character in ~30 seconds",
				"6. Download as FBX (with skin) then convert to GLB using:",
				"   - Online: https://products.aspose.app/3d/conversion/fbx-to-glb",
				"   - Blender: File > Import FBX > Export GLTF 2.0",
				"7. Place the GLB in public/models/ and update bannonGlbRoster.ts",
				"",
				"NOTE: A synthetic rig has been auto-generated from the mesh bounding box.",
				"This provides AABB-level hitboxes and basic animation support.",
				"For full bone-parented hitboxes and proper animation, use Mixamo."
			]
		};
		const instructions = [];
		if (!hasRootAtFloor) instructions.push("⚠️ Root bone is not at floor zero. In Blender:", "   - Select the Armature > Edit Mode", "   - Select the root/hips bone", "   - Set its head Y position to 0 (floor level)", "   - The root should sit between the character's feet");
		if (missingBones.length > 0) instructions.push(`⚠️ Missing bones: ${missingBones.join(", ")}`, "Options to fix:", "  A) Re-rig with Mixamo (recommended — free, automatic):", "     https://www.mixamo.com", "  B) In Blender, rename existing bones to match Mixamo convention:", `     ${missingBones.map((b) => `${b} → mixamorig${b}`).join(", ")}`, "  C) The engine will use AABB fallback hitboxes for missing bones", "     (combat still works, just less precise)");
		if (!hasAnimations) instructions.push("⚠️ No animation clips found in GLB.", "To add animations:", "  A) Mixamo: After rigging, browse animations and download with skin", "  B) Blender: Import animation FBX files and bake to the rig", "  C) Mixamo animation packs: https://www.mixamo.com/#/?page=1&type=Motion%2CMotionPack", "  Recommended clips for Brutal Fist:", "    - Idle, Walk Forward, Walk Backward", "    - Jab, Cross, Hook (for lightAttack)", "    - Uppercut, Spinning Kick (for heavyAttack)", "    - Hit Reaction, Knockdown, Get Up", "    - Crouch, Guard/Block", "    - Victory Pose, Taunt", "    - Strafe Left, Strafe Right");
		return {
			recommendation: quality === "partial" ? `⚠️ Partial rig (${missingBones.length} bones missing). AABB fallback active for missing bones.` : "❌ Rig needs repair. See fix instructions.",
			fixInstructions: instructions
		};
	}
	/**
	* Normalize root bone to floor zero.
	* Adjusts the entire skeleton so the root bone sits at Y=0.
	* Call this after loading a GLB if hasRootAtFloor is false.
	*/
	static normalizeRootToFloor(scene) {
		const allBones = [];
		scene.traverse((child) => {
			if (child.isBone) allBones.push(child);
		});
		const rootBone = this.findRootBone(allBones);
		if (!rootBone) return;
		const worldPos = new Vector3();
		rootBone.getWorldPosition(worldPos);
		if (Math.abs(worldPos.y) > ROOT_FLOOR_THRESHOLD) {
			scene.position.y -= worldPos.y;
			scene.updateMatrixWorld(true);
			console.log(`[AutoRig] 🔧 Normalized root bone to floor: offset Y by ${(-worldPos.y).toFixed(4)}`);
		}
	}
	/**
	* Retarget animation clips from a source scene to a target scene with a synthetic rig.
	*
	* When a model has no rig and we build a synthetic skeleton, the original animation
	* clips (if any) reference bone names that don't exist in the synthetic rig.
	* This method remaps track names from the source clip to the nearest matching
	* bone in the synthetic rig using fuzzy name matching.
	*
	* For models with NO original animations, this returns an empty array — the
	* caller should use Mixamo clips or the idle/walk fallback.
	*/
	static retargetClipsToSyntheticRig(clips, syntheticBones) {
		if (clips.length === 0 || syntheticBones.size === 0) return [];
		const syntheticBoneNames = Array.from(syntheticBones.keys());
		return clips.map((clip) => {
			const retargetedTracks = [];
			for (const track of clip.tracks) {
				const dotIdx = track.name.lastIndexOf(".");
				if (dotIdx === -1) {
					retargetedTracks.push(track);
					continue;
				}
				const boneName = track.name.substring(0, dotIdx);
				const property = track.name.substring(dotIdx);
				const matchedBone = this.findBestBoneMatch(boneName, syntheticBoneNames);
				if (!matchedBone) continue;
				const newTrackName = matchedBone + property;
				let newTrack;
				if (track instanceof QuaternionKeyframeTrack) newTrack = new QuaternionKeyframeTrack(newTrackName, track.times, track.values);
				else if (track instanceof VectorKeyframeTrack) newTrack = new VectorKeyframeTrack(newTrackName, track.times, track.values);
				else {
					newTrack = track.clone();
					newTrack.name = newTrackName;
				}
				retargetedTracks.push(newTrack);
			}
			if (retargetedTracks.length === 0) return clip;
			return new AnimationClip(clip.name, clip.duration, retargetedTracks);
		});
	}
	/**
	* Find the best matching bone name from a list of candidates.
	* Uses exact match first, then partial substring match, then Mixamo prefix strip.
	*/
	static findBestBoneMatch(sourceName, candidates) {
		const exact = candidates.find((c) => c === sourceName);
		if (exact) return exact;
		const ciExact = candidates.find((c) => c.toLowerCase() === sourceName.toLowerCase());
		if (ciExact) return ciExact;
		const stripped = sourceName.replace(/^mixamorig/i, "");
		if (stripped !== sourceName) {
			const strippedMatch = candidates.find((c) => c.toLowerCase() === stripped.toLowerCase() || c.toLowerCase().includes(stripped.toLowerCase()));
			if (strippedMatch) return strippedMatch;
		}
		const partial = candidates.find((c) => {
			const cl = c.toLowerCase();
			const sl = sourceName.toLowerCase();
			return cl.includes(sl) || sl.includes(cl);
		});
		if (partial) return partial;
		const semanticMap = {
			"hips": [
				"mixamorigHips",
				"Hips",
				"pelvis"
			],
			"spine": ["mixamorigSpine", "Spine"],
			"head": ["mixamorigHead", "Head"],
			"lefthand": ["mixamorigLeftHand", "LeftHand"],
			"righthand": ["mixamorigRightHand", "RightHand"],
			"leftfoot": ["mixamorigLeftFoot", "LeftFoot"],
			"rightfoot": ["mixamorigRightFoot", "RightFoot"]
		};
		const sl = sourceName.toLowerCase().replace(/[^a-z]/g, "");
		for (const [key, aliases] of Object.entries(semanticMap)) if (sl.includes(key)) {
			let found = candidates.find((c) => aliases.some((a) => c === a));
			if (found) return found;
		}
		return null;
	}
	/**
	* Build a procedural idle animation clip for a synthetic rig.
	* Creates a subtle breathing/idle sway using the spine and head bones.
	* This ensures bone-less models have at least one visible animation.
	*/
	static buildProceduralIdleClip(syntheticBones) {
		const duration = 2;
		const fps = 30;
		const frameCount = 60;
		const times = [];
		for (let i = 0; i <= frameCount; i++) times.push(i / fps);
		const tracks = [];
		if (syntheticBones.get("mixamorigSpine")) {
			const spineValues = [];
			for (const t of times) {
				const breathe = Math.sin(t * Math.PI) * .015;
				const q = new Quaternion().setFromEuler(new Euler(breathe, 0, 0));
				spineValues.push(q.x, q.y, q.z, q.w);
			}
			tracks.push(new QuaternionKeyframeTrack("mixamorigSpine.quaternion", times, spineValues));
		}
		if (syntheticBones.get("mixamorigHead")) {
			const headValues = [];
			for (const t of times) {
				const nod = Math.sin(t * Math.PI) * .02;
				const q = new Quaternion().setFromEuler(new Euler(nod, 0, 0));
				headValues.push(q.x, q.y, q.z, q.w);
			}
			tracks.push(new QuaternionKeyframeTrack("mixamorigHead.quaternion", times, headValues));
		}
		const hipsBone = syntheticBones.get("mixamorigHips");
		if (hipsBone) {
			const hipPos = new Vector3();
			hipsBone.getWorldPosition(hipPos);
			const hipsValues = [];
			for (const t of times) {
				const bob = Math.sin(t * Math.PI * 2) * .008;
				hipsValues.push(hipPos.x, hipPos.y + bob, hipPos.z);
			}
			tracks.push(new VectorKeyframeTrack("mixamorigHips.position", times, hipsValues));
		}
		return new AnimationClip("idle", duration, tracks);
	}
};
/**
* AnimationIntegrityGate.ts
* ─────────────────────────────────────────────────────────────────────────────
* Per-fighter animation integrity gate.
*
* Clip source classification:
*   AUTHORED_CLIP           — real authored animation from the GLB asset
*   RETARGETED_AUTHORED_CLIP — authored clip retargeted from a different skeleton
*   PLACEHOLDER_TEST_CLIP   — procedural placeholder (pipeline test only)
*   MISSING_CLIP            — no usable animation for this semantic state
*
* Integrity verdicts:
*   PASS      — real authored/retargeted animation deforming the visible mesh
*   TEST_ONLY — procedural placeholder successfully drives mixer
*   BLOCKED   — no usable authored animation
*   UNKNOWN   — insufficient evidence
*
* UNKNOWN is never PASS.
* ─────────────────────────────────────────────────────────────────────────────
*/
/**
* Classify a clip by its name convention.
* Procedural placeholders are named with the suffix "_procedural_placeholder".
*/
function classifyClipSource(clipName) {
	if (!clipName) return "MISSING_CLIP";
	const lc = clipName.toLowerCase();
	if (lc.includes("procedural_placeholder") || lc.includes("_placeholder")) return "PLACEHOLDER_TEST_CLIP";
	if (lc.includes("retargeted") || lc.includes("_retarget")) return "RETARGETED_AUTHORED_CLIP";
	return "AUTHORED_CLIP";
}
var TRAVEL_BONES = [
	"Hips",
	"mixamorigHips",
	"RightHand",
	"mixamorigRightHand",
	"LeftHand",
	"mixamorigLeftHand",
	"RightFoot",
	"mixamorigRightFoot",
	"LeftFoot",
	"mixamorigLeftFoot",
	"Head",
	"mixamorigHead",
	"Spine",
	"mixamorigSpine"
];
function runAnimationIntegrityGate(input) {
	const { characterName, clonedScene, mixer, actions, activeClipName } = input;
	const logLines = [];
	const failingChecks = [];
	const warningChecks = [];
	const log = (line) => {
		logLines.push(line);
		console.log(line);
	};
	log(`\n${"═".repeat(60)}`);
	log(`ANIMATION INTEGRITY GATE — ${characterName}`);
	log("═".repeat(60));
	let visibleMeshCount = 0;
	let skinnedMeshCount = 0;
	let skeletonBoneCount = 0;
	const allBoneNames = [];
	clonedScene.traverse((child) => {
		const mesh = child;
		const skinnedMesh = child;
		const bone = child;
		if (mesh.isMesh) visibleMeshCount++;
		if (skinnedMesh.isSkinnedMesh) skinnedMeshCount++;
		if (bone.isBone) {
			skeletonBoneCount++;
			allBoneNames.push(bone.name);
		}
	});
	log(`  VISIBLE MESHES:   ${visibleMeshCount}`);
	log(`  SKINNED MESHES:   ${skinnedMeshCount}`);
	log(`  SKELETON BONES:   ${skeletonBoneCount}`);
	if (visibleMeshCount === 0) {
		failingChecks.push("NO_VISIBLE_MESH");
		log(`  ❌ NO_VISIBLE_MESH — nothing to render`);
	}
	if (skinnedMeshCount === 0) {
		warningChecks.push("NO_SKINNED_MESH");
		log(`  ⚠️  NO_SKINNED_MESH — mesh cannot deform via skeleton`);
	}
	if (skeletonBoneCount === 0) {
		warningChecks.push("NO_SKELETON");
		log(`  ⚠️  NO_SKELETON — no bones found in cloned scene`);
	}
	const clipNames = Object.keys(actions);
	const animationClipCount = clipNames.length;
	let totalTrackCount = 0;
	let resolvedTrackCount = 0;
	let unresolvedTrackCount = 0;
	const unresolvedTrackNames = [];
	const clipSources = [];
	let authoredClipCount = 0;
	let retargetedClipCount = 0;
	let placeholderClipCount = 0;
	let missingClipCount = 0;
	const objectNameSet = /* @__PURE__ */ new Set();
	clonedScene.traverse((child) => {
		if (child.name) objectNameSet.add(child.name);
	});
	for (const clipName of clipNames) {
		const action = actions[clipName];
		if (!action) continue;
		const clip = action.getClip();
		const sourceType = classifyClipSource(clipName);
		let clipResolved = 0;
		let clipTotal = 0;
		for (const track of clip.tracks) {
			totalTrackCount++;
			clipTotal++;
			const dotIdx = track.name.lastIndexOf(".");
			const withoutProp = dotIdx !== -1 ? track.name.slice(0, dotIdx) : track.name;
			const pipeIdx = withoutProp.lastIndexOf("|");
			const targetName = pipeIdx !== -1 ? withoutProp.slice(pipeIdx + 1) : withoutProp;
			if (objectNameSet.has(targetName)) {
				resolvedTrackCount++;
				clipResolved++;
			} else {
				unresolvedTrackCount++;
				if (unresolvedTrackNames.length < 10) unresolvedTrackNames.push(`${clipName}::${targetName}`);
			}
		}
		clipSources.push({
			clipName,
			sourceType,
			trackCount: clipTotal,
			resolvedTracks: clipResolved
		});
		switch (sourceType) {
			case "AUTHORED_CLIP":
				authoredClipCount++;
				break;
			case "RETARGETED_AUTHORED_CLIP":
				retargetedClipCount++;
				break;
			case "PLACEHOLDER_TEST_CLIP":
				placeholderClipCount++;
				break;
			case "MISSING_CLIP": missingClipCount++;
		}
	}
	log(`  ANIMATION CLIPS:  ${animationClipCount}`);
	log(`    AUTHORED:        ${authoredClipCount}`);
	log(`    RETARGETED:      ${retargetedClipCount}`);
	log(`    PLACEHOLDER:     ${placeholderClipCount}${placeholderClipCount > 0 ? " ⚠️  (pipeline test only — not real animation)" : ""}`);
	log(`    MISSING:         ${missingClipCount}`);
	log(`  TRACKS:           ${totalTrackCount}`);
	log(`  RESOLVED TRACKS:  ${resolvedTrackCount}`);
	log(`  UNRESOLVED TRACKS:${unresolvedTrackCount}`);
	if (animationClipCount === 0) {
		warningChecks.push("NO_ANIMATION_CLIPS");
		log(`  ⚠️  NO_ANIMATION_CLIPS — character will be static (bind pose)`);
		log(`     → Source: check BANNON_rigged.glb / Bannon mocap pipeline`);
	}
	if (placeholderClipCount > 0 && authoredClipCount === 0 && retargetedClipCount === 0) {
		warningChecks.push("ONLY_PLACEHOLDER_CLIPS");
		log(`  ⚠️  ONLY_PLACEHOLDER_CLIPS — no authored/retargeted clips present`);
		log(`     → Pipeline test mode only. Statues are NOT fixed.`);
		log(`     → Required: real BANNON_rigged.glb + authored animation clips`);
	}
	if (unresolvedTrackCount > 0) {
		warningChecks.push("UNRESOLVED_TRACKS");
		log(`  ⚠️  UNRESOLVED_TRACKS — ${unresolvedTrackCount} track(s) target bones not in skeleton`);
		unresolvedTrackNames.forEach((t) => log(`     • ${t}`));
		if (allBoneNames.length > 0) log(`     Available bones (${allBoneNames.length}): ${allBoneNames.slice(0, 8).join(", ")}${allBoneNames.length > 8 ? ` +${allBoneNames.length - 8} more` : ""}`);
	}
	let resolvedActiveClipName = activeClipName ?? null;
	let activeClipDuration = null;
	let mixerUpdateCount = 0;
	for (const [name, action] of Object.entries(actions)) if (action?.isRunning()) {
		resolvedActiveClipName = name;
		activeClipDuration = action.getClip().duration;
		mixerUpdateCount++;
	}
	const activeClipSourceType = resolvedActiveClipName ? classifyClipSource(resolvedActiveClipName) : "MISSING_CLIP";
	log(`  ACTIVE CLIP:      ${resolvedActiveClipName ?? "NONE"} [${activeClipSourceType}]`);
	if (activeClipDuration !== null) log(`  CLIP DURATION:    ${activeClipDuration.toFixed(3)}s`);
	const mixerRootIsVisibleClone = mixer._root === clonedScene;
	log(`  MIXER ROOT:       ${mixerRootIsVisibleClone ? "visible clone ✅" : "WRONG OBJECT ❌"}`);
	if (!mixerRootIsVisibleClone) {
		failingChecks.push("MIXER_WRONG_ROOT");
		log(`  ❌ MIXER_WRONG_ROOT — mixer is not targeting the visible cloned scene`);
	}
	const boneTravel = [];
	let maxBoneTravelMetres = 0;
	let maxBoneRotationDegrees = 0;
	if (animationClipCount > 0 && resolvedActiveClipName) {
		const bonesToMeasure = [];
		clonedScene.traverse((child) => {
			const bone = child;
			if (!bone.isBone) return;
			const normalizedName = bone.name.replace(/^mixamorig/, "");
			if (TRAVEL_BONES.some((tb) => tb === bone.name || tb.replace(/^mixamorig/, "") === normalizedName)) bonesToMeasure.push(bone);
		});
		clonedScene.updateMatrixWorld(true);
		const beforePositions = /* @__PURE__ */ new Map();
		const beforeQuaternions = /* @__PURE__ */ new Map();
		for (const bone of bonesToMeasure) {
			beforePositions.set(bone.uuid, bone.getWorldPosition(new Vector3()));
			beforeQuaternions.set(bone.uuid, bone.getWorldQuaternion(new Quaternion()));
		}
		mixer.update(1 / 60);
		clonedScene.updateMatrixWorld(true);
		for (const bone of bonesToMeasure) {
			const posBefore = beforePositions.get(bone.uuid);
			const quatBefore = beforeQuaternions.get(bone.uuid);
			const posAfter = bone.getWorldPosition(new Vector3());
			const quatAfter = bone.getWorldQuaternion(new Quaternion());
			const distMetres = posBefore.distanceTo(posAfter);
			const dotProduct = Math.abs(quatBefore.dot(quatAfter));
			const rotDegrees = 2 * Math.acos(Math.min(1, dotProduct)) * 180 / Math.PI;
			boneTravel.push({
				boneName: bone.name,
				positionBefore: posBefore,
				positionAfter: posAfter,
				distanceMetres: distMetres,
				rotationDegrees: rotDegrees
			});
			if (distMetres > maxBoneTravelMetres) maxBoneTravelMetres = distMetres;
			if (rotDegrees > maxBoneRotationDegrees) maxBoneRotationDegrees = rotDegrees;
		}
		mixer.update(-1 / 60);
		clonedScene.updateMatrixWorld(true);
		log(`  BONE TRAVEL:      max=${maxBoneTravelMetres.toFixed(4)}m / ${maxBoneRotationDegrees.toFixed(2)}°`);
		if (maxBoneTravelMetres < 1e-4 && maxBoneRotationDegrees < .01) {
			warningChecks.push("ZERO_BONE_TRAVEL");
			log(`  ⚠️  ZERO_BONE_TRAVEL — bones did not move during mixer tick`);
		} else log(`  ${activeClipSourceType === "PLACEHOLDER_TEST_CLIP" ? "⚠️  Bone motion detected (PLACEHOLDER only — not authored deformation)" : "✅ Bone motion detected — animation is reaching the skeleton"}`);
	} else log(`  BONE TRAVEL:      SKIPPED (no active clip or no animation clips)`);
	let verdict;
	if (failingChecks.length > 0) verdict = "BLOCKED";
	else if (warningChecks.includes("NO_SKINNED_MESH") || warningChecks.includes("NO_SKELETON") || warningChecks.includes("NO_ANIMATION_CLIPS") || warningChecks.includes("ZERO_BONE_TRAVEL")) verdict = "UNKNOWN";
	else if (warningChecks.includes("ONLY_PLACEHOLDER_CLIPS") || placeholderClipCount > 0 && authoredClipCount === 0 && retargetedClipCount === 0) verdict = "TEST_ONLY";
	else if (authoredClipCount > 0 || retargetedClipCount > 0) verdict = "PASS";
	else verdict = "UNKNOWN";
	log(`  VERDICT:          ${verdict === "PASS" ? "✅" : verdict === "TEST_ONLY" ? "🧪" : verdict === "BLOCKED" ? "❌" : "⚠️ "} ${verdict}`);
	if (verdict === "TEST_ONLY") {
		log(`  → TEST_ONLY: procedural placeholder successfully drives mixer`);
		log(`  → This is NOT a fix for the statue problem.`);
		log(`  → Required for PASS: real AUTHORED_CLIP or RETARGETED_AUTHORED_CLIP`);
	}
	if (verdict === "UNKNOWN") log(`  → UNKNOWN is not PASS. Fix the warnings above before declaring success.`);
	if (verdict === "BLOCKED") {
		log(`  → BLOCKED: ${failingChecks.join(", ")}`);
		log(`  → Fix the source GLB asset. Do NOT generate synthetic rigging at runtime.`);
	}
	if (verdict === "PASS") log(`  → PASS: real authored/retargeted animation deforming the visible mesh`);
	log("═".repeat(60) + "\n");
	return {
		characterName,
		timestamp: (/* @__PURE__ */ new Date()).toISOString(),
		visibleMeshCount,
		skinnedMeshCount,
		skeletonBoneCount,
		animationClipCount,
		totalTrackCount,
		resolvedTrackCount,
		unresolvedTrackCount,
		unresolvedTrackNames,
		clipSources,
		authoredClipCount,
		retargetedClipCount,
		placeholderClipCount,
		missingClipCount,
		activeClipName: resolvedActiveClipName,
		activeClipSourceType,
		activeClipDuration,
		mixerRootIsVisibleClone,
		mixerUpdateCount,
		boneTravel,
		maxBoneTravelMetres,
		maxBoneRotationDegrees,
		verdict,
		failingChecks,
		warningChecks,
		logLines
	};
}
//#endregion
export { classifyClipSource as n, runAnimationIntegrityGate as r, AutoRigDetector as t };
