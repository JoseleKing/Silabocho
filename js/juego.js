'use strict';
// Silabocho: un tablero por día. El día 1 es el 4 de octubre de 2026; si hay menos tableros
// que días, se vuelve a empezar por el primero.

const RANKS = [["Bisílabo",0],["Trisílabo",.05],["Tetrasílabo",.12],["Pentasílabo",.22],["Hexasílabo",.35],["Heptasílabo",.5],["Octosílabo",.7],["Alejandrino",1]];
const START = Date.UTC(2026, 9, 4);
const URL_JUEGO = 'https://joseleking.github.io/Silabocho/';
const STORE = 'silabocho-v1';
const pointsFor = n => n<=2?1:n===3?2:n===4?4:6;

let BOARDS = [];
let S = {day:1, found:{}, cur:[], order:{}, revealed:{}, time:{}, racha:{}};   // time: segundos jugados por día; racha: días jugados en su día

function load(){ try{ const s = JSON.parse(localStorage.getItem(STORE)||'null'); if(s){S.found=s.found||{};
  // antes había «palabras extra» aparte; ahora son del tablero, así que pasan a las halladas
  Object.entries(s.extra||{}).forEach(([d,ws])=>{ const f = S.found[d] || (S.found[d]=[]); ws.forEach(x=>{ if(!f.includes(x)) f.push(x); }); });
  S.revealed=s.revealed||{};S.time=s.time||{};S.racha=s.racha||{};} }catch(e){} }
function save(){ try{ localStorage.setItem(STORE, JSON.stringify({found:S.found,revealed:S.revealed,time:S.time,racha:S.racha})); }catch(e){} }

// número de día según la fecha local (el 4 de octubre de 2026 es el 1)
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
// Alejandrino solo si están todas las palabras del tablero
function rankIndex(){ if(allFound()) return RANKS.length-1; const frac = score()/total(); let k = 0; RANKS.forEach((r,i)=>{ if(frac>=r[1]-1e-9) k=i; }); return Math.min(k, RANKS.length-2); }

