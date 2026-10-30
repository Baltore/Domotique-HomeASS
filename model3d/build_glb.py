"""OBJ exporté par Sweet Home 3D -> GLB léger (un nœud par niveau, murs « dynamiques ») + pieces.json
usage: build_glb.py maison.sh3d export.obj export.mtl out_dir [cut_cm [cellule_cm]]

Chaque mur est un nœud séparé (W<id>) que la carte peut écraser (hauteur coupée) ou laisser en entier selon l'angle de vue.
Les portes/fenêtres sont rattachées au mur qui les contient (elles suivent sa hauteur)."""
import sys, os, re, json, math, struct, zipfile, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from objparse import parse_obj, parse_mtl
import numpy as np
import xml.etree.ElementTree as ET

SH3D, OBJ, MTL, OUT = sys.argv[1:5]
CUT = float(sys.argv[5]) if len(sys.argv) > 5 else 115.0
CELL = float(sys.argv[6]) if len(sys.argv) > 6 else 2.0     # allègement des meubles très détaillés : sommets proches fusionnés (0 = désactivé)
os.makedirs(OUT, exist_ok=True)
SRC = os.path.dirname(os.path.abspath(OBJ))

# ---------------------------------------------------------------------------------------------- pièces du plan
_zf = zipfile.ZipFile(SH3D)
if _zf.getinfo('Home.xml').file_size > 400e6:           # garde-fou : archive piégée (« zip bomb ») ou plan démesuré
    sys.exit('Home.xml trop gros : plan refusé')
root = ET.fromstring(_zf.read('Home.xml'))
levels = sorted(root.iter('level'), key=lambda l: float(l.get('elevation')))
lev = {l.get('id'): (float(l.get('elevation')), i) for i, l in enumerate(levels)}
LEVBASE = {i: float(l.get('elevation')) for i, l in enumerate(levels)}
LEVFT = {i: float(l.get('floorThickness') or 0) for i, l in enumerate(levels)}
NL = len(levels)
LEVNAMES = ['RDC'] + ['ETAGE%d' % i for i in range(1, NL)]


def level_of_y(y, tol=21.0):
    """niveau dont le sol (épaisseur de dalle comprise) est le plus haut sous y"""
    return max([i for i in range(NL) if LEVBASE[i] - (tol if i else 1e9) <= y] or [0])
pieces = []
for e in root:
    if e.tag not in ('pieceOfFurniture', 'light', 'doorOrWindow') or e.get('visible') == 'false':
        continue
    nm = e.get('name') or ''
    if 'trémie' in nm:
        continue
    el, li = lev.get(e.get('level'), (0.0, 0))
    x, y = float(e.get('x')), float(e.get('y'))
    w, d, h = float(e.get('width')), float(e.get('depth')), float(e.get('height'))
    z0 = el + float(e.get('elevation') or 0)
    a = float(e.get('angle') or 0)
    pieces.append(dict(i=len(pieces), name=nm, tag=e.tag, level=li, x=x, y=y, w=w, d=d, h=h, z0=z0, a=a, vol=w * d * h))
print(len(pieces), 'pièces')

V, VT, VN, G = parse_obj(OBJ)
MT = parse_mtl(MTL)
NT, NN = len(VT), len(VN)
print(len(V), 'sommets', len(G), 'groupes', len(MT), 'matières')


def contains(p, c, m=6.0):
    dx, dz = c[0] - p['x'], c[2] - p['y']
    co, si = math.cos(p['a']), math.sin(p['a'])
    lx, ly = dx * co + dz * si, -dx * si + dz * co
    return abs(lx) <= p['w'] / 2 + m and abs(ly) <= p['d'] / 2 + m and p['z0'] - m <= c[1] <= p['z0'] + p['h'] + m


# ---------------------------------------------------------------------------------------------- infos par groupe
info = {}
for gname, fs in G.items():
    if not fs:
        continue
    vi = np.unique(np.array([[t[0] for t in tri] for m, tri in fs]).ravel())
    P = V[vi]
    mn, mx = P.min(0), P.max(0)
    info[gname] = dict(mn=mn, mx=mx, c=(mn + mx) / 2, n=len(fs), vi=vi)

# ---------------------------------------------------------------------------------------------- murs : une unité par mur
wall_groups = collections.OrderedDict()
for g in info:
    m = re.match(r'wall_(\d+)_', g)
    if m:
        wall_groups.setdefault(m.group(1), []).append(g)
