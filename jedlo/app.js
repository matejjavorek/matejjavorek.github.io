'use strict';

// ---------- Úložisko ----------
const STORE_KEY = 'jedlo.v1';
const KEY_KEY = 'jedlo.apikey';
const MEALS = [
  ['ranajky', 'Raňajky'],
  ['obed', 'Obed'],
  ['desiata', 'Desiata / snack'],
  ['vecera', 'Večera'],
];
const MEAL_LABEL = Object.fromEntries(MEALS);
const MODELS = [
  ['claude-opus-5-5', 'Claude Opus 5.5 – presnejší (~1–2 centy / fotka)'],
  ['claude-haiku-5-5', 'Claude Haiku 5.5 – lacnejší, rýchlejší'],
];

function defaultState() {
  return {
    profile: { sex: 'm', age: null, height: null, weight: null, activity: 1.55, surplus: 350, proteinPerKg: 2, model: MODELS[0][0] },
    entries: [],
    weights: [],
    water: {},
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    const d = defaultState();
    return { ...d, ...s, profile: { ...d.profile, ...s.profile } };
  } catch {
    return defaultState();
  }
}

let S = load();

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(S));
  } catch {
    // Plné úložisko: zmaž náhľady fotiek starších ako 14 dní a skús znova.
    const limit = dayKey(addDays(new Date(), -14));
    S.entries.forEach(e => { if (e.date < limit) delete e.thumb; });
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(S));
    } catch {
      toast('Úložisko je plné. Exportuj zálohu a zmaž staré dáta.');
    }
  }
}

function getKey() {
  try { return localStorage.getItem(KEY_KEY) || ''; } catch { return ''; }
}
function setKey(v) {
  try { v ? localStorage.setItem(KEY_KEY, v) : localStorage.removeItem(KEY_KEY); } catch { /* nič */ }
}

// ---------- Pomocné ----------
const $ = sel => document.querySelector(sel);
const r0 = n => Math.round(n || 0);
const r1 = n => Math.round((n || 0) * 10) / 10;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function dayKey(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function parseDay(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
const todayKey = () => dayKey(new Date());

function fmtDay(k) {
  if (k === todayKey()) return 'Dnes';
  if (k === dayKey(addDays(new Date(), -1))) return 'Včera';
  return parseDay(k).toLocaleDateString('sk-SK', { weekday: 'short', day: 'numeric', month: 'numeric' });
}

function scoreClass(s) { return s >= 7 ? 's-good' : s >= 4 ? 's-mid' : 's-bad'; }

function defaultMeal() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h < 10.5) return 'ranajky';
  if (h < 15) return 'obed';
  if (h < 17.5) return 'desiata';
  return 'vecera';
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

// ---------- Ciele ----------
function currentWeight() {
  if (S.weights.length) return [...S.weights].sort((a, b) => a.date.localeCompare(b.date)).at(-1).kg;
  return S.profile.weight;
}

function targets() {
  const p = S.profile;
  const w = currentWeight();
  if (!w || !p.height || !p.age) return null;
  const bmr = 10 * w + 6.25 * p.height - 5 * p.age + (p.sex === 'f' ? -161 : 5);
  const tdee = bmr * p.activity;
  const kcal = tdee + Number(p.surplus || 0);
  const protein = w * p.proteinPerKg;
  const fat = (kcal * 0.25) / 9;
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);
  return {
    bmr: r0(bmr), tdee: r0(tdee), kcal: r0(kcal),
    p: r0(protein), c: r0(carbs), f: r0(fat),
    fib: r0((kcal / 1000) * 14), water: r0((w * 35) / 250) * 250,
  };
}

function dayTotals(date) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, fib: 0, scoreW: 0, n: 0 };
  for (const e of S.entries) {
    if (e.date !== date) continue;
    t.kcal += e.kcal; t.p += e.p; t.c += e.c; t.f += e.f; t.fib += e.fib || 0;
    t.scoreW += (e.score || 5) * e.kcal; t.n++;
  }
  t.score = t.kcal ? t.scoreW / t.kcal : null;
  return t;
}

// ---------- Navigácia ----------
let view = 'today';
let curDate = todayKey();
const VIEW_TITLE = { stats: 'Štatistiky', weight: 'Váha', profile: 'Profil' };

function show(v) {
  view = v;
  document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === 'view-' + v));
  document.querySelectorAll('.tabs [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  render();
  window.scrollTo(0, 0);
}

function render() {
  const onToday = view === 'today';
  $('#prev-day').style.visibility = onToday ? 'visible' : 'hidden';
  $('#next-day').style.visibility = onToday ? 'visible' : 'hidden';
  $('#next-day').disabled = curDate >= todayKey();
  $('#title').textContent = onToday ? fmtDay(curDate) : VIEW_TITLE[view];
  ({ today: renderToday, stats: renderStats, weight: renderWeight, profile: renderProfile })[view]();
}

// ---------- Dnes ----------
function ring(value, target, color) {
  const R = 52, C = 2 * Math.PI * R;
  const pct = target ? Math.min(value / target, 1) : 0;
  return `<svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
    <circle cx="60" cy="60" r="${R}" fill="none" stroke="var(--card2)" stroke-width="12"/>
    <circle cx="60" cy="60" r="${R}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"
      stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg>`;
}

function bar(label, value, target, color, unit = 'g') {
  const pct = target ? Math.min((value / target) * 100, 100) : 0;
  return `<div><div class="bar-label"><span>${label}</span><span class="muted">${r0(value)} / ${target ? r0(target) : '–'} ${unit}</span></div>
    <div class="bar"><i style="width:${pct}%;background:${color}"></i></div></div>`;
}

