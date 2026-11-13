import { Mall, TRANSITION, fmtDist, fmtTime, norm } from './graph.js';
import { MapView, svgEl } from './mapview.js';

const $ = (s) => document.querySelector(s);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const DRAFT_KEY = 'sawgrass.draft';
const MARK_KEY = 'sawgrass.marcadas';
const NAME_KEY = 'sawgrass.nome';
const GROUP_KEY = 'sawgrass.grupo';
// banco do grupo (Firebase Realtime Database, via REST + eventos; sem biblioteca)
const DB_URL = 'https://sawgrass-58fe7-default-rtdb.firebaseio.com';
const GROUP_TTL = 24 * 3600 * 1000;
const MEET_KEY = 'sawgrass.encontro';
const CAR_KEY = 'sawgrass.carro';
const ICON = {
  start: '●', straight: '↑', right: '↱', left: '↰', 'slight-right': '↗', 'slight-left': '↖',
  uturn: '↶', arrive: '⚑',
};

const state = { meet: null, meetTime: '', car: null, shared: null, from: null, to: null, floor: null, route: null, step: 0, picked: null, accessible: false, open: false };
let mall, view, layers, picking = 'from', group = '';
let cullRaf = 0;
// shopping de piso único: esconde seletor e referências ao piso
const multi = () => mall.floors.length > 1;
const markers = [];
// lojas marcadas na busca (destaque no mapa); guardadas no aparelho
const marked = new Set();
const saveMarked = () => { try { localStorage.setItem(MARK_KEY, JSON.stringify([...marked])); } catch { /* sem armazenamento */ } };
// GPS: posição atual no mapa { x, y, acc (m), near (POI mais próxima), inside }
const gps = { watch: null, me: null, centered: false, heading: null };
// "Minha posição": ponto de interesse virtual usado como origem da rota quando o GPS está ligado
// carro: ponto virtual; a rota termina na saída do estacionamento escolhido e uma linha leva até o carro
const CAR = { id: '__car', name: '🚗 Meu carro', group: 'Carro', cat: 'Carro', f: null, x: 0, y: 0, node: null };
const ME = { id: '__gps', name: '📍 Minha posição', gps: true, group: 'GPS', cat: 'GPS', f: null, x: 0, y: 0, node: null };
// aberto dentro de outro app (ex.: visualizador do Claude), onde o GPS fica bloqueado
const framed = (() => { try { return window.top !== window; } catch { return true; } })();
const WEB_URL = 'https://guedesgil822-sys.github.io/Mapa-Sawgrass/';

