"""Comprueba que data/tableros.json coincide con el léxico actual (útil tras tocar las listas).
Para cada tablero recalcula las soluciones (núcleo y extra juntos) y avisa de palabras que sobran o faltan."""
import json, os
from lexico import LEX, EXTRA, DIR, cabe

TODAS = {**LEX, **EXTRA}
tab = json.load(open(os.path.join(DIR, '..', 'data', 'tableros.json'), encoding='utf-8'))
ok = True
for i, t in enumerate(tab, 1):
    sol = {w for w, s in TODAS.items() if cabe(s, t['central'], t['exterior'] + [t['central']])}
    hay = {w for w, _ in t['palabras']}
    if sol != hay:
        ok = False
        print(f"nº {i}: faltan {sorted(sol - hay)} · sobran {sorted(hay - sol)}")
print('Los tableros coinciden con el léxico.' if ok else 'Hay diferencias: conviene regenerar (python3 gen.py).')
