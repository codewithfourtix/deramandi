"""Near-duplicate check for the sugarcane split.

A 16x16 dHash of a padded square cannot tell thin billets apart (different
billets come out 0 bits apart), so this hashes the billet strip itself (8x64
gradients along the cane) and compares test -> nearest training photo against a
control: training photo -> nearest training photo of a different billet. If
test photos are no closer than the control, no billet leaked across splits.
Result for the shipped split: test median 74 bits (min 34) vs control median
75 (min 32); views of the same billet sit ~156 bits apart.
"""
import json, os, re, numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
D = os.environ.get('DERAMANDI_DATA', os.path.join(HERE, '..', '..', 'data'))
OUT = os.environ.get('DERAMANDI_OUT', os.path.join(HERE, 'out'))
s=json.load(open(os.path.join(OUT, 'sugarcane', 'splits.json')))
def h(rel):
    g=np.asarray(Image.open(os.path.join(D,rel)).convert('L').resize((9,64),Image.BILINEAR),dtype=np.int16)
    return (g[:,1:]>g[:,:-1]).flatten()   # 8x64 = 512 bits along the cane
def billet(rel): return os.path.dirname(rel)+'|'+re.match(r'(\d+-b[a-z]?\d+)',os.path.basename(rel)).group(1)
tr=[(r,h(r)) for r,_ in s['train']]; te=[(r,h(r)) for r,_ in s['test']]
T=np.array([x for _,x in tr]); names=[r for r,_ in tr]
# reference: distance between views of the same billet, and between different billets
same=[];diff=[]
by={}
for r,x in te: by.setdefault(billet(r),[]).append(x)
for v in by.values():
    for i in range(len(v)):
        for j in range(i+1,len(v)): same.append((v[i]!=v[j]).sum())
mins=[]
for r,x in te:
    d=(T!=x).sum(1); mins.append(int(d.min()))
rng=np.random.default_rng(0)
for _ in range(2000):
    a,b=rng.integers(len(T),size=2)
    if billet(names[a])!=billet(names[b]): diff.append((T[a]!=T[b]).sum())
print('same billet, other view: median',np.median(same),'p10',np.percentile(same,10))
print('random different billets: median',np.median(diff),'p1',np.percentile(diff,1))
print('test -> nearest train: median',np.median(mins),'p10',np.percentile(mins,10),'min',min(mins))
print('test photos closer to a train photo than the 10th percentile of same-billet views:',sum(m<np.percentile(same,10) for m in mins),'of',len(mins))
ctrl=[]
idx=rng.choice(len(T),400,replace=False)
for a in idx:
    d=(T!=T[a]).sum(1)
    mask=np.array([billet(n)!=billet(names[a]) for n in names])
    ctrl.append(int(d[mask].min()))
print('control, train photo -> nearest OTHER-billet train photo: median',np.median(ctrl),'p10',np.percentile(ctrl,10),'min',min(ctrl))