async function init() {
  const useDraft = new URLSearchParams(location.search).has('draft') && localStorage.getItem(DRAFT_KEY);
  if (useDraft) {
    mall = new Mall(JSON.parse(localStorage.getItem(DRAFT_KEY)));
    $('#draft-flag').hidden = false;
  } else {
    mall = await Mall.load('data/mall.json');
  }

  view = new MapView($('#map'));
  layers = {
    hit: svgEl('g', {}, view.svg),
    sel: svgEl('g', {}, view.svg),
    route: svgEl('g', {}, view.svg),
    labels: svgEl('g', {}, view.svg),
  };
  view.onChange = () => { if (gps.heading != null && gps.me) drawRoute(); else placeMarkers(); cullLabels(); };
  view.onTap = onMapTap;

  buildFloors();
  $('#accessible').closest('label').hidden = !multi(); // sem escadas para evitar
  buildGroups();
  bindUI();

  const h = new URLSearchParams(location.hash.slice(1));
  state.from = mall.poiById.get(h.get('de')) || null;
  state.to = mall.poiById.get(h.get('para')) || null;
  state.accessible = h.get('acessivel') === '1';
  $('#accessible').checked = state.accessible;

  try { for (const id of JSON.parse(localStorage.getItem(MARK_KEY) || '[]')) if (mall.poiById.has(id)) marked.add(id); } catch { /* ignora */ }
  loadMeetCar();
  readShared(h);
  resumeGroup(h.get('g'));

  setFloor(state.from?.f || mall.floors[0].id, false);
  update(true);
  renderMarked();
  renderStatus();
  setInterval(renderStatus, 30000);
  if (state.shared) { // enquadra tudo o que foi compartilhado
    const pts = [state.meet, state.shared.who, ...state.shared.marks.map((id) => mall.poiById.get(id))].filter(Boolean);
    requestAnimationFrame(() => { const m = 25 * mall.ppm; fitPoints(pts.flatMap((p) => [{ x: p.x - m, y: p.y - m }, { x: p.x + m, y: p.y + m }])); });
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

/* ---------- interface ---------- */
function bindUI() {
  $('#f-from').onclick = () => openPicker('from');
  $('#f-to').onclick = () => openPicker('to');
  $('#search-pill').onclick = () => openPicker('to');
  $('#trip-clear').onclick = () => { state.from = state.to = null; state.picked = null; update(false); };
  $('#tab-map').onclick = () => { state.picked = null; update(false); fitCurrent(); };
  $('#tab-find').onclick = () => openPicker('find');
  $('#tab-meet').onclick = () => openMeet();
  $('#tab-car').onclick = () => openCar();
  $('#tab-share').onclick = openGroup;
  bindGroup();
  // aba acesa = janela aberta no momento (ou Mapa)
  const TAB_OF = { picker: 'tab-find', meet: 'tab-meet', car: 'tab-car', share: 'tab-share', group: 'tab-share' };
  const syncTabs = () => {
    const open = Object.keys(TAB_OF).find((d) => $('#' + d).open && (d !== 'picker' || picking === 'find'));
    for (const b of $('#tabbar').children) b.classList.toggle('on', b.id === (open ? TAB_OF[open] : 'tab-map'));
  };
  for (const d of Object.keys(TAB_OF)) {
    new MutationObserver(syncTabs).observe($('#' + d), { attributes: true, attributeFilter: ['open'] });
  }
  // altura do painel inferior -> posição dos botões de zoom/GPS
  new ResizeObserver(() => {
    const sh = $('#sheet'), h = sh.hidden || innerWidth >= 760 ? 0 : sh.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--sheet-h', h + 'px');
  }).observe($('#sheet'));
  $('#mark-clear').onclick = () => { clearMarked(); renderResults(); };
  $('#marked-clear').onclick = clearMarked;
  $('#mark-show').onclick = () => { $('#picker').close(); showMarked(); };
  $('#marked-chip').onclick = showMarked;
  $('#meet-chip').onclick = () => openMeet();
  $('#car-chip').onclick = () => openCar();
  $('#mt-place').onclick = () => { $('#meet').close(); openPicker('meet'); };
  $('#mt-quick').onclick = (e) => { const m = +e.target.dataset?.min; if (m) $('#mt-time').value = hhmm(Date.now() + m * 60000); };
  $('#mt-save').onclick = saveMeet;
  $('#mt-del').onclick = () => { state.meet = null; state.meetTime = ''; persistMeet(); $('#meet').close(); };
  $('#mt-share').onclick = () => { $('#meet').close(); openShare(); };
  $('#car-gps').onclick = carFromGps;
  $('#car-save').onclick = saveCar;
  $('#car-del').onclick = () => { state.car = null; persistCar(); $('#car').close(); if (state.to === CAR) { state.to = null; update(false); } };
  $('#car-go').onclick = () => { $('#car').close(); goToCar(); };
  $('#sh-send').onclick = sendShare;
  $('#shared-close').onclick = () => { $('#shared-bar').hidden = true; };
  $('#shared-keep').onclick = () => {
    for (const id of state.shared?.marks || []) marked.add(id);
    saveMarked(); renderMarked(); $('#shared-keep').hidden = true;
  };
  $('#shared-gps').onclick = () => { state.to = state.meet; if (gps.watch == null) startGps(); else { gpsAsOrigin(); update(true); } };
  $('#swap').onclick = () => { [state.from, state.to] = [state.to, state.from]; update(true); };
  $('#accessible').onchange = (e) => { state.accessible = e.target.checked; update(true); };
  $('#zin').onclick = () => view.zoomBy(1.6);
  $('#zout').onclick = () => view.zoomBy(1 / 1.6);
  $('#gps').hidden = !mall.data.meta?.geo;
  $('#open-web').hidden = !framed;
  $('#open-web').onclick = (e) => { e.currentTarget.href = WEB_URL + location.hash; }; // leva a rota junto
  $('#gps').onclick = () => (gps.watch == null ? startGps() : stopGps()); // liga/desliga
  $('#gps-txt').onclick = () => gps.me && centerOnMe(); // tocar no texto recentraliza
  $('#gps-close').onclick = stopGps;
  $('#gps-use').onclick = () => {
    if (!gps.me) return;
    state.from = ME; state.picked = null; update(true);
  };
  $('#q').oninput = renderResults;
  $('#picker').addEventListener('close', () => { $('#q').value = ''; });
  addEventListener('resize', () => placeMarkers());
  // iOS ignora user-scalable=no: impede que a pinça amplie a página inteira (o mapa tem zoom próprio)
  for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
}

function buildFloors() {
  const nav = $('#floors');
  nav.hidden = !multi();
  for (const f of [...mall.floors].reverse()) {
    const b = el('button', '', f.id);
    b.type = 'button';
    b.dataset.f = f.id;
    b.title = f.name;
    b.onclick = () => setFloor(f.id, true);
    nav.appendChild(b);
  }
}

function buildGroups() {
  const box = $('#groups');
  const groups = ['', ...new Set(mall.pois.map((p) => p.group))].sort((a, b) => a.localeCompare(b, 'pt'));
  for (const g of groups) {
    const c = el('button', 'chip', g || 'Tudo');
    c.type = 'button';
    c.onclick = () => { group = g; $('#q').value = ''; [...box.children].forEach((x) => x.classList.toggle('on', x === c)); renderResults(); };
    if (!g) c.classList.add('on');
    box.appendChild(c);
  }
}

function openPicker(which) {
  picking = which;
  $('#q').placeholder = { from: 'Perto de qual loja você está?', to: 'Para onde você quer ir?',
    find: 'Buscar loja, serviço ou categoria', meet: 'Onde vão se encontrar?' }[which];
  // dica do que o toque faz em cada modo
  $('#mark-hint').textContent = {
    from: 'Toque na loja mais perto de você.',
    to: 'Toque numa loja para traçar a rota. Para marcar várias, use a aba Buscar.',
    find: 'Toque nas lojas para marcar ou desmarcar (✓). Elas ficam em destaque no mapa.',
    meet: 'Toque no lugar do encontro.',
  }[which];
  $('#mark-hint').hidden = false;
  renderResults();
  $('#picker').showModal();
  // no celular o teclado cobre metade da lista: só abre se a pessoa tocar na busca
  if (!matchMedia('(pointer: coarse)').matches) $('#q').focus();
  else $('#results').scrollTop = 0;
}

function renderResults() {
  renderMarkBar();
  const ul = $('#results');
  ul.textContent = '';
  const q = $('#q').value.trim();
  let list = mall.search(q, group);
  if (!list.length) {
    ul.appendChild(el('li', 'empty', group && q ? `Nada com “${q}” em ${group}.` : 'Nada encontrado.'));
    return;
  }
  // sem busca: ordem alfabética com uma divisória por letra (A, B, C…)
  if (!q) list = [...list].sort((a, b) => sortKey(a).localeCompare(sortKey(b), 'pt'));
  ul.appendChild(el('li', 'count', `${list.length} ${list.length === 1 ? 'lugar' : 'lugares'}`));
  let letter = null;
  for (const p of list) {
    if (!q) {
      const k = sortKey(p)[0]?.toUpperCase() || '#';
      const l = /[A-Z]/.test(k) ? k : '#';
      if (l !== letter) { letter = l; ul.appendChild(el('li', 'sec', l)); }
    }
    const li = el('li');
    li.tabIndex = 0;
    const box = el('div');
    box.append(el('div', 'n', p.name), el('div', 'c', p.cat || p.group));
    li.append(box);
    if (multi()) li.append(el('span', 'f', p.f));
    if (picking === 'find') {
      const on = marked.has(p.id);
      li.classList.toggle('on', on);
      li.setAttribute('role', 'checkbox');
      li.setAttribute('aria-checked', String(on));
      li.append(el('span', 'chk', on ? '✓' : ''));
    }
    const pick = () => {
      if (picking === 'find') {
        toggleMarked(p);
        const on = marked.has(p.id);
        li.classList.toggle('on', on);
        li.setAttribute('aria-checked', String(on));
        li.querySelector('.chk').textContent = on ? '✓' : '';
        return;
      }
      $('#picker').close();
      if (picking === 'meet') { meetDraft = p; return openMeet(p); }
      state[picking] = p; state.picked = null;
      if (picking === 'to') gpsAsOrigin();
      update(true);
    };
    li.onclick = pick;
    li.onkeydown = (e) => { if (e.key === 'Enter') pick(); };
    ul.appendChild(li);
  }
}

// "The Sports Authority" fica no S; acentos não mudam a ordem
/* ---------- lojas marcadas ---------- */
function toggleMarked(p) {
  if (marked.has(p.id)) marked.delete(p.id); else marked.add(p.id);
  saveMarked(); renderMarkBar(); renderMarked();
}

function clearMarked() {
  marked.clear();
  saveMarked(); renderMarkBar(); renderMarked();
}

function renderMarkBar() {
  const n = marked.size, bar = $('#mark-bar');
  bar.hidden = picking !== 'find' || !n;
  $('#mark-show').textContent = `Ver no mapa (${n})`;
}

function renderMarked() {
  const n = marked.size;
  renderStatus();
  $('#marked-chip').hidden = $('#marked-clear').hidden = !n;
  $('#marked-chip').textContent = `★ ${n} ${n === 1 ? 'marcada' : 'marcadas'}`;
  drawRoute();
}

function showMarked() {
  const ps = [...marked].map((id) => mall.poiById.get(id)).filter(Boolean);
  if (!ps.length) return;
  if (!ps.some((p) => p.f === state.floor)) setFloor(ps[0].f, false);
  state.picked = null; update(false);
  fitPoints(ps.filter((p) => p.f === state.floor), 60 * mall.ppm);
}

const sortKey = (p) => norm(p.name.replace(/^the\s+/i, ''));

/** Mostra uma loja em destaque: vai até ela, pinta o contorno e abre as ações. */
function showPoi(p) {
  state.picked = p;
  if (state.floor !== p.f) setFloor(p.f, false);
  update(false);
  let pts = [{ x: p.x, y: p.y }];
  if (p.poly?.length >= 6) pts = p.poly.reduce((a, v, i) => (i % 2 ? a[a.length - 1].y = v : a.push({ x: v, y: 0 }), a), []);
  fitPoints(pts, 90 * mall.ppm);
}

/* ---------- piso ---------- */
function setFloor(fid, refit) {
  const f = mall.floorById.get(fid);
  if (!f) return;
  const changed = state.floor !== fid;
  state.floor = fid;
  if (changed) {
    view.setFloor(f.image, f.width, f.height);
    drawFloor(f);
  }
  for (const b of $('#floors').children) b.setAttribute('aria-pressed', b.dataset.f === fid);
  drawRoute();
  if (refit) fitCurrent();
}

function drawFloor(f) {
  layers.hit.textContent = '';
  layers.labels.textContent = '';
  const dark = f.id === 'G1';
  for (const p of mall.pois) {
    if (p.f !== f.id) continue;
    let box;
    if (p.poly?.length >= 6) {
      const xs = p.poly.filter((_, i) => i % 2 === 0), ys = p.poly.filter((_, i) => i % 2);
      box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      const poly = svgEl('polygon', { points: p.poly.join(' '), class: 'poi-hit' }, layers.hit);
      poly.dataset.id = p.id;
    } else {
      box = [p.x - 22, p.y - 10, p.x + 22, p.y + 10];
    }
    if (p.label !== false) addLabel(p, box, dark); // nomes já impressos na planta ficam sem rótulo
  }
  cullLabels();
}

function addLabel(p, box, dark) {
  const name = p.name.replace(/\s*\((QUIOSQUE[^)]*|EM BREVE|\d+)\)/gi, '').trim();
  const w = (box[2] - box[0]) * 0.9, h = (box[3] - box[1]) * 0.85;
  const words = name.split(' ');
  let best = { fs: 0, lines: [name] };
  for (let n = 1; n <= Math.min(3, words.length); n++) {
    const lines = wrap(words, n);
    const longest = Math.max(...lines.map((l) => l.length));
    const fs = Math.min(w / (longest * 0.58), h / (lines.length * 1.15), 30);
    if (fs > best.fs) best = { fs, lines };
  }
  const fs = Math.max(best.fs, 3.5);
  const t = svgEl('text', { class: 'lbl' + (dark ? ' dark' : ''), x: p.x, 'font-size': fs.toFixed(1) }, layers.labels);
  const y0 = p.y - ((best.lines.length - 1) * fs * 1.1) / 2 + fs * 0.35;
  best.lines.forEach((l, i) => { svgEl('tspan', { x: p.x, y: (y0 + i * fs * 1.1).toFixed(1) }, t).textContent = l; });
  t._fs = fs;
}

function wrap(words, n) {
  if (n === 1) return [words.join(' ')];
  const target = words.join(' ').length / n, lines = [];
  let cur = '';
  for (const w of words) {
    if (cur && lines.length < n - 1 && (cur + ' ' + w).length > target + 2) { lines.push(cur); cur = w; }
    else cur = cur ? cur + ' ' + w : w;
  }
  lines.push(cur);
  return lines;
}

function cullLabels() {
  if (cullRaf) return;
  cullRaf = requestAnimationFrame(() => {
    cullRaf = 0;
    for (const t of layers.labels.children) t.style.display = t._fs * view.k >= 6.5 ? '' : 'none';
  });
}

/* ---------- toque no mapa ---------- */
function onMapTap(pt, ev, target) {
  let p = target?.dataset?.id ? mall.poiById.get(target.dataset.id) : null;
  if (!p) {
    let bd = 24 / view.k;
    for (const q of mall.pois) {
      if (q.f !== state.floor) continue;
      const d = Math.hypot(q.x - pt.x, q.y - pt.y);
      if (d < bd) { bd = d; p = q; }
    }
  }
  if (!p) { if (state.picked) { state.picked = null; update(false); } return; }
  state.picked = p;
  update(false);
}

/* ---------- estado → tela ---------- */
function update(refit) {
  setField('#f-from', state.from, 'Escolha a loja mais próxima');
  setField('#f-to', state.to, 'Escolha o destino');
  $('#trip').hidden = !(state.from || state.to);
  $('#search-pill').hidden = !$('#trip').hidden;

  state.route = null;
  if (state.from && state.to && state.from.id !== state.to.id) {
    state.route = mall.route(state.from.id, state.to.id, { accessible: state.accessible });
  }
  if (refit) state.step = 0;

  const h = new URLSearchParams();
  if (state.from && state.from !== ME) h.set('de', state.from.id);
  if (state.to && state.to !== CAR) h.set('para', state.to.id);
  if (state.accessible) h.set('acessivel', '1');
  history.replaceState(null, '', location.pathname + location.search + (h.size ? '#' + h : ''));

  const inRoute = new Set(state.route?.floors || []);
  for (const b of $('#floors').children) b.classList.toggle('in-route', inRoute.has(b.dataset.f));

  renderSheet();
  if (gps.me) renderGpsBar();
  if (refit) {
    const target = state.route ? state.route.steps[0].floor : (state.to || state.from)?.f;
    if (target) setFloor(target, true); else fitCurrent();
  } else {
    drawRoute();
  }
}

function setField(sel, poi, placeholder) {
  const b = $(sel);
  b.classList.toggle('set', !!poi);
  b.querySelector('span').textContent = poi ? (multi() ? `${poi.name} · ${poi.f}` : poi.name) : placeholder;
}

function renderSheet() {
  const s = $('#sheet');
  s.textContent = '';
  const p = state.picked;
  if (p) {
    const head = el('div', 'sheet-head');
    const g = el('div', 'grow');
    g.append(el('h2', '', p.name), el('p', '', [multi() && mall.floorById.get(p.f).name, p.cat || p.group].filter(Boolean).join(' · ')));
    const x = el('button', 'icon-btn', '✕');
    x.setAttribute('aria-label', 'Fechar');
    x.onclick = () => { state.picked = null; update(false); };
    head.append(g, x);
    const act = el('div', 'actions');
    const a = el('button', 'btn from', 'Estou aqui');
    a.onclick = () => { state.from = p; state.picked = null; update(true); };
    const b = el('button', 'btn primary', 'Ir para cá');
    b.onclick = () => { state.to = p; state.picked = null; gpsAsOrigin(); update(true); };
    act.append(a, b);
    const m = el('button', 'btn small', marked.has(p.id) ? '★ Desmarcar' : '☆ Marcar');
    m.onclick = () => { toggleMarked(p); renderSheet(); };
    const e = el('button', 'btn small', state.meet === p ? '🤝 Editar encontro' : '🤝 Encontro aqui');
    e.onclick = () => openMeet(p);
    const row = el('div', 'actions');
    row.append(m, e);
    s.append(head, act, row);
    s.hidden = false;
    return;
  }
  if (state.from && state.to && state.from.id === state.to.id) {
    s.append(el('p', 'empty', 'Origem e destino são o mesmo lugar.'));
    s.hidden = false;
    return;
  }
  if (state.from && state.to && !state.route) {
    s.append(el('p', 'empty', state.accessible
      ? 'Não encontrei rota sem escada rolante entre esses pontos. Desmarque a opção para ver outras rotas.'
      : 'Não encontrei caminho entre esses pontos no mapa.'));
    s.hidden = false;
    return;
  }
  const r = state.route;
  if (!r) { s.hidden = true; return; }

  const head = el('div', 'sheet-head');
  const g = el('div', 'grow');
  const fl = r.floors.filter((f, i) => f !== r.floors[i - 1]);
  g.append(
    el('h2', '', `${fmtTime(r.seconds)} · ${fmtDist(r.meters)}`),
    el('p', '', fl.length > 1 ? `Pisos: ${fl.join(' → ')}` : multi() ? `Tudo no piso ${fl[0]}` : 'A pé, sem trocar de piso'),
  );
  const prev = el('button', 'btn small', '‹');
  prev.setAttribute('aria-label', 'Passo anterior');
  const next = el('button', 'btn small primary', 'Próximo ›');
  prev.onclick = () => goStep(state.step - 1);
  next.onclick = () => goStep(state.step + 1);
  prev.disabled = state.step === 0;
  next.disabled = state.step === r.steps.length - 1;
  head.append(g, prev, next);

  const cur = r.steps[state.step];
  const now = el('div', 'now');
  const txt = el('div', 'txt', cur.text);
  if (cur.dist) txt.appendChild(el('small', '', `siga por ${fmtDist(cur.dist)}`));
  now.append(el('div', 'ico', stepIcon(cur)), txt);

  const ol = el('ol', 'steps');
  r.steps.forEach((st, i) => {
    const li = el('li', (i === state.step ? 'cur ' : '') + (st.kind === 'transition' ? 'floor-change' : ''));
    li.append(el('span', 'ico', stepIcon(st)));
    if (multi()) li.append(el('span', 'fl', st.floor));
    li.append(el('span', '', st.text));
    if (st.dist) li.append(el('span', 'd', fmtDist(st.dist)));
    li.onclick = () => goStep(i);
    ol.appendChild(li);
  });
  const more = el('button', 'more', state.open ? 'Ocultar passos' : `Ver os ${r.steps.length} passos`);
  more.onclick = () => { state.open = !state.open; renderSheet(); };
  ol.hidden = !state.open;
  s.append(head, now, more, ol);
  s.hidden = false;
  ol.querySelector('.cur')?.scrollIntoView({ block: 'nearest' });
}

const stepIcon = (st) => (st.kind === 'transition' ? (st.up ? '⬆' : '⬇') : ICON[st.kind] || '↑');

function goStep(i) {
  const r = state.route;
  if (!r || i < 0 || i >= r.steps.length) return;
  state.step = i;
  renderSheet();
  const st = r.steps[i];
  // ao chegar num passo de troca de piso, o mapa mostra onde ela fica
  if (st.floor !== state.floor) setFloor(st.floor, false); else drawRoute();
  fitPoints(st.pts, 18 * mall.ppm);
}

/* ---------- rota no mapa ---------- */
function drawRoute() {
  layers.route.textContent = '';
  layers.sel.textContent = '';
  markers.length = 0;
  const r = state.route;
  const mark = (p, cls) => {
    if (!p || p.f !== state.floor) return;
    if (p.poly?.length >= 6) svgEl('polygon', { points: p.poly.join(' '), class: 'poi-sel ' + cls }, layers.sel);
    markers.push({ x: p.x, y: p.y, cls });
  };
  for (const id of marked) {
    const p = mall.poiById.get(id);
    if (!p || p.f !== state.floor || p === state.from || p === state.to) continue;
    if (p.poly?.length >= 6) svgEl('polygon', { points: p.poly.join(' '), class: 'poi-sel mark' }, layers.sel);
    markers.push({ x: p.x, y: p.y, cls: 'mark', text: '★', title: p.name });
  }
  if (state.picked && state.picked !== state.from && state.picked !== state.to) {
    const p = state.picked;
    if (p.f === state.floor) {
      if (p.poly?.length >= 6) svgEl('polygon', { points: p.poly.join(' '), class: 'poi-sel pick' }, layers.sel);
      markers.push({ x: p.x, y: p.y, cls: 'pick' });
    }
  }
  if (r) {
    r.legs.forEach((leg, i) => {
      if (leg.floor !== state.floor || leg.pts.length < 1) return;
      const d = leg.pts.map((p) => `${p.x},${p.y}`).join(' ');
      if (leg.pts.length > 1) {
        svgEl('polyline', { points: d, class: 'route-case' }, layers.route);
        svgEl('polyline', { points: d, class: 'route-line' }, layers.route);
      }
      const nextLeg = r.legs[i + 1], prevLeg = r.legs[i - 1];
      if (nextLeg) {
        const up = mall.level(nextLeg.floor) > mall.level(leg.floor), a = leg.pts.at(-1);
        markers.push({ x: a.x, y: a.y, cls: 'hop', text: `${up ? '⬆' : '⬇'} ${nextLeg.floor}`, go: nextLeg.floor, title: TRANSITION[nextLeg.via]?.label });
      }
      if (prevLeg && leg.pts.length > 1) {
        const a = leg.pts[0];
        markers.push({ x: a.x, y: a.y, cls: 'hop', text: `← ${prevLeg.floor}`, go: prevLeg.floor });
      }
    });
    const st = r.steps[state.step];
    if (st && st.floor === state.floor && st.pts.length > 1) {
      svgEl('polyline', { points: st.pts.map((p) => `${p.x},${p.y}`).join(' '), class: 'route-step' }, layers.route);
    }
  }
  if (state.meet && state.meet.f === state.floor) {
    const p = state.meet;
    if (p.poly?.length >= 6 && p !== state.to) svgEl('polygon', { points: p.poly.join(' '), class: 'poi-sel meet' }, layers.sel);
    markers.push({ x: p.x, y: p.y, cls: 'meet' + (state.meetTime ? ' timed' : ''), text: state.meetTime ? `🤝 ${state.meetTime}` : '🤝', title: 'Ponto de encontro: ' + p.name });
  }
  if (state.car && CAR.f === state.floor) {
    const n = state.to === CAR && r && mall.nodes.get(CAR.node);
    if (n) svgEl('line', { x1: n.x, y1: n.y, x2: CAR.x, y2: CAR.y, class: 'car-link' }, layers.route);
    markers.push({ x: CAR.x, y: CAR.y, cls: 'car', text: '🚗', title: 'Meu carro' });
  }
  for (const [uid, p] of Object.entries(grp.data?.pos || {})) {
    if (uid === grp.uid || !p || Date.now() - p.ts > 15 * 60000 || !Number.isFinite(p.x)) continue;
    const t = new Date(p.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    markers.push({ x: p.x, y: p.y, cls: 'friend', text: `${p.n || 'Amigo'} · ${t}`, title: 'Posição no grupo' });
  }
  const fr = state.shared?.who;
  if (fr && fr.f === state.floor) markers.push({ x: fr.x, y: fr.y, cls: 'friend', text: `${fr.name || 'Amigo'}${fr.time ? ' · ' + fr.time : ''}`, title: 'Posição compartilhada' });
  if (state.from !== ME) mark(state.from, 'from');
  if (state.to !== CAR) mark(state.to, 'to');
  if (gps.me) {
    svgEl('circle', { cx: gps.me.x, cy: gps.me.y, r: Math.max(gps.me.acc, 3) * mall.ppm, class: 'gps-acc' }, layers.sel);
    const n = state.from === ME && r && mall.nodes.get(ME.node);
    if (n) svgEl('line', { x1: ME.x, y1: ME.y, x2: n.x, y2: n.y, class: 'gps-link' }, layers.route);
    const head = gps.heading != null ? mapHeading(gps.heading) : null;
    if (head != null) {
      // "graveto": cone claro + linha fina para onde o celular aponta (comprimento fixo na tela)
      const a = head * Math.PI / 180, L = 70 / view.k, w = 0.42;
      const tip = (ang, len) => `${gps.me.x + Math.sin(ang) * len},${gps.me.y - Math.cos(ang) * len}`;
      svgEl('polygon', { points: `${gps.me.x},${gps.me.y} ${tip(a - w, L)} ${tip(a + w, L)}`, class: 'gps-cone' }, layers.route);
      svgEl('line', { x1: gps.me.x, y1: gps.me.y, x2: gps.me.x + Math.sin(a) * L * 1.15, y2: gps.me.y - Math.cos(a) * L * 1.15, class: 'gps-stick' }, layers.route);
    }
    markers.push({ x: gps.me.x, y: gps.me.y, cls: 'me', title: 'Você está aqui' });
  }
  placeMarkers();
}

function placeMarkers() {
  const box = $('#markers');
  while (box.children.length > markers.length) box.lastChild.remove();
  markers.forEach((m, i) => {
    let d = box.children[i];
    if (!d) d = box.appendChild(document.createElement('div'));
    const tag = m.cls === 'hop' ? 'BUTTON' : 'DIV';
    if (d.tagName !== tag) { const n = document.createElement(tag); d.replaceWith(n); d = n; }
    d.className = 'mk ' + m.cls;
    d.textContent = m.text || '';
    d.title = m.title || '';
    d.onclick = m.go ? () => setFloor(m.go, true) : null;
    const s = view.toScreen(m.x, m.y);
    d.style.left = s.x + 'px';
    d.style.top = s.y + 'px';
  });
}

/* ---------- ferramentas: encontro e carro ---------- */
let meetDraft = null;
const hhmm = (t) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const store = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } };
const load = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };

