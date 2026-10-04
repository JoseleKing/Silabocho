# Silabocho

Ocho sílabas, muchas palabras. Juego de palabras diario en español, al estilo de Heptagrama (Spelling Bee), pero con **sílabas** en lugar de letras.

- Cada tablero tiene 8 sílabas: 7 alrededor y 1 central.
- Se forman palabras de 2 o más sílabas tocando las fichas; las sílabas se pueden repetir.
- Toda palabra debe contener la sílaba central.
- Puntos: 2 sílabas = 1; 3 = 2; 4 = 4; 5 o más = 6. La **palabra estrella** (la más larga) suma 5 más.
- Rangos según el porcentaje de puntos: Bisílabo 0 %, Trisílabo 5 %, Tetrasílabo 12 %, Pentasílabo 22 %, Hexasílabo 35 %, Heptasílabo 50 %, Octosílabo 70 %, Alejandrino 100 %.
- Un tablero por día. El **nº 1 es el 4 de octubre de 2026**. Con ◀ se juegan los días anteriores (archivo); no se puede adelantar a días futuros. Si hay menos tableros que días, se vuelve a empezar por el primero.
- El progreso se guarda en el dispositivo (`localStorage`).
- «Compartir resultado» copia o comparte el rango y los puntos del día, sin revelar palabras.
- Es una PWA: se puede instalar en el móvil y funciona sin conexión.

## Estructura

```
index.html              página del juego
css/estilo.css          estilos (modo claro y oscuro)
js/juego.js             lógica del juego
data/tableros.json      tableros generados (el juego los lee de aquí)
manifest.webmanifest    datos de la app instalable
sw.js                   service worker (funcionamiento sin conexión)
icons/                  iconos de la app (icon.svg es el original)
fonts/                  Bricolage Grotesque y Atkinson Hyperlegible, alojadas aquí para ir sin conexión
generador/              scripts de Python que generan los tableros
  silabas.py            expansión del diccionario Hunspell y silabeador
  noverb.py             separa las formas verbales conjugadas del resto
  lexico.py             reglas del léxico jugable
  gen.py                búsqueda de tableros
  comprobar.py          comprueba que data/tableros.json sigue cuadrando con el léxico
  revisar.py            escribe en revision/ las listas para revisar palabras
  vetadas.txt           palabras vetadas (malsonantes u ofensivas)
  formas_verbales.txt   formas verbales irregulares que el diccionario trae sueltas
  excluidas.txt         palabras que se quitan a mano tras la revisión
  descargar.sh          descarga las fuentes del léxico
  revision/             listas de palabras dudosas para revisar
```

## Probarlo en local

El juego carga `data/tableros.json` con `fetch`, así que hay que servirlo por HTTP (abrir `index.html` con doble clic no funciona):

```sh
python3 -m http.server 8000
```

y abrir <http://localhost:8000>.

## Regenerar los tableros

Hace falta Python 3 (sin paquetes extra).

```sh
cd generador
./descargar.sh                 # una vez: diccionario y frecuencias en generador/fuentes/
python3 gen.py                 # 10 tableros → ../data/tableros.json
```

Opciones de `gen.py`:

| opción | por defecto | qué hace |
|---|---|---|
| `--tableros N` | 10 | tableros que se guardan |
| `--candidatos N` | 3 × tableros | tableros que se generan antes de quedarse con los mejores |
| `--primeros N` | 3 | cuántos de los mejores van al principio, sin barajar |
| `--semilla N` | 2026 | semilla fija: la misma semilla da los mismos tableros |

Cómo trabaja:

1. Construye el léxico (ver reglas abajo) y toma las ~220 sílabas más frecuentes.
2. Busca conjuntos de 8 sílabas por búsqueda local (*hill climbing*), eligiendo la central que da más palabras y penalizando las sílabas ya muy usadas en otros tableros.
3. Acepta un tablero si tiene 15–80 palabras, al menos una de 4 sílabas o más, poco solapamiento con los demás (Jaccard ≤ 0,45) y una palabra estrella que no haya salido en otro tablero.
4. Sigue hasta tener todos los candidatos (no hay tope de intentos; los últimos cuestan más). Con los valores por defecto tarda unos 8 minutos.
5. Ordena los candidatos por calidad (palabras, palabras largas, longitud de la estrella), se queda con los mejores, pone primero los 3 mejores (sin repetir sílaba central) y baraja el resto con la semilla.

**Después de regenerar**, sube `VERSION` en `sw.js` (por ejemplo, `silabocho-v2`) para que los móviles que ya tienen la app instalada reciban los tableros nuevos.

## Reglas del léxico

- Palabras del diccionario Hunspell español ([wooorm/dictionaries](https://github.com/wooorm/dictionaries), `dictionaries/es`) con todas sus formas expandidas, cruzadas con las 30.000 más frecuentes de [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords) (`content/2018/es/es_50k.txt`). Sin nombres propios.
- Silabeo según la división ortográfica estándar (`silabas.py`).
- Sin formas verbales conjugadas. Valen sustantivos, adjetivos y demás, con plurales y femeninos, más infinitivos y participios. Las palabras que son a la vez forma verbal y otra cosa (casa, llama, paso, toma) sí valen.
  - Las formas irregulares que el diccionario trae sueltas (está, puede, hizo, huele…) están en `formas_verbales.txt`.
  - Si la única lectura no verbal sale de un prefijo (a + cabe → «acabe») o del femenino en -a de un adjetivo en -e (aparente → «aparenta»), la palabra se considera verbal.
- Sin pronombres pegados al verbo (tenerlo, dámelo, dile, casarse).
- Sin palabras vetadas (`vetadas.txt`; una línea terminada en `*` veta un prefijo).
- Para quitar una palabra concreta tras revisarla, añádela a `excluidas.txt` y ejecuta `python3 comprobar.py`: si avisa de diferencias, regenera.
- `generador/revision/dudosas.md` recoge las palabras dudosas pendientes de decisión.

## Publicación en GitHub Pages

El juego es estático y usa rutas relativas, así que funciona tal cual en `https://joseleking.github.io/Silabocho/`:

1. En GitHub: *Settings → Pages → Build and deployment → Source: Deploy from a branch*.
2. Rama `main`, carpeta `/ (root)`, *Save*.
3. A los pocos minutos estará en <https://joseleking.github.io/Silabocho/>.

Para instalarlo en el móvil: abrir la dirección y, en Android (Chrome), *Instalar aplicación*; en iPhone (Safari), *Compartir → Añadir a pantalla de inicio*. La instalación y el modo sin conexión necesitan HTTPS, que GitHub Pages ya da.

Si cambia la dirección, actualiza `URL_JUEGO` en `js/juego.js` (es el enlace que va en el texto de compartir).
