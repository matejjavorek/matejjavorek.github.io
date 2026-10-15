'use strict';

// ---------- Úložisko ----------
const STORE_KEY = 'jedlo.v1';
const KEY_KEY = 'jedlo.apikey';
const BOOK_KEY = 'jedlo.kucharka';
const MODELS = [
  ['claude-opus-5-5', 'Opus 5.5, presnejší'],
  ['claude-haiku-5-5', 'Haiku 5.5, lacnejší a rýchlejší'],
];
const DRINKS = [
  ['glass', 'Pohár', 250],
  ['bottle5', 'Fľaša 0,5 l', 500],
  ['bottle75', 'Fľaša 0,75 l', 750],
  ['bottle1', 'Fľaša 1 l', 1000],
];

function defaultState() {
  return {
    profile: { name: '', sex: 'm', age: null, height: null, weight: null, activity: 1.725, surplus: 350, proteinPerKg: 2, model: MODELS[0][0], suppList: ['Omega-3', 'Magnézium'] },
    entries: [],
    weights: [],
    water: {},
    fridge: [],
    recipeCat: 'snidane',
    days: {},
    supps: {},
    favs: [],
    recipeMeta: {},
    myRecipes: [],
    prices: [],
    lastBackup: Date.now(),
  };
}

// Uložené alebo importované dáta prevedie na správne typy (staré verzie, poškodené alebo podvrhnuté súbory).
function normalize(raw) {
  const d = defaultState();
  const obj = x => x && typeof x === 'object' && !Array.isArray(x) ? x : {};
  const arr = x => Array.isArray(x) ? x : [];
  const num = (x, def = 0) => Number.isFinite(Number(x)) && x !== null && x !== '' ? Number(x) : def;
  const pos = (x, def = 0) => Math.max(0, num(x, def));
  const optNum = x => num(x, 0) > 0 ? num(x) : null;
  const str = (x, max = 300) => typeof x === 'string' || typeof x === 'number' ? String(x).slice(0, max) : '';
  const idOf = x => str(x).replace(/[^\w-]/g, '') || Math.random().toString(36).slice(2, 10);
  const isDay = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
  const strs = x => arr(x).filter(v => typeof v === 'string' || typeof v === 'number').map(v => str(v));
  const byDay = (x, f) => Object.fromEntries(Object.entries(obj(x)).filter(([k]) => isDay(k)).map(([k, v]) => [k, f(v)]).filter(([, v]) => v != null));
  const s = obj(raw), p = obj(s.profile);
  const dayKeys = ['volno', 'praca', 'posilka', 'futbal', 'praca_trening', 'none'];
  const food = e => ({
    g: pos(e.g), kcal: pos(e.kcal), p: pos(e.p), c: pos(e.c), f: pos(e.f), fib: pos(e.fib),
    score: Math.min(10, Math.max(1, Math.round(num(e.score, 5)))),
    ...(['ano', 'nie', 'mozno'].includes(e.gluten) ? { gluten: e.gluten } : {}),
    ...(arr(e.allergens).length ? { allergens: strs(e.allergens) } : {}),
  });
  const items = x => arr(x).map(obj).map(i => ({ name: str(i.name), g: pos(i.g), kcal: pos(i.kcal) }));
  const plan = obj(s.mealPlan), pf = obj(plan.form), pr = obj(plan.result);
  return {
    ...d,
    profile: {
      ...d.profile,
      name: str(p.name, 40), sex: p.sex === 'f' ? 'f' : 'm',
      age: optNum(p.age), height: optNum(p.height), weight: optNum(p.weight),
      activity: num(p.activity, d.profile.activity) || d.profile.activity, surplus: num(p.surplus, d.profile.surplus),
      proteinPerKg: pos(p.proteinPerKg, 2) || 2, model: MODELS.some(m => m[0] === p.model) ? p.model : d.profile.model,
      suppList: 'suppList' in p ? strs(p.suppList).map(x => x.slice(0, 40)) : d.profile.suppList,
      glutenFree: !!p.glutenFree, allergens: strs(p.allergens),
      ...(p.cookPortions ? { cookPortions: Math.min(4, Math.max(1, Math.round(num(p.cookPortions, 1)))) } : {}),
      ...(isDay(p.surplusAdjusted) ? { surplusAdjusted: p.surplusAdjusted } : {}),
      week: Object.fromEntries(Object.entries(obj(p.week)).filter(([k, v]) => /^[0-6]$/.test(k) && dayKeys.includes(v))),
    },
    entries: arr(s.entries).map(obj).filter(e => isDay(e.date)).map(e => ({
      id: idOf(e.id), ts: num(e.ts, 0) || new Date(e.date + 'T12:00').getTime(), date: e.date, src: str(e.src, 20), name: str(e.name, 120) || 'Jedlo',
      ...food(e),
      ...(/^data:image\/jpeg;base64,[\w+/=]+$/.test(e.thumb || '') ? { thumb: e.thumb } : {}),
      ...(arr(e.items).length ? { items: items(e.items) } : {}),
    })),
    weights: arr(s.weights).map(obj).filter(w => isDay(w.date) && pos(w.kg) > 0).map(w => ({ date: w.date, kg: pos(w.kg) })),
    water: byDay(s.water, v => pos(v)),
    fridge: strs(s.fridge).map(x => x.replace(/[^\w-]/g, '')),
    recipeCat: str(s.recipeCat, 20) || d.recipeCat,
    days: byDay(s.days, v => { v = obj(v); return { type: dayKeys.includes(v.type) ? v.type : null, watch: optNum(v.watch) }; }),
    supps: byDay(s.supps, v => strs(v)),
    favs: arr(s.favs).map(obj).map(f => ({ id: idOf(f.id), name: str(f.name, 120) || 'Moje jedlo', items: arr(f.items).map(obj).map(i => ({ name: str(i.name, 120), ...food(i) })) })),
    recipeMeta: Object.fromEntries(Object.entries(obj(s.recipeMeta)).filter(([k]) => /^\d+$/.test(k)).map(([k, m]) => {
      m = obj(m); return [k, { ...(m.fav ? { fav: true } : {}), ...(m.rating ? { rating: Math.min(5, Math.max(0, Math.round(num(m.rating)))) } : {}), ...(m.note ? { note: str(m.note, 500) } : {}) }];
    })),
    myRecipes: arr(s.myRecipes).map(obj).filter(r => num(r.id) >= 100000).map(r => ({
      id: num(r.id), mine: true, source: /^https?:\/\//.test(r.source || '') ? str(r.source, 500) : '', title: str(r.title, 120) || 'Recept',
      cat: ['snidane', 'svaciny', 'hlavni', 'predzapas', 'dezerty'].includes(r.cat) ? r.cat : 'hlavni', time: pos(r.time), portions: 1, prep: false,
      kcal: pos(r.kcal), p: pos(r.p), c: pos(r.c), f: pos(r.f), fib: pos(r.fib), ing: strs(r.ing), steps: strs(r.steps),
      req: arr(r.req).map(a => strs(a).map(x => x.replace(/[^\w-]/g, ''))),
      ...(r.ingx ? { ingx: Object.fromEntries(Object.entries(obj(r.ingx)).filter(([k]) => /^[2-4]$/.test(k)).map(([k, v]) => [k, strs(v)])) } : {}),
      img: /^https:\/\//.test(r.img || '') ? str(r.img, 500) : '', photo: /^https:\/\//.test(r.img || ''),
    })),
    prices: arr(s.prices).map(obj).filter(x => pos(x.price) > 0).map(x => ({ store: str(x.store, 20), name: str(x.name, 80), amount: str(x.amount, 30), price: pos(x.price), date: isDay(x.date) ? x.date : '' })),
    scans: arr(s.scans).map(obj).map(x => ({ code: idOf(x.code), name: str(x.name, 120), score: Math.min(100, pos(x.score)) })),
    ...(s.mealPlan && arr(pr.days).length ? { mealPlan: {
      ts: num(plan.ts, Date.now()),
      form: { days: Math.round(pos(pf.days, 3)) || 3, people: Math.round(pos(pf.people, 1)) || 1, budget: pos(pf.budget, 30), meals: strs(pf.meals), prefs: strs(pf.prefs), wish: str(pf.wish, 200), gf: !!pf.gf, allergens: strs(pf.allergens) },
      result: {
        days: arr(pr.days).map(obj).map(x => ({ day: Math.round(pos(x.day, 1)) || 1, meals: arr(x.meals).map(obj).map(m => ({ meal: ['ranajky', 'obed', 'vecera', 'snack'].includes(m.meal) ? m.meal : 'obed', recipe_id: num(m.recipe_id), portions: Math.min(3, Math.max(0.5, num(m.portions, 1))), note: str(m.note, 200) })) })),
        shopping: arr(pr.shopping).map(obj).map(it => ({ item: str(it.item, 120), amount: str(it.amount, 40), kaufland: pos(it.kaufland), jednota: pos(it.jednota), done: !!it.done })),
        pantry: strs(pr.pantry), summary: str(pr.summary, 600),
        total_kaufland: pos(pr.total_kaufland), total_jednota: pos(pr.total_jednota), total_best: pos(pr.total_best),
      },
    } } : {}),
    aiDay: byDay(s.aiDay, v => { v = obj(v); return { score: Math.min(100, pos(v.score)), text: str(v.text, 300), hash: str(v.hash, 20000), ts: num(v.ts) }; }),
    lastBackup: num(s.lastBackup, 0) || Date.now(),
  };
}

function load() {
  let raw = null;
  try { raw = localStorage.getItem(STORE_KEY); } catch { /* bez úložiska */ }
  if (!raw) return defaultState();
  try {
    return normalize(JSON.parse(raw));
  } catch {
    // Poškodené dáta neprepisuj, odlož ich bokom.
    try { localStorage.setItem(STORE_KEY + '.corrupt', raw); } catch { /* nič */ }
    return defaultState();
  }
}

let S = load();

let saveWarned = false;
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(S));
    return true;
  } catch {
    // Plné úložisko: zmaž náhľady fotiek starších ako 14 dní a skús znova.
    const limit = dayKey(addDays(new Date(), -14));
    S.entries.forEach(e => { if (e.date < limit) delete e.thumb; });
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(S));
      return true;
    } catch (err) {
      if (err?.name === 'QuotaExceededError' || err?.code === 22) alert('Úložisko v mobile je plné, posledná zmena sa neuložila. Zálohuj dáta v profile a zmaž staré.');
      else if (!saveWarned) { saveWarned = true; alert('Prehliadač nedovoľuje ukladať dáta (súkromný režim?). Zmeny sa po zatvorení stratia.'); }
      return false;
    }
  }
}
// Požiadaj prehliadač, aby dáta appky nemazal pri nedostatku miesta.
navigator.storage?.persist?.().catch(() => {});

function getKey() {
  try { return localStorage.getItem(KEY_KEY) || ''; } catch { return ''; }
}
function setKey(v) {
  try { v ? localStorage.setItem(KEY_KEY, v) : localStorage.removeItem(KEY_KEY); } catch { /* nič */ }
}

