/**
 * animation_bridge/retarget.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Animation bridge: source registry + measured retarget lane.
 *
 * This module is the integration point between the Bannon animation source
 * registry (SOURCE_REGISTRY.json) and the Three.js runtime.
 *
 * Architecture:
 *   FBX / BVH / animated GLB / owner-granted Bannon motion bank
 *   → source discovery
 *   → normalization (bone name aliases)
 *   → retargeting (AnimationRetargeter)
 *   → bind-relative quaternion correction for Bannon source motion
 *   → AnimationClip creation
 *   → clip validation
 *   → state/action mapping
 *   → AnimationMixer(visibleClone)
 *   → YOUR SKELETON
 *   → MOVING BANNON
 *
 * Three.js architecture notes:
 *   - SkeletonUtils.clone() preserves the cloned skin/bone relationship
 *   - AnimationMixer must be rooted on the object being animated (the visible clone)
 *   - mixer.update(delta) must be called every render frame
 *
 * IDENTITY: Bone names are the stable cross-file identity — NOT UUIDs.
 * UUIDs change every time a scene is cloned.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as THREE from 'three';
import { AnimationRetargeter, type RetargetReport } from '../src/engine/retarget/AnimationRetargeter';
import { validateAnimationChannelBones } from '../src/engine/pipeline/CharacterPipeline';
import {
  SEMANTIC_STATE_ALIASES,
  COMBAT_STATE_TO_SEMANTIC,
} from '../src/engine/retarget/SemanticStateAliases';
import {
  applyBindRelativeQuaternionTracks,
  buildBannonMotionClips,
} from '../src/engine/retarget/BannonMotionBank';

export { SEMANTIC_STATE_ALIASES, COMBAT_STATE_TO_SEMANTIC };

export interface BridgeClipEntry {
  semanticState: string;
  clipName: string;
  clip: THREE.AnimationClip;
  sourceConvention: 'mixamo' | 'fbx' | 'bvh' | 'mocap' | 'native' | 'unknown';
  license: string;
  provenance: string;
}

export interface AnimationBridgeResult {
  clipsByState: Map<string, THREE.AnimationClip>;
  allClips: THREE.AnimationClip[];
  missingStates: string[];
  retargetReport: RetargetReport | null;
  resolvedTrackCount: number;
  unresolvedTrackCount: number;
}

export class AnimationBridge {
  private readonly characterId: string;
  private readonly retargeter: AnimationRetargeter;

  constructor(characterId: string) {
    this.characterId = characterId;
    this.retargeter = new AnimationRetargeter(
      `${characterId}_source`,
      `${characterId}_target`
    );
  }

  build(
    sourceScene: THREE.Object3D,
    targetScene: THREE.Object3D,
    sourceClips: THREE.AnimationClip[]
  ): AnimationBridgeResult {
    const retargetReport = this.retargeter.buildMap(sourceScene, targetScene);

    // The GLB may contain only idle or a partial bank. Reattach the real
    // owner-granted Bannon motion bank instead of rebuilding attacks in code.
    const ownerMotion = buildBannonMotionClips();
    const mergedSourceClips = [
      ...sourceClips,
      ...ownerMotion.filter((ownerClip) => !sourceClips.some(
        (sourceClip) => sourceClip.name.toLowerCase() === ownerClip.name.toLowerCase(),
      )),
    ];

    const { clips: retargetedClipsRaw, totalResolved, totalUnresolved } =
      this.retargeter.retargetClips(mergedSourceClips, this.characterId);

    // Bannon's JSON clips are authored in Mixamo/Euler space. Apply the
    // bind-relative delta only to those imported clips. Existing native GLB
    // clips remain untouched, so fighter world orientation/position stays locked.
    const retargetedClips = retargetedClipsRaw.map((clip) => {
      const sourceType = String((clip as THREE.AnimationClip & { userData?: Record<string, unknown> }).userData?.clipSourceType ?? '');
      return sourceType === 'BANNON_OWNER_MOTION'
        ? applyBindRelativeQuaternionTracks(clip, targetScene)
        : clip;
    });

    validateAnimationChannelBones(targetScene, retargetedClips, this.characterId);

    const clipsByState = new Map<string, THREE.AnimationClip>();
    const missingStates: string[] = [];

    for (const [semanticState, aliases] of Object.entries(SEMANTIC_STATE_ALIASES)) {
      let found = false;
      for (const alias of aliases) {
        const clip = retargetedClips.find(
          (c) => c.name === alias || c.name.toLowerCase() === alias.toLowerCase()
        );
        if (clip) {
          clipsByState.set(semanticState, clip);
          found = true;
          break;
        }
      }
      if (!found) {
        missingStates.push(semanticState);
        console.warn(
          `[AnimationBridge] ⚠️ MISSING_CLIP: "${this.characterId}" has no clip for semantic state "${semanticState}"\n` +
          `  Tried aliases: ${aliases.slice(0, 5).join(', ')}${aliases.length > 5 ? ` +${aliases.length - 5} more` : ''}`
        );
      }
    }

    if (missingStates.length > 0) {
      console.warn(
        `[AnimationBridge] ⚠️ "${this.characterId}" missing ${missingStates.length} semantic state(s): ` +
        missingStates.join(', ')
      );
    }

    return {
      clipsByState,
      allClips: retargetedClips,
      missingStates,
      retargetReport,
      resolvedTrackCount: totalResolved,
      unresolvedTrackCount: totalUnresolved,
    };
  }

  feedToMixer(
    mixer: THREE.AnimationMixer,
    targetScene: THREE.Object3D,
    clips: THREE.AnimationClip[]
  ): Record<string, THREE.AnimationAction> {
    const actions: Record<string, THREE.AnimationAction> = {};

    for (const clip of clips) {
      const action = mixer.clipAction(clip, targetScene);
      actions[clip.name] = action;
    }

    console.log(
      `[AnimationBridge] 🎬 "${this.characterId}" fed ${clips.length} clip(s) to mixer.\n` +
      `  Mixer root: ${(mixer as any)._root?.uuid ?? 'unknown'}\n` +
      `  Actions: [${Object.keys(actions).join(', ')}]`
    );

    return actions;
  }

  static resolveSemanticState(combatState: string): string | null {
    return COMBAT_STATE_TO_SEMANTIC[combatState] ?? null;
  }

  static getClipForCombatState(
    combatState: string,
    clipsByState: Map<string, THREE.AnimationClip>,
  ): THREE.AnimationClip | null {
    const semanticState = COMBAT_STATE_TO_SEMANTIC[combatState];
    if (!semanticState) return null;

    const direct = clipsByState.get(semanticState);
    if (direct) {
      const srcType = String((direct as any).userData?.clipSourceType ?? '');
      const isTestOnly = srcType === 'PLACEHOLDER_TEST_CLIP';
      if (isTestOnly && semanticState !== 'idle') {
        console.warn(
          `[AnimationBridge] ⚠️ PLACEHOLDER_TEST_CLIP for "${semanticState}" is TEST_ONLY — treating as MISSING_CLIP`,
        );
        return null;
      }
      return direct;
    }

    const locomotionFallbacks: Record<string, string[]> = {
      walk_back: ['walk_forward'],
      strafe_left: ['walk_forward'],
      strafe_right: ['walk_forward'],
      backdash: ['walk_back', 'walk_forward'],
      run: ['walk_forward'],
      dash_forward: ['run', 'walk_forward'],
      attack_rp: ['attack_1'],
      attack_lk: ['attack_2', 'attack_rk'],
      attack_rk: ['attack_2', 'attack_lk'],
      attack_2: ['attack_rk', 'attack_lk'],
    };
    const chain = locomotionFallbacks[semanticState] ?? [];
    for (const fb of chain) {
      const fbClip = clipsByState.get(fb);
      if (fbClip) return fbClip;
    }

    console.warn(
      `[AnimationBridge] ⚠️ MISSING_CLIP: combatState="${combatState}" semantic="${semanticState}" — no authored clip`,
    );
    return null;
  }
}