walls = {}
for wid, gl in wall_groups.items():
    pts = V[np.unique(np.concatenate([info[g]['vi'] for g in gl]))]
    X, Z, Y = pts[:, 0], pts[:, 2], pts[:, 1]
    lvl = level_of_y(Y.min() + 30, 0)
    mx_, mz_ = X.mean(), Z.mean()
    cxx, czz, cxz = ((X - mx_) ** 2).mean(), ((Z - mz_) ** 2).mean(), ((X - mx_) * (Z - mz_)).mean()
    th = 0.5 * math.atan2(2 * cxz, cxx - czz)
    ax, az = math.cos(th), math.sin(th)
    t = (X - mx_) * ax + (Z - mz_) * az
    d = -(X - mx_) * az + (Z - mz_) * ax
    cd = (d.max() + d.min()) / 2
    cx, cz = mx_ - az * cd, mz_ + ax * cd
    A = (cx + ax * t.min(), cz + az * t.min()); B = (cx + ax * t.max(), cz + az * t.max())
    walls[wid] = dict(name='W%s' % wid, level=lvl, a=[round(A[0], 1), round(A[1], 1)], b=[round(B[0], 1), round(B[1], 1)],
                      t=round(float(d.max() - d.min()), 1), y0=round(float(Y.min()), 1), y1=round(float(Y.max()), 1),
                      cut=round(LEVBASE[lvl] + CUT, 1), pivot=round(float(Y.min()), 1), groups=gl)
print(len(walls), 'murs')


def dist_seg(px, pz, A, B):
    ax_, az_ = B[0] - A[0], B[1] - A[1]
    L2 = ax_ * ax_ + az_ * az_
    u = 0 if L2 == 0 else max(0, min(1, ((px - A[0]) * ax_ + (pz - A[1]) * az_) / L2))
    return math.hypot(px - (A[0] + u * ax_), pz - (A[1] + u * az_))


def nearest_wall(piece):
    best, bd = None, 1e9
    for wid, w in walls.items():
        if w['level'] != piece['level']:
            continue
        d = dist_seg(piece['x'], piece['y'], w['a'], w['b'])
        if d < bd:
            best, bd = wid, d
    return (best, bd) if best is not None and bd <= 70 else (None, bd)


# ---------------------------------------------------------------------------------------------- classement des groupes
extra = []      # (groupe, niveau) : groupes copiés aussi dans le niveau du dessus (escaliers)
owner = {}     # groupe -> nom du meuble (diagnostic)
plan = {}      # groupe -> (niveau, seau, genre)   seau = ('static', lvl) | ('wall', wid) | ('follow', clé)
skipped = collections.Counter()
followers = {}  # clé -> dict
for g, i in info.items():
    c = i['c']
    if g.startswith('ground'):
        skipped['ground'] += 1; continue
    m = re.match(r'wall_(\d+)_', g)
    if m:
        wid = m.group(1)
        plan[g] = (walls[wid]['level'], ('wall', wid), 'wall'); continue
    if g.startswith('room'):
        lv = next((i for i in range(1, NL) if LEVBASE[i] - LEVFT[i] - 5 < c[1] < LEVBASE[i] + 5), 0 if abs(c[1]) < 1 else None)
        if lv is None:
            skipped['plafond'] += 1
        else:
            plan[g] = (lv, ('static', lv), 'room')
        continue
    best, bv = None, 1e18
    for p in pieces:
        if p['vol'] < bv and contains(p, c):
            best, bv = p, p['vol']
    if best is None:
        if i['n'] <= 2 and np.linalg.norm(i['mx'] - i['mn']) > 150:
            skipped['sliver'] += 1; continue
        lv = level_of_y(c[1])
        plan[g] = (lv, ('static', lv), 'other'); continue
    owner[g] = best['name']
    if best['name'].startswith('Escalier') and best['level'] + 1 < NL:     # l'escalier qui monte reste visible depuis l'étage d'arrivée
        extra.append((g, best['level'] + 1))
    if best['tag'] == 'light' and best['z0'] >= 190:
        skipped['spot_plafond'] += 1; continue
    if best['tag'] == 'doorOrWindow':
        wid, dd = nearest_wall(best)
        if wid is None:
            plan[g] = (best['level'], ('static', best['level']), 'other'); skipped['porte_sans_mur'] += 1; continue
        if best['z0'] - LEVBASE[best['level']] >= 90:       # porte surélevée (palier) : suit le mur mais garde son pied
            key = 'D%d' % best['i']
            f = followers.setdefault(key, dict(name=key, level=best['level'], follow='W' + wid, pivot=None, groups=[]))
            f['groups'].append(g)
            plan[g] = (best['level'], ('follow', key), 'door')
        else:
            plan[g] = (best['level'], ('wall', wid), 'door')
        continue
    plan[g] = (best['level'], ('static', best['level']), 'other')