// ---------- Pomocné ----------
const $ = sel => document.querySelector(sel);
const r0 = n => Math.round(n || 0);
// Číslo z poľa: berie aj desatinnú čiarku (75,4).
const numIn = v => Number(String(v ?? '').trim().replace(',', '.')) || 0;
const r1 = n => Math.round((n || 0) * 10) / 10;
// Dlhé pomlčky nikde: " – " sa mení na čiarku, inak na krátku pomlčku.
const nodash = s => String(s ?? '').replace(/\s+[\u2013\u2014]\s+/g, ', ').replace(/[\u2013\u2014]/g, '-');
const plural = (n, one, few, many) => n === 1 ? one : n >= 2 && n <= 4 ? few : many;
const esc = s => nodash(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const liters = ml => (ml / 1000).toLocaleString('sk-SK', { maximumFractionDigits: 2 });

function dayKey(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function parseDay(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
const todayKey = () => dayKey(new Date());

function dayTitle(k) {
  if (k === todayKey()) return 'Dnes';
  if (k === dayKey(addDays(new Date(), -1))) return 'Včera';
  return parseDay(k).toLocaleDateString('sk-SK', { weekday: 'long' }).replace(/^./, c => c.toUpperCase());
}

function nameday(k) {
  const mmdd = k.slice(5, 7) + k.slice(8, 10);
  const n = MENINY[mmdd];
  if (!n) return SVIATKY[mmdd] || 'Meniny nemá nikto';
  const a = n.split(',');
  return 'Meniny: ' + (a.length > 1 ? a.slice(0, -1).join(', ') + ' a ' + a.at(-1) : a[0]);
}

function scoreClass(s) { return s >= 7 ? 's-good' : s >= 4 ? 's-mid' : 's-bad'; }

let toastTimer;
// Hlásenie hore; s akciou (napr. „Späť“) ostane dlhšie a dá sa naň ťuknúť.
function toast(msg, action) {
  const t = $('#toast');
  t.textContent = nodash(msg);
  t.classList.toggle('has-act', !!action);
  if (action) {
    const b = document.createElement('button');
    b.className = 'toast-act';
    b.textContent = action.label;
    b.onclick = () => { t.hidden = true; action.fn(); };
    t.append(' ', b);
  }
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, action ? 6000 : 3200);
}

const ICON = {
  camera: '<path d="M4 8a2 2 0 012-2h2l1.5-2h5L16 6h2a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2z"/><circle cx="12" cy="12.5" r="3.5"/>',
  pen: '<path d="M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
  barcode: '<path d="M4 6v12M7 6v12M10 6v12M13 6v12M17 6v12M20 6v12"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  minus: '<path d="M5 12h14"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  scale: '<rect x="3" y="4" width="18" height="16" rx="4"/><path d="M8.5 11a3.5 3.5 0 017 0M12 11l1.5-2"/>',
  glass: '<path d="M6 3h12l-1.5 16.5a2 2 0 01-2 1.5h-5a2 2 0 01-2-1.5z"/><path d="M6.6 9h10.8"/>',
  bottle5: '<path d="M10 2h4v3l1.5 2.5V20a2 2 0 01-2 2h-3a2 2 0 01-2-2V7.5L10 5z"/><path d="M8.5 12h7"/>',
  bottle75: '<path d="M10 2h4v3l2 2.5V20a2 2 0 01-2 2h-4a2 2 0 01-2-2V7.5L10 5z"/><path d="M8 11h8"/>',
  bottle1: '<path d="M9.5 2h5v3l2.5 2.5V20a2 2 0 01-2 2H9a2 2 0 01-2-2V7.5L9.5 5z"/><path d="M7 10h10"/>',
};
const icon = (k, s = 20, w = 1.8) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

// ---------- Ciele ----------
// Typ dňa upraví bežný výdaj z profilu (násobok): voľno menej, tréning a práca viac.
const DAY_TYPES = [
  ['volno', 'Voľno', 0.85],
  ['praca', 'Fyzická práca', 1.0],
  ['posilka', 'Posilňovňa', 1.05],
  ['futbal', 'Futbal', 1.1],
  ['praca_trening', 'Práca + tréning', 1.15],
];
const TRAINING = ['posilka', 'futbal', 'praca_trening'];
const WEEKDAYS = ['nedeľu', 'pondelok', 'utorok', 'stredu', 'štvrtok', 'piatok', 'sobotu'];
// Typ dňa: nastavený pre tento deň, inak opakovaný podľa dňa v týždni ('none' = zámerne žiadny).
function dayType(date) {
  const t = S.days?.[date]?.type;
  if (t === 'none') return null;
  return t || S.profile.week?.[parseDay(date).getDay()] || null;
}
function sortedWeights() { return [...S.weights].sort((a, b) => a.date.localeCompare(b.date)); }
function currentWeight() { return S.weights.length ? sortedWeights().at(-1).kg : S.profile.weight; }

function targets(date) {
  const p = S.profile;
  const w = currentWeight();
  if (!w || !p.height || !p.age) return null;
  const bmr = 10 * w + 6.25 * p.height - 5 * p.age + (p.sex === 'f' ? -161 : 5);
  // Typ dňa mení výdaj; kalórie z hodiniek majú prednosť (aktívne kcal + 10 % na trávenie).
  const day = S.days?.[date] || {};
  const type = DAY_TYPES.find(d => d[0] === dayType(date));
  const tdee = day.watch ? (bmr + day.watch) * 1.1 : bmr * p.activity * (type ? type[2] : 1);
  const kcal = tdee + Number(p.surplus || 0);
  const protein = w * p.proteinPerKg;
  const fat = (kcal * 0.25) / 9;
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);
  return {
    bmr: r0(bmr), tdee: r0(tdee), kcal: r0(kcal),
    p: r0(protein), c: r0(carbs), f: r0(fat),
    fib: r0((kcal / 1000) * 14), water: r0((w * 35 + (TRAINING.includes(dayType(date)) || day.watch > 400 ? 500 : 0)) / 250) * 250,
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

// ---------- Hlavná stránka ----------
let curDate = todayKey();
// Po polnoci prepni na nový deň, ak appka ostala otvorená (pri prezeraní dneška).
let lastToday = todayKey();
function rollover() {
  const now = todayKey();
  if (now === lastToday) return false;
  if (curDate === lastToday) curDate = now;
  lastToday = now;
  return true;
}
(function midnightTimer() {
  const n = new Date(), next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 5);
  setTimeout(() => { if (rollover()) render(); midnightTimer(); }, Math.min(next - n, 2 ** 31 - 1));
})();

function ring(value, target, c1, c2, id) {
  const size = 132, sw = 13, R = (size - sw) / 2, C = 2 * Math.PI * R, c = size / 2;
  const pct = target ? Math.min(value / target, 1) : 0;
  const dash = `${(C * pct).toFixed(1)} ${C.toFixed(1)}`;
  const arc = extra => `<circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="url(#${id})" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${dash}" ${extra}/>`;
  return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
    <filter id="${id}b" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter></defs>
    <circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="var(--card2)" stroke-width="${sw}"/>
    ${pct > 0 ? arc(`filter="url(#${id}b)" opacity="0.6"`) + arc('') : ''}</svg>`;
}

function bar(label, value, target, color, unit = 'g') {
  const pct = target ? Math.min((value / target) * 100, 100) : 0;
  return `<div><div class="bar-label"><span>${label}</span><span class="muted">${r0(value)} / ${target ? r0(target) : '-'} ${unit}</span></div>
    <div class="bar"><i style="width:${pct}%;background:${color}"></i></div></div>`;
}

function render() {
  rollover();
  $('#title').textContent = dayTitle(curDate);
  const recent = curDate >= dayKey(addDays(new Date(), -1));
  $('#date').textContent = parseDay(curDate).toLocaleDateString('sk-SK', recent ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' });
  $('#nameday').textContent = nameday(curDate);
  $('#next-day').disabled = curDate >= todayKey();
  $('#open-profile').textContent = ([...(S.profile.name || '').trim()][0] || '?').toUpperCase();

  const t = targets(curDate);
  const tot = dayTotals(curDate);
  let html = '';

  if (!t) {
    html += `<div class="warn">Najprv vyplň profil (vek, výška, váha), vypočítam ti denný cieľ na priberanie.
      <div style="margin-top:10px"><button class="btn sm primary" data-act="profile">Vyplniť profil</button></div></div>`;
  }

  // Kalórie a makrá
  const left = t ? r0(t.kcal - tot.kcal) : null;
  html += `<div class="card dark"><div class="ring-wrap">
    <div class="ring">${ring(tot.kcal, t?.kcal, '#30d158', '#a4f566', 'rk')}
      <div class="center"><span class="big">${r0(tot.kcal)}</span><span class="small muted">${t ? 'z ' + t.kcal + ' kcal' : 'kcal'}</span></div></div>
    <div class="bars">
      ${bar('Bielkoviny', tot.p, t?.p, 'var(--p)')}
      ${bar('Sacharidy', tot.c, t?.c, 'var(--c)')}
      ${bar('Tuky', tot.f, t?.f, 'var(--f)')}
      ${bar('Vláknina', tot.fib, t?.fib, 'var(--fib)')}
    </div></div>
    <div class="summary"><span>${t
      ? (left > 0 ? `${curDate < todayKey() ? 'Chýbalo' : 'Ešte zjedz'} <b>${left} kcal</b> a <b>${Math.max(0, t.p - r0(tot.p))} g</b> bielkovín.` : `Cieľ splnený ✓ <span class="muted">(+${-left} kcal)</span>`)
      : 'Pridaj, čo si zjedol.'}</span></div>
    ${t ? `<button class="day-pill" data-act="daytype">${dayTypeLabel(curDate)} ${icon('right', 14, 2.4)}</button>` : ''}
  </div>`;

  html += dayMeter(curDate, t, tot);

  // Záznamy hneď pod kalóriami, len keď je čo ukázať
  const items = S.entries.filter(e => e.date === curDate).sort((a, b) => a.ts - b.ts);
  if (items.length) {
    html += `<div class="card"><h3>Záznamy <span class="muted small">${r0(tot.kcal)} kcal</span></h3>
      <div class="list">${items.map(e => `<button class="entry" data-entry="${e.id}">
        ${e.thumb ? `<img src="${e.thumb}" alt="">` : ''}
        <div class="info"><div class="name">${esc(e.name)}</div>
          <div class="small muted">${new Date(e.ts).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })} · ${e.g ? r0(e.g) + ' g' : '1 porcia'} · B ${r0(e.p)} g</div></div>
        ${S.profile.glutenFree && e.gluten && e.gluten !== 'nie' ? glutenTag(e.gluten) : ''}
        <span class="score ${scoreClass(e.score)}">${e.score ?? '-'}</span>
        <span class="kc">${r0(e.kcal)}</span></button>`).join('')}</div>
      ${curDate < todayKey() ? '<button class="btn" data-act="copy-day" style="margin-top:12px">Skopírovať tento deň do dneška</button>' : ''}</div>`;
  }

  // Voda
  const water = S.water[curDate] || 0;
  const wt = t?.water || 2500;
  html += `<div class="card"><div class="tile">
    <span class="ico water">${icon('drop')}</span>
    <div class="tile-main"><div class="tile-label">Voda</div>
      <div class="tile-val">${liters(water)} l <small>z ${liters(wt)} l</small></div>
      <div class="bar"><i style="width:${Math.min(100, (water / wt) * 100)}%;background:var(--water)"></i></div></div>
    <button class="round" data-act="water" aria-label="Pridať vodu">${icon('plus', 20, 2.4)}</button>
  </div></div>`;

  html += suppsCard();
  html += scanCard();

  // Váha
  const ws = sortedWeights();
  const tr = weightTrend();
  html += `<div class="card"><div class="tile">
    <span class="ico weight">${icon('scale')}</span>
    <div class="tile-main"><div class="tile-label">Váha</div>
      <div class="tile-val">${ws.length ? ws.at(-1).kg.toLocaleString('sk-SK') + ' kg' : '-'}
        ${tr ? `<small>${tr.perWeek >= 0 ? '+' : ''}${tr.perWeek.toFixed(2).replace('.', ',')} kg/týždeň</small>` : ''}</div>
      ${tr ? `<div class="small muted">${trendAdvice(tr).text}</div>` : `<div class="small muted">${ws.length ? 'Trend uvidíš po týždni váženia.' : 'Zapíš ráno nalačno, 2-3× týždenne.'}</div>`}</div>
    <button class="round" data-act="weight" aria-label="Zapísať váhu">${icon('plus', 20, 2.4)}</button>
  </div></div>`;

  html += weekStats();
  html += recipesCard();
  html += planCard();
  html += backupCard();

  $('#page').innerHTML = html;
}

// ---------- Typ dňa ----------
function dayTypeLabel(date) {
  const d = S.days?.[date] || {};
  const type = DAY_TYPES.find(x => x[0] === dayType(date));
  const parts = [type ? type[1] : 'Typ dňa'];
  if (d.watch) parts.push(`hodinky ${r0(d.watch)} kcal`);
  return parts.join(' · ');
}

// Prekreslí panel a nechá rozpísané kalórie z hodiniek.
function keepWatch(fn) { const v = $('#watch-kcal')?.value; fn(); if (v != null) $('#watch-kcal').value = v; }

function openDayType() {
  const d = S.days[curDate] || {};
  const cur = dayType(curDate), wd = parseDay(curDate).getDay();
  const weekly = S.profile.week?.[wd];
  openSheet('Aký je deň?', `
    <div class="chips">${DAY_TYPES.map(([k, l]) => `<button class="chip-btn ${cur === k ? 'on' : ''}" data-dtype="${k}">${l}</button>`).join('')}</div>
    <p class="small muted" style="margin:10px 0 12px">Podľa typu dňa sa zmení cieľ kalórií a vody.</p>
    <button class="chip-btn ${weekly && weekly === cur ? 'on' : ''}" data-act="daytype-week" style="margin-bottom:18px">${weekly && weekly === cur ? '✓ ' : ''}Opakovať každý ${WEEKDAYS[wd]}</button>
    <label class="field">Aktívne kalórie z hodiniek (nepovinné)
      <input id="watch-kcal" type="text" inputmode="numeric" autocomplete="off" placeholder="napr. 950" value="${Number(d.watch) || ''}"></label>
    <p class="small muted" style="margin:-4px 0 16px">Nájdeš ich v appke Huawei Health alebo Zdravie (aktívna energia). Keď ich zadáš, majú prednosť pred typom dňa.</p>
    <button class="btn primary" data-act="daytype-save">Uložiť</button>`);
}

// ---------- Skener na hlavnej stránke ----------
function scanCard() {
  const last = (S.scans || [])[0];
  return `<button class="card scan-card" data-act="scan">
    <span class="ico scan">${icon('barcode', 22)}</span>
    <span class="tile-main"><b>Skenovať potravinu</b>
      <span class="small muted">${last ? `Naposledy: ${esc(last.name)}` : 'Zdravosť od 0 do 10'}</span></span>
    ${last ? scoreBadge(s10(last.score)) : icon('right', 18, 2.2)}</button>`;
}

// ---------- Suplementy ----------
const SUPP_PRESETS = [
  ['Kreatín', '💪', '3-5 g denne, sila a objem'],
  ['Proteín', '🥤', 'doplnenie bielkovín'],
  ['Omega-3', '🐟', 'k jedlu, srdce a regenerácia'],
  ['Magnézium', '🌙', 'večer, spánok a kŕče'],
  ['Vitamín D', '☀️', 'ráno s jedlom, imunita'],
  ['Zinok', '🛡️', 'imunita a hormóny'],
  ['Vitamín C', '🍊', 'imunita'],
  ['Elektrolyty', '⚡', 'pri futbale a v teple'],
  ['Kolagén', '🦴', 'kĺby a šľachy'],
  ['B-komplex', '🔋', 'energia'],
  ['Ashwagandha', '🧘', 'stres a spánok'],
  ['Multivitamín', '💊', 'ráno'],
];
function suppInfo(name) { return SUPP_PRESETS.find(x => norm(x[0]) === norm(name)) || [name, '💊', '']; }

function suppsCard() {
  const list = S.profile.suppList || [];
  const done = (S.supps?.[curDate] || []).filter(n => list.includes(n));
  if (!list.length) return `<button class="card scan-card" data-act="supp-edit"><span class="ico supp">💊</span>
    <span class="tile-main"><b>Suplementy</b><span class="small muted">Vyber, čo berieš, a odškrtávaj si to každý deň.</span></span>${icon('plus', 18, 2.4)}</button>`;
  const all = done.length === list.length;
  return `<div class="card supps">
    <div class="supp-head"><span class="tile-label">Suplementy</span>
      <span class="supp-count ${all ? 'all' : ''}">${all ? '✓ všetko' : `${done.length} z ${list.length}`}</span>
      <button class="link-btn small" data-act="supp-edit">Upraviť</button></div>
    <div class="bar"><i style="width:${(done.length / list.length) * 100}%;background:var(--green)"></i></div>
    <div class="supp-grid">${list.map(n => { const [name, emoji, hint] = suppInfo(n); const on = done.includes(n); return `
      <button class="supp ${on ? 'on' : ''}" data-supp="${esc(n)}" aria-pressed="${on}">
        <span class="supp-ico">${emoji}${on ? `<i>${icon('check', 12, 3.2)}</i>` : ''}</span>
        <span class="supp-name">${esc(name)}</span>${hint ? `<span class="supp-hint">${esc(hint)}</span>` : ''}</button>`; }).join('')}</div></div>`;
}

function openSuppEdit() {
  const list = S.profile.suppList || [];
  const custom = list.filter(n => !SUPP_PRESETS.some(x => norm(x[0]) === norm(n)));
  openSheet('Moje suplementy', `
    <p class="small muted" style="margin-bottom:12px">Ťukni na to, čo berieš. Na hlavnej stránke si to potom každý deň odškrtneš.</p>
    <div class="supp-grid edit">${SUPP_PRESETS.map(([n, e, h]) => `<button class="supp ${list.includes(n) ? 'on' : ''}" data-supp-pick="${esc(n)}">
      <span class="supp-ico">${e}${list.includes(n) ? `<i>${icon('check', 12, 3.2)}</i>` : ''}</span><span class="supp-name">${esc(n)}</span><span class="supp-hint">${esc(h)}</span></button>`).join('')}
      ${custom.map(n => `<button class="supp on" data-supp-pick="${esc(n)}"><span class="supp-ico">💊<i>${icon('check', 12, 3.2)}</i></span><span class="supp-name">${esc(n)}</span><span class="supp-hint">vlastný</span></button>`).join('')}</div>
    <h3 class="sub-h">Pridať vlastný</h3>
    <div class="row"><input class="input" id="supp-new" placeholder="napr. Beta-alanín" style="flex:1"><button class="btn sm primary" data-act="supp-add">Pridať</button></div>`);
}

// ---------- Moje jedlá (obľúbené) ----------
function addFav(name, items) {
  S.favs = S.favs || [];
  S.favs.push({ id: uid(), name: name.trim() || 'Moje jedlo', items: items.map(({ thumb, ...it }) => it) });
  save();
  toast('Uložené medzi moje jedlá');
}

// Viac položiek jedného jedla (z fotky alebo obľúbené) = jeden záznam so zložením.
function combineItems(name, items) {
  if (items.length === 1) return { ...items[0], name: items[0].name || name };
  const sum = k => items.reduce((a, it) => a + (Number(it[k]) || 0), 0);
  const kcal = sum('kcal');
  const gl = items.map(it => it.gluten);
  return {
    name, g: sum('g'), kcal, p: sum('p'), c: sum('c'), f: sum('f'), fib: sum('fib'),
    score: Math.round(kcal ? items.reduce((a, it) => a + (it.score || 5) * (it.kcal || 0), 0) / kcal : 5),
    gluten: gl.includes('ano') ? 'ano' : gl.includes('mozno') || gl.includes(undefined) ? 'mozno' : 'nie',
    allergens: [...new Set(items.flatMap(it => it.allergens || []))],
    thumb: items.find(it => it.thumb)?.thumb,
    items: items.map(({ thumb, items: _, ...it }) => ({ name: it.name, g: r1(it.g), kcal: r1(it.kcal) })),
  };
}

function eatFav(id) {
  const f = (S.favs || []).find(x => x.id === id);
  if (f) addEntries([combineItems(f.name, f.items.map(it => ({ ...it })))], 'oblubene');
}

// ---------- Kopírovanie dňa ----------
function copyDayToToday() {
  const items = S.entries.filter(e => e.date === curDate);
  const today = todayKey();
  const already = S.entries.some(e => e.date === today && items.some(x => x.name === e.name));
  if (already && !confirm('Niektoré z týchto jedál už dnes máš. Skopírovať aj tak?')) return;
  const added = items.map(e => { const { id, thumb, ...rest } = e; return { ...rest, id: uid(), date: today, ts: tsOn(today, new Date(e.ts)) }; });
  S.entries.push(...added);
  save();
  curDate = today;
  render();
  const ids = new Set(added.map(e => e.id));
  toast(`Skopírované: ${items.length} ${plural(items.length, 'položka', 'položky', 'položiek')}`,
    { label: 'Späť', fn: () => { S.entries = S.entries.filter(e => !ids.has(e.id)); save(); render(); } });
}

// ---------- Záloha (len do tvojho zariadenia / iCloudu) ----------
function backupCard() {
  if (!S.entries.length || Date.now() - (S.lastBackup || 0) < 7 * 864e5) return '';
  return `<div class="card"><div class="tile"><div class="tile-main"><div class="tile-label">Záloha</div>
    <div class="small muted">Ulož si zálohu dát do Súborov alebo iCloudu. Nikam inam sa neposiela.</div></div>
    <button class="btn sm primary" data-act="backup">Zálohovať</button></div></div>`;
}

async function backupNow() {
  const file = new File([JSON.stringify(S, null, 1)], `jedlo-zaloha-${todayKey()}.json`, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Záloha Jedlo' });
    else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    S.lastBackup = Date.now();
    save();
    render();
  } catch { /* zrušené */ }
}

// ---------- Ako jem: ukazovateľ od červenej (nezdravo) po zelenú (zdravo) ----------
// Skóre 0-100 hodnotí len zdravosť jedál, nie to, koľko si už zjedol (to ukazuje kruh kalórií):
// kvalita jedál 60 %, podiel bielkovín 25 %, vláknina na 1000 kcal 15 %.
function dayScore(date, t, tot) {
  if (!tot.n || !tot.kcal) return null;
  const pShare = (tot.p * 4) / tot.kcal;
  const pTarget = t ? (t.p * 4) / t.kcal : 0.18;
  const parts = {
    quality: ((tot.score ?? 5) - 1) / 9,
    protein: Math.min(1, pShare / pTarget),
    fiber: Math.min(1, (tot.fib / tot.kcal) * 1000 / 14),
  };
  const score = Math.round(100 * (0.6 * parts.quality + 0.25 * parts.protein + 0.15 * parts.fiber));
  const tips = {
    quality: 'veľa spracovaného jedla',
    protein: 'málo bielkovín v jedle',
    fiber: 'málo vlákniny, pridaj zeleninu',
  };
  const weakest = Object.entries(parts).sort((a, b) => a[1] - b[1])[0];
  return { score, tip: weakest[1] < 0.8 ? tips[weakest[0]] : 'drž to tak' };
}

function verdict(score) {
  if (score < 35) return 'Nezdravo';
  if (score < 55) return 'Dá sa to zlepšiť';
  if (score < 75) return 'Dobre';
  return 'Výborne';
}

// Odtlačok jedál dňa, AI hodnotenie platí, len kým sa jedlá nezmenia.
function dayHash(date) {
  return S.entries.filter(e => e.date === date).map(e => [e.id, e.g, e.kcal, e.p, e.score, e.name].join(':')).join('|');
}

function dayMeter(date, t, tot) {
  const calc = dayScore(date, t, tot);
  const ai = S.aiDay?.[date];
  const useAi = ai && ai.hash === dayHash(date);
  const score = useAi ? ai.score : calc?.score;
  const pos = score == null ? null : Math.min(97, Math.max(3, score));
  // Ťuknutie na pás = zhodnotenie dňa s AI (ak je čo hodnotiť).
  return `<button class="card meter-card ${score == null ? 'empty' : ''}" ${score != null ? 'data-act="ai-day"' : 'disabled'}
      aria-label="${score != null ? `Hodnotenie dňa ${s10(score)} z 10: ${verdict(score)}. Ťukni pre zhodnotenie s AI.` : 'Zatiaľ bez hodnotenia'}">
    <span class="meter">${pos != null ? `<i style="left:${pos}%"><b>${s10(score)}</b></i>` : ''}</span>
    <span class="meter-ends"><span>Nezdravo</span><span>Zdravo</span></span>
    ${useAi ? `<span class="meter-text">${esc(ai.text)}</span>` : ''}
  </button>`;
}

const DAY_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'integer' },
    text: { type: 'string' },
  },
  required: ['score', 'text'],
  additionalProperties: false,
};

async function analyzeDay(date) {
  const t = targets(date);
  const items = S.entries.filter(e => e.date === date).sort((a, b) => a.ts - b.ts);
  const tot = dayTotals(date);
  const list = items.map(e => `${new Date(e.ts).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })} ${e.name}${e.g ? `, ${r0(e.g)} g` : ''}: ${r0(e.kcal)} kcal, B ${r0(e.p)} g, S ${r0(e.c)} g, T ${r0(e.f)} g, vláknina ${r1(e.fib)} g`).join('\n');
  const isToday = date === todayKey();
  return callClaude({
    system: `Si výživový tréner športovca, ktorý chce nabrať svaly. Zhodnoť, ako zdravo a vhodne sa v daný deň stravoval.
score: celé číslo 0-100, ako ZDRAVO jedol (0 = veľmi nezdravo, 50 = priemer, 100 = výborne). Hodnoť kvalitu a spracovanie potravín, bielkoviny, vlákninu, zeleninu a ovocie. Množstvo kalórií do skóre nerátaj, to sleduje inde.${isToday ? ' Deň ešte neskončil, nehodnoť prísne to, čo ešte stihne zjesť.' : ''}
text: jedna krátka veta po slovensky (max. 12 slov), čo je najlepšie alebo čo zlepšiť. Nepoužívaj dlhé pomlčky, namiesto nich píš čiarky.`,
    content: [{ type: 'text', text: `${isToday ? `Je ${new Date().toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}, deň ešte prebieha.` : 'Deň už skončil.'}
Cieľ: ${t ? `${t.kcal} kcal, ${t.p} g bielkovín, ${t.fib} g vlákniny` : 'neznámy'}.
Spolu: ${r0(tot.kcal)} kcal, B ${r0(tot.p)} g, S ${r0(tot.c)} g, T ${r0(tot.f)} g, vláknina ${r0(tot.fib)} g.
Jedlá:\n${list}` }],
    schema: DAY_SCHEMA,
    effort: 'low',
  });
}

let dayAIBusy = null;
async function runDayAI(btn) {
  if (btn.classList.contains('busy') || dayAIBusy === curDate) return;
  // Hodnotenie sa nemení, kým sa nezmenia jedlá, nemá zmysel platiť znova.
  if (S.aiDay?.[curDate]?.hash === dayHash(curDate)) return toast('Hodnotenie je aktuálne. Zmení sa po ďalšom jedle.');
  btn.classList.add('busy');
  toast('AI hodnotí tvoj deň…');
  try {
    const date = dayAIBusy = curDate, hash = dayHash(date);
    const res = await analyzeDay(date).finally(() => { dayAIBusy = null; });
    S.aiDay = S.aiDay || {};
    S.aiDay[date] = { score: Math.min(100, Math.max(0, Math.round(res.score))), text: res.text, hash, ts: Date.now() };
    save();
    render();
  } catch (err) {
    toast(err.message);
    if (!getKey()) openProfile();
    render();
  }
}

function weekStats() {
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(dayKey(addDays(parseDay(curDate), -i)));
  const tots = days.map(d => ({ d, t: targets(d), ...dayTotals(d) }));
  const logged = tots.filter(x => x.n > 0);
  if (!logged.length) return '';

  const W = 320, H = 120, base = H - 16;
  const maxV = Math.max(...tots.map(x => Math.max(x.kcal, x.t?.kcal || 0))) * 1.12 || 1;
  const bw = W / 7;
  const y = v => base - (v / maxV) * (H - 22);
  // Jedna čiara cieľa (dnešný cieľ), stĺpce dní, prázdne dni ako tenký prúžok.
  const goal = targets(curDate)?.kcal;
  const bars = tots.map((x, i) => {
    const h = x.n ? Math.max(4, base - y(x.kcal)) : 4;
    const ok = x.t && x.kcal >= x.t.kcal * 0.9;
    const fill = !x.n ? 'var(--card2)' : ok ? 'var(--green)' : 'var(--orange)';
    return `<rect x="${i * bw + bw * 0.2}" y="${base - h}" width="${bw * 0.6}" height="${h}" rx="${Math.min(5, h / 2)}" fill="${fill}"/>` +
      `<text x="${i * bw + bw / 2}" y="${H - 2}" font-size="11" font-weight="${x.d === curDate ? 600 : 400}" text-anchor="middle" fill="${x.d === curDate ? 'var(--text)' : 'var(--muted)'}">${parseDay(x.d).toLocaleDateString('sk-SK', { weekday: 'short' }).slice(0, 2)}</text>`;
  }).join('') + (goal ? `<line x1="0" x2="${W}" y1="${y(goal)}" y2="${y(goal)}" stroke="var(--text)" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="4 4"/>
    <text x="${W}" y="${y(goal) - 5}" font-size="10" text-anchor="end" fill="var(--muted)">cieľ ${goal}</text>` : '');

  // Priemer bez dneška (nedokončený deň by ho kazil), ak sú aj iné dni.
  const full = logged.filter(x => x.d !== todayKey());
  const avgOf = full.length ? full : logged;
  const n = streak();
  const avg = k => avgOf.reduce((s, x) => s + x[k], 0) / avgOf.length;
  const tip = mainTip(logged);
  return `<div class="card dark"><h3>Posledných 7 dní</h3>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kalórie za posledných 7 dní">${bars}</svg>
    <div class="trio">
      <div><b>${r0(avg('kcal'))}</b><span>kcal / deň</span></div>
      <div><b>${r0(avg('p'))} g</b><span>bielkoviny / deň</span></div>
      <div><b>${n}</b><span>${plural(n, 'deň', 'dni', 'dní')} v rade</span></div>
    </div>
    ${tip ? `<p class="tip">${tip}</p>` : ''}</div>`;
}

// ---------- Recepty zo Športovej kuchárky ----------
// Kuchárka je platený obsah, preto je na (verejnom) webe len zašifrovaná (kucharka.bin + kucharka-foto/*.bin).
// Odomkne sa raz súkromným odkazom (#k=…); kľúč a rozšifrovaná kópia ostanú len v tomto zariadení.
const PASS_KEY = 'jedlo.kucharka.heslo';
let BOOK = null;
// Rozšifrovaná kuchárka je len v pamäti (pri štarte sa rozšifruje z kucharka.bin), nezaberá miesto v úložisku.
try { localStorage.removeItem(BOOK_KEY); } catch { /* nič */ }
let cryptoKey = null, keyPromise = null;
const photoUrls = new Map();

const MEAL_TYPES = [
  ['ranajky', 'Raňajky', ['snidane', 'predzapas'], '🍳'],
  ['obed', 'Obed', ['hlavni'], '🍗'],
  ['vecera', 'Večera', ['hlavni'], '🍝'],
  ['snack', 'Snack', ['svaciny', 'dezerty'], '🥣'],
];
const FRUITS = new Set(['banan', 'jablko', 'bobule', 'citrusy', 'susene', 'ovocie']);

async function deriveKey(password, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' }, base,
    { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}

async function decryptBook(password) {
  const res = await fetch('kucharka.bin', { cache: 'no-cache' });
  if (!res.ok) throw new Error('Kuchárku sa nepodarilo stiahnuť.');
  const buf = new Uint8Array(await res.arrayBuffer());
  const key = await deriveKey(password, buf.slice(0, 16));
  let plain;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(16, 28) }, key, buf.slice(28));
  } catch {
    throw new Error('Tento kľúč nesedí.');
  }
  cryptoKey = key;
  return JSON.parse(new TextDecoder().decode(plain));
}

function storeBook(data) {
  BOOK = data;
}

async function unlockBook(password) {
  const data = await decryptBook(password);
  storeBook(data);
  try { localStorage.setItem(PASS_KEY, password); } catch { /* nič */ }
  render();
  toast(`Kuchárka odomknutá: ${data.recipes.length} receptov`);
}

function storedPass() {
  try { return localStorage.getItem(PASS_KEY) || ''; } catch { return ''; }
}

// Pri štarte potichu načítaj novšiu verziu kuchárky (napr. keď pribudnú recepty).
async function refreshBook() {
  const pass = storedPass();
  if (!pass) return;
  try {
    const data = await decryptBook(pass);
    // Medzitým zamknutá alebo odomknutá iným kľúčom: nič neprepisuj.
    if (storedPass() !== pass) return;
    if (!BOOK || data.version !== BOOK.version) { storeBook(data); render(); }
  } catch (err) {
    // Zmenený kľúč: zabudni ho, nech sa ukáže karta na odomknutie.
    if (err?.message === 'Tento kľúč nesedí.') { try { localStorage.removeItem(PASS_KEY); } catch { /* nič */ } render(); }
  }
}

// Súkromný odkaz …/jedlo/#k=KĽÚČ odomkne kuchárku jedným ťuknutím.
async function unlockFromUrl() {
  const m = location.hash.match(/[#&]k=([^&]+)/);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  try { await unlockBook(decodeURIComponent(m[1])); return true; } catch (err) { toast(err.message); }
}

async function unlockFromClipboard() {
  try {
    let t = '';
    try { t = (await navigator.clipboard.readText()).trim(); } catch { /* bez prístupu */ }
    if (!t) return toast('Najprv skopíruj svoj odkaz na kuchárku.');
    const m = t.match(/[#&]k=([^&\s]+)/);
    await unlockBook(decodeURIComponent(m ? m[1] : t));
  } catch (err) {
    toast(err?.message?.includes('kľúč') || err?.message?.includes('stiahnuť') ? err.message : 'Najprv skopíruj svoj odkaz na kuchárku.');
  }
}

async function photoUrl(id) {
  if (photoUrls.has(id)) return photoUrls.get(id);
  if (id >= 100000) return findRecipe(id)?.img || null;
  if (BOOK?.recipes.find(x => x.id === id)?.photo === false) return null;
  if (!cryptoKey) {
    const pass = storedPass();
    if (!pass || !BOOK?.salt) return null;
    // Kľúč sa odvodzuje len raz, aj keď sa naraz načítava viac fotiek.
    keyPromise = keyPromise || deriveKey(pass, new Uint8Array(BOOK.salt.match(/../g).map(h => parseInt(h, 16))));
    try { cryptoKey = await keyPromise; } catch { keyPromise = null; return null; }
  }
  try {
    const res = await fetch(`kucharka-foto/${id}.bin`);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, cryptoKey, buf.slice(12));
    const url = URL.createObjectURL(new Blob([plain], { type: 'image/webp' }));
    photoUrls.set(id, url);
    return url;
  } catch {
    return null;
  }
}

// Fotky sa načítajú, až keď sa k nim dostaneš (pri 300 receptoch by inak išlo 12 MB naraz).
async function loadPhoto(img) {
  const url = await photoUrl(Number(img.dataset.photo));
  if (!img.isConnected) return;
  if (url) { img.src = url; img.classList.add('loaded'); } else img.closest('.photo')?.classList.add('none');
}
const photoObs = 'IntersectionObserver' in window ? new IntersectionObserver(list => {
  for (const en of list) {
    if (!en.isIntersecting) continue;
    photoObs.unobserve(en.target);
    loadPhoto(en.target);
  }
}, { rootMargin: '400px 0px' }) : null;
function fillPhotos(root) {
  for (const img of root.querySelectorAll('img[data-photo]')) photoObs ? photoObs.observe(img) : loadPhoto(img);
}

function chipLabel(id) { return BOOK?.chips.find(c => c.id === id)?.label.split(' (')[0] || id; }

function matchRecipe(r, have) {
  const missing = r.req.filter(alts => !alts.some(a => have.has(a) || (a === 'ovocie' && [...have].some(h => FRUITS.has(h)))));
  return { r, missing, have: r.req.length - missing.length };
}

function recipesCard() {
  if (!BOOK && !storedPass()) {
    return `<div class="card"><h3>Čo si uvarím?</h3>
      <p class="small muted" style="margin-bottom:12px">Recepty zo Športovej kuchárky. Skopíruj svoj súkromný odkaz a ťukni sem, odomkne sa len raz.</p>
      <button class="btn primary" data-act="unlock-paste">Vložiť odkaz a odomknúť</button></div>`;
  }
  return `<button class="cook-hero" data-act="cook">
      <span><b>Čo si uvarím?</b><span>Recept z toho, čo máš doma</span></span>
      ${icon('right', 22, 2.4)}</button>
    <button class="link-btn" data-act="all-recipes">Všetky recepty${BOOK ? ` (${allRecipes().filter(r => fitsDiet(r, profileDiet())).length})` : ''}</button>`;
}

// ---------- Strava: bezlepková a alergie ----------
// Lepok: čo v recepte obsahuje lepok a čím to nahradiť. Riadok s „bezlepk…“ sa ignoruje.
const GLUTEN_RULES = [
  [/kypřic|prášk[a-zů]* do pečiva|prášok do pečiva/i, 'bezlepkový prášok do pečiva'],
  [/(?<!(?:rýžov|ryžov|kukuřičn|kukuričn|pohankov|pohánkov|mandlov|mandľov|kokosov|cizrnov|cícerov|bramborov|zemiakov|tapiokov|bezlepkov)\S* )(?:mouk|múk|múčk)/i, 'bezlepková múka (napr. ryžová alebo mix)'],
  [/(?<!(?:rýžov|ryžov|jáhlov|pšenov|pohankov|pohánkov|kukuřičn|kukuričn|bezlepkov)\S* )vloč/i, 'certifikované bezlepkové ovsené vločky'],
  [/(?<!(?:kukuřičn|kukuričn)\S* )tortil|wrap|lavash|\bpit[ay]\b/i, 'kukuričné alebo bezlepkové tortilly'],
  [/piškot|sušenk|sušienk|keks/i, 'bezlepkové piškóty / sušienky'],
  [/strouhank|strúhank|krutón/i, 'bezlepková strúhanka'],
  [/chléb|chleb|chlieb|(?<!do )pečiv|toast|bagel|rohlík|bulk|housk|baget|žeml/i, 'bezlepkový chlieb alebo pečivo'],
  [/těstovin|cestovin|špaget|penne|(?<!(?:rýžov|ryžov)\S* )nudl|rezanc|lasagn|gnocchi|noky|fleky|halušk/i, 'bezlepkové cestoviny / noky'],
  [/bulgur|kuskus|krupic|ječm|jačm|kroupy|krúp|seitan|špald|pšenič|pšenic|žitn|ražn/i, 'quinoa, pohánka alebo ryža'],
  [/sójov[áé] omáčk|teriyaki|worcester/i, 'tamari (bezlepková sójová omáčka)'],
  [/granol|müsli|musli|cereál/i, 'bezlepková granola'],
  [/\bpiv[oa]\b/i, 'bezlepkové pivo'],
];
// Česky aj slovensky: kuchárka je preložená, ale analýza beží aj na vlastných receptoch.
const ALLERGENS = [
  ['mlieko', 'Mlieko / laktóza', /(?<!(?:mandlov|mandľov|kokosov|ovesn|ovsen|rýžov|ryžov|sójov|rostlinn|rastlinn)\S* )(?:mlék|mliek)|mléč|mlieč|jogurt|skyr|tvaroh|sýr|\bsyr|cottage|smetan|smotan|šľahačk|(?<!(?:arašídov|arašidov|kešu|mandlov|mandľov|ořechov|orechov|kokosov)\S* )m[áa]sl|ricott|mozzarel|parmaz|parmez|feta|halloumi|kefír|lučin|mascarpon|bryndz|burrat|ghí|čedar|eidam|srvátk|syrovátk/i, 'mlieka'],
  ['vajcia', 'Vajcia', /vejc|vajíč|vajec|vaječ|vajc|vajce|žloutk|žĺtk|bílk(?!ovin)|bielok|bielk(?!ovin)/i, 'vajec'],
  ['orechy', 'Orechy', /ořech|ořeš|orech|oriešk|orieš|mandl|mandľ|kešu|lískov|lieskov|pistáci|pistác|pekan|makadam/i, 'orechov'],
  ['arasidy', 'Arašidy', /arašíd|arašid/i, 'arašidov'],
  ['ryby', 'Ryby', /losos|tuňák|tuniak|tresk|ryb(?!íz)[íiay]|sardin|makrel|ančov|anči/i, 'rýb'],
  ['korysy', 'Kôrovce (krevety)', /krevet/i, 'kôrovcov'],
  ['soja', 'Sója', /sój|tofu|tempeh|edamame/i, 'sóje'],
  ['sezam', 'Sezam', /sezam|tahini/i, 'sezamu'],
  ['zeler', 'Zeler', /celer|zeler/i, 'zeleru'],
  ['horcica', 'Horčica', /hořčic|horčic/i, 'horčice'],
];

function dietOf(form) {
  return { gf: !!form?.gf, allergens: form?.allergens || [] };
}
function profileDiet() { return dietOf({ gf: S.profile.glutenFree, allergens: S.profile.allergens }); }
function dietActive(d) { return d.gf || d.allergens.length > 0; }

// Analýza receptu pre danú stravu: zámeny pri lepku, nájdené alergény.
// Recepty z kuchárky majú analýzu hotovú (r.diet, spravená z českého originálu), vlastné recepty sa analyzujú tu.
const dietCache = new WeakMap();
function recipeDiet(r) {
  if (dietCache.has(r)) return dietCache.get(r);
  if (r.diet) {
    const out = { swaps: r.diet.swaps.map(([i, to]) => ({ from: r.ing[i] || '', to })), allergens: r.diet.allergens };
    dietCache.set(r, out);
    return out;
  }
  const lines = r.ing.filter(l => !/:$/.test(l));
  const swaps = new Map();
  for (const l of lines) {
    if (/bezlepk/i.test(l)) continue;
    for (const [rx, sw] of GLUTEN_RULES) if (rx.test(l)) { swaps.set(sw, l); break; }
  }
  const text = lines.join(' \n ');
  const allergens = ALLERGENS.filter(([, , rx]) => rx.test(text)).map(([k]) => k);
  const out = { swaps: [...swaps.entries()].map(([sw, l]) => ({ from: l, to: sw })), allergens };
  dietCache.set(r, out);
  return out;
}

// Vyhovuje recept strave? Alergény vylučujú, lepok sa dá nahradiť.
function fitsDiet(r, d) {
  return !d.allergens.some(a => recipeDiet(r).allergens.includes(a));
}

function dietBadge(r, d) {
  if (!d.gf) return '';
  const n = recipeDiet(r).swaps.length;
  return n ? `<span class="tag warn-tag">Bezlepková úprava (${n})</span>` : '<span class="tag ok-tag">Bez lepku</span>';
}

function dietSummary(d) {
  return [d.gf && 'bez lepku', ...d.allergens.map(a => 'bez ' + (ALLERGENS.find(x => x[0] === a)?.[3] || a))].filter(Boolean).join(', ');
}

// ---------- Recepty: všetky zdroje, porcie, hodnotenie, varenie ----------
// Vlastné recepty (z internetu) sú uložené len v tomto zariadení, id od 100000.
function allRecipes() { return [...(BOOK?.recipes || []), ...(S.myRecipes || [])]; }
function findRecipe(id) { return allRecipes().find(x => x.id === Number(id)); }
function rmeta(id) { return S.recipeMeta?.[id] || {}; }

// Prepočet suroviny na 1 porciu: čísla na začiatku riadku, po „/“ a v zátvorke.
const FRAC = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
const QTY_RX = /(^|:\s*|(?:^|\s)\/\s*|\(≈?\s*)(\d+\s[½¼¾⅓⅔]|\d+\s\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔])(?:\s*[–-]\s*(\d+(?:[.,]\d+)?))?(\s*)(kg|g|ml|dl|l|ks|PL|KL|lžičk\w*|lžič\w*|lžíc\w*|lyžičk\w*|lyžic\w*|hrst\w*|hrnč\w*|hrnk\w*|plát\w*|stroužk\w*|strúčik\w*|strúčk\w*|špetk\w*|štipk\w*|kous\w*|kús\w*|kus\w*|baleni\w*|balení|konzerv\w*|plechovk\w*)?(?![.,]\d)(?=[\s,).]|$)(?!\s*%)/g;
function parseQ(x) {
  if (FRAC[x] != null) return FRAC[x];
  if (/^\d+\s\S+$/.test(x)) { const [w, fr] = x.split(/\s/); return Number(w) + (FRAC[fr] ?? parseQ(fr)); }
  if (x.includes('/')) { const [a, b] = x.split('/').map(Number); return b ? a / b : NaN; }
  return Number(x.replace(',', '.'));
}
function fmtQ(n, unit) {
  if (/^(g|ml)$/.test(unit)) return String(n >= 20 ? Math.round(n / 5) * 5 : Math.max(1, Math.round(n)));
  if (/^(kg|l|dl)$/.test(unit)) return (Math.round(n * 20) / 20).toLocaleString('sk-SK');
  // Kusy (vajcia, banány) na pol kusa, lyžičky a pod. na štvrtiny.
  const step = unit ? 4 : 2;
  const q = Math.max(1 / step, Math.round(n * step) / step);
  const whole = Math.floor(q), rest = q - whole;
  const fr = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[rest] || '';
  return whole ? `${whole}${fr ? ' ' + fr : ''}` : fr;
}
function scaleLine(line, factor) {
  if (factor === 1 || /:$/.test(line)) return line;
  return line.replace(QTY_RX, (m, pre, a, b, sp, unit = '') => {
    const x = parseQ(a);
    if (!Number.isFinite(x)) return m;
    const y = b ? parseQ(b) : null;
    // Pod 1 kg / 1 l radšej v gramoch a mililitroch (0,125 kg -> 125 g).
    const small = { kg: ['g', 1000], l: ['ml', 1000], dl: ['ml', 100] }[unit];
    if (small && x * factor < 1) {
      const [u, k] = small;
      return `${pre}${fmtQ(x * factor * k, u)}${y != null ? '-' + fmtQ(y * factor * k, u) : ''}${sp}${u}`;
    }
    return `${pre}${fmtQ(x * factor, unit)}${y != null ? '-' + fmtQ(y * factor, unit) : ''}${sp}${unit}`;
  });
}
// Recepty z kuchárky majú suroviny na 1 až 4 porcie pripravené aj so správnou gramatikou (r.ing1, r.ingx).
function recipeIng(r, n = 1) {
  const f = r.portions > 1 ? 1 / r.portions : 1;
  const base = r.ing1 || r.ing.map(l => scaleLine(l, f));
  const lines = n === 1 ? base : r.ingx?.[n] || base.map(l => scaleLine(l, n));
  return lines.filter(l => !/^(Na|na) \d+ porc|^Recept na \d/.test(l));
}

// Na koľko porcií varíš (pamätá si poslednú voľbu).
const cookN = () => Math.min(4, Math.max(1, Number(S.profile.cookPortions) || 1));
function ingHtml(r, n) {
  return recipeIng(r, n).map(l => /:$/.test(l) ? `<p class="ing-h">${esc(l.slice(0, -1))}</p>` : `<p>${esc(l)}</p>`).join('');
}
function portionSeg(n) {
  return `<div class="seg" id="r-portions">${[1, 2, 3, 4].map(k => `<button data-rport="${k}" class="${k === n ? 'on' : ''}">${portionsLabel(k)}</button>`).join('')}</div>`;
}

function starsHtml(id, rating) {
  return `<span class="stars">${[1, 2, 3, 4, 5].map(n => `<button class="star ${n <= (rating || 0) ? 'on' : ''}" data-rate="${id}" data-n="${n}" aria-label="${n} z 5">${icon('star', 22, 1.8)}</button>`).join('')}</span>`;
}

// Režim varenia: veľké písmo, krok po kroku, obrazovka nezhasne.
let cookState = null;
async function startCooking(id) {
  const r = findRecipe(id);
  if (!r || cookState) return;
  cookState = { r, i: -1, lock: null };
  try { cookState.lock = await navigator.wakeLock?.request('screen'); } catch { /* nepodporované */ }
  $('#cook-mode').hidden = false;
  drawCooking();
}
function drawCooking() {
  const { r, i } = cookState;
  const n = r.steps.length;
  $('#cook-mode').innerHTML = `
    <div class="cm-top"><span class="muted">${esc(r.title)}</span><button class="round sm" data-act="cook-close" aria-label="Zavrieť">${icon('close', 14, 2.6)}</button></div>
    ${i === -1
      ? `<div class="cm-step"><div class="cm-n">Suroviny, ${portionsLabel(cookN())}</div><div class="cm-ing">${ingHtml(r, cookN())}</div></div>`
      : `<div class="cm-step"><div class="cm-n">Krok ${i + 1} z ${n}</div><p class="cm-text">${esc(r.steps[i])}</p>
        ${r.portions > 1 ? `<p class="small muted">Množstvá v postupe sú pre ${r.portions} ${r.portions < 5 ? 'porcie' : 'porcií'}, ber ich zo surovín vyššie.</p>` : ''}
        ${i === n - 1 && r.kcal ? `<button class="btn" data-eat="${r.id}" data-n="1" style="margin-top:18px">Zjedol som 1 porciu, zapísať (${r0(r.kcal)} kcal)</button>` : ''}</div>`}
    <div class="cm-nav">
      <button class="btn" data-act="cook-prev" ${i <= -1 ? 'disabled' : ''}>${i === 0 ? 'Suroviny' : 'Späť'}</button>
      <button class="btn primary" data-act="cook-next">${i === -1 ? 'Začať' : i >= n - 1 ? 'Hotovo' : 'Ďalej'}</button>
    </div>`;
}
function stopCooking() {
  try { cookState?.lock?.release(); } catch { /* nič */ }
  cookState = null;
  $('#cook-mode').hidden = true;
}

// Recept z internetu: AI si stránku otvorí sama (web_fetch), alebo použije vložený text.
const MYRECIPE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    cat: { type: 'string', enum: ['snidane', 'svaciny', 'hlavni', 'predzapas', 'dezerty'] },
    time: { type: 'integer' },
    ing: { type: 'array', items: { type: 'string' } },
    ing2: { type: 'array', items: { type: 'string' } },
    ing3: { type: 'array', items: { type: 'string' } },
    ing4: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', items: { type: 'string' } },
    kcal: { type: 'number' }, p: { type: 'number' }, c: { type: 'number' }, f: { type: 'number' }, fib: { type: 'number' },
    tags: { type: 'array', items: { type: 'string' } },
    image_url: { type: 'string' },
  },
  required: ['title', 'cat', 'time', 'ing', 'ing2', 'ing3', 'ing4', 'steps', 'kcal', 'p', 'c', 'f', 'fib', 'tags', 'image_url'],
  additionalProperties: false,
};
function openAddRecipe() {
  openSheet('', '');
  wizHead('Recept z internetu', openAllRecipes);
  $('#sheet-body').innerHTML = `
    <input class="input" id="rec-url" type="url" inputmode="url" placeholder="Vlož odkaz na recept (https://…)">
    <p class="small muted" style="margin:8px 0 12px">Alebo sem vlož text receptu (keď stránka nejde otvoriť):</p>
    <textarea class="input" id="rec-text" placeholder="Názov, suroviny a postup…"></textarea>
    <button class="btn primary" id="rec-go" style="margin-top:12px">Pridať recept</button>
    <p class="small muted" style="margin-top:10px">AI ho preloží do slovenčiny, prepočíta na 1 porciu a doplní makrá. Recept ostane len v tvojom mobile.</p>`;
  $('#rec-go').onclick = () => importRecipe($('#rec-go'));
}
async function importRecipe(btn) {
  const url = $('#rec-url').value.trim(), text = $('#rec-text').value.trim();
  if (!url && !text) return toast('Vlož odkaz alebo text receptu.');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Spracúvam recept…';
  const model = S.profile.model || MODELS[0][0];
  const chips = (BOOK?.chips || []).map(c => `${c.id} (${c.label})`).join(', ');
  try {
    const r = await callClaude({
      system: `Z receptu sprav recept do appky. Všetko po slovensky. Suroviny a makrá prepočítaj na 1 porciu pre jedného športovca (jedno jedlo). ing: jedna surovina na riadok s množstvom. ing2, ing3, ing4: tie isté riadky (rovnaký počet) pre 2, 3 a 4 porcie, so správnym tvarom slov (2 vajcia, 5 vajec, 2 lyžice). steps: kroky bez číslovania.
cat: snidane (raňajky), svaciny (desiata/snack), hlavni (obed/večera), predzapas (pred zápasom), dezerty. time: minúty spolu. kcal, p, c, f, fib: na 1 porciu.
tags: id hlavných surovín iba z tohto zoznamu: ${chips}. image_url: odkaz na hlavnú fotku jedla zo stránky, inak prázdny reťazec. Nepoužívaj dlhé pomlčky, namiesto nich píš čiarky.`,
      content: [{ type: 'text', text: url ? `Odkaz na recept: ${url}\n${text ? 'Doplňujúci text:\n' + text : 'Otvor stránku a recept z nej vytiahni.'}` : `Text receptu:\n${text}` }],
      schema: MYRECIPE_SCHEMA,
      effort: 'medium',
      maxTokens: 12000,
      tools: url ? [{ type: model.includes('haiku') ? 'web_fetch_20250910' : 'web_fetch_20260209', name: 'web_fetch', max_uses: 2 }] : undefined,
    });
    S.myRecipes = S.myRecipes || [];
    const id = 100000 + S.myRecipes.length + 1 + Math.floor(Math.random() * 1000) * 1000;
    S.myRecipes.push({ id, mine: true, source: url, title: r.title, cat: r.cat, time: r.time, portions: 1, prep: false,
      kcal: Math.max(0, +r.kcal || 0), p: Math.max(0, +r.p || 0), c: Math.max(0, +r.c || 0), f: Math.max(0, +r.f || 0), fib: Math.max(0, +r.fib || 0), ing: r.ing, steps: r.steps,
      ingx: [2, 3, 4].every(n => r[`ing${n}`]?.length === r.ing.length) ? { 2: r.ing2, 3: r.ing3, 4: r.ing4 } : undefined, req: (r.tags || []).filter(t => BOOK?.chips.some(c => c.id === t)).map(t => [t]),
      img: /^https:\/\//.test(r.image_url) ? r.image_url : '', photo: /^https:\/\//.test(r.image_url) });
    save();
    render();
    toast('Recept pridaný');
    if (btn.isConnected) openRecipe(id, openAllRecipes);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Skúsiť znova';
    toast(url ? `${err.message} Ak stránka nejde, vlož text receptu.` : err.message);
  }
}

// ---------- Sprievodca: jedlo -> suroviny -> recepty -> recept ----------
const wiz = { meal: null, back: null };

function wizHead(title, back) {
  wiz.back = back;
  $('#sheet-title').textContent = nodash(title);
  $('#sheet-back').hidden = !back;
}

function cookStart() {
  openSheet('', '');
  wizHead('Čo ideš jesť?', null);
  $('#sheet-body').innerHTML = `<div class="meal-grid">${MEAL_TYPES.map(([k, l, , e]) =>
    `<button class="meal-tile" data-meal="${k}"><span>${e}</span>${l}</button>`).join('')}</div>`;
}

function mealRecipes() {
  const cats = MEAL_TYPES.find(m => m[0] === wiz.meal)[2];
  return allRecipes().filter(r => cats.includes(r.cat));
}

function cookFridge() {
  wizHead('Čo máš doma?', cookStart);
  const groups = [...new Set(BOOK.chips.map(c => c.group))];
  const have = new Set(S.fridge);
  $('#sheet-body').innerHTML = `
    <p class="small muted" style="margin:-6px 0 6px">Ťukni na všetko, čo máš. Soľ, korenie, olej a vodu rátam automaticky.</p>
    ${groups.map(g => `<h3 class="sub-h" style="margin-top:14px">${g}</h3><div class="chips">${BOOK.chips.filter(c => c.group === g).map(c =>
      `<button class="chip-btn ${have.has(c.id) ? 'on' : ''}" data-chip="${c.id}">${c.label}</button>`).join('')}</div>`).join('')}
    <div class="sticky-cta"><button class="btn primary" data-act="cook-results" id="cook-go"></button></div>`;
  updateCookCount();
}

function cookList() {
  const have = new Set(S.fridge);
  const d = profileDiet();
  const gfPenalty = m => (d.gf ? recipeDiet(m.r).swaps.length : 0) - (rmeta(m.r.id).fav ? 3 : 0) - ((rmeta(m.r.id).rating || 3) - 3);
  const list = mealRecipes().filter(r => fitsDiet(r, d) && !(rmeta(r.id).rating && rmeta(r.id).rating <= 1)).map(r => matchRecipe(r, have));
  if (!have.size) return list.sort((a, b) => gfPenalty(a) - gfPenalty(b) || a.r.title.localeCompare(b.r.title, 'cs'));
  return list.filter(m => m.missing.length <= 2 && m.have >= Math.min(2, m.r.req.length))
    .sort((a, b) => a.missing.length - b.missing.length || gfPenalty(a) - gfPenalty(b) || b.have - a.have);
}

function updateCookCount() {
  const btn = $('#cook-go');
  if (!btn) return;
  const n = cookList().length;
  btn.textContent = S.fridge.length ? (n ? `Ukáž recepty (${n})` : 'Nič nevychádza, pridaj surovinu') : `Ukáž všetky (${n})`;
  btn.disabled = S.fridge.length > 0 && !n;
}

const DIFF = { Easy: 'ľahké', Medium: 'stredne náročné', Hard: 'náročné' };

function recipeCard(m, showMiss) {
  const r = m.r;
  return `<button class="rcard" data-recipe="${r.id}">
    <span class="photo"><img data-photo="${r.id}" alt=""></span>
    <span class="rinfo"><b>${rmeta(r.id).fav ? '<span class="fav-dot">♥</span> ' : ''}${esc(r.title)}</b>
      ${rmeta(r.id).rating ? `<span class="rating">${'★'.repeat(rmeta(r.id).rating)}<span class="muted">${'★'.repeat(5 - rmeta(r.id).rating)}</span></span>` : ''}
      <span class="small muted">${[r.time && r.time + '\u00a0min', r.kcal && r0(r.kcal) + '\u00a0kcal', r.p && 'B\u00a0' + r0(r.p) + '\u00a0g'].filter(Boolean).join(' · ')}</span>
      ${showMiss ? (m.missing.length ? `<span class="miss">Chýba: ${m.missing.map(a => esc(chipLabel(a[0]))).join(', ')}</span>` : '<span class="ok">Máš všetko</span>') : ''}
      ${dietBadge(r, profileDiet())}</span>
  </button>`;
}

function cookResults() {
  const meal = MEAL_TYPES.find(m => m[0] === wiz.meal)[1];
  wizHead(meal, cookFridge);
  const list = cookList();
  const showMiss = S.fridge.length > 0;
  $('#sheet-body').innerHTML = list.length
    ? `<div class="rgrid">${list.map(m => recipeCard(m, showMiss)).join('')}</div>`
    : '<div class="empty">Nič nevychádza. Vráť sa a pridaj surovinu.</div>';
  fillPhotos($('#sheet-body'));
}

function openRecipe(id, back = null, eatN = 1) {
  const r = findRecipe(id);
  if (!r) return;
  const have = new Set(S.fridge);
  if ($('#sheet-bg').hidden) openSheet('', '');
  wizHead(r.title, back);
  const meta = [r.time && r.time + ' min' + (r.extra ? ' ' + r.extra : ''), DIFF[r.diff] || r.diff, r.prep && 'dá sa na viac dní', r.mine && 'môj recept'].filter(Boolean).join(' · ');
  const m = rmeta(r.id);
  const miss = have.size ? matchRecipe(r, have).missing : [];
  $('#sheet-body').innerHTML = `
    <div class="photo big"><img data-photo="${r.id}" alt="${esc(r.title)}"></div>
    <div class="rate-row"><button class="round fav-btn ${m.fav ? 'on' : ''}" data-rfav="${r.id}" aria-label="Obľúbený">${icon('heart', 20, 2)}</button>${starsHtml(r.id, m.rating)}</div>
    <input class="input" id="r-note" placeholder="Moja poznámka" value="${esc(m.note || '')}" style="margin-bottom:10px">
    ${meta ? `<p class="small muted" style="margin:0 0 12px">${esc(meta)}</p>` : ''}
    ${r.kcal ? `<div class="ai-sum"><div class="grid4">
      <div><b>${r0(r.kcal)}</b><div class="lbl">kcal</div></div>
      <div><b>${r0(r.p)} g</b><div class="lbl">bielkoviny</div></div>
      <div><b>${r0(r.c)} g</b><div class="lbl">sacharidy</div></div>
      <div><b>${r0(r.f)} g</b><div class="lbl">tuky</div></div></div>
      <p class="small muted" style="margin-top:8px">Hodnoty na 1 porciu.</p></div>` : ''}
    <h3 class="sub-h" style="margin-top:4px">Suroviny</h3>
    ${portionSeg(cookN())}
    <div class="ing" id="r-ing">${ingHtml(r, cookN())}</div>
    ${miss.length ? `<p class="miss" style="margin-top:8px">Chýba ti: ${miss.map(a => esc(chipLabel(a[0]))).join(', ')}</p>` : ''}
    ${recipeDietBox(r, back === showPlan && S.mealPlan ? dietOf(S.mealPlan.form) : profileDiet())}
    <h3 class="sub-h">Postup</h3>
    ${r.portions > 1 ? `<p class="small muted" style="margin:-2px 0 10px">Čísla v postupe sú z pôvodného receptu na ${r.portions} ${r.portions < 5 ? 'porcie' : 'porcií'}, množstvá ber zo surovín vyššie.</p>` : ''}
    <ol class="steps">${r.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
    ${r.kcal ? `<h3 class="sub-h">Zjedol som</h3><div class="grid3">${[...new Set([eatN, 1, 1.5, 2])].slice(0, 3).sort((a, b) => a - b).map(n =>
      `<button class="btn ${n === eatN ? 'primary' : ''}" data-eat="${r.id}" data-n="${n}">${portionsLabel(n)}</button>`).join('')}</div>` : ''}
    <button class="btn" data-cook-mode="${r.id}" style="margin-top:10px">Variť krok po kroku</button>
    ${r.mine ? `${r.source ? `<p class="small muted" style="margin-top:14px;overflow-wrap:anywhere">Zdroj: ${esc(r.source)}</p>` : ''}
      <button class="btn danger" data-act="recipe-del" data-id="${r.id}" style="margin-top:10px">Zmazať môj recept</button>` : ''}`;
  $('#sheet-body').scrollTop = 0;
  $('.sheet').scrollTop = 0;
  $('#r-note').addEventListener('change', e => { S.recipeMeta[r.id] = { ...rmeta(r.id), note: e.target.value.trim() }; save(); });
  fillPhotos($('#sheet-body'));
}

// ---------- Plán jedál a nákup (Kaufland / Jednota) ----------
// Appka vyberie kandidátov z kuchárky, Claude z nich poskladá plán (to isté jedlo max. 2 dni po sebe)
// a nákupný zoznam s odhadom cien. Ceny sú odhad, nie z letákov.
const PLAN_MEALS = [
  ['ranajky', 'Raňajky', ['snidane', 'predzapas']],
  ['obed', 'Obed', ['hlavni']],
  ['vecera', 'Večera', ['hlavni']],
  ['snack', 'Snack / sladké', ['svaciny', 'dezerty']],
];
const PLAN_PREFS = [
  ['sladke', 'Sladké', r => /čokol|banán|lievan|lívan|palacin|palačin|kaš|brownie|koláč|muffin|smoothie|overnight|dezert|tiramisu|perník|buchta|bábovk|vafl|mugcake|puding|cheesecake|tvarohov|jogurtov/i.test(r.title)],
  ['kuracie', 'Kuracie', r => r.req.some(a => a.includes('kuracie'))],
  ['hovadzie', 'Hovädzie', r => r.req.some(a => a.includes('hovadzie'))],
  ['ryby', 'Ryby', r => r.req.some(a => a.some(x => ['losos', 'tuniak', 'ryba', 'krevety'].includes(x)))],
  ['cestoviny', 'Cestoviny', r => r.req.some(a => a.includes('cestoviny'))],
  ['ryza', 'Ryža', r => r.req.some(a => a.includes('ryza'))],
  ['bezmasa', 'Bez mäsa', r => !r.req.some(a => a.some(x => ['kuracie', 'morcacie', 'hovadzie', 'bravcove', 'sunka', 'losos', 'tuniak', 'ryba', 'krevety'].includes(x)))],
  ['rychle', 'Rýchle (do 20 min)', r => r.time && r.time <= 20],
  ['mealprep', 'Navariť na viac dní', r => r.prep],
];
const planForm = { days: 3, meals: ['ranajky', 'obed', 'vecera'], people: 1, budget: 30, prefs: [], wish: '', gf: null, allergens: null };

// Nákup v jednom obchode, rozdeliť len keď to ušetrí aspoň 2 €.
function planCost(r) {
  const k = Number(r.total_kaufland) || 0, j = Number(r.total_jednota) || 0;
  const store = k <= j ? 'kaufland' : 'jednota';
  const single = Math.min(k, j), split = Number(r.total_best) || single;
  const useSplit = single - split >= 2;
  return { store, single, split, useSplit, best: useSplit ? split : single };
}
// Dátum dňa plánu (deň 1 = deň, keď vznikol).
const planDate = (p, n) => dayKey(addDays(new Date(p.ts || Date.now()), n - 1));
const MEAL_LABEL = k => ({ ranajky: 'Raňajky', obed: 'Obed', vecera: 'Večera', snack: 'Snack' })[k] || k;

function planCard() {
  const p = S.mealPlan;
  const today = p?.result.days.find(d => planDate(p, d.day) === curDate);
  const sub = p
    ? today ? `${curDate === todayKey() ? 'Dnes' : 'V tento deň'}: ${today.meals.map(m => `${MEAL_LABEL(m.meal)} ${esc(findRecipe(m.recipe_id)?.title || '')}`).join(' · ')}`
      : `${p.form.days} ${p.form.days < 5 ? 'dni' : 'dní'} · ${p.form.people} ${p.form.people === 1 ? 'osoba' : p.form.people < 5 ? 'osoby' : 'osôb'} · odhad ${eur(planCost(p.result).best)} z ${eur(p.form.budget)}`
    : 'Zadaj rozpočet a počet dní, poskladám jedlá aj nákup.';
  return `<button class="cook-hero" data-act="plan"><span><b>Plán a nákup</b><span>${sub}</span></span>${icon('right', 22, 2.4)}</button>`;
}

function eur(n) { return (Number(n) || 0).toLocaleString('sk-SK', { style: 'currency', currency: 'EUR' }); }

function openPlan() {
  if (!BOOK) return toast('Najprv odomkni kuchárku (karta Čo si uvarím?).');
  if (S.mealPlan) return showPlan();
  planStep1();
}

// Krok 1: dni, jedlá, ľudia, rozpočet, chute, všetko ťukaním.
function planStep1() {
  // Strava plánu: predvolene podľa profilu, dá sa zmeniť (napr. varíš aj pre priateľku).
  if (planForm.gf === null) planForm.gf = !!S.profile.glutenFree;
  if (planForm.allergens === null) planForm.allergens = [...(S.profile.allergens || [])];
  openSheet('', '');
  wizHead('Nový plán', S.mealPlan ? showPlan : null);
  const seg = (name, opts, cur) => `<div class="seg">${opts.map(([v, l]) =>
    `<button data-pf="${name}" data-v="${v}" class="${String(v) === String(cur) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const allMeals = planForm.meals.length === PLAN_MEALS.length;
  $('#sheet-body').innerHTML = `
    <h3 class="sub-h" style="margin-top:0">Na koľko dní</h3>
    ${seg('days', [[2, '2'], [3, '3'], [5, '5'], [7, 'Týždeň']], planForm.days)}
    <h3 class="sub-h">Ktoré jedlá</h3>
    <div class="chips"><button class="chip-btn ${allMeals ? 'on' : ''}" data-pm="all">Celý deň</button>${PLAN_MEALS.map(([k, l]) =>
      `<button class="chip-btn ${planForm.meals.includes(k) && !allMeals ? 'on' : ''}" data-pm="${k}">${l}</button>`).join('')}</div>
    <h3 class="sub-h">Pre koľko ľudí</h3>
    ${seg('people', [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5+']], planForm.people)}
    <h3 class="sub-h">Strava (platí pre všetkých)</h3>
    <div class="chips"><button class="chip-btn ${planForm.gf ? 'on' : ''}" data-pdiet="gf">Bezlepkové</button>${ALLERGENS.map(([k, , , g]) =>
      `<button class="chip-btn ${planForm.allergens.includes(k) ? 'on' : ''}" data-pall="${k}">Bez ${g}</button>`).join('')}</div>
    <h3 class="sub-h">Rozpočet na celý nákup (€)</h3>
    <input class="input" id="plan-budget" type="text" inputmode="decimal" autocomplete="off" min="1" value="${planForm.budget}">
    <h3 class="sub-h">Na čo máš chuť</h3>
    <div class="chips">${PLAN_PREFS.map(([k, l]) => `<button class="chip-btn ${planForm.prefs.includes(k) ? 'on' : ''}" data-pp="${k}">${l}</button>`).join('')}</div>
    <input class="input" id="plan-wish" placeholder="Niečo navyše? napr. bez húb, veľa ovocia" value="${esc(planForm.wish)}" style="margin-top:10px">
    <button class="btn" data-act="receipt" style="margin-top:14px">${icon('receipt', 18)}Odfotiť bloček (skutočné ceny)</button>
    <div class="sticky-cta"><button class="btn primary" data-act="plan-go">Poskladať plán a nákup</button></div>`;
  $('#plan-budget').addEventListener('input', e => { planForm.budget = numIn(e.target.value); });
  $('#plan-wish').addEventListener('input', e => { planForm.wish = e.target.value; });
}

function planCandidates() {
  const picked = new Map();
  const prefs = PLAN_PREFS.filter(([k]) => planForm.prefs.includes(k));
  for (const [k, , cats] of PLAN_MEALS) {
    if (!planForm.meals.includes(k)) continue;
    const d = dietOf(planForm);
    const pool = allRecipes().filter(r => cats.includes(r.cat) && r.kcal && fitsDiet(r, d) && !(rmeta(r.id).rating && rmeta(r.id).rating <= 2))
      .map(r => ({ r, s: prefs.reduce((s, [, , f]) => s + (f(r) ? 2 : 0), 0) + Math.random() * 1.5 - (d.gf ? recipeDiet(r).swaps.length * 0.6 : 0)
        + (rmeta(r.id).fav ? 2 : 0) + (rmeta(r.id).rating ? rmeta(r.id).rating - 3 : 0) }))
      .sort((a, b) => b.s - a.s).slice(0, k === 'vecera' ? 15 : 22);
    pool.forEach(({ r }) => picked.set(r.id, r));
  }
  return [...picked.values()];
}

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    days: { type: 'array', items: { type: 'object', properties: {
      day: { type: 'integer' },
      meals: { type: 'array', items: { type: 'object', properties: {
        meal: { type: 'string', enum: ['ranajky', 'obed', 'vecera', 'snack'] },
        recipe_id: { type: 'integer' },
        portions: { type: 'number' },
        note: { type: 'string' },
      }, required: ['meal', 'recipe_id', 'portions', 'note'], additionalProperties: false } },
    }, required: ['day', 'meals'], additionalProperties: false } },
    shopping: { type: 'array', items: { type: 'object', properties: {
      item: { type: 'string' },
      amount: { type: 'string' },
      kaufland: { type: 'number' },
      jednota: { type: 'number' },
    }, required: ['item', 'amount', 'kaufland', 'jednota'], additionalProperties: false } },
    pantry: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['days', 'shopping', 'pantry', 'summary'],
  additionalProperties: false,
};

async function generatePlan() {
  const f = { ...planForm, meals: [...planForm.meals], prefs: [...planForm.prefs], allergens: [...planForm.allergens] };
  const d = dietOf(f);
  const t = targets(todayKey());
  const cands = planCandidates();
  const line = r => `#${r.id}${rmeta(r.id).fav ? ' [obľúbené]' : ''}${rmeta(r.id).rating ? ` [chutilo ${rmeta(r.id).rating}/5]` : ''}${d.gf && recipeDiet(r).swaps.length ? ` [bezlepkovo nahradiť: ${recipeDiet(r).swaps.map(s => s.to).join('; ')}]` : ''} | ${r.title} | ${BOOK.cats.find(c => c.id === r.cat)?.label} | recept na ${r.portions} porc. | ${r0(r.kcal)} kcal, B ${r0(r.p)} g / porcia | ${r.time || '?'} min${r.prep ? ' | meal prep' : ''}\n  suroviny: ${r.ing.filter(l => !/:$/.test(l)).map(l => l.slice(0, 70)).slice(0, 16).join('; ')}`;
  const mealNames = PLAN_MEALS.filter(([k]) => f.meals.includes(k)).map(([k, l]) => `${k} (${l})`).join(', ');
  const prefs = PLAN_PREFS.filter(([k]) => f.prefs.includes(k)).map(([, l]) => l).join(', ');
  // Koľko kalórií majú pokryť naplánované jedlá (zvyšok dňa sú iné jedlá a desiaty).
  const share = { ranajky: 0.25, obed: 0.3, vecera: 0.3, snack: 0.15 };
  const planKcal = t ? r0(t.kcal * Math.min(0.95, f.meals.reduce((a, k) => a + (share[k] || 0), 0))) : null;
  const res = await callClaude({
    system: `Si plánovač jedál a nákupov pre športovca na Slovensku, ktorý chce nabrať svaly. Recepty sú zo Športovej kuchárky.
Pravidlá plánu:
- Použi IBA recepty zo zoznamu (recipe_id). Každý deň naplánuj presne zvolené jedlá.
- To isté jedlo smie byť najviac 2 dni po sebe (uvarí sa raz, zje sa 2×), nikdy 3×. Obed a večera v ten istý deň nech sú rôzne.
- Recepty [obľúbené] a s vysokým hodnotením zaraď častejšie.
- portions: koľko porcií zje používateľ (0,5 až 3, po pol porcii), aby naplánované jedlá v každom dni dali spolu približne jeho cieľ kalórií pre tieto jedlá. Športovec na priberanie často potrebuje 1,5 až 2 porcie hlavného jedla.
- V nákupe počítaj pre používateľa jeho portions a pre každého ďalšieho človeka 1 porciu na jedlo. Kcal v zozname sú na 1 porciu.
- Strieda chute a suroviny, rešpektuj preferencie. Zdravé, ale chutné; ak chce sladké, zaraď sladké raňajky alebo snack.
- Šetri peniaze: opakuj suroviny naprieč receptami (jedno balenie na viac jedál), sezónne a lacné potraviny. Drž sa rozpočtu.
- note: krátko, napr. "uvar 4 porcie, aj na zajtra" alebo "zvyšok zo včera". Inak prázdny reťazec.
Nákupný zoznam:
- Spoj suroviny zo všetkých jedál pre zadaný počet ľudí, zaokrúhli na bežné balenia v slovenských obchodoch (napr. "1 kg", "500 g", "10 ks", "1 l").
- Názvy po slovensky. Soľ, korenie, olej, ocot a koreniny daj do pantry (veci, ktoré asi má doma), nie do shopping.
- Ak niečo už má doma (zoznam nižšie), nekupuj to.
- Ak je strava bezlepková: všetko musí byť bez lepku. Pri receptoch s poznámkou [bezlepkovo nahradiť] kupuj bezlepkové verzie (napr. bezlepkové cestoviny, chlieb, certifikované bezlepkové vločky) a v názve položky to napíš. Pri alergiách nesmie byť v nákupe žiadny daný alergén.
- Ak sú k dispozícii skutočné ceny z bločkov, použi ich pre daný obchod a pre druhý obchod odhadni podľa nich.
- kaufland a jednota: odhad ceny celého balenia v eurách podľa bežných cien v Kauflande a COOP Jednote na Slovensku v roku 2026. Jednota býva o niečo drahšia.
summary: 1-2 vety po slovensky, či sa plán zmestí do rozpočtu a kde sa oplatí nakúpiť. Nepoužívaj dlhé pomlčky, namiesto nich píš čiarky.`,
    content: [{ type: 'text', text: `Počet dní: ${f.days}. Jedlá: ${mealNames}. Počet ľudí: ${f.people}. Rozpočet na celý nákup: ${f.budget} €.
${t ? `Denný cieľ používateľa: ${t.kcal} kcal, ${t.p} g bielkovín. Naplánované jedlá mu majú dať spolu približne ${planKcal} kcal denne.` : 'Používateľ: 1 porcia na jedlo.'}
Strava: ${dietActive(d) ? dietSummary(d) : 'bez obmedzení'}.
Preferencie: ${prefs || 'žiadne'}${f.wish ? `. Navyše: ${f.wish}` : ''}.
Doma už má: ${S.fridge.length ? S.fridge.map(chipLabel).join(', ') : 'nič nezadané'}.${knownPrices()}

Recepty na výber:
${cands.map(line).join('\n')}` }],
    schema: PLAN_SCHEMA,
    effort: 'medium',
    maxTokens: 32000,
  });
  const ids = new Set(allRecipes().map(r => r.id));
  res.days = (res.days || []).map(d => ({ ...d, meals: d.meals.filter(m => ids.has(m.recipe_id))
    .map(m => ({ ...m, portions: Math.min(3, Math.max(0.5, Math.round((Number(m.portions) || 1) * 2) / 2)) })) }));
  res.shopping = (res.shopping || []).map(it => ({ ...it, kaufland: Math.max(0, +it.kaufland || 0), jednota: Math.max(0, +it.jednota || 0), done: false }));
  const sum = k => res.shopping.reduce((s, it) => s + (Number(it[k]) || 0), 0);
  res.total_kaufland = sum('kaufland');
  res.total_jednota = sum('jednota');
  res.total_best = res.shopping.reduce((s, it) => s + Math.min(Number(it.kaufland) || 0, Number(it.jednota) || 0), 0);
  return { form: f, result: res, ts: Date.now() };
}

async function runPlan(btn) {
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Skladám plán, nechaj appku otvorenú…';
  try {
    S.mealPlan = await generatePlan();
    save();
    render();
    // Ak medzitým zavrel panel, plán sa len uloží (nájde ho v Pláne a nákupe).
    if (btn.isConnected) showPlan(); else toast('Plán je hotový, nájdeš ho v Pláne a nákupe.');
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Skúsiť znova';
    toast(err.message || 'Niečo sa pokazilo.');
    if (!getKey()) { closeSheet(); openProfile(); }
  }
}

// ---------- Bloček: skutočné ceny pre plán ----------
const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    store: { type: 'string', enum: ['kaufland', 'jednota', 'ine'] },
    date: { type: 'string' },
    items: { type: 'array', items: { type: 'object', properties: {
      name: { type: 'string' }, amount: { type: 'string' }, price: { type: 'number' },
    }, required: ['name', 'amount', 'price'], additionalProperties: false } },
  },
  required: ['store', 'date', 'items'],
  additionalProperties: false,
};

async function readReceipt(b64) {
  openSheet('Bloček', '<button class="btn primary" disabled><span class="spinner"></span> AI číta bloček…</button>');
  const gen = sheetGen;
  try {
    const r = await callClaude({
      system: `Prečítaj pokladničný bloček zo slovenského obchodu. store: kaufland, jednota alebo ine. date: dátum nákupu (RRRR-MM-DD, ak nie je, prázdny reťazec).
items: iba potraviny. name: zrozumiteľný všeobecný názov po slovensky (napr. "Kuracie prsia", "Ryža basmati", "Mlieko 1,5 %"), bez značky ak nie je dôležitá. amount: balenie (napr. "1 kg", "500 g", "1 l", "10 ks"), ak sa nedá zistiť, prázdny reťazec. price: cena za položku v eurách po zľave.`,
      content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }, { type: 'text', text: 'Prečítaj tento bloček.' }],
      schema: RECEIPT_SCHEMA,
      effort: 'low',
    });
    const date = /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : todayKey();
    const key = x => `${x.store}|${norm(x.name)}`;
    const fresh = r.items.filter(it => it.price > 0).map(it => ({ store: r.store, name: it.name, amount: it.amount, price: Math.round(it.price * 100) / 100, date }));
    const keys = new Set(fresh.map(key));
    S.prices = [...fresh, ...(S.prices || []).filter(x => !keys.has(key(x)))].slice(0, 400);
    save();
    if (!sheetStill(gen)) return toast(`Bloček uložený: ${fresh.length} ${plural(fresh.length, 'položka', 'položky', 'položiek')}`);
    wizHead('Bloček uložený', S.mealPlan ? showPlan : null);
    const storeName = { kaufland: 'Kaufland', jednota: 'Jednota', ine: 'Iný obchod' }[r.store];
    $('#sheet-body').innerHTML = `<p class="small muted" style="margin-bottom:10px">${storeName} · ${parseDay(date).toLocaleDateString('sk-SK')} · ${fresh.length} ${plural(fresh.length, 'položka', 'položky', 'položiek')}. Ďalší plán ich použije namiesto odhadu.</p>
      <div class="list">${fresh.map(x => `<div class="list-item"><span>${esc(x.name)} <span class="muted small">${esc(x.amount)}</span></span><b>${eur(x.price)}</b></div>`).join('')}</div>`;
  } catch (err) {
    toast(err.message);
    if (sheetStill(gen)) closeSheet();
  }
}

function knownPrices() {
  const list = (S.prices || []).slice(0, 120);
  if (!list.length) return '';
  return '\nSkutočné ceny z mojich bločkov (použi ich namiesto odhadu pre daný obchod, ak ide o rovnakú vec):\n' +
    list.map(x => `${x.store === 'ine' ? 'iný obchod' : x.store}: ${x.name}${x.amount ? ' ' + x.amount : ''} = ${x.price} € (${x.date})`).join('\n');
}

let planTab = 'plan';
function showPlan() {
  const { form: f, result: r } = S.mealPlan;
  if ($('#sheet-bg').hidden) openSheet('', '');
  wizHead('Plán a nákup', null);
  const pc = planCost(r);
  const over = pc.best > f.budget;
  const storeName = k => k === 'kaufland' ? 'Kaufland' : 'Jednota';
  const dsum = dietActive(dietOf(f)) ? `<p class="small muted" style="margin:-4px 0 12px">Strava: ${dietSummary(dietOf(f))}</p>` : '';
  const mealLabel = k => PLAN_MEALS.find(m => m[0] === k)?.[1] || k;
  const title = id => findRecipe(id)?.title || 'Recept';
  // Pri nákupe v jednom obchode sú všetky položky z neho, inak z lacnejšieho.
  const cheaper = it => !pc.useSplit ? pc.store : (Number(it.kaufland) || 0) <= (Number(it.jednota) || 0) ? 'kaufland' : 'jednota';
  const tabs = `<div class="seg"><button data-ptab="plan" class="${planTab === 'plan' ? 'on' : ''}">Jedlá</button><button data-ptab="shop" class="${planTab === 'shop' ? 'on' : ''}">Nákup</button></div>`;
  const head = `<div class="ai-sum"><div class="grid3">
      <div><b>${eur(pc.best)}</b><div class="lbl">${pc.useSplit ? 'v 2 obchodoch' : storeName(pc.store)}</div></div>
      <div><b>${eur(f.budget)}</b><div class="lbl">rozpočet</div></div>
      <div><b class="${over ? 'bad' : 'good'}">${eur(Math.abs(f.budget - pc.best))}</b><div class="lbl">${over ? 'nad rozpočet' : 'ostáva'}</div></div></div>
      ${r.summary ? `<p class="small" style="margin-top:10px">${esc(r.summary)}</p>` : ''}</div>`;
  let body;
  if (planTab === 'plan') {
    body = r.days.map(d => `<h3 class="sub-h">Deň ${d.day} <span>· ${parseDay(planDate(S.mealPlan, d.day)).toLocaleDateString('sk-SK', { weekday: 'short', day: 'numeric', month: 'numeric' })}</span></h3><div class="list">${d.meals.map(m => `
      <button class="entry" data-plan-recipe="${m.recipe_id}" data-n="${m.portions || 1}"><div class="info"><div class="small muted">${mealLabel(m.meal)}</div>
        <div class="name">${esc(title(m.recipe_id))}</div><div class="small muted">${[portionsLabel(m.portions || 1), findRecipe(m.recipe_id)?.kcal && r0(findRecipe(m.recipe_id).kcal * (m.portions || 1)) + ' kcal', m.note && esc(m.note)].filter(Boolean).join(' · ')}</div></div>${icon('right', 16, 2.2)}</button>`).join('')}</div>`).join('');
  } else {
    const items = r.shopping.map((it, i) => ({ it, i, best: cheaper(it) }));
    const group = store => items.filter(x => x.best === store);
    const row = ({ it, i, best }) => `<button class="shop-item ${it.done ? 'done' : ''}" data-shop="${i}">
        <span class="check">${it.done ? icon('check', 14, 3) : ''}</span>
        <span class="info"><span class="name">${esc(it.item)}</span><span class="small muted">${esc(it.amount)}</span></span>
        <span class="prices"><b>${eur(it[best])}</b><span class="small muted">${best === 'kaufland' ? 'Jednota' : 'Kaufland'} ${eur(it[best === 'kaufland' ? 'jednota' : 'kaufland'])}</span></span></button>`;
    body = [['kaufland', 'Kaufland'], ['jednota', 'Jednota']].map(([k, l]) => group(k).length
      ? `<h3 class="sub-h">${l} <span>· ${eur(group(k).reduce((s, x) => s + (Number(x.it[k]) || 0), 0))}</span></h3><div class="list">${group(k).map(row).join('')}</div>` : '').join('')
      + `<p class="small muted" style="margin-top:14px">${pc.useSplit ? `Rozdelený nákup ušetrí ${eur(pc.single - pc.split)}. ` : `Nakúp všetko v ${pc.store === 'kaufland' ? 'Kauflande' : 'Jednote'}, rozdelenie by ušetrilo len ${eur(pc.single - pc.split)}. `}Všetko v Kauflande: ${eur(r.total_kaufland)} · všetko v Jednote: ${eur(r.total_jednota)}.<br>Ceny sú odhad podľa bežných cien, nie z aktuálneho letáku.</p>`
      + (r.pantry?.length ? `<h3 class="sub-h">Asi máš doma</h3><p class="small muted">${r.pantry.map(esc).join(', ')}</p>` : '')
      + (navigator.share ? `<button class="btn" data-act="shop-share" style="margin-top:16px">Poslať zoznam (Poznámky, správa)</button>` : '');
  }
  $('#sheet-body').innerHTML = dsum + head + tabs + body + `<button class="btn" data-act="plan-new" style="margin-top:20px">Nový plán</button>
    <button class="btn" data-act="receipt" style="margin-top:10px">${icon('receipt', 18)}Odfotiť bloček (skutočné ceny)</button>
    ${S.prices?.length ? `<p class="small muted" style="margin-top:8px;text-align:center">Uložené ceny z bločkov: ${S.prices.length}</p>` : ''}`;
}

function portionsLabel(n) {
  const txt = String(n).replace('.', ',');
  return `${txt} ${n === 1 ? 'porcia' : n > 1 && n < 5 && Number.isInteger(n) ? 'porcie' : Number.isInteger(n) ? 'porcií' : 'porcie'}`;
}

function recipeDietBox(r, d) {
  const info = recipeDiet(r);
  const bad = d.allergens.filter(a => info.allergens.includes(a));
  let html = '';
  if (bad.length) html += `<div class="diet-box bad"><b>Pozor, obsahuje:</b> ${bad.map(a => ALLERGENS.find(x => x[0] === a)[1]).join(', ')}</div>`;
  if (d.gf) html += info.swaps.length
    ? `<div class="diet-box"><b>Bezlepková úprava</b>${info.swaps.map(s => `<p>${esc(s.from)} <span class="muted">→</span> <b>${esc(s.to)}</b></p>`).join('')}</div>`
    : '<div class="diet-box ok"><b>Bez lepku</b> v surovinách. Pri hotových výrobkoch (koreniny, omáčky) skontroluj obal.</div>';
  return html;
}

function eatRecipe(id, n = 1) {
  const r = findRecipe(id);
  if (!r?.kcal) return;
  addEntries([{ name: n === 1 ? r.title : `${r.title} (${portionsLabel(n)})`, g: 0, kcal: r.kcal * n, p: r.p * n, c: r.c * n, f: r.f * n, fib: (r.fib || 0) * n, score: 8 }], 'kucharka');
}

let onlyFav = false, recQ = '';
function openAllRecipes() {
  openSheet('', '');
  wizHead('Všetky recepty', null);
  const cats = BOOK.cats.filter(c => allRecipes().some(r => r.cat === c.id));
  $('#sheet-body').innerHTML = `
    <button class="btn" data-act="add-recipe" style="margin-bottom:10px">${icon('link', 18)}Pridať recept z internetu</button>
    <input class="input" id="recipe-q" type="search" placeholder="Hľadať (napr. kuracie, kaša, losos)" autocomplete="off" value="${esc(recQ)}">
    <div class="chips" style="margin-top:10px"><button class="chip-btn ${onlyFav ? 'on' : ''}" data-act="only-fav">♥ Len obľúbené</button></div>
    <div id="recipe-results" style="margin-top:6px"></div>`;
  const draw = () => {
    // Hľadá podľa základu slova (kuracie = kurací = kuracím).
    const stems = norm($('#recipe-q').value.trim()).split(/\s+/).filter(Boolean).map(w => w.length > 5 ? w.slice(0, -2) : w.length > 3 ? w.slice(0, -1) : w);
    const hit = r => (!stems.length || stems.every(st => norm(r.title + ' ' + r.ing.join(' ') + ' ' + r.req.flat().join(' ')).includes(st))) && (!onlyFav || rmeta(r.id).fav);
    const hidden = allRecipes().filter(r => !fitsDiet(r, profileDiet())).length;
    $('#recipe-results').innerHTML = (hidden ? `<p class="small muted" style="margin-top:8px">${hidden} ${plural(hidden, 'recept je skrytý', 'recepty sú skryté', 'receptov je skrytých')} pre tvoje alergie.</p>` : '') + cats.map(c => {
      const rs = allRecipes().filter(r => r.cat === c.id && hit(r) && fitsDiet(r, profileDiet()));
      return rs.length ? `<h3 class="sub-h" style="margin-top:10px">${c.label} <span class="muted small">${rs.length}</span></h3>
        <div class="rgrid">${rs.map(r => recipeCard({ r, missing: [] }, false)).join('')}</div>` : '';
    }).join('') || '<div class="empty">Nič sa nenašlo.</div>';
    fillPhotos($('#recipe-results'));
  };
  let t;
  $('#recipe-q').addEventListener('input', () => { recQ = $('#recipe-q').value; clearTimeout(t); t = setTimeout(draw, 200); });
  draw();
}

function streak() {
  const dates = new Set(S.entries.map(e => e.date));
  let d = new Date();
  if (!dates.has(dayKey(d))) d = addDays(d, -1);
  let n = 0;
  while (dates.has(dayKey(d))) { n++; d = addDays(d, -1); }
  return n;
}

// Jeden najdôležitejší tip namiesto zoznamu.
function mainTip(logged) {
  const done = logged.filter(x => x.d !== todayKey());
  if (done.length < 2) return '';
  const kMiss = done.filter(x => x.t && x.kcal < x.t.kcal * 0.9).length;
  const pMiss = done.filter(x => x.t && x.p < x.t.p * 0.9).length;
  if (kMiss > done.length / 2) return `Kalórie si nesplnil ${kMiss}× z ${done.length}. Pridaj kalorické veci: ovsené vločky s arašidovým maslom, orechy, olivový olej, mliečny shake.`;
  if (pMiss > done.length / 2) return `Bielkoviny pod cieľom ${pMiss}× z ${done.length}. Daj do každého jedla mäso, vajcia, tvaroh, skyr alebo proteín.`;
  const sc = done.reduce((s, x) => s + x.scoreW, 0) / (done.reduce((s, x) => s + x.kcal, 0) || 1);
  if (sc < 5) return 'Veľa spracovaného jedla. Rovnaké kalórie dáš aj z ryže, mäsa, vajec, orechov a ovocia.';
  return 'Ideš dobre, drž to. 💪';
}

// ---------- Váha ----------
function weightTrend() {
  const ws = sortedWeights();
  if (ws.length < 2) return null;
  const last = parseDay(ws.at(-1).date);
  const days = d => Math.round((last - parseDay(d)) / 864e5);
  const recent = ws.filter(w => days(w.date) <= 28);
  if (recent.length < 3 || days(recent[0].date) < 6) return null;
  // Lineárna regresia kg vs. deň.
  const xs = recent.map(w => -days(w.date)), ys = recent.map(w => w.kg);
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0) || 1;
  const perWeek = (num / den) * 7;
  return { perWeek, pct: (perWeek / my) * 100 };
}

function trendAdvice(tr) {
  if (Number(S.profile.surplus) <= 0) {
    if (Math.abs(tr.pct) < 0.15) return { text: 'Váha drží. ✓', delta: 0 };
    return tr.pct > 0 ? { text: 'Priberáš. Uber ~150 kcal denne.', delta: -150 } : { text: 'Chudneš. Pridaj ~150 kcal denne.', delta: 150 };
  }
  if (tr.pct < -0.1) return { text: 'Chudneš. Pridaj ~250 kcal denne.', delta: 250 };
  if (tr.pct < 0.1) return { text: 'Váha stojí. Pridaj ~150 kcal denne.', delta: 150 };
  if (tr.pct < 0.25) return { text: 'Priberáš pomaly. Pridaj ~100 kcal.', delta: 100 };
  if (tr.pct <= 0.5) return { text: 'Ideálne tempo na svaly. ✓', delta: 0 };
  if (tr.pct <= 0.75) return { text: 'Trochu rýchlo. Uber ~100 kcal.', delta: -100 };
  return { text: 'Príliš rýchlo, pribúda tuk. Uber ~150 kcal.', delta: -150 };
}

// Malý graf váhy za posledné 3 mesiace.
function weightChart(ws) {
  const from = dayKey(addDays(new Date(), -90));
  const pts = ws.filter(w => w.date >= from);
  if (pts.length < 2) return '';
  const W = 320, H = 110, pad = 8;
  const t0 = parseDay(pts[0].date).getTime(), t1 = parseDay(pts.at(-1).date).getTime() || t0 + 1;
  const lo = Math.min(...pts.map(w => w.kg)) - 0.5, hi = Math.max(...pts.map(w => w.kg)) + 0.5;
  const x = d => pad + ((parseDay(d).getTime() - t0) / (t1 - t0 || 1)) * (W - 2 * pad - 48);
  const y = kg => pad + (1 - (kg - lo) / (hi - lo)) * (H - 2 * pad - 14);
  const line = pts.map((w, i) => `${i ? 'L' : 'M'}${x(w.date).toFixed(1)} ${y(w.kg).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Vývoj váhy">
    <path d="${line}" fill="none" stroke="var(--orange)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map(w => `<circle cx="${x(w.date).toFixed(1)}" cy="${y(w.kg).toFixed(1)}" r="3" fill="var(--orange)"/>`).join('')}
    <text x="${W}" y="${y(hi - 0.5) + 4}" font-size="11" text-anchor="end" fill="var(--muted)">${r1(hi - 0.5).toLocaleString('sk-SK')} kg</text>
    <text x="${W}" y="${y(lo + 0.5) + 4}" font-size="11" text-anchor="end" fill="var(--muted)">${r1(lo + 0.5).toLocaleString('sk-SK')} kg</text>
    <text x="${pad}" y="${H - 2}" font-size="11" fill="var(--muted)">${parseDay(pts[0].date).toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric' })}</text>
    <text x="${W - pad - 48}" y="${H - 2}" font-size="11" text-anchor="end" fill="var(--muted)">${parseDay(pts.at(-1).date).toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric' })}</text></svg>`;
}

function openWeight() {
  const ws = sortedWeights();
  const tr = weightTrend();
  const adv = tr && trendAdvice(tr);
  openSheet('Váha', `
    <div class="row"><input class="input" id="w-kg" type="text" inputmode="decimal" autocomplete="off" placeholder="kg" value="${ws.at(-1)?.kg ?? S.profile.weight ?? ''}" style="margin:0">
      <button class="btn primary sm" id="w-save">Uložiť</button></div>
    <p class="small muted" style="margin:8px 0 14px">${curDate === todayKey() ? 'Váž sa ráno po toalete, nalačno.' : `Uloží sa k dňu ${parseDay(curDate).toLocaleDateString('sk-SK', { day: 'numeric', month: 'long' })}.`}</p>
    ${weightChart(ws)}
    ${adv?.delta && !(S.profile.surplusAdjusted > dayKey(addDays(new Date(), -14))) ? `<button class="btn" id="w-apply" style="margin-bottom:14px">Upraviť cieľ o ${adv.delta > 0 ? '+' : ''}${adv.delta} kcal</button>` : ''}
    ${ws.length ? `<div class="list">${[...ws].reverse().slice(0, 12).map(w => `<div class="list-item">
      <span>${parseDay(w.date).toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric' })}</span>
      <span class="row"><b>${Number(w.kg).toLocaleString('sk-SK')} kg</b><button class="round sm" data-wdel="${esc(w.date)}" aria-label="Zmazať">${icon('close', 14, 2.4)}</button></span></div>`).join('')}</div>` : ''}
  `);
  $('#w-save').onclick = () => {
    const kg = Number(String($('#w-kg').value).replace(',', '.'));
    if (!(kg > 20 && kg < 400)) return toast('Zadaj platnú váhu.');
    const d = curDate;
    S.weights = S.weights.filter(w => w.date !== d);
    S.weights.push({ date: d, kg: r1(kg) });
    S.profile.weight = sortedWeights().at(-1).kg;
    save(); closeSheet(); render(); toast('Váha uložená');
  };
  $('#w-kg').addEventListener('keydown', ev => { if (ev.key === 'Enter') $('#w-save').click(); });
  const ap = $('#w-apply');
  if (ap) ap.onclick = () => {
    S.profile.surplus = Number(S.profile.surplus || 0) + adv.delta;
    S.profile.surplusAdjusted = todayKey();
    save(); closeSheet(); render(); toast(`Nový prebytok: ${S.profile.surplus} kcal`);
  };
}

// ---------- Voda ----------
function openWater() {
  const water = S.water[curDate] || 0;
  const wt = targets(curDate)?.water || 2500;
  openSheet('Voda', `
    <div class="water-big"><b>${liters(water)} l</b><span class="muted"> z ${liters(wt)} l</span></div>
    <div class="drinks">${DRINKS.map(([k, l, ml]) => `<button class="drink" data-drink="${ml}">${icon(k, 30, 1.6)}<b>${l}</b><span>${ml} ml</span></button>`).join('')}</div>
    ${water && lastDrink.date === curDate && lastDrink.ml ? `<button class="btn" data-drink="${-lastDrink.ml}">${icon('minus', 18, 2.4)} Vrátiť posledné (${lastDrink.ml} ml)</button>`
      : water && !lastDrink.undone ? `<button class="btn" data-drink="-250">${icon('minus', 18, 2.4)} Odobrať 250 ml</button>` : ''}
  `);
}
let lastDrink = {};

function addWater(ml) {
  S.water[curDate] = Math.max(0, (S.water[curDate] || 0) + ml);
  // Po vrátení sa tlačidlo na mínus na chvíľu nezobrazí (dvojité ťuknutie by ubralo ďalšie).
  lastDrink = { date: curDate, ml: ml > 0 ? ml : 0, undone: ml < 0 };
  // Panel ostane otvorený, dá sa pridať viac pohárov naraz.
  save(); render(); openWater();
  toast(ml > 0 ? `+${ml} ml · spolu ${liters(S.water[curDate])} l` : `Spolu ${liters(S.water[curDate])} l`);
}

// ---------- AI analýza ----------
const AI_SCHEMA = {
  type: 'object',
  properties: {
    meal_name: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    note: { type: 'string' },
    description: { type: 'string' },
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
          gluten: { type: 'string', enum: ['nie', 'ano', 'mozno'] },
          allergens: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'grams', 'kcal', 'protein', 'carbs', 'fat', 'fiber', 'health_score', 'gluten', 'allergens'],
        additionalProperties: false,
      },
    },
  },
  required: ['meal_name', 'confidence', 'note', 'description', 'items'],
  additionalProperties: false,
};

