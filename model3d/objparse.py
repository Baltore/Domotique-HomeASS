"""Lecture d'un OBJ exporté par Sweet Home 3D : sommets, normales, uv, groupes (faces + matière)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "libs"))
import numpy as np, collections


def parse_obj(path):
    V, VT, VN = [], [], []
    groups = collections.OrderedDict()   # nom -> liste de (matiere, [(vi,ti,ni) x3])
    cur = None
    mat = None
    with open(path, encoding='utf8', errors='replace') as f:
        for l in f:
            c = l[:2]
            if c == 'v ':
                p = l.split(); V.append((float(p[1]), float(p[2]), float(p[3])))
            elif c == 'vn':
                p = l.split(); VN.append((float(p[1]), float(p[2]), float(p[3])))
            elif c == 'vt':
                p = l.split(); VT.append((float(p[1]), float(p[2])))
            elif c == 'g ':
                cur = l[2:].strip(); groups.setdefault(cur, [])
            elif c == 'us':
                mat = l.split(None, 1)[1].strip()
            elif c == 'f ':
                toks = l.split()[1:]
                tri = []
                for t in toks:
                    q = t.split('/')
                    vi = int(q[0]) - 1
                    ti = int(q[1]) - 1 if len(q) > 1 and q[1] else -1
                    ni = int(q[2]) - 1 if len(q) > 2 and q[2] else -1
                    tri.append((vi, ti, ni))
                for k in range(1, len(tri) - 1):
                    groups[cur].append((mat, (tri[0], tri[k], tri[k + 1])))
    return np.array(V, dtype=np.float64), np.array(VT, dtype=np.float64), np.array(VN, dtype=np.float64), groups


def parse_mtl(path):
    mats = {}
    cur = None
    with open(path, encoding='utf8', errors='replace') as f:
        for l in f:
            p = l.split()
            if not p:
                continue
            if p[0] == 'newmtl':
                cur = mats.setdefault(p[1], {})
            elif cur is not None:
                if p[0] in ('Kd', 'Ks', 'Ke'):
                    cur[p[0]] = [float(x) for x in p[1:4]]
                elif p[0] in ('Ns', 'd', 'Tr'):
                    cur[p[0]] = float(p[1])
                elif p[0] == 'map_Kd':
                    cur['map_Kd'] = ' '.join(p[1:])
    return mats
