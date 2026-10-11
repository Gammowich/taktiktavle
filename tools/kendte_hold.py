"""Kendte hold: researchen i tools/kendte_hold/*.json → KNOWN i app.html (Morten 12/10: land → liga/række → hold med
startopstilling og taktik). Brug: python3 tools/kendte_hold.py   (kør derefter python3 build.py)

Hver JSON-fil er én liga: {"country": {...}, "league": {..., "prefix"}, "clubs": [...]}. For hver klub vælges den af appens
formationer (FORMATIONS['11'] i app.html), der passer bedst til spillernes positioner, og spillerne sættes på
formationens pladser (ungarsk metode, som i appen). Data med fejl afvises med en forklaring og kommer ikke i appen."""
import datetime, glob, html, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, 'app.html')
app = open(APP, encoding='utf-8').read()
blk = app[app.index("const FORMATIONS = {"):]
blk = blk[blk.index("'11': {"):blk.index("\n  },")]
FORMS = {m.group(1): [(r, float(x)) for r, x, _ in re.findall(r"\['(\w+)', ([\d.]+), ([\d.]+)\]", m.group(2))]
         for m in re.finditer(r"^\s*'([0-9-]+)':\s*\[(.*)\],\s*$", blk, re.M)}

# Appens roller → familier, og researchens positionskoder → (familie, plads på tværs 0–1 set fra eget mål).
FAM = {'GK': 'GK', 'LB': 'FB', 'RB': 'FB', 'LWB': 'WB', 'RWB': 'WB', 'CB': 'CB', 'DM': 'DM', 'CM': 'CM', 'CAM': 'AM',
       'LM': 'WM', 'RM': 'WM', 'LW': 'W', 'RW': 'W', 'CF': 'F', 'SS': 'F'}
POS = {'GK': ('GK', .5), 'RB': ('FB', .86), 'LB': ('FB', .14), 'RWB': ('WB', .9), 'LWB': ('WB', .1),
       'RCB': ('CB', .64), 'CB': ('CB', .5), 'LCB': ('CB', .36), 'RDM': ('DM', .62), 'DM': ('DM', .5), 'LDM': ('DM', .38),
       'RCM': ('CM', .68), 'CM': ('CM', .5), 'LCM': ('CM', .32), 'RAM': ('AM', .64), 'CAM': ('AM', .5), 'LAM': ('AM', .36),
       'RM': ('WM', .86), 'LM': ('WM', .14), 'RW': ('W', .84), 'LW': ('W', .16), 'RCF': ('F', .61), 'CF': ('F', .5), 'LCF': ('F', .39)}
NEAR = {frozenset(p): c for p, c in [(('FB', 'WB'), .5), (('WB', 'WM'), .5), (('WM', 'W'), .5), (('DM', 'CM'), .4), (('CM', 'AM'), .4),
        (('AM', 'W'), .7), (('AM', 'F'), .7), (('W', 'F'), .8), (('FB', 'WM'), .9), (('CB', 'DM'), 1.2), (('CB', 'FB'), 1.2)]}
MONTHS = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december']


def fam_cost(a, b):
    return 0 if a == b else NEAR.get(frozenset((a, b)), 4)


def hungarian(cost):
    """Optimal tildeling: række i → kolonne (samme metode som hungarian() i app.html)."""
    n = len(cost); INF = 1e18
    u, v, p, way = [0] * (n + 1), [0] * (n + 1), [0] * (n + 1), [0] * (n + 1)
    for i in range(1, n + 1):
        p[0] = i; j0 = 0; minv = [INF] * (n + 1); used = [False] * (n + 1)
        while True:
            used[j0] = True; i0 = p[j0]; delta = INF; j1 = 0
            for j in range(1, n + 1):
                if used[j]: continue
                cur = cost[i0 - 1][j - 1] - u[i0] - v[j]
                if cur < minv[j]: minv[j] = cur; way[j] = j0
                if minv[j] < delta: delta = minv[j]; j1 = j
            for j in range(n + 1):
                if used[j]: u[p[j]] += delta; v[j] -= delta
                else: minv[j] -= delta
            j0 = j1
            if p[j0] == 0: break
        while True:
            j1 = way[j0]; p[j0] = p[j1]; j0 = j1
            if j0 == 0: break
    out = [0] * n
    for j in range(1, n + 1): out[p[j] - 1] = j - 1
    return out


def place(players, form):
    slots = FORMS[form]
    field = [pl for pl in players if pl['pos'] != 'GK']
    cost = [[fam_cost(POS[pl['pos']][0], FAM[r]) * 2 + abs(POS[pl['pos']][1] - x) for r, x in slots] for pl in field]
    m = hungarian(cost)
    order = [None] * len(slots)
    for i, j in enumerate(m): order[j] = field[i]
    return sum(cost[i][m[i]] for i in range(len(field))), order