const AI_SYSTEM = `Si skúsený výživový analytik. Z fotky a/alebo popisu identifikuj každú samostatnú zložku jedla.
- Odhadni hmotnosť každej zložky v gramoch podľa veľkosti porcie (bežný tanier má ~26 cm, použi príbor a ruky ako mierku).
- Nutričné hodnoty uveď pre CELÚ odhadnutú porciu danej zložky, nie na 100 g.
- Ak používateľ uvedie čo to je, gramáž, značku alebo spôsob prípravy, má to prednosť pred odhadom. Počítaj aj s olejom/maslom pri príprave.
- Ryžu, cestoviny, vločky, kuskus, strukoviny s gramážou z textu ber ako SUCHÉ (nevarené), ak nie je napísané "varené" alebo "uvarené". Na fotke je jedlo vždy hotové (varené).
- Pri značkovom výrobku použi hodnoty z jeho etikety, ak ich poznáš.
- Bežné porcie na Slovensku: rohlík 40-45 g, krajec chleba 40-50 g, vajce 55 g, porcia bryndzových halušiek 350-400 g, vyprážaný syr 150 g, hranolky 150 g, polievka 300 ml, obedové menu 350-450 g, tvaroh balenie 250 g, jogurt 150 g.
- confidence: "low", keď si nie si istý (nejasná fotka, chýba gramáž, zmiešané jedlo); vtedy v note napíš, s čím si počítal (napr. "počítam s tanierom ~350 g").
- Názvy píš po slovensky, krátko (napr. "Ryža biela varená").
- health_score 1-10: 10 = nespracované, výživné potraviny; 5 = bežné; 1 = ultraspracované, veľa cukru, vyprážané.
- note: 1 krátka veta po slovensky, zhodnoť jedlo vzhľadom na cieľ používateľa.
- description: 1-2 vety po slovensky, z čoho je jedlo pravdepodobne pripravené (múka, cesto, obal, omáčka, príloha).
- gluten pri každej položke: "ano" ak obsahuje lepok (pšenica, raž, jačmeň, bežný ovos, strúhanka, väčšina cestovín a pečiva), "nie" ak je prirodzene bez lepku, "mozno" ak sa to z fotky nedá určiť (napr. omáčka zahustená múkou, obaľované).
- allergens pri každej položke: zoznam z [mlieko, vajcia, orechy, arasidy, ryby, korysy, soja, sezam, zeler, horcica], ktoré položka pravdepodobne obsahuje. Lepok sem nepíš.
- Ak na fotke nie je jedlo, vráť prázdne items a vysvetli to v note.
- Nepoužívaj dlhé pomlčky, namiesto nich píš čiarky.`;

