"""Three-identity tracker (A attacker, R receiver, F referee) over the deduplicated RTMO candidates,
seeded by hand in one frame and run forward and backward with constant-velocity matching. The referee
is tracked only so he cannot steal a wrestler's identity; he is discarded afterwards."""
import numpy as np, pickle, sys
F=pickle.load(open('dedup.pkl','rb')); H=1024.; N=len(F)
SEED=int(sys.argv[1]); seeds=dict(zip('ARF',[int(x) for x in sys.argv[2].split(',')]))
LO,HI=int(sys.argv[3]),int(sys.argv[4]); TH=float(sys.argv[5]) if len(sys.argv)>5 else 0.10
AEND=int(sys.argv[6]) if len(sys.argv)>6 else 10**9
THA=float(sys.argv[7]) if len(sys.argv)>7 else TH   # attacker threshold (fast tuck jump)   # attacker not tracked past this frame (occluded)
def kd(ka,sa,kb,sb,th=0.3):
    m=(sa>th)&(sb>th)
    if m.sum()<5: return 9.
    return float(np.median(np.linalg.norm(ka[m]-kb[m],axis=1)))/H
ids=[{} for _ in range(N)]
for nm,j in seeds.items():
    if j>=0: ids[SEED][nm]=F[SEED][j]
def run(rng):
    hist={nm:[(SEED,c)] for nm,c in ids[SEED].items()}
    for i in rng:
        cs=F[i]; names=[n for n in hist if not (n=='A' and i>AEND)]
        if not cs: continue
        C=np.full((len(names),len(cs)),9.)
        for a,nm in enumerate(names):
            h=hist[nm]; f1,c1=h[-1]; gap=abs(i-f1)
            pk=c1['k']
            if len(h)>1 and abs(h[-2][0]-f1)==1 and gap<=3: pk=c1['k']+(c1['k']-h[-2][1]['k'])*gap
            for b,c in enumerate(cs): C[a,b]=kd(pk,c1['s'],c['k'],c['s'])/(1+0.6*(gap-1))
        from scipy.optimize import linear_sum_assignment
        r,cc=linear_sum_assignment(C)
        for a,b in zip(r,cc):
            if C[a,b]<(THA if names[a]=='A' else TH): nm=names[a]; ids[i][nm]=cs[b]; hist[nm].append((i,cs[b]))
run(range(SEED+1,HI+1)); run(range(SEED-1,LO-1,-1))
pickle.dump(dict(frames=F,ids=ids),open('track_cs.pkl','wb'))
for nm in 'AR':
    miss=[i for i in range(LO,HI+1) if nm not in ids[i]]; runs=[]
    for m in miss:
        if runs and m==runs[-1][1]+1: runs[-1][1]=m
        else: runs.append([m,m])
    print(nm,(HI-LO+1)-len(miss),'/',HI-LO+1,'gaps',[(a,b,b-a+1) for a,b in runs])
