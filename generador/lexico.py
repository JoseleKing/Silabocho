"""Léxico jugable de Silabocho.

Reglas (no cambiarlas sin consultar):
- Palabras del diccionario Hunspell es (wooorm/dictionaries) expandido, cruzadas con las
  TOP más frecuentes de FrequencyWords (2018/es). Sin nombres propios.
- De 2 a 7 sílabas según silabas.silabear.
- Sin formas verbales conjugadas (se admiten infinitivos y participios): ver noverb.py
  y formas_verbales.txt, que recoge las formas irregulares que el diccionario trae sueltas.
- Sin pronombres pegados al verbo (tenerlo, dámelo, dile, casarse).
- Sin palabras vetadas (vetadas.txt) ni excluidas a mano (excluidas.txt).
"""
import os, re, collections, unicodedata
from silabas import expand, silabear, DIC_PATH, AFF_PATH, FREQ_PATH
from noverb import NOVERB

DIR = os.path.dirname(os.path.abspath(__file__))
TOP = 30000


def leer_lista(nombre):
    """Una palabra por línea; ignora líneas vacías y comentarios (#)."""
    out = []
    for ln in open(os.path.join(DIR, nombre), encoding='utf-8'):
        out += ln.split('#', 1)[0].lower().split()
    return out


DIC = expand(DIC_PATH, AFF_PATH)
FREQ = [l.split()[0] for l in open(FREQ_PATH, encoding='utf-8')]

# ---------- veto de pronombres pegados al verbo ----------
CLITICOS = ['les', 'las', 'los', 'nos', 'me', 'te', 'se', 'le', 'la', 'lo']

def quitar_tildes_salvo_ene(s):
    out = []
    for c in s:
        if c in 'ñü':
            out.append(c)
        else:
            out.append(''.join(x for x in unicodedata.normalize('NFD', c) if unicodedata.category(x) != 'Mn'))
    return ''.join(out)

def es_enclitico(w):
    """infinitivo/gerundio + pronombre (tenerlo, dándole) o imperativo con tilde + pronombre (tómalo)."""
    base = w
    quitados = 0
    while True:
        for c in CLITICOS:
            if base.endswith(c) and len(base) > len(c) + 1:
                base = base[:-len(c)]
                quitados += 1
                break
        else:
            break
        b = quitar_tildes_salvo_ene(base)
        if b in ('di', 'haz', 'pon', 'ten', 'sal', 'ven', 'da', 'dad', 'id', 'de', 'den', 'dé', 'ser'):
            return True
        if re.search(r'(ar|er|ir|ndo)$', b) and b in DIC:
            return True
        if base != b and b in DIC:     # llevaba tilde que solo se explica por el pronombre
            return True
        if quitados >= 3:
            break
    return False

# ---------- listas ----------
_vet = leer_lista('vetadas.txt')
VETO_EXACTO = {w for w in _vet if not w.endswith('*')}
VETO_PREFIJO = tuple(w[:-1] for w in _vet if w.endswith('*'))
FORMAS_VERBALES = set(leer_lista('formas_verbales.txt'))
EXCLUIDAS = set(leer_lista('excluidas.txt'))

def vetada(w):
    return w in VETO_EXACTO or w.startswith(VETO_PREFIJO)

# ---------- léxico ----------
def construir(top=TOP, verbose=True):
    ok = re.compile('^[a-zñáéíóúü]+$')
    lex, motivo = {}, collections.Counter()
    for w in FREQ[:top]:
        if not ok.match(w) or w not in DIC:
            continue
        s = silabear(w)
        if not s or not (2 <= len(s) <= 7):
            continue
        if vetada(w):
            motivo['vetada'] += 1
        elif w in EXCLUIDAS:
            motivo['excluida'] += 1
        elif es_enclitico(w):
            motivo['enclítico'] += 1
        elif w not in NOVERB or w in FORMAS_VERBALES:
            motivo['conjugada'] += 1
        else:
            lex[w] = s
    if verbose:
        print('léxico:', len(lex), dict(motivo))
    return lex

LEX = construir(verbose=False)
