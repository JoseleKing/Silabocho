"""Léxico jugable de Silabocho.

Reglas (no cambiarlas sin consultar):
- Palabras del diccionario Hunspell es (wooorm/dictionaries) expandido. Sin nombres propios.
- Dos niveles:
  · LEX (núcleo): las que cuentan para el total del tablero. Sustantivos, adjetivos y demás:
    la familia entera (ratero, ratera, rateros, rateras) si alguna forma está entre las TOP más
    frecuentes de FrequencyWords (2018/es, es_50k.txt). Infinitivos y participios: solo si esa
    forma concreta está entre las TOP (así no entran costadas, datadas… por ser frecuente el verbo).
  · EXTRA: el resto de palabras válidas del diccionario. Se aceptan como «palabras extra»:
    suman puntos, pero no cuentan en el total.
- De 2 a 7 sílabas según silabas.silabear.
- Sin formas verbales conjugadas (se admiten infinitivos y participios): ver noverb.py
  y formas_verbales.txt, que recoge las formas irregulares que el diccionario trae sueltas.
- Sin pronombres pegados al verbo (tenerlo, dámelo, dile, casarse).
- Sin palabras vetadas (vetadas.txt) ni excluidas a mano (excluidas.txt).
"""
import os, re, collections, unicodedata
from silabas import expand, silabear, DIC_PATH, AFF_PATH, FREQ_PATH
from noverb import NOVERB, FAMILIAS

DIR = os.path.dirname(os.path.abspath(__file__))
TOP = 50000


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
_ok = re.compile('^[a-zñáéíóúü]+$')

def valida(w, motivo=None):
    """Sílabas de w si es jugable según las reglas; None si no (y anota el motivo)."""
    if not _ok.match(w) or w not in DIC:
        return None
    s = silabear(w)
    if not s or not (2 <= len(s) <= 7):
        return None
    m = ('vetada' if vetada(w) else 'excluida' if w in EXCLUIDAS else 'enclítico' if es_enclitico(w)
         else 'conjugada' if w not in NOVERB or w in FORMAS_VERBALES else None)
    if m:
        if motivo is not None:
            motivo[m] += 1
        return None
    return s

def construir(top=TOP, verbose=True):
    """Devuelve (núcleo, extra): dos dicts palabra → sílabas."""
    frecuentes = set(FREQ[:top])
    cache, motivo = {}, collections.Counter()
    def v(w):
        if w not in cache:
            cache[w] = valida(w, motivo)
        return cache[w]
    nucleo, extra = {}, {}
    for forms, es_verbo in FAMILIAS:
        familia_frecuente = not frecuentes.isdisjoint(forms)
        for w in forms:
            s = v(w)
            if s:
                frecuente = w in frecuentes if es_verbo else familia_frecuente
                (nucleo if frecuente else extra)[w] = s
    for w in nucleo:
        extra.pop(w, None)
    if verbose:
        print(f'léxico: {len(nucleo)} en el núcleo, {len(extra)} extra; descartadas: {dict(motivo)}')
    return nucleo, extra

LEX, EXTRA = construir(verbose=False)