// ---------- reloj: tiempo jugado en cada tablero ----------
// Empieza al tocar la primera sílaba, solo corre con la app a la vista y se para al
// completar el tablero (Alejandrino) o al ver las soluciones.
const finished = () => !!S.revealed[S.day] || allFound();
const fmtTime = sec => { sec = Math.floor(sec); const m = Math.floor(sec/60), r = sec%60; return m+':'+(r<10?'0':'')+r; };
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
function rachaActual(){ const t = today(); let d = S.racha[t] ? t : t-1, n = 0; while(d >= 1 && S.racha[d]){ n++; d--; } return n; }
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
  b.textContent = s; b.style.left = x+'%'; b.style.top = y+'%';
  b.setAttribute('aria-label','Sílaba '+s+(isCenter?' (central)':''));
  b.addEventListener('click',()=>{ startClock(); S.cur.push(s); renderVerse(); toast(''); });
  return b;
}
function renderRose(){
  const r = document.getElementById('rose'); r.innerHTML='';
  r.appendChild(tileEl(B().central, true, 50, 50));
  outer().forEach((s,i)=>{ const a = (-90 + i*360/7)*Math.PI/180; r.appendChild(tileEl(s,false,50+36*Math.cos(a),50+36*Math.sin(a))); });
}
function renderVerse(){
  const v = document.getElementById('verse');
  if(!S.cur.length){ v.innerHTML = '<span class="ph">Toca las sílabas para formar una palabra</span>'; return; }
  v.innerHTML = S.cur.map(s=>'<span'+(s===B().central?' class="c"':'')+'>'+s+'</span>').join('<span class="dot">·</span>');
}
function renderScore(){
  const k = rankIndex();
  document.getElementById('rankname').textContent = RANKS[k][0];
  document.getElementById('pts').textContent = score()+' de '+total()+' puntos';
  document.getElementById('meter').innerHTML = RANKS.map((r,i)=>'<span class="'+(i<=k?'on':'')+(i===RANKS.length-1?' last':'')+'" title="'+r[0]+'"></span>').join('');
}
function renderWords(){
  const f = myFound(), list = document.getElementById('words'), rev = S.revealed[S.day];
  document.getElementById('foundcount').textContent = f.length+(f.length===1?' palabra':' palabras');
  document.getElementById('foundtotal').textContent = 'de '+words().length;
  // línea plegada: las últimas que has encontrado, de la más reciente a la más antigua
  document.getElementById('ultimas').textContent = rev ? 'Soluciones a la vista' : f.length ? f.slice().reverse().join(', ') : '';
  // distintivo de los Silabochos: hallados o pendientes (sin decir cuáles son)
  const n = stars().length, k = stars().filter(x=>f.includes(x)).length, est = document.getElementById('estrella');
  if(n===1) est.textContent = k ? '★ Silabocho hallado' : '☆ Silabocho pendiente';
  else est.textContent = (k===n ? '★ Silabochos hallados' : (k ? '★ ' : '☆ ')+'Silabochos pendientes')+' · '+k+' de '+n;
  est.className = 'estrella' + (k===n ? ' si' : k ? ' medio' : '');
  est.setAttribute('aria-label', n===1 ? (k ? 'Has encontrado el Silabocho' : 'Aún no has encontrado el Silabocho')
    : 'Has encontrado '+k+' de '+n+' Silabochos');
  // un grupo por número de sílabas (de menos a más), con «halladas/total»; dentro, orden alfabético
  const grupos = {};
  words().forEach(w=>{ const n = sylls(w).length; (grupos[n] = grupos[n] || []).push(w); });
  const vacio = !f.length && !rev ? '<span class="empty">Aún no has encontrado ninguna. Empieza por las de dos sílabas.</span>' : '';
  list.innerHTML = vacio + Object.keys(grupos).map(Number).sort((a,b)=>a-b).map(n=>{
    const todas = grupos[n], halladas = todas.filter(w=>f.includes(w[0])).length;
    const shown = (rev ? todas : todas.filter(w=>f.includes(w[0]))).sort((a,b)=>a[0].localeCompare(b[0],'es'));
    const chips = shown.map(w=>{
      const x = w[0], cls = isStar(x)?' star':(!f.includes(x)?' missed':'');
      return '<span class="w'+cls+'">'+w[1].split('-').join('·')+(isStar(x)?' ★':'')+'</span>'; }).join('');
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
}

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
    const desc = 'nº '+d+(d===t?', hoy':'')+(e.completo?', Alejandrino':e.jugado?', jugado':'')+(e.visto?', soluciones vistas':'');
    html += '<button class="cal-dia'+cls+'" type="button" data-dia="'+d+'" aria-label="'+n+' de '+primero.toLocaleDateString('es-ES',{month:'long'})+', '+desc+'"'+(d===S.day?' aria-current="date"':'')+'>'+n+'</button>';
  }
  document.getElementById('cal-grid').innerHTML = html;
}
// ---------- reglas ----------
const REGLAS_VISTAS = 'silabocho-reglas-vistas';
function abrirReglas(){ const d = document.getElementById('reglas'); if(d.open) return; d.showModal(); document.getElementById('reglas-cerrar').focus({focusVisible:false}); }
// la primera vez que se juega, las reglas se abren solas al irse la portada
function quizaReglas(){ try{ if(localStorage.getItem(REGLAS_VISTAS)) return; localStorage.setItem(REGLAS_VISTAS, '1'); }catch(e){ return; } abrirReglas(); }

function abrirCal(){ const f = dateOf(S.day); calMes = {y:f.getFullYear(), m:f.getMonth()}; renderCal(); document.getElementById('calendario').showModal();
  const a = document.querySelector('.cal-dia.actual'); if(a) a.focus({focusVisible:false}); }
