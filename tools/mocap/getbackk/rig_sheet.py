"""Pose the Bannon rig (BANNON_rigged.glb, mixamorig skeleton) with the clips' bones{} exactly as the
engine consumes them (local = restQuat * Euler(rx,ry,rz,'XYZ')), FK, and draw both halves next to the
source frame at the same time. Pelvis-relative clips: each body is drawn about its own hips."""
import json, sys, numpy as np, cv2
from pygltflib import GLTF2
g=GLTF2().load('/workspace/vten-stages/public/models/BANNON_rigged.glb')
nodes=g.nodes; idx={n.name:i for i,n in enumerate(nodes)}
parent={}
for i,n in enumerate(nodes):
    for c in (n.children or []): parent[c]=i
def qmul(a,b):
    ax,ay,az,aw=a; bx,by,bz,bw=b
    return np.array([aw*bx+ax*bw+ay*bz-az*by, aw*by-ax*bz+ay*bw+az*bx, aw*bz+ax*by-ay*bx+az*bw, aw*bw-ax*bx-ay*by-az*bz])
def qeuler(x,y,z):  # THREE XYZ order
    c1,c2,c3=np.cos([x/2,y/2,z/2]); s1,s2,s3=np.sin([x/2,y/2,z/2])
    return np.array([s1*c2*c3+c1*s2*s3, c1*s2*c3-s1*c2*s3, c1*c2*s3+s1*s2*c3, c1*c2*c3-s1*s2*s3])
def qmat(q):
    x,y,z,w=q
    return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def local(i,bones):
    n=nodes[i]; t=np.array(n.translation or [0,0,0.]); r=np.array(n.rotation or [0,0,0,1.]); s=np.array(n.scale or [1,1,1.])
    b=bones.get(n.name)
    if b: r=qmul(r,qeuler(b['rx'],b['ry'],b['rz']))
    M=np.eye(4); M[:3,:3]=qmat(r)*s; M[:3,3]=t; return M
BODY=['mixamorig:'+x for x in ['Hips','Spine','Spine1','Spine2','Neck','Head','LeftShoulder','LeftArm','LeftForeArm','LeftHand',
      'RightShoulder','RightArm','RightForeArm','RightHand','LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase','RightUpLeg','RightLeg','RightFoot','RightToeBase']]
hips=idx['mixamorig:Hips']
def world(bones):
    W={}
    def wm(i):
        if i in W: return W[i]
        M=local(i,bones)
        if i!=hips and i in parent: M=wm(parent[i])@M
        W[i]=M; return M
    P={nm:wm(idx[nm])[:3,3] for nm in BODY}
    return P
def keyat(c,t):
    ks=c['keys']; ts=[k['t'] for k in ks]; j=int(np.argmin([abs(x-t) for x in ts])); return ks[j]
def draw(P,size,col,view):
    img=np.full((size,size,3),24,np.uint8)
    pts=np.array(list(P.values())); c=P['mixamorig:Hips']
    sc=size*0.33/ (np.linalg.norm(P['mixamorig:Head']-c)+1e-6) if False else None
    ref=world({})  # rest height for a fixed scale
    h=np.linalg.norm(ref['mixamorig:Head']-ref['mixamorig:Hips']); sc=size*0.30/h
    def pr(p):
        q=p-c; a=q[0] if view=='side' else q[2]
        return (int(size/2+a*sc), int(size/2-q[1]*sc))
    for nm in BODY:
        i=idx[nm]; pi=parent.get(i)
        if pi is None or nodes[pi].name not in P or nm=='mixamorig:Hips': continue
        cl=(90,200,255) if 'Left' in nm else col
        cv2.line(img,pr(P[nodes[pi].name]),pr(P[nm]),cl,3)
    cv2.circle(img,pr(P['mixamorig:Head']),9,(255,220,120),2)
    return img
A=json.load(open(sys.argv[1])); R=json.load(open(sys.argv[2])); times=[float(x) for x in sys.argv[3].split(',')]
cap=cv2.VideoCapture(sys.argv[4]); frames=[]
while True:
    ok,f=cap.read()
    if not ok: break
    frames.append(f)
S=300; cols=[]
for t in times:
    fr=cv2.resize(frames[min(len(frames)-1,int(round(t*30)))],(int(S*576/1024),S))
    tiles=[fr]
    for c,col,lab in ((A,(120,255,140),'GETBACKK'),(R,(80,120,255),'__RECV')):
        k=keyat(c,t); P=world(k['bones'])
        for view in ('side','front'):
            im=draw(P,S,col,view); cv2.putText(im,'%s %s'%(lab,view),(6,18),0,0.5,(220,220,220),1); tiles.append(im)
    row=np.hstack(tiles); cv2.putText(row,'t=%.2fs'%t,(6,S-10),0,0.8,(0,255,255),2); cols.append(row)
cv2.imwrite(sys.argv[5],np.vstack(cols)); print(sys.argv[5])
