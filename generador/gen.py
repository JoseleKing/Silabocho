"""Genera los tableros de Silabocho (7 sílabas + 1 central) y los guarda en data/tableros.json.

Uso:  python3 gen.py [--tableros 10] [--candidatos 30] [--semilla 2026]

Se generan «candidatos» tableros compatibles entre sí (poco solapamiento, estrella distinta);
se quedan los «tableros» mejores. Los 3 mejores van primero (días 1, 2 y 3) y el resto se
baraja con la semilla fija, para que no salgan los mejores al principio y los flojos al final.
"""
import argparse, collections, json, os, random, sys, time
from lexico import LEX, construir

DIR = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(DIR, '..', 'data', 'tableros.json')

ap = argparse.ArgumentParser()
ap.add_argument('--tableros', type=int, default=10, help='tableros que se guardan')
ap.add_argument('--candidatos', type=int, default=None, help='tableros que se generan antes de elegir (por defecto, 3 × tableros)')
ap.add_argument('--semilla', type=int, default=2026)
ap.add_argument('--primeros', type=int, default=3, help='cuántos de los mejores van al principio sin barajar')
ap.add_argument('--salida', default=SALIDA)
args = ap.parse_args()
CANDIDATOS = args.candidatos or 3 * args.tableros

random.seed(args.semilla)
construir()   # solo para imprimir el resumen del léxico

MIN_PALABRAS, MAX_PALABRAS = 15, 80
MAX_JACCARD = 0.45

# ---------- búsqueda ----------
cnt = collections.Counter(s for sil in LEX.values() for s in set(sil))
SYLS = [s for s, _ in cnt.most_common(220)]
IDX = {s: i for i, s in enumerate(SYLS)}
WORDS = []
for w, sil in LEX.items():
    if all(s in IDX for s in sil):
        m = 0
        for s in sil:
            m |= 1 << IDX[s]
        WORDS.append((w, m))
POR = collections.defaultdict(list)
for w, m in WORDS:
    for i in range(len(SYLS)):
        if m >> i & 1:
            POR[i].append((w, m))

def sol_central(S, c):
    return [w for w, m in POR[c] if m & ~S == 0]

def orden_estrella(w):
    """La estrella es la primera: más sílabas, luego más sílabas distintas, luego alfabético."""
    return (-len(LEX[w]), -len(set(LEX[w])), w)

def evaluar(S, usos, estrellas):
    best = None
    for c in range(S.bit_length()):
        if S >> c & 1:
            sol = sol_central(S, c)
            if not any(len(LEX[w]) >= 4 for w in sol):
                continue
            if min(sol, key=orden_estrella) in estrellas:   # la estrella no puede repetirse
                continue
            n = len(sol)
            # objetivo: muchas palabras, pero penalizando sílabas ya usadas en otros tableros
            pen = sum(usos[i] for i in range(S.bit_length()) if S >> i & 1)
            sc = min(n, 45) - 0.5 * pen
            if best is None or sc > best[0]:
                best = (sc, c, sol)
    return best

def buscar(usos, estrellas, pasos=80, cand=60):
    K = len(SYLS)
    S = 0
    for i in random.sample(range(120), 8):
        S |= 1 << i
    best = evaluar(S, usos, estrellas) or (-99, None, [])
    for _ in range(pasos):
        dentro = [i for i in range(K) if S >> i & 1]
        fuera = random.sample([i for i in range(K) if not S >> i & 1], cand)
        mejor = None
        for x in random.sample(dentro, len(dentro)):
            for y in fuera:
                T = (S & ~(1 << x)) | (1 << y)
                e = evaluar(T, usos, estrellas)
                if e and e[0] > best[0]:
                    mejor = (T, e); break
            if mejor: break
        if not mejor: break
        S, best = mejor
    return S, best

def jaccard(a, b):
    return bin(a & b).count('1') / bin(a | b).count('1')

def puntos(sil):
    n = len(sil)
    return 1 if n <= 2 else 2 if n == 3 else 4 if n == 4 else 6

def calidad(t):
    """Para elegir los mejores: palabras (hasta 45), luego largas (4+ sílabas), luego estrella larga."""
    pal = t['palabras']
    largas = sum(1 for s in pal.values() if len(s) >= 4)
    return (min(len(pal), 45) + 2 * largas, len(pal[t['estrella']]))

# ---------- generación ----------
tableros, usos, estrellas = [], collections.Counter(), set()
intentos, t0 = 0, time.time()
while len(tableros) < CANDIDATOS:
    intentos += 1
    S, (sc, c, sol) = buscar(usos, estrellas)
    if c is None or not (MIN_PALABRAS <= len(sol) <= MAX_PALABRAS):
        continue
    if any(jaccard(S, t['mask']) > MAX_JACCARD for t in tableros):
        continue
    sol.sort(key=orden_estrella)
    estrella = sol[0]
    exterior = [SYLS[i] for i in range(len(SYLS)) if S >> i & 1 and i != c]
    tableros.append(dict(mask=S, central=SYLS[c], exterior=exterior, estrella=estrella,
                         palabras={w: LEX[w] for w in sol}))
    estrellas.add(estrella)
    for i in range(len(SYLS)):
        if S >> i & 1:
            usos[i] += 1
    print(f"{len(tableros):3d} [{len(sol):2d}] {SYLS[c].upper():5s} | {' '.join(x.upper() for x in exterior)} "
          f"| ★ {estrella}  ({intentos} intentos, {time.time() - t0:.0f} s)", file=sys.stderr)

# ---------- selección y orden ----------
tableros.sort(key=calidad, reverse=True)
elegidos = tableros[:args.tableros]
# los primeros: los mejores, pero sin repetir sílaba central entre ellos
primeros = []
for t in elegidos:
    if len(primeros) < args.primeros and all(t['central'] != p['central'] for p in primeros):
        primeros.append(t)
resto = [t for t in elegidos if t not in primeros]
random.Random(args.semilla).shuffle(resto)
elegidos = primeros + resto

out = [{'central': t['central'], 'exterior': t['exterior'], 'estrella': t['estrella'],
        'palabras': [[w, '-'.join(s)] for w, s in t['palabras'].items()]} for t in elegidos]
os.makedirs(os.path.dirname(args.salida), exist_ok=True)
with open(args.salida, 'w', encoding='utf-8') as f:
    f.write('[\n' + ',\n'.join(json.dumps(t, ensure_ascii=False) for t in out) + '\n]\n')

print(f'\n{len(out)} tableros guardados en {os.path.relpath(args.salida)} '
      f'({len(tableros)} candidatos, {intentos} intentos, {time.time() - t0:.0f} s)')
for i, t in enumerate(out, 1):
    pts = sum(puntos(s.split('-')) for _, s in t['palabras']) + 5
    print(f"día {i:2d}: {t['central'].upper():5s} | {' '.join(x.upper() for x in t['exterior'])} "
          f"| {len(t['palabras']):2d} palabras, {pts:3d} puntos | ★ {t['estrella']}")
