import cv2, numpy as np, pickle, sys
t=pickle.load(open(sys.argv[1],'rb')); ids=t['ids']
picks=eval(sys.argv[3]); TW=int(sys.argv[4]) if len(sys.argv)>4 else 160
E=[(5,6),(5,11),(6,12),(11,12),(5,7),(7,9),(6,8),(8,10),(11,13),(13,15),(12,14),(14,16),(0,5),(0,6)]
col={'A':(0,255,120),'R':(60,120,255),'F':(200,200,200)}
cap=cv2.VideoCapture('CHAINSNATCHER.mp4'); frames=[]
while True:
    ok,f=cap.read()
    if not ok: break
    frames.append(f)
tiles=[]
for i in picks:
    f=frames[i].copy()
    for nm,c in ids[i].items():
        k=c['k'] if isinstance(c,dict) else c; s=c['s'] if isinstance(c,dict) else np.ones(17)
        cl=col[nm]
        for a,b in E:
            if s[a]>0.25 and s[b]>0.25: cv2.line(f,tuple(int(v) for v in k[a]),tuple(int(v) for v in k[b]),cl,5)
        cv2.circle(f,tuple(int(v) for v in k[0]),10,cl,-1)
        for j in (5,7,9,11,13,15): cv2.circle(f,tuple(int(v) for v in k[j]),7,(255,255,255),-1)  # LEFT side white
        cv2.putText(f,nm,tuple(int(v) for v in (k[11]+k[12])/2),0,2,cl,5)
    cv2.putText(f,'f%d'%i,(10,60),0,2.2,(0,255,255),5)
    tiles.append(cv2.resize(f,(TW,int(TW*1024/576))))
n=10
tiles+=[np.zeros_like(tiles[0])]*((-len(tiles))%n)
cv2.imwrite(sys.argv[2],np.vstack([np.hstack(tiles[j:j+n]) for j in range(0,len(tiles),n)]))
