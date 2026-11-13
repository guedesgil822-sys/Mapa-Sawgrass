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
const ICON = {
  start: '●', straight: '↑', right: '↱', left: '↰', 'slight-right': '↗', 'slight-left': '↖',
  uturn: '↶', arrive: '⚑',
};

const state = { from: null, to: null, floor: null, route: null, step: 0, picked: null, accessible: false, open: false };
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

  setFloor(state.from?.f || mall.floors[0].id, false);
  update(true);
  renderMarked();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

/* ---------- interface ---------- */
function bindUI() {
  $('#f-from').onclick = () => openPicker('from');
  $('#f-to').onclick = () => openPicker('to');
  $('#find').onclick = () => openPicker('find');
  $('#mark-clear').onclick = () => { clearMarked(); renderResults(); };
  $('#marked-clear').onclick = clearMarked;
  $('#mark-show').onclick = () => { $('#picker').close(); showMarked(); };
  $('#marked-chip').onclick = showMarked;
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
    find: 'Buscar loja, serviço ou categoria' }[which];
  $('#mark-hint').hidden = which !== 'find';
  renderResults();
  $('#picker').showModal();
  $('#q').focus();
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

  state.route = null;
  if (state.from && state.to && state.from.id !== state.to.id) {
    state.route = mall.route(state.from.id, state.to.id, { accessible: state.accessible });
  }
  if (refit) state.step = 0;

  const h = new URLSearchParams();
  if (state.from && state.from !== ME) h.set('de', state.from.id);
  if (state.to) h.set('para', state.to.id);
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
    const m = el('button', 'btn small mark-toggle', marked.has(p.id) ? '★ Desmarcar' : '☆ Marcar');
    m.onclick = () => { toggleMarked(p); renderSheet(); };
    act.append(m);
    s.append(head, act);
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
  if (state.from !== ME) mark(state.from, 'from');
  mark(state.to, 'to');
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
  $('#gps-use').textContent = 'Usar minha posição como origem';
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
  return {
    t: top, r: 70,
    b: !wide && sh ? sh.height + 16 : 24,
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
  // piso inteiro: usa a área onde há lojas/corredores
  const all = mall.data.nodes.filter((n) => n.f === f.id);
  if (all.length) fitPoints(all, 0); else view.fit([0, 0, f.width, f.height], pads());
}

init().catch((err) => {
  console.error(err);
  const s = $('#sheet');
  s.hidden = false;
  s.textContent = 'Não foi possível carregar o mapa. Verifique a conexão e tente de novo.';
});
