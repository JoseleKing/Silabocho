'use strict';
// Silabocho: un tablero por día. El día 1 es el 1 de octubre de 2026; si hay menos tableros
// que días, se vuelve a empezar por el primero.

// Monosílabo es el punto de partida (0 puntos, barra vacía); desde el primer punto, Bisílabo
const RANKS = [["Monosílabo",0],["Bisílabo",0],["Trisílabo",.05],["Tetrasílabo",.10],["Pentasílabo",.18],["Hexasílabo",.28],["Heptasílabo",.40],["Octosílabo",.50],["Alejandrino",.70]];
const START = Date.UTC(2026, 9, 1);
const INICIO = '2026-10-01';   // se guarda con el progreso para saber con qué numeración se jugó
const ORDEN = 2;                // versión del orden de tableros (2: catarata pasó del día 4 al 7)
const URL_JUEGO = 'https://joseleking.github.io/Silabocho/';
const URL_COMPARTIR = URL_JUEGO.replace(/^https?:\/\//, '').replace(/\/$/, '');   // en el texto de compartir, sin https:// ni barra final
const STORE = 'silabocho-v1';
const pointsFor = n => n<=2?1:n===3?2:n===4?4:6;

let BOARDS = [];
let S = {day:1, found:{}, cur:'', order:{}, revealed:{}, time:{}, racha:{}};   // time: segundos jugados por día; racha: días jugados en su día

function load(){ try{ const s = JSON.parse(localStorage.getItem(STORE)||'null'); if(s){S.found=s.found||{};
  // antes había «palabras extra» aparte; ahora son del tablero, así que pasan a las halladas
  Object.entries(s.extra||{}).forEach(([d,ws])=>{ const f = S.found[d] || (S.found[d]=[]); ws.forEach(x=>{ if(!f.includes(x)) f.push(x); }); });
  S.revealed=s.revealed||{};S.time=s.time||{};S.racha=s.racha||{};
  let migrado = false;
  // el progreso guardado sin «inicio» es de cuando el día 1 era el 4 de octubre: se corre 3 días
  if(!s.inicio){ const correr = o => Object.fromEntries(Object.entries(o).map(([d,v])=>[+d+3, v]));
    S.found=correr(S.found); S.revealed=correr(S.revealed); S.time=correr(S.time); S.racha=correr(S.racha); migrado = true; }
  // orden 2: el tablero de catarata pasó del día 4 al 7 (y el 4 tiene uno nuevo); su progreso va con él (la racha no)
  if((s.orden||1) < 2){ [S.found, S.revealed, S.time].forEach(o=>{ if(o[4] !== undefined){ o[7] = o[4]; delete o[4]; } }); migrado = true; }
  if(migrado) save(true); } }catch(e){} }   // tras migrar se escribe sin fusionar con el formato antiguo
// ¿vale la palabra x en el tablero del día d? (sin tableros cargados aún, se da por buena)
function valeEn(d, x){ const b = BOARDS.length && BOARDS[(d-1) % BOARDS.length]; return !b || b.palabras.some(w=>w[0]===x); }
// quita del progreso las palabras que ya no valen en su tablero (p. ej., los plurales desde que no se admiten)
function depurar(){
  let cambio = false;
  Object.keys(S.found).forEach(d=>{ const f = S.found[d].filter(x=>valeEn(d, x));
    if(f.length !== S.found[d].length){ S.found[d] = f; cambio = true; } });
  if(cambio) save();
}
// ---------- guardar sin pisar a otras pestañas ----------
// Si el juego está abierto en dos sitios (dos pestañas, o la app y el navegador), cada uno guarda su copia.
// Para que el último en guardar no borre lo del otro, al guardar se une lo propio con lo ya guardado:
// palabras halladas juntas, soluciones vistas y días de racha si cualquiera los tiene, y el tiempo mayor.
// Solo se une lo que tenga el mismo formato (numeración y orden de tableros).
function fusionar(otro){
  if(!otro || otro.inicio !== INICIO || (otro.orden||1) !== ORDEN) return false;
  let cambio = false;
  Object.entries(otro.found||{}).forEach(([d,ws])=>{ const f = S.found[d] || (S.found[d] = []);
    ws.forEach(x=>{ if(!f.includes(x) && valeEn(d, x)){ f.push(x); cambio = true; } }); });
  [['revealed', S.revealed], ['racha', S.racha]].forEach(([k, mio])=>Object.entries(otro[k]||{}).forEach(([d,v])=>{ if(v && !mio[d]){ mio[d] = v; cambio = true; } }));
  Object.entries(otro.time||{}).forEach(([d,v])=>{ if(typeof v === 'number' && !(S.time[d] >= v)){ S.time[d] = v; cambio = true; } });
  return cambio;
}
function save(sobrescribir){ try{
  if(!sobrescribir) fusionar(JSON.parse(localStorage.getItem(STORE)||'null'));
  localStorage.setItem(STORE, JSON.stringify({inicio:INICIO,orden:ORDEN,found:S.found,revealed:S.revealed,time:S.time,racha:S.racha})); }catch(e){} }
// cuando otra pestaña guarda, esta se pone al día al momento (sin tocar la palabra que se esté escribiendo);
// si otra pestaña borra el progreso (/reiniciar), esta también se vacía, para no resucitarlo al guardar
window.addEventListener('storage', e=>{
  if(e.key !== STORE && e.key !== null) return;
  if(e.newValue === null){ S.found = {}; S.revealed = {}; S.time = {}; S.racha = {}; }
  else { let otro = null; try{ otro = JSON.parse(e.newValue); }catch(err){} if(!fusionar(otro)) return; }
  if(BOARDS.length){ renderScore(); renderWords(); renderClock(); renderRacha(); renderNav(); }
});

// número de día según la fecha local (el 1 de octubre de 2026 es el 1)
function today(){ const d = new Date(); return Math.max(1, Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - START)/864e5) + 1); }
function dateOf(day){ const d = new Date(START + (day-1)*864e5); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }
const B = () => BOARDS[(S.day-1) % BOARDS.length];
const words = () => B().palabras;
const sylls = w => w[1].split('-');
// palabras estrella («Silabochos»): las que empatan con el máximo de sílabas; cada una suma 5 más
const stars = () => B().estrellas || [B().estrella];
const isStar = x => stars().includes(x);
const wordPoints = w => pointsFor(sylls(w).length) + (isStar(w[0])?5:0);
function total(){ return words().reduce((a,w)=>a+wordPoints(w),0); }
function myFound(){ return S.found[S.day] || (S.found[S.day]=[]); }
function score(){ return myFound().reduce((a,x)=>{ const w = words().find(y=>y[0]===x); return a+(w?wordPoints(w):0); },0); }
const allFound = () => myFound().length >= words().length;
function outer(){ return S.order[S.day] || (S.order[S.day]=B().exterior.slice()); }
// el rango va por porcentaje de puntos (Alejandrino, el 70 %, como el «Genius» de Spelling Bee); encontrarlas todas da aparte el «Tablero completo»
function rankIndex(){ if(!score()) return 0; const frac = score()/total(); let k = 1; RANKS.forEach((r,i)=>{ if(i && frac>=r[1]-1e-9) k=i; }); return k; }
// puntos que pide cada nivel en este tablero (Bisílabo, al menos 1)
const puntosRango = (i, tot) => i===0 ? 0 : Math.max(1, Math.ceil(RANKS[i][1]*tot-1e-9));

