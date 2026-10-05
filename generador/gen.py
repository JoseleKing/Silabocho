"""Genera los tableros de Silabocho (7 sílabas + 1 central) y los guarda en data/tableros.json.

Uso:  python3 gen.py [--tableros 10] [--candidatos 30] [--semilla 2026] [--reusar]
      python3 gen.py --ampliar ANTES DESPUÉS   (añade tableros sin tocar los que ya hay)

Se generan «candidatos» tableros compatibles entre sí (poco solapamiento, estrellas distintas);
se quedan los «tableros» mejores. Los 3 primeros días son los elegidos en primeros.txt (o, si no,
los mejores según calidad) y el resto se baraja con la semilla fija, para que no salgan los mejores al principio y los flojos al final.

Con --ampliar, los tableros de data/tableros.json se conservan tal cual y en su orden; se generan
ANTES + DESPUÉS tableros nuevos compatibles con ellos (poco solapamiento, ningún Silabocho repetido),
se barajan y se colocan ANTES delante y DESPUÉS detrás. Ojo: los de delante desplazan la numeración
de los días, así que hay que mover START en js/juego.js (y migrar el progreso guardado).

Los candidatos se guardan en candidatos.json; con --reusar se vuelve a hacer solo la selección
(útil para ajustar la calidad sin esperar a la búsqueda), siempre que el léxico no haya cambiado.
"""
import argparse, collections, hashlib, json, os, random, re, sys, time
from lexico import LEX, EXTRA

DIR = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(DIR, '..', 'data', 'tableros.json')
CACHE = os.path.join(DIR, 'candidatos.json')

ap = argparse.ArgumentParser()
ap.add_argument('--tableros', type=int, default=10, help='tableros que se guardan')
ap.add_argument('--candidatos', type=int, default=None, help='tableros que se generan antes de elegir (por defecto, 3 × tableros)')
ap.add_argument('--semilla', type=int, default=2026)
ap.add_argument('--primeros', type=int, default=3, help='cuántos de los mejores van al principio sin barajar')
ap.add_argument('--salida', default=SALIDA)
ap.add_argument('--reusar', action='store_true', help='reutiliza los candidatos guardados en candidatos.json')
ap.add_argument('--ampliar', type=int, nargs=2, metavar=('ANTES', 'DESPUES'), help='añade tableros nuevos delante y detrás de los que ya hay')
args = ap.parse_args()
if args.ampliar:
    args.tableros = sum(args.ampliar)
    if args.reusar:
        sys.exit('--ampliar no admite --reusar.')
CANDIDATOS = args.candidatos or 3 * args.tableros

random.seed(args.semilla)
print(f'léxico: {len(LEX)} palabras en el núcleo, {len(EXTRA)} extra', file=sys.stderr)

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
    """Orden de las soluciones: más sílabas, luego más sílabas distintas, luego alfabético."""
    return (-len(LEX[w]), -len(set(LEX[w])), w)

def estrellas_de(sol):
    """Palabras estrella («Silabochos»): todas las que empatan con el máximo de sílabas."""
    m = max(len(LEX[w]) for w in sol)
    return sorted((w for w in sol if len(LEX[w]) == m), key=orden_estrella)

def evaluar(S, usos, estrellas):
    best = None
    for c in range(S.bit_length()):
        if S >> c & 1:
            sol = sol_central(S, c)
            if not any(len(LEX[w]) >= 4 for w in sol):
                continue
            if not estrellas.isdisjoint(estrellas_de(sol)):   # ninguna estrella puede repetirse
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

def familia(w):
    """Raíz aproximada para no contar dos veces el mismo vocablo (preparada, preparados → prepar)."""
    return re.sub(r'(as|os|es|a|o|s)$', '', w)

