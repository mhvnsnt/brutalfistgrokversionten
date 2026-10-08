"""Validation for the Chainsnatcher pair. Writes chainsnatcher_proof/validation.json.
Checks: no NaN (clips + baked), stable bone lengths (tracked 3D), attacker behind the receiver at the
grab (2D, tracked), knee -> receiver upper-back approach (2D, tracked) and the landing geometry
(solved knee height vs the receiver's measured upper-back lift), attacker supine / receiver back-down
at the end, and one shared timeline."""
import json, pickle, sys, os, math, numpy as np
LO,HI=96,158; AEND=134
CAP='/workspace/mocap-src/chainsnatcher_capture'; OUT='/workspace/mocap-src/chainsnatcher_proof'
BAKED=sys.argv[1] if len(sys.argv)>1 else '/tmp/bake-cs'
T=pickle.load(open('track2.pkl','rb'))['ids']; RAW=pickle.load(open('recon.pkl','rb')); RS=pickle.load(open('recon_solved.pkl','rb'))
SOL=json.load(open('solve_report.json')); REP=json.load(open(f'{CAP}/capture_report.json'))
V={}
# 1. NaN
def walk(x):
    if isinstance(x,dict): return all(walk(v) for v in x.values())
    if isinstance(x,list): return all(walk(v) for v in x)
    if isinstance(x,float): return math.isfinite(x)
    return True
clips={k:json.load(open(f'{CAP}/{k}.json')) for k in ('CHAINSNATCHER','CHAINSNATCHER__RECV')}
baked={k:json.load(open(f'{BAKED}/{k}.json')) for k in clips}
V['no_nan']={'clips':all(walk(c) for c in clips.values()),'baked':all(walk(c) for c in baked.values()),
             'recon_window':all(np.isfinite(RS[r][i]).all() for r in 'AR' for i in range(LO,HI+1) if RS[r][i] is not None)}
# 2. bone lengths over TRACKED frames (3D recon, before any interpolation / solve)
BONES={'upper_arm_L':(11,13),'upper_arm_R':(12,14),'forearm_L':(13,15),'forearm_R':(14,16),'thigh_L':(23,25),'thigh_R':(24,26),'shin_L':(25,27),'shin_R':(26,28),
       'chest_shoulder_L':('c',11),'chest_shoulder_R':('c',12),'pelvis_hip_L':('p',23),'pelvis_hip_R':('p',24),'spine':('p','c')}
def J(w,j):
    if j=='c': return (w[11]+w[12])/2
    if j=='p': return (w[23]+w[24])/2
    return w[j]
bl={}
for r,nm in (('A','attacker'),('R','receiver')):
    fr=[RAW[r][i] for i in range(LO,HI+1) if RAW[r][i] is not None]
    cv={b:float(np.std(L)/np.mean(L)) for b,(a,c) in BONES.items() for L in [[np.linalg.norm(J(w,a)-J(w,c)) for w in fr]]}
    bl[nm]={'tracked_frames':len(fr),'max_cv':round(max(cv.values()),4),'per_bone_cv':{k:round(v,4) for k,v in cv.items()}}
# solved frames use the attacker's own median lengths: exact
fr=[RS['A'][i] for i in range(SOL['solved_frames'][0],SOL['solved_frames'][1]+1)]
bl['attacker_solved_frames_max_cv']=round(max(float(np.std(L)/np.mean(L)) for (a,c) in BONES.values() for L in [[np.linalg.norm(J(w,a)-J(w,c)) for w in fr]]),6)
V['bone_lengths']=bl
# 3. behind at the grab (2D tracked): both face image-left (nose left of the shoulder midpoint) and the
#    attacker's pelvis is further right, i.e. behind the receiver
beh=[]
for i in range(LO,126):
    d=T[i]
    if 'A' not in d or 'R' not in d: continue
    pa=(d['A']['k'][11]+d['A']['k'][12])/2; pr=(d['R']['k'][11]+d['R']['k'][12])/2
    tor=np.linalg.norm((d['R']['k'][5]+d['R']['k'][6])/2-pr)
    face=lambda k:(k[0][0]-(k[5][0]+k[6][0])/2)
    beh.append(dict(f=i,behind=bool(pa[0]>pr[0]),gap_torso=round(float((pa[0]-pr[0])/tor),2),A_faces_left=bool(face(d['A']['k'])<0),R_faces_left=bool(face(d['R']['k'])<0)))