async function callClaude({ system, content, schema, effort = 'medium', maxTokens = 8000, tools }) {
  const key = getKey();
  if (!key) throw new Error('Chýba API kľúč. Zadaj ho v profile (vpravo hore).');
  const model = S.profile.model || MODELS[0][0];
  const body = {
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content }],
    output_config: { effort, format: { type: 'json_schema', schema } },
  };
  if (tools) body.tools = tools;
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
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body) });
  } catch {
    throw new Error('Nie si online alebo sieť nefunguje. Skús znova.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText;
    if (res.status === 401) throw new Error('Neplatný API kľúč.');
    if (res.status === 429) throw new Error('Príliš veľa požiadaviek, skús o chvíľu.');
    if (res.status === 529 || res.status >= 500) throw new Error('AI je teraz preťažená, skús o chvíľu.');
    if (res.status === 400 && /credit|balance/i.test(msg)) throw new Error('Na API účte došiel kredit. Dobi ho na console.anthropic.com.');
    throw new Error(`Chyba API (${res.status}): ${msg}`);
  }
  if (data.stop_reason === 'refusal') throw new Error('AI odmietla odpovedať. Skús znova.');
  if (data.stop_reason === 'max_tokens') throw new Error('Odpoveď bola príliš dlhá. Skús znova.');
  if (data.stop_reason === 'pause_turn') throw new Error('AI to nestihla, skús znova.');
  const block = (data.content || []).filter(b => b.type === 'text').at(-1);
  if (!block) throw new Error('Prázdna odpoveď od AI.');
  let out;
  try { out = JSON.parse(block.text); } catch { /* nižšie */ }
  if (!out || typeof out !== 'object') throw new Error('AI vrátila neplatnú odpoveď. Skús znova.');
  return out;
}

