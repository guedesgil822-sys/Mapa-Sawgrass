// Ferramentas de compra: conversor de preço, tabela de tamanhos e lista de compras.
import { t as tx, td, getLang } from './i18n.js';

const $ = (s) => document.querySelector(s);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } };

/* ---------- conversor ---------- */
// Imposto sobre vendas em Sunrise (condado de Broward): 6% da Flórida + 1% do condado.
const SALES_TAX = 0.07;
// IOF em compras no exterior com cartão brasileiro (crédito, débito e pré-pago).
const IOF = 0.035;
const RATES_URL = 'https://open.er-api.com/v6/latest/USD';
const RATES_KEY = 'sawgrass.cambio';
// Reserva aproximada, usada só até o app conseguir a cotação do dia (fica guardada para usar offline).
const FALLBACK = { date: null, rates: { BRL: 5.5, EUR: 0.88, GBP: 0.76, CAD: 1.38, MXN: 18.5, COP: 4000, ARS: 1200, CLP: 950, CNY: 7.2, JPY: 150 } };
const CURRENCIES = [
  ['BRL', '🇧🇷', 'R$'], ['EUR', '🇪🇺', '€'], ['GBP', '🇬🇧', '£'], ['CAD', '🇨🇦', 'C$'], ['MXN', '🇲🇽', 'MX$'],
  ['COP', '🇨🇴', 'COP$'], ['ARS', '🇦🇷', 'AR$'], ['CLP', '🇨🇱', 'CLP$'], ['CNY', '🇨🇳', '¥'], ['JPY', '🇯🇵', '¥'],
];
const DEFAULT_CUR = { pt: 'BRL', es: 'MXN', fr: 'EUR', de: 'EUR', zh: 'CNY', ja: 'JPY', en: 'GBP' };
const LOCALE = { pt: 'pt-BR', en: 'en-US', es: 'es', fr: 'fr', de: 'de', zh: 'zh-CN', ja: 'ja' };

let fx = load(RATES_KEY, FALLBACK);
let cur = null; // definida ao abrir (depois que o idioma é conhecido)
const conv = load('sawgrass.conv', { price: '', tax: true, iof: true });

async function refreshRates() {
  try {
    const r = await fetch(RATES_URL);
    const j = await r.json();
    if (j.result !== 'success' || !j.rates?.BRL) return;
    fx = { date: j.time_last_update_unix * 1000, rates: Object.fromEntries(CURRENCIES.map(([c]) => [c, j.rates[c]])) };
    save(RATES_KEY, fx);
    renderConv();
  } catch { /* sem internet ou bloqueado: fica a última cotação guardada */ }
}

