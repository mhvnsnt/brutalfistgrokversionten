import cv2, numpy as np, pickle, math
from rtmlib import RTMPose3d
L=pickle.load(open('lift.pkl','rb')); fixed=L['fixed']; lift=L['lift']
m=RTMPose3d('https://huggingface.co/Soykaf/RTMW3D-x/resolve/main/onnx/rtmw3d-x_8xb64_cocktail14-384x288-b0a0eab7_20240626.onnx', model_input_size=(288,384))
PAD=224
cap=cv2.VideoCapture('CHAINSNATCHER.mp4'); frames=[]
while True:
    ok,fr=cap.read()
    if not ok: break
    frames.append(cv2.copyMakeBorder(fr,0,0,PAD,PAD,cv2.BORDER_CONSTANT,value=(0,0,0)))
def run_rot(f,k,s,ang):
    good=k[s>0.3] if (s>0.3).sum()>=4 else k
    good=good+np.array([PAD,0])
    c=good.mean(0)
    M=cv2.getRotationMatrix2D((float(c[0]),float(c[1])),ang,1.0)   # rotate image by ang deg (ccw)
    g=np.hstack([good,np.ones((len(good),1))])@M.T
    x0,y0=g.min(0); x1,y1=g.max(0); ext=0.08*max(x1-x0,y1-y0)
    rimg=cv2.warpAffine(f,M,(f.shape[1],f.shape[0]))
    kp3,sc,_,kp2=m(rimg,bboxes=[[x0-ext,y0-ext,x1+ext,y1+ext]])
    Mi=cv2.invertAffineTransform(M)
    p2=np.hstack([kp2[0],np.ones((len(kp2[0]),1))])@Mi.T
    p2[:,0]-=PAD
    # rotate 3D xy back (in-plane), around origin; image y down
    a=math.radians(ang); R=np.array([[math.cos(a),-math.sin(a)],[math.sin(a),math.cos(a)]])
    k3=kp3[0].copy(); k3[:,:2]=k3[:,:2]@Mi[:,:2].T
    msk=s>0.3
    err=float(np.median(np.linalg.norm(p2[:17][msk]-k[msk],axis=1))) if msk.sum()>=4 else 999
    return dict(k3=k3,k2=p2,sc=sc[0],err=err,ang=ang)
changed=0
for i in range(len(lift)):
    for nm,r in lift[i].items():
        if r['err']/r['size']<=0.08: r['ang']=0; continue
        k,s=r['rtmo'],r['rtmos']
        sh=(k[5]+k[6])/2; hp=(k[11]+k[12])/2; v=sh-hp
        base=math.degrees(math.atan2(v[0],-v[1]))  # torso angle from up, clockwise positive
        best=dict(r); best['ang']=0
        for d in (0,-35,35,-70,70,180):
            o=run_rot(frames[i],k,s,base+d)
            if o['err']<best['err']: best.update(o)
        if best['ang']!=0: changed+=1
        lift[i][nm]=dict(r,**{kk:best[kk] for kk in ('k3','k2','sc','err','ang')})
print('changed',changed)
pickle.dump(dict(fixed=fixed,lift=lift),open('lift2.pkl','wb'))
for nm in 'AR':
    print(nm,' '.join('--' if nm not in r else ('%.0f'%(100*r[nm]['err']/r[nm]['size'])) for r in lift))
