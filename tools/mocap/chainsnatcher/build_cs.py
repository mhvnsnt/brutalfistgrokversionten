import pickle, numpy as np, json, sys, os, argparse
sys.path.insert(0,'/workspace/ref-repos/Bannon/tools/mocap')
import video_to_clip as V
import engine_retarget as ER
RT=ER.Retarget()
R=pickle.load(open(os.environ.get('RECON','recon_solved.pkl'),'rb'))
SOLVE=json.load(open('solve_report.json')) if os.path.exists('solve_report.json') else None
RAW=pickle.load(open('recon.pkl','rb'))   # before the solve: what was actually tracked
LO,HI=int(sys.argv[1]),int(sys.argv[2]); KEYS=int(sys.argv[3]); OUT=sys.argv[4]
FPS=30.0; MAXGAP=6
args=argparse.Namespace(smooth=int(os.environ.get("SMOOTH","5")),keys=KEYS)
os.makedirs(OUT,exist_ok=True); prov={}
UPd=np.array([0,-1.0,0]); DN=-UPd
# ── SHARED FACING + CAMERA ORBIT. build_clip / the retarget want the performers' facing on the rig's
# forward axis. Both men face image-left, and the handheld camera ORBITS them during the take: their
# measured facings turn together by ~55 degrees between f96 and f134 (A -95 -> -59, R -109 -> -59 deg;
# measured, see capture_report.json camera_yaw). Kept, that would spin the pair on the spot in game.
# So ONE yaw per frame, the SAME for both bodies (their relative facing is untouched), is removed: the
# mean of both men's measured facings, smoothed (gaussian sigma 4 frames). After the attacker's last
# tracked frame (AEND) neither man has a reliable facing (the attacker is occluded, the receiver is
# falling onto his back), so the last value is held. It is a rigid rotation about the vertical axis per
# frame: no joint moves relative to the body.
AEND=int(os.environ.get('AEND','134'))
def facing(w):
    v=np.cross(w[11]-w[12],(w[11]+w[12])/2-(w[23]+w[24])/2); v[1]=0; return v/np.linalg.norm(v)
NF=len(R['A']); yaw_raw={}
for i in range(LO,min(AEND,HI)+1):
    fs=[facing(RAW[r][i]) for r in 'AR' if RAW[r][i] is not None]
    if fs:
        m=np.mean(fs,0); yaw_raw[i]=float(np.arctan2(m[0],-m[2]))
ks=sorted(yaw_raw); uw=np.unwrap([yaw_raw[k] for k in ks])
yaw={}
for i in range(LO,HI+1):
    j=min(i,ks[-1]); wts=np.exp(-0.5*((np.array(ks)-j)/4.0)**2); yaw[i]=float(np.sum(wts*uw)/np.sum(wts))
def YAWM(ang):
    c_,s_=np.cos(-ang),np.sin(-ang)
    return np.array([[c_,0,-s_],[0,1,0],[s_,0,c_]])   # rotation about y taking yaw `ang` to (0,0,-1)
fw0=np.array([np.sin(yaw[LO]),0,-np.cos(yaw[LO])]); assert np.allclose(YAWM(yaw[LO])@fw0,[0,0,-1],atol=1e-6)
for r in 'AR':
    for i in range(LO,HI+1):
        Y=YAWM(yaw[i])
        if R[r][i] is not None: R[r][i]=R[r][i]@Y.T
        if RAW[r][i] is not None: RAW[r][i]=RAW[r][i]@Y.T
CAMYAW={'frames':[LO,HI],'held_after':min(AEND,HI),'deg':[round(float(np.degrees(yaw[i])),1) for i in range(LO,HI+1)]}
print('camera/common yaw removed: %.1f -> %.1f deg (held after f%d)'%(np.degrees(yaw[LO]),np.degrees(yaw[HI]),min(AEND,HI)))
def nrm(v): return v/np.linalg.norm(v)
for role,key in (('A','CHAINSNATCHER'),('R','CHAINSNATCHER__RECV')):
    seq=R[role][LO:HI+1]
    idx=[i for i,w in enumerate(seq) if w is not None]
    if idx[0]!=0 or idx[-1]!=len(seq)-1: raise SystemExit('%s: window edge untracked'%role)
    gaps=[]
    for a,b in zip(idx,idx[1:]):
        g=b-a-1
        if g==0: continue
        if g>MAXGAP: raise SystemExit('%s: gap of %d frames at %d..%d exceeds %d'%(role,g,LO+a+1,LO+b-1,MAXGAP))
        gaps.append([LO+a+1,LO+b-1,g])
        for j in range(a+1,b):
            u=(j-a)/(b-a); seq[j]=seq[a]*(1-u)+seq[b]*u
    ws=[]
    for w in seq:
        w=w.copy(); w[:,1]*=-1; w[:,2]*=-1; ws.append(w)
    times=[(LO+i)/FPS for i in range(len(ws))]
    r=V.build_clip(ws,[1.0]*len(ws),times,args,FPS,len(idx))
    # ENGINE CONVENTION: replace build_clip's camera-axis rest-relative swings with absolute local
    # rotations on the BANNON_rigged bind, solved from the SAME smoothed, resampled joints build_clip keyed
    # (see engine_retarget.py for why the bake needs this).
    sm=V.smooth(ws,args.smooth); NK=len(r['clip']['keys']); names=set()
    for k,kk in enumerate(r['clip']['keys']):
        u=k/(NK-1); fi=u*(len(sm)-1); i0=int(np.floor(fi)); i1=min(len(sm)-1,i0+1); al=fi-i0
        w=sm[i0]*(1-al)+sm[i1]*al
        pts={n:ER.tool_to_rig(p) for n,p in V.derive_points(w).items()}
        kk['bones']=ER.bones_json(RT.frame(pts)); names.update(kk['bones'])
    r['bones']=len(names)
    tl=[np.linalg.norm(np.array(k['pose']['chest'])) for k in r['clip']['keys']]
    T0=float(np.median(tl))
    for k,t in zip(r['clip']['keys'],tl):
        f=T0/t if t>1e-6 else 1.0
        k['pose']={j:[round(v*f,4) for v in p] for j,p in k['pose'].items()}
    open(os.path.join(OUT,key+'.json'),'w').write(json.dumps(r['clip']))
    tracked=[LO+i for i in range(len(seq)) if RAW[role][LO+i] is not None]
    solved=[]
    if role=='A' and SOLVE:
        a,b=SOLVE['solved_frames']; solved=[a,min(b,HI),min(b,HI)-a+1]
    prov[key]=dict(role='attacker' if role=='A' else 'receiver', window_frames=[LO,HI], window_s=[round(LO/FPS,4),round(HI/FPS,4)],
                   tracked=len(tracked), total=len(seq), coverFrac=round(len(tracked)/len(seq),3), interpolated_gaps=gaps,
                   interpolated_frames=sum(g[2] for g in gaps), solved_frames=solved, solved_count=(solved[2] if solved else 0),
                   dur=r['clip']['dur'], keys=len(r['clip']['keys']), bones=r['bones'], span=round(r['span'],3))
    print(key, json.dumps(prov[key]))
prov['_camera_yaw']=CAMYAW
json.dump(prov,open(os.path.join(OUT,'capture_report.json'),'w'),indent=1)