function renderToday() {
  const el = $('#view-today');
  const t = targets();
  const tot = dayTotals(curDate);
  const water = S.water[curDate] || 0;
  let html = '';

  if (!t) {
    html += `<div class="warn">Najprv vyplň <b>Profil</b> (vek, výška, váha) – vypočítam ti denný cieľ kalórií a bielkovín na priberanie.
      <div style="margin-top:8px"><button class="btn sm primary" data-go="profile">Vyplniť profil</button></div></div>`;
  }

  const left = t ? r0(t.kcal - tot.kcal) : null;
  html += `<div class="card"><div class="ring-wrap">
    <div class="ring">${ring(tot.kcal, t?.kcal, 'var(--kcal)')}
      <div class="center"><span class="big">${r0(tot.kcal)}</span><span class="small muted">${t ? 'z ' + t.kcal + ' kcal' : 'kcal'}</span></div></div>
    <div class="bars">
      ${bar('Bielkoviny', tot.p, t?.p, 'var(--p)')}
      ${bar('Sacharidy', tot.c, t?.c, 'var(--c)')}
      ${bar('Tuky', tot.f, t?.f, 'var(--f)')}
      ${bar('Vláknina', tot.fib, t?.fib, 'var(--fib)')}
    </div></div>
    ${t ? `<p class="small muted" style="margin:12px 0 0">${left > 0 ? `Ešte zjedz <b>${left} kcal</b> a <b>${Math.max(0, t.p - r0(tot.p))} g</b> bielkovín.` : `Cieľ kalórií splnený ✅ (+${-left} kcal)`}
      ${tot.score ? ` · Zdravosť dňa: <span class="score ${scoreClass(tot.score)}">${r1(tot.score)}</span>` : ''}</p>` : ''}
  </div>`;

  html += `<div class="card"><div class="water">
    <span style="font-size:22px">💧</span>
    <div style="flex:1">${bar('Voda', water, t?.water, 'var(--water)', 'ml')}</div>
    <button class="btn sm" data-water="-250" aria-label="Uber 250 ml">−</button>
    <button class="btn sm" data-water="250" aria-label="Pridaj 250 ml">+</button>
  </div></div>`;

  for (const [m, label] of MEALS) {
    const items = S.entries.filter(e => e.date === curDate && e.meal === m).sort((a, b) => a.ts - b.ts);
    const kc = items.reduce((s, e) => s + e.kcal, 0);
    html += `<div class="card"><div class="meal-head"><h3>${label}</h3><span class="muted small">${r0(kc)} kcal</span></div>`;
    if (!items.length) html += `<div class="empty">Nič zapísané · <a href="#" data-add-meal="${m}">pridať</a></div>`;
    for (const e of items) {
      html += `<button class="entry list-item" data-entry="${e.id}" style="border-bottom:0">
        ${e.thumb ? `<img src="${e.thumb}" alt="">` : ''}
        <div class="info"><div class="name">${esc(e.name)}</div>
          <div class="small muted">${r0(e.g)} g · B ${r0(e.p)} · S ${r0(e.c)} · T ${r0(e.f)}</div></div>
        <span class="score ${scoreClass(e.score)}">${e.score ?? '–'}</span>
        <span class="kc">${r0(e.kcal)}</span></button>`;
    }
    html += '</div>';
  }
  el.innerHTML = html;
}

// ---------- AI analýza ----------
const AI_SCHEMA = {
  type: 'object',
  properties: {
    meal_name: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    note: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          grams: { type: 'number' },
          kcal: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
          fiber: { type: 'number' },
          health_score: { type: 'integer' },
        },
        required: ['name', 'grams', 'kcal', 'protein', 'carbs', 'fat', 'fiber', 'health_score'],
        additionalProperties: false,
      },
    },
  },
  required: ['meal_name', 'confidence', 'note', 'items'],
  additionalProperties: false,
};

const AI_SYSTEM = `Si skúsený výživový analytik. Z fotky a/alebo popisu identifikuj každú samostatnú zložku jedla.
- Odhadni hmotnosť každej zložky v gramoch podľa veľkosti porcie (bežný tanier má ~26 cm, použi príbor a ruky ako mierku).
- Nutričné hodnoty uveď pre CELÚ odhadnutú porciu danej zložky, nie na 100 g.
- Ak používateľ uvedie gramáž, značku alebo spôsob prípravy, má to prednosť pred odhadom. Počítaj aj s olejom/maslom pri príprave.
- Názvy píš po slovensky, krátko (napr. "Ryža biela varená").
- health_score 1–10: 10 = nespracované, výživné potraviny; 5 = bežné; 1 = ultraspracované, veľa cukru, vyprážané.
- note: 1–2 vety po slovensky, zhodnoť jedlo vzhľadom na cieľ používateľa (napr. či má dosť bielkovín) a daj jeden konkrétny tip.
- Ak na fotke nie je jedlo, vráť prázdne items a vysvetli to v note.`;

async function analyzeFood({ image, text }) {
  const key = getKey();
  if (!key) throw new Error('Chýba API kľúč. Zadaj ho v Profile.');
  const model = S.profile.model || MODELS[0][0];
  const t = targets();
  const goal = Number(S.profile.surplus) > 0 ? 'priberať svalovú hmotu' : 'udržať váhu';
  const content = [];
  if (image) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } });
  content.push({
    type: 'text',
    text: `Cieľ používateľa: ${goal}${t ? ` (${t.kcal} kcal, ${t.p} g bielkovín denne)` : ''}.\n` +
      (text ? `Popis od používateľa: ${text}` : 'Analyzuj jedlo na fotke.'),
  });
  const body = {
    model,
    max_tokens: 8000,
    system: AI_SYSTEM,
    messages: [{ role: 'user', content }],
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: AI_SCHEMA } },
  };
  const headers = {
    'content-type': 'application/json',
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  if (!model.includes('haiku')) {
    // Pri odmietnutí bezpečnostným filtrom server automaticky skúsi iný model.
    headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
    body.fallbacks = 'default';
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText;
    if (res.status === 401) throw new Error('Neplatný API kľúč.');
    if (res.status === 429) throw new Error('Príliš veľa požiadaviek, skús o chvíľu.');
    throw new Error(`Chyba API (${res.status}): ${msg}`);
  }
  if (data.stop_reason === 'refusal') throw new Error('AI odmietla analýzu. Skús iný popis alebo fotku.');
  if (data.stop_reason === 'max_tokens') throw new Error('Odpoveď bola príliš dlhá. Skús znova.');
  const block = (data.content || []).find(b => b.type === 'text');
  if (!block) throw new Error('Prázdna odpoveď od AI.');
  return JSON.parse(block.text);
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Fotku sa nepodarilo načítať.')); };
    img.src = url;
  });
}

