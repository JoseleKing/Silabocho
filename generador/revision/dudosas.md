# Palabras dudosas (para decidir)

No he quitado ninguna de estas palabras: todas cumplen las reglas del léxico, pero pueden chocar al jugador.
Para quitar una, añádela a `generador/excluidas.txt` y ejecuta `python3 comprobar.py`. Si avisa de diferencias, regenera los tableros con `python3 gen.py`.
Para vetar una palabra malsonante, usa `vetadas.txt`.

Al final están los cambios que sí he hecho por mi cuenta, porque eran fallos claros de las reglas.

## 1. En los 10 tableros actuales

Estas son las que más importan, porque son las que verá quien juegue. Las de los días 1 a 3 aparecen primero, porque son los tableros que tienen que enganchar.

| palabra | tablero | duda |
|---|---|---|
| acabo | **nº 2**, nº 9 | El diccionario lo admite como sustantivo («acabo», raro), pero se lee como forma de *acabar*. |
| quita | **nº 3** | Sustantivo rarísimo (perdón de una deuda); se lee como forma de *quitar*. |
| esta | **nº 3** | Demostrativo. Es correcto, pero «esta/está» puede confundir. |
| manolo | nº 5 | Nombre propio en minúscula (el diccionario lo trae como «majo, chulapo»). |
| mariano | nº 7 | Igual: suena a nombre propio (como adjetivo es «de la Virgen María»). |
| mama | nº 5, nº 7 | Correcta (glándula mamaria), pero se lee como «mamá» sin tilde. |
| roma | nº 5, nº 7 | Adjetivo «roma» (chata). Se lee como la ciudad. |
| cabe | nº 6, nº 9 | Preposición antigua («cabe la fuente»); se lee como forma de *caber*. |
| parta | nº 8 | El diccionario la admite como sustantivo raro, pero se lee como forma de *partir*. |
| data | nº 8 | Sustantivo raro (fecha de un documento). Además puede parecer un anglicismo. |
| eta | nº 8 | Letra griega. Es correcta, pero se asocia a la banda terrorista. |
| torna | nº 10 | «Volver las tornas». Rara sola y se lee como forma de *tornar*. |
| sena | nº 10 | Correcta (planta; seis en el dado), pero poco conocida. |
| dona | nº 10 | «Donas» (regalos de boda) o «dona» (rosquilla en América). Rara en España. |

## 2. Nombres propios, unidades y anglicismos que se cuelan

El diccionario trae en minúscula unidades y algunos nombres. Ahora no salen en ningún tablero, pero podrían salir al regenerar.

- **Nombres o unidades:** franklin, rita, víctor, newton, maxwell, gilbert, kelvin, moisés, judas, hércules, júpiter, venus, mercurio, saturno, satanás, herodes, colón, panamá, nasa, manolo, mariano, géminis, morse, burdeos, pilates.
- **Anglicismos y extranjerismos:** jersey, internet, software, marketing, hockey, cricket, camping, casting, catering, scooter, boom, milord, ami, lores.

Te propongo excluirlas todas, salvo quizá internet, jersey y morse.

## 3. Palabras que pueden resultar ofensivas o delicadas (no vetadas)

- **Sobre el físico o la discapacidad:** gorda/gordo, fea/feo, enano/enana, cojo/coja, manco, ciego, sordo.
- **Sobre origen, religión o etnia:** negro/negra, moro/mora, gitano/gitana, judío/judía, chino/china, indio/india. Son neutras como gentilicio o color, pero alguna se usa como insulto.
- **Sobre sexualidad:** lesbiana, homosexual, transexual, travesti, afeminado. No son insultos, pero pueden molestar en un juego.
- **Sobre cuerpo y sexo:** desnudo/desnuda, pechos, pezón, trasero, vagina, testículos, erección, burdel, excitado/excitada, lamer, topless.
- **Sobre drogas y violencia:** cocaína, heroína (también «la heroína»), droga, asesino, terrorista, cadáver, borracho.
- **Insultos suaves:** idiotez, cretino, zoquete, escoria, bobo/boba, memo, necio.

## 4. Palabras vetadas que también son palabras normales

Vienen de la lista original de `gen.py`. Las dejo vetadas, pero quizá quieras recuperar alguna:

- **viola:** el instrumento.
- **paja/pajas:** de cereal.
- **pito/pitos:** el silbato.
- **coger/cogida:** normalísimas en España.
- **chupa:** la cazadora.
- **perra/perras:** de perro.
- **capullo:** de flor o de gusano de seda.
- **maría:** nombre propio.
- **sexo/sexual, violación, suicidio:** neutras.
- **tonto/tonta:** un insulto muy suave.

## 5. Homógrafos con una lectura no verbal muy rara

Por las reglas valen, porque el diccionario las trae como sustantivo o adjetivo, pero casi cualquiera las leerá como verbo. No salen en los tableros actuales:

dije, juro, cuida, salga, pierde, muera, explique, sufra, tose, corra, mires, mueres, unes, callaos, sueno, cuelgue, lave, ladra, intenta, invito, niego, resuelve, noto, pego, fumo, vendí, vendo, abra, lleva, deja, chocó.

La lista completa de las palabras admitidas que también son forma verbal, con la entrada del diccionario que las admite, está en `homografos.txt` (son muchas, ordenadas por frecuencia).

## Cambios que he hecho yo (fallos claros de las reglas)

- **Formas irregulares sueltas.** El diccionario trae sueltas formas como está, puede, hizo, sea, huele, juega, anduvo o siendo, y antes se colaban como «no verbales». Las he puesto en `formas_verbales.txt`. He dejado fuera de esa lista las que también son otra cosa (fuera, consigo, entre, para, como, debe…).
- **Participios.** `noverb.py` admitía como participio cualquier forma terminada en -ido/-ida, así que pasaban pido, mido, decida u olvida. Ahora solo admite los participios de verdad del verbo.
- **Prefijos y femeninos en -a.** Si la única lectura no verbal sale de un prefijo (a + cabe → «acabe», de + bes → «debes») o del femenino en -a de un adjetivo en -e (aparente → «aparenta», presente → «presenta», agote → «agota»), ahora la palabra cuenta como verbal.
- **Pronombre «os».** iros, daos, haberos y daros están en `formas_verbales.txt`.
- **Vetadas.** El prefijo `coñ*` vetaba «coñac» y `puñet*` vetaba «puñetazo». Los he cambiado por palabras exactas.
- **Ampliación de la lista de vetadas.** He añadido furcia, guarra, putón, capullo, hijoputa, malparido, sudaca, negrata, tortillera, bollera, mongólico, carajo, huevón, pendejo, semen, condón, clítoris y otras.