async function analyzeFood({ image, text }) {
  const t = targets(curDate);
  const goal = Number(S.profile.surplus) > 0 ? 'priberať svalovú hmotu' : 'udržať váhu';
  const content = [];
  if (image) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } });
  content.push({
    type: 'text',
    text: `Cieľ používateľa: ${goal}${t ? ` (${t.kcal} kcal, ${t.p} g bielkovín denne)` : ''}.\n` +
      (dietActive(profileDiet()) ? `Strava používateľa: ${dietSummary(profileDiet())}. Pri lepku a alergénoch buď opatrný a v note upozorni, ak jedlo pre neho nie je vhodné.\n` : '') +
      (text ? `Používateľ k tomu píše: ${text}` : 'Analyzuj jedlo na fotke.'),
  });
  return callClaude({ system: AI_SYSTEM, content, schema: AI_SCHEMA });
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
  // Štvorcový výrez 72 px do zoznamu.
  const s = Math.min(img.naturalWidth, img.naturalHeight);
  const c = document.createElement('canvas');
  c.width = c.height = 72;
  c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 72, 72);
  return c.toDataURL('image/jpeg', 0.55);
}

// ---------- Skenovanie obalu: je to dobrá potravina? ----------
// Čiarový kód -> Open Food Facts (bezplatná verejná databáza) -> posúdenie zloženia a prídavných látok.
// Makrá sa nezapisujú. Do Open Food Facts ide len samotný čiarový kód.
const ADDITIVES = {
  e250: ['dusitan sodný', 3, 'konzervant v mäsových výrobkoch, pri vysokej teplote môže tvoriť nitrozamíny'],
  e249: ['dusitan draselný', 3, 'konzervant v mäsových výrobkoch'],
  e251: ['dusičnan sodný', 3, 'konzervant v mäsových výrobkoch'],
  e252: ['dusičnan draselný', 3, 'konzervant v mäsových výrobkoch'],
  e171: ['oxid titaničitý', 3, 'farbivo, v EÚ v potravinách zakázané od 2022'],
  e320: ['BHA', 3, 'antioxidant, podozrenie na škodlivosť'],
  e321: ['BHT', 3, 'antioxidant, podozrenie na škodlivosť'],
  e621: ['glutaman sodný', 2, 'zvýrazňovač chuti, citliví ľudia môžu mať bolesti hlavy'],
  e627: ['guanylát sodný', 1, 'zvýrazňovač chuti'],
  e631: ['inozinát sodný', 1, 'zvýrazňovač chuti'],
  e951: ['aspartám', 2, 'umelé sladidlo, WHO ho vedie ako možný karcinogén'],
  e950: ['acesulfám K', 2, 'umelé sladidlo'],
  e955: ['sukralóza', 2, 'umelé sladidlo, môže ovplyvniť črevnú mikroflóru'],
  e954: ['sacharín', 2, 'umelé sladidlo'],
  e952: ['cyklamát', 2, 'umelé sladidlo'],
  e150c: ['amoniakový karamel', 2, 'farbivo'],
  e150d: ['amoniak-sulfitový karamel', 2, 'farbivo v kolových nápojoch'],
  e211: ['benzoan sodný', 2, 'konzervant, s vitamínom C môže tvoriť benzén'],
  e210: ['kyselina benzoová', 2, 'konzervant'],
  e220: ['oxid siričitý', 2, 'konzervant, problém pre astmatikov'],
  e223: ['disiričitan sodný', 2, 'konzervant, problém pre astmatikov'],
  e224: ['disiričitan draselný', 2, 'konzervant, problém pre astmatikov'],
  e407: ['karagénan', 2, 'zahusťovadlo, môže dráždiť črevá'],
  e433: ['polysorbát 80', 2, 'emulgátor, môže narušiť črevnú sliznicu'],
  e466: ['karboxymetylcelulóza', 2, 'zahusťovadlo, môže narušiť črevnú mikroflóru'],
  e102: ['tartrazín', 2, 'azofarbivo, u detí spájané s hyperaktivitou'],
  e104: ['chinolínová žltá', 2, 'azofarbivo'],
  e110: ['žltá SY', 2, 'azofarbivo'],
  e122: ['azorubín', 2, 'azofarbivo'],
  e124: ['ponceau 4R', 2, 'azofarbivo'],
  e129: ['červená allura', 2, 'azofarbivo'],
  e338: ['kyselina fosforečná', 2, 'okysľovadlo v kolách, zaťažuje kosti a zuby'],
  e339: ['fosforečnany sodné', 1, 'vo veľkom množstve zaťažujú obličky'],
  e450: ['difosforečnany', 1, 'vo veľkom množstve zaťažujú obličky'],
  e451: ['trifosforečnany', 1, 'vo veľkom množstve zaťažujú obličky'],
  e452: ['polyfosforečnany', 1, 'vo veľkom množstve zaťažujú obličky'],
  e420: ['sorbitol', 1, 'sladidlo, vo väčšom množstve preháňa'],
  e965: ['maltitol', 1, 'sladidlo, vo väčšom množstve preháňa'],
  e1442: ['modifikovaný škrob', 1, 'zahusťovadlo, znak priemyselného spracovania'],
};
const INGREDIENT_FLAGS = [
  [/palm/i, 'palmový olej', 2],
  [/glukózovo-fruktózov|glukózo-fruktózov|fruktózovo-glukózov|glucose-fructose|kukuričný sirup/i, 'glukózovo-fruktózový sirup', 2],
  [/stužen|hydrogenovan|ztužen|hydrogenated/i, 'stužený (hydrogenovaný) tuk', 3],
  [/aróma|aroma|flavour/i, 'aróma', 1],
];
const OFF_ALLERGENS = { 'en:milk': 'mlieko', 'en:eggs': 'vajcia', 'en:nuts': 'orechy', 'en:peanuts': 'arasidy', 'en:fish': 'ryby',
  'en:crustaceans': 'korysy', 'en:soybeans': 'soja', 'en:sesame-seeds': 'sezam', 'en:celery': 'zeler', 'en:mustard': 'horcica' };
