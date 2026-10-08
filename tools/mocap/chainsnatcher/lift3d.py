import cv2, numpy as np, pickle
from rtmlib import RTMPose3d
t=pickle.load(open('track2.pkl','rb')); ids=t['ids']
SWAP=10**9  # no identity swap in this take (the referee is tracked separately and dropped)
# fix the one identity swap found by eye on the sheet (attacker turns his back at f121)
fixed=[]
for i,x in enumerate(ids):
    if i>=SWAP: x={('R' if k=='A' else 'A'):v for k,v in x.items()}
    fixed.append(x)
m=RTMPose3d('https://huggingface.co/Soykaf/RTMW3D-x/resolve/main/onnx/rtmw3d-x_8xb64_cocktail14-384x288-b0a0eab7_20240626.onnx',
            model_input_size=(288,384))
PAD=224
cap=cv2.VideoCapture('CHAINSNATCHER.mp4'); out=[]; i=0
while True:
    ok,fr=cap.read()
    if not ok: break
    f=cv2.copyMakeBorder(fr,0,0,PAD,PAD,cv2.BORDER_CONSTANT,value=(0,0,0))
    res={}
    for nm,c in fixed[i].items():
        k=c['k']; s=c['s']; good=k[s>0.3]
        if len(good)<4: good=k
        x0,y0=good.min(0); x1,y1=good.max(0)
        w,h=x1-x0,y1-y0; ext=0.08*max(w,h)
        box=[x0-ext+PAD,y0-ext,x1+ext+PAD,y1+ext]
        kp3,sc,_,kp2=m(f,bboxes=[box])
        kp2=kp2[0].copy(); kp2[:,0]-=PAD
        # agreement with the RTMO 2D track on the 17 body joints
        msk=s>0.3
        err=np.median(np.linalg.norm(kp2[:17][msk]-k[msk],axis=1)) if msk.sum()>=4 else 999
        size=max(w,h)
        res[nm]=dict(k3=kp3[0],k2=kp2,sc=sc[0],err=float(err),size=float(size),rtmo=k,rtmos=s)
    out.append(res); i+=1
    if i%30==0: print(i,flush=True)
pickle.dump(dict(fixed=fixed,lift=out),open('lift.pkl','wb'))
for nm in 'AR':
    e=[ (r[nm]['err']/r[nm]['size'] if nm in r else None) for r in out]
    print(nm,' '.join('--' if v is None else ('%.0f'%(100*v)) for v in e))