// ---------- reloj: tiempo jugado en cada tablero ----------
// Empieza al tocar la primera sílaba, solo corre con la app a la vista y se para al
// completar el tablero (todas las palabras) o al ver las soluciones.
const finished = () => !!S.revealed[S.day] || allFound();
const fmtTime = sec => { sec = Math.floor(sec); const m = Math.floor(sec/60), r = sec%60; return m+':'+(r<10?'0':'')+r; };
// varios datos en línea separados por «·»: cada uno es un bloque y el «·» lo dibuja el CSS delante de cada dato
// (ver «.datos»); el del primero de cada línea queda recortado, así nunca hay un «·» al principio ni al final
const datosHTML = items => '<span class="datos"><span class="datos-l">'+items.map(x=>'<span>'+x+'</span>').join('')+'</span></span>';
let lastTick = 0, sinceSave = 0;
const enPortada = () => { const el = document.getElementById('portada'); return !!el && !el.classList.contains('fuera'); };
function clockRunning(){ return S.time[S.day] !== undefined && !finished() && document.visibilityState === 'visible' && !enPortada(); }
function startClock(){ if(S.time[S.day] === undefined && !finished()){ S.time[S.day] = 0; lastTick = performance.now(); save(); renderClock(); } }
function tickClock(){
  const now = performance.now(), dt = (now - lastTick)/1000; lastTick = now;
  if(!clockRunning()) return;
  S.time[S.day] += Math.min(dt, 5);   // tope por si el navegador congela la página sin avisar
  if((sinceSave += dt) >= 5){ sinceSave = 0; save(); }
  renderClock();
}
function renderClock(){
  const t = S.time[S.day], el = document.getElementById('timer');
  document.getElementById('time').textContent = fmtTime(t || 0);
  el.className = 'timer' + (t !== undefined && finished() ? ' done' : clockRunning() ? ' run' : '');
  el.setAttribute('aria-label', 'Tiempo jugado: ' + fmtTime(t || 0).replace(':', ' minutos y ') + ' segundos');
}

// ---------- racha: días seguidos jugando el tablero del día ----------
// Sigue viva si hoy aún no has jugado pero sí ayer; se rompe al saltarte un día entero.
// días seguidos jugados en su día que acaban en d (0 si d no se jugó en su día)
function rachaHasta(d){ let n = 0; while(d >= 1 && S.racha[d]){ n++; d--; } return n; }
function rachaActual(){ const t = today(); return rachaHasta(S.racha[t] ? t : t-1); }
function rachaMejor(){ let mejor = 0, n = 0; const t = today(); for(let d = 1; d <= t; d++){ n = S.racha[d] ? n+1 : 0; mejor = Math.max(mejor, n); } return mejor; }
function renderRacha(){
  const r = rachaActual(), hoy = !!S.racha[today()], el = document.getElementById('racha');
  document.getElementById('rachan').textContent = r;
  el.className = 'racha' + (hoy ? ' hoy' : r ? ' pendiente' : '');
  el.setAttribute('aria-label', 'Racha: '+r+(r===1?' día seguido':' días seguidos')+(hoy || !r ? '' : '. Juega hoy para mantenerla'));
}
function toastRacha(){
  const r = rachaActual(), m = rachaMejor(), hoy = !!S.racha[today()];
  const txt = r ? 'Racha: '+r+(r===1?' día':' días')+' · Mejor: '+m+(hoy ? '' : ' · ¡Juega hoy para mantenerla!')
                : m ? 'Sin racha ahora · Mejor: '+m+(m===1?' día':' días')+' · ¡Juega hoy para empezar otra!'
                    : 'Encuentra una palabra del tablero de hoy para empezar una racha';
  toast(txt, r ? 'star' : '');
}