print('classés', len(plan), 'ignorés', dict(skipped), 'suiveurs', len(followers))
for f in followers.values():
    ys = np.concatenate([V[info[g]['vi']][:, 1] for g in f['groups']])
    f['pivot'] = round(float(ys.min()), 1)

# ---------------------------------------------------------------------------------------------- matières
WALL_BODY, WALL_CAP = (0.18, 0.22, 0.31), (0.42, 0.55, 0.78)     # sRGB


def lin(c):
    return [float(x) ** 2.2 for x in c]


def mat_key(name, kind):
    if kind == 'wall_body': return ('WALL_BODY',)
    if kind == 'wall_cap': return ('WALL_CAP',)
    m = MT.get(name, {})
    kd = tuple(round(x, 3) for x in m.get('Kd', [0.8, 0.8, 0.8]))
    ks = round(max(m.get('Ks', [0, 0, 0])), 2)
    d = m.get('d', 1.0)
    if 'Tr' in m: d = 1 - m['Tr']
    tex = m.get('map_Kd')
    return (kd, ks, round(m.get('Ns', 1), 0), round(d, 2), tex)


def mat_def(key):
    if key[0] == 'WALL_BODY': return dict(color=lin(WALL_BODY), alpha=1.0, rough=0.9, metal=0.05, tex=None)
    if key[0] == 'WALL_CAP': return dict(color=lin(WALL_CAP), alpha=1.0, rough=0.7, metal=0.1, tex=None)
    kd, ks, ns, d, tex = key
    rough = 0.9 if ks < 0.15 else max(0.25, 0.8 - ks)
    return dict(color=lin(kd) if not tex else [1, 1, 1], alpha=d, rough=rough, metal=0.0, tex=tex)


