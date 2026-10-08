"""LEFT/RIGHT LABEL CONSISTENCY for isolated frames (run after recon.py, before solve.py; edits recon.pkl).

A body lying sideways or inverted is where 2D detectors swap left and right (RTMO here runs on rotated
frames for exactly those poses). recon.py's temporal smoothing keeps neighbouring frames consistent,
but a tracked frame with NO tracked neighbour (isolated between two gaps) is unconstrained. Rule: for a
frame isolated by gaps on both sides whose body-front normal disagrees with a neighbour (min dot with
the nearest tracked frames before/after < 0), the left/right-exchanged labelling is tested, and kept
only if it agrees with BOTH neighbours (min dot > 0) and beats the original by more than 0.5. Same 2D points, same
bone lengths; only the labels. Logged to lr_swap.json."""
import pickle, json, sys, numpy as np
LO,HI=int(sys.argv[1]),int(sys.argv[2])
PAIRS=[(1,4),(2,5),(3,6),(7,8),(9,10),(11,12),(13,14),(15,16),(17,18),(19,20),(21,22),(23,24),(25,26),(27,28),(29,30),(31,32)]
R=pickle.load(open('recon.pkl','rb'))
def front(w):
    n=np.cross(w[11]-w[12],(w[11]+w[12])/2-(w[23]+w[24])/2); return n/np.linalg.norm(n)
def swap(w):
    m=w.copy()
    for a,b in PAIRS: m[a],m[b]=w[b].copy(),w[a].copy()
    return m
log=[]
for r in 'AR':
    S=R[r]; tr=[i for i in range(LO,HI+1) if S[i] is not None]
    for j,i in enumerate(tr):
        if j==0 or j==len(tr)-1: continue
        a,b=tr[j-1],tr[j+1]
        if a==i-1 or b==i+1: continue
        fa,fi,fb=front(S[a]),front(S[i]),front(S[b])
        m=swap(S[i]); da,db=float(front(m)@fa),float(front(m)@fb)
        o=min(float(fi@fa),float(fi@fb))
        if o<0:
            ok=min(da,db)>0 and min(da,db)>o+0.5
            if ok: S[i]=m
            log.append(dict(body=r,frame=i,prev_tracked=a,next_tracked=b,dot_prev=round(float(fi@fa),3),dot_next=round(float(fi@fb),3),swapped_dots=[round(da,3),round(db,3)],applied=ok))
pickle.dump(R,open('recon.pkl','wb')); json.dump(log,open('lr_swap.json','w'),indent=1); print(json.dumps(log))