// minutos até HH:MM de hoje (negativo = já passou)
function minsTo(t) {
  const [h, m] = t.split(':').map(Number), d = new Date();
  return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m) - d) / 60000);
}
function relTime(t) {
  const m = minsTo(t);
  if (m > 90) return `em ${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
  if (m > 1) return `em ${m} min`;
  if (m >= -1) return 'agora';
  return `há ${-m} min`;
}

function loadMeetCar() {
  const mt = load(MEET_KEY);
  if (mt && mall.poiById.has(mt.id)) { state.meet = mall.poiById.get(mt.id); state.meetTime = mt.time || ''; }
  const c = load(CAR_KEY);
  if (c && mall.poiById.has(c.lot)) { state.car = c; placeCar(); }
}

function persistMeet(fromGroup) {
  store(MEET_KEY, state.meet ? { id: state.meet.id, time: state.meetTime } : null); renderStatus(); drawRoute();
  if (!fromGroup && grp.code) dbReq('PUT', `grupos/${grp.code}/enc`, state.meet ? { id: state.meet.id, h: state.meetTime || '' } : null).catch(() => {});
}
function persistCar() { store(CAR_KEY, state.car); if (state.car) placeCar(); renderStatus(); drawRoute(); }

function placeCar() {
  const lot = mall.poiById.get(state.car.lot), c = state.car;
  Object.assign(CAR, { f: lot.f, x: c.x ?? lot.x, y: c.y ?? lot.y, node: lot.node,
    name: `🚗 Meu carro (${lot.name.replace(/^Estacionamento · /, '')})` });
  mall.poiById.set(CAR.id, CAR);
}

// chips de status no topo (encontro e carro), atualizados a cada 30 s
function renderStatus() {
  const mc = $('#meet-chip'), cc = $('#car-chip');
  mc.hidden = !state.meet;
  if (state.meet) mc.textContent = `🤝 ${state.meetTime ? `${state.meetTime} · ${relTime(state.meetTime)}` : state.meet.name}`;
  cc.hidden = !state.car;
  if (state.car) cc.textContent = `🚗 ${mall.poiById.get(state.car.lot).name.replace(/^Estacionamento · /, '')}`;
  mc.classList.toggle('late', !!state.meetTime && minsTo(state.meetTime) <= 5);
  $('#tab-meet-l').textContent = state.meet && state.meetTime ? state.meetTime : 'Encontro';
  $('#tab-car-b').hidden = !state.car;
  $('#tab-find-b').hidden = !marked.size;
  $('#tab-find-b').textContent = marked.size || '';
}


function openMeet(p) {
  if (p) meetDraft = p; else meetDraft = state.meet;
  $('#mt-place').textContent = meetDraft ? `📍 ${meetDraft.name}` : 'Escolher local';
  $('#mt-place').classList.toggle('set', !!meetDraft);
  if (!$('#mt-time').value || (!p && state.meetTime)) $('#mt-time').value = state.meetTime || hhmm(Date.now() + 30 * 60000);
  $('#mt-del').hidden = $('#mt-share').hidden = !state.meet;
  if (!$('#meet').open) $('#meet').showModal();
}

function saveMeet() {
  if (!meetDraft) { $('#mt-place').classList.add('need'); return; }
  state.meet = meetDraft; state.meetTime = $('#mt-time').value || '';
  persistMeet();
  $('#meet').close();
  state.picked = null; update(false);
  fitPoints([state.meet], 80 * mall.ppm);
}

const LOTS = () => mall.pois.filter((p) => p.group === 'Estacionamento');

function openCar() {
  const sel = $('#car-lot');
  if (!sel.options.length) {
    sel.append(new Option('Escolha…', ''));
    for (const p of LOTS()) sel.append(new Option(p.name.replace(/^Estacionamento · /, ''), p.id));
  }
  const c = state.car;
  sel.value = c?.lot || ''; $('#car-note').value = c?.note || '';
  carPos = c && c.x != null ? { x: c.x, y: c.y } : null;
  $('#car-info').hidden = !c;
  if (c) $('#car-info').textContent = `Salvo às ${hhmm(c.t)}${c.x != null ? ' pelo GPS' : ''}${c.note ? ' · ' + c.note : ''}`;
  $('#car-del').hidden = $('#car-go').hidden = !c;
  $('#car-gps').textContent = '📍 Usar minha posição agora (GPS)';
  if (!$('#car').open) $('#car').showModal();
}

let carPos = null, carWaiting = false;
function carFromGps() {
  if (!gps.me) {
    carWaiting = true;
    $('#car-gps').textContent = '⏳ Procurando sua posição…';
    if (gps.watch == null) startGps();
    return;
  }
  carWaiting = false;
  carPos = { x: gps.me.x, y: gps.me.y };
  let best = null, bd = Infinity;
  for (const p of LOTS()) { const d = Math.hypot(p.x - carPos.x, p.y - carPos.y); if (d < bd) { bd = d; best = p; } }
  $('#car-lot').value = best?.id || '';
  $('#car-gps').textContent = `✅ Posição capturada (±${Math.round(gps.me.acc)} m)`;
}

function saveCar() {
  const lot = $('#car-lot').value;
  if (!lot) { $('#car-lot').classList.add('need'); return; }
  state.car = { lot, note: $('#car-note').value.trim(), t: Date.now(), ...(carPos || {}) };
  persistCar();
  $('#car').close();
  fitPoints([CAR], 80 * mall.ppm);
}

function goToCar() {
  if (!state.car) return;
  placeCar();
  state.to = CAR; state.picked = null;
  gpsAsOrigin();
  update(true);
}

/* ---------- grupo com conversa (Firebase) ---------- */
// /grupos/{código}: { exp, nome, dono, enc:{id,h}, msgs:{id:{n,t,ts,u}}, pos:{uid:{n,x,y,ts}} }
const grp = { code: null, uid: null, owner: false, data: null, es: null, seen: 0, lastPos: 0 };
const ALPHA = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // sem 0/O/1/I/L para não confundir
const fmtCode = (c) => c.replace(/^(SAW)(\w{4})(\w{4})$/, '$1-$2-$3');
const cleanCode = (t) => (t || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const randCode = () => 'SAW' + Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => ALPHA[b % ALPHA.length]).join('');

async function dbReq(method, path, body) {
  const r = await fetch(`${DB_URL}/${path}.json`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error || r.status);
  return j;
}

function myUid() {
  let u = load('sawgrass.uid');
  if (!u) { u = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join(''); store('sawgrass.uid', u); }
  return u;
}

function bindGroup() {
  $('#gr-close').onclick = () => $('#group').close();
  $('#gr-create').onclick = createGroup;
  $('#gr-join').onclick = () => joinGroup(cleanCode($('#gr-code').value));
  $('#gr-link').onclick = () => { $('#group').close(); openShare(); };
  $('#gr-invite').onclick = inviteGroup;
  $('#gr-form').onsubmit = (e) => { e.preventDefault(); sendMsg(); };
  $('#gr-leave').onclick = () => leaveGroup('Você saiu do grupo.');
  $('#gr-del').onclick = () => { $('#gr-confirm').hidden = false; };
  $('#gr-del-ok').onclick = deleteGroup;
  $('#gr-pos').onchange = (e) => {
    store('sawgrass.grupo.pos', e.target.checked);
    if (e.target.checked) { if (gps.watch == null) startGps(); else { grp.lastPos = 0; sendMyPos(); } }
    else if (grp.code) dbReq('DELETE', `grupos/${grp.code}/pos/${grp.uid}`).catch(() => {});
  };
  $('#chat-bar').onclick = openGroup;
}

function groupErr(msg) { $('#gr-err').textContent = msg; $('#gr-err').hidden = !msg; }
const needName = () => {
  const n = $('#gr-name').value.trim();
  if (!n) { groupErr('Escreva seu nome para o grupo saber quem é você.'); $('#gr-name').focus(); return null; }
  try { localStorage.setItem(NAME_KEY, n); } catch { /* sem armazenamento */ }
  return n;
};

function openGroup() {
  $('#gr-name').value = myName();
  groupErr('');
  renderGroup();
  if (!$('#group').open) $('#group').showModal();
  if (grp.code) { grp.seen = msgList().length; renderChatBar(); scrollChat(); }
}

async function createGroup() {
  const name = needName(); if (!name) return;
  const code = randCode(), uid = myUid();
  try {
    await dbReq('PUT', `grupos/${code}`, { exp: Date.now() + GROUP_TTL - 60000, nome: `Grupo de ${name}`, dono: uid,
      ...(state.meet ? { enc: { id: state.meet.id, h: state.meetTime || '' } } : {}),
      msgs: { first: { n: name, t: `${name} criou o grupo 👋`, ts: { '.sv': 'timestamp' }, u: uid } } });
  } catch (e) { return groupErr(framed ? 'Aqui dentro do Claude o grupo não funciona. Toque em “🌐 Abrir no navegador”.' : 'Não deu para criar o grupo. Confira a internet e tente de novo.'); }
  startGroup(code, true);
  inviteGroup();
}

async function joinGroup(code) {
  if (code.length < 10) return groupErr('O código tem 11 letras, como SAW-K7Q2-M9XD.');
  const name = needName(); if (!name) return;
  let g = null;
  try { g = await dbReq('GET', `grupos/${code}`); } catch { /* sem permissão = expirado ou não existe */ }
  if (!g) return groupErr('Grupo não encontrado. Ele pode ter sido excluído ou passado de 24 h.');
  dbReq('POST', `grupos/${code}/msgs`, { n: name, t: `${name} entrou no grupo`, ts: { '.sv': 'timestamp' }, u: myUid() }).catch(() => {});
  startGroup(code, g.dono === myUid());
}

function startGroup(code, owner) {
  grp.es?.close();
  Object.assign(grp, { code, uid: myUid(), owner, data: null, seen: 0, lastPos: 0 });
  store(GROUP_KEY, { code, owner });
  $('#gr-pos').checked = !!load('sawgrass.grupo.pos');
  // escuta ao vivo (Server-Sent Events do Realtime Database)
  const es = new EventSource(`${DB_URL}/grupos/${code}.json`);
  grp.es = es;
  const apply = (e, patch) => {
    const { path, data } = JSON.parse(e.data);
    const keys = path.split('/').filter(Boolean);
    if (!keys.length) {
      if (patch) grp.data = { ...(grp.data || {}), ...data }; else grp.data = data;
    } else {
      grp.data = grp.data || {};
      let o = grp.data;
      for (const k of keys.slice(0, -1)) o = o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {};
      const last = keys.at(-1);
      if (patch) o[last] = { ...(o[last] || {}), ...data }; else if (data === null) delete o[last]; else o[last] = data;
    }
    if (!grp.data) return leaveGroup('O grupo foi excluído.');
    onGroupData();
  };
  es.addEventListener('put', (e) => apply(e, false));
  es.addEventListener('patch', (e) => apply(e, true));
  es.addEventListener('cancel', () => leaveGroup('O grupo terminou (excluído ou passou de 24 h).'));
  renderGroup();
}

function resumeGroup(linkCode) {
  const saved = load(GROUP_KEY);
  if (linkCode && cleanCode(linkCode) !== saved?.code) {
    // convite: abre o grupo já com o código preenchido
    $('#gr-code').value = fmtCode(cleanCode(linkCode));
    setTimeout(() => { openGroup(); groupErr(myName() ? '' : 'Escreva seu nome e toque em Entrar.'); if (myName()) joinGroup(cleanCode(linkCode)); }, 300);
    return;
  }
  if (saved?.code) startGroup(saved.code, !!saved.owner);
}

const msgList = () => Object.entries(grp.data?.msgs || {}).map(([id, m]) => ({ id, ...m })).sort((a, b) => (a.ts || 0) - (b.ts || 0));

function onGroupData() {
  const d = grp.data;
  // encontro combinado no grupo vale para todos
  if (d.enc) {
    const e = mall.poiById.get(d.enc.id) || null;
    if (e !== state.meet || (d.enc.h || '') !== (state.meetTime || '')) { state.meet = e; state.meetTime = d.enc.h || ''; persistMeet(true); }
    grp.hadEnc = true;
  } else if (grp.hadEnc) { // alguém removeu o encontro do grupo
    grp.hadEnc = false; state.meet = null; state.meetTime = ''; persistMeet(true);
  }
  if ($('#group').open) { grp.seen = msgList().length; renderGroup(); scrollChat(); }
  renderChatBar();
  drawRoute();
}

function renderChatBar() {
  const list = msgList(), last = list.at(-1), unread = Math.max(0, list.length - grp.seen);
  $('#chat-bar').hidden = !grp.code || !last;
  if (last) $('#chat-bar-txt').textContent = `${last.u === grp.uid ? 'Você' : last.n}: ${last.t}`;
  $('#chat-bar-n').hidden = !unread;
  $('#chat-bar-n').textContent = unread;
  $('#tab-share').classList.toggle('alert', unread > 0);
}

function renderGroup() {
  const inG = !!grp.code;
  $('#gr-out').hidden = inG; $('#gr-in').hidden = !inG;
  $('#gr-title').textContent = inG ? `👥 ${grp.data?.nome || 'Grupo'}` : '👥 Grupo';
  if (!inG) return;
  $('#gr-code-show').textContent = fmtCode(grp.code);
  $('#gr-del').hidden = !grp.owner;
  $('#gr-confirm').hidden = true;
  const names = [...new Set(msgList().map((m) => m.n))];
  $('#gr-who').textContent = names.length ? `${names.length} ${names.length === 1 ? 'pessoa' : 'pessoas'}: ${names.join(', ')}` : '';
  const ul = $('#gr-msgs');
  ul.textContent = '';
  for (const m of msgList()) {
    const li = el('li', m.u === grp.uid ? 'me' : '');
    const t = m.ts ? new Date(m.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    li.append(el('small', '', `${m.u === grp.uid ? 'Você' : m.n} · ${t}`), el('span', '', m.t));
    ul.appendChild(li);
  }
}

const scrollChat = () => { const u = $('#gr-msgs'); u.scrollTop = u.scrollHeight; };

async function sendMsg() {
  const t = $('#gr-text').value.trim();
  if (!t || !grp.code) return;
  $('#gr-text').value = '';
  try { await dbReq('POST', `grupos/${grp.code}/msgs`, { n: myName() || 'Alguém', t, ts: { '.sv': 'timestamp' }, u: grp.uid }); }
  catch { $('#gr-text').value = t; }
}

function sendMyPos() {
  if (!grp.code || !gps.me || !$('#gr-pos').checked || Date.now() - grp.lastPos < 15000) return;
  grp.lastPos = Date.now();
  dbReq('PUT', `grupos/${grp.code}/pos/${grp.uid}`, { n: myName() || 'Alguém', x: Math.round(gps.me.x), y: Math.round(gps.me.y), ts: { '.sv': 'timestamp' } }).catch(() => {});
}

async function inviteGroup() {
  const url = `${baseUrl()}#g=${grp.code}`;
  const text = `👥 Entre no meu grupo do Sawgrass Mills\nCódigo: ${fmtCode(grp.code)}\n${url}`;
  if (navigator.share) { try { await navigator.share({ title: 'Grupo Sawgrass Mills', text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text); $('#gr-who').textContent = '✅ Convite copiado. Cole no WhatsApp.'; }
  catch { $('#gr-who').textContent = `Mande este código: ${fmtCode(grp.code)}`; }
}

function leaveGroup(msg) {
  if (grp.code && !msg?.startsWith('O grupo')) dbReq('DELETE', `grupos/${grp.code}/pos/${grp.uid}`).catch(() => {});
  grp.es?.close();
  Object.assign(grp, { code: null, data: null, es: null, owner: false, seen: 0 });
  store(GROUP_KEY, null);
  renderGroup(); renderChatBar(); drawRoute();
  if (msg) { groupErr(msg); if (!$('#group').open && msg.startsWith('O grupo')) { openGroup(); groupErr(msg); } }
}

async function deleteGroup() {
  const code = grp.code;
  try { await dbReq('DELETE', `grupos/${code}`); } catch { /* já não existe */ }
  leaveGroup('Grupo excluído. A conversa foi apagada.');
}

/* ---------- compartilhar com o grupo ---------- */
// Tudo vai no próprio link (sem servidor): #m=ids&enc=id&quem=Nome&px=x,y&h=15:42
const baseUrl = () => (framed ? WEB_URL : location.origin + location.pathname);
const myName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };

function openShare() {
  const n = marked.size, names = [...marked].map((id) => mall.poiById.get(id)?.name).filter(Boolean);
  $('#sh-marked-row').hidden = !n;
  $('#sh-marked-txt').textContent = `★ Lojas marcadas (${n}): ${names.slice(0, 4).join(', ')}${n > 4 ? '…' : ''}`;
  $('#sh-meet-row').hidden = !state.meet;
  $('#sh-meet-txt').textContent = `🤝 Encontro: ${state.meet?.name || ''}${state.meetTime ? ' às ' + state.meetTime : ''}`;
  $('#sh-me-row').hidden = !gps.me;
  $('#sh-empty').hidden = !!(n || state.meet || gps.me);
  $('#sh-name').value = myName();
  $('#sh-done').hidden = true;
  $('#share').showModal();
}

function buildShare() {
  const name = $('#sh-name').value.trim();
  try { localStorage.setItem(NAME_KEY, name); } catch { /* sem armazenamento */ }
  const h = new URLSearchParams(), lines = ['🛍️ Sawgrass Mills'];
  if (!$('#sh-meet-row').hidden && $('#sh-meet').checked) {
    h.set('enc', state.meet.id);
    if (state.meetTime) h.set('eh', state.meetTime);
    lines.push(`🤝 Encontro: ${state.meet.name}${state.meetTime ? ' às ' + state.meetTime : ''}`);
  }
  if (!$('#sh-marked-row').hidden && $('#sh-marked').checked) {
    const ids = [...marked];
    h.set('m', ids.join(','));
    lines.push(`★ Lojas: ${ids.map((id) => mall.poiById.get(id)?.name).join(', ')}`);
  }
  if (!$('#sh-me-row').hidden && $('#sh-me').checked && gps.me) {
    const t = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    h.set('px', `${Math.round(gps.me.x)},${Math.round(gps.me.y)}`); h.set('h', t);
    lines.push(`📍 ${name || 'Eu'} estava perto de ${gps.me.near?.name || 'aqui'} às ${t}`);
  }
  if (name) h.set('quem', name);
  const url = baseUrl() + (h.size ? '#' + h : '');
  lines.push('Abra o mapa: ' + url);
  return { title: 'Sawgrass Mills', text: lines.join('\n'), url };
}

async function sendShare() {
  const data = buildShare();
  const done = (msg) => { $('#sh-done').textContent = msg; $('#sh-done').hidden = false; };
  if (navigator.share) {
    try { await navigator.share({ title: data.title, text: data.text }); $('#share').close(); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(data.text); done('Copiado! Cole no WhatsApp do grupo.'); }
  catch { open('https://wa.me/?text=' + encodeURIComponent(data.text), '_blank', 'noopener'); }
}

// quem recebe o link: mostra encontro, lojas e a posição de quem mandou
function readShared(h) {
  const marks = (h.get('m') || '').split(',').filter((id) => mall.poiById.has(id));
  const meet = mall.poiById.get(h.get('enc')) || null;
  const name = (h.get('quem') || '').slice(0, 20);
  const px = (h.get('px') || '').split(',').map(Number);
  const who = px.length === 2 && px.every(Number.isFinite)
    ? { name, x: px[0], y: px[1], time: (h.get('h') || '').slice(0, 5), f: mall.floors[0].id } : null;
  if (!marks.length && !meet && !who) return;
  state.shared = { marks, who };
  if (meet) { state.meet = meet; state.meetTime = /^\d\d:\d\d$/.test(h.get('eh') || '') ? h.get('eh') : ''; persistMeet(); }
  for (const id of marks) marked.add(id); // aparecem no mapa; só ficam salvas se tocar em "Guardar"
  const from = name ? `${name} compartilhou` : 'Compartilhado com você';
  const bits = [meet && `🤝 encontro na ${meet.name}${state.meetTime ? ' às ' + state.meetTime : ''}`, marks.length && `★ ${marks.length} lojas`, who && `📍 posição às ${who.time}`].filter(Boolean);
  $('#shared-txt').textContent = `${from}: ${bits.join(' · ')}`;
  $('#shared-keep').hidden = !marks.length;
  $('#shared-keep').textContent = `Guardar ${marks.length} ${marks.length === 1 ? 'loja' : 'lojas'}`;
  $('#shared-gps').hidden = !meet;
  $('#shared-bar').hidden = false;
  if (meet) state.to = meet;
}

/* ---------- GPS ---------- */
// lat/lon -> coordenadas do mapa (transformação afim gravada em meta.geo pelo tools/add_osm.py)
function geoToMap(lat, lon) {
  const g = mall.data.meta.geo, dl = lon - g.lon0, dt = lat - g.lat0;
  return { x: g.x0 + g.xLon * dl + g.xLat * dt, y: g.y0 + g.yLon * dl + g.yLat * dt };
}

function gpsMsg(text, canUse = false) {
  $('#gps-bar').hidden = false;
  $('#gps-txt').textContent = text;
  $('#gps-use').hidden = !canUse;
}

function startGps() {
  if (!('geolocation' in navigator)) return gpsMsg('Este aparelho não oferece localização.');
  $('#gps').classList.add('on');
  $('#gps').setAttribute('aria-pressed', 'true');
  $('#gps').title = 'Desligar localização';
  gpsMsg('Procurando sua posição…');
  gps.centered = false;
  startCompass();
  gps.watch = navigator.geolocation.watchPosition(onGps, onGpsError,
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
}

function stopGps() {
  if (gps.watch != null) navigator.geolocation.clearWatch(gps.watch);
  gps.watch = null; gps.me = null; gps.heading = null;
  removeEventListener('deviceorientationabsolute', onHeading, true);
  removeEventListener('deviceorientation', onHeading, true);
  if (state.from === ME) { state.from = null; update(false); }
  $('#gps').classList.remove('on');
  $('#gps').setAttribute('aria-pressed', 'false');
  $('#gps').title = 'Onde estou (GPS)';
  $('#gps-bar').hidden = true;
  drawRoute();
}

function onGps(pos) {
  if (gps.watch == null) return; // já desligado
  const { latitude, longitude, accuracy } = pos.coords;
  const { x, y } = geoToMap(latitude, longitude);
  const f = mall.floorById.get(state.floor);
  const m = 150 * mall.ppm; // tolerância de 150 m fora da área do mapa
  const inside = x > -m && y > -m && x < f.width + m && y < f.height + m;
  if (!inside) {
    gps.me = null; drawRoute();
    return gpsMsg('Você não está no Sawgrass Mills. A posição aparece quando você chegar ao shopping.');
  }
  let near = null, bd = Infinity;
  for (const p of mall.pois) {
    if (p.f !== state.floor || p.group === 'Estacionamento') continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bd) { bd = d; near = p; }
  }
  gps.me = { x, y, acc: accuracy, near };
  updateMe();
  renderGpsBar();
  if (carWaiting && $('#car').open) carFromGps();
  sendMyPos();
  if (!gps.centered) { gps.centered = true; centerOnMe(); }
}

// posiciona "Minha posição" no nó de corredor mais próximo e refaz a rota se ele mudou
function updateMe() {
  const { x, y } = gps.me;
  let best = null, bd = Infinity;
  for (const n of mall.nodes.values()) {
    if (n.f !== state.floor || n.t === 'door' || !mall.adj.get(n.id)?.length) continue;
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < bd) { bd = d; best = n; }
  }
  const changed = ME.node !== best?.id;
  Object.assign(ME, { f: state.floor, x, y, node: best?.id ?? null });
  if (!mall.poiById.has(ME.id)) mall.poiById.set(ME.id, ME);
  if (state.from === ME && changed) update(false); else drawRoute();
}

function gpsAsOrigin() {
  if (gps.me && ME.node && (!state.from || state.from === ME)) state.from = ME;
}

// texto da faixa do GPS: destino com distância e direção, ou loja mais próxima
function renderGpsBar() {
  const { acc, near } = gps.me;
  const prec = acc < 1000 ? `±${Math.round(acc)} m` : 'baixa precisão';
  const r = state.route;
  if (state.from === ME && state.to && r) {
    const left = Math.max(0, Math.round(r.meters));
    const arrow = dirArrow(state.to);
    return gpsMsg(left < 15 ? `✅ Você chegou: ${state.to.name}` : `${arrow} ${state.to.name} · ${left} m pela rota (${prec})`, false);
  }
  gpsMsg(near ? `📍 Perto de ${near.name} (${prec})` : `Você está aqui (${prec})`, !!near);
  $('#gps-use').textContent = 'Usar como origem';
}

// seta de direção até o destino, relativa à bússola do celular (ou ao mapa, sem bússola)
const ARROWS = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];
function dirArrow(p) {
  // mira um ponto à frente na rota (fim do primeiro trecho), não o nó colado em você
  const tgt = state.route?.steps?.[0]?.pts?.at(-1) || p;
  let a = Math.atan2(tgt.x - ME.x, -(tgt.y - ME.y)) * 180 / Math.PI; // 0 = topo do mapa
  if (gps.heading != null) a -= mapHeading(gps.heading);
  return ARROWS[Math.round((((a % 360) + 360) % 360) / 45) % 8];
}

