"""plan Sweet Home 3D + pieces.json -> scene.json (murs, pièces avec bouton lumière, appareils, points d'échantillonnage).
usage: hotspots.py maison.sh3d glb_dir config.json
config.json (voir config.example.json) : areas, area_lights, devices, entities, room_script."""
import json, re, sys, os, math, zipfile
import xml.etree.ElementTree as ET

SH3D, D, CONF = sys.argv[1:4]
CFG = json.load(open(CONF, encoding='utf8'))
P = json.load(open(os.path.join(D, 'pieces.json'), encoding='utf8'))
pieces = P['pieces']
LEVBASE = {int(k): v for k, v in P['levbase'].items()}
root = ET.fromstring(zipfile.ZipFile(SH3D).read('Home.xml'))
levels = sorted(root.iter('level'), key=lambda l: float(l.get('elevation')))
lidx = {l.get('id'): i for i, l in enumerate(levels)}

# ---------------------------------------------------------------------------------------------- pièces du plan
rooms = {}
for e in root.iter('room'):
    pts = [(float(p.get('x')), float(p.get('y'))) for p in e.findall('point')]
    rooms[(lidx.get(e.get('level'), 0), e.get('name'))] = pts


def inside(pt, poly):
    x, y = pt; c = False
    for i in range(len(poly)):
        x0, y0 = poly[i]; x1, y1 = poly[(i + 1) % len(poly)]
        if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / (y1 - y0) + x0:
            c = not c
    return c


def edge_dist(pt, poly):
    best = 1e9
    for i in range(len(poly)):
        ax, ay = poly[i]; bx, by = poly[(i + 1) % len(poly)]
        dx, dy = bx - ax, by - ay; L2 = dx * dx + dy * dy
        u = 0 if L2 == 0 else max(0, min(1, ((pt[0] - ax) * dx + (pt[1] - ay) * dy) / L2))
        best = min(best, math.hypot(pt[0] - (ax + u * dx), pt[1] - (ay + u * dy)))
    return best


def poly_area(poly):
    a = 0
    for i in range(len(poly)):
        x0, y0 = poly[i]; x1, y1 = poly[(i + 1) % len(poly)]
        a += x0 * y1 - x1 * y0
    return abs(a) / 2


def best_point(poly):
    xs, ys = [p[0] for p in poly], [p[1] for p in poly]
    best, bd = None, -1
    x = min(xs)
    while x <= max(xs):
        y = min(ys)
        while y <= max(ys):
            if inside((x, y), poly):
                d = edge_dist((x, y), poly)
                if d > bd:
                    best, bd = (x, y), d
            y += 15
        x += 15
    return best, bd


# zone Home Assistant -> pièce du plan (nom de la pièce dans Sweet Home 3D) ; même identifiants que le script de bascule des lumières
AREAS = [(a['area'], a['room'], a.get('level', 0)) for a in CFG.get('areas', [])]
# lumières connues par zone (repli si le registre n'est pas fourni par Home Assistant)
AREA_LIGHTS = CFG.get('area_lights', {})
R = []
for area, name, lv in AREAS:
    poly = rooms.get((lv, name))
    if not poly:
        print('pièce introuvable :', name); continue
    (cx, cz), bd = best_point(poly)
    base = LEVBASE[lv]
    rad = math.sqrt(poly_area(poly) / math.pi)
    R.append({'area': area, 'name': name, 'level': lv, 'pos': [round(cx), round(base + 150), round(cz)],
              'light': {'pos': [round(cx), round(base + 205), round(cz)], 'distance': round(max(380, rad * 3.4)), 'color': '#ffc27a', 'intensity': 1.25}})

# échantillons de sol pour décider quels murs gênent la vue
samples = {}
for lv in range(len(LEVBASE)):
    pts = []
    for (l, name), poly in rooms.items():
        if l != lv:
            continue
        xs, ys = [p[0] for p in poly], [p[1] for p in poly]
        x = min(xs) + 40
        while x < max(xs):
            y = min(ys) + 40
            while y < max(ys):
                if inside((x, y), poly) and edge_dist((x, y), poly) > 25:
                    pts += [round(x), round(y)]
                y += 85
            x += 85
    samples[lv] = pts