function resize(img, max, quality) {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

function thumbOf(img) {
  // Štvorcový výrez 72 px do zoznamu jedál.
  const s = Math.min(img.naturalWidth, img.naturalHeight);
  const c = document.createElement('canvas');
  c.width = c.height = 72;
  c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 72, 72);
  return c.toDataURL('image/jpeg', 0.55);
}

// ---------- Sheet: pridávanie ----------
let addMeal = defaultMeal();
let pendingPhoto = null; // { dataUrl, base64, thumb }

function openSheet(title, html) {
  $('#sheet-title').textContent = title;
  $('#sheet-body').innerHTML = html;
  $('#sheet-bg').hidden = false;
}
function closeSheet() {
  $('#sheet-bg').hidden = true;
  $('#sheet-body').innerHTML = '';
  pendingPhoto = null;
}

function mealSelect(sel) {
  return `<div class="seg" id="meal-seg">${MEALS.map(([k, l]) =>
    `<button type="button" data-meal="${k}" class="${k === sel ? 'on' : ''}">${l.split(' ')[0]}</button>`).join('')}</div>`;
}

function recentFoods() {
  const seen = new Set(), out = [];
  for (const e of [...S.entries].sort((a, b) => b.ts - a.ts)) {
    const k = norm(e.name);
    if (seen.has(k) || !e.g) continue;
    seen.add(k);
    out.push(e);
    if (out.length >= 15) break;
  }
  return out;
}

function openAdd(meal) {
  addMeal = meal || (curDate === todayKey() ? defaultMeal() : 'obed');
  const recent = recentFoods();
  openSheet('Pridať jedlo', `
    ${mealSelect(addMeal)}
    <div class="big-actions">
      <button class="btn primary" id="act-photo"><span>📷</span>Odfotiť jedlo</button>
      <button class="btn" id="act-text"><span>✍️</span>Opísať textom</button>
    </div>
    <input class="input" id="food-search" type="search" placeholder="🔎 Hľadať potravinu (ryža, vajce, tvaroh…)" autocomplete="off">
    <div id="search-results"></div>
    ${recent.length ? `<h3 style="margin:16px 0 4px;font-size:14px">⏱ Naposledy jedené</h3>
      ${recent.map(e => `<button class="list-item" data-recent="${e.id}"><span>${esc(e.name)}</span>
        <span class="muted small">${r0(e.g)} g · ${r0(e.kcal)} kcal</span></button>`).join('')}` : ''}
    <div style="margin-top:16px"><button class="btn" id="act-custom">➕ Vlastná položka</button></div>
  `);
}

function renderSearch(q) {
  const box = $('#search-results');
  if (!box) return;
  const nq = norm(q.trim());
  if (!nq) { box.innerHTML = ''; return; }
  const hits = FOODS.map((f, i) => [f, i]).filter(([f]) => norm(f[0]).includes(nq)).slice(0, 12);
  box.innerHTML = hits.length
    ? hits.map(([f, i]) => `<button class="list-item" data-food="${i}"><span>${esc(f[0])}</span>
        <span class="muted small">${f[1]} kcal / 100 g</span></button>`).join('')
    : `<div class="empty" style="padding:10px 0">Nenašiel som. Skús <b>Opísať textom</b> – AI to dopočíta.</div>`;
}

// Výber gramáže pre potravinu so známymi hodnotami na gram.
function openPortion({ name, per, score, g, thumb }) {
  openSheet(name, `
    ${mealSelect(addMeal)}
    <label class="field">Množstvo (g)<input class="input" id="portion-g" type="number" inputmode="decimal" min="0" value="${r0(g)}"></label>
    <div class="grid3" id="portion-info"></div>
    <div style="margin-top:14px"><button class="btn primary" id="portion-save">Pridať</button></div>
  `);
  const upd = () => {
    const gg = Number($('#portion-g').value) || 0;
    $('#portion-info').innerHTML = `
      <div class="stat"><b>${r0(per.kcal * gg)}</b><span class="small muted">kcal</span></div>
      <div class="stat"><b>${r0(per.p * gg)} g</b><span class="small muted">bielkoviny</span></div>
      <div class="stat"><b><span class="score ${scoreClass(score)}">${score}</span></b><span class="small muted">zdravosť</span></div>`;
  };
  $('#portion-g').addEventListener('input', upd);
  upd();
  $('#portion-save').onclick = () => {
    const gg = Number($('#portion-g').value) || 0;
    if (gg <= 0) return toast('Zadaj množstvo.');
    addEntries([{ name, g: gg, kcal: per.kcal * gg, p: per.p * gg, c: per.c * gg, f: per.f * gg, fib: per.fib * gg, score, thumb }], 'db');
  };
}

function perGramFromEntry(e) {
  const g = e.g || 1;
  return { kcal: e.kcal / g, p: e.p / g, c: e.c / g, f: e.f / g, fib: (e.fib || 0) / g };
}

function openCustom() {
  openSheet('Vlastná položka', `
    ${mealSelect(addMeal)}
    <label class="field">Názov<input class="input" id="c-name" placeholder="napr. Domáci guláš"></label>
    <div class="grid2">
      <label class="field">Množstvo (g)<input class="input" id="c-g" type="number" inputmode="decimal" value="100"></label>
      <label class="field">Kalórie (kcal)<input class="input" id="c-kcal" type="number" inputmode="decimal"></label>
      <label class="field">Bielkoviny (g)<input class="input" id="c-p" type="number" inputmode="decimal"></label>
      <label class="field">Sacharidy (g)<input class="input" id="c-c" type="number" inputmode="decimal"></label>
      <label class="field">Tuky (g)<input class="input" id="c-f" type="number" inputmode="decimal"></label>
      <label class="field">Vláknina (g)<input class="input" id="c-fib" type="number" inputmode="decimal"></label>
    </div>
    <label class="field">Zdravosť 1–10<input class="input" id="c-score" type="number" min="1" max="10" value="5"></label>
    <button class="btn primary" id="c-save">Pridať</button>
  `);
  $('#c-save').onclick = () => {
    const v = id => Number($(id).value) || 0;
    const name = $('#c-name').value.trim();
    if (!name || !v('#c-kcal')) return toast('Vyplň názov a kalórie.');
    addEntries([{ name, g: v('#c-g'), kcal: v('#c-kcal'), p: v('#c-p'), c: v('#c-c'), f: v('#c-f'), fib: v('#c-fib'),
      score: Math.min(10, Math.max(1, v('#c-score') || 5)) }], 'manual');
  };
}