/* bússola: direção do celular convertida para o ângulo do mapa (0 = topo da tela) */
function startCompass() {
  const add = () => {
    addEventListener('deviceorientationabsolute', onHeading, true);
    addEventListener('deviceorientation', onHeading, true);
  };
  const D = window.DeviceOrientationEvent;
  if (!D) return;
  add(); // ouvir não custa nada; no iPhone os eventos só chegam depois da permissão abaixo
  if (D.requestPermission) D.requestPermission().catch(() => {});
}

function onHeading(e) {
  let h = null;
  if (e.webkitCompassHeading != null) h = e.webkitCompassHeading; // iPhone
  else if (e.absolute && e.alpha != null) h = 360 - e.alpha;      // Android
  if (h == null || gps.watch == null) return;
  if (gps.heading != null && Math.abs(((h - gps.heading + 540) % 360) - 180) < 4) return;
  gps.heading = h;
  if (gps.me) { drawRoute(); if (state.from === ME && state.to) renderGpsBar(); }
}

// rumo (graus a partir do norte) -> ângulo na tela do mapa (graus a partir do topo, sentido horário)
function mapHeading(h) {
  const g = mall.data.meta.geo, k = Math.cos(g.lat0 * Math.PI / 180);
  const nx = g.xLat / 110574, ny = g.yLat / 110574, ex = g.xLon / (111320 * k), ey = g.yLon / (111320 * k);
  const r = h * Math.PI / 180;
  const dx = nx * Math.cos(r) + ex * Math.sin(r), dy = ny * Math.cos(r) + ey * Math.sin(r);
  return Math.atan2(dx, -dy) * 180 / Math.PI;
}

