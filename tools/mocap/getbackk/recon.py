"""Length-constrained 3D reconstruction (Taylor 2000, weak perspective) from the RTMO 2D tracks.
Depth SIGN per bone comes from RTMW3D where RTMW3D agrees with the 2D track, otherwise from temporal
continuity. Output: per role, per frame, an MP33-layout (33,3) array in metres, MediaPipe convention
(y down, z toward camera negative, origin at hip midpoint), or None for an untracked frame."""
import pickle, numpy as np, json, sys
T=pickle.load(open('lift2.pkl','rb')); fx=T['fixed']; lift=T['lift']
N=len(fx); MPP=0.0047
# ---- left/right label continuity. RTMO occasionally swaps a body's left and right labels between
# frames (worst on the prone/supine receiver at the end). Swap back when the mirrored labelling is
# clearly closer to the previous valid frame.
PAIRS=[(1,2),(3,4),(5,6),(7,8),(9,10),(11,12),(13,14),(15,16)]
def mirror(k):
    k=k.copy()
    for a,b in PAIRS: k[[a,b]]=k[[b,a]]
    return k
LR_SWAPS={'A':[],'R':[]}
for role in 'AR':
    prev=None
    for i in range(N):
        r=fx[i].get(role)
        if r is None: continue
        k=r['k']; m=mirror(k)
        if prev is not None:
            d0=np.median(np.linalg.norm(k-prev,axis=1)); d1=np.median(np.linalg.norm(m-prev,axis=1))
            if d1<0.7*d0:
                ss=r['s'].copy()
                for a,b in PAIRS: ss[[a,b]]=ss[[b,a]]
                fx[i][role]=dict(r,k=m,s=ss); LR_SWAPS[role].append(i)
                lf=lift[i].get(role)
                if lf is not None:   # RTMW3D's labels no longer match: drop it as a depth source here
                    lift[i][role]=dict(lf,err=1e9)
        prev=fx[i][role]['k']
print('LR swaps', {k:v for k,v in LR_SWAPS.items()})
UPV=[0.03,-0.82,-0.57]  # metres per image px (fitted scale; the clip builder renormalises anyway)
# COCO-17 indices
NOSE,LSH,RSH,LEL,REL,LWR,RWR,LHIP,RHIP,LKN,RKN,LANK,RANK=0,5,6,7,8,9,10,11,12,13,14,15,16
def valid(r):
    s=r['s']; return (s>0.5).sum()>=11 and min(s[[LSH,RSH,LHIP,RHIP]])>0.4
# point list: 0 pelvis,1 chest, then coco joints. bones as (parent_pt, child_pt)
def pts2d(r, lf):
    k=r['k']; P={'pelvis':(k[LHIP]+k[RHIP])/2,'chest':(k[LSH]+k[RSH])/2}
    for nm,j in dict(nose=NOSE,lsh=LSH,rsh=RSH,lel=LEL,rel=REL,lwr=LWR,rwr=RWR,lhip=LHIP,rhip=RHIP,lkn=LKN,rkn=RKN,lank=LANK,rank=RANK).items(): P[nm]=k[j]
    # toes from RTMW3D 2D feet (COCO-WB 17 L big toe, 20 R big toe) when its ankle agrees with the track
    for side,ank,toe in (('l',LANK,17),('r',RANK,20)):
        if lf is not None and np.linalg.norm(lf['k2'][ank]-k[ank]) < 0.12*lf['size']:
            P[side+'toe']=lf['k2'][toe]-lf['k2'][ank]+k[ank]
    return P
BONES=[('pelvis','lhip'),('pelvis','rhip'),('pelvis','chest'),('chest','lsh'),('chest','rsh'),('chest','nose'),
       ('lsh','lel'),('lel','lwr'),('rsh','rel'),('rel','rwr'),('lhip','lkn'),('lkn','lank'),('rhip','rkn'),('rkn','rank'),
       ('lank','ltoe'),('rank','rtoe')]
SYM={('pelvis','lhip'):('pelvis','rhip'),('chest','lsh'):('chest','rsh'),('lsh','lel'):('rsh','rel'),('lel','lwr'):('rel','rwr'),
     ('lhip','lkn'):('rhip','rkn'),('lkn','lank'):('rkn','rank'),('lank','ltoe'):('rank','rtoe')}
RW={'pelvis':None,'chest':None,'nose':0,'lsh':5,'rsh':6,'lel':7,'rel':8,'lwr':9,'rwr':10,'lhip':11,'rhip':12,'lkn':13,'rkn':14,'lank':15,'rank':16,'ltoe':17,'rtoe':20}
def rwz(lf,p):
    k3=lf['k3']
    if p=='pelvis': return (k3[11,2]+k3[12,2])/2
    if p=='chest': return (k3[5,2]+k3[6,2])/2
    return k3[RW[p],2]
