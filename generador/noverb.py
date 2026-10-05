"""NOVERB: palabras del diccionario que no son formas verbales.
Se admiten sustantivos, adjetivos, etc. con sus femeninos, y de los verbos solo el infinitivo
(decidido el 2026-10-05). Los participios no valen como tales (cantado, alejada); sí los que el
diccionario trae como palabra propia por ser también sustantivo o adjetivo (comida, salida, helado).

Una palabra que es a la vez forma verbal y otra cosa (casa, llama, paso) vale, salvo que esa
otra lectura solo salga de aplicar un prefijo (a+cabe → acabe, de+bes → debes) o de la regla de
femenino -e → -a, que el diccionario aplica sin distinguir (presidenta, pero también
aparente → aparenta, presente → presenta): entonces se considera verbal.

Las palabras que el diccionario trae sueltas (sin marcas) y que coinciden con una forma verbal
(hinchan, suele) también se consideran verbales, salvo las de admitidas.txt (para, destino…).

FAMILIAS: (formas, es_verbo) de cada entrada del diccionario (ratero → ratero, ratera, rateros,
rateras), para que el léxico admita una familia entera cuando alguna de sus formas es frecuente."""
import os, re
from silabas import load_aff, apply, DIC_PATH, AFF_PATH

rules = load_aff(AFF_PATH)


def participios(stem):
    raiz = stem[:-2]
    if stem.endswith('ar'):
        fin = ('ado', 'ada', 'ados', 'adas')
    else:   # -er, -ir, -ír (oír → oído)
        fin = ('ido', 'ida', 'idos', 'idas', 'ído', 'ída', 'ídos', 'ídas')
    return {raiz + f for f in fin}


NOVERB, VERB, DEBILES = set(), set(), set()
FAMILIAS, SUELTAS, CON_MARCAS = [], set(), set()
for ln in open(DIC_PATH, encoding='utf-8').read().split('\n')[1:]:
    if not ln:
        continue
    stem, _, fl = ln.partition('/')
    fl = fl.split()[0] if fl else ''
    if stem[:1].isupper():
        continue
    (CON_MARCAS if fl else SUELTAS).add(stem)
    forms, debiles = {stem}, set()
    for f in fl:
        for w, cont, kind, cross in apply(stem, f, rules):
            forms.add(w)
            if kind == 'PFX' or (f == 'G' and stem.endswith('e') and re.search('as?$', w)):
                debiles.add(w)
            for c in cont:
                for w2, _, kind2, _ in apply(w, c, rules):
                    forms.add(w2)
                    if w in debiles or kind2 == 'PFX':
                        debiles.add(w2)
    esverbo = re.search(r'(ar|er|ir|ír)$', stem) and any(w.endswith('ndo') for w in forms)
    FAMILIAS.append((forms, bool(esverbo)))
    if not fl and re.search(r'(mos|ban|bas|aba|ía|ías|ían|ron|ste|steis|éis|áis)$', stem):
        VERB.add(stem)   # forma irregular suelta (damos, andaban)
        continue
    if esverbo:
        VERB |= forms
        NOVERB.add(stem)          # solo el infinitivo
    else:
        NOVERB |= forms - debiles
        DEBILES |= debiles

# lo que solo es «no verbal» por un prefijo o por el femenino en -a y además es forma verbal, fuera
NOVERB |= DEBILES - VERB

# palabras sueltas que coinciden con una forma verbal: verbales, salvo las admitidas
_adm = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'admitidas.txt')
ADMITIDAS = {w for ln in open(_adm, encoding='utf-8') for w in ln.split('#', 1)[0].lower().split()}
NOVERB -= {w for w in (SUELTAS - CON_MARCAS) & VERB
           if w not in ADMITIDAS and not re.search(r'(ar|er|ir|ír)$', w)}

# formas de verbos defectivos o irregulares que el diccionario trae sueltas (abolieras, garantirás,
# erguís): raíz de un infinitivo + terminación de la conjugación regular. Para no confundir palabras
# como «entre» o «sobre», solo cuentan las terminaciones de 3 letras o más, o con tilde.
def _terminaciones():
    lineas = {ln.partition('/')[0]: ln for ln in open(DIC_PATH, encoding='utf-8').read().split('\n')[1:] if ln}
    out = set()
    for v in ('amar', 'temer', 'partir'):
        stem, _, fl = lineas[v].partition('/')
        for f in fl.split()[0]:
            for w, _, kind, _ in apply(stem, f, rules):
                if kind == 'SFX' and w.startswith(stem[:-2]):
                    out.add(w[len(stem) - 2:])
    return {e for e in out if (len(e) >= 3 or re.search('[áéíóú]', e)) and e != 'ible'}
_TERM = _terminaciones()
_RAICES = {w[:-2] for w in CON_MARCAS | SUELTAS if re.search(r'(ar|er|ir)$', w) and len(w) > 3}
def _conjugada_suelta(w):
    return any(w[:i] in _RAICES and w[i:] in _TERM for i in range(2, len(w) - 1))
NOVERB -= {w for w in SUELTAS - CON_MARCAS if w not in ADMITIDAS and _conjugada_suelta(w)}