# ---------------------------------------------------------------------------------------------- fusion par (seau, matière)
meshes = collections.OrderedDict()   # (seau, clé mat, bloc) -> listes pos/nrm/uv/idx
chunk = {}
for g, (lv, bucket, kind) in list(plan.items()) + [(g, (L, ('static', L), 'other')) for g, L in extra]:
    byMat = collections.defaultdict(list)
    for m, tri in G[g]:
        byMat[m].append(tri)
    for m, tris in byMat.items():
        T = np.array(tris, dtype=np.int64)   # (f,3,3) vi,ti,ni
        if kind == 'wall':
            nrm = VN[T[:, 0, 2]] if (T[:, 0, 2] >= 0).all() else np.zeros((len(T), 3))
            top = nrm[:, 1] > 0.7
            parts = [(T[top], 'wall_cap'), (T[~top], 'wall_body')]
        else:
            parts = [(T, 'plain')]
        for TT, k in parts:
            if len(TT) == 0:
                continue
            key = mat_key(m, k)
            flat = TT.reshape(-1, 3)
            code = (flat[:, 0] * (NT + 1) + (flat[:, 1] + 1)) * (NN + 1) + (flat[:, 2] + 1)
            uniq, inv = np.unique(code, return_inverse=True)
            ni = uniq % (NN + 1) - 1
            ti = (uniq // (NN + 1)) % (NT + 1) - 1
            vi = uniq // ((NN + 1) * (NT + 1))
            pos = V[vi].copy()
            nr = VN[ni] if (ni >= 0).all() else np.tile([0, 1, 0], (len(uniq), 1))
            if k == 'wall_cap':
                nr = np.tile([0.0, 1.0, 0.0], (len(uniq), 1))
            uv = VT[ti] if (ti >= 0).all() else np.zeros((len(uniq), 2))
            ck = (bucket, key)
            ch = chunk.get(ck, 0)
            if (bucket, key, ch) in meshes and meshes[(bucket, key, ch)]['n'] + len(uniq) > 64000:
                ch += 1; chunk[ck] = ch
            mm = meshes.setdefault((bucket, key, ch), dict(pos=[], nrm=[], uv=[], idx=[], n=0, hasuv=False, lv=lv, simple=True))
            if kind in ('room',) or k in ('wall_body', 'wall_cap'):
                mm['simple'] = False
            mm['pos'].append(pos); mm['nrm'].append(nr); mm['uv'].append(uv)
            mm['idx'].append(inv.reshape(-1, 3) + mm['n']); mm['n'] += len(uniq)
            mm['hasuv'] = mm['hasuv'] or bool((ti >= 0).all() and key[0] not in ('WALL_BODY', 'WALL_CAP') and key[-1])
_cnt = collections.Counter()
for g, (lv, bucket, kind) in plan.items():
    _cnt[(lv, owner.get(g, '(' + kind + ')'))] += len(set(t[0] for m, tri in G[g] for t in tri)) if G[g] else 0
print('plus lourds :', [(k, v) for k, v in _cnt.most_common(30)])
print('meshes', len(meshes), 'sommets', sum(m['n'] for m in meshes.values()))
print('sommets par niveau', {i: sum(m['n'] for m in meshes.values() if m['lv'] == i) for i in range(NL)})

# ---------------------------------------------------------------------------------------------- écriture GLB
binbuf = bytearray()
views, accs, gmeshes, gmats, gimgs, gtex = [], [], [], [], [], []
imgIndex = {}


def add_view(data, target=None):
    while len(binbuf) % 4:
        binbuf.append(0)
    off = len(binbuf)
    binbuf.extend(data)
    v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
    if target:
        v['target'] = target
    views.append(v)
    return len(views) - 1


def add_acc(arr, ctype, atype, target, minmax=False):
    vi = add_view(arr.tobytes(), target)
    a = {'bufferView': vi, 'componentType': ctype, 'count': int(arr.shape[0]), 'type': atype}
    if minmax:
        a['min'] = [float(x) for x in arr.min(0)]
        a['max'] = [float(x) for x in arr.max(0)]
    accs.append(a)
    return len(accs) - 1


matIndex = {}


def get_mat(key):
    if key in matIndex:
        return matIndex[key]
    d = mat_def(key)
    pbr = {'baseColorFactor': [*d['color'], d['alpha']], 'metallicFactor': d['metal'], 'roughnessFactor': d['rough']}
    if d['tex']:
        tp = os.path.realpath(os.path.join(SRC, d['tex']))
        # les textures ne sont lues que dans le dossier de l'export (un .mtl piégé ne doit pas faire embarquer un autre fichier du disque)
        if not tp.startswith(os.path.realpath(SRC) + os.sep) or not tp.lower().endswith(('.jpg', '.jpeg', '.png')):
            print("texture ignorée (hors du dossier d'export ou format inattendu) :", d['tex']); tp = ''
        if tp and os.path.exists(tp):
            if tp not in imgIndex:
                vi = add_view(open(tp, 'rb').read())
                gimgs.append({'bufferView': vi, 'mimeType': 'image/jpeg' if tp.lower().endswith(('jpg', 'jpeg')) else 'image/png'})
                gtex.append({'sampler': 0, 'source': len(gimgs) - 1})
                imgIndex[tp] = len(gtex) - 1
            pbr['baseColorTexture'] = {'index': imgIndex[tp]}
    m = {'pbrMetallicRoughness': pbr, 'name': 'm%d' % len(gmats)}
    if d['alpha'] < 0.99:
        m['alphaMode'] = 'BLEND'
    gmats.append(m)
    matIndex[key] = len(gmats) - 1
    return matIndex[key]


nodes = [{'name': LEVNAMES[i], 'children': []} for i in range(NL)]
unitNode = {}      # seau -> index du nœud d'unité
bounds = {i: [1e9, 1e9, 1e9, -1e9, -1e9, -1e9] for i in range(NL)}


def unit_node(bucket, lv):
    if bucket[0] == 'static':
        return lv
    if bucket not in unitNode:
        name = ('W' + bucket[1]) if bucket[0] == 'wall' else bucket[1]
        nodes.append({'name': name, 'children': []})
        unitNode[bucket] = len(nodes) - 1
        nodes[lv]['children'].append(unitNode[bucket])
    return unitNode[bucket]


def decimate(pos, nr, uv, idx, cell):
    """fusionne les sommets d'une même cellule (même orientation de normale) : allège les modèles très détaillés"""
    q = np.concatenate([np.floor(pos / cell), np.round(nr * 1.5)], axis=1).astype(np.int64)
    _, first, inv = np.unique(q, axis=0, return_index=True, return_inverse=True)
    rep = first[inv.ravel()]
    tri = rep[idx.reshape(-1, 3)]
    tri = tri[(tri[:, 0] != tri[:, 1]) & (tri[:, 1] != tri[:, 2]) & (tri[:, 0] != tri[:, 2])]
    used = np.unique(tri)
    remap = np.full(len(pos), -1, dtype=np.int64); remap[used] = np.arange(len(used))
    return pos[used], nr[used], uv[used], remap[tri].ravel()


_before = _after = 0
for (bucket, key, _ch), mm in meshes.items():
    lv = mm['lv']
    pos = np.concatenate(mm['pos']).astype('<f4')
    nr = np.concatenate(mm['nrm']).astype('<f4')
    ln = np.linalg.norm(nr, axis=1, keepdims=True); ln[ln == 0] = 1; nr = (nr / ln).astype('<f4')
    idx = np.concatenate(mm['idx']).astype('<u4').ravel()
    uvall = np.concatenate(mm['uv']).astype('<f4')
    _before += len(pos)
    if CELL > 0 and mm['simple'] and len(pos) > 3000:
        pos, nr, uvall, idx = decimate(pos, nr, uvall, idx, CELL)
        pos = pos.astype('<f4'); nr = nr.astype('<f4'); uvall = uvall.astype('<f4'); idx = idx.astype('<u4')
    _after += len(pos)
    n8 = np.zeros((nr.shape[0], 4), dtype=np.int8); n8[:, :3] = np.clip(np.round(nr * 127), -127, 127).astype(np.int8)
    nv = add_view(n8.tobytes(), 34962); views[nv]['byteStride'] = 4
    accs.append({'bufferView': nv, 'componentType': 5120, 'normalized': True, 'count': int(nr.shape[0]), 'type': 'VEC3'})
    nacc = len(accs) - 1
    attrs = {'POSITION': add_acc(pos, 5126, 'VEC3', 34962, True), 'NORMAL': nacc}
    if mm['hasuv']:
        uv = uvall.copy(); uv[:, 1] = 1.0 - uv[:, 1]
        attrs['TEXCOORD_0'] = add_acc(uv, 5126, 'VEC2', 34962)
    if pos.shape[0] < 65536:
        idxa = add_acc(idx.astype('<u2'), 5123, 'SCALAR', 34963)
    else:
        idxa = add_acc(idx, 5125, 'SCALAR', 34963)
    gmeshes.append({'primitives': [{'attributes': attrs, 'indices': idxa, 'material': get_mat(key)}]})
    parent = unit_node(bucket, lv)
    nodes.append({'mesh': len(gmeshes) - 1})
    nodes[parent]['children'].append(len(nodes) - 1)
    b = bounds[lv]
    for k in range(3):
        b[k] = min(b[k], float(pos[:, k].min())); b[3 + k] = max(b[3 + k], float(pos[:, k].max()))

print('allègement : sommets', _before, '->', _after)
gltf = {'asset': {'version': '2.0', 'generator': 'maison-3d'}, 'scene': 0, 'scenes': [{'nodes': list(range(NL))}], 'nodes': nodes, 'meshes': gmeshes,
        'materials': gmats, 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(binbuf)}],
        'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}]}
