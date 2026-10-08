"""CONSTRAINED SOLVE for the attacker's occluded fall and landing — FLAGGED, NOT TRACKED.

From the last tracked attacker frame (in the air, knees tucked, behind the receiver) the attacker is
hidden behind and under the receiver and no detector separates him (RTMO, RTMW3D on hand-placed boxes:
see README). The canon move ends with him flat on his back with his knees raised under the receiver's
upper back, and the visible frames agree (tan thighs knees-up under the receiver from ~f142).
This script writes that ending as a constrained solve and nothing else:
  * every bone keeps the attacker's own measured length (from his tracked frames);
  * the target is supine with the spine PARALLEL to the receiver's measured body axis on the mat
    (canon: the receiver lies back across his knees), knees raised, feet planted, hands up holding
    the receiver; left/right from that orientation, checked against his last tracked shoulders;
  * each bone direction is slerped from the last tracked pose to the target with smoothstep easing,
    reaching it at the LANDING frame, which is measured from the receiver (the frame his shoulders
    start to drop onto the knees), and held after that.
Every solved frame is listed in solve_report.json and in the clip provenance."""
import pickle, numpy as np, json, sys
R=pickle.load(open('recon.pkl','rb')); T=pickle.load(open('lift2.pkl','rb')); fx=T['fixed']
LO,HI=int(sys.argv[1]),int(sys.argv[2])
A=R['A']
# last tracked frame before the occlusion: the end of the first contiguous-ish tracked run
tracked=[i for i in range(LO,HI+1) if A[i] is not None]
S0=None
for i in range(tracked[0],HI+1):
    if A[i] is None and all(A[j] is None for j in range(i,min(HI+1,i+7))): S0=i; break
P0i=max(i for i in tracked if i<S0)
# landing frame from the RECEIVER: first frame after S0 whose shoulder line drops > 0.25 receiver torso in one frame
def sh(k): return (k[5]+k[6])/2
def hp(k): return (k[11]+k[12])/2
TL=None; prev=None
for i in range(S0,HI+1):
    r=fx[i].get('R')
    if r is None: continue
    tor=np.linalg.norm(sh(r['k'])-hp(r['k']))
    if prev is not None and sh(r['k'])[1]-prev>0.25*tor: TL=i; break
    prev=sh(r['k'])[1]
assert TL is not None
# MP33 indices
NO,LSH,RSH,LEL,REL,LWR,RWR,LHIP,RHIP,LKN,RKN,LANK,RANK,LTOE,RTOE=0,11,12,13,14,15,16,23,24,25,26,27,28,31,32
BONES=[('pelvis','lhip'),('pelvis','rhip'),('pelvis','chest'),('chest','lsh'),('chest','rsh'),('chest','nose'),
       ('lsh','lel'),('lel','lwr'),('rsh','rel'),('rel','rwr'),('lhip','lkn'),('lkn','lank'),('rhip','rkn'),('rkn','rank'),
       ('lank','ltoe'),('rank','rtoe')]
IDX=dict(nose=NO,lsh=LSH,rsh=RSH,lel=LEL,rel=REL,lwr=LWR,rwr=RWR,lhip=LHIP,rhip=RHIP,lkn=LKN,rkn=RKN,lank=LANK,rank=RANK,ltoe=LTOE,rtoe=RTOE)
def pts(w):
    P={k:w[j] for k,j in IDX.items()}; P['pelvis']=(w[LHIP]+w[RHIP])/2; P['chest']=(w[LSH]+w[RSH])/2; return P
