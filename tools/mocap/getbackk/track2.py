import numpy as np, pickle, sys
from scipy.optimize import linear_sum_assignment
raw=pickle.load(open('rtmo_rot.pkl','rb')); H=1024.
def kd(ka,sa,kb,sb,th=0.3):
    m=(sa>th)&(sb>th)
    if m.sum()<5: return 9.
    return float(np.median(np.linalg.norm(ka[m]-kb[m],axis=1)))/H
# 1) merge duplicates within a frame
frames=[]
for cands in raw:
    cands=sorted(cands,key=lambda c:-float(np.mean(c['s'])))
    keep=[]
    for c in cands:
        if float(np.mean(c['s']))<0.35: continue
        dup=False
        for kk in keep:
            if kd(c['k'],c['s'],kk['k'],kk['s'])<0.035:
                dup=True; kk['n']+=1; break
        if not dup: c=dict(c); c['n']=1; keep.append(c)
    frames.append(keep)
# 2) track with constant velocity
k0=frames[0]; hx=[np.mean(c['k'][[11,12],0]) for c in k0[:2]]
A=int(np.argmax(hx)); R=1-A
hist={'A':[(0,k0[A])],'R':[(0,k0[R])]}
ids=[{'A':k0[A],'R':k0[R]}]
def predict(nm,i):
    h=hist[nm]; f1,c1=h[-1]
    if len(h)>1 and h[-2][0]==f1-1 and i-f1<=3:
        v=c1['k']-h[-2][1]['k']; return c1['k']+v*(i-f1), c1['s']
    return c1['k'],c1['s']
for i in range(1,len(frames)):
    cs=frames[i]; asg={}
    if cs:
        C=np.full((2,len(cs)),9.)
        for a,nm in enumerate('AR'):
            pk,ps=predict(nm,i); gap=i-hist[nm][-1][0]
            for b,c in enumerate(cs):
                C[a,b]=kd(pk,ps,c['k'],c['s'])/(1+0.6*(gap-1))
        r,cc=linear_sum_assignment(C)
        for a,b in zip(r,cc):
            nm='AR'[a]
            if C[a,b]<0.10:
                asg[nm]=cs[b]; hist[nm].append((i,cs[b]))
    ids.append(asg)
pickle.dump(dict(frames=frames,ids=ids),open('track2.pkl','wb'))
for nm in 'AR':
    miss=[i for i,x in enumerate(ids) if nm not in x]; runs=[]
    for m in miss:
        if runs and m==runs[-1][1]+1: runs[-1][1]=m
        else: runs.append([m,m])
    print(nm,len(ids)-len(miss),'gaps',[(a,b,b-a+1) for a,b in runs])
print('dets per frame',[len(f) for f in frames])
