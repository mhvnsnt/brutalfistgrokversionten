import cv2, numpy as np, pickle
from rtmlib import RTMPose3d
m=RTMPose3d('https://huggingface.co/Soykaf/RTMW3D-x/resolve/main/onnx/rtmw3d-x_8xb64_cocktail14-384x288-b0a0eab7_20240626.onnx', model_input_size=(288,384))
cap=cv2.VideoCapture('CHAINSNATCHER.mp4'); fr=[]
while True:
    ok,f=cap.read()
    if not ok: break
    fr.append(f)
E=[(5,6),(5,11),(6,12),(11,12),(5,7),(7,9),(6,8),(8,10),(11,13),(13,15),(12,14),(14,16),(0,5),(0,6)]
# hand-placed attacker boxes (x0,y0,x1,y1), from the raw frames: behind/under the receiver
BOX={}
for i in range(128,162):
    if i<=136: BOX[i]=(250,150,560,700)
    elif i<=142: BOX[i]=(230,250,560,780)
    else: BOX[i]=(180,380,576,860)
out={}; tiles=[]
for i,b in BOX.items():
    kp3,sc,_,kp2=m(fr[i],bboxes=[list(b)])
    out[i]=dict(k2=kp2[0],sc=sc[0],k3=kp3[0],box=b)
    if i%2==0:
        f=fr[i].copy(); k=kp2[0]; s=sc[0]
        cv2.rectangle(f,b[:2],b[2:],(255,255,255),2)
        for a,c in E:
            if s[a]>1.5 and s[c]>1.5: cv2.line(f,tuple(int(v) for v in k[a]),tuple(int(v) for v in k[c]),(0,255,0),4)
        for j in (11,12,13,14,15,16):
            cv2.circle(f,tuple(int(v) for v in k[j]),7,(0,0,255) if j%2 else (255,255,255),-1)
        cv2.putText(f,'f%d'%i,(10,60),0,2,(0,255,255),4)
        tiles.append(cv2.resize(f[150:900],(300,390)))
pickle.dump(out,open('probe_atk.pkl','wb'))
print({i:np.round(o['sc'][[5,6,11,12,13,14,15,16]],1).tolist() for i,o in list(out.items())[::3]})
n=6; tiles+=[np.zeros_like(tiles[0])]*((-len(tiles))%n)
cv2.imwrite('probe_atk.png',np.vstack([np.hstack(tiles[j:j+n]) for j in range(0,len(tiles),n)]))