export const money = (v, c) => {
  const sym = c === 'USD' ? 'US$' : CURRENCIES.find((x) => x[0] === c)?.[2] || c;
  const dec = ['JPY', 'COP', 'CLP', 'ARS'].includes(c) ? 0 : 2;
  return `${sym} ${v.toLocaleString(LOCALE[getLang()], { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
};
// preço em dólar -> total na moeda escolhida (com imposto e IOF se marcados)
export function toLocal(usd, opts = conv) {
  cur ??= load('sawgrass.moeda', null) || DEFAULT_CUR[getLang()] || 'BRL';
  const withTax = usd * (opts.tax ? 1 + SALES_TAX : 1);
  return withTax * (fx.rates[cur] || 0) * (cur === 'BRL' && opts.iof ? 1 + IOF : 1);
}
export const currency = () => cur;

function renderConv() {
  const box = $('#shop-conv');
  if (!box) return;
  const v = parseFloat(String(conv.price).replace(',', '.')) || 0;
  const withTax = v * (conv.tax ? 1 + SALES_TAX : 1);
  $('#cv-total').textContent = money(toLocal(v), cur);
  const parts = [`${money(v, 'USD')}`];
  if (conv.tax) parts.push(`+ ${tx('imposto')} 7% = ${money(withTax, 'USD')}`);
  if (cur === 'BRL' && conv.iof) parts.push(`+ IOF 3,5%`);
  $('#cv-detail').textContent = parts.join('  ');
  $('#cv-iof-row').hidden = cur !== 'BRL';
  const r = fx.rates[cur];
  $('#cv-rate').textContent = `US$ 1 = ${money(r || 0, cur)} · ` + (fx.date
    ? tx('cotação de {d}', { d: new Date(fx.date).toLocaleDateString(LOCALE[getLang()]) })
    : tx('cotação aproximada (sem internet)'));
}

function buildConv() {
  cur = load('sawgrass.moeda', null) || DEFAULT_CUR[getLang()] || 'BRL';
  const sel = $('#cv-cur');
  sel.textContent = '';
  for (const [c, flag] of CURRENCIES) sel.append(new Option(`${flag} ${c}`, c));
  sel.value = cur;
  sel.onchange = () => { cur = sel.value; save('sawgrass.moeda', cur); renderConv(); renderList(); };
  const inp = $('#cv-price');
  inp.value = conv.price;
  inp.oninput = () => { conv.price = inp.value; save('sawgrass.conv', conv); renderConv(); };
  $('#cv-tax').checked = conv.tax;
  $('#cv-tax').onchange = (e) => { conv.tax = e.target.checked; save('sawgrass.conv', conv); renderConv(); renderList(); };
  $('#cv-iof').checked = conv.iof;
  $('#cv-iof').onchange = (e) => { conv.iof = e.target.checked; save('sawgrass.conv', conv); renderConv(); renderList(); };
  for (const b of document.querySelectorAll('#cv-quick button')) {
    b.onclick = () => { inp.value = conv.price = b.dataset.v; save('sawgrass.conv', conv); renderConv(); };
  }
  renderConv();
}

/* ---------- tamanhos ---------- */
// Referência comum (Nike/Adidas e lojas americanas); varia um pouco por marca.
const SIZES = [
  { id: 'sw', label: 'Calçado feminino', cols: ['EUA', 'Brasil', 'Europa', 'cm'], rows: [
    ['5', '33', '35.5', '22'], ['5.5', '34', '36', '22.5'], ['6.5', '35', '37.5', '23.5'], ['7', '36', '38', '24'],
    ['8', '37', '39', '25'], ['8.5', '38', '40', '25.5'], ['9.5', '39', '41', '26.5'], ['10', '40', '42', '27']] },
  { id: 'sm', label: 'Calçado masculino', cols: ['EUA', 'Brasil', 'Europa', 'cm'], rows: [
    ['6.5', '37', '39', '24.5'], ['7.5', '38', '40.5', '25.5'], ['8', '39', '41', '26'], ['9', '40', '42.5', '27'],
    ['9.5', '41', '43', '27.5'], ['10.5', '42', '44.5', '28.5'], ['11', '43', '45', '29'], ['12', '44', '46', '30']] },
  { id: 'cw', label: 'Roupa feminina', cols: ['EUA', 'Letra', 'Brasil', 'Europa'], rows: [
    ['0', 'XS', '34', '32'], ['2', 'XS', '36', '34'], ['4', 'S', '38', '36'], ['6', 'S', '40', '38'], ['8', 'M', '42', '40'],
    ['10', 'M', '44', '42'], ['12', 'L', '46', '44'], ['14', 'L', '48', '46'], ['16', 'XL', '50', '48']] },
  { id: 'cm', label: 'Camisa masculina', cols: ['EUA', 'Brasil', 'Europa'], rows: [
    ['S', 'P', '46'], ['M', 'M', '48'], ['L', 'G', '50'], ['XL', 'GG', '52'], ['XXL', 'XGG', '54']] },
  { id: 'pm', label: 'Calça masculina (cintura)', cols: ['EUA', 'Brasil', 'Europa'], rows: [
    ['28', '38', '44'], ['30', '40', '46'], ['32', '42', '48'], ['34', '44', '50'], ['36', '46', '52'], ['38', '48', '54'], ['40', '50', '56']] },
];
let sizeTab = 'sw', sizeRow = -1;

function buildSizes() {
  const pane = $('#shop-sizes');
  pane.textContent = '';
  const chips = el('div', 'chips size-chips');
  for (const t of SIZES) {
    const c = el('button', 'chip' + (t.id === sizeTab ? ' on' : ''), tx(t.label));
    c.type = 'button';
    c.onclick = () => { sizeTab = t.id; sizeRow = -1; buildSizes(); };
    chips.appendChild(c);
  }
  const t = SIZES.find((x) => x.id === sizeTab);
  const wrap = el('div', 'size-wrap');
  const tb = el('table', 'size-table');
  const hr = el('tr');
  for (const c of t.cols) hr.appendChild(el('th', '', tx(c)));
  tb.appendChild(el('thead')).appendChild(hr);
  const body = tb.appendChild(el('tbody'));
  t.rows.forEach((r, i) => {
    const tr = el('tr', i === sizeRow ? 'on' : '');
    for (const v of r) tr.appendChild(el('td', '', getLang() === 'pt' || getLang() === 'es' || getLang() === 'fr' || getLang() === 'de' ? v.replace('.', ',') : v));
    tr.onclick = () => { sizeRow = i; buildSizes(); };
    body.appendChild(tr);
  });
  wrap.appendChild(tb);
  pane.append(chips, wrap, el('p', 'cv-note', tx('Toque numa linha para destacar. As medidas variam um pouco entre marcas; se puder, experimente. "cm" é o comprimento do pé.')));
}

/* ---------- lista de compras ---------- */
// itens: { id, t: o que comprar, usd: preço (opcional), store: id da loja (opcional), done: comprado }
const LIST_KEY = 'sawgrass.lista';
let items = load(LIST_KEY, []);
let hooks = { marked: () => [], poi: () => null, goTo: () => {}, guest: () => null };
export function setShopHooks(h) { hooks = { ...hooks, ...h }; }
const saveList = () => save(LIST_KEY, items);
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };

function renderList() {
  cur ??= load('sawgrass.moeda', null) || DEFAULT_CUR[getLang()] || 'BRL';
  const pane = $('#shop-list');
  if (!pane) return;
  pane.textContent = '';
  // formulário
  const f = el('form', 'list-add');
  const what = el('input'); what.id = 'ls-what'; what.placeholder = tx('Ex.: tênis de corrida'); what.maxLength = 60; what.autocomplete = 'off';
  const price = el('input'); price.id = 'ls-usd'; price.placeholder = 'US$'; price.inputMode = 'decimal'; price.autocomplete = 'off';
  const store = el('select'); store.id = 'ls-store';
  store.append(new Option(tx('Qualquer loja'), ''));
  for (const p of hooks.marked()) store.append(new Option(td(p.name), p.id));
  const add = el('button', 'btn primary', tx('Adicionar')); add.type = 'submit';
  f.append(el('label', 'share-name', tx('O que comprar')), what, el('div', 'list-row2'));
  f.lastChild.append(price, store, add);
  f.onsubmit = (e) => {
    e.preventDefault();
    if (!what.value.trim()) return what.focus();
    items.push({ id: Date.now().toString(36), t: what.value.trim(), usd: num(price.value), store: store.value, done: false });
    saveList(); renderList();
    $('#ls-what').focus();
  };
  pane.appendChild(f);
  if (!hooks.marked().length) pane.appendChild(el('p', 'cv-note', tx('Dica: marque lojas na busca para escolher a loja de cada item.')));

  if (!items.length) { pane.appendChild(el('p', 'empty', tx('Sua lista está vazia.'))); return; }
  // agrupado por loja
  const groups = new Map();
  for (const it of items) { const k = it.store || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); }
  const ul = el('ul', 'list-items');
  for (const [sid, its] of [...groups].sort((a, b) => (a[0] ? 0 : 1) - (b[0] ? 0 : 1))) {
    const p = sid ? hooks.poi(sid) : null;
    const h = el('li', 'list-store');
    h.append(el('span', '', p ? td(p.name) : tx('Qualquer loja')));
    if (p) {
      const go = el('button', 'go', tx('Ir ➜')); go.type = 'button';
      go.onclick = () => { $('#shop').close(); hooks.goTo(p); };
      h.appendChild(go);
    }
    ul.appendChild(h);
    for (const it of its) {
      const li = el('li', 'list-item' + (it.done ? ' done' : ''));
      const cb = el('input'); cb.type = 'checkbox'; cb.checked = it.done; cb.setAttribute('aria-label', it.t);
      cb.onchange = () => { it.done = cb.checked; saveList(); renderList(); };
      const pr = el('input', 'list-usd'); pr.value = it.usd ?? ''; pr.placeholder = 'US$'; pr.inputMode = 'decimal';
      pr.onchange = () => { it.usd = num(pr.value); saveList(); renderList(); };
      const conv2 = el('small', '', it.usd ? '≈ ' + money(toLocal(it.usd), cur) : '');
      const x = el('button', 'icon-btn', '✕'); x.type = 'button'; x.setAttribute('aria-label', tx('Remover'));
      x.onclick = () => { items = items.filter((i) => i !== it); saveList(); renderList(); };
      const txt = el('div', 'list-txt'); txt.append(el('span', '', it.t), conv2);
      li.append(cb, txt, pr, x);
      ul.appendChild(li);
    }
  }
  pane.appendChild(ul);
  // totais (com imposto, se marcado no conversor)
  const sum = (arr) => arr.reduce((s, i) => s + (i.usd || 0), 0);
  const plan = sum(items), got = sum(items.filter((i) => i.done));
  const taxed = (v) => v * (conv.tax ? 1 + SALES_TAX : 1);
  const tot = el('div', 'list-total');
  tot.append(
    el('div', '', `${tx('Planejado')}: ${money(taxed(plan), 'USD')} ≈ ${money(toLocal(plan), cur)}`),
    el('div', 'got', `${tx('Comprado')}: ${money(taxed(got), 'USD')} ≈ ${money(toLocal(got), cur)}`),
    el('small', '', conv.tax ? tx('Valores com o imposto de 7%.') : ''),
  );
  pane.appendChild(tot);
  if (items.some((i) => i.done)) {
    const clr = el('button', 'btn link', tx('Limpar comprados')); clr.type = 'button';
    clr.onclick = () => { items = items.filter((i) => !i.done); saveList(); renderList(); };
    pane.appendChild(clr);
  }
}

/* ---------- janela ---------- */
let built = false;
export function openShop(tab = 'conv') {
  if (!built) { buildConv(); buildSizes(); built = true; refreshRates(); }
  for (const b of document.querySelectorAll('#shop-tabs button')) {
    b.classList.toggle('on', b.dataset.tab === tab);
    b.onclick = () => openShop(b.dataset.tab);
  }
  for (const s of document.querySelectorAll('.shop-pane')) s.hidden = s.id !== 'shop-' + tab;
  renderConv(); renderList();
  $('#deal-go').onclick = () => { const g = hooks.guest(); if (g) { $('#shop').close(); hooks.goTo(g); } };
  if (!$('#shop').open) $('#shop').showModal();
}