function openTextAI() {
  openSheet('Opísať jedlo', `
    ${mealSelect(addMeal)}
    <label class="field">Čo si jedol?
      <textarea class="input" id="ai-text" placeholder="napr. 200 g kuracích pŕs, 250 g ryže, šalát s olivovým olejom"></textarea></label>
    <button class="btn primary" id="ai-go">✨ Vypočítať</button>
  `);
  $('#ai-text').focus();
  $('#ai-go').onclick = () => {
    const text = $('#ai-text').value.trim();
    if (!text) return toast('Napíš, čo si jedol.');
    runAI({ text });
  };
}

function openPhotoReview() {
  openSheet('Fotka jedla', `
    ${mealSelect(addMeal)}
    <img class="preview" src="${pendingPhoto.dataUrl}" alt="Fotka jedla">
    <label class="field">Doplnenie (nepovinné)
      <input class="input" id="ai-text" placeholder="napr. 300 g, varené na masle, proteínový nápoj"></label>
    <button class="btn primary" id="ai-go">✨ Analyzovať fotku</button>
  `);
  $('#ai-go').onclick = () => runAI({ image: pendingPhoto.base64, text: $('#ai-text').value.trim() });
}

async function runAI({ image, text }) {
  const btn = $('#ai-go');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Analyzujem…';
  try {
    const res = await analyzeFood({ image, text });
    showAIResult(res);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = '✨ Skúsiť znova';
    toast(err.message || 'Niečo sa pokazilo.');
    if (!getKey()) { closeSheet(); show('profile'); }
  }
}

function showAIResult(res) {
  const items = (res.items || []).map(it => {
    const g = Math.max(1, Number(it.grams) || 1);
    return { name: it.name, g, base: g, kcal: it.kcal, p: it.protein, c: it.carbs, f: it.fat, fib: it.fiber,
      score: Math.min(10, Math.max(1, Math.round(it.health_score || 5))) };
  });
  const conf = { low: 'nízka', medium: 'stredná', high: 'vysoká' }[res.confidence] || res.confidence;
  const thumb = pendingPhoto?.thumb;
  const draw = () => {
    const tot = items.reduce((s, it) => {
      const k = it.g / it.base;
      s.kcal += it.kcal * k; s.p += it.p * k; s.c += it.c * k; s.f += it.f * k;
      return s;
    }, { kcal: 0, p: 0, c: 0, f: 0 });
    openSheet(res.meal_name || 'Výsledok', `
      ${mealSelect(addMeal)}
      ${pendingPhoto ? `<img class="preview" src="${pendingPhoto.dataUrl}" alt="">` : ''}
      <div class="card" style="background:var(--card2)">
        <div class="grid3">
          <div><b style="font-size:20px">${r0(tot.kcal)}</b><div class="small muted">kcal</div></div>
          <div><b style="font-size:20px">${r0(tot.p)} g</b><div class="small muted">bielkoviny</div></div>
          <div><b style="font-size:20px">${r0(tot.c)}/${r0(tot.f)}</b><div class="small muted">sach./tuky g</div></div>
        </div>
        <p class="small" style="margin:10px 0 0">${esc(res.note)}</p>
        <p class="small muted" style="margin:6px 0 0">Istota AI: ${esc(conf)} · uprav gramy, ak nesedia.</p>
      </div>
      ${items.map((it, i) => {
        const k = it.g / it.base;
        return `<div class="ai-item"><div class="row">
          <input class="input" data-ai-name="${i}" value="${esc(it.name)}" style="flex:1">
          <input class="input grams" data-ai-g="${i}" type="number" inputmode="decimal" value="${r0(it.g)}" aria-label="gramy">
          <button class="icon-btn" data-ai-del="${i}" aria-label="Odstrániť" style="font-size:16px">✕</button></div>
          <div class="small muted" style="margin-top:6px">${r0(it.kcal * k)} kcal · B ${r0(it.p * k)} · S ${r0(it.c * k)} · T ${r0(it.f * k)}
          · <span class="score ${scoreClass(it.score)}">${it.score}</span></div></div>`;
      }).join('')}
      ${items.length ? '<button class="btn primary" id="ai-save">Uložiť jedlo</button>' : '<div class="empty">AI nenašla žiadne jedlo.</div>'}
    `);
    document.querySelectorAll('[data-ai-g]').forEach(inp => inp.addEventListener('change', () => {
      items[inp.dataset.aiG].g = Math.max(0, Number(inp.value) || 0);
      draw();
    }));
    document.querySelectorAll('[data-ai-name]').forEach(inp => inp.addEventListener('input', () => {
      items[inp.dataset.aiName].name = inp.value;
    }));
    document.querySelectorAll('[data-ai-del]').forEach(b => b.addEventListener('click', () => {
      items.splice(Number(b.dataset.aiDel), 1);
      draw();
    }));
    const saveBtn = $('#ai-save');
    if (saveBtn) saveBtn.onclick = () => {
      const out = items.filter(it => it.g > 0).map((it, i) => {
        const k = it.g / it.base;
        return { name: it.name.trim() || 'Jedlo', g: it.g, kcal: it.kcal * k, p: it.p * k, c: it.c * k, f: it.f * k,
          fib: it.fib * k, score: it.score, thumb: i === 0 ? thumb : undefined };
      });
      addEntries(out, thumb ? 'foto' : 'text');
    };
  };
  draw();
}