function tileEl(s, isCenter, x, y){
  const b = document.createElement('button');
  b.className = 'tile'+(isCenter?' center':'');
  b.textContent = s; b.dataset.s = s; b.style.left = x+'%'; b.style.top = y+'%';
  b.setAttribute('aria-label','Sílaba '+s+(isCenter?' (central)':''));
  b.addEventListener('click',()=>{ startClock(); S.cur += s; renderVerse(); toast(''); });
  return b;
}
// posición (en %) de la ficha exterior número i, en círculo empezando por arriba
const posicion = i => { const a = (-90 + i*360/7)*Math.PI/180; return [50+36*Math.cos(a), 50+36*Math.sin(a)]; };
function renderRose(){
  const r = document.getElementById('rose'); r.innerHTML='';
  r.appendChild(tileEl(B().central, true, 50, 50));
  outer().forEach((s,i)=>r.appendChild(tileEl(s, false, ...posicion(i))));
}
// al mezclar, las mismas fichas se deslizan a su nuevo sitio (la transición de left/top está en el CSS),
// así el ojo puede seguir a dónde va cada una
function moverFichas(){
  const fichas = [...document.querySelectorAll('#rose .tile:not(.center)')];
  outer().forEach((s,i)=>{ const b = fichas.find(x=>x.dataset.s===s); if(!b) return renderRose();
    const [x, y] = posicion(i); b.style.left = x+'%'; b.style.top = y+'%'; });
}
// ---------- la palabra en curso ----------
// Es un texto: se escribe solo tocando sílabas. Para comprobarla no cuentan las tildes ni la diéresis.
const norm = s => s.normalize('NFD').replace(/[\u0301\u0308]/g,'').normalize('NFC').toLowerCase();
// divide el texto en sílabas del tablero (prefiriendo una división con la central); null si no se puede
function trocear(txt){
  const sy = [B().central, ...outer()], memo = {};
  const ir = i => {
    if(i===txt.length) return [[]];
    if(memo[i]) return memo[i];
    const r = [];
    sy.forEach(s=>{ const n = norm(s); if(txt.startsWith(n, i)) ir(i+n.length).slice(0,4).forEach(resto=>r.push([s, ...resto])); });
    return memo[i] = r;
  };
  const todas = ir(0);
  return todas.find(d=>d.includes(B().central)) || todas[0] || null;
}
function renderVerse(){
  const v = document.getElementById('verse');
  const trozos = S.cur && trocear(norm(S.cur)), cursor = '<span class="cursor" aria-hidden="true"></span>';
  if(!S.cur){ v.innerHTML = cursor; return; }
  v.innerHTML = (trozos ? trozos.map(s=>'<span'+(s===B().central?' class="c"':'')+'>'+s+'</span>').join('<span class="dot">·</span>')
                        : '<span class="crudo">'+S.cur+'</span>') + cursor;
}
function renderScore(){
  const k = rankIndex();
  document.getElementById('rankname').textContent = RANKS[k][0];
  document.getElementById('pts').textContent = score();
  document.getElementById('rank').setAttribute('aria-label', 'Rango: '+RANKS[k][0]+', '+score()+' de '+total()+' puntos. Ver los rangos');
  // un tramo por nivel desde Bisílabo: con Monosílabo (0 puntos) la barra está vacía
  document.getElementById('meter').innerHTML = RANKS.slice(1).map((r,j)=>'<span class="'+(j+1<=k?'on':'')+(j+1===RANKS.length-1?' last':'')+'" title="'+r[0]+'"></span>').join('');
}
function renderWords(){
  const f = myFound(), list = document.getElementById('words'), rev = S.revealed[S.day];
  document.getElementById('foundcount').textContent = f.length+(f.length===1?' palabra':' palabras');
  document.getElementById('foundtotal').textContent = 'de '+words().length;
  // línea plegada: las últimas que has encontrado, de la más reciente a la más antigua
  const ult = document.getElementById('ultimas'), lleno = allFound() && !rev;
  ult.textContent = lleno ? '★ Completo' : rev ? 'Soluciones a la vista' : f.length ? f.slice().reverse().join(', ') : '';
  ult.classList.toggle('completo', lleno); ult.title = lleno ? 'Tablero completo: has encontrado todas las palabras' : '';
  // distintivo de los Silabochos: hallados o pendientes (sin decir cuáles son)
  const n = stars().length, k = stars().filter(x=>f.includes(x)).length, est = document.getElementById('estrella');
  // «Silabochos ★☆☆☆»: una estrella por Silabocho, rellena si ya lo tienes
  est.textContent = (n===1 ? 'Silabocho ' : 'Silabochos ') + '★'.repeat(k) + '☆'.repeat(n-k);
  est.className = 'estrella' + (k===n ? ' si' : k ? ' medio' : '');
  est.setAttribute('aria-label', n===1 ? (k ? 'Has encontrado el Silabocho' : 'Aún no has encontrado el Silabocho')
    : 'Has encontrado '+k+' de '+n+' Silabochos');
  const vacio = !f.length && !rev ? '<span class="empty">Aún no has encontrado ninguna. Empieza por las de dos sílabas.</span>' : '';
  list.innerHTML = vacio + htmlGrupos(f, rev); list.classList.toggle('soluciones', rev);
}
// una palabra como ficha: hallada, rellena (★ si es Silabocho); sin hallar, con borde discontinuo
// (☆ y borde de acento si es un Silabocho que se escapó)
function chipPalabra(w, f){
  const x = w[0], si = f.includes(x), est = isStar(x);
  return '<span class="w'+(si ? (est?' star':'') : ' missed'+(est?' sil-falta':''))+'"'+(est && !si ? ' aria-label="'+x+', Silabocho sin encontrar"' : '')+'>'
    +w[1].split('-').join('·')+(est ? (si?' ★':' ☆') : '')+'</span>';
}
// las palabras del tablero de S.day, un grupo por número de sílabas (de menos a más), con «halladas/total»;
// dentro, orden alfabético. Sin soluciones a la vista, solo las halladas. Las palabras de «sin» no salen
// (y un grupo que se quede vacío, tampoco).
function htmlGrupos(f, rev, sin = []){
  const grupos = {};
  words().filter(w=>!sin.includes(w[0])).forEach(w=>{ const n = sylls(w).length; (grupos[n] = grupos[n] || []).push(w); });
  return Object.keys(grupos).map(Number).sort((a,b)=>a-b).map(n=>{
    const todas = grupos[n], halladas = todas.filter(w=>f.includes(w[0])).length;
    const shown = (rev ? todas : todas.filter(w=>f.includes(w[0]))).sort((a,b)=>a[0].localeCompare(b[0],'es'));
    const chips = shown.map(w=>chipPalabra(w, f)).join('');
    const completo = halladas===todas.length;
    return '<div class="grupo"><div class="grupo-head"><span class="grupo-n">'+n+' sílabas</span>'
      +'<span class="grupo-c'+(completo?' ok':'')+'" aria-label="'+halladas+' de '+todas.length+' encontradas">'+halladas+'/'+todas.length+(completo?' ✓':'')+'</span></div>'
      +(chips ? '<div class="chips">'+chips+'</div>' : '')+'</div>';
  }).join('');
}
function renderNav(){
  const t = today();
  const fecha = dateOf(S.day).toLocaleDateString('es-ES',{weekday:'long', day:'numeric', month:'long'});
  document.getElementById('fecha').textContent = (S.day===t ? 'Hoy, ' : '')+fecha+' · nº '+S.day;
  // barra cuando se juega un día pasado: sus resultados y el atajo para volver al de hoy (redibujarla deshace la confirmación)
  const barra = document.getElementById('otrodia');
  barra.hidden = S.day===t; quitarConfirmacion(barra);
  document.getElementById('otrodia-txt').innerHTML = datosHTML(['Nº '+S.day, fecha]);
  document.getElementById('volver').textContent = 'Volver a hoy';
  document.getElementById('otrodia-ver').textContent = 'Ver resultados';
}
// «Ver resultados» de la barra: los del día que se está jugando; al cerrar la ventana se sigue en él
function verDia(){
  const barra = document.getElementById('otrodia');
  if(necesitaConfirmar(S.day) && !confirmando(barra))
    return pedirConfirmacion(barra, document.getElementById('otrodia-txt'), document.getElementById('volver'), document.getElementById('otrodia-ver'),
      '¿Seguro? Ya no sumarás puntos en este tablero.', renderNav);
  mostrarResultados(S.day);
}
function volverHoy(){ if(confirmando(document.getElementById('otrodia'))) return renderNav(); irA(today()); }

