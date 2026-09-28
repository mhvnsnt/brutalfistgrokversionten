import * as THREE from 'three';
import { normalizeUniversalAnimation } from './UniversalAnimationPipeline.ts';

interface EulerFile { dur:number; keys:Array<{t:number;bones:Record<string,{rx:number;ry:number;rz:number}>}>; }

export async function recoverBannonEulerClip(name:string,targetRoot:THREE.Object3D):Promise<THREE.AnimationClip|null>{
  const response=await fetch('/motion/'+encodeURIComponent(name)+'.json',{cache:'no-cache'});
  if(!response.ok) return null;
  const data=await response.json() as EulerFile;
  if(!Array.isArray(data.keys)||!data.keys.length) return null;
  const sourceRest=new Map<string,THREE.Quaternion>();
  const first=data.keys[0]?.bones??{};
  for(const [bone,e] of Object.entries(first)) sourceRest.set(bone,new THREE.Quaternion().setFromEuler(new THREE.Euler(e.rx,e.ry,e.rz,'XYZ')));
  const names=new Set(Object.keys(first));
  const tracks:THREE.KeyframeTrack[]=[];
  for(const bone of names){
    const times:number[]=[]; const values:number[]=[];
    for(const key of data.keys){const e=key.bones[bone]; if(!e) continue; const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(e.rx,e.ry,e.rz,'XYZ')); times.push(key.t); values.push(q.x,q.y,q.z,q.w);}
    if(times.length>1) tracks.push(new THREE.QuaternionKeyframeTrack(bone+'.quaternion',times,values));
  }
  const source=new THREE.AnimationClip(name,data.dur,tracks);
  const result=normalizeUniversalAnimation({clip:source,sourceRest},targetRoot);
  if(!result.clip || result.verdict==='REJECTED_NO_MOTION' || result.verdict.startsWith('REJECTED_')) return null;
  result.clip.userData={...result.clip.userData,recoveredFromSource:true,recoveryVerdict:result.verdict};
  return result.clip;
}
