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
// total comprado (itens marcados), com o imposto da loja se estiver ligado no conversor
export const spentUsd = () => load('sawgrass.lista', []).filter((i) => i.done).reduce((s, i) => s + (i.usd || 0), 0) * (conv.tax ? 1 + SALES_TAX : 1);

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
// novo passeio: esvazia a lista (e as fotos das notas)
export function clearShopList() { items.forEach(delReceipt); items = []; saveList(); }
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
      cb.onchange = () => {
        const before = cotaUsed();
        it.done = cb.checked; saveList(); renderList();
        cotaWarn(before, cotaUsed());
      };
      const pr = el('input', 'list-usd'); pr.value = it.usd ?? ''; pr.placeholder = 'US$'; pr.inputMode = 'decimal';
      pr.onchange = () => { it.usd = num(pr.value); saveList(); renderList(); };
      const conv2 = el('small', '', it.usd ? '≈ ' + money(toLocal(it.usd), cur) : '');
      const x = el('button', 'icon-btn', '✕'); x.type = 'button'; x.setAttribute('aria-label', tx('Remover'));
      x.onclick = () => { delReceipt(it); items = items.filter((i) => i !== it); saveList(); renderList(); };
      const txt = el('div', 'list-txt'); txt.append(el('span', '', it.t), conv2);
      li.append(cb, txt, receiptBtn(it), pr, x);
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
  if (showCota()) pane.appendChild(cotaBox());
  if (items.some((i) => i.done)) {
    const clr = el('button', 'btn link', tx('Limpar comprados')); clr.type = 'button';
    clr.onclick = () => { items.filter((i) => i.done).forEach(delReceipt); items = items.filter((i) => !i.done); saveList(); renderList(); };
    pane.appendChild(clr);
  }
}

/* ---------- foto da nota fiscal de cada compra ---------- */
// guardada à parte (sawgrass.nota.ID), reduzida para caber no armazenamento do navegador
const RECEIPT = (it) => 'sawgrass.nota.' + it.id;
const delReceipt = (it) => { try { localStorage.removeItem(RECEIPT(it)); } catch { /* ignora */ } };
async function shrinkReceipt(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = url; });
    const k = Math.min(1, 1300 / Math.max(img.naturalWidth, img.naturalHeight));   // nota precisa dar para ler
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.62);
  } finally { URL.revokeObjectURL(url); }
}
function receiptBtn(it) {
  let photo = null;
  try { photo = localStorage.getItem(RECEIPT(it)); } catch { /* sem armazenamento */ }
  if (photo) {
    const b = el('button', 'receipt has'); b.type = 'button';
    b.setAttribute('aria-label', tx('Ver nota fiscal'));
    const im = el('img'); im.src = photo; im.alt = '';
    b.append(im);
    b.onclick = () => {
      $('#photo-big').src = photo;
      const del = $('#pv-del'); del.hidden = false;
      del.onclick = () => { if (!confirm(tx('Apagar a foto da nota?'))) return; delReceipt(it); $('#photo-view').close(); renderList(); };
      $('#photo-view').showModal();
    };
    return b;
  }
  const lab = el('label', 'receipt'); lab.title = tx('Foto da nota fiscal');
  const inp = el('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('aria-label', tx('Foto da nota fiscal'));
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    try {
      const d = await shrinkReceipt(f);
      localStorage.setItem(RECEIPT(it), d);
      if (!it.done) { it.done = true; saveList(); }   // tem nota: já foi comprado
    } catch { toastShop(tx('A foto não coube na memória do celular. Apague notas antigas.')); }
    renderList();
  };
  lab.append(inp, el('span', '', '🧾'));
  return lab;
}