// ---------- calendario de juegos pasados ----------
// Un mes cada vez (semana de lunes a domingo); solo se pueden abrir los días del 1 a hoy.
let calMes;   // {y, m} del mes a la vista
function estadoDia(d){
  const b = BOARDS[(d-1) % BOARDS.length], f = S.found[d] || [];
  return { completo: f.length >= b.palabras.length, jugado: f.length > 0, visto: !!S.revealed[d] };
}
function renderCal(){
  const t = today(), {y, m} = calMes, primero = new Date(y, m, 1), diasMes = new Date(y, m+1, 0).getDate();
  const fin = dateOf(t), ini = dateOf(1);
  document.getElementById('cal-titulo').textContent = primero.toLocaleDateString('es-ES',{month:'long', year:'numeric'});
  document.getElementById('cal-prev').disabled = y*12+m <= ini.getFullYear()*12+ini.getMonth();
  document.getElementById('cal-next').disabled = y*12+m >= fin.getFullYear()*12+fin.getMonth();
  let html = '<span class="cal-dia vacio"></span>'.repeat((primero.getDay()+6) % 7);
  for(let n = 1; n <= diasMes; n++){
    const d = Math.round((Date.UTC(y, m, n) - START)/864e5) + 1;
    if(d < 1 || d > t){ html += '<button class="cal-dia" type="button" disabled>'+n+'</button>'; continue; }
    const e = estadoDia(d), cls = (e.completo?' completo':'')+(e.jugado?' jugado':'')+(e.visto?' visto':'')+(d===t?' hoy':'')+(d===S.day?' actual':'');
    const desc = 'nº '+d+(d===t?', hoy':'')+(e.completo?', tablero completo':e.jugado?', jugado':'')+(e.visto?', soluciones vistas':'');
    html += '<button class="cal-dia'+cls+'" type="button" data-dia="'+d+'" aria-label="'+n+' de '+primero.toLocaleDateString('es-ES',{month:'long'})+', '+desc+'"'+(d===S.day?' aria-current="date"':'')+'>'+n+'</button>';
  }
  document.getElementById('cal-grid').innerHTML = html;
}
// ---------- rangos ----------
function abrirRangos(){
  const k = rankIndex(), tot = total();
  document.getElementById('rangos-pts').textContent = 'Llevas '+score()+' de '+tot+' puntos en este tablero.'
    +(allFound() ? ' ★ ¡Tablero completo!' : ' Si encuentras todas las palabras, consigues además el distintivo ★ Tablero completo.');
  document.getElementById('rangos-lista').innerHTML = RANKS.map((r,i)=>'<li class="'+(i<k?'hecho':i===k?'actual':'')+'"><span>'+r[0]+'</span><span>'
    +puntosRango(i,tot)+(puntosRango(i,tot)===1?' punto':' puntos')+'</span></li>').join('');
  document.getElementById('rangos').showModal();
  document.getElementById('rangos-cerrar').focus({focusVisible:false});
}

// ---------- tema: claro por defecto, modo noche a elección (se recuerda en este navegador) ----------
const TEMA = 'silabocho-tema';
function aplicarTema(oscuro){
  document.documentElement.setAttribute('data-theme', oscuro ? 'dark' : 'light');
  const m = document.getElementById('theme-color'); if(m) m.setAttribute('content', oscuro ? '#131B26' : '#F6F1E7');
  const c = document.getElementById('modo-noche'); if(c) c.checked = oscuro;
}
function cambiarTema(oscuro){ aplicarTema(oscuro); try{ oscuro ? localStorage.setItem(TEMA, 'oscuro') : localStorage.removeItem(TEMA); }catch(e){} }
window.addEventListener('storage', e=>{ if(e.key === TEMA || e.key === null) aplicarTema(e.newValue === 'oscuro'); });   // otras pestañas

// ---------- reglas ----------
const REGLAS_VISTAS = 'silabocho-reglas-vistas';
function abrirReglas(){ const d = document.getElementById('reglas'); if(d.open) return; d.showModal(); document.getElementById('reglas-cerrar').focus({focusVisible:false}); }
// la primera vez que se juega, las reglas se abren solas al irse la portada
function quizaReglas(){ try{ if(localStorage.getItem(REGLAS_VISTAS)) return; localStorage.setItem(REGLAS_VISTAS, '1'); }catch(e){ return; } abrirReglas(); }

function abrirCal(cual){ const f = dateOf(S.day); calMes = {y:f.getFullYear(), m:f.getMonth()}; renderCal(); document.getElementById('calendario').showModal();
  pestana(cual || 'cal'); const a = cual==='sil' ? document.getElementById('tab-sil') : document.querySelector('.cal-dia.actual'); if(a) a.focus({focusVisible:false}); }
function pestana(cual){
  ['cal','sil','est'].forEach(p=>{ document.getElementById('tab-'+p).setAttribute('aria-selected', p===cual); document.getElementById('panel-'+p).hidden = p!==cual; });
  if(cual==='sil') renderSil();
  if(cual==='est') renderEst();
}

// ---------- estadísticas: días jugados, rachas, tableros completos y niveles alcanzados ----------
function renderEst(){
  const t = today(), jugados = [];
  let completos = 0, palabras = 0, est = 0, estTot = 0;
  const llegados = RANKS.map(()=>0);
  for(let d = 1; d <= t; d++){
    const b = BOARDS[(d-1) % BOARDS.length], f = S.found[d] || [], e = b.estrellas || [b.estrella];
    if(!f.length) continue;                          // solo cuentan los días jugados (también para los Silabochos)
    estTot += e.length; est += e.filter(x=>f.includes(x)).length;
    jugados.push(d); palabras += f.length;
    const r = datosDia(d); if(r.lleno) completos++;
    const k = RANKS.findIndex(x=>x[0]===r.rango);
    for(let i = 1; i <= k; i++) llegados[i]++;      // llegar a Hexasílabo cuenta también para los de abajo
  }
  const cifra = (n, txt) => '<div class="est-cifra"><b>'+n+'</b><span>'+txt+'</span></div>';
  document.getElementById('est-cifras').innerHTML =
    cifra(jugados.length, jugados.length===1?'día jugado':'días jugados') + cifra(rachaActual(), 'racha actual') + cifra(rachaMejor(), 'mejor racha')
    + cifra(completos, completos===1?'tablero completo':'tableros completos') + cifra(est+'<small>/'+estTot+'</small>', 'Silabochos de tus días') + cifra(palabras, 'palabras');
  const max = Math.max(1, ...llegados.slice(1));
  document.getElementById('est-niveles').innerHTML = RANKS.slice(1).map((r,j)=>{ const n = llegados[j+1];
    return '<div class="est-nivel'+(j+1===RANKS.length-1?' ultimo':'')+'"><span class="est-nombre">'+r[0]+'</span><span class="est-barra"><i style="width:'+(n ? Math.max(6, 100*n/max) : 0)+'%"></i></span><span class="est-n">'+n+'</span></div>'; }).join('')
    + (jugados.length ? '' : '<p class="est-vacio">Aún no has jugado ningún tablero. ¡Empieza hoy!</p>');
}

