import assert from 'node:assert/strict';
import { describe,it } from 'node:test';
import * as THREE from 'three';
import { normalizeUniversalAnimation } from './UniversalAnimationPipeline.ts';
describe('universal recovery contract',()=>{it('keeps receiver metadata explicit',()=>{const root=new THREE.Object3D();const hips=new THREE.Bone();hips.name='Hips';root.add(hips);const clip=new THREE.AnimationClip('receiver',1,[new THREE.QuaternionKeyframeTrack('Hips.quaternion',[0,1],[0,0,0,1,0,Math.sin(.4),0,Math.cos(.4)])]);const result=normalizeUniversalAnimation({clip,receives:true},root);assert.equal(result.receives,true);assert.equal(result.verdict,'PASS');});});