V['attacker_behind_at_grab']={'frames':len(beh),'behind_frames':sum(b['behind'] for b in beh),'both_face_left_frames':sum(b['A_faces_left'] and b['R_faces_left'] for b in beh),
    'median_gap_receiver_torsos':float(np.median([b['gap_torso'] for b in beh])),'window':[LO,125]}
# 4. knee -> receiver upper back (2D, tracked attacker frames): distance from the nearer attacker knee to the
#    receiver's upper back (shoulder midpoint lowered 25% toward the hips), in attacker torso lengths
kd=[]
for i in range(118,AEND+1):
    d=T[i]
    if 'A' not in d or 'R' not in d: continue
    ka=d['A']['k']; kr=d['R']['k']
    ub=(kr[5]+kr[6])/2*0.75+(kr[11]+kr[12])/2*0.25
    tor=np.linalg.norm((ka[5]+ka[6])/2-(ka[11]+ka[12])/2)
    kd.append([i,round(float(min(np.linalg.norm(ka[13]-ub),np.linalg.norm(ka[14]-ub))/tor),2)])
# landing geometry (3D, own body frames): solved knee height above the attacker's pelvis vs the receiver's
# measured chest lift above his pelvis once down (tracked frames)
A=RS['A']; up=np.array([0,-1.0,0])
kneeh=[float(max((A[i][25]-(A[i][23]+A[i][24])/2)@up,(A[i][26]-(A[i][23]+A[i][24])/2)@up)) for i in range(SOL['landing_frame_from_receiver'],HI+1)]
thigh=float(np.median([np.linalg.norm(A[i][23]-A[i][25]) for i in range(LO,AEND+1) if RAW['A'][i] is not None]))
Rr=RAW['R']; lift=[]
for i in range(SOL['landing_frame_from_receiver']+5,HI+1):
    if Rr[i] is None: continue
    w=Rr[i]; lift.append([i,round(float(((w[11]+w[12])/2-(w[23]+w[24])/2)@up),3)])
V['knee_contact']={'tracked_2d_knee_to_upper_back_attacker_torsos':kd,
    'closes_from':kd[0][1] if kd else None,'closes_to':kd[-1][1] if kd else None,
    'impact_is_solved':True,'landing_frame':SOL['landing_frame_from_receiver'],
    'solved_knee_height_above_pelvis_m':round(float(np.median(kneeh)),3),'attacker_thigh_m':round(thigh,3),
    'receiver_chest_lift_above_pelvis_m_tracked':lift,
    'note':'The impact frames (~f136-144) are inside the attacker\'s occlusion, so a 3D knee-to-back distance at impact cannot be measured. Reported instead: the tracked 2D approach up to the last attacker frame, and the solved knee height next to the receiver\'s measured upper-body lift once he is down.'}
# 5. end state
def fnorm(w):
    n=np.cross(w[11]-w[12],(w[11]+w[12])/2-(w[23]+w[24])/2); return n/np.linalg.norm(n)
def facing_up(w):  # body front normal (y-down frame): +1 = front faces UP (back down), -1 = face down
    return float(-fnorm(w)@np.array([0,1.0,0]))
def facing_cam(w): return float(-fnorm(w)[2])
def spine_elev(w):
    v=(w[11]+w[12])/2-(w[23]+w[24])/2; v=v/np.linalg.norm(v); return float(math.degrees(math.asin(np.clip(v@up,-1,1))))
