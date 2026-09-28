import assert from 'node:assert/strict';
import { describe,it } from 'node:test';
import * as THREE from 'three';
import { normalizeUniversalAnimation } from './UniversalAnimationPipeline.ts';
function rig(names:string[]){const root=new THREE.Object3D(); let parent:THREE.Object3D=root; for(const name of names){const b=new THREE.Bone(); b.name=name; parent.add(b); parent=b;} return root;}
function clip(name:string,bones:string[]){return new THREE.AnimationClip(name,1,bones.map((b,i)=>new THREE.QuaternionKeyframeTrack(b+'.quaternion',[0,1],[0,0,0,1,0,Math.sin((i+1)*0.2),0,Math.cos((i+1)*0.2)])));}
describe('universal animation intake',()=>{it('maps aliases and fills unmentioned target bones',()=>{const target=rig(['Hips','Spine','Chest','Neck','Head','LUpperArm','RUpperArm']);const result=normalizeUniversalAnimation({clip:clip('ual',['mixamorigHips','mixamorigSpine','mixamorigLeftArm'])},target);assert.equal(result.verdict,'PARTIAL');assert.ok(result.missingBones.length>0);assert.ok(result.clip);});it('refuses multi-performer captures',()=>{const target=rig(['Hips','Spine']);const result=normalizeUniversalAnimation({clip:clip('tag',['Hips']),bodies:2},target);assert.equal(result.verdict,'REJECTED_MULTI_BODY');assert.equal(result.clip,null);});it('never turns a frozen source into a pass',()=>{const target=rig(['Hips','Spine']);const frozen=new THREE.AnimationClip('frozen',1,[new THREE.QuaternionKeyframeTrack('Hips.quaternion',[0,1],[0,0,0,1,0,0,0,1])]);const result=normalizeUniversalAnimation({clip:frozen},target);assert.equal(result.verdict,'REJECTED_NO_MOTION');});});
describe('universal intake source rest', () => {
  it('honours sourceRest for non-canonical bones by exact name (no frame-0 snap to bind)', () => {
    // Spine1 has no canonical alias. Before the fix its rest fell back to
    // frame 0, so a clip whose first frame is bent came out at bind.
    const target = rig(['mixamorigHips', 'mixamorigSpine', 'mixamorigSpine1']);
    const bent = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.6);
    const tr = new THREE.QuaternionKeyframeTrack('mixamorigSpine1.quaternion', [0, 1], [bent.x, bent.y, bent.z, bent.w, 0, 0, 0, 1]);
    const src = new THREE.AnimationClip('bent', 1, [tr]);
    const rest = new Map([['mixamorigSpine1', new THREE.Quaternion()]]);
    const result = normalizeUniversalAnimation({ clip: src, sourceRest: rest }, target);
    const out = result.clip!.tracks.find((t) => t.name === 'mixamorigSpine1.quaternion')!;
    const q0 = new THREE.Quaternion(out.values[0], out.values[1], out.values[2], out.values[3]);
    assert.ok(q0.angleTo(bent) < 1e-4, `frame 0 must keep the authored bend, got ${q0.angleTo(bent)}`);
  });
});