def calidad(t):
    """Lo interesante que es un tablero, para elegir los mejores y ponerlos en los primeros días.
    Premia la variedad: familias de palabras distintas (hasta 30), familias largas (4+ sílabas),
    variedad de longitudes y una palabra de 5 sílabas o más. Penaliza los tableros llenos de
    participios (cenado, minado, donado…) y los que tienen más de 3 Silabochos."""
    pal = t['palabras']
    familias = {familia(w) for w in pal}
    largas = {familia(w) for w, s in pal.items() if len(s) >= 4}
    participios = {familia(w) for w in pal if re.search(r'(ad|id)[oa]s?$', w)}
    longitudes = {len(s) for s in pal.values()}
    return (min(len(familias), 30) + 2 * len(largas) + 2 * len(longitudes) + 6 * (max(longitudes) >= 5)
            - max(0, len(participios) - 3) - 2 * max(0, len(t['estrellas']) - 3))

# ---------- generación ----------
# huella de lo que determina los candidatos: si cambia, los guardados ya no valen
HUELLA = hashlib.sha1(json.dumps([sorted(LEX.items()), args.semilla, CANDIDATOS, MIN_PALABRAS, MAX_PALABRAS, MAX_JACCARD],
                                 ensure_ascii=False).encode()).hexdigest()
tableros, usos, estrellas = [], collections.Counter(), set()
intentos, t0 = 0, time.time()
EXISTENTES, MASCARAS_FIJAS = [], []
if args.ampliar:
    # los tableros que ya hay cuentan como ocupados: sus sílabas, su solapamiento y sus Silabochos
    EXISTENTES = json.load(open(args.salida, encoding='utf-8'))
    for t in EXISTENTES:
        S = 0
        for x in [t['central']] + t['exterior']:
            if x in IDX:      # una sílaba que ya no está entre las más frecuentes no cuenta para el solapamiento
                S |= 1 << IDX[x]
        MASCARAS_FIJAS.append(S)
        estrellas.update(estrellas_de(sol_central(S, IDX[t['central']])))
        estrellas.update(t['estrellas'])
        for i in range(len(SYLS)):
            if S >> i & 1:
                usos[i] += 1
    print(f'ampliando: {len(EXISTENTES)} tableros existentes se conservan', file=sys.stderr)
if args.reusar:
    try:
        guardado = json.load(open(CACHE, encoding='utf-8'))
    except FileNotFoundError:
        sys.exit('No hay candidatos guardados: ejecuta gen.py sin --reusar.')
    if guardado['huella'] != HUELLA:
        sys.exit('Los candidatos guardados no corresponden al léxico u opciones actuales: ejecuta gen.py sin --reusar.')
    tableros = guardado['tableros']
    print(f'{len(tableros)} candidatos reutilizados de {os.path.relpath(CACHE)}', file=sys.stderr)
while len(tableros) < CANDIDATOS:
    intentos += 1
    S, (sc, c, sol) = buscar(usos, estrellas)
    if c is None or not (MIN_PALABRAS <= len(sol) <= MAX_PALABRAS):
        continue
    if any(jaccard(S, m) > MAX_JACCARD for m in [t['mask'] for t in tableros] + MASCARAS_FIJAS):
        continue
    sol.sort(key=orden_estrella)
    est = estrellas_de(sol)
    exterior = [SYLS[i] for i in range(len(SYLS)) if S >> i & 1 and i != c]
    tableros.append(dict(mask=S, central=SYLS[c], exterior=exterior, estrellas=est,
                         palabras={w: LEX[w] for w in sol}))
    estrellas.update(est)
    for i in range(len(SYLS)):
        if S >> i & 1:
            usos[i] += 1
    print(f"{len(tableros):3d} [{len(sol):2d}] {SYLS[c].upper():5s} | {' '.join(x.upper() for x in exterior)} "
          f"| ★ {', '.join(est)}  ({intentos} intentos, {time.time() - t0:.0f} s)", file=sys.stderr)

if not args.reusar and not args.ampliar:
    with open(CACHE, 'w', encoding='utf-8') as f:
        json.dump({'huella': HUELLA, 'tableros': tableros}, f, ensure_ascii=False)