function addEntries(list, src) {
  const now = Date.now();
  for (const it of list) {
    const e = { id: uid(), ts: now, date: curDate, meal: addMeal, src, name: it.name, g: r1(it.g),
      kcal: r1(it.kcal), p: r1(it.p), c: r1(it.c), f: r1(it.f), fib: r1(it.fib), score: it.score };
    if (it.thumb) e.thumb = it.thumb;
    S.entries.push(e);
  }
  save();
  closeSheet();
  show('today');
  toast(`Pridané: ${list.length === 1 ? list[0].name : list.length + ' položky'}`);
}

function openEntry(id) {
  const e = S.entries.find(x => x.id === id);
  if (!e) return;
  addMeal = e.meal;
  const per = perGramFromEntry(e);
  openSheet(e.name, `
    ${mealSelect(e.meal)}
    <label class="field">Množstvo (g)<input class="input" id="e-g" type="number" inputmode="decimal" value="${r0(e.g)}"></label>
    <p class="small muted" id="e-info"></p>
    <div class="grid2"><button class="btn danger" id="e-del">Zmazať</button><button class="btn primary" id="e-save">Uložiť</button></div>
    <div style="margin-top:10px"><button class="btn" id="e-again">Zjesť znova dnes</button></div>
  `);
  const upd = () => {
    const g = Number($('#e-g').value) || 0;
    $('#e-info').textContent = `${r0(per.kcal * g)} kcal · B ${r0(per.p * g)} g · S ${r0(per.c * g)} g · T ${r0(per.f * g)} g · zdravosť ${e.score}/10`;
  };
  $('#e-g').addEventListener('input', upd);
  upd();
  $('#e-del').onclick = () => {
    S.entries = S.entries.filter(x => x.id !== id);
    save(); closeSheet(); render(); toast('Zmazané');
  };
  $('#e-save').onclick = () => {
    const g = Number($('#e-g').value) || 0;
    if (g <= 0) return toast('Zadaj množstvo.');
    Object.assign(e, { meal: addMeal, g, kcal: r1(per.kcal * g), p: r1(per.p * g), c: r1(per.c * g), f: r1(per.f * g), fib: r1(per.fib * g) });
    save(); closeSheet(); render();
  };
  $('#e-again').onclick = () => {
    curDate = todayKey();
    addMeal = defaultMeal();
    const g = Number($('#e-g').value) || e.g;
    addEntries([{ name: e.name, g, kcal: per.kcal * g, p: per.p * g, c: per.c * g, f: per.f * g, fib: per.fib * g, score: e.score }], 'db');
  };
}

// ---------- Štatistiky ----------
let statDays = 7;

function renderStats() {
  const el = $('#view-stats');
  const t = targets();
  const days = [];
  for (let i = statDays - 1; i >= 0; i--) days.push(dayKey(addDays(new Date(), -i)));
  const tots = days.map(d => ({ d, ...dayTotals(d) }));
  const logged = tots.filter(x => x.n > 0);
  const inRange = S.entries.filter(e => e.date >= days[0]);
  const avg = k => logged.length ? logged.reduce((s, x) => s + x[k], 0) / logged.length : 0;

  let html = `<div class="seg">${[7, 30].map(n => `<button data-days="${n}" class="${n === statDays ? 'on' : ''}">${n} dní</button>`).join('')}</div>`;

  if (!logged.length) {
    el.innerHTML = html + '<div class="card empty">Zatiaľ žiadne záznamy v tomto období. Pridaj prvé jedlo cez <b>+</b>.</div>';
    return;
  }

  // Graf kalórií
  const W = 320, H = 140, pad = 4;
  const maxV = Math.max(t?.kcal || 0, ...tots.map(x => x.kcal)) * 1.1 || 1;
  const bw = (W - pad * 2) / tots.length;
  const bars = tots.map((x, i) => {
    const h = (x.kcal / maxV) * (H - 18);
    const ok = t && x.kcal >= t.kcal * 0.9;
    return `<rect x="${pad + i * bw + bw * 0.15}" y="${H - 14 - h}" width="${bw * 0.7}" height="${h}" rx="3"
      fill="${ok ? 'var(--kcal)' : 'var(--c)'}" opacity="${x.n ? 1 : 0.25}"/>` +
      (statDays === 7 ? `<text x="${pad + i * bw + bw / 2}" y="${H - 2}" font-size="10" text-anchor="middle" fill="var(--muted)">${parseDay(x.d).toLocaleDateString('sk-SK', { weekday: 'narrow' })}</text>` : '');
  }).join('');
  const ty = t ? H - 14 - (t.kcal / maxV) * (H - 18) : null;
  html += `<div class="card chart"><h3>Kalórie</h3><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Graf kalórií po dňoch">${bars}
    ${t ? `<line x1="0" x2="${W}" y1="${ty}" y2="${ty}" stroke="var(--text)" stroke-dasharray="4 4" opacity=".5"/>` : ''}</svg>
    <p class="small muted" style="margin:6px 0 0">Prerušovaná čiara = cieľ ${t ? t.kcal + ' kcal' : ''}. Zelená = splnené (≥ 90 %).</p></div>`;

  // Čísla
  const pHit = t ? logged.filter(x => x.p >= t.p * 0.9).length : 0;
  const kHit = t ? logged.filter(x => x.kcal >= t.kcal * 0.9).length : 0;
  const scoreAll = inRange.reduce((s, e) => s + (e.score || 5) * e.kcal, 0) / (inRange.reduce((s, e) => s + e.kcal, 0) || 1);
  html += `<div class="card"><h3>Priemer za zapísané dni (${logged.length}/${statDays})</h3><div class="grid2">
    <div class="stat"><b>${r0(avg('kcal'))}</b><span class="small muted">kcal ${t ? '/ ' + t.kcal : ''}</span></div>
    <div class="stat"><b>${r0(avg('p'))} g</b><span class="small muted">bielkoviny ${t ? '/ ' + t.p : ''}</span></div>
    <div class="stat"><b>${t ? kHit + '×' : '–'}</b><span class="small muted">dní splnené kcal</span></div>
    <div class="stat"><b>${t ? pHit + '×' : '–'}</b><span class="small muted">dní splnené bielkoviny</span></div>
    <div class="stat"><b><span class="score ${scoreClass(scoreAll)}">${r1(scoreAll)}</span></b><span class="small muted">zdravosť (vážená kcal)</span></div>
    <div class="stat"><b>${streak()} 🔥</b><span class="small muted">dní v rade</span></div>
  </div></div>`;

  // Rozloženie jedál
  const byMeal = Object.fromEntries(MEALS.map(([k]) => [k, 0]));
  inRange.forEach(e => { byMeal[e.meal] = (byMeal[e.meal] || 0) + e.kcal; });
  const totK = Object.values(byMeal).reduce((a, b) => a + b, 0) || 1;
  html += `<div class="card"><h3>Kedy ješ</h3>${MEALS.map(([k, l]) => bar(l, (byMeal[k] / totK) * 100, 100, 'var(--p)', '%')).join('')}</div>`;

  // Top jedlá
  const cnt = {};
  inRange.forEach(e => { const k = e.name; cnt[k] = (cnt[k] || 0) + 1; });
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 6);
  html += `<div class="card"><h3>Najčastejšie jedlá</h3>${top.map(([n, c]) =>
    `<div class="row between small" style="padding:4px 0"><span>${esc(n)}</span><span class="chip">${c}×</span></div>`).join('')}</div>`;

  // Návyky – tipy
  const tips = habitTips({ t, logged, inRange, days, byMeal, totK, pHit, kHit, scoreAll });
  html += `<div class="card"><h3>💡 Návyky a tipy</h3><ul class="tips">${tips.map(x => `<li>${x}</li>`).join('')}</ul></div>`;

  el.innerHTML = html;
}