print('échantillons', {k: len(v) // 2 for k, v in samples.items()})


# ---------------------------------------------------------------------------------------------- appareils
def find(rx, level):
    r = [p for p in pieces if re.search(rx, p['name']) and p['level'] == level]
    if not r:
        raise SystemExit('introuvable : ' + rx)
    return r[0]


devices = []
for x in CFG.get('devices', []):
    p = find(x['match'], x.get('level', 0))
    kind = x['kind']
    y = p['y'] + p['h'] + 16 if p['h'] < 40 else p['y'] + p['h'] * 0.5
    d = {'kind': kind, 'entity': x['entity'], 'icon': x.get('icon', 'mdi:circle'), 'name': x.get('name', x['entity']), 'floor': x.get('level', 0), 'pos': [round(p['x'], 1), round(y, 1), round(p['z'], 1)]}
    for k in ('with', 'image', 'battery', 'unit'):
        if k in x:
            d[k] = x[k]
    if kind == 'robot':
        d['pos'][1] = round(p['y'] + p['h'] + 22, 1)
    if kind == 'sensor':
        d['label'] = True; d.setdefault('unit', '°C')
    devices.append(d)

def escapes(pt, d, segs):
    for a, b in segs:
        ex, ey = b[0] - a[0], b[1] - a[1]
        den = d[0] * ey - d[1] * ex
        if abs(den) < 1e-9:
            continue
        sp = ((a[0] - pt[0]) * ey - (a[1] - pt[1]) * ex) / den
        u = ((a[0] - pt[0]) * d[1] - (a[1] - pt[1]) * d[0]) / den
        if sp > 0 and 0 <= u <= 1:
            return False
    return True


# mur extérieur = depuis son milieu, un rayon perpendiculaire s'échappe sans toucher d'autre mur du même étage
for w in P['walls']:
    if w.get('follow'):
        continue
    segs = [(o['a'], o['b']) for o in P['walls'] if o['level'] == w['level'] and o is not w and not o.get('follow')]
    ex, ey = w['b'][0] - w['a'][0], w['b'][1] - w['a'][1]
    L = math.hypot(ex, ey) or 1
    nx, ny = -ey / L, ex / L
    votes = 0
    for t in (0.25, 0.5, 0.75):
        mx, my = w['a'][0] + ex * t, w['a'][1] + ey * t
        off = w.get('t', 20) / 2 + 3
        if escapes((mx + nx * off, my + ny * off), (nx, ny), segs) or escapes((mx - nx * off, my - ny * off), (-nx, -ny), segs):
            votes += 1
    w['ext'] = votes >= 2
print('murs extérieurs :', sum(1 for w in P['walls'] if w.get('ext')), '/', len(P['walls']))

BB = list(P['bounds'].values())
# chaque étage est visé en son propre centre (emprise du niveau, hauteur de coupe des murs) : tous les étages sont centrés à l'écran
FLOORS = []
for i in sorted(LEVBASE):
    b = P['bounds'][str(i)]
    FLOORS.append({'name': 'RDC' if i == 0 else 'Étage %d' % i, 'base': LEVBASE[i],
                   'look': [round((b[0] + b[3]) / 2), round(LEVBASE[i] + 60), round((b[2] + b[5]) / 2)]})
x0, x1 = min(b[0] for b in BB), max(b[3] for b in BB); z0, z1 = min(b[2] for b in BB), max(b[5] for b in BB)
S = {'glb': 'maison.glb', 'center': [round((x0 + x1) / 2), 60, round((z0 + z1) / 2)], 'size': [round(x1 - x0), round(z1 - z0)], 'cut': P['cut'],
     'floors': FLOORS,
     'walls': P['walls'], 'samples': samples, 'sampleH': 45, 'rooms': R, 'devices': devices, 'areaLights': AREA_LIGHTS}
if CFG.get('entities'):
    S['entities'] = CFG['entities']
if CFG.get('room_script'):
    S['roomScript'] = CFG['room_script']
json.dump(S, open(os.path.join(D, 'scene.json'), 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
print(len(R), 'pièces,', len(devices), 'appareils,', len(P['walls']), 'murs ->', os.path.getsize(os.path.join(D, 'scene.json')) // 1024, 'Ko')
for r in R: print(' ', r['area'], r['pos'])
for d in devices: print(' ', d['kind'], d['name'], d['pos'])
