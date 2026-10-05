# Silabocho

Ocho sílabas, muchas palabras. Juego de palabras diario en español, al estilo de Heptagrama (Spelling Bee), pero con **sílabas** en lugar de letras.

- Cada tablero tiene 8 sílabas: 7 alrededor y 1 central.
- Se forman palabras de 2 o más sílabas tocando las fichas; las sílabas se pueden repetir.
- Toda palabra debe contener la sílaba central.
- Puntos: 2 sílabas = 1; 3 = 2; 4 = 4; 5 o más = 6. Las **palabras estrella** o **Silabochos** (todas las que empatan con el máximo de sílabas del tablero; puede haber una o varias) suman 5 más cada una. El juego muestra cuántos llevas («1 de 2») sin decir cuáles son.
- Rangos según el porcentaje de puntos: Bisílabo 0 %, Trisílabo 5 %, Tetrasílabo 12 %, Pentasílabo 22 %, Hexasílabo 35 %, Heptasílabo 50 %, Octosílabo 70 %, Alejandrino 100 %.
- Un tablero por día. El **nº 1 es el 4 de octubre de 2026**. Con «Juegos pasados» (calendario) se juegan los días anteriores (archivo); no se puede adelantar a días futuros. Si hay menos tableros que días, se vuelve a empezar por el primero.
- Un reloj cuenta el tiempo jugado en cada tablero (minutos y segundos). Empieza al tocar la primera sílaba, se detiene mientras la app no está a la vista y se queda fijo al completar el tablero o al ver las soluciones.
- **Racha** (llama junto a la fecha): días seguidos en que has encontrado al menos una palabra del tablero del día, ese mismo día. Jugar el archivo no cuenta. Si hoy aún no has jugado pero sí ayer, la racha sigue viva (borde discontinuo) hasta medianoche. Al tocarla se ve también la mejor racha.
- El progreso, el tiempo y la racha se guardan en el dispositivo (`localStorage`).
- «Compartir resultado» copia o comparte el rango, los puntos, el tiempo y la racha, sin revelar palabras.
- Es una PWA: se puede instalar en el móvil y funciona sin conexión.

## Estructura

```
index.html              página del juego
reiniciar/index.html    borra el progreso guardado en el dispositivo (/reiniciar)
css/estilo.css          estilos (modo claro y oscuro; paleta del logo: ocre #E8A33D, azul marino #1E2A3A, crema #F6F1E7)
js/juego.js             lógica del juego
data/tableros.json      tableros generados (el juego los lee de aquí)
manifest.webmanifest    datos de la app instalable
sw.js                   service worker (funcionamiento sin conexión)
icons/                  logo e iconos de la app (favicon.svg es el original)
fonts/                  Bricolage Grotesque y Atkinson Hyperlegible, alojadas aquí para ir sin conexión
generador/              scripts de Python que generan los tableros
  silabas.py            expansión del diccionario Hunspell y silabeador
  noverb.py             separa las formas verbales conjugadas del resto
  lexico.py             reglas del léxico jugable
  gen.py                búsqueda de tableros
  comprobar.py          comprueba que data/tableros.json sigue cuadrando con el léxico
  revisar.py            escribe en revision/ las listas para revisar palabras
  primeros.txt          tableros elegidos para los días 1, 2 y 3
  vetadas.txt           palabras vetadas (malsonantes u ofensivas)
  formas_verbales.txt   formas verbales irregulares que el diccionario trae sueltas
  admitidas.txt         palabras sueltas que coinciden con un verbo pero valen (para, destino…)
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

Para empezar de cero, abre <http://localhost:8000/reiniciar>. Borra el progreso, los tiempos y las soluciones vistas de este navegador, además de la copia sin conexión del service worker, y vuelve al juego. Así también se cargan los archivos recién cambiados. En GitHub Pages funciona igual (`…/Silabocho/reiniciar`) y solo afecta al dispositivo de quien la abre.

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
| `--reusar` | — | reutiliza los candidatos de `candidatos.json` y solo rehace la selección (segundos en vez de minutos); se niega si el léxico ha cambiado |

Cómo trabaja:

1. Construye el léxico (ver reglas abajo) y toma las ~220 sílabas más frecuentes.
2. Busca conjuntos de 8 sílabas por búsqueda local (*hill climbing*), eligiendo la central que da más palabras y penalizando las sílabas ya muy usadas en otros tableros.
3. Acepta un tablero si tiene 15–80 palabras, al menos una de 4 sílabas o más, poco solapamiento con los demás (Jaccard ≤ 0,45) y ninguna palabra estrella que haya salido en otro tablero.
4. Sigue hasta tener todos los candidatos (no hay tope de intentos; los últimos cuestan más). Con los valores por defecto tarda alrededor de un minuto; construir el léxico tarda unos 20 segundos más.
5. Ordena los candidatos por calidad, es decir, por lo interesantes que son: variedad de familias de palabras (preparada y preparados cuentan como una), familias largas, variedad de longitudes y alguna palabra de 5 sílabas o más; penaliza los tableros llenos de participios o con más de 3 Silabochos. Se queda con los mejores.
6. Los días 1, 2 y 3, los que tienen que enganchar, son los tableros indicados en `primeros.txt` (por una de sus palabras estrella; ahora catarata, calabozo y operadora). Si falta alguno, se elige automáticamente el mejor sin repetir sílaba central. El resto se baraja con la semilla.
7. Guarda los candidatos en `candidatos.json` (no va al repositorio) para poder repetir la selección con `--reusar`.

**Después de regenerar**, sube `VERSION` en `sw.js` (por ejemplo, `silabocho-v2`) para que los móviles que ya tienen la app instalada reciban los tableros nuevos.

## Reglas del léxico

- Palabras del diccionario Hunspell español ([wooorm/dictionaries](https://github.com/wooorm/dictionaries), `dictionaries/es`, del proyecto RLA-ES, que sigue la norma de la RAE) con todas sus formas expandidas. Sin nombres propios.
- **Dos niveles:**
  - **Núcleo** (el que se usa para buscar y elegir los tableros). Sustantivos, adjetivos y demás entran por familias: si alguna forma está entre las 50.000 más frecuentes de [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords) (`content/2018/es/es_50k.txt`), entra la familia entera (ratero → ratera, rateros, rateras). Los infinitivos y participios solo entran si esa forma concreta es frecuente; así no se llenan los tableros de «costadas» o «datadas».
  - **Extra.** El resto de palabras válidas del diccionario. No influyen en qué tableros se eligen, pero una vez elegido el tablero se le añaden y cuentan igual que las demás: suman puntos, entran en el total y en las soluciones, y pueden ser Silabochos si empatan con las más largas.
- Silabeo según la división ortográfica estándar (`silabas.py`).
- Sin formas verbales conjugadas. Valen sustantivos, adjetivos y demás, con plurales y femeninos, más infinitivos y participios. Las palabras que son a la vez forma verbal y otra cosa (casa, llama, paso, toma) sí valen.
  - Las formas irregulares que el diccionario trae sueltas (está, puede, hizo, huele…) están en `formas_verbales.txt`. Además, cualquier palabra suelta del diccionario que coincida con una forma verbal (hinchan, suele) se considera verbal, salvo las de `admitidas.txt` (para, destino, marzo…).
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