function onGpsError(err) {
  if (gps.watch == null) return;
  if (err.code === 1) {
    stopGps();
    return gpsMsg(framed
      ? 'Aqui dentro o GPS fica bloqueado. Toque em “🌐 Abrir no navegador” para usar a localização.'
      : 'Localização bloqueada. iPhone: Ajustes › Privacidade e Segurança › Serviços de Localização › Sites do Safari › Durante o Uso. Depois, no Safari, toque em aA › Ajustes do Site › Localização › Perguntar e recarregue.');
  }
  gpsMsg(err.code === 3 ? 'O GPS está demorando. Dentro do shopping o sinal é fraco; tente perto de uma entrada.'
    : 'Não foi possível obter sua posição agora.');
}

function centerOnMe() {
  const { x, y, acc } = gps.me;
  const r = Math.max(acc, 40) * mall.ppm;
  drawRoute();
  fitPoints([{ x: x - r, y: y - r }, { x: x + r, y: y + r }]);
}

/* ---------- enquadramento ---------- */
function pads() {
  const top = $('.top').getBoundingClientRect().bottom + 12;
  const sheet = $('#sheet');
  const wide = innerWidth >= 760;
  const sh = sheet.hidden ? 0 : sheet.getBoundingClientRect();
  const tab = $('#tabbar').getBoundingClientRect().height;
  return {
    t: top, r: 70,
    b: tab + (!wide && sh ? sh.height : 0) + 16,
    l: wide && sh ? sh.width + 30 : 16,
  };
}