// ---------- Silabochario: los Silabochos de todos los días, de hoy hacia atrás ----------
// Los encontrados se ven enteros; los que faltan, como huecos (uno por sílaba); con las soluciones vistas, en gris.
function renderSil(){
  const t = today(); let total = 0, hallados = 0, html = '';
  for(let d = t; d >= 1; d--){
    const b = BOARDS[(d-1) % BOARDS.length], f = S.found[d] || [], rev = !!S.revealed[d];
    const est = b.estrellas || [b.estrella];
    const chips = est.map(w=>{
      const sil = (b.palabras.find(y=>y[0]===w) || [w, w])[1].split('-');
      total++; if(f.includes(w)) hallados++;
      return f.includes(w) ? '<span class="w star">'+sil.join('·')+' ★</span>'
        : rev ? '<span class="w visto">'+sil.join('·')+'</span>'
        : '<span class="w hueco" aria-label="Silabocho sin encontrar, de '+sil.length+' sílabas">'+sil.map(()=>'_').join('·')+'</span>';
    }).join('');
    const fecha = dateOf(d).toLocaleDateString('es-ES',{day:'numeric', month:'short'});
    html += '<button class="sil-dia'+(d===S.day?' actual':'')+'" type="button" data-dia="'+d+'"><span class="sil-cab">'
      +datosHTML(['nº '+d, fecha].concat(d===t ? ['hoy'] : []).concat(!f.length ? ['<i class="sil-nota">sin jugar</i>'] : []))+'</span><span class="chips">'+chips+'</span></button>';
  }
  document.getElementById('sil-cuenta').textContent = hallados+' de '+total+' Silabochos encontrados';
  document.getElementById('sil-lista').innerHTML = html;
}

// ---------- pistas: las palabras que faltan, por sílaba inicial y número de sílabas ----------
function abrirPistas(){
  const f = myFound(), rev = !!S.revealed[S.day], faltan = words().filter(w=>!f.includes(w[0]));
  const largos = [...new Set(words().map(w=>sylls(w).length))].sort((a,b)=>a-b);
  const sub = document.getElementById('pistas-sub'), tabla = document.getElementById('pistas-tabla');
  if(rev){ sub.textContent = 'Las soluciones de este tablero ya están a la vista.'; tabla.innerHTML = ''; }
  else if(!faltan.length){ sub.textContent = '¡No te falta ninguna palabra!'; tabla.innerHTML = ''; }
  else {
    sub.textContent = 'Te '+(faltan.length===1?'falta 1 palabra':'faltan '+faltan.length+' palabras')+'. Así se reparten según su primera sílaba y su número de sílabas:';
    const filas = {};
    faltan.forEach(w=>{ const s = sylls(w), k = s[0]; (filas[k] = filas[k] || {})[s.length] = (filas[k][s.length]||0) + 1; });
    const celda = n => '<td>'+(n || '<span class="cero">·</span>')+'</td>';
    tabla.innerHTML = '<table><thead><tr><th scope="col"><span class="sr">Empieza por</span></th>'+largos.map(n=>'<th scope="col">'+n+'</th>').join('')+'<th scope="col">Σ</th></tr></thead><tbody>'
      + Object.keys(filas).sort((a,b)=>a.localeCompare(b,'es')).map(k=>'<tr><th scope="row">'+k+'·</th>'+largos.map(n=>celda(filas[k][n])).join('')
          +'<td class="suma">'+Object.values(filas[k]).reduce((a,b)=>a+b,0)+'</td></tr>').join('')
      + '<tr class="suma"><th scope="row">Σ</th>'+largos.map(n=>celda(faltan.filter(w=>sylls(w).length===n).length)).join('')+'<td>'+faltan.length+'</td></tr></tbody></table>'
      + '<p class="pistas-nota">Columnas: número de sílabas.</p>';
  }
  // pista extra: cómo empiezan los Silabochos que faltan (se descubre al tocar)
  const pend = stars().filter(x=>!f.includes(x)), be = document.getElementById('pista-estrella'), ul = document.getElementById('pista-estrellas');
  be.hidden = rev || !pend.length; be.disabled = false; ul.hidden = true; ul.innerHTML = '';
  be.onclick = ()=>{ ul.innerHTML = pend.map(x=>{ const s = sylls(words().find(y=>y[0]===x)); return '<li>☆ '+[s[0], ...s.slice(1).map(()=>'_')].join('·')+'</li>'; }).join('');
    ul.hidden = false; be.disabled = true; };
  // en días pasados, las soluciones
  document.getElementById('pistas-soluciones').hidden = S.day >= today() && !rev;
  document.getElementById('pistasv').showModal();
  document.getElementById('pistas-cerrar').focus({focusVisible:false});
}
function moverMes(k){ const d = new Date(calMes.y, calMes.m+k, 1); calMes = {y:d.getFullYear(), m:d.getMonth()}; renderCal(); }
// ---------- invitación a instalar ----------
// Tras el tercer día jugado, una sola vez: en iPhone/iPad, los dos pasos de Safari (no hay aviso
// automático); donde el navegador lo permite (Android, Chrome), un botón que abre su diálogo de instalar.
// Nunca si ya se juega desde la app instalada.
const INSTALAR_VISTO = 'silabocho-instalar';
let avisoInstalar = null;
window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); avisoInstalar = e; quizaInstalar(); });
const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const esIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function quizaInstalar(){
  const el = document.getElementById('instalar');
  if(!el || !el.hidden || instalada() || !BOARDS.length) return;
  let visto = null; try{ visto = localStorage.getItem(INSTALAR_VISTO); }catch(e){ return; }
  const jugados = Object.values(S.found).filter(f=>f.length).length;
  if(visto || jugados < 3 || !(esIOS() || avisoInstalar)) return;
  document.getElementById('instalar-ios').hidden = !esIOS();
  document.getElementById('instalar-boton').hidden = esIOS() || !avisoInstalar;
  el.hidden = false;
  try{ localStorage.setItem(INSTALAR_VISTO, '1'); }catch(e){}   // sale una sola vez, aunque no se cierre
}
function instalar(){ if(!avisoInstalar) return; avisoInstalar.prompt(); avisoInstalar = null; document.getElementById('instalar').hidden = true; }

// ---------- resumen de ayer ----------
// Al abrir el juego en un día nuevo, si ayer se jugó: «Ayer: Hexasílabo · 18 de 26 palabras · Silabochos ★☆☆»,
// con «Seguir jugando» (el tablero de ayer, sin destapar nada) y «Ver resultados» (la ventana de resultados).
// Sale una vez al día (se recuerda en este navegador) y se va al cerrarlo o al elegir una de las dos.
const RESUMEN_VISTO = 'silabocho-resumen';
// hace fn() con el tablero del día d como si fuera el actual (words, stars, score…) y deja S.day como estaba
function enDia(d, fn){ const antes = S.day; S.day = d; try{ return fn(); } finally{ S.day = antes; } }
function datosDia(d){ return enDia(d, ()=>({rango: RANKS[rankIndex()][0], n: myFound().length, total: words().length, lleno: allFound(), visto: !!S.revealed[d],
  puntos: score(), puntosTot: total(), est: stars().length, estHallados: stars().filter(x=>myFound().includes(x)).length})); }
