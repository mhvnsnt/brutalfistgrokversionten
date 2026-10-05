import json, numpy as np, pickle, math, sys
D=sys.argv[1]; FPS=30.0; LO=int(sys.argv[2]) if len(sys.argv)>2 else 15
T=pickle.load(open('lift2.pkl','rb')); fx=T['fixed']; R=pickle.load(open('recon.pkl','rb'))
A=json.load(open(D+'/GETBACKK.json')); B=json.load(open(D+'/GETBACKK__RECV.json'))
rep={}
def nan_free(c):
    s=json.dumps(c); return ('NaN' not in s) and ('Infinity' not in s)
rep['nan_free']={'GETBACKK':nan_free(A),'GETBACKK__RECV':nan_free(B)}
rep['duration']={'GETBACKK':A['dur'],'GETBACKK__RECV':B['dur'],'ratio':round(B['dur']/A['dur'],4),'keys':[len(A['keys']),len(B['keys'])],
                 'same_key_times':[k['t'] for k in A['keys']]==[k['t'] for k in B['keys']]}
seg=[('hipL','knL'),('knL','ftL'),('hipR','knR'),('knR','ftR'),('shL','elL'),('elL','haL'),('shR','elR'),('elR','haR'),('pelvis','chest')]
rep['pose_segment_cv']={}
for nm,c in (('GETBACKK',A),('GETBACKK__RECV',B)):
    rep['pose_segment_cv'][nm]={'%s-%s'%s:round(float(np.std(v)/np.mean(v)),3) for s in seg for v in [[np.linalg.norm(np.subtract(k['pose'][s[1]],k['pose'][s[0]])) for k in c['keys']]]}
def hip(k): return (k[11]+k[12])/2
def sh(k): return (k[5]+k[6])/2
# 2D contact at the carry: receiver pelvis vs attacker shoulder line, normalised by attacker torso length
carry=[]
for i in range(45,106):
    a=fx[i].get('A'); r=fx[i].get('R')
    if not a or not r: continue
    tor=np.linalg.norm(sh(a['k'])-hip(a['k']))
    d=np.linalg.norm(hip(r['k'])-sh(a['k']))/tor
    above=(sh(a['k'])[1]-hip(r['k'])[1])/tor   # +ve = receiver pelvis above attacker shoulders (image y down)
    carry.append((d,above))
carry=np.array(carry)
# 3D: receiver torso angle from vertical (leveled world) during the carry
def tilt(w):
    v=(w[11]+w[12])/2; v=v/np.linalg.norm(v); return math.degrees(math.acos(max(-1,min(1,-v[1]))))
rt=[tilt(R['R'][i]) for i in range(45,106) if R['R'][i] is not None]
at=[tilt(R['A'][i]) for i in range(45,106) if R['A'][i] is not None]
rep['carry']={'frames':'45-105 (1.50-3.50 s src; %.2f-%.2f s clip)'%((45-LO)/FPS,(105-LO)/FPS),
  'recv_pelvis_to_atk_shoulders_over_torso_median':round(float(np.median(carry[:,0])),2),
  'recv_pelvis_above_atk_shoulders_frac':round(float(np.mean(carry[:,1]>0)),2),
  'recv_torso_tilt_from_vertical_deg_median':round(float(np.median(rt)),1),
  'atk_torso_tilt_from_vertical_deg_median':round(float(np.median(at)),1)}
# impact: receiver pelvis 2D y (image) reaches its floor and stops after the toss
ys=[(i,hip(fx[i]['R']['k'])[1]) for i in range(140,200) if fx[i].get('R') is not None]
yv=np.array([y for _,y in ys]); fi=np.array([i for i,_ in ys])
floor=np.percentile(yv[fi>=180],50)
imp=int(fi[np.argmax(yv>=floor-0.15*abs(floor-yv.min()))])
rep['impact']={'src_frame':imp,'src_s':round(imp/FPS,2),'clip_s':round((imp-LO)/FPS,2)}
# at impact: receiver pelvis height vs attacker ankles (image) -- both bodies at mat level, contact timing shared
ai=fx[imp].get('A'); ri=fx[imp].get('R')
if ai and ri:
    rep['impact']['recv_pelvis_minus_atk_ankle_y_px']=round(float(hip(ri['k'])[1]-(ai['k'][15][1]+ai['k'][16][1])/2),1)
    rep['impact']['recv_to_atk_pelvis_dist_over_torso']=round(float(np.linalg.norm(hip(ri['k'])-hip(ai['k']))/np.linalg.norm(sh(ai['k'])-hip(ai['k']))),2)
# landing pose: receiver supine (chest normal points up)
def facing_up(w):
    f=np.cross(w[11]-w[12],((w[11]+w[12])/2)); f/=np.linalg.norm(f)   # forward, y-down frame
    return -f[1]  # +1 = chest faces straight up
imp_w=[i for i in range(164,180) if R['R'][i] is not None]
rep['landing_after_impact']={'frames':'164-179 (5.47-5.97 s src)','recv_torso_tilt_deg_mean':round(float(np.mean([tilt(R['R'][i]) for i in imp_w])),1),
                'recv_chest_up_component_mean':round(float(np.mean([facing_up(R['R'][i]) for i in imp_w])),2)}
# last 0.5 s
end=[i for i in range(195,210) if R['R'][i] is not None]
rep['landing']={'recv_torso_tilt_deg_mean':round(float(np.mean([tilt(R['R'][i]) for i in end])),1),
                'recv_chest_up_component_mean':round(float(np.mean([facing_up(R['R'][i]) for i in end])),2)}
# attacker kneeling at the end: knees near floor (level with ankles), pelvis above knees
def kneel(w):
    kn=(w[25]+w[26])/2; an=(w[27]+w[28])/2; hp=(w[23]+w[24])/2
    return dict(knee_minus_ankle_height=float(-(kn[1]-an[1])), hip_above_knee=float(-(hp[1]-kn[1])))
endA=[kneel(R['A'][i]) for i in range(195,210) if R['A'][i] is not None]
rep['attacker_end']={'knee_height_above_ankle_m_mean':round(float(np.mean([e['knee_minus_ankle_height'] for e in endA])),2),
                     'hip_height_above_knee_m_mean':round(float(np.mean([e['hip_above_knee'] for e in endA])),2)}
# also image-space check for kneeling (camera independent of the 3D lift)
ke=[]
for i in range(195,210):
    a=fx[i].get('A')
    if a: k=a['k']; ke.append(((k[13][1]+k[14][1])/2-(k[15][1]+k[16][1])/2, (k[11][1]+k[12][1])/2-(k[13][1]+k[14][1])/2))
ke=np.array(ke); rep['attacker_end']['img_knee_minus_ankle_y_px']=round(float(ke[:,0].mean()),1); rep['attacker_end']['img_hip_minus_knee_y_px']=round(float(ke[:,1].mean()),1)
print(json.dumps(rep,indent=1)); json.dump(rep,open(D+'/validation.json','w'),indent=1)
