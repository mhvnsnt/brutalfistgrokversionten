import * as THREE from 'three';
import { bindClipTracksToTargetBones, resolveToCanonicalBone } from './AnimationRetargeter.ts';
import { makeClipBindRelative } from './BindRelativeMotion.ts';

export type UniversalAnimationVerdict = 'PASS' | 'PARTIAL' | 'REJECTED_MULTI_BODY' | 'REJECTED_NO_SKELETON' | 'REJECTED_NO_MOTION' | 'REJECTED_NONFINITE';
export interface UniversalAnimationInput { clip: THREE.AnimationClip; sourceRest?: Map<string, THREE.Quaternion>; bodies?: number; receives?: boolean; }
export interface UniversalAnimationResult { clip: THREE.AnimationClip | null; verdict: UniversalAnimationVerdict; mappedTracks: number; unresolvedTracks: number; targetCoverage: number; missingBones: string[]; movingBones: number; bodyCount: number; receives: boolean; }

export function normalizeUniversalAnimation(input: UniversalAnimationInput, targetRoot: THREE.Object3D): UniversalAnimationResult {
  const bodyCount = Math.max(1, input.bodies ?? 1);
  const receives = Boolean(input.receives);
  if (bodyCount > 1) return { clip:null, verdict:'REJECTED_MULTI_BODY', mappedTracks:0, unresolvedTracks:input.clip.tracks.length, targetCoverage:0, missingBones:[], movingBones:0, bodyCount, receives };
  const targetBones: THREE.Bone[] = [];
  targetRoot.traverse(o => { if ((o as THREE.Bone).isBone) targetBones.push(o as THREE.Bone); });
  if (!targetBones.length) return { clip:null, verdict:'REJECTED_NO_SKELETON', mappedTracks:0, unresolvedTracks:input.clip.tracks.length, targetCoverage:0, missingBones:[], movingBones:0, bodyCount, receives };
  const targetNames = targetBones.map(b => b.name);
  const bound = bindClipTracksToTargetBones(input.clip, targetNames);
  if (!bound.resolvedTracks) return { clip:null, verdict:'PARTIAL', mappedTracks:0, unresolvedTracks:bound.unresolvedTracks, targetCoverage:0, missingBones:targetNames, movingBones:0, bodyCount, receives };
  const targetRest = new Map<string, THREE.Quaternion>();
  for (const bone of targetBones) targetRest.set(bone.name, bone.quaternion.clone());
  const sourceRestInTarget = new Map<string, THREE.Quaternion>();
  if (input.sourceRest) for (const [sourceName,q] of input.sourceRest) { const canonical=resolveToCanonicalBone(sourceName); if (!canonical) continue; const target=targetBones.find(x=>resolveToCanonicalBone(x.name)===canonical); if (target) sourceRestInTarget.set(target.name,q.clone()); }
  const relative = makeClipBindRelative(bound.clip, targetRest, sourceRestInTarget);
  if (!relative) return { clip:null, verdict:'PARTIAL', mappedTracks:bound.resolvedTracks, unresolvedTracks:bound.unresolvedTracks, targetCoverage:0, missingBones:targetNames, movingBones:0, bodyCount, receives };
  for (const track of relative.tracks) for (const value of track.values) if (!Number.isFinite(value)) return { clip:null, verdict:'REJECTED_NONFINITE', mappedTracks:bound.resolvedTracks, unresolvedTracks:bound.unresolvedTracks, targetCoverage:0, missingBones:[], movingBones:0, bodyCount, receives };
  const byBone = new Map<string, THREE.KeyframeTrack>();
  for (const track of relative.tracks) { const dot=track.name.lastIndexOf('.'); if (dot>0) byBone.set(track.name.slice(0,dot),track); }
  const duration=Math.max(0.0001,relative.duration); const tracks=[...relative.tracks]; const missingBones:string[]=[];
  for (const bone of targetBones) { if (byBone.has(bone.name)) continue; const q=targetRest.get(bone.name)!; tracks.push(new THREE.QuaternionKeyframeTrack(bone.name+'.quaternion',[0,duration],[q.x,q.y,q.z,q.w,q.x,q.y,q.z,q.w])); missingBones.push(bone.name); }
  const out=new THREE.AnimationClip(relative.name,duration,tracks);
  out.userData={...((relative as THREE.AnimationClip & {userData?:Record<string,unknown>}).userData??{}),universalIntake:true,sourceTrackCount:input.clip.tracks.length,mappedTracks:bound.resolvedTracks,unresolvedTracks:bound.unresolvedTracks,restFilledBones:missingBones.length,bodyCount,receives};
  const animated=new Set<string>();
  for (const track of relative.tracks) { if (!track.name.endsWith('.quaternion')) continue; let widest=0; const v=track.values; for(let i=4;i+3<v.length;i+=4){const dot=Math.min(1,Math.abs(v[i]*v[0]+v[i+1]*v[1]+v[i+2]*v[2]+v[i+3]*v[3])); widest=Math.max(widest,Math.acos(dot)*2*180/Math.PI);} if(widest>5) animated.add(track.name); }
  const coverage=targetNames.length?byBone.size/targetNames.length:0;
  const verdict:UniversalAnimationVerdict=animated.size===0?'REJECTED_NO_MOTION':missingBones.length?'PARTIAL':'PASS';
  return {clip:out,verdict,mappedTracks:bound.resolvedTracks,unresolvedTracks:bound.unresolvedTracks,targetCoverage:coverage,missingBones,movingBones:animated.size,bodyCount,receives};
}