# ---------- selección y orden ----------
tableros.sort(key=calidad, reverse=True)
TODAS = {**LEX, **EXTRA}
def soluciones(t):
    sil = set(t['exterior']) | {t['central']}
    return sorted((w for w, s in TODAS.items() if t['central'] in s and set(s) <= sil), key=lambda w: (-len(TODAS[w]), -len(set(TODAS[w])), w))
def estrellas_finales(sol):
    m = len(TODAS[sol[0]])
    return [w for w in sol if len(TODAS[w]) == m]
if args.ampliar:
    # los mejores que no repitan Silabocho (contando ya las palabras raras), barajados con la semilla
    usadas, nuevos = {w for t in EXISTENTES for w in t['estrellas']}, []
    for t in tableros:
        est = set(estrellas_finales(soluciones(t)))
        if len(nuevos) < args.tableros and usadas.isdisjoint(est):
            nuevos.append(t); usadas |= est
    if len(nuevos) < args.tableros:
        sys.exit(f'Solo hay {len(nuevos)} candidatos válidos de {args.tableros}: sube --candidatos.')
    random.Random(args.semilla).shuffle(nuevos)
    antes = args.ampliar[0]
    tableros = elegidos_nuevos = nuevos

# los primeros días: los indicados en primeros.txt (por una de sus estrellas) y, si faltan,
# los mejores según calidad, sin repetir sílaba central entre ellos
fijos = []
if not args.ampliar and os.path.exists(os.path.join(DIR, 'primeros.txt')):
    from lexico import leer_lista
    fijos = leer_lista('primeros.txt')[:args.primeros]
primeros = []
for w in fijos:
    t = next((t for t in tableros if w in t['estrellas'] and t not in primeros), None)
    if t:
        primeros.append(t)
    else:
        print(f'aviso: «{w}» (primeros.txt) no es estrella de ningún candidato; ese día se elige solo', file=sys.stderr)
for t in tableros:
    if len(primeros) < args.primeros and t not in primeros and all(t['central'] != p['central'] for p in primeros):
        primeros.append(t)
elegidos = primeros + [t for t in tableros if t not in primeros][:args.tableros - len(primeros)]
resto = elegidos[len(primeros):]
random.Random(args.semilla).shuffle(resto)
elegidos = primeros + resto
if args.ampliar:
    elegidos = elegidos_nuevos

# El núcleo sirve para buscar y elegir los tableros; ya elegidos, se les añaden las demás palabras
# válidas del diccionario (EXTRA), que cuentan igual que las otras, y se recalculan los Silabochos.
out = []
for t in elegidos:
    sol = soluciones(t)
    out.append({'central': t['central'], 'exterior': t['exterior'], 'estrellas': estrellas_finales(sol),
                'palabras': [[w, '-'.join(TODAS[w])] for w in sol]})
if args.ampliar:
    out = out[:antes] + EXISTENTES + out[antes:]
rep_est = collections.Counter(w for t in out for w in t['estrellas'])
for w, n in rep_est.items():
    if n > 1:
        print(f'aviso: el Silabocho «{w}» sale en {n} tableros', file=sys.stderr)
os.makedirs(os.path.dirname(args.salida), exist_ok=True)
with open(args.salida, 'w', encoding='utf-8') as f:
    f.write('[\n' + ',\n'.join(json.dumps(t, ensure_ascii=False) for t in out) + '\n]\n')

print(f'\n{len(out)} tableros guardados en {os.path.relpath(args.salida)} '
      f'({len(tableros)} candidatos, {intentos} intentos, {time.time() - t0:.0f} s)')
for i, t in enumerate(out, 1):
    pts = sum(puntos(s.split('-')) for _, s in t['palabras']) + 5 * len(t['estrellas'])
    print(f"día {i:2d}: {t['central'].upper():5s} | {' '.join(x.upper() for x in t['exterior'])} "
          f"| {len(t['palabras']):2d} palabras, {pts:3d} puntos | ★ {', '.join(t['estrellas'])}")