def basis_dk(s):
    m = re.search(r'(\d{4})-(\d{2})-(\d{2}).*?vs\.? (.+?) \(([HA])\)', s)
    if not m: return None
    d = datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    out = f"kampen mod {html.unescape(m.group(4))} {d.day}. {MONTHS[d.month - 1]} {d.year} ({'hjemme' if m.group(5) == 'H' else 'ude'})"
    return out + (' – holdets mest brugte startere' if 'most frequent' in s.lower() else '')


def slug(s):
    s = s.lower().replace('&', 'and').replace('ø', 'oe').replace('å', 'aa').replace('æ', 'ae')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def team(c, prefix):
    """Én klub → (hold til appen, problemer)."""
    pr, pl, t = [], c['players'], c['tactics']
    if len(pl) != 11: pr.append(f'{len(pl)} spillere')
    if sum(1 for x in pl if x['pos'] == 'GK') != 1: pr.append('ikke præcis én målmand')
    if len({x['num'] for x in pl}) != len(pl): pr.append('dubletnumre')
    if [x['pos'] for x in pl if x['pos'] not in POS]: pr.append('ukendte positioner')
    if any(not x['name'] or len(x['name']) > 18 for x in pl): pr.append('navn tomt eller over 18 tegn')
    for k in ('press', 'line', 'tempo', 'width', 'passing'):
        if not (isinstance(t.get(k), int) and 1 <= t[k] <= 5): pr.append(f'{k}={t.get(k)}')
    if t.get('style') not in ('def', 'normal', 'off'): pr.append(f"style={t.get('style')}")
    if t.get('setAtt') not in ('mix', 'near', 'far', 'short'): pr.append(f"setAtt={t.get('setAtt')}")
    if t.get('setDef') not in ('zone', 'man', 'mixed'): pr.append(f"setDef={t.get('setDef')}")
    if not all(re.fullmatch(r'#[0-9A-Fa-f]{6}', c['kit'].get(k, '')) for k in ('home', 'away')): pr.append('kit')
    basis = basis_dk(c.get('lineupBasis', ''))
    if not basis: pr.append('lineupBasis kan ikke læses')
    if pr: return None, pr
    form = min(FORMS, key=lambda k: place(pl, k)[0])
    total, order = place(pl, form)
    gk = next(x for x in pl if x['pos'] == 'GK')
    name = html.unescape(c['club'])
    info = f"{name:<24} kilde {c['formation']:<9} → {form:<9} pris {total:.2f}"
    return ({'id': prefix + slug(name), 'name': name, 'coach': c['manager'], 'formation': form, 'style': t['style'],
             'kit': c['kit']['home'].lower(), 'kit2': c['kit']['away'].lower(),
             'press': t['press'], 'line': t['line'], 'tempo': t['tempo'], 'width': t['width'], 'passing': t['passing'],
             'setAtt': t['setAtt'], 'setDef': t['setDef'],
             'xi': [[gk['num'], gk['name']]] + [[x['num'], x['name']] for x in order],
             'basis': basis, 'desc': c['desc']}, info), []


countries, rejected = {}, 0
for f in sorted(glob.glob(os.path.join(ROOT, 'tools', 'kendte_hold', '*.json'))):
    doc = json.load(open(f, encoding='utf-8'))
    co = countries.setdefault(doc['country']['id'], {**doc['country'], 'leagues': []})
    lg = {k: v for k, v in doc['league'].items() if k != 'prefix'}
    lg['teams'] = []
    for c in doc['clubs']:
        res, pr = team(c, doc['league']['prefix'])
        if pr: print('AFVIST', c['club'], pr); rejected += 1; continue
        t, info = res
        print(info); lg['teams'].append(t)
    lg['teams'].sort(key=lambda t: t['name'])
    co['leagues'].append(lg)

lines = ['const KNOWN = [']
for co in countries.values():
    lines.append(f"  {{ id: {json.dumps(co['id'])}, name: {json.dumps(co['name'], ensure_ascii=False)}, leagues: [")
    for lg in co['leagues']:
        lines.append(f"    {{ id: {json.dumps(lg['id'])}, name: {json.dumps(lg['name'], ensure_ascii=False)}, season: {json.dumps(lg['season'])}, teams: [")
        lines += ['      ' + json.dumps(t, ensure_ascii=False) + ',' for t in lg['teams']]
        lines.append('    ] },')
    lines.append('  ] },')
lines.append('];')
i = app.index('const KNOWN = [')
j = app.index('\n];\n', i) + 3 if app[i:i + 17] != 'const KNOWN = [];' else i + len('const KNOWN = [];')
open(APP, 'w', encoding='utf-8').write(app[:i] + '\n'.join(lines) + app[j:])
n = sum(len(lg['teams']) for co in countries.values() for lg in co['leagues'])
print(f'{n} hold skrevet i app.html, {rejected} afvist')
sys.exit(1 if rejected else 0)
