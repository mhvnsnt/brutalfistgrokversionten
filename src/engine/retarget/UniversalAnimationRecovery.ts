import * as THREE from 'three';
import { normalizeUniversalAnimation } from './UniversalAnimationPipeline.ts';

let sourceIndexPromise:Promise<Record<string,{file:string}>>|null=null;
async function sourceFileFor(name:string):Promise<string|null>{
  sourceIndexPromise ??= fetch('/motion/index.json',{cache:'force-cache'}).then(r=>r.ok?r.json():{}).catch(()=>({}));
  const index=await sourceIndexPromise;
  const file=index?.[name]?.file;
  return typeof file==='string'?file:null;
}

interface EulerFile { dur:number; keys:Array<{t:number;bones:Record<string,{rx:number;ry:number;rz:number}>}>; }

export function isCollapsedAnimationClip(clip:THREE.AnimationClip,minMovingBones=3):boolean{
  const seen=new Set<string>();
  for(const track of clip.tracks){
    if(!track.name.endsWith('.quaternion')) continue;
    const v=track.values; let widest=0;
    for(let i=4;i+3<v.length;i+=4){const dot=Math.min(1,Math.abs(v[i]*v[0]+v[i+1]*v[1]+v[i+2]*v[2]+v[i+3]*v[3])); widest=Math.max(widest,Math.acos(dot)*2*180/Math.PI);}
    if(widest>5) seen.add(track.name);
  }
  return seen.size<minMovingBones;
}

export async function recoverBannonEulerClip(name:string,targetRoot:THREE.Object3D):Promise<THREE.AnimationClip|null>{
  const file=await sourceFileFor(name);\n  if(!file) return null;\n  const response=await fetch('/motion/'+encodeURIComponent(file),{cache:'no-cache'});
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