/* ---------- frases úteis em inglês (o celular fala para o vendedor) ---------- */
// [inglês, pt, es, fr, de, zh, ja]
const PHRASES = [
  ['Provador e tamanhos', [
    ['Where is the fitting room?', 'Onde fica o provador?', '¿Dónde está el probador?', 'Où est la cabine d’essayage ?', 'Wo ist die Umkleide?', '试衣间在哪里？', '試着室はどこですか？'],
    ['Can I try this on?', 'Posso experimentar?', '¿Me lo puedo probar?', 'Je peux l’essayer ?', 'Kann ich das anprobieren?', '我可以试穿吗？', '試着してもいいですか？'],
    ['Do you have this in a larger size?', 'Tem um tamanho maior?', '¿Lo tiene en una talla más grande?', 'Vous l’avez en plus grand ?', 'Haben Sie das eine Nummer größer?', '有大一号的吗？', 'もっと大きいサイズはありますか？'],
    ['Do you have this in a smaller size?', 'Tem um tamanho menor?', '¿Lo tiene en una talla más pequeña?', 'Vous l’avez en plus petit ?', 'Haben Sie das eine Nummer kleiner?', '有小一号的吗？', 'もっと小さいサイズはありますか？'],
    ['Do you have it in another color?', 'Tem em outra cor?', '¿Lo tiene en otro color?', 'Vous l’avez dans une autre couleur ?', 'Gibt es das in einer anderen Farbe?', '有别的颜色吗？', '他の色はありますか？'],
  ]],
  ['Preço e pagamento', [
    ['How much is this?', 'Quanto custa?', '¿Cuánto cuesta?', 'Combien ça coûte ?', 'Wie viel kostet das?', '这个多少钱？', 'これはいくらですか？'],
    ['Are there any discounts today?', 'Tem algum desconto hoje?', '¿Hay algún descuento hoy?', 'Il y a des réductions aujourd’hui ?', 'Gibt es heute Rabatte?', '今天有折扣吗？', '今日は割引がありますか？'],
    ['Is this price already discounted?', 'Esse preço já está com desconto?', '¿Este precio ya tiene descuento?', 'Ce prix est déjà réduit ?', 'Ist der Preis schon reduziert?', '这个价格已经打折了吗？', 'この値段はもう割引済みですか？'],
    ['Do you have a tourist discount?', 'Tem desconto para turista?', '¿Tienen descuento para turistas?', 'Vous avez une réduction pour touristes ?', 'Gibt es einen Touristenrabatt?', '有游客折扣吗？', '観光客向けの割引はありますか？'],
    ['Can I pay by card?', 'Posso pagar com cartão?', '¿Puedo pagar con tarjeta?', 'Je peux payer par carte ?', 'Kann ich mit Karte zahlen?', '可以刷卡吗？', 'カードで払えますか？'],
    ['I’m just looking, thank you.', 'Só estou olhando, obrigado.', 'Solo estoy mirando, gracias.', 'Je regarde seulement, merci.', 'Ich schaue nur, danke.', '我只是看看，谢谢。', '見ているだけです、ありがとう。'],
  ]],
  ['Trocas e nota', [
    ['What is your return policy?', 'Como funciona a troca?', '¿Cuál es la política de devoluciones?', 'Quelle est votre politique de retour ?', 'Wie ist Ihre Rückgaberegelung?', '退换货政策是什么？', '返品のルールは？'],
    ['Can I exchange it at another store?', 'Posso trocar em outra loja da marca?', '¿Lo puedo cambiar en otra tienda?', 'Je peux l’échanger dans un autre magasin ?', 'Kann ich es in einer anderen Filiale umtauschen?', '可以在别的分店换吗？', '他の店舗で交換できますか？'],
    ['Can I have the receipt, please?', 'Pode me dar o recibo, por favor?', '¿Me da el recibo, por favor?', 'Je peux avoir le reçu, s’il vous plaît ?', 'Kann ich bitte den Beleg haben?', '请给我收据。', 'レシートをください。'],
    ['Could I have a bag, please?', 'Pode me dar uma sacola, por favor?', '¿Me da una bolsa, por favor?', 'Je peux avoir un sac, s’il vous plaît ?', 'Kann ich bitte eine Tüte haben?', '请给我一个袋子。', '袋をもらえますか？'],
  ]],
  ['Ajuda', [
    ['Where is the restroom?', 'Onde fica o banheiro?', '¿Dónde está el baño?', 'Où sont les toilettes ?', 'Wo ist die Toilette?', '洗手间在哪里？', 'トイレはどこですか？'],
    ['Could you say that again more slowly?', 'Pode repetir mais devagar?', '¿Puede repetirlo más despacio?', 'Vous pouvez répéter plus lentement ?', 'Können Sie das langsamer wiederholen?', '请再慢一点说一遍。', 'もう一度ゆっくり言ってもらえますか？'],
    ['I don’t speak English very well.', 'Não falo inglês muito bem.', 'No hablo inglés muy bien.', 'Je ne parle pas très bien anglais.', 'Ich spreche nicht so gut Englisch.', '我英语说得不太好。', '英語があまり話せません。'],
  ]],
];
const PH_IDX = { pt: 1, es: 2, fr: 3, de: 4, zh: 5, ja: 6 };
function speakEn(text, btn) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US'; u.rate = 0.9;
  const en = speechSynthesis.getVoices().find((v) => v.lang?.startsWith('en-US')) || speechSynthesis.getVoices().find((v) => v.lang?.startsWith('en'));
  if (en) u.voice = en;
  document.querySelectorAll('.phrase.on').forEach((x) => x.classList.remove('on'));
  btn.classList.add('on');
  u.onend = u.onerror = () => btn.classList.remove('on');
  speechSynthesis.speak(u);
}
function renderPhrases() {
  const pane = $('#shop-phrases');
  if (!pane || pane.dataset.lang === getLang()) return;
  pane.dataset.lang = getLang(); pane.textContent = '';
  pane.append(el('p', 'cv-note', tx('Toque na frase: o celular fala em inglês. Ou mostre a tela para o vendedor.')));
  const k = PH_IDX[getLang()];
  for (const [title, list] of PHRASES) {
    pane.append(el('h3', 'ph-h', tx(title)));
    for (const ph of list) {
      const b = el('button', 'phrase'); b.type = 'button';
      b.append(el('span', 'ph-ic', '🔊'));
      const t = el('span', 'ph-t'); t.append(el('b', '', ph[0]));
      if (k) t.append(el('small', '', ph[k]));
      b.append(t);
      b.onclick = () => speakEn(ph[0], b);
      pane.append(b);
    }
  }
}