function streak() {
  const dates = new Set(S.entries.map(e => e.date));
  let d = new Date();
  if (!dates.has(dayKey(d))) d = addDays(d, -1);
  let n = 0;
  while (dates.has(dayKey(d))) { n++; d = addDays(d, -1); }
  return n;
}

function habitTips({ t, logged, inRange, days, byMeal, totK, pHit, kHit, scoreAll }) {
  const tips = [];
  const L = logged.length;
  if (L < days.length) tips.push(`Zapísal si ${L} z ${days.length} dní. Pravidelné zapisovanie je základ – aj odhad je lepší ako nič.`);
  if (t) {
    if (kHit < L * 0.7) tips.push(`Kalórie si splnil len ${kHit}/${L} dní. Na priberanie pridaj kalorické jedlá: ovsené vločky s arašidovým maslom, orechy, olivový olej do jedla, mliečny shake.`);
    else tips.push(`Kalórie si plníš ${kHit}/${L} dní – výborne, drž to. 💪`);
    if (pHit < L * 0.7) tips.push(`Bielkoviny pod cieľom ${L - pHit}/${L} dní. Daj do každého jedla zdroj bielkovín (mäso, vajcia, tvaroh, skyr, proteín).`);
    const fibAvg = logged.reduce((s, x) => s + x.fib, 0) / L;
    if (fibAvg < t.fib * 0.6) tips.push(`Vlákniny máš málo (${r0(fibAvg)} g z ${t.fib} g). Pridaj zeleninu, strukoviny, ovocie a celozrnné pečivo.`);
  }
  if (byMeal.ranajky / totK < 0.1 && L >= 3) tips.push('Raňajky skoro vynechávaš. Pri priberaní je ľahšie dať cieľ, keď začneš deň poriadnym jedlom.');
  const late = inRange.filter(e => new Date(e.ts).getHours() >= 21).length;
  if (late >= 3) tips.push(`${late}× si jedol po 21:00. Neskoré veľké jedlá môžu zhoršiť spánok a regeneráciu.`);
  if (scoreAll < 5) tips.push('Priemerná zdravosť je nízka. Nahraď časť fastfoodu a sladkostí plnohodnotnými jedlami – kalórie dáš aj zdravšie.');
  else if (scoreAll >= 7) tips.push('Ješ prevažne kvalitné potraviny. 👌');
  const avgMeals = inRange.length / (L || 1);
  if (avgMeals < 3 && L >= 3) tips.push('Ješ málo položiek denne. Na priberanie pomáha 4–5 jedál denne.');
  return tips;
}

// ---------- Váha ----------
function weightTrend() {
  const ws = [...S.weights].sort((a, b) => a.date.localeCompare(b.date));
  if (ws.length < 2) return null;
  const last = parseDay(ws.at(-1).date);
  const recent = ws.filter(w => (last - parseDay(w.date)) / 864e5 <= 28);
  if (recent.length < 2) return null;
  const span = (last - parseDay(recent[0].date)) / 864e5;
  if (span < 7) return null;
  // Lineárna regresia kg vs. deň.
  const xs = recent.map(w => (parseDay(w.date) - last) / 864e5), ys = recent.map(w => w.kg);
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0) || 1;
  const perWeek = (num / den) * 7;
  return { perWeek, pct: (perWeek / my) * 100 };
}