function fitPoints(pts, minSize = 0) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  const gx = Math.max(0, (minSize - (x1 - x0)) / 2), gy = Math.max(0, (minSize - (y1 - y0)) / 2);
  view.fit([x0 - gx, y0 - gy, x1 + gx, y1 + gy], pads());
}

function fitCurrent() {
  const f = mall.floorById.get(state.floor);
  const pts = [];
  for (const leg of state.route?.legs || []) if (leg.floor === f.id) pts.push(...leg.pts);
  if (!pts.length) {
    for (const p of [state.from, state.to]) if (p && p.f === f.id) pts.push(p);
  }
  if (pts.length) return fitPoints(pts, 40 * mall.ppm);
  // só as lojas (sem estacionamentos): o prédio enche a largura da tela
  const all = mall.pois.filter((p) => p.f === f.id && p.poly && p.group !== 'Estacionamento')
    .flatMap((p) => p.poly.reduce((a, v, i) => (i % 2 ? (a[a.length - 1].y = v) : a.push({ x: v, y: 0 }), a), []));
  if (all.length) { const m = mall.ppm * 4, r = { ...pads(), r: 16 }; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of all) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    view.fit([x0 - m, y0 - m, x1 + m, y1 + m], r); } else view.fit([0, 0, f.width, f.height], pads());
}

init().catch((err) => {
  console.error(err);
  const s = $('#sheet');
  s.hidden = false;
  s.textContent = 'Não foi possível carregar o mapa. Verifique a conexão e tente de novo.';
});