function quizaResumen(){
  const el = document.getElementById('resumen'), ayer = today() - 1;
  let visto = null; try{ visto = localStorage.getItem(RESUMEN_VISTO); }catch(e){}
  if(ayer < 1 || !(S.found[ayer]||[]).length || visto === String(today())){ el.hidden = true; return; }
  cancelarAyer();
  el.hidden = false;
}
function textoResumen(){
  const r = datosDia(today() - 1);
  document.getElementById('resumen-txt').innerHTML = datosHTML(['Ayer: <b>'+r.rango+'</b>', r.n+' de '+r.total+(r.total===1?' palabra':' palabras'),
    r.lleno ? '<b>★ Tablero completo</b>' : (r.est===1?'Silabocho ':'Silabochos ')+'<span class="resumen-est">'+'★'.repeat(r.estHallados)+'☆'.repeat(r.est-r.estHallados)+'</span>']);
  // completo o con las soluciones ya vistas, no hay nada que seguir jugando
  document.getElementById('resumen-seguir').hidden = r.lleno || r.visto;
}
function cerrarResumen(){ cancelarAyer(); document.getElementById('resumen').hidden = true; try{ localStorage.setItem(RESUMEN_VISTO, String(today())); }catch(e){} }
function seguirAyer(){ if(confirmando(document.getElementById('resumen'))) return cancelarAyer(); const ayer = today() - 1; cerrarResumen(); irA(ayer); }
function verAyer(){
  const ayer = today() - 1, el = document.getElementById('resumen');
  if(necesitaConfirmar(ayer) && !confirmando(el))
    return pedirConfirmacion(el, document.getElementById('resumen-txt'), document.getElementById('resumen-seguir'), document.getElementById('resumen-ver'),
      '¿Seguro? Ya no podrás sumar puntos ayer.', cancelarAyer);
  cerrarResumen(); mostrarResultados(ayer);
}
// vuelve el aviso a su estado normal (tras «Cancelar», los 5 segundos o al cerrarlo)
function cancelarAyer(){
  quitarConfirmacion(document.getElementById('resumen'));
  document.getElementById('resumen-seguir').textContent = 'Seguir jugando';
  document.getElementById('resumen-ver').textContent = 'Ver resultados';
  if(today() > 1) textoResumen();
}

// ---------- confirmar en dos pasos dentro de un aviso ----------
// En el resumen de ayer y en la barra de día pasado, «Ver resultados» pide un segundo toque si así se dejan
// de sumar puntos: el texto y los botones cambian un momento («Cancelar» / «Confirmar») sin cambiar la altura.
// Se deshace con «Cancelar», a los 5 segundos (restaurar) o al redibujar el aviso.
function pedirConfirmacion(caja, txt, otro, ver, mensaje, restaurar){
  caja.style.minHeight = caja.offsetHeight + 'px'; caja.classList.add('confirma');
  txt.textContent = mensaje; otro.textContent = 'Cancelar'; ver.textContent = 'Confirmar';
  clearTimeout(caja.plazo); caja.plazo = setTimeout(restaurar, 5000);
}
function quitarConfirmacion(caja){ clearTimeout(caja.plazo); caja.style.minHeight = ''; caja.classList.remove('confirma'); }
const confirmando = caja => caja.classList.contains('confirma');

// ---------- resultados de un día pasado ----------
// Ver las soluciones solo pide confirmación si aún se pueden sumar puntos (sin verlas y sin el tablero completo).
const necesitaConfirmar = d => { const e = estadoDia(d); return !e.visto && !e.completo; };
// en el calendario y el Silabochario, los días pasados ya cerrados abren los resultados; el resto, el tablero
const conResultados = d => d < today() && !necesitaConfirmar(d);
function mostrarResultados(d){
  if(necesitaConfirmar(d)){ S.revealed[d] = true; save(); if(S.day === d) renderAll(); }
  abrirResultados(d);
}
// Encima de lo que haya, sin cambiar de día: nivel, puntos, palabras y tiempo; después los Silabochos
// y, por último, el resto de palabras del tablero.
let diaResultados;
function abrirResultados(d){
  // un día sin ninguna palabra no es un logro: sin nivel, sin tus puntos, sin contador de Silabochos y sin Compartir
  const r = datosDia(d), t = S.time[d], jugado = r.n > 0; diaResultados = d;
  document.getElementById('res-titulo').innerHTML = datosHTML(d === today()-1 ? ['Resultados de ayer', 'nº '+d]
    : ['Resultados', 'nº '+d, dateOf(d).toLocaleDateString('es-ES',{day:'numeric', month:'long'})]);
  const rango = document.getElementById('res-rango');
  rango.textContent = jugado ? r.rango : 'Sin jugar'; rango.classList.toggle('sin-jugar', !jugado);
  document.getElementById('res-cifras').innerHTML = datosHTML(!jugado ? [r.total+(r.total===1?' palabra':' palabras'), r.puntosTot+' puntos posibles']
    : [r.puntos+' de '+r.puntosTot+' puntos', r.n+' de '+r.total+(r.total===1?' palabra':' palabras')]
      .concat(t !== undefined ? ['⏳ '+fmtTime(t)] : []).concat(r.lleno ? ['<b>★ Tablero completo</b>'] : []));
  enDia(d, ()=>{
    // el recuadro de los Silabochos hace de grupo de más sílabas (con su recuento), y abajo no se repiten
    const f = myFound(), est = stars(), todos = est.every(x=>f.includes(x)), hallados = est.filter(x=>f.includes(x)).length;
    const pal = est.map(x=>words().find(y=>y[0]===x) || [x, x]), largos = [...new Set(pal.map(w=>sylls(w).length))];
    const titulo = todos && jugado ? (est.length===1 ? '¡Encontraste el Silabocho!' : '¡Encontraste todos los Silabochos!')
                         : (est.length===1 ? 'El Silabocho era' : 'Los Silabochos eran');
    document.getElementById('res-sil').innerHTML = '<div class="res-sil-cab"><p class="res-sil-tit'+(todos?' todos':'')+'">'+titulo+'</p>'
      + (!jugado ? (largos.length===1 ? '<span class="grupo-c">'+largos[0]+' sílabas</span>' : '')
        : '<span class="grupo-c'+(todos?' ok':'')+'" aria-label="'+hallados+' de '+est.length+' encontrados">'+(largos.length===1 ? largos[0]+' sílabas · ' : '')+hallados+'/'+est.length+(todos?' ✓':'')+'</span>') + '</div>'
      + '<div class="chips">' + pal.map(w=>chipPalabra(w, f)).join('') + '</div>';
    document.getElementById('res-palabras').innerHTML = htmlGrupos(f, true, est);
  });
  const c = document.getElementById('res-compartir'); clearTimeout(c.plazo); c.textContent = 'Compartir'; c.hidden = !jugado;
  const v = document.getElementById('resultados'); v.showModal();
  v.scrollTop = 0; document.getElementById('res-cerrar').focus({focusVisible:false});
}

function irA(n){ n = Math.min(today(), Math.max(1, n)); if(n===S.day) return; tickClock(); save(); S.day = n; toast(''); renderAll(); }