if gimgs:
    gltf['images'] = gimgs; gltf['textures'] = gtex
js = json.dumps(gltf, separators=(',', ':')).encode('utf8')
js += b' ' * ((4 - len(js) % 4) % 4)
while len(binbuf) % 4:
    binbuf.append(0)
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binbuf)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binbuf), 0x004E4942) + bytes(binbuf)
open(os.path.join(OUT, 'maison.glb'), 'wb').write(glb)
used = {b[1] for (b, _k, _c) in meshes if b[0] == 'wall'}
wl = [dict((k, v) for k, v in w.items() if k != 'groups') for wid, w in walls.items() if wid in used]
for f in followers.values():
    wl.append(dict(name=f['name'], level=f['level'], follow=f['follow'], pivot=f['pivot'], y0=f['pivot'], y1=f['pivot'] + 210,
                   cut=round(LEVBASE[f['level']] + CUT, 1)))
print('GLB', round(len(glb) / 1e6, 1), 'Mo; matières', len(gmats), 'images', len(gimgs), 'murs', len(wl), 'bornes', {k: [round(x) for x in v] for k, v in bounds.items()})
json.dump({'pieces': [dict(i=p['i'], name=p['name'], tag=p['tag'], level=p['level'], x=p['x'], z=p['y'], y=p['z0'], h=p['h'], w=p['w'], d=p['d']) for p in pieces],
           'bounds': bounds, 'cut': CUT, 'walls': wl, 'levbase': LEVBASE}, open(os.path.join(OUT, 'pieces.json'), 'w', encoding='utf8'), ensure_ascii=False)
