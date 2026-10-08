import assert from 'node:assert/strict';
import { describe,it } from 'node:test';
import * as THREE from 'three';
import { applyStandability, clipAnimates, clipKeepsFacing, frozenClips, selectCoreBakedNames } from './BakedMotionBank.ts';

describe('baked motion startup selection',()=>{
  it('prioritizes combat owners and paired receivers',()=>{
    const manifest={
      IDLE:{file:'IDLE.json',bank:'bannon',dur:1,bones:58,semantic:'idle',owns:true},
      TAUNT:{file:'TAUNT.json',bank:'bannon',dur:1,bones:58,semantic:'taunt'},
      THROW:{file:'THROW.json',bank:'bannon',dur:1,bones:58,semantic:'grapple',owns:true,pairedWith:['THROW_REC']},
      THROW_REC:{file:'THROW_REC.json',bank:'bannon',dur:1,bones:58,semantic:'grapple',receives:true},
    };
    const names=selectCoreBakedNames(manifest);
    assert.ok(names.includes('IDLE'));
    assert.ok(names.includes('THROW'));
    assert.ok(names.includes('THROW_REC'));
    assert.ok(!names.includes('TAUNT'));
  });

  it('quarantines Hurricane Kick when its measured capture only moves one bone',()=>{
    applyStandability({
      HURRICANE_KICK:{
        file:'HURRICANE_KICK.json',
        bank:'bannon',
        dur:1.8333,
        bones:22,
        boneCount:22,
        movingBones:1,
        semantic:'attack_2',
        airborne:true,
        travels:0.67,
        floorGap:0.029,
        strike:{
          fwd:0.95,
          reach:0.991,
          reachExtent:0.8046,
          faceMin:-0.999,
          startUp:1,
          endUp:1,
        },
      },
    });
    assert.equal(clipAnimates('HURRICANE_KICK'),false);
    assert.ok(frozenClips().has('HURRICANE_KICK'));
    assert.equal(clipKeepsFacing('HURRICANE_KICK'),true);
  });
  it('uses the loaded quaternion tracks when the committed moving-bone count is stale',()=>{
    const tracks=[];
    for(let i=0;i<8;i++){
      const q0=[0,0,0,1];
      const q1=i<3?[0,Math.sin(Math.PI/8),0,Math.cos(Math.PI/8)]:q0;
      tracks.push(new THREE.QuaternionKeyframeTrack(`bone${i}.quaternion`,[0,1],[...q0,...q1]));
    }
    const clip=new THREE.AnimationClip('STALE_MANIFEST_CLIP',1,tracks);
    applyStandability({STALE_MANIFEST_CLIP:{file:'STALE.json',bank:'bannon',dur:1,bones:22,boneCount:22,movingBones:0,semantic:'walk_forward'}});
    assert.equal(clipAnimates('STALE_MANIFEST_CLIP',clip),true);
  });

});