let tt;
// los avisos salen en el hueco de la palabra y la tapan mientras se ven
function toast(msg, kind){
  const t = document.getElementById('toast'), e = document.getElementById('entrada');
  t.textContent = msg; t.className = 'toast'+(kind?' '+kind:''); e.classList.toggle('aviso', !!msg);
  clearTimeout(tt); if(msg) tt=setTimeout(()=>{ t.textContent=''; e.classList.remove('aviso'); },2200);
}

function submit(){
  if(!S.cur) return;
  const txt = norm(S.cur), clear = ()=>{ S.cur=''; renderVerse(); };
  // las que se escriben con las mismas fichas y solo se diferencian por la tilde (papa y papá) cuentan juntas:
  // al enviarla se suman todas las que aún no tengas
  const iguales = words().filter(y=>norm(y[0])===txt);
  if(!iguales.length){
    const trozos = trocear(txt);
    toast(!trozos ? 'Usa solo las sílabas del tablero' : trozos.length<2 ? 'Tiene que tener al menos dos sílabas'
      : !trozos.includes(B().central) ? 'Falta la sílaba central' : 'No está en la lista', 'bad');
    return clear();
  }
  const nuevas = iguales.filter(y=>!myFound().includes(y[0])).sort((a,b)=>(b[0]===S.cur)-(a[0]===S.cur));   // la escrita tal cual, primero
  if(!nuevas.length){ toast(iguales.length>1 ? 'Ya las tenías' : 'Ya la tenías','bad'); return clear(); }
  if(S.revealed[S.day]){ toast('Las soluciones ya están a la vista','bad'); return clear(); }
  const antes = rankIndex();
  nuevas.forEach(y=>myFound().push(y[0]));
  if(S.day===today()){ S.racha[S.day] = 1; renderRacha(); }   // jugado en su día: cuenta para la racha
  save();
  const n = sylls(nuevas[0]).length, pts = nuevas.reduce((a,y)=>a+wordPoints(y),0), k = rankIndex();
  const estrella = nuevas.some(y=>isStar(y[0])), sube = k>antes;
  // con dos a la vez se dicen las dos (antes que la subida de nivel, que ya se ve en la barra)
  if(allFound()) toast('★ ¡Tablero completo! +'+pts,'star grande');
  else if(estrella) toast('★ ¡Silabocho! +'+pts,'star grande');
  else if(nuevas.length>1) toast('¡Valen '+nuevas.map(y=>y[0]).join(' y ')+'! +'+pts, sube ? 'star grande' : 'good');
  else if(sube) toast('¡Ya eres '+RANKS[k][0]+'! +'+pts,'star grande');
  else toast((n>=4?'¡Muy bien! ':'')+'+'+pts,'good');
  if(finished()) save();
  quizaInstalar();   // puede que esta palabra complete el tercer día jugado
  clear(); renderScore(); renderWords(); renderClock();
  // los momentos importantes destellan; las palabras normales, no
  if(sube){ destello(document.querySelectorAll('#meter span')[k-1]); destello(document.getElementById('rankname')); }
  if(estrella){ destello(document.querySelector('#found summary')); destello(document.getElementById('estrella')); }
}
// un destello corto (ver «.destello» en el CSS); se puede repetir aunque el anterior no haya acabado
function destello(el){ if(!el) return; el.classList.remove('destello'); void el.offsetWidth; el.classList.add('destello');
  setTimeout(()=>el.classList.remove('destello'), 1200); }
let confirmReveal = false, revealTimer;
// las soluciones solo se pueden ver en tableros de días pasados (desde la ventana de pistas)
const revealText = () => S.revealed[S.day] ? 'Soluciones a la vista' : 'Ver soluciones';
function reveal(){
  const b = document.getElementById('reveal');
  if(S.revealed[S.day] || S.day >= today()) return;
  if(!confirmReveal){ confirmReveal = true; b.textContent = 'Toca otra vez para confirmar: ya no podrás sumar puntos en este tablero'; b.classList.add('warn');
    clearTimeout(revealTimer); revealTimer = setTimeout(()=>{ if(confirmReveal && !S.revealed[S.day]){ confirmReveal = false; b.classList.remove('warn'); b.textContent = revealText(); } }, 5000);   // si no confirma, vuelve a su estado
    return; }
  S.revealed[S.day] = true; save(); confirmReveal=false; renderAll();
  document.getElementById('pistasv').close();
  document.getElementById('found').open = true;   // las soluciones también quedan en la lista
  abrirResultados(S.day);
}

// ---------- compartir (nivel, palabras, Silabochos y racha; sin desvelar palabras) ----------
// El resultado del día d (el que se juega, o el de la ventana de resultados), en tres líneas como mucho y el enlace:
//   Silabocho nº 6 · Octosílabo
//   ▰▰▰▰▰▰▰▱ 12/28 palabras · ★ Silabocho          (o «★ ¡Tablero completo! 28/28 palabras»)
//   🔥 4 días
function shareText(d = S.day){ return enDia(d, ()=>{
  const k = rankIndex(), f = myFound(), n = stars().length, ks = stars().filter(x=>f.includes(x)).length;
  const visto = !!S.revealed[S.day], palabras = f.length+'/'+words().length+' palabras';
  let linea2;
  if(allFound() && !visto) linea2 = '★ ¡Tablero completo! '+palabras;   // el logro sustituye a la barra y a los Silabochos
  else {
    linea2 = RANKS.slice(1).map((r,j)=>j+1<=k?'▰':'▱').join('')+' '+palabras;
    if(ks) linea2 += n===1 ? ' · ★ Silabocho' : ' · ★ '+ks+'/'+n+' Silabochos';   // solo si se encontró alguno
  }
  const lineas = ['Silabocho nº '+S.day+' · '+RANKS[k][0], linea2];
  // la racha de hoy solo va con el tablero de hoy; un día pasado lleva la que había entonces, si se jugó en su día
  const r = d === today() ? rachaActual() : rachaHasta(d);
  if(r >= 1) lineas.push('🔥 '+r+(r===1?' día':' días'));
  lineas.push(URL_COMPARTIR);
  return lineas.join('\n');
}); }
// avisar(texto, bien): por defecto en el hueco de la palabra; desde la ventana de resultados, en su botón
async function share(d = S.day, avisar = (m, ok)=>toast(m, ok?'good':'bad')){
  const text = shareText(d);
  if(navigator.share && matchMedia('(pointer: coarse)').matches){
    try{ await navigator.share({text}); return; }
    catch(e){ if(e && e.name==='AbortError') return; }
  }
  try{ await navigator.clipboard.writeText(text); avisar('Resultado copiado. ¡Pégalo donde quieras!', true); return; }
  catch(e){}
  const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly',''); ta.style.position='fixed'; ta.style.opacity='0';
  document.body.appendChild(ta); ta.select();
  let ok = false; try{ ok = document.execCommand('copy'); }catch(e){}
  ta.remove();
  avisar(ok ? 'Resultado copiado. ¡Pégalo donde quieras!' : 'No se ha podido copiar el resultado', ok);
}