L={b:float(np.median([np.linalg.norm(pts(A[i])[b[1]]-pts(A[i])[b[0]]) for i in tracked])) for b in BONES}
P0=pts(A[P0i])
UP=np.array([0,-1.0,0]); DOWN=-UP
def hz(v): v=v.copy(); v[1]=0; return v/np.linalg.norm(v)
# ORIENTATION OF THE LANDING. Canon (Backstabber): the attacker lands on his back UNDER the receiver,
# the receiver falls backward across his raised knees, so the two bodies lie PARALLEL with both heads
# toward the back. The attacker is unseen here, the receiver is tracked: the attacker's supine spine is
# set along the receiver's MEASURED horizontal body axis (pelvis -> chest) once he is down on the mat
# (tracked receiver frames from TL+5 to HI). His "facing" f is the opposite of that axis; left/right
# comes from f and up (and is checked against his last tracked shoulders).
RR=R['R']
bax=[hz(((RR[i][LSH]+RR[i][RSH])/2)-((RR[i][LHIP]+RR[i][RHIP])/2)) for i in range(TL+5,HI+1) if RR[i] is not None]
assert len(bax)>=3, 'receiver not tracked on the mat'
f=-hz(np.mean(bax,0))
lat=np.cross(UP,f); lat/=np.linalg.norm(lat)
lat_meas=hz(P0['lsh']-P0['rsh'])
LAT_CHECK=float(np.dot(lat,lat_meas))
fw=[]
for i in tracked:
    if P0i-10<=i<=P0i:
        P=pts(A[i]); fw.append(hz(np.cross(P['lsh']-P['rsh'],P['chest']-P['pelvis'])))
F_AIR=hz(np.mean(fw,0))
n=lambda v: v/np.linalg.norm(v)
TGT={('pelvis','lhip'):lat,('pelvis','rhip'):-lat,('pelvis','chest'):-f,('chest','lsh'):lat,('chest','rsh'):-lat,
     ('chest','nose'):n(-f+0.35*UP),
     ('lsh','lel'):n(0.75*UP+0.45*f+0.2*lat),('lel','lwr'):n(0.55*UP+0.75*f),
     ('rsh','rel'):n(0.75*UP+0.45*f-0.2*lat),('rel','rwr'):n(0.55*UP+0.75*f),
     ('lhip','lkn'):n(0.8*UP+0.6*f),('lkn','lank'):n(0.55*f+0.83*DOWN),
     ('rhip','rkn'):n(0.8*UP+0.6*f),('rkn','rank'):n(0.55*f+0.83*DOWN),
     ('lank','ltoe'):f,('rank','rtoe'):f}
def slerp(a,b,u):
    if np.linalg.norm(a)<1e-9: a=b   # zero-length bone in the last tracked pose (toe fell back to the ankle)
    a=n(a); b=n(b); c=float(np.clip(a@b,-1,1)); th=np.arccos(c)
    if th<1e-6: return a
    return (np.sin((1-u)*th)*a+np.sin(u*th)*b)/np.sin(th)
def pose_at(u):
    X={'pelvis':np.zeros(3)}
    for b in BONES:
        d0=P0[b[1]]-P0[b[0]]
        X[b[1]]=X[b[0]]+L[b]*slerp(d0,TGT[b],u)
    w=np.zeros((33,3))
    fill={0:'nose',2:'nose',5:'nose',7:'nose',8:'nose',11:'lsh',12:'rsh',13:'lel',14:'rel',15:'lwr',16:'rwr',
          23:'lhip',24:'rhip',25:'lkn',26:'rkn',27:'lank',28:'rank',29:'lank',30:'rank',31:'ltoe',32:'rtoe'}
    for j,k in fill.items(): w[j]=X[k]
    return w
solved=[]
for i in range(P0i+1,HI+1):
    u=min(1.0,(i-P0i)/(TL-P0i)); u=u*u*(3-2*u)
    A[i]=pose_at(u); solved.append(i)
rep=dict(rule='constrained solve (NOT tracked): last tracked pose -> supine, knees raised; per-bone slerp, smoothstep, own bone lengths; held after landing',
         last_tracked_frame=P0i, solved_frames=[solved[0],solved[-1]], solved_count=len(solved),
         landing_frame_from_receiver=TL, landing_rule='first frame after the occlusion where the receiver\'s shoulder line drops > 0.25 of his torso in one frame',
         facing_horizontal=np.round(f,3).tolist(), orientation_rule='supine spine parallel to the receiver\'s measured body axis on the mat (tracked receiver frames TL+5..HI)', receiver_axis_frames=[i for i in range(TL+5,HI+1) if RR[i] is not None], lateral_vs_last_tracked_shoulders=round(LAT_CHECK,3), facing_in_air_last10=np.round(F_AIR,3).tolist(), bone_len_m={'%s-%s'%b:round(v,3) for b,v in L.items()})
pickle.dump(R,open('recon_solved.pkl','wb')); json.dump(rep,open('solve_report.json','w'),indent=1); print(json.dumps(rep))