const RISK = ['', 'nízke', 'stredné', 'vysoké'];

let zxingReader = null;
function loadZxing() {
  if (window.ZXing) return Promise.resolve();
  return new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = 'vendor/zxing.min.js';
    sc.onload = res;
    sc.onerror = () => rej(new Error('Skener sa nepodarilo načítať.'));
    document.head.appendChild(sc);
  });
}
function zxHints() {
  const h = new Map();
  const F = ZXing.BarcodeFormat;
  h.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E]);
  h.set(ZXing.DecodeHintType.TRY_HARDER, true);
  return h;
}
function stopScanner() {
  try { zxingReader?.reset(); } catch { /* nič */ }
  zxingReader = null;
}

async function openScan() {
  const recent = (S.scans || []).slice(0, 6);
  openSheet('Skenovať potravinu', `
    <div class="scan-view"><video id="scan-video" playsinline muted></video><span class="scan-frame"></span></div>
    <p class="small muted" style="margin:8px 0 12px">Namier kameru na čiarový kód. Ukážem, či je potravina zdravá (0-10). Do jedál sa nič nezapisuje.</p>
    <div class="row"><input class="input" id="scan-code" inputmode="numeric" placeholder="alebo zadaj číslo kódu" style="flex:1">
      <button class="btn sm primary" data-act="scan-code">Hľadať</button></div>
    <button class="btn" data-act="scan-photo" style="margin-top:10px">${icon('camera', 18)}Odfotiť čiarový kód</button>
    ${recent.length ? `<h3 class="sub-h">Naposledy</h3><div class="list">${recent.map(x => `<button class="list-item" ${String(x.code).startsWith('foto-') ? 'data-act="label-photo"' : `data-scan="${esc(x.code)}"`}>
      <span>${esc(x.name)}</span>${scoreBadge(s10(x.score))}</button>`).join('')}</div>` : ''}`);
  try {
    await loadZxing();
    if ($('#sheet-bg').hidden || !$('#scan-video')) return;
    // Vlastná referencia: ak sa skener medzitým zavrel, kamera sa hneď vypne.
    const reader = zxingReader = new ZXing.BrowserMultiFormatReader(zxHints());
    await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, $('#scan-video'), result => {
      if (!result || zxingReader !== reader) return;
      const code = result.getText();
      stopScanner();
      navigator.vibrate?.(40);
      lookupProduct(code);
    });
    if (zxingReader !== reader) try { reader.reset(); } catch { /* nič */ }
  } catch (err) {
    const v = $('.scan-view');
    if (v) v.innerHTML = '<div class="empty">Kamera nie je dostupná. Odfoť kód alebo zadaj číslo.</div>';
  }
}

async function scanFromPhoto(file) {
  try {
    await loadZxing();
    const url = URL.createObjectURL(file);
    let res;
    try { res = await new ZXing.BrowserMultiFormatReader(zxHints()).decodeFromImageUrl(url); } finally { URL.revokeObjectURL(url); }
    lookupProduct(res.getText());
  } catch {
    toast('Kód sa nepodarilo prečítať. Skús ostrejšiu fotku alebo zadaj číslo.');
  }
}

