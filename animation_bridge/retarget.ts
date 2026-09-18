/**
 * animation_bridge/retarget.ts
 * Animation bridge: source registry + measured retarget lane.
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
  BANNON_MOTION_CLIP_NAMES,
  buildBannonMotionClips,
} from '../src/engine/retarget/BannonMotionBank';
import {
  SCHWARZERBLITZ_CLIP_NAMES,
  buildSchwarzerblitzMotionClips,
} from '../src/engine/retarget/SchwarzerblitzMotionBank';

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

    // Reattach the actual owner-granted Bannon motion bank in addition to any
    // clips embedded in the GLB. This restores locomotion, strikes, guard,
    // reactions, grapples, knockdowns and the larger move vocabulary without
    // replacing the fighter's authored world transform.
    const ownerMotion = buildBannonMotionClips();

    // The owner-granted Schwarzerblitz fighting set joins the same merge. It
    // carries locomotion and combat the Bannon bank does not - sidesteps, real
    // guards, jump attacks, throw starts with their receiver halves, landings
    // and getups. Bannon clips keep precedence: a name already present is not
    // replaced, so nothing that works today changes.
    const schwarzerblitzMotion = buildSchwarzerblitzMotionClips();

    const mergedSourceClips = [...sourceClips];
    for (const clip of [...ownerMotion, ...schwarzerblitzMotion]) {
      if (mergedSourceClips.some((existing) => existing.name.toLowerCase() === clip.name.toLowerCase())) continue;
      mergedSourceClips.push(clip);
    }

    const { clips: retargetedClipsRaw, totalResolved, totalUnresolved } =
      this.retargeter.retargetClips(mergedSourceClips, this.characterId);

    // AnimationRetargeter intentionally produces fresh clips, so source
    // metadata is not relied upon here. The generated bank's exact clip names
    // are the stable provenance identity.
    // Both imported banks are bind-relative: their rest pose is not this GLB's,
    // so the motion is re-based onto the target's own bind pose rather than
    // written onto it absolutely. This is the locked orientation contract.
    const retargetedClips = retargetedClipsRaw.map((clip) =>
      BANNON_MOTION_CLIP_NAMES.has(clip.name) || SCHWARZERBLITZ_CLIP_NAMES.has(clip.name)
        ? applyBindRelativeQuaternionTracks(clip, targetScene)
        : clip,
    );

    validateAnimationChannelBones(targetScene, retargetedClips, this.characterId);

    const clipsByState = new Map<string, THREE.AnimationClip>();

    // Keep every real clip addressable by its exact authored name. This is
    // what lets character-specific move slots request BOXING__2_, CAPOEIRA,
    // SUPLEX, etc. instead of collapsing everything into one generic attack.
    for (const clip of retargetedClips) {
      clipsByState.set(clip.name, clip);
    }

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
    // Exact authored move name wins first. This preserves per-character move
    // identities when the state machine supplies a move/animation id.
    const named = clipsByState.get(combatState);
    if (named) return named;

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