function moverMes(k){ const d = new Date(calMes.y, calMes.m+k, 1); calMes = {y:d.getFullYear(), m:d.getMonth()}; renderCal(); }
function irA(n){ n = Math.min(today(), Math.max(1, n)); if(n===S.day) return; tickClock(); save(); S.day = n; toast(''); renderAll(); }

let tt;
function toast(msg, kind){ const t = document.getElementById('toast'); t.textContent = msg; t.className = 'toast'+(kind?' '+kind:''); clearTimeout(tt); if(msg) tt=setTimeout(()=>{t.textContent='';},2200); }

function submit(){
  const cur = S.cur; if(!cur.length) return;
  const joined = cur.join('');
  const clear = ()=>{ S.cur=[]; renderVerse(); };
  if(cur.length<2){ toast('Tiene que tener al menos dos sílabas','bad'); return clear(); }
  if(!cur.includes(B().central)){ toast('Falta la sílaba central','bad'); return clear(); }
  const w = words().find(y=>y[0]===joined && y[1]===cur.join('-'));
  if(!w){ toast('No está en la lista','bad'); return clear(); }
  if(myFound().includes(joined)){ toast('Ya la tenías','bad'); return clear(); }
  if(S.revealed[S.day]){ toast('Las soluciones ya están a la vista','bad'); return clear(); }
  const antes = rankIndex();
  myFound().push(joined);
  if(S.day===today()){ S.racha[S.day] = 1; renderRacha(); }   // jugado en su día: cuenta para la racha
  save();
  const n = cur.length, pts = wordPoints(w), k = rankIndex();
  if(isStar(joined)) toast('¡Silabocho! +'+pts,'star');
  else if(k>antes) toast('+'+pts+' · ¡Ya eres '+RANKS[k][0]+'!','star');
  else toast((n>=4?'¡Muy bien! ':'')+'+'+pts,'good');
  if(finished()) save();
  if(!confirmReveal) document.getElementById('reveal').textContent = revealText();
  clear(); renderScore(); renderWords(); renderClock();
}
let confirmReveal = false, revealTimer;
// si aún faltan palabras, ver las soluciones es rendirse
const revealText = () => S.revealed[S.day] ? 'Soluciones a la vista' : allFound() ? 'Ver soluciones' : 'Rendirse y ver soluciones';
function reveal(){
  const b = document.getElementById('reveal');
  if(S.revealed[S.day]) return;
  if(!confirmReveal){ confirmReveal = true; b.textContent = 'Toca otra vez para confirmar: ya no podrás sumar puntos en este tablero'; b.classList.add('warn');
    clearTimeout(revealTimer); revealTimer = setTimeout(()=>{ if(confirmReveal && !S.revealed[S.day]){ confirmReveal = false; b.classList.remove('warn'); b.textContent = revealText(); } }, 5000);   // si no confirma, vuelve a su estado
    return; }
  S.revealed[S.day] = true; save(); confirmReveal=false; renderAll();
  document.getElementById('found').open = true;   // las soluciones están en la lista
}

// ---------- compartir (rango y puntos, sin palabras) ----------
function shareText(){
  const k = rankIndex(), f = myFound(), n = stars().length, ks = stars().filter(x=>f.includes(x)).length;
  const star = !ks ? '' : n===1 ? ' ★' : ' ★ '+ks+'/'+n;
  const barra = RANKS.map((r,i)=>i<=k?'▰':'▱').join('');
  const lineas = [
    'Silabocho nº '+S.day+' · '+RANKS[k][0],
    barra+'  '+score()+'/'+total()+' puntos'+' · '+f.length+(f.length===1?' palabra':' palabras')+star,
  ];
  const r = rachaActual(), extra = [];
  if(S.time[S.day] !== undefined) extra.push('⏳ '+fmtTime(S.time[S.day]));
  if(r >= 1) extra.push('🔥 '+r+(r===1?' día':' días'));
  if(extra.length) lineas.push(extra.join(' · '));
  if(S.revealed[S.day]) lineas.push('(con las soluciones a la vista)');
  lineas.push(URL_JUEGO);
  return lineas.join('\n');
}
async function share(){
  const text = shareText();
  if(navigator.share && matchMedia('(pointer: coarse)').matches){
    try{ await navigator.share({text}); return; }
    catch(e){ if(e && e.name==='AbortError') return; }
  }
  try{ await navigator.clipboard.writeText(text); toast('Resultado copiado. ¡Pégalo donde quieras!','good'); return; }
  catch(e){}
  const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly',''); ta.style.position='fixed'; ta.style.opacity='0';
  document.body.appendChild(ta); ta.select();
  let ok = false; try{ ok = document.execCommand('copy'); }catch(e){}
  ta.remove();
  toast(ok ? 'Resultado copiado. ¡Pégalo donde quieras!' : 'No se ha podido copiar el resultado', ok?'good':'bad');
}