async function lookupProduct(code) {
  code = String(code).replace(/\D/g, '');
  if (code.length < 8) return toast('Čiarový kód má mať aspoň 8 číslic.');
  stopScanner();
  openSheet('Hľadám…', '<div class="empty">Hľadám výrobok v databáze…</div>');
  const gen = sheetGen;
  try {
    const fields = 'product_name,product_name_sk,product_name_cs,brands,ingredients_text_sk,ingredients_text_cs,ingredients_text,additives_tags,nutriscore_grade,nova_group,allergens_tags,traces_tags,nutriments,image_front_small_url,quantity';
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields}`);
    const data = await res.json();
    if (!sheetStill(gen)) return;
    if (data.status !== 1 || !data.product) return productNotFound(code);
    showProduct(code, data.product);
  } catch {
    toast('Databáza nie je dostupná. Skús to neskôr.');
    if (sheetStill(gen)) closeSheet();
  }
}

function productNotFound(code) {
  wizHead('Výrobok nenájdený', null);
  $('#sheet-body').innerHTML = `<p class="small muted" style="margin-bottom:14px">Kód ${esc(code)} v databáze nie je. Odfoť zloženie na obale a AI ho posúdi.</p>
    <button class="btn primary" data-act="label-photo">${icon('camera', 18)}Odfotiť zloženie</button>`;
}

function assessProduct(p) {
  const ingr = p.ingredients_text_sk || p.ingredients_text_cs || p.ingredients_text || '';
  const adds = (p.additives_tags || []).map(t => t.replace('en:', '').replace(/[^a-z0-9]/g, ''))
    .map(k => [k, ADDITIVES[k] || ADDITIVES[k.replace(/[a-z]$/, '')]]).filter(([, v]) => v);
  const flags = INGREDIENT_FLAGS.filter(([rx]) => rx.test(ingr)).map(([, n, r]) => [n, r]);
  let score = 60;
  score += { a: 25, b: 12, c: 0, d: -15, e: -28 }[p.nutriscore_grade] ?? 0;
  score += { 1: 12, 2: 5, 3: -5, 4: -18 }[p.nova_group] ?? 0;
  adds.forEach(([, v]) => { score -= [0, 3, 8, 16][v[1]]; });
  flags.forEach(([, r]) => { score -= [0, 2, 7, 14][r]; });
  // Pre športovca je dôležitý obsah bielkovín.
  const prot = Number(p.nutriments?.proteins_100g) || 0;
  score += prot >= 20 ? 12 : prot >= 10 ? 6 : 0;
  const allergens = [...new Set((p.allergens_tags || []).map(t => OFF_ALLERGENS[t]).filter(Boolean))];
  const traces = [...new Set((p.traces_tags || []).map(t => OFF_ALLERGENS[t] || (t === 'en:gluten' ? 'lepok' : null)).filter(Boolean))];
  const gluten = (p.allergens_tags || []).includes('en:gluten');
  return { ingr, adds, flags, allergens, traces, gluten, score: Math.max(0, Math.min(100, Math.round(score))) };
}

// 0 = červená, 5 = žltá, 10 = zelená.
function scoreColor(s10) {
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const red = [255, 69, 58], yellow = [255, 204, 0], green = [48, 199, 88];
  const t = Math.max(0, Math.min(10, s10)) / 10;
  const c = t < 0.5 ? mix(red, yellow, t * 2) : mix(yellow, green, (t - 0.5) * 2);
  return `rgb(${c.join(',')})`;
}
function scoreBadge(s10, big) {
  return `<span class="sbadge ${big ? 'big' : ''}" style="--sc:${scoreColor(s10)}">${s10}</span>`;
}
function s10(score100) { return Math.round(score100 / 10); }

function productVerdict(score) {
  if (score >= 75) return 'Dobrá voľba';
  if (score >= 55) return 'V poriadku';
  if (score >= 35) return 'Radšej občas';
  return 'Nevhodné';
}

let lastProduct = null;
function showProduct(code, p) {
  p.nova_group = Number(p.nova_group) || 0;
  if (!/^[a-e]$/.test(p.nutriscore_grade)) p.nutriscore_grade = '';
  const a = assessProduct(p);
  const name = p.product_name_sk || p.product_name_cs || p.product_name || 'Neznámy výrobok';
  lastProduct = { code, name, p, a };
  S.scans = [{ code, name, score: a.score }, ...(S.scans || []).filter(x => x.code !== code)].slice(0, 20);
  save();
  const d = profileDiet();
  const bad = d.allergens.filter(x => a.allergens.includes(x));
  const n = p.nutriments || {};
  const per100 = [['kcal', n['energy-kcal_100g'], ''], ['bielkoviny', n.proteins_100g, ' g'], ['cukry', n.sugars_100g, ' g'], ['soľ', n.salt_100g, ' g']]
    .filter(x => x[1] != null).map(([l, v, u]) => `<div><b>${r1(v).toLocaleString('sk-SK')}${u}</b><div class="lbl">${l} / 100 g</div></div>`).join('');
  wizHead(name, null);
  $('#sheet-body').innerHTML = `
    ${p.image_front_small_url ? `<img class="product-img" src="${esc(p.image_front_small_url)}" alt="">` : ''}
    <p class="small muted" style="margin-bottom:14px">${esc([p.brands, p.quantity].filter(Boolean).join(' · '))}</p>
    <div class="product-score" id="p-score">${scoreBadge(s10(a.score), true)}<div><b style="color:${scoreColor(s10(a.score))}">${productVerdict(a.score)}</b>
      <span class="small muted">skóre ${s10(a.score)} z 10</span></div></div>
    <div class="meter-card scan-meter"><span class="meter"><i id="p-mark" style="left:${Math.min(97, Math.max(3, a.score))}%"></i></span>
      <span class="meter-ends"><span>0 nezdravé</span><span>10 zdravé</span></span></div>
    <p class="small muted" style="margin:4px 0 14px">Nutri-Score ${/^[a-e]$/.test(p.nutriscore_grade) ? p.nutriscore_grade.toUpperCase() : '-'} · ${p.nova_group ? `spracovanie ${p.nova_group}/4${p.nova_group === 4 ? ' (ultraspracované)' : ''}` : 'spracovanie neznáme'}</p>
    ${d.gf && a.gluten ? '<div class="diet-box bad"><b>Obsahuje lepok</b></div>' : d.gf && a.traces.includes('lepok') ? '<div class="diet-box"><b>Môže obsahovať stopy lepku</b></div>' : ''}
    ${bad.length ? `<div class="diet-box bad"><b>Pozor, obsahuje:</b> ${bad.map(x => ALLERGENS.find(y => y[0] === x)?.[1]).join(', ')}</div>` : ''}
    ${a.adds.length || a.flags.length ? `<h3 class="sub-h">Na čo si dať pozor</h3><div class="list">
      ${a.adds.map(([k, v]) => `<div class="list-item add-item"><span><b>${k.toUpperCase()} ${esc(v[0])}</b><span class="small muted">${esc(v[2])}</span></span><span class="tag ${v[1] >= 3 ? 'bad-tag' : v[1] === 2 ? 'warn-tag' : 'ok-tag'}">${RISK[v[1]]}</span></div>`).join('')}
      ${a.flags.map(([n2, r]) => `<div class="list-item add-item"><span><b>${esc(n2)}</b></span><span class="tag ${r >= 3 ? 'bad-tag' : r === 2 ? 'warn-tag' : 'ok-tag'}">${RISK[r]}</span></div>`).join('')}</div>`
      : '<div class="diet-box ok" style="margin-top:0"><b>Bez rizikových prídavných látok</b></div>'}
    ${per100 ? `<div class="ai-sum" style="margin-top:14px"><div class="grid2">${per100}</div></div>` : ''}
    ${a.ingr ? `<h3 class="sub-h">Zloženie</h3><p class="small">${esc(a.ingr)}</p>` : ''}
    <div id="product-ai"></div>
    <button class="btn" data-act="product-ai" style="margin-top:16px">Zhodnotiť účinky s AI</button>
    <button class="btn" data-act="scan" style="margin-top:10px">${icon('barcode', 18)}Skenovať ďalší</button>`;
}

const PRODUCT_SCHEMA = {
  type: 'object',
  properties: {
    product_name: { type: 'string' },
    ingredients: { type: 'string' },
    score: { type: 'integer' },
    verdict: { type: 'string' },
    good: { type: 'array', items: { type: 'string' } },
    bad: { type: 'array', items: { type: 'string' } },
    gluten: { type: 'string', enum: ['nie', 'ano', 'mozno'] },
  },
  required: ['product_name', 'ingredients', 'score', 'verdict', 'good', 'bad', 'gluten'],
  additionalProperties: false,
};
const PRODUCT_SYSTEM = `Si nutričný poradca športovca. Posúď potravinu podľa zloženia: kvalita surovín, miera spracovania, cukor, soľ, tuky, prídavné látky (napr. glutaman sodný, dusitany, umelé sladidlá, farbivá) a ich možné účinky na zdravie.
score: celé číslo 0-10 (0 = veľmi nezdravé, 5 = priemer, 10 = výborné). verdict: 1-2 vety po slovensky. good a bad: krátke body po slovensky (max. 4 každé), pri prídavných látkach uveď možný účinok.
gluten: či výrobok obsahuje lepok. product_name a ingredients: názov a zloženie (ak ich máš z fotky, prepíš ich). Nepoužívaj dlhé pomlčky, namiesto nich píš čiarky.`;

async function productAI(btn, image) {
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> AI hodnotí…';
  try {
    const content = [];
    if (image) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } });
    const d = profileDiet();
    content.push({ type: 'text', text: (lastProduct && !image
      ? `Výrobok: ${lastProduct.name}. Zloženie: ${lastProduct.a.ingr || 'neznáme'}. Prídavné látky: ${(lastProduct.p.additives_tags || []).join(', ') || 'žiadne'}. Nutri-Score: ${lastProduct.p.nutriscore_grade || '?'}, NOVA: ${lastProduct.p.nova_group || '?'}.`
      : 'Na fotke je zloženie z obalu potraviny. Prečítaj ho a posúď.') + (dietActive(d) ? ` Strava používateľa: ${dietSummary(d)}.` : '') });
    const r = await callClaude({ system: PRODUCT_SYSTEM, content, schema: PRODUCT_SCHEMA, effort: 'low' });
    if (!btn.isConnected) return;
    r.score = Math.max(0, Math.min(10, Math.round(r.score)));
    if (image) {
      wizHead(r.product_name || 'Výrobok', null);
      $('#sheet-body').innerHTML = `<div class="product-score">${scoreBadge(r.score, true)}<div><b style="color:${scoreColor(r.score)}">${productVerdict(r.score * 10)}</b>
        <span class="small muted">skóre ${r.score} z 10</span></div></div>
        <div class="meter-card scan-meter"><span class="meter"><i style="left:${Math.min(97, Math.max(3, r.score * 10))}%"></i></span>
        <span class="meter-ends"><span>0 nezdravé</span><span>10 zdravé</span></span></div><div id="product-ai"></div>
        ${r.ingredients ? `<h3 class="sub-h">Zloženie</h3><p class="small">${esc(r.ingredients)}</p>` : ''}`;
    } else {
      btn.remove();
      // AI hodnotenie je presnejšie, nahradí vypočítané skóre hore.
      const ps = $('#p-score');
      if (ps) ps.innerHTML = `${scoreBadge(r.score, true)}<div><b style="color:${scoreColor(r.score)}">${productVerdict(r.score * 10)}</b><span class="small muted">skóre ${r.score} z 10 podľa AI</span></div>`;
      $('#p-mark')?.style.setProperty('left', Math.min(97, Math.max(3, r.score * 10)) + '%');
      if (lastProduct) { S.scans = (S.scans || []).map(x => x.code === lastProduct.code ? { ...x, score: r.score * 10 } : x); save(); }
    }
    if (image) {
      S.scans = [{ code: 'foto-' + Date.now(), name: r.product_name || 'Výrobok z fotky', score: r.score * 10 }, ...(S.scans || [])].slice(0, 20);
      save();
    }
    $('#product-ai').innerHTML = `<div class="diet-box ${r.score >= 6 ? 'ok' : r.score >= 4 ? '' : 'bad'}"><b>AI hodnotí ${r.score} z 10: ${productVerdict(r.score * 10).toLowerCase()}</b><p>${esc(r.verdict)}</p>
      ${r.good.length ? `<p><b>Dobré:</b> ${r.good.map(esc).join(', ')}</p>` : ''}
      ${r.bad.length ? `<p><b>Zlé:</b> ${r.bad.map(esc).join(', ')}</p>` : ''}
      ${d.gf && r.gluten !== 'nie' ? `<p><b>Lepok:</b> ${r.gluten === 'ano' ? 'obsahuje' : 'možno obsahuje'}</p>` : ''}</div>`;
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Skúsiť znova';
    if (image) btn.onclick = () => productAI(btn, image);
    toast(err.message);
  }
}

// ---------- Panel (sheet) ----------
let pendingPhoto = null; // { dataUrl, base64, thumb }

// Počítadlo panelov: neskorá odpoveď nesmie prepísať panel, ktorý medzitým otvoril niekto iný.
let sheetGen = 0;
const sheetStill = g => g === sheetGen && !$('#sheet-bg').hidden;
function openSheet(title, html) {
  sheetGen++;
  $('#sheet-title').textContent = nodash(title);
  $('#sheet-back').hidden = true;
  wiz.back = null;
  $('#sheet-body').innerHTML = html;
  $('#sheet-bg').hidden = false;
}
function closeSheet() {
  sheetGen++;
  stopScanner();
  stopRec();
  favEdit = false;
  $('#sheet-bg').hidden = true;
  $('#sheet-body').innerHTML = '';
  pendingPhoto = null;
}

function recentFoods() {
  const seen = new Set(), out = [];
  for (const e of [...S.entries].sort((a, b) => b.ts - a.ts)) {
    const k = norm(e.name);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
    if (out.length >= 8) break;
  }
  return out;
}

// ---------- Pridať jedlo ----------
let favEdit = false;
function openAdd() {
  if (rollover()) render();
  const recent = recentFoods();
  const favs = S.favs || [];
  const past = curDate !== todayKey();
  openSheet(past ? `Pridať do: ${dayTitle(curDate) === 'Včera' ? 'Včera' : parseDay(curDate).toLocaleDateString('sk-SK', { day: 'numeric', month: 'long' })}` : 'Pridať jedlo', `
    ${past ? `<button class="link-btn small" data-act="go-today" style="margin:-8px 0 12px">Chceš pridať do dneška? Prepnúť na Dnes</button>` : ''}
    <button class="btn primary big" data-act="photo">${icon('camera', 26)}Odfotiť jedlo</button>
    <div class="grid2" style="margin-top:10px">
      <button class="btn" data-act="text">${icon('mic', 18)}Nadiktovať</button>
      <button class="btn" data-act="photo-gallery">${icon('image', 18)}Z galérie</button>
      <button class="btn" data-act="manual">${icon('pen', 18)}Ručne</button>
      <button class="btn" data-act="scan">${icon('barcode', 18)}Skenovať</button>
    </div>
    ${favs.length ? `<h3 class="sub-h" style="display:flex;justify-content:space-between">Moje jedlá <button class="link-btn small" data-act="fav-edit">${favEdit ? 'Hotovo' : 'Upraviť'}</button></h3>
      <div class="chips">${favs.map(f => favEdit
        ? `<button class="chip-btn del" data-fav-del="${esc(f.id)}">${icon('close', 12, 2.6)} ${esc(f.name)}</button>`
        : `<button class="chip-btn" data-fav="${esc(f.id)}">${esc(f.name)} <span class="muted">${r0(f.items.reduce((s, i) => s + i.kcal, 0))}</span></button>`).join('')}</div>` : ''}
    ${recent.length ? `<h3 class="sub-h">Znova</h3><div class="list">${recent.map(e => `<button class="list-item" data-recent="${e.id}">
      <span>${esc(e.name)}</span><span class="muted small">${e.g ? r0(e.g) + ' g · ' : ''}${r0(e.kcal)} kcal</span></button>`).join('')}</div>` : ''}
  `);
}

const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let activeRec = null;
function stopRec() { try { activeRec?.abort(); } catch { /* nič */ } activeRec = null; }
function openTextAI() {
  openSheet('Čo si jedol?', `
    <textarea class="input" id="ai-text" placeholder="napr. dal som si 3 vajcia, 2 krajce chleba a pohár mlieka"></textarea>
    ${SpeechRec ? `<button class="btn" id="mic" style="margin-top:10px">${icon('mic', 18)}Hovor</button>`
      : '<p class="small muted" style="margin-top:8px">Ťukni na mikrofón na klávesnici a nadiktuj.</p>'}
    <button class="btn primary" id="ai-go" style="margin-top:10px">Vypočítať</button>
  `);
  $('#ai-text').focus();
  if (SpeechRec) $('#mic').onclick = () => {
    if (activeRec) { activeRec.stop(); return; }
    const rec = activeRec = new SpeechRec();
    rec.lang = 'sk-SK';
    rec.interimResults = true;
    const base = $('#ai-text').value ? $('#ai-text').value + ' ' : '';
    rec.onresult = ev => { const ta = $('#ai-text'); if (ta) ta.value = base + [...ev.results].map(r => r[0].transcript).join(' '); };
    rec.onend = () => { if (activeRec === rec) activeRec = null; const m = $('#mic'); if (m) { m.classList.remove('rec'); m.lastChild.textContent = 'Hovor'; } };
    rec.onerror = ev => { if (ev.error !== 'aborted' && ev.error !== 'no-speech' && activeRec === rec) toast('Diktovanie nefunguje, použi mikrofón na klávesnici.'); };
    $('#mic').classList.add('rec');
    $('#mic').lastChild.textContent = 'Počúvam…';
    rec.start();
  };
  $('#ai-go').onclick = () => {
    const text = $('#ai-text').value.trim();
    if (!text) return toast('Napíš, čo si jedol.');
    stopRec();
    runAI({ text });
  };
}

function openPhotoReview() {
  openSheet('Fotka jedla', `
    <img class="preview" src="${pendingPhoto.dataUrl}" alt="Fotka jedla">
    <input class="input" id="ai-text" placeholder="Čo to je? napr. kuracie s ryžou, 300 g (nepovinné)">
    <button class="btn primary" id="ai-go" style="margin-top:12px">Analyzovať</button>
  `);
  $('#ai-go').onclick = () => runAI({ image: pendingPhoto.base64, text: $('#ai-text').value.trim() });
}

async function runAI({ image, text }) {
  const btn = $('#ai-go');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Analyzujem…';
  try {
    const res = await analyzeFood({ image, text });
    if (btn.isConnected) showAIResult(res);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Skúsiť znova';
    toast(err.message || 'Niečo sa pokazilo.');
    if (!getKey()) { closeSheet(); openProfile(); }
  }
}

function glutenTag(g) {
  if (!g) return '';
  return g === 'nie' ? '<span class="tag ok-tag">bez lepku</span>' : g === 'ano' ? '<span class="tag bad-tag">lepok</span>' : '<span class="tag warn-tag">možno lepok</span>';
}

function photoDietBox(items) {
  const d = profileDiet();
  if (!dietActive(d)) return '';
  const gl = d.gf && items.filter(it => it.gluten !== 'nie');
  const al = items.flatMap(it => (it.allergens || []).filter(a => d.allergens.includes(a)).map(a => [it.name, a]));
  if (!(gl && gl.length) && !al.length) return '<div class="diet-box ok"><b>Vyzerá to v poriadku</b> pre tvoju stravu.</div>';
  return `<div class="diet-box bad"><b>Pozor</b>
    ${gl && gl.length ? `<p>Lepok ${gl.some(it => it.gluten === 'ano') ? '' : 'možno '}v: ${gl.map(it => esc(it.name)).join(', ')}</p>` : ''}
    ${al.length ? `<p>Alergény: ${al.map(([n, a]) => `${esc(n)} (${ALLERGENS.find(x => x[0] === a)?.[1] || a})`).join(', ')}</p>` : ''}</div>`;
}

let saveAsFav = false, asOne = true;
function showAIResult(res) {
  saveAsFav = false;
  asOne = true;
  // Rozumné hranice: nič záporné, žiadne nezmyselne veľké čísla.
  const num = (x, max = 10000) => Math.min(max, Math.max(0, Number(x) || 0));
  const items = (Array.isArray(res.items) ? res.items : []).map(it => {
    // Bez gramáže ráta AI s porciou, prepočet nech ide od 100 g.
    const g = num(it.grams, 5000) || 100;
    return { name: nodash(it.name), g, base: g, kcal: num(it.kcal), p: num(it.protein), c: num(it.carbs), f: num(it.fat), fib: num(it.fiber),
      score: Math.min(10, Math.max(1, Math.round(it.health_score || 5))), gluten: it.gluten || 'mozno', allergens: it.allergens || [] };
  });
  const thumb = pendingPhoto?.thumb;
  // Súčet a riadok položky sa pri písaní gramov prepočítajú bez prekreslenia panela.
  const totHtml = () => {
    const tot = items.reduce((s, it) => {
      const k = it.g / it.base;
      s.kcal += it.kcal * k; s.p += it.p * k; s.c += it.c * k; s.f += it.f * k;
      return s;
    }, { kcal: 0, p: 0, c: 0, f: 0 });
    return `<div><b>${r0(tot.kcal)}</b><div class="lbl">kcal</div></div>
          <div><b>${r0(tot.p)} g</b><div class="lbl">bielkoviny</div></div>
          <div><b>${r0(tot.c)} g</b><div class="lbl">sacharidy</div></div>
          <div><b>${r0(tot.f)} g</b><div class="lbl">tuky</div></div>`;
  };
  const infoHtml = it => {
    const k = it.g / it.base;
    return `${r0(it.kcal * k)} kcal · B ${r0(it.p * k)} g · S ${r0(it.c * k)} g · T ${r0(it.f * k)} g
          · <span class="score ${scoreClass(it.score)}">${it.score}</span> ${S.profile.glutenFree ? glutenTag(it.gluten) : ''}`;
  };
  const draw = () => {
    openSheet(res.meal_name || 'Výsledok', `
      <div class="ai-sum">
        <div class="grid4" id="ai-tot">${totHtml()}</div>
        ${res.confidence === 'low' ? '<p class="small" style="margin-top:10px;color:var(--orange-ink)"><b>AI si nie je istá, skontroluj gramy.</b></p>' : ''}
        ${res.note ? `<p class="small" style="margin-top:10px">${esc(res.note)}</p>` : ''}
        ${res.description ? `<p class="small muted" style="margin-top:6px">${esc(res.description)}</p>` : ''}
      </div>
      ${photoDietBox(items)}
      ${items.length > 1 ? `<input class="input" id="ai-meal" value="${esc(res.meal_name || '')}" placeholder="Názov jedla" style="margin-bottom:10px">` : ''}
      ${items.map((it, i) => {
        return `<div class="ai-item"><div class="row">
          <input class="input" data-ai-name="${i}" value="${esc(it.name)}" style="flex:1">
          <input class="input grams" data-ai-g="${i}" type="text" inputmode="decimal" autocomplete="off" value="${r0(it.g)}" aria-label="gramy">
          <button class="round sm" data-ai-del="${i}" aria-label="Odstrániť">${icon('close', 14, 2.4)}</button></div>
          <div class="small muted" id="ai-info-${i}" style="margin-top:6px">${infoHtml(it)}</div></div>`;
      }).join('')}
      <p class="small muted" style="margin:4px 0 12px">Ak gramy nesedia, prepíš ich, hodnoty sa prepočítajú.</p>
      ${items.length > 1 ? `<button class="chip-btn ${asOne ? 'on' : ''}" id="ai-one" style="margin:0 6px 12px 0">${asOne ? '✓ ' : ''}Uložiť ako jedno jedlo</button>` : ''}
      ${items.length ? `<button class="chip-btn ${saveAsFav ? 'on' : ''}" id="ai-fav" style="margin-bottom:12px">${saveAsFav ? '✓ ' : ''}Pridať aj medzi moje jedlá</button>
        <button class="btn primary" id="ai-save">Uložiť</button>` : '<div class="empty">AI nenašla žiadne jedlo.</div>'}
    `);
    document.querySelectorAll('[data-ai-g]').forEach(inp => inp.addEventListener('input', () => {
      const it = items[inp.dataset.aiG];
      it.g = Math.max(0, numIn(inp.value));
      $('#ai-tot').innerHTML = totHtml();
      $(`#ai-info-${inp.dataset.aiG}`).innerHTML = infoHtml(it);
    }));
    document.querySelectorAll('[data-ai-name]').forEach(inp => inp.addEventListener('input', () => {
      items[inp.dataset.aiName].name = inp.value;
    }));
    document.querySelectorAll('[data-ai-del]').forEach(b => b.addEventListener('click', () => {
      items.splice(Number(b.dataset.aiDel), 1);
      draw();
    }));
    const favBtn = $('#ai-fav');
    if (favBtn) favBtn.onclick = () => { saveAsFav = !saveAsFav; draw(); };
    $('#ai-meal')?.addEventListener('input', ev => { res.meal_name = ev.target.value; });
    const oneBtn = $('#ai-one');
    if (oneBtn) oneBtn.onclick = () => { asOne = !asOne; draw(); };
    const saveBtn = $('#ai-save');
    if (saveBtn) saveBtn.onclick = () => {
      const out = items.filter(it => it.g > 0).map((it, i) => {
        const k = it.g / it.base;
        return { name: it.name.trim() || 'Jedlo', g: it.g, kcal: it.kcal * k, p: it.p * k, c: it.c * k, f: it.f * k,
          fib: it.fib * k, score: it.score, gluten: it.gluten, allergens: it.allergens, thumb: i === 0 ? thumb : undefined };
      });
      if (!out.length) return toast('Zadaj aspoň jednu položku s gramami.');
      const mealName = nodash($('#ai-meal')?.value.trim() || res.meal_name) || out[0]?.name || 'Moje jedlo';
      if (saveAsFav) addFav(mealName, out);
      addEntries(asOne ? [combineItems(mealName, out)] : out, thumb ? 'foto' : 'text');
    };
  };
  draw();
}

function perGramFromEntry(e) {
  const g = e.g || 1;
  return { kcal: e.kcal / g, p: e.p / g, c: e.c / g, f: e.f / g, fib: (e.fib || 0) / g };
}

// Čas záznamu: teraz, pri inom dni ten istý čas v daný deň.
function tsOn(date, from = new Date()) {
  const d = parseDay(date);
  d.setHours(from.getHours(), from.getMinutes(), 0, 0);
  return d.getTime();
}
const hhmm = ts => new Date(ts).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' });

function addEntries(list, src) {
  const now = curDate === todayKey() ? Date.now() : tsOn(curDate);
  for (const it of list) {
    const e = { id: uid(), ts: it.ts || now, date: curDate, src, name: it.name, g: r1(it.g),
      kcal: r1(it.kcal), p: r1(it.p), c: r1(it.c), f: r1(it.f), fib: r1(it.fib), score: it.score };
    if (it.thumb) e.thumb = it.thumb;
    if (it.gluten) e.gluten = it.gluten;
    if (it.allergens?.length) e.allergens = it.allergens;
    if (it.items?.length) e.items = it.items;
    S.entries.push(e);
  }
  if (!save()) { S.entries.splice(S.entries.length - list.length, list.length); return; }
  closeSheet();
  render();
  toast(`Pridané: ${list.length === 1 ? list[0].name : list.length + ' ' + plural(list.length, 'položka', 'položky', 'položiek')}`);
}

function deleteEntry(e) {
  S.entries = S.entries.filter(x => x.id !== e.id);
  save(); closeSheet(); render();
  toast('Zmazané', { label: 'Späť', fn: () => { S.entries.push(e); save(); render(); } });
}

// Formulár jedla: ručné pridanie aj úprava záznamu (názov, gramy, kcal, makrá, čas).
function entryForm(e) {
  const v = x => x == null || x === '' ? '' : r1(x);
  return `<label class="field">Názov<input id="f-name" value="${esc(e.name || '')}" placeholder="napr. Kuracie s ryžou"></label>
    <div class="grid2">
      <label class="field">Množstvo (g)<input id="f-g" type="text" inputmode="decimal" autocomplete="off" value="${v(e.g)}" placeholder="nepovinné"></label>
      <label class="field">Kalórie (kcal)<input id="f-kcal" type="text" inputmode="decimal" autocomplete="off" value="${v(e.kcal)}"></label>
      <label class="field">Bielkoviny (g)<input id="f-p" type="text" inputmode="decimal" autocomplete="off" value="${v(e.p)}"></label>
      <label class="field">Sacharidy (g)<input id="f-c" type="text" inputmode="decimal" autocomplete="off" value="${v(e.c)}"></label>
      <label class="field">Tuky (g)<input id="f-f" type="text" inputmode="decimal" autocomplete="off" value="${v(e.f)}"></label>
      <label class="field">Vláknina (g)<input id="f-fib" type="text" inputmode="decimal" autocomplete="off" value="${v(e.fib)}"></label>
      <label class="field">Čas<input id="f-time" type="time" value="${hhmm(e.ts || Date.now())}"></label>
    </div>
    <h3 class="sub-h" style="margin-top:4px">Zdravosť</h3>
    <div class="seg" id="f-score">${[[3, 'Nezdravé'], [5, 'Bežné'], [8, 'Zdravé']].map(([n, l]) =>
      `<button type="button" data-fscore="${n}" class="${(e.score ? (e.score >= 7 ? 8 : e.score >= 4 ? 5 : 3) : 5) === n ? 'on' : ''}">${l}</button>`).join('')}</div>`;
}
function readEntryForm(date, base = null) {
  const n = id => Math.max(0, Number(String($(id).value).replace(',', '.')) || 0);
  const name = nodash($('#f-name').value.trim());
  if (!name) { toast('Napíš názov jedla.'); return null; }
  if (!base && !n('#f-kcal')) { toast('Zadaj kalórie.'); return null; }
  const [h, m] = ($('#f-time').value || '12:00').split(':').map(Number);
  const ts = parseDay(date); ts.setHours(h || 0, m || 0, 0, 0);
  return { name, g: n('#f-g'), kcal: n('#f-kcal'), p: n('#f-p'), c: n('#f-c'), f: n('#f-f'), fib: n('#f-fib'),
    score: $('#f-score').dataset.touched || !base ? Number($('#f-score .on')?.dataset.fscore) || 5 : base.score, ts: ts.getTime() };
}
function bindEntryForm(base) {
  // Zmena gramov prepočíta kalórie a makrá (dajú sa potom aj prepísať).
  $('#f-score').addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    $('#f-score').dataset.touched = '1';
    $('#f-score').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  });
  if (!base?.g) return;
  const per = perGramFromEntry(base);
  $('#f-g').addEventListener('input', () => {
    const g = numIn($('#f-g').value);
    if (!g) return;
    $('#f-kcal').value = r0(per.kcal * g); $('#f-p').value = r1(per.p * g); $('#f-c').value = r1(per.c * g); $('#f-f').value = r1(per.f * g); $('#f-fib').value = r1(per.fib * g);
  });
}

function openManual() {
  openSheet('Zapísať ručne', entryForm({}) + '<button class="btn primary" id="f-save" style="margin-top:16px">Pridať</button>');
  bindEntryForm(null);
  $('#f-name').focus();
  $('#f-save').onclick = () => {
    const it = readEntryForm(curDate);
    if (!it) return;
    addEntries([it], 'rucne');
  };
}