V['end_state']={'attacker_last_frame_solved':True,'attacker_spine_elevation_deg':round(spine_elev(A[HI]),1),
   'attacker_front_faces_up':round(facing_up(A[HI]),3),'attacker_knee_above_pelvis_m':round(kneeh[-1],3),
   'receiver_tracked_frames_from_landing':[dict(f=i,front_up=round(facing_up(Rr[i]),2),front_to_camera=round(facing_cam(Rr[i]),2),spine_elev_deg=round(spine_elev(Rr[i]),1)) for i in range(SOL['landing_frame_from_receiver']-1,HI+1) if Rr[i] is not None],
   'receiver_spine_elev_start_deg':round(float(np.median([spine_elev(Rr[i]) for i in range(LO,LO+10) if Rr[i] is not None])),1),
   'receiver_note':'Measured: his spine goes from upright (~67 deg) to ~horizontal (<20 deg). At the impact frames f141-143 his front faces up (back down onto the knees). f144 reads front-down (-0.72), a single noisy frame at the moment of impact. Once down (f153-158) he is turned onto his SIDE, front to the camera and slightly toward the mat (front_up -0.03..-0.22): the roll is starting inside the window. The rest of the roll (f159+) is cropped and not captured. So back-down holds at impact, NOT through every down frame.',
   'receiver_roll_captured':False,
   'roll_note':'After f158 the receiver rolls toward the camera, cropped, with a 7-frame tracking gap (f159-165); not captured, so the clips end with him down.'}
# 6. shared timeline
ka=[k['t'] for k in clips['CHAINSNATCHER']['keys']]; kr=[k['t'] for k in clips['CHAINSNATCHER__RECV']['keys']]
V['shared_timeline']={'dur':[clips['CHAINSNATCHER']['dur'],clips['CHAINSNATCHER__RECV']['dur']],'same_key_times':ka==kr,'keys':len(ka),
   'baked_dur':[baked['CHAINSNATCHER']['dur'],baked['CHAINSNATCHER__RECV']['dur']],'window_frames':[LO,HI],'window_s':[round(LO/30,4),round(HI/30,4)]}
V['coverage']={k:{x:REP[k][x] for x in ('tracked','total','coverFrac','interpolated_gaps','interpolated_frames','solved_frames','solved_count')} for k in clips}
V['pass']={
 'no_nan':all(V['no_nan'].values()),
 'bone_lengths_cv_lt_0.15':bl['attacker']['max_cv']<0.15 and bl['receiver']['max_cv']<0.15,
 'behind_at_grab':V['attacker_behind_at_grab']['behind_frames']==V['attacker_behind_at_grab']['frames'],
 'knee_approach_closes':bool(kd and kd[-1][1]<kd[0][1]),
 'attacker_supine_end':abs(V['end_state']['attacker_spine_elevation_deg'])<20 and V['end_state']['attacker_front_faces_up']>0.7,
 'receiver_back_down_at_impact':(lambda fr: max(x['front_up'] for x in fr if x['f']<=SOL['landing_frame_from_receiver']+1)>0.3 and fr[-1]['spine_elev_deg']<25 and V['end_state']['receiver_spine_elev_start_deg']>50)(V['end_state']['receiver_tracked_frames_from_landing']),
 'receiver_back_down_every_down_frame':all(x['front_up']>-0.2 for x in V['end_state']['receiver_tracked_frames_from_landing']),
 'shared_timeline':V['shared_timeline']['same_key_times'] and V['shared_timeline']['dur'][0]==V['shared_timeline']['dur'][1],
 'gaps_le_6':all(g[2]<=6 for k in clips for g in REP[k]['interpolated_gaps'])}
os.makedirs(OUT,exist_ok=True); json.dump(V,open(f'{OUT}/validation.json','w'),indent=1)
print(json.dumps(V['pass'],indent=1)); print('bone cv',bl['attacker']['max_cv'],bl['receiver']['max_cv']); print('behind',V['attacker_behind_at_grab']); print('knee',kd[0],kd[-1], 'kneeh',V['knee_contact']['solved_knee_height_above_pelvis_m'],'lift',lift); print('end',{k:v for k,v in V['end_state'].items() if 'note' not in k})