function renderAll(){
  const b = document.getElementById('reveal'); confirmReveal=false; b.classList.remove('warn');
  b.textContent = revealText();
  b.classList.toggle('visto', !!S.revealed[S.day]); b.disabled = !!S.revealed[S.day];
  S.cur=[]; renderNav(); renderRose(); renderVerse(); renderScore(); renderWords(); renderClock(); renderRacha();
}

function start(){
  load(); S.day = today();
  if(!Object.keys(S.racha).length && (S.found[S.day]||[]).length) S.racha[S.day] = 1;   // progreso anterior a la racha
  const cal = document.getElementById('calendario');
  document.getElementById('pasados').onclick = abrirCal;
  document.getElementById('cal-prev').onclick = ()=>moverMes(-1);
  document.getElementById('cal-next').onclick = ()=>moverMes(1);
  document.getElementById('cal-cerrar').onclick = ()=>cal.close();
  document.getElementById('cal-grid').onclick = e=>{ const b = e.target.closest('[data-dia]'); if(!b) return; cal.close(); irA(+b.dataset.dia); };
  const reglas = document.getElementById('reglas');
  document.getElementById('ayuda').onclick = abrirReglas;
  document.getElementById('reglas-cerrar').onclick = ()=>reglas.close();
  [cal, reglas].forEach(d=>d.addEventListener('click', e=>{ if(e.target===d) d.close(); }));   // tocar fuera las cierra
  document.getElementById('del').onclick = ()=>{ S.cur.pop(); renderVerse(); };
  document.getElementById('shuffle').onclick = e=>{ const btn = e.currentTarget; btn.classList.remove('gira'); void btn.offsetWidth; btn.classList.add('gira'); const o=outer(); for(let i=o.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[o[i],o[j]]=[o[j],o[i]];} renderRose(); };
  document.getElementById('send').onclick = submit;
  document.getElementById('reveal').onclick = reveal;
  document.getElementById('share').onclick = share;
  document.getElementById('racha').onclick = toastRacha;
  document.addEventListener('keydown',e=>{
    if(e.target.closest && e.target.closest('summary')) return;
    if(cal.open || reglas.open) return;
    if(e.key==='Enter'){ e.preventDefault(); submit(); }
    else if(e.key==='Backspace'){ S.cur.pop(); renderVerse(); }
  });
  // si la app queda abierta y cambia el día, al volver a ella se pasa al tablero nuevo
  let ultimoHoy = S.day;
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState!=='visible'){ tickClock(); save(); renderClock(); return; }
    lastTick = performance.now();
    const t = today(); if(t===ultimoHoy) return;
    if(S.day===ultimoHoy){ S.day = t; renderAll(); } else { renderNav(); renderRacha(); }
    ultimoHoy = t;
  });
  window.addEventListener('pagehide', ()=>{ tickClock(); save(); });
  lastTick = performance.now(); setInterval(tickClock, 1000);
  renderAll();
}

// ---------- portada ----------
// Se queda lo justo para ver caer la arena (o menos si se toca) y se va cuando el juego está listo.
const portada = document.getElementById('portada');
const T0 = performance.now(), DURA = matchMedia('(prefers-reduced-motion: reduce)').matches ? 700 : 2000;
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