function renderWeight() {
  const el = $('#view-weight');
  const ws = [...S.weights].sort((a, b) => a.date.localeCompare(b.date));
  let html = `<div class="card"><h3>Zapísať váhu</h3><div class="row">
    <input class="input" id="w-kg" type="number" step="0.1" inputmode="decimal" placeholder="kg" value="${ws.at(-1)?.kg ?? S.profile.weight ?? ''}" style="margin:0">
    <button class="btn primary sm" id="w-save" style="padding:11px 18px">Uložiť</button></div>
    <p class="small muted" style="margin:8px 0 0">Váž sa ráno po toalete, nalačno. Ideálne 2–3× týždenne.</p></div>`;

  if (ws.length >= 2) {
    const pts = ws.slice(-60);
    const W = 320, H = 150, P = 24;
    const min = Math.min(...pts.map(p => p.kg)) - 0.5, max = Math.max(...pts.map(p => p.kg)) + 0.5;
    const t0 = parseDay(pts[0].date), t1 = parseDay(pts.at(-1).date);
    const span = Math.max(1, (t1 - t0) / 864e5);
    const xy = p => [P + ((parseDay(p.date) - t0) / 864e5 / span) * (W - P - 6), 6 + (1 - (p.kg - min) / (max - min)) * (H - 26)];
    const path = pts.map((p, i) => (i ? 'L' : 'M') + xy(p).map(n => n.toFixed(1)).join(' ')).join(' ');
    html += `<div class="card chart"><h3>Priebeh</h3><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Graf váhy">
      <text x="0" y="12" font-size="10" fill="var(--muted)">${r1(max)}</text>
      <text x="0" y="${H - 20}" font-size="10" fill="var(--muted)">${r1(min)}</text>
      <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>
      ${pts.map(p => { const [x, y] = xy(p); return `<circle cx="${x}" cy="${y}" r="3" fill="var(--accent)"/>`; }).join('')}
      </svg></div>`;
  }

  const tr = weightTrend();
  if (tr) {
    let advice, delta = 0;
    if (tr.pct < 0.1) { advice = 'Váha stojí alebo klesá. Pridaj ~150 kcal denne.'; delta = 150; }
    else if (tr.pct < 0.25) { advice = 'Priberáš pomaly. Môžeš pridať ~100 kcal denne.'; delta = 100; }
    else if (tr.pct <= 0.5) { advice = 'Ideálne tempo na čistý nárast svalov. Nič nemeň. ✅'; }
    else if (tr.pct <= 0.75) { advice = 'Priberáš trochu rýchlo. Zváž ubrať ~100 kcal.'; delta = -100; }
    else { advice = 'Priberáš príliš rýchlo – pribúda aj tuk. Uber ~150 kcal denne.'; delta = -150; }
    html += `<div class="card"><h3>Tempo (posledné 4 týždne)</h3>
      <p style="margin:0 0 6px"><b>${tr.perWeek >= 0 ? '+' : ''}${tr.perWeek.toFixed(2)} kg / týždeň</b>
      <span class="muted small">(${tr.pct.toFixed(2)} % hmotnosti, cieľ 0,25–0,5 %)</span></p>
      <p class="small" style="margin:0 0 10px">${advice}</p>
      ${delta ? `<button class="btn sm" id="w-apply" data-delta="${delta}">Upraviť cieľ o ${delta > 0 ? '+' : ''}${delta} kcal</button>` : ''}</div>`;
  } else {
    html += '<div class="card small muted">Tempo a odporúčania uvidíš po aspoň 7 dňoch záznamov váhy.</div>';
  }

  if (ws.length) {
    html += `<div class="card"><h3>Záznamy</h3>${[...ws].reverse().slice(0, 14).map(w =>
      `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>${fmtDay(w.date)}</span>
        <span><b>${w.kg} kg</b> <button class="icon-btn" data-wdel="${w.date}" aria-label="Zmazať" style="width:32px;height:32px;font-size:14px;margin-left:6px">✕</button></span></div>`).join('')}</div>`;
  }
  el.innerHTML = html;

  $('#w-save').onclick = () => {
    const kg = Number(String($('#w-kg').value).replace(',', '.'));
    if (!(kg > 20 && kg < 400)) return toast('Zadaj platnú váhu.');
    const d = todayKey();
    S.weights = S.weights.filter(w => w.date !== d);
    S.weights.push({ date: d, kg: r1(kg) });
    S.profile.weight = r1(kg);
    save(); render(); toast('Váha uložená');
  };
  const ap = $('#w-apply');
  if (ap) ap.onclick = () => {
    S.profile.surplus = Number(S.profile.surplus || 0) + Number(ap.dataset.delta);
    save(); toast(`Nový prebytok: ${S.profile.surplus} kcal`); render();
  };
}

