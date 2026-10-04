import os, re

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fuentes') + '/'
DIC_PATH, AFF_PATH = BASE + 'index.dic', BASE + 'index.aff'
FREQ_PATH = BASE + 'es_50k.txt'

# ---------- 1. Expandir el diccionario Hunspell (RLA-ES) ----------
def load_aff(path):
    rules = {}  # flag -> (kind, cross, [(strip, add, contflags, cond)])
    lines = open(path, encoding='utf-8').read().split('\n')
    for ln in lines:
        p = ln.split()
        if len(p) >= 4 and p[0] in ('SFX', 'PFX') and len(p) == 4 and p[2] in ('Y', 'N'):
            rules[p[1]] = (p[0], p[2] == 'Y', [])
        elif len(p) >= 4 and p[0] in ('SFX', 'PFX') and p[1] in rules:
            strip = '' if p[2] == '0' else p[2]
            add = p[3]
            cont = ''
            if '/' in add:
                add, cont = add.split('/', 1)
            if add == '0':
                add = ''
            cond = p[4] if len(p) > 4 else '.'
            kind = rules[p[1]][0]
            rx = re.compile((cond + '$') if kind == 'SFX' else ('^' + cond))
            rules[p[1]][2].append((strip, add, cont, rx))
    return rules

def apply(word, flag, rules):
    out = []
    if flag not in rules:
        return out
    kind, cross, entries = rules[flag]
    for strip, add, cont, rx in entries:
        if not rx.search(word):
            continue
        if kind == 'SFX':
            if strip and not word.endswith(strip):
                continue
            w = (word[:-len(strip)] if strip else word) + add
        else:
            if strip and not word.startswith(strip):
                continue
            w = add + (word[len(strip):] if strip else word)
        out.append((w, cont, kind, cross))
    return out

def expand(dic, aff):
    rules = load_aff(aff)
    words = set()
    for ln in open(dic, encoding='utf-8').read().split('\n')[1:]:
        if not ln:
            continue
        stem, _, flags = ln.partition('/')
        flags = flags.split()[0] if flags else ''
        if stem[:1].isupper():      # nombres propios fuera
            continue
        words.add(stem)
        sfx_forms = []
        for f in flags:
            for w, cont, kind, cross in apply(stem, f, rules):
                words.add(w)
                for c in cont:  # una capa de continuación
                    for w2, _, _, _ in apply(w, c, rules):
                        words.add(w2)
                if kind == 'SFX' and cross:
                    sfx_forms.append(w)
        for f in flags:
            if f in rules and rules[f][0] == 'PFX' and rules[f][1]:
                for w in sfx_forms:
                    for w2, _, _, _ in apply(w, f, rules):
                        words.add(w2)
    return words

# ---------- 2. Silabeador ortográfico estándar ----------
FUERTES = set('aeoáéóíú')   # í, ú acentuadas fuerzan hiato
DEBILES = set('iuü')
VOC = FUERTES | DEBILES
INSEP = {'pl','pr','bl','br','fl','fr','cl','cr','gl','gr','tr','dr','kl','kr'}
DIGR = {'ch','ll','rr'}

def tokens(w):
    """Agrupa dígrafos y qu/gu(e,i) como una sola consonante; y final como vocal débil."""
    t, i = [], 0
    while i < len(w):
        two = w[i:i+2]
        if two in DIGR:
            t.append(two); i += 2; continue
        if two in ('qu', 'gu') and i + 2 < len(w) and w[i+2] in 'eiéí':
            t.append(two); i += 2; continue
        c = w[i]
        if c == 'y' and (i == len(w) - 1) and i > 0 and w[i-1] in VOC:
            t.append('i_y')   # vocal débil (rey, hoy)
        else:
            t.append(c)
        i += 1
    return t

def isv(tok):
    return tok in VOC or tok == 'i_y'

def weak(tok):
    return tok in DEBILES or tok == 'i_y'

def silabear(w):
    t = tokens(w)
    if not any(isv(x) for x in t):
        return None
    # núcleos: secuencias de vocales partidas por hiatos
    cortes = set()  # índice de token donde empieza nueva sílaba
    i = 0
    n = len(t)
    # hiatos dentro de grupos vocálicos
    for k in range(n - 1):
        a, b = t[k], t[k+1]
        if isv(a) and isv(b):
            if not weak(a) and not weak(b):
                cortes.add(k + 1)
    # consonantes entre núcleos
    vpos = [k for k in range(n) if isv(t[k])]
    for a, b in zip(vpos, vpos[1:]):
        if b == a + 1:
            continue
        cons = t[a+1:b]
        m = len(cons)
        if m == 1:
            cortes.add(a + 1)
        elif m == 2:
            if (cons[0] + cons[1]) in INSEP:
                cortes.add(a + 1)
            else:
                cortes.add(a + 2)
        elif m == 3:
            if (cons[1] + cons[2]) in INSEP:
                cortes.add(a + 2)
            else:
                cortes.add(a + 3)
        else:
            cortes.add(b - 2 if (cons[-2] + cons[-1]) in INSEP else b - 1)
    sil, cur = [], ''
    for k, tok in enumerate(t):
        if k in cortes and cur:
            sil.append(cur); cur = ''
        cur += 'y' if tok == 'i_y' else tok
    sil.append(cur)
    # cada sílaba debe tener vocal
    if not all(any(isv(x) or x == 'y' for x in tokens(s)) or 'y' in s for s in sil):
        return None
    return sil

if __name__ == '__main__':
    for test in ['camino', 'instante', 'pájaro', 'reloj', 'construir', 'guerra', 'quiero', 'país',
                 'poesía', 'ahora', 'piano', 'buey', 'transporte', 'hablar', 'carretera', 'atleta',
                 'ciudad', 'leer', 'muy', 'abstracto', 'chillar', 'guiño', 'acción', 'extraño']:
        print(test, '-'.join(silabear(test) or ['?']))