/* ---------- cota de isenção da Receita Federal (bagagem) ---------- */
// US$ 1.000 por viajante chegando ao Brasil de avião ou navio; acima disso, 50% sobre o excedente.
// Conta o que foi marcado como comprado, com o imposto da loja (o valor pago).
const COTA = 1000, COTA_TAX = 0.5;
const showCota = () => getLang() === 'pt' || cur === 'BRL';
let people = load('sawgrass.cota.pessoas', 1);
const cotaUsed = () => items.filter((i) => i.done).reduce((s, i) => s + (i.usd || 0), 0) * (conv.tax ? 1 + SALES_TAX : 1);
function cotaWarn(before, after) {
  if (!showCota()) return;
  const lim = COTA * people;
  if (before <= lim && after > lim) toastShop(tx('🛃 Passou da cota de US$ {n}! O excedente paga 50% na Receita.', { n: lim.toLocaleString('pt-BR') }));
  else if (before < lim * 0.8 && after >= lim * 0.8 && after <= lim) toastShop(tx('🛃 Atenção: já usou 80% da cota de US$ {n}.', { n: lim.toLocaleString('pt-BR') }));
}
function toastShop(msg) {
  let t = $('#shop-toast');
  if (!t) { t = el('p', 'shop-toast'); t.id = 'shop-toast'; t.setAttribute('role', 'status'); $('#shop-list').before(t); }
  t.textContent = msg; t.hidden = false;
  navigator.vibrate?.(150);
  clearTimeout(toastShop.t); toastShop.t = setTimeout(() => { t.hidden = true; }, 6000);
}
function cotaBox() {
  const lim = COTA * people, used = cotaUsed(), pct = used / lim;
  const box = el('div', 'cota ' + (pct > 1 ? 'over' : pct >= 0.8 ? 'warn' : 'ok'));
  const head = el('div', 'cota-head');
  head.append(el('b', '', tx('🛃 Cota da Receita')));
  const sel = el('select'); sel.setAttribute('aria-label', tx('Viajantes'));
  for (let n = 1; n <= 6; n++) sel.append(new Option(n === 1 ? tx('1 viajante') : tx('{n} viajantes', { n }), n));
  sel.value = people;
  sel.onchange = () => { people = +sel.value; save('sawgrass.cota.pessoas', people); renderList(); };
  head.append(sel);
  const bar = el('div', 'cota-bar'); const fill = el('i'); fill.style.width = Math.min(100, pct * 100) + '%'; bar.append(fill);
  const line = el('div', 'cota-line', tx('Usado {a} de {b}', { a: money(used, 'USD'), b: money(lim, 'USD') }));
  box.append(head, bar, line);
  if (pct > 1) {
    const ex = used - lim;
    box.append(el('div', 'cota-msg', tx('Passou {x}. Imposto estimado: {t} (≈ {l}).', { x: money(ex, 'USD'), t: money(ex * COTA_TAX, 'USD'), l: money(toLocal(ex * COTA_TAX, { tax: false, iof: false }), cur) })));
  } else {
    box.append(el('div', 'cota-msg', tx('Ainda cabem {x}.', { x: money(lim - used, 'USD') })));
  }
  box.append(el('small', '', tx('US$ 1.000 por viajante chegando de avião ou navio (por terra: US$ 500). Notebook e celular novos entram na conta. Confira as regras no site da Receita antes de viajar.')));
  return box;
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
  renderConv(); renderList(); renderPhrases();
  $('#deal-go').onclick = () => { const g = hooks.guest(); if (g) { $('#shop').close(); hooks.goTo(g); } };
  if (!$('#shop').open) $('#shop').showModal();
}