out={}; report={}
for role in 'AR':
    frames2d=[]; acc=[]
    for i in range(N):
        r=fx[i].get(role); lf=lift[i].get(role)
        ok_rw = lf is not None and lf['err']/lf['size']<=0.10
        if r is None or not valid(r): frames2d.append(None); acc.append(False); continue
        frames2d.append(pts2d(r, lf)); acc.append(ok_rw)
    # bone lengths: 95th pct of 2D length (max projection ~ true length), symmetric pairs averaged
    Lb={}
    for b in BONES:
        v=[np.linalg.norm(P[b[1]]-P[b[0]]) for P in frames2d if P and b[0] in P and b[1] in P]
        Lb[b]=np.percentile(v,95) if v else 0
    for a,b in SYM.items(): m=(Lb[a]+Lb[b])/2; Lb[a]=Lb[b]=m
    # ---- per-bone depth SIGN by Viterbi over time: smoothness (angle change between frames) plus a
    # penalty for disagreeing with RTMW3D, weighted by how confident RTMW3D's depth ordering is.
    LAM=0.6; TAU=0.08
    # world up in camera coords (y down, z away). Camera looks DOWN at the mat, so up tilts toward the
    # camera. Measured from the attacker standing in the carry (f45-100) on a first pass: legs give
    # (0.03,-0.82,-0.57). Used as a weak plausibility prior on torso/leg depth sign and to level the world.
    UP=np.array(UPV)/np.linalg.norm(UPV); PRIOR_W=0.25
    PRIOR_BONES={('pelvis','chest'),('lhip','lkn'),('rhip','rkn'),('lkn','lank'),('rkn','rank')}
    signs={}; signsrc={'viterbi_bones':0,'rtmw3d_votes':0,'head_rule':0}
    for b in BONES:
        pa,pc=b
        if pc=='nose': continue
        fr=[i for i,P in enumerate(frames2d) if P and pa in P and pc in P]
        if not fr: continue
        V=[]; U=[]
        for i in fr:
            P=frames2d[i]; d=P[pc]-P[pa]; L=Lb[b]; dz=np.sqrt(max(0.0,L*L-float(d@d)))
            V.append((np.r_[d,dz],np.r_[d,-dz]))
            u=[0.0,0.0]
            lf=lift[i].get(role) if acc[i] else None
            if lf is not None:
                zr=rwz(lf,pc)-rwz(lf,pa); c=LAM*min(1.0,abs(zr)/TAU)
                if zr>0: u[1]=c
                elif zr<0: u[0]=c
                signsrc['rtmw3d_votes']+=1
            if b in PRIOR_BONES:
                for si in range(2):
                    vv=V[-1][si]; u[si]+=PRIOR_W*(1-float(np.dot(UP,vv/(np.linalg.norm(vv)+1e-9))))/2
            U.append(u)
        n=len(fr); cost=np.array(U[0]); back=[]
        for t in range(1,n):
            nc=np.zeros(2); bk=[0,0]
            for s2 in range(2):
                a=V[t][s2]/(np.linalg.norm(V[t][s2])+1e-9)
                opts=[cost[s1]+(1-float(a@(V[t-1][s1]/(np.linalg.norm(V[t-1][s1])+1e-9)))) for s1 in range(2)]
                bk[s2]=int(np.argmin(opts)); nc[s2]=min(opts)+U[t][s2]
            cost=nc; back.append(bk)
        st=int(np.argmin(cost)); path=[st]
        for bk in reversed(back): st=bk[st]; path.append(st)
        path=path[::-1]
        for i,p in zip(fr,path): signs[(b,i)]=1.0 if p==0 else -1.0
        signsrc['viterbi_bones']+=1
    seq=[]
    for i,P in enumerate(frames2d):
        if P is None: seq.append(None); continue
        X={'pelvis':np.array([P['pelvis'][0],P['pelvis'][1],0.0])}
        for b in BONES:
            pa,pc=b
            if pc not in P or pa not in X: continue
            d=P[pc]-P[pa]; L=Lb[b]; dz=np.sqrt(max(0.0,L*L-float(d@d)))
            if pc=='nose':
                fwd=np.cross(X['lsh']-X['rsh'], X['chest']-X['pelvis'])
                sgn=1.0 if np.dot(np.r_[d,dz],fwd)>=np.dot(np.r_[d,-dz],fwd) else -1.0
                signsrc['head_rule']+=1
            else:
                sgn=signs[(b,i)]
            X[pc]=X[pa]+np.r_[d,sgn*dz]
        seq.append(X)
    # MP33 arrays
    def rot_to(a,b):
        a=a/np.linalg.norm(a); b=b/np.linalg.norm(b); v=np.cross(a,b); c=float(a@b)
        K=np.array([[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]])
        return np.eye(3)+K+K@K*(1/(1+c))
    LEVEL=rot_to(np.array(UPV,float),np.array([0,-1.0,0]))
    def mp33(X):
        w=np.zeros((33,3)); c=X['pelvis']
        g=lambda k: LEVEL@((X[k]-c)*MPP)
        fill={0:'nose',2:'nose',5:'nose',7:'nose',8:'nose',11:'lsh',12:'rsh',13:'lel',14:'rel',15:'lwr',16:'rwr',
              23:'lhip',24:'rhip',25:'lkn',26:'rkn',27:'lank',28:'rank',29:'lank',30:'rank',31:'ltoe',32:'rtoe'}
        for j,k in fill.items():
            kk=k if k in X else ('lank' if k=='ltoe' else 'rank' if k=='rtoe' else k)
            w[j]=g(kk)
        return w
    out[role]=[None if X is None else mp33(X) for X in seq]
    missing=[i for i,X in enumerate(seq) if X is None]
    toes=sum(1 for X in seq if X and 'ltoe' in X and 'rtoe' in X)
    report[role]=dict(lr_swaps=LR_SWAPS[role], missing=missing, rtmw3d_frames=int(sum(acc)), signsrc=signsrc, toe_frames=toes,
                      bone_len_px={'%s-%s'%b:round(float(v),1) for b,v in Lb.items()})
pickle.dump(out,open('recon.pkl','wb'))
print(json.dumps(report,indent=0)[:3000])
