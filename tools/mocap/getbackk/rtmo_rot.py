import cv2, numpy as np, pickle
from rtmlib import RTMO
m = RTMO('https://download.openmmlab.com/mmpose/v1/projects/rtmo/onnx_sdk/rtmo-l_16xb16-600e_body7-640x640-b37118ce_20231211.zip',
         model_input_size=(640,640), score_thr=0.12)
PAD=224
cap=cv2.VideoCapture('GETBACKK.mp4'); out=[]
while True:
    ok,fr=cap.read()
    if not ok: break
    f=cv2.copyMakeBorder(fr,0,0,PAD,PAD,cv2.BORDER_CONSTANT,value=(0,0,0))
    Hh,Ww=f.shape[:2]; cands=[]
    for rot in (0,90,270):
        img = f if rot==0 else cv2.rotate(f, cv2.ROTATE_90_CLOCKWISE if rot==90 else cv2.ROTATE_90_COUNTERCLOCKWISE)
        k,s=m(img); k=np.array(k,dtype=float); s=np.array(s)
        for p in range(len(k)):
            kp=k[p].copy()
            if rot==90:  # rotated cw: (u,v) -> x=v, y=Hh-1-u
                kp=np.stack([kp[:,1], Hh-1-kp[:,0]],1)
            elif rot==270: # ccw: x=Ww-1-v, y=u
                kp=np.stack([Ww-1-kp[:,1], kp[:,0]],1)
            kp[:,0]-=PAD
            cands.append(dict(k=kp,s=s[p],rot=rot))
    out.append(cands)
    if len(out)%30==0: print(len(out),flush=True)
pickle.dump(out,open('rtmo_rot.pkl','wb'))
