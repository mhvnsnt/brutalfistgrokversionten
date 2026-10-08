"""Render BAKED engine clips (public/motion/baked/<NAME>.json: absolute local quaternions on the canonical
BANNON_rigged.glb skeleton, exactly what the runtime plays) with FK. Rig space: up=+y, Left bones on +z, forward (toes)=+x.
usage: baked_sheet.py ATK RECV times(comma) out.png [video lo]"""
import json, sys, numpy as np, cv2
from pygltflib import GLTF2
g=GLTF2().load('/workspace/vten-stages/public/models/BANNON_rigged.glb')
nodes=g.nodes; idx={n.name:i for i,n in enumerate(nodes)}; parent={}
for i,n in enumerate(nodes):
    for c in (n.children or []): parent[c]=i
def qmat(q):
    x,y,z,w=q/np.linalg.norm(q)
    return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def samp(tr,key,t,dim):
    ts=np.array(tr['t']); v=np.array(tr[key]).reshape(-1,dim)
    if t<=ts[0]: return v[0]
    if t>=ts[-1]: return v[-1]
    j=np.searchsorted(ts,t); a=(t-ts[j-1])/(ts[j]-ts[j-1]+1e-9); r=v[j-1]*(1-a)+v[j]*a
    return r
BODY=['Hips','Spine','Spine1','Spine2','Neck','Head','LeftShoulder','LeftArm','LeftForeArm','LeftHand','RightShoulder','RightArm','RightForeArm','RightHand','LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase','RightUpLeg','RightLeg','RightFoot','RightToeBase']
hips=idx['mixamorig:Hips']
def world(clip,t):
    W={}
    def wm(i):
        if i in W: return W[i]
        n=nodes[i]; nm=n.name.replace(':','')
        tr=np.array(n.translation or [0,0,0.]); r=np.array(n.rotation or [0,0,0,1.]); s=np.array(n.scale or [1,1,1.])
        if clip and nm in clip['tracks']: r=samp(clip['tracks'][nm],'q',t,4)
        M=np.eye(4); M[:3,:3]=qmat(r)*s; M[:3,3]=tr
        if i!=hips and i in parent: M=wm(parent[i])@M
        W[i]=M; return M
    return {b:wm(idx['mixamorig:'+b])[:3,3] for b in BODY}
EDGES=[('Hips','Spine'),('Spine','Spine1'),('Spine1','Spine2'),('Spine2','Neck'),('Neck','Head'),('Spine2','LeftShoulder'),('LeftShoulder','LeftArm'),('LeftArm','LeftForeArm'),('LeftForeArm','LeftHand'),('Spine2','RightShoulder'),('RightShoulder','RightArm'),('RightArm','RightForeArm'),('RightForeArm','RightHand'),('Hips','LeftUpLeg'),('LeftUpLeg','LeftLeg'),('LeftLeg','LeftFoot'),('LeftFoot','LeftToeBase'),('Hips','RightUpLeg'),('RightUpLeg','RightLeg'),('RightLeg','RightFoot'),('RightFoot','RightToeBase')]
ref=world(None,0); H=np.linalg.norm(ref['Head']-ref['Hips'])
def draw(P,size,col,view,label):
    img=np.full((size,size,3),24,np.uint8); c=P['Hips']; sc=size*0.28/H
    def pr(p):
        q=p-c; a=q[0] if view=='profile' else q[2]   # profile: forward (+x, toes) to the right; front: camera in front sees the Left side (+z) on its right
        return (int(size/2+a*sc), int(size/2-q[1]*sc))
    for a,b in EDGES:
        cc=(80,200,255) if a.startswith('Left') or b.startswith('Left') else col
        cv2.line(img,pr(P[a]),pr(P[b]),cc,3)
    cv2.circle(img,pr(P['Head']),7,(255,255,0),2)
    cv2.putText(img,label,(4,14),cv2.FONT_HERSHEY_SIMPLEX,0.42,(220,220,220),1)
    return img
if __name__=='__main__':
    A=json.load(open(sys.argv[1])); R=json.load(open(sys.argv[2])); times=[float(x) for x in sys.argv[3].split(',')]
    vid=sys.argv[5] if len(sys.argv)>5 else None; lo=int(sys.argv[6]) if len(sys.argv)>6 else 0
    REP=json.load(open(sys.argv[7])) if len(sys.argv)>7 else None
    def status(f):
        if not REP: return ''
        a=REP['CHAINSNATCHER']; r=REP['CHAINSNATCHER__RECV']
        sa='SOLVED' if a['solved_frames'] and a['solved_frames'][0]<=f<=a['solved_frames'][1] else 'tracked'
        sr='interp' if any(g[0]<=f<=g[1] for g in r['interpolated_gaps']) else 'tracked'
        return f'A {sa} / R {sr}'
    S=240; rows=[]
    cap=cv2.VideoCapture(vid) if vid else None
    for t in times:
        PA=world(A,t); PR=world(R,t); tiles=[]
        if cap:
            cap.set(cv2.CAP_PROP_POS_FRAMES, lo+round(t*30)); ok,fr=cap.read()
            fr=cv2.resize(fr,(int(S*fr.shape[1]/fr.shape[0]),S)); cv2.putText(fr,f't={t:.2f}s f{lo+round(t*30)}',(4,S-26),cv2.FONT_HERSHEY_SIMPLEX,0.5,(0,255,255),2); cv2.putText(fr,status(lo+round(t*30)),(4,S-8),cv2.FONT_HERSHEY_SIMPLEX,0.42,(0,0,255) if 'SOLVED' in status(lo+round(t*30)) or 'interp' in status(lo+round(t*30)) else (0,255,0),1); tiles.append(fr)
        tiles+= [draw(PA,S,(90,230,90),'profile','CHAINSNATCHER side'),draw(PA,S,(90,230,90),'front','ATTACKER front'),
                 draw(PR,S,(80,120,255),'profile','__RECV side'),draw(PR,S,(80,120,255),'front','RECEIVER front')]
        rows.append(np.hstack(tiles))
    cv2.imwrite(sys.argv[4],np.vstack(rows)); print(sys.argv[4])
