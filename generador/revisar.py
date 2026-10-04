"""Escribe en revision/ listas para revisar el léxico a mano.

- homografos.txt: palabras admitidas que también son forma verbal conjugada (casa, llama…),
  con la entrada del diccionario que las hace válidas. Las rarezas se pueden pasar a excluidas.txt.
- tableros.txt: todas las palabras de data/tableros.json, tablero a tablero, marcando las homógrafas.
"""
import json, os, re
from lexico import LEX, DIR
from noverb import VERB, rules
from silabas import apply, DIC_PATH

OUT = os.path.join(DIR, 'revision')
os.makedirs(OUT, exist_ok=True)

def participio(w):
    return re.search(r'(ad|id|íd)[oa]s?$', w)

homo = {w for w in LEX if w in VERB and not participio(w) and not re.search(r'(ar|er|ir|ír)$', w)}

# de dónde sale la lectura no verbal (entradas del diccionario que no son verbos)
fuente = {}
for ln in open(DIC_PATH, encoding='utf-8').read().split('\n')[1:]:
    if not ln or ln[:1].isupper():
        continue
    stem, _, fl = ln.partition('/')
    fl = fl.split()[0] if fl else ''
    if re.search(r'(ar|er|ir|ír)$', stem) and fl:
        continue
    forms = {stem} | {w for f in fl for w, *_ in apply(stem, f, rules)}
    for w in forms & homo:
        fuente.setdefault(w, []).append(ln.strip())

with open(os.path.join(OUT, 'homografos.txt'), 'w', encoding='utf-8') as f:
    f.write('# Palabras admitidas que también son forma verbal conjugada.\n'
            '# palabra <- entrada del diccionario que la admite\n')
    orden = {w: i for i, w in enumerate(LEX)}   # por frecuencia
    for w in sorted(homo, key=orden.get):
        f.write(f"{w} <- {', '.join(fuente.get(w, ['?']))}\n")

tab = json.load(open(os.path.join(DIR, '..', 'data', 'tableros.json'), encoding='utf-8'))
with open(os.path.join(OUT, 'tableros.txt'), 'w', encoding='utf-8') as f:
    f.write('# Palabras de cada tablero. (v) = también es forma verbal conjugada.\n')
    for i, t in enumerate(tab, 1):
        f.write(f"\nnº {i}: {t['central'].upper()} | {' '.join(t['exterior']).upper()} | ★ {', '.join(t['estrellas'])}\n")
        f.write('  ' + ', '.join(w + (' (v)' if w in homo else '') for w, _ in t['palabras']) + '\n')
        if t.get('extra'):
            f.write('  extra: ' + ', '.join(w for w, _ in t['extra']) + '\n')
print(f'{len(homo)} homógrafos; revisión escrita en {os.path.relpath(OUT)}/')