function renderAll(){
  const b = document.getElementById('reveal'); confirmReveal=false; b.classList.remove('warn');
  b.textContent = revealText();
  b.classList.toggle('visto', !!S.revealed[S.day]); b.disabled = !!S.revealed[S.day];
  S.cur=''; renderNav(); renderRose(); renderVerse(); renderScore(); renderWords(); renderClock(); renderRacha();
}

function start(){
  load(); depurar(); S.day = today();
  if(!Object.keys(S.racha).length && (S.found[S.day]||[]).length) S.racha[S.day] = 1;   // progreso anterior a la racha
  const cal = document.getElementById('calendario');
  document.getElementById('pasados').onclick = ()=>abrirCal();
  document.getElementById('cal-prev').onclick = ()=>moverMes(-1);
  document.getElementById('cal-next').onclick = ()=>moverMes(1);
  document.getElementById('cal-cerrar').onclick = ()=>cal.close();
  // un día pasado ya cerrado abre sus resultados encima del calendario (al cerrarlos se sigue en él); el resto, su tablero
  const tocarDia = e=>{ const b = e.target.closest('[data-dia]'); if(!b) return; const d = +b.dataset.dia;
    if(conResultados(d)) return abrirResultados(d); cal.close(); irA(d); };
  document.getElementById('cal-grid').onclick = tocarDia;
  const reglas = document.getElementById('reglas'), rangos = document.getElementById('rangos'), pistasv = document.getElementById('pistasv');
  document.getElementById('pistas').onclick = abrirPistas;
  const noche = document.getElementById('modo-noche');
  noche.checked = document.documentElement.getAttribute('data-theme') === 'dark';
  noche.onchange = ()=>cambiarTema(noche.checked);
  document.getElementById('pistas-cerrar').onclick = ()=>pistasv.close();
  document.getElementById('tab-cal').onclick = ()=>pestana('cal');
  document.getElementById('tab-sil').onclick = ()=>pestana('sil');
  document.getElementById('tab-est').onclick = ()=>pestana('est');
  document.getElementById('sil-lista').onclick = tocarDia;
  document.getElementById('estrella').onclick = ()=>abrirCal('sil');   // atajo: el distintivo de Silabochos abre el Silabochario
  document.getElementById('rank').onclick = abrirRangos;
  document.getElementById('rangos-cerrar').onclick = ()=>rangos.close();
  document.getElementById('volver').onclick = volverHoy;
  document.getElementById('otrodia-ver').onclick = verDia;
  document.getElementById('resumen-ver').onclick = verAyer;
  document.getElementById('resumen-seguir').onclick = seguirAyer;
  const resultados = document.getElementById('resultados');
  document.getElementById('res-cerrar').onclick = ()=>resultados.close();
  // compartir el día de la ventana; el aviso sale en el propio botón, porque la ventana tapa el hueco de la palabra
  const compartir = document.getElementById('res-compartir');
  compartir.onclick = ()=>share(diaResultados, (m, ok)=>{ compartir.textContent = ok ? '¡Copiado!' : 'No se ha podido copiar';
    clearTimeout(compartir.plazo); compartir.plazo = setTimeout(()=>{ compartir.textContent = 'Compartir'; }, 2200); });
  document.getElementById('resumen-cerrar').onclick = cerrarResumen;
  document.getElementById('ayuda').onclick = abrirReglas;
  document.getElementById('reglas-cerrar').onclick = ()=>reglas.close();
  [cal, reglas, rangos, pistasv, resultados].forEach(d=>d.addEventListener('click', e=>{ if(e.target===d) d.close(); }));   // tocar fuera las cierra
  document.getElementById('del').onclick = ()=>{ S.cur = ''; renderVerse(); };   // borra la palabra entera
  document.getElementById('shuffle').onclick = e=>{ const btn = e.currentTarget; btn.classList.remove('gira'); void btn.offsetWidth; btn.classList.add('gira'); const o=outer(); for(let i=o.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[o[i],o[j]]=[o[j],o[i]];} moverFichas(); };
  document.getElementById('send').onclick = submit;
  document.getElementById('reveal').onclick = reveal;
  document.getElementById('share').onclick = ()=>share();
  document.getElementById('racha').onclick = toastRacha;
  document.addEventListener('keydown',e=>{
    if(e.target.closest && e.target.closest('summary')) return;
    if(cal.open || reglas.open || rangos.open || pistasv.open || resultados.open) return;
    if(e.key==='Enter'){ e.preventDefault(); submit(); }   // las palabras se forman solo tocando sílabas; Intro las envía
  });
  // cambio de día con la app abierta: se comprueba cada segundo (con el reloj) y al volver a la app.
  // Si se estaba jugando el tablero de hoy, se pasa al nuevo; si se jugaba uno pasado, se queda en él.
  let ultimoHoy = S.day;
  const cambioDeDia = ()=>{
    const t = today(); if(t===ultimoHoy) return;
    if(S.day===ultimoHoy){ tickClock(); save(); S.day = t; renderAll(); toast('¡Nuevo tablero del día!', 'star'); }
    else { renderNav(); renderRacha(); }
    ultimoHoy = t; quizaResumen();
  };
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState!=='visible'){ tickClock(); save(); renderClock(); return; }
    lastTick = performance.now(); cambioDeDia();
  });
  window.addEventListener('pagehide', ()=>{ tickClock(); save(); });
  lastTick = performance.now(); setInterval(()=>{ tickClock(); cambioDeDia(); }, 1000);
  renderAll(); quizaResumen(); quizaInstalar();
  document.getElementById('instalar-cerrar').onclick = ()=>{ document.getElementById('instalar').hidden = true; };
  document.getElementById('instalar-boton').onclick = instalar;
}

// ---------- portada ----------
// Se queda lo justo para ver caer la arena (o menos si se toca) y se va cuando el juego está listo.
const portada = document.getElementById('portada');
const T0 = performance.now(), DURA = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1000 : 2800;
let listo = false, tocada = false;
function quitarPortada(){
  if(!portada || portada.classList.contains('fuera')) return;
  portada.classList.add('fuera');
  if(listo) quizaReglas();
  setTimeout(()=>portada.remove(), 500);
}
function quizaQuitarPortada(){ if(listo && (tocada || performance.now()-T0 >= DURA)) quitarPortada(); }
if(portada){
  portada.addEventListener('click', ()=>{ tocada = true; quizaQuitarPortada(); });
  setTimeout(quizaQuitarPortada, DURA);
}

fetch('data/tableros.json').then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); })
  .then(data=>{ BOARDS = data; start(); listo = true; quizaQuitarPortada(); })
  .catch(()=>{ quitarPortada(); document.getElementById('verse').innerHTML = '<span class="ph">No se han podido cargar los tableros. Comprueba la conexión y vuelve a intentarlo.</span>'; });

if('serviceWorker' in navigator) window.addEventListener('load',()=>{ navigator.serviceWorker.register('sw.js').catch(()=>{}); });
