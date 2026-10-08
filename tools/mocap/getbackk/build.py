import pickle, numpy as np, json, sys, os, argparse
sys.path.insert(0,'/workspace/ref-repos/Bannon/tools/mocap')
import video_to_clip as V
R=pickle.load(open('recon.pkl','rb'))
LO,HI=int(sys.argv[1]),int(sys.argv[2]); KEYS=int(sys.argv[3]); OUT=sys.argv[4]
FPS=30.0; MAXGAP=6
args=argparse.Namespace(smooth=int(os.environ.get("SMOOTH","5")),keys=KEYS)
os.makedirs(OUT,exist_ok=True); prov={}
for role,key in (('A','GETBACKK'),('R','GETBACKK__RECV')):
    seq=R[role][LO:HI+1]
    idx=[i for i,w in enumerate(seq) if w is not None]
    if idx[0]!=0 or idx[-1]!=len(seq)-1: raise SystemExit('%s: window edge untracked'%role)
    gaps=[]
    for a,b in zip(idx,idx[1:]):
        g=b-a-1
        if g==0: continue
        if g>MAXGAP: raise SystemExit('%s: gap of %d frames at %d..%d exceeds %d'%(role,g,LO+a+1,LO+b-1,MAXGAP))
        gaps.append([LO+a+1,LO+b-1,g])
        for j in range(a+1,b):
            u=(j-a)/(b-a); seq[j]=seq[a]*(1-u)+seq[b]*u
    # same flip the tool's capture_two applies (MediaPipe y-down -> engine y-up)
    ws=[]
    for w in seq:
        w=w.copy(); w[:,1]*=-1; w[:,2]*=-1; ws.append(w)
    times=[(LO+i)/FPS for i in range(len(ws))]
    r=V.build_clip(ws,[1.0]*len(ws),times,args,FPS,len(idx))
    # Constant scale per clip. build_clip normalises EACH KEY by its own head-to-pelvis distance, which
    # pumps the body size whenever the head tucks (measured: thigh 0.32..0.86 on this take). The spine is
    # rigid in this reconstruction, so rescaling every key to the clip's median pelvis->chest length gives
    # one global scale and constant segment lengths.
    tl=[np.linalg.norm(np.array(k['pose']['chest'])) for k in r['clip']['keys']]
    T0=float(np.median(tl))
    for k,t in zip(r['clip']['keys'],tl):
        f=T0/t if t>1e-6 else 1.0
        k['pose']={j:[round(v*f,4) for v in p] for j,p in k['pose'].items()}
    txt=json.dumps(r['clip']); open(os.path.join(OUT,key+'.json'),'w').write(txt)
    prov[key]=dict(role='attacker' if role=='A' else 'receiver', window_frames=[LO,HI], window_s=[LO/FPS,HI/FPS],
                   tracked=len(idx), total=len(seq), coverFrac=round(len(idx)/len(seq),3), interpolated_gaps=gaps,
                   interpolated_frames=sum(g[2] for g in gaps), dur=r['clip']['dur'], keys=len(r['clip']['keys']), bones=r['bones'], span=round(r['span'],3))
    print(key, json.dumps(prov[key]))
json.dump(prov,open(os.path.join(OUT,'capture_report.json'),'w'),indent=1)