// ---------- Profil ----------
function renderProfile() {
  const el = $('#view-profile');
  const p = S.profile;
  const t = targets();
  const opt = (val, list) => list.map(([v, l]) => `<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${l}</option>`).join('');
  el.innerHTML = `
    ${!p.age ? '<div class="warn">Vitaj! 👋 Vyplň údaje, nech ti vypočítam ciele na priberanie.</div>' : ''}
    <form class="card" id="profile-form">
      <h3>Moje údaje</h3>
      <div class="grid2">
        <label class="field">Pohlavie<select name="sex">${opt(p.sex, [['m', 'Muž'], ['f', 'Žena']])}</select></label>
        <label class="field">Vek<input name="age" type="number" inputmode="numeric" value="${p.age ?? ''}"></label>
        <label class="field">Výška (cm)<input name="height" type="number" inputmode="numeric" value="${p.height ?? ''}"></label>
        <label class="field">Váha (kg)<input name="weight" type="number" step="0.1" inputmode="decimal" value="${currentWeight() ?? ''}"></label>
      </div>
      <label class="field">Aktivita<select name="activity">${opt(p.activity, [
        [1.375, 'Sedavá práca + tréning 2–3× týždenne'],
        [1.55, 'Tréning 3–5× týždenne'],
        [1.725, 'Tréning 6–7× týždenne / fyzická práca'],
        [1.9, 'Veľmi vysoká (2× denne, ťažká práca)'],
      ])}</select></label>
      <label class="field">Cieľ<select name="goal">${opt([0, 250, 350, 500].includes(Number(p.surplus)) ? p.surplus : 'x', [
        [0, 'Udržať váhu'],
        [250, 'Pomalé priberanie (+250 kcal)'],
        [350, 'Priberanie svalov (+350 kcal) – odporúčané'],
        [500, 'Rýchle priberanie (+500 kcal)'],
        ['x', `Vlastné (${p.surplus} kcal)`],
      ])}</select></label>
      <label class="field">Bielkoviny (g na kg)<input name="proteinPerKg" type="number" step="0.1" inputmode="decimal" value="${p.proteinPerKg}"></label>
      <button class="btn primary">Uložiť</button>
    </form>
    ${t ? `<div class="card"><h3>Tvoje denné ciele</h3><div class="grid3">
      <div class="stat"><b>${t.kcal}</b><span class="small muted">kcal</span></div>
      <div class="stat"><b>${t.p} g</b><span class="small muted">bielkoviny</span></div>
      <div class="stat"><b>${t.c} g</b><span class="small muted">sacharidy</span></div>
      <div class="stat"><b>${t.f} g</b><span class="small muted">tuky</span></div>
      <div class="stat"><b>${t.fib} g</b><span class="small muted">vláknina</span></div>
      <div class="stat"><b>${t.water / 1000} l</b><span class="small muted">voda</span></div></div>
      <p class="small muted" style="margin:10px 0 0">Bazálny metabolizmus ${t.bmr} kcal · výdaj ${t.tdee} kcal · prebytok ${p.surplus} kcal.</p></div>` : ''}
    <div class="card"><h3>AI rozpoznávanie jedla</h3>
      <label class="field">Anthropic API kľúč<input class="input" id="api-key" type="password" autocomplete="off" placeholder="sk-ant-…" value="${esc(getKey())}"></label>
      <label class="field">Model<select class="input" id="api-model">${opt(p.model, MODELS)}</select></label>
      <button class="btn" id="key-save">Uložiť kľúč</button>
      <p class="small muted" style="margin:10px 0 0">Kľúč získaš na console.anthropic.com → API Keys. Ostáva uložený len v tomto zariadení a posiela sa iba do Anthropic API. Nastav si tam mesačný limit výdavkov.</p></div>
    <div class="card"><h3>Záloha</h3><div class="grid2">
      <button class="btn" id="exp">⬇️ Export</button><button class="btn" id="imp">⬆️ Import</button></div>
      <div style="margin-top:10px"><button class="btn danger" id="wipe">Zmazať všetky dáta</button></div>
      <p class="small muted" style="margin:10px 0 0">Dáta sú len v tomto prehliadači. Raz za čas si sprav export.</p></div>
    <p class="small muted" style="text-align:center">Odhady AI a databázy sú orientačné.</p>`;

  $('#profile-form').onsubmit = ev => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const num = k => { const v = Number(String(fd.get(k)).replace(',', '.')); return v > 0 ? v : null; };
    p.sex = fd.get('sex');
    p.age = num('age');
    p.height = num('height');
    p.activity = Number(fd.get('activity'));
    if (fd.get('goal') !== 'x') p.surplus = Number(fd.get('goal'));
    p.proteinPerKg = num('proteinPerKg') || 2;
    const w = num('weight');
    if (w && w !== currentWeight()) {
      p.weight = w;
      const d = todayKey();
      S.weights = S.weights.filter(x => x.date !== d);
      S.weights.push({ date: d, kg: r1(w) });
    }
    save(); render(); toast('Profil uložený');
  };
  $('#key-save').onclick = () => {
    setKey($('#api-key').value.trim());
    p.model = $('#api-model').value;
    save(); toast('Nastavenia AI uložené');
  };
  $('#exp').onclick = () => {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `jedlo-zaloha-${todayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('#imp').onclick = () => $('#import-input').click();
  $('#wipe').onclick = () => {
    if (!confirm('Naozaj zmazať všetky jedlá, váhu a profil? Toto sa nedá vrátiť.')) return;
    S = defaultState(); save(); render(); toast('Všetko zmazané');
  };
}

// ---------- Udalosti ----------
document.addEventListener('click', ev => {
  const t = ev.target.closest('button, a');
  if (!t) return;
  const d = t.dataset;
  if (d.view) show(d.view);
  else if (d.go) show(d.go);
  else if (d.water) {
    S.water[curDate] = Math.max(0, (S.water[curDate] || 0) + Number(d.water));
    save(); render();
  } else if (d.addMeal) { ev.preventDefault(); openAdd(d.addMeal); }
  else if (d.entry) openEntry(d.entry);
  else if (d.meal) {
    addMeal = d.meal;
    document.querySelectorAll('#meal-seg button').forEach(b => b.classList.toggle('on', b.dataset.meal === addMeal));
  } else if (d.food) {
    const f = FOODS[Number(d.food)];
    openPortion({ name: f[0], per: { kcal: f[1] / 100, p: f[2] / 100, c: f[3] / 100, f: f[4] / 100, fib: f[5] / 100 }, score: f[6], g: f[7] });
  } else if (d.recent) {
    const e = S.entries.find(x => x.id === d.recent);
    if (e) openPortion({ name: e.name, per: perGramFromEntry(e), score: e.score, g: e.g });
  } else if (d.days) { statDays = Number(d.days); render(); }
  else if (d.wdel) {
    S.weights = S.weights.filter(w => w.date !== d.wdel);
    save(); render();
  } else if (t.id === 'act-photo') $('#photo-input').click();
  else if (t.id === 'act-text') openTextAI();
  else if (t.id === 'act-custom') openCustom();
});

document.addEventListener('input', ev => {
  if (ev.target.id === 'food-search') renderSearch(ev.target.value);
});

$('#open-add').onclick = () => openAdd();
$('#close-add').onclick = closeSheet;
$('#sheet-bg').addEventListener('click', ev => { if (ev.target.id === 'sheet-bg') closeSheet(); });
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('#sheet-bg').hidden) closeSheet(); });

$('#prev-day').onclick = () => { curDate = dayKey(addDays(parseDay(curDate), -1)); render(); };
$('#next-day').onclick = () => { if (curDate < todayKey()) { curDate = dayKey(addDays(parseDay(curDate), 1)); render(); } };

$('#photo-input').addEventListener('change', async ev => {
  const file = ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  try {
    const img = await loadImage(file);
    const dataUrl = resize(img, 1024, 0.8);
    pendingPhoto = { dataUrl, base64: dataUrl.split(',')[1], thumb: thumbOf(img) };
    openPhotoReview();
  } catch (err) {
    toast(err.message);
  }
});

$('#import-input').addEventListener('change', async ev => {
  const file = ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.entries)) throw new Error();
    const d = defaultState();
    S = { ...d, ...data, profile: { ...d.profile, ...data.profile } };
    save(); render(); toast('Záloha načítaná');
  } catch {
    toast('Neplatný súbor zálohy.');
  }
});

// Po polnoci prepni „Dnes“ na nový deň, ak appka ostala otvorená.
let lastToday = todayKey();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const now = todayKey();
  if (now !== lastToday) {
    if (curDate === lastToday) curDate = now;
    lastToday = now;
    render();
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

show(S.profile.age ? 'today' : 'profile');