// Úprava záznamu / zmazanie / zjesť znova.
function openEntry(id, again = false) {
  const e = S.entries.find(x => x.id === id);
  if (!e) return;
  if (again) {
    if (!e.g) return addEntries([{ ...e }], 'znova');
    const per = perGramFromEntry(e);
    openSheet(e.name, `
      <label class="field">Množstvo (g)<input class="input" id="e-g" type="text" inputmode="decimal" autocomplete="off" value="${r0(e.g)}"></label>
      <p class="small muted" id="e-info" style="margin-bottom:14px"></p>
      <button class="btn primary" id="e-add">Pridať</button>`);
    const upd = () => {
      const g = numIn($('#e-g').value);
      $('#e-info').textContent = `${r0(per.kcal * g)} kcal · B ${r0(per.p * g)} g · S ${r0(per.c * g)} g · T ${r0(per.f * g)} g`;
    };
    $('#e-g').addEventListener('input', upd);
    upd();
    $('#e-add').onclick = () => {
      const g = numIn($('#e-g').value);
      if (g <= 0) return toast('Zadaj množstvo.');
      addEntries([{ name: e.name, g, kcal: per.kcal * g, p: per.p * g, c: per.c * g, f: per.f * g, fib: per.fib * g, score: e.score }], 'znova');
    };
    return;
  }
  openSheet(e.name, entryForm(e) + `
    ${e.items?.length ? `<p class="small muted" style="margin-top:12px">Zloženie: ${e.items.map(i => `${esc(i.name)} ${r0(i.g)} g`).join(', ')}</p>` : ''}
    <div class="grid2" style="margin-top:16px"><button class="btn danger" id="e-del">Zmazať</button><button class="btn primary" id="e-save">Uložiť</button></div>
    <button class="btn" id="e-fav" style="margin-top:10px">Pridať medzi moje jedlá</button>`);
  bindEntryForm(e);
  $('#e-del').onclick = () => deleteEntry(e);
  $('#e-fav').onclick = () => { const { id: _, ts, date, thumb, ...it } = e; addFav(e.name, [it]); closeSheet(); };
  $('#e-save').onclick = () => {
    const it = readEntryForm(e.date, e);
    if (!it) return;
    Object.assign(e, { ...it, g: r1(it.g), kcal: r1(it.kcal), p: r1(it.p), c: r1(it.c), f: r1(it.f), fib: r1(it.fib) });
    save(); closeSheet(); render(); toast('Uložené');
  };
}

// ---------- Profil (vpravo hore) ----------
function openProfile() {
  const p = S.profile;
  // Pri prvom spustení len to podstatné.
  const first = !p.age;
  const t = targets(todayKey());
  const opt = (val, list) => list.map(([v, l]) => `<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${l}</option>`).join('');
  openSheet('Profil', `
    <form id="profile-form">
      <label class="field">Meno<input name="name" value="${esc(p.name)}" autocomplete="given-name"></label>
      <div class="grid2">
        <label class="field">Pohlavie<select name="sex">${opt(p.sex, [['m', 'Muž'], ['f', 'Žena']])}</select></label>
        <label class="field">Vek<input name="age" type="number" inputmode="numeric" value="${p.age ?? ''}"></label>
        <label class="field">Výška (cm)<input name="height" type="number" inputmode="numeric" value="${p.height ?? ''}"></label>
        <label class="field">Váha (kg)<input name="weight" type="text" inputmode="decimal" autocomplete="off" value="${currentWeight() ?? ''}"></label>
      </div>
      <label class="field">Pohyb počas týždňa<select name="activity">${opt(p.activity, [
        [1.55, 'Sedavá práca, tréning 3-5×'],
        [1.725, 'Fyzická práca, šport denne'],
        [1.9, 'Ťažká práca, tréning denne'],
      ])}</select></label>
      <label class="field">Cieľ<select name="goal">${opt([0, 250, 350, 500].includes(Number(p.surplus)) ? p.surplus : 'x', [
        [0, 'Udržať váhu'],
        [250, 'Pomalé priberanie (+250 kcal)'],
        [350, 'Priberanie svalov (+350 kcal)'],
        [500, 'Rýchle priberanie (+500 kcal)'],
        ['x', `Vlastné (${p.surplus >= 0 ? '+' : ''}${p.surplus} kcal)`],
      ])}</select></label>
      <h3 class="sub-h">Strava</h3>
      <div class="chips"><button type="button" class="chip-btn ${p.glutenFree ? 'on' : ''}" data-pgf="1">Bezlepková (celiakia)</button></div>
      <h3 class="sub-h">Alergie</h3>
      <div class="chips">${ALLERGENS.map(([k, l]) =>
        `<button type="button" class="chip-btn ${(p.allergens || []).includes(k) ? 'on' : ''}" data-pal="${k}">${l}</button>`).join('')}</div>
      <p class="small muted" style="margin:8px 0 14px">Recepty s alergénom sa nezobrazia. Pri lepku ukážem bezlepkovú úpravu receptu.</p>
      <button class="btn primary">Uložiť</button>
    </form>
    ${t ? `<p class="small muted" style="margin:10px 0 0">Dnešný cieľ ${t.kcal} kcal · bielkoviny ${t.p} g · sacharidy ${t.c} g · tuky ${t.f} g.</p>` : ''}

    <h3 class="sub-h">AI (fotky, plány, recepty)</h3>
    <input class="input" id="api-key" type="password" autocomplete="off" placeholder="Anthropic API kľúč (sk-ant-…)" value="${esc(getKey())}">
    <select class="input" id="api-model" style="margin-top:8px">${opt(p.model, MODELS)}</select>
    <button class="btn" id="key-save" style="margin-top:8px">Uložiť kľúč</button>
    <p class="small muted" style="margin-top:6px">Kľúč ostáva len v tomto zariadení a posiela sa iba do Anthropic API.</p>

    ${first ? '<p class="small muted" style="margin-top:16px">Ďalšie nastavenia (kuchárka, záloha) nájdeš tu neskôr.</p>' : `
    <h3 class="sub-h">Športová kuchárka</h3>
    <p class="small muted" style="margin-bottom:8px">${BOOK ? `Odomknutá: ${BOOK.recipes.length} receptov.` : 'Zamknutá, odomkneš ju svojím súkromným odkazom.'}</p>
    ${BOOK ? '<button class="btn" data-act="book-lock">Zamknúť kuchárku v tomto zariadení</button>' : ''}

    <h3 class="sub-h">Ceny z bločkov</h3>
    <p class="small muted" style="margin-bottom:8px">${S.prices?.length ? `Uložené: ${S.prices.length} ${plural(S.prices.length, 'položka', 'položky', 'položiek')}. Používajú sa pri pláne nákupu.` : 'Zatiaľ žiadne. Bloček odfotíš v Pláne a nákupe.'}</p>
    ${S.prices?.length ? '<button class="btn" data-act="prices-clear">Vymazať ceny</button>' : ''}

    <h3 class="sub-h">Záloha</h3>
    <div class="grid2"><button class="btn" id="exp">Zálohovať</button><button class="btn" id="imp">Import</button></div>
    <button class="btn danger" id="wipe" style="margin-top:10px">Zmazať všetky dáta</button>`}
  `);

  $('#profile-form').onsubmit = ev => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const num = k => { const v = Number(String(fd.get(k)).replace(',', '.')); return v > 0 ? v : null; };
    p.name = String(fd.get('name') || '').trim();
    p.sex = fd.get('sex');
    p.age = num('age');
    p.height = num('height');
    p.activity = Number(fd.get('activity'));
    if (fd.get('goal') !== 'x') p.surplus = Number(fd.get('goal'));
    const w = num('weight');
    if (w && w !== currentWeight()) {
      p.weight = w;
      const d = todayKey();
      S.weights = S.weights.filter(x => x.date !== d);
      S.weights.push({ date: d, kg: r1(w) });
    }
    // Kľúč a model sa uložia aj hlavným tlačidlom.
    setKey($('#api-key').value.trim());
    p.model = $('#api-model').value;
    save(); closeSheet(); render(); toast('Profil uložený');
  };
  $('#key-save').onclick = () => {
    setKey($('#api-key').value.trim());
    p.model = $('#api-model').value;
    save(); toast('Nastavenia AI uložené');
  };
  if (first) return;
  $('#exp').onclick = () => backupNow();
  $('#imp').onclick = () => $('#import-input').click();
  $('#wipe').onclick = () => {
    if (!confirm('Naozaj zmazať všetky jedlá, váhu a profil? Toto sa nedá vrátiť.')) return;
    S = defaultState(); save(); closeSheet(); render(); toast('Všetko zmazané');
  };
}

// Kuchárka sa pri štarte ešte rozšifrováva: akciu spusti, keď bude hotová.
let bookReady = Promise.resolve();
function withBook(fn) {
  if (BOOK) return fn();
  if (!storedPass()) return toast('Najprv odomkni kuchárku (karta Čo si uvarím?).');
  bookReady.then(() => BOOK ? null : (bookReady = refreshBook()))
    .then(() => BOOK ? fn() : toast(storedPass() ? 'Kuchárku sa nepodarilo načítať, skontroluj internet.' : 'Kľúč ku kuchárke už neplatí, vlož odkaz znova.'));
}

// ---------- Udalosti ----------
document.addEventListener('click', ev => {
  const t = ev.target.closest('button');
  if (!t) return;
  const d = t.dataset;
  if (d.act === 'add') openAdd();
  else if (d.act === 'photo' || d.act === 'photo-gallery' || d.act === 'text') {
    // Bez API kľúča AI nepôjde: najprv profil, nech sa fotka ani text nestratí.
    if (!getKey()) { toast('Najprv zadaj API kľúč v profile.'); openProfile(); }
    else if (d.act === 'text') openTextAI();
    else pickPhoto(d.act === 'photo' ? 'food' : 'gallery');
  }
  else if (d.act === 'manual') openManual();
  else if (d.act === 'go-today') { curDate = todayKey(); render(); openAdd(); }
  else if (d.act === 'water') openWater();
  else if (d.act === 'weight') openWeight();
  else if (d.act === 'profile') openProfile();
  else if (d.drink) addWater(Number(d.drink));
  else if (d.entry) openEntry(d.entry);
  else if (d.recent) openEntry(d.recent, true);
  else if (d.act === 'all-recipes') { recQ = ''; withBook(openAllRecipes); }
  else if (d.act === 'book-lock') {
    BOOK = null;
    cryptoKey = keyPromise = null;
    try { localStorage.removeItem(BOOK_KEY); localStorage.removeItem(PASS_KEY); } catch { /* nič */ }
    closeSheet(); render(); toast('Kuchárka zamknutá');
  }
  else if (d.act === 'cook') withBook(cookStart);
  else if (d.rfav) { S.recipeMeta[d.rfav] = { ...rmeta(d.rfav), fav: !rmeta(d.rfav).fav }; save(); t.classList.toggle('on'); }
  else if (d.rate) {
    const n = Number(d.n);
    S.recipeMeta[d.rate] = { ...rmeta(d.rate), rating: rmeta(d.rate).rating === n ? 0 : n };
    save();
    t.parentElement.querySelectorAll('.star').forEach(b => b.classList.toggle('on', Number(b.dataset.n) <= S.recipeMeta[d.rate].rating));
  }
  else if (d.cookMode) startCooking(d.cookMode);
  else if (d.rport) {
    S.profile.cookPortions = Number(d.rport);
    save();
    t.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === t));
    const r = findRecipe($('[data-cook-mode]')?.dataset.cookMode);
    if (r) $('#r-ing').innerHTML = ingHtml(r, cookN());
  }
  else if (d.act === 'cook-close') stopCooking();
  else if (d.act === 'cook-next') { if (cookState.i >= cookState.r.steps.length - 1) stopCooking(); else { cookState.i++; drawCooking(); } }
  else if (d.act === 'cook-prev') { cookState.i = Math.max(-1, cookState.i - 1); drawCooking(); }
  else if (d.act === 'add-recipe') openAddRecipe();
  else if (d.act === 'recipe-del') {
    if (!confirm('Zmazať tento recept?')) return;
    S.myRecipes = (S.myRecipes || []).filter(r => r.id !== Number(d.id));
    save(); render(); openAllRecipes(); toast('Recept zmazaný');
  }
  else if (d.act === 'only-fav') { onlyFav = !onlyFav; openAllRecipes(); }
  else if (d.act === 'scan') openScan();
  else if (d.act === 'receipt') pickPhoto('receipt');
  else if (d.act === 'prices-clear') { if (confirm('Vymazať uložené ceny z bločkov?')) { S.prices = []; save(); openProfile(); } }
  else if (d.act === 'scan-code') lookupProduct($('#scan-code').value);
  else if (d.scan) lookupProduct(d.scan);
  else if (d.act === 'scan-photo') { stopScanner(); pickPhoto('barcode'); }
  else if (d.act === 'label-photo') pickPhoto('label');
  else if (d.act === 'product-ai') productAI(t);
  else if (d.act === 'daytype') openDayType();
  else if (d.dtype) {
    S.days[curDate] = { ...(S.days[curDate] || {}), type: dayType(curDate) === d.dtype ? 'none' : d.dtype };
    save(); render(); keepWatch(openDayType);
  }
  else if (d.act === 'daytype-week') {
    const wd = parseDay(curDate).getDay(), cur = dayType(curDate);
    S.profile.week = { ...(S.profile.week || {}) };
    if (cur && S.profile.week[wd] !== cur) S.profile.week[wd] = cur; else delete S.profile.week[wd];
    if (!cur) toast('Najprv vyber typ dňa.');
    save(); render(); keepWatch(openDayType);
  }
  else if (d.act === 'daytype-save') {
    const w = numIn($('#watch-kcal').value);
    S.days[curDate] = { ...(S.days[curDate] || {}), watch: w > 0 ? w : null };
    save(); closeSheet(); render();
  }
  else if (d.act === 'supp-edit') openSuppEdit();
  else if (d.suppPick) {
    const list = S.profile.suppList || [];
    S.profile.suppList = list.includes(d.suppPick) ? list.filter(x => x !== d.suppPick) : [...list, d.suppPick];
    save(); render(); openSuppEdit();
  }
  else if (d.act === 'supp-add') {
    let n = nodash($('#supp-new').value.trim()).replace(/["<>]/g, '');
    n = SUPP_PRESETS.find(x => norm(x[0]) === norm(n))?.[0] || n;
    if (n && !(S.profile.suppList || []).some(x => norm(x) === norm(n))) { S.profile.suppList = [...(S.profile.suppList || []), n]; save(); render(); }
    openSuppEdit();
  }
  else if (d.supp) {
    const list = S.supps[curDate] || [];
    S.supps[curDate] = list.includes(d.supp) ? list.filter(x => x !== d.supp) : [...list, d.supp];
    save();
    // Prekresli len kartu suplementov, nech sa neanimujú všetky naraz.
    const card = t.closest('.supps');
    if (card) {
      const tmp = document.createElement('div');
      tmp.innerHTML = suppsCard();
      const fresh = tmp.firstElementChild;
      const nb = fresh.querySelectorAll('.supp')[[...card.querySelectorAll('.supp')].indexOf(t)];
      t.className = nb.className; t.innerHTML = nb.innerHTML; t.setAttribute('aria-pressed', nb.getAttribute('aria-pressed'));
      card.querySelector('.supp-count').replaceWith(fresh.querySelector('.supp-count'));
      card.querySelector('.bar').replaceWith(fresh.querySelector('.bar'));
    } else render();
  }
  else if (d.act === 'copy-day') copyDayToToday();
  else if (d.act === 'backup') backupNow();
  else if (d.act === 'fav-edit') { favEdit = !favEdit; openAdd(); }
  else if (d.fav) eatFav(d.fav);
  else if (d.favDel) { S.favs = S.favs.filter(f => f.id !== d.favDel); save(); openAdd(); }
  else if (d.pgf) { S.profile.glutenFree = !S.profile.glutenFree; save(); t.classList.toggle('on'); planForm.gf = null; render(); }
  else if (d.pal) {
    const a = S.profile.allergens || [];
    S.profile.allergens = a.includes(d.pal) ? a.filter(x => x !== d.pal) : [...a, d.pal];
    save(); t.classList.toggle('on'); planForm.allergens = null; render();
  }
  else if (d.pdiet) { planForm.gf = !planForm.gf; t.classList.toggle('on'); }
  else if (d.pall) { planForm.allergens = planForm.allergens.includes(d.pall) ? planForm.allergens.filter(x => x !== d.pall) : [...planForm.allergens, d.pall]; t.classList.toggle('on'); }
  else if (d.act === 'plan') withBook(openPlan);
  else if (d.act === 'plan-new') planStep1();
  else if (d.act === 'plan-go') {
    if (!planForm.meals.length) return toast('Vyber aspoň jedno jedlo.');
    if (!(planForm.budget > 0)) return toast('Zadaj rozpočet.');
    runPlan(t);
  }
  else if (d.pf) { planForm[d.pf] = Number(d.v); t.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === t)); }
  else if (d.pm) {
    if (d.pm === 'all') planForm.meals = planForm.meals.length === PLAN_MEALS.length ? [] : PLAN_MEALS.map(m => m[0]);
    else planForm.meals = planForm.meals.length === PLAN_MEALS.length ? [d.pm] : planForm.meals.includes(d.pm) ? planForm.meals.filter(x => x !== d.pm) : [...planForm.meals, d.pm];
    planStep1();
  }
  else if (d.pp) { planForm.prefs = planForm.prefs.includes(d.pp) ? planForm.prefs.filter(x => x !== d.pp) : [...planForm.prefs, d.pp]; t.classList.toggle('on'); }
  else if (d.ptab) { planTab = d.ptab; showPlan(); }
  else if (d.act === 'shop-share') {
    const list = S.mealPlan.result.shopping.filter(it => !it.done).map(it => `• ${nodash(it.item)}${it.amount ? ` (${nodash(it.amount)})` : ''}`).join('\n');
    navigator.share({ title: 'Nákup', text: `Nákup\n${list}` }).catch(() => {});
  }
  else if (d.shop) { const it = S.mealPlan.result.shopping[Number(d.shop)]; it.done = !it.done; save(); showPlan(); }
  else if (d.planRecipe) openRecipe(d.planRecipe, showPlan, Number(d.n) || 1);
  else if (d.act === 'ai-day') runDayAI(t);
  else if (d.act === 'cook-results') cookResults();
  else if (d.act === 'unlock-paste') unlockFromClipboard();
  else if (d.meal) { wiz.meal = d.meal; cookFridge(); }
  else if (d.chip) {
    S.fridge = S.fridge.includes(d.chip) ? S.fridge.filter(x => x !== d.chip) : [...S.fridge, d.chip];
    save();
    t.classList.toggle('on');
    updateCookCount();
  } else if (d.recipe) {
    // Späť sa vráti na to isté miesto v zozname (hľadanie aj posun ostanú).
    const from = $('#sheet-title').textContent === 'Všetky recepty' ? openAllRecipes : cookResults;
    const y = $('.sheet').scrollTop;
    openRecipe(d.recipe, () => { from(); requestAnimationFrame(() => { $('.sheet').scrollTop = y; }); });
  }
  else if (d.eat) { stopCooking(); eatRecipe(d.eat, Number(d.n) || 1); }
  else if (d.wdel) {
    S.weights = S.weights.filter(w => w.date !== d.wdel);
    S.profile.weight = sortedWeights().at(-1)?.kg ?? S.profile.weight;
    save(); render(); openWeight();
  }
});

$('#open-profile').onclick = openProfile;
$('#close-sheet').onclick = closeSheet;
$('#sheet-back').onclick = () => wiz.back?.();
$('#sheet-bg').addEventListener('click', ev => { if (ev.target.id === 'sheet-bg') closeSheet(); });
document.addEventListener('keydown', ev => { if (ev.key !== 'Escape') return; if (cookState) stopCooking(); else if (!$('#sheet-bg').hidden) closeSheet(); });

$('#prev-day').onclick = () => { curDate = dayKey(addDays(parseDay(curDate), -1)); render(); };
$('#next-day').onclick = () => { if (curDate < todayKey()) { curDate = dayKey(addDays(parseDay(curDate), 1)); render(); } };

// Jeden fotoaparát pre všetko: jedlo, čiarový kód, zloženie na obale, bloček.
let photoMode = 'food';
// Jedlo a kód rovno kamerou, bloček a zloženie aj z galérie.
function pickPhoto(mode) {
  photoMode = mode;
  const inp = $('#photo-input');
  if (mode === 'food' || mode === 'barcode') inp.setAttribute('capture', 'environment'); else inp.removeAttribute('capture');
  if (mode === 'gallery') photoMode = 'food';
  inp.click();
}
$('#photo-input').addEventListener('change', async ev => {
  const file = ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  if (photoMode === 'barcode') return scanFromPhoto(file);
  if (photoMode === 'label' || photoMode === 'receipt') {
    try {
      const img = await loadImage(file);
      const b64 = resize(img, 1568, 0.85).split(',')[1];
      if (photoMode === 'label') {
        openSheet('Zloženie', '<button class="btn primary" id="label-go" disabled><span class="spinner"></span> AI číta zloženie…</button>');
        productAI($('#label-go'), b64);
      } else readReceipt(b64);
    } catch (err) { toast(err.message); }
    return;
  }
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
    const when = data.lastBackup ? new Date(data.lastBackup).toLocaleDateString('sk-SK') : 'neznámy dátum';
    if (!confirm(`Nahradiť všetky dáta zálohou (${when}, ${data.entries.length} ${plural(data.entries.length, 'záznam', 'záznamy', 'záznamov')})? Terajšie dáta sa prepíšu.`)) return;
    const prev = S;
    S = normalize(data);
    if (!save()) { S = prev; return; }
  } catch {
    return toast('Neplatný súbor zálohy.');
  }
  closeSheet(); render(); toast('Záloha načítaná');
});

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible') return;
  if (rollover()) render();
  // Po návrate do appky znova drž obrazovku zapnutú v režime varenia.
  if (cookState) try { cookState.lock = await navigator.wakeLock?.request('screen'); } catch { /* nepodporované */ }

});

// Klávesnica na iPhone: panel sa posunie nad ňu.
if (window.visualViewport) {
  const kb = () => document.documentElement.style.setProperty('--kb', Math.max(0, innerHeight - visualViewport.height - visualViewport.offsetTop) + 'px');
  visualViewport.addEventListener('resize', kb);
  visualViewport.addEventListener('scroll', kb);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

render();
bookReady = unlockFromUrl().then(done => done || refreshBook());
if (!S.profile.age) openProfile();
