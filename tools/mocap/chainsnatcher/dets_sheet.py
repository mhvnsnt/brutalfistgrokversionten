import cv2, numpy as np, pickle, sys
raw=pickle.load(open('rtmo_rot.pkl','rb')); H=1024.
def kd(ka,sa,kb,sb,th=0.3):
    m=(sa>th)&(sb>th)
    if m.sum()<5: return 9.
    return float(np.median(np.linalg.norm(ka[m]-kb[m],axis=1)))/H
frames=[]
for cands in raw:
    cands=sorted(cands,key=lambda c:-float(np.mean(c['s'])))
    keep=[]
    for c in cands:
        if float(np.mean(c['s']))<0.35: continue
        if any(kd(c['k'],c['s'],kk['k'],kk['s'])<0.035 for kk in keep): continue
        keep.append(c)
    frames.append(keep)
pickle.dump(frames,open('dedup.pkl','wb'))
print([len(f) for f in frames])
cap=cv2.VideoCapture('CHAINSNATCHER.mp4'); fr=[]
while True:
    ok,f=cap.read()
    if not ok: break
    fr.append(f)
E=[(5,6),(5,11),(6,12),(11,12),(5,7),(7,9),(6,8),(8,10),(11,13),(13,15),(12,14),(14,16),(0,5),(0,6)]
cols=[(0,255,0),(0,0,255),(255,0,0),(0,255,255),(255,0,255),(255,255,0),(128,128,255)]
picks=eval(sys.argv[1]); tiles=[]
for i in picks:
    f=fr[i].copy()
    for j,c in enumerate(frames[i]):
        k=c['k'];s=c['s'];cl=cols[j%7]
        for a,b in E:
            if s[a]>0.25 and s[b]>0.25: cv2.line(f,tuple(int(v) for v in k[a]),tuple(int(v) for v in k[b]),cl,4)
        p=(k[11]+k[12])/2; cv2.putText(f,'%d'%j,(int(p[0]),int(p[1])),0,1.6,cl,4)
    cv2.putText(f,'f%d'%i,(10,60),0,2,(0,255,255),4)
    TW=int(sys.argv[3]) if len(sys.argv)>3 else 200; tiles.append(cv2.resize(f,(TW,int(TW*1.778))))
n=8; tiles+=[np.zeros_like(tiles[0])]*((-len(tiles))%n)
cv2.imwrite(sys.argv[2],np.vstack([np.hstack(tiles[j:j+n]) for j in range(0,len(tiles),n)]))
