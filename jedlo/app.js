'use strict';

// ---------- Úložisko ----------
const STORE_KEY = 'jedlo.v1';
const KEY_KEY = 'jedlo.apikey';
const BOOK_KEY = 'jedlo.kucharka';
const MODELS = [
  ['claude-opus-5-5', 'Claude Opus 5.5 – presnejší (~1–2 centy / fotka)'],
  ['claude-haiku-5-5', 'Claude Haiku 5.5 – lacnejší, rýchlejší'],
];
const DRINKS = [
  ['glass', 'Pohár', 250],
  ['bottle5', 'Fľaša 0,5 l', 500],
  ['bottle75', 'Fľaša 0,75 l', 750],
  ['bottle1', 'Fľaša 1 l', 1000],
];

function defaultState() {
  return {
    profile: { name: '', sex: 'm', age: null, height: null, weight: null, activity: 1.725, surplus: 350, proteinPerKg: 2, model: MODELS[0][0] },
    entries: [],
    weights: [],
    water: {},
    fridge: [],
    recipeCat: 'snidane',
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
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

const ICON = {
  camera: '<path d="M4 8a2 2 0 012-2h2l1.5-2h5L16 6h2a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2z"/><circle cx="12" cy="12.5" r="3.5"/>',
  pen: '<path d="M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
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
function sortedWeights() { return [...S.weights].sort((a, b) => a.date.localeCompare(b.date)); }
function currentWeight() { return S.weights.length ? sortedWeights().at(-1).kg : S.profile.weight; }

function targets(date) {
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

// ---------- Hlavná stránka ----------
let curDate = todayKey();

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
  return `<div><div class="bar-label"><span>${label}</span><span class="muted">${r0(value)} / ${target ? r0(target) : '–'} ${unit}</span></div>
    <div class="bar"><i style="width:${pct}%;background:${color}"></i></div></div>`;
}

function render() {
  $('#title').textContent = dayTitle(curDate);
  const recent = curDate >= dayKey(addDays(new Date(), -1));
  $('#date').textContent = parseDay(curDate).toLocaleDateString('sk-SK', recent ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' });
  $('#nameday').textContent = nameday(curDate);
  $('#next-day').disabled = curDate >= todayKey();
  $('#open-profile').textContent = (S.profile.name || '?').trim().charAt(0).toUpperCase() || '?';

  const t = targets(curDate);
  const tot = dayTotals(curDate);
  let html = '';

  if (!t) {
    html += `<div class="warn">Najprv vyplň profil (vek, výška, váha) – vypočítam ti denný cieľ na priberanie.
      <div style="margin-top:10px"><button class="btn sm primary" data-act="profile">Vyplniť profil</button></div></div>`;
  }

  // Kalórie a makrá
  const left = t ? r0(t.kcal - tot.kcal) : null;
  html += `<div class="card dark"><div class="ring-wrap">
    <div class="ring">${ring(tot.kcal, t?.kcal, '#1fd67a', '#b6ff5a', 'rk')}
      <div class="center"><span class="big">${r0(tot.kcal)}</span><span class="small muted">${t ? 'z ' + t.kcal + ' kcal' : 'kcal'}</span></div></div>
    <div class="bars">
      ${bar('Bielkoviny', tot.p, t?.p, 'var(--p)')}
      ${bar('Sacharidy', tot.c, t?.c, 'var(--c)')}
      ${bar('Tuky', tot.f, t?.f, 'var(--f)')}
      ${bar('Vláknina', tot.fib, t?.fib, 'var(--fib)')}
    </div></div>
    <div class="summary"><span>${t
      ? (left > 0 ? `Ešte zjedz <b>${left} kcal</b> a <b>${Math.max(0, t.p - r0(tot.p))} g</b> bielkovín.` : `Cieľ splnený ✓ <span class="muted">(+${-left} kcal)</span>`)
      : 'Pridaj, čo si zjedol.'}</span></div>
  </div>`;

  html += dayMeter(curDate, t, tot);

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

  // Váha
  const ws = sortedWeights();
  const tr = weightTrend();
  html += `<div class="card"><div class="tile">
    <span class="ico weight">${icon('scale')}</span>
    <div class="tile-main"><div class="tile-label">Váha</div>
      <div class="tile-val">${ws.length ? ws.at(-1).kg.toLocaleString('sk-SK') + ' kg' : '–'}
        ${tr ? `<small>${tr.perWeek >= 0 ? '+' : ''}${tr.perWeek.toFixed(2).replace('.', ',')} kg/týždeň</small>` : ''}</div>
      ${tr ? `<div class="small muted">${trendAdvice(tr).text}</div>` : `<div class="small muted">${ws.length ? 'Tempo uvidíš po 7 dňoch vážení.' : 'Zapíš ráno nalačno, 2–3× týždenne.'}</div>`}</div>
    <button class="round" data-act="weight" aria-label="Zapísať váhu">${icon('plus', 20, 2.4)}</button>
  </div></div>`;

  // Záznamy a štatistiky – len keď je čo ukázať
  const items = S.entries.filter(e => e.date === curDate).sort((a, b) => a.ts - b.ts);
  if (items.length) {
    html += `<div class="card"><h3>Záznamy <span class="muted small">${items.length}× · ${tot.score ? `zdravosť <span class="score ${scoreClass(tot.score)}">${r1(tot.score)}</span>` : ''}</span></h3>
      <div class="list">${items.map(e => `<button class="entry" data-entry="${e.id}">
        ${e.thumb ? `<img src="${e.thumb}" alt="">` : ''}
        <div class="info"><div class="name">${esc(e.name)}</div>
          <div class="small muted">${new Date(e.ts).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })} · ${e.g ? r0(e.g) + ' g' : '1 porcia'} · B ${r0(e.p)} g</div></div>
        <span class="score ${scoreClass(e.score)}">${e.score ?? '–'}</span>
        <span class="kc">${r0(e.kcal)}</span></button>`).join('')}</div></div>`;
  }
  html += weekStats();
  html += recipesCard();

  $('#page').innerHTML = html;
}

// ---------- Ako jem: ukazovateľ od červenej (nezdravo) po zelenú (zdravo) ----------
// Skóre 0–100: kvalita jedál 40 %, kalórie 25 %, bielkoviny 25 %, vláknina 10 %.
// Pri dnešku sa kalórie a bielkoviny porovnávajú s tým, koľko by malo byť zjedené do tejto hodiny.
function dayScore(date, t, tot) {
  if (!tot.n) return null;
  const now = new Date();
  const expected = date < todayKey() ? 1 : Math.min(1, Math.max(0.25, (now.getHours() + now.getMinutes() / 60 - 7) / 14));
  const fit = (val, target) => {
    if (!target) return 0.5;
    const ratio = val / (target * expected);
    return ratio >= 0.9 && ratio <= 1.15 ? 1 : ratio < 0.9 ? Math.max(0, ratio / 0.9) : Math.max(0, 1 - (ratio - 1.15) * 1.5);
  };
  const parts = {
    quality: ((tot.score ?? 5) - 1) / 9,
    kcal: fit(tot.kcal, t?.kcal),
    protein: fit(tot.p, t?.p),
    fiber: t ? Math.min(1, tot.fib / (t.fib * expected)) : 0.5,
  };
  const score = Math.round(100 * (0.4 * parts.quality + 0.25 * parts.kcal + 0.25 * parts.protein + 0.1 * parts.fiber));
  const tips = {
    quality: 'veľa spracovaného jedla',
    kcal: tot.kcal < (t?.kcal || 0) * expected ? 'málo kalórií na priberanie' : 'veľa kalórií naraz',
    protein: 'málo bielkovín',
    fiber: 'málo vlákniny – pridaj zeleninu',
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

// Odtlačok jedál dňa – AI hodnotenie platí, len kým sa jedlá nezmenia.
function dayHash(date) {
  return S.entries.filter(e => e.date === date).map(e => e.id + ':' + e.g).join('|');
}

function dayMeter(date, t, tot) {
  const calc = dayScore(date, t, tot);
  const ai = S.aiDay?.[date];
  const useAi = ai && ai.hash === dayHash(date);
  const score = useAi ? ai.score : calc?.score;
  return `<div class="card dark meter-card">
    <div class="meter-head"><h3>Ako dnes ješ</h3>${score != null ? `<span class="meter-score">${score}<small>/100</small></span>` : ''}</div>
    <div class="meter" role="img" aria-label="${score != null ? `Hodnotenie dňa ${score} zo 100: ${verdict(score)}` : 'Zatiaľ bez hodnotenia'}">
      ${score != null ? `<i style="left:${Math.min(98, Math.max(2, score))}%"></i>` : ''}
    </div>
    <div class="meter-ends"><span>Nezdravo</span><span>Zdravo</span></div>
    <p class="meter-text">${score == null ? 'Zapíš jedlo a ukážem, ako ti ide deň.'
      : `<b>${verdict(score)}</b> · ${esc(useAi ? ai.text : calc.tip)}${useAi ? ' <span class="chip ai">AI</span>' : ''}`}</p>
    ${score != null ? `<button class="btn sm ghost-dark" data-act="ai-day">${useAi ? 'Zhodnotiť znova s AI' : 'Zhodnotiť deň s AI'}</button>` : ''}
  </div>`;
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
score: celé číslo 0–100 (0 = veľmi nezdravo, 50 = priemer, 100 = výborne). Zohľadni kvalitu potravín, bielkoviny, kalórie vzhľadom na cieľ, vlákninu, zeleninu a rozloženie jedál.${isToday ? ' Deň ešte neskončil – nehodnoť prísne to, čo ešte stihne zjesť.' : ''}
text: jedna krátka veta po slovensky (max. 12 slov) – čo je najlepšie alebo čo zlepšiť.`,
    content: [{ type: 'text', text: `${isToday ? `Je ${new Date().toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}, deň ešte prebieha.` : 'Deň už skončil.'}
Cieľ: ${t ? `${t.kcal} kcal, ${t.p} g bielkovín, ${t.fib} g vlákniny` : 'neznámy'}.
Spolu: ${r0(tot.kcal)} kcal, B ${r0(tot.p)} g, S ${r0(tot.c)} g, T ${r0(tot.f)} g, vláknina ${r0(tot.fib)} g.
Jedlá:\n${list}` }],
    schema: DAY_SCHEMA,
    effort: 'low',
  });
}

async function runDayAI(btn) {
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Hodnotím…';
  try {
    const res = await analyzeDay(curDate);
    S.aiDay = S.aiDay || {};
    S.aiDay[curDate] = { score: Math.min(100, Math.max(0, Math.round(res.score))), text: res.text, hash: dayHash(curDate), ts: Date.now() };
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

  const W = 320, H = 120;
  const maxV = Math.max(...tots.map(x => Math.max(x.kcal, x.t?.kcal || 0))) * 1.1 || 1;
  const bw = W / 7;
  const bars = tots.map((x, i) => {
    const h = (x.kcal / maxV) * (H - 18);
    const ok = x.t && x.kcal >= x.t.kcal * 0.9;
    const th = x.t ? H - 16 - (x.t.kcal / maxV) * (H - 18) : null;
    return `<rect x="${i * bw + bw * 0.2}" y="${H - 16 - h}" width="${bw * 0.6}" height="${Math.max(h, 0)}" rx="5" fill="${ok ? '#1fd67a' : 'var(--orange)'}" opacity="${x.n ? 1 : 0.2}"/>` +
      (th !== null ? `<line x1="${i * bw + bw * 0.1}" x2="${i * bw + bw * 0.9}" y1="${th}" y2="${th}" stroke="#fff" stroke-opacity=".45" stroke-width="2" stroke-dasharray="3 3"/>` : '') +
      `<text x="${i * bw + bw / 2}" y="${H - 2}" font-size="11" font-weight="${x.d === curDate ? 800 : 600}" text-anchor="middle" fill="${x.d === curDate ? '#fff' : 'rgba(255,255,255,.55)'}">${parseDay(x.d).toLocaleDateString('sk-SK', { weekday: 'short' }).slice(0, 2)}</text>`;
  }).join('');

  const avg = k => logged.reduce((s, x) => s + x[k], 0) / logged.length;
  const tip = mainTip(logged);
  return `<div class="card dark"><h3>Posledných 7 dní</h3>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kalórie za posledných 7 dní">${bars}</svg>
    <div class="trio">
      <div><b>${r0(avg('kcal'))}</b><span>kcal / deň</span></div>
      <div><b>${r0(avg('p'))} g</b><span>bielkoviny / deň</span></div>
      <div><b>${streak()}</b><span>dní v rade</span></div>
    </div>
    ${tip ? `<p class="tip">${tip}</p>` : ''}</div>`;
}

// ---------- Recepty zo Športovej kuchárky ----------
// Kuchárka je platený obsah, preto je na (verejnom) webe len zašifrovaná (kucharka.bin + kucharka-foto/*.bin).
// Odomkne sa raz súkromným odkazom (#k=…); kľúč a rozšifrovaná kópia ostanú len v tomto zariadení.
const PASS_KEY = 'jedlo.kucharka.heslo';
let BOOK = null;
try { BOOK = JSON.parse(localStorage.getItem(BOOK_KEY) || 'null'); } catch { BOOK = null; }
let cryptoKey = null;
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
  try { localStorage.setItem(BOOK_KEY, JSON.stringify(data)); } catch { /* ostane aspoň v pamäti */ }
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
    if (!BOOK || data.version !== BOOK.version) { storeBook(data); render(); }
  } catch { /* offline alebo bez zmeny */ }
}

// Súkromný odkaz …/jedlo/#k=KĽÚČ odomkne kuchárku jedným ťuknutím.
async function unlockFromUrl() {
  const m = location.hash.match(/[#&]k=([^&]+)/);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  try { await unlockBook(decodeURIComponent(m[1])); } catch (err) { toast(err.message); }
}

async function unlockFromClipboard() {
  try {
    const t = (await navigator.clipboard.readText()).trim();
    const m = t.match(/[#&]k=([^&\s]+)/);
    await unlockBook(decodeURIComponent(m ? m[1] : t));
  } catch (err) {
    toast(err?.message?.includes('kľúč') ? err.message : 'Najprv skopíruj svoj odkaz na kuchárku.');
  }
}

async function photoUrl(id) {
  if (photoUrls.has(id)) return photoUrls.get(id);
  if (BOOK?.recipes.find(x => x.id === id)?.photo === false) return null;
  if (!cryptoKey) {
    const pass = storedPass();
    if (!pass || !BOOK?.salt) return null;
    cryptoKey = await deriveKey(pass, new Uint8Array(BOOK.salt.match(/../g).map(h => parseInt(h, 16))));
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

// Doplní fotky do všetkých <img data-photo> v paneli.
async function fillPhotos(root) {
  for (const img of root.querySelectorAll('img[data-photo]')) {
    const url = await photoUrl(Number(img.dataset.photo));
    if (!img.isConnected) return;
    if (url) { img.src = url; img.classList.add('loaded'); } else img.closest('.photo')?.classList.add('none');
  }
}

function chipLabel(id) { return BOOK?.chips.find(c => c.id === id)?.label.split(' (')[0] || id; }

function matchRecipe(r, have) {
  const missing = r.req.filter(alts => !alts.some(a => have.has(a) || (a === 'ovocie' && [...have].some(h => FRUITS.has(h)))));
  return { r, missing, have: r.req.length - missing.length };
}

function recipesCard() {
  if (!BOOK) {
    return `<div class="card"><h3>Čo si uvarím?</h3>
      <p class="small muted" style="margin-bottom:12px">Recepty zo Športovej kuchárky. Odomkneš ich raz – ťukni na svoj súkromný odkaz, alebo ho skopíruj a ťukni sem.</p>
      <button class="btn primary" data-act="unlock-paste">Vložiť odkaz a odomknúť</button></div>`;
  }
  return `<button class="cook-hero" data-act="cook">
      <span><b>Čo si uvarím?</b><span>Raňajky, obed, večera alebo snack – z toho, čo máš doma.</span></span>
      ${icon('right', 22, 2.4)}</button>
    <button class="link-btn" data-act="all-recipes">Všetky recepty (${BOOK.recipes.length}) – hľadať podľa názvu</button>`;
}

// ---------- Sprievodca: jedlo -> suroviny -> recepty -> recept ----------
const wiz = { meal: null, back: null };

function wizHead(title, back) {
  wiz.back = back;
  $('#sheet-title').textContent = title;
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
  return BOOK.recipes.filter(r => cats.includes(r.cat));
}

function cookFridge() {
  wizHead('Čo máš doma?', cookStart);
  const groups = [...new Set(BOOK.chips.map(c => c.group))];
  const have = new Set(S.fridge);
  $('#sheet-body').innerHTML = `
    <p class="small muted" style="margin:-6px 0 6px">Ťukni na všetko, čo máš. Soľ, korenie, olej a vodu berieme, že máš.</p>
    ${groups.map(g => `<h3 class="sub-h" style="margin-top:14px">${g}</h3><div class="chips">${BOOK.chips.filter(c => c.group === g).map(c =>
      `<button class="chip-btn ${have.has(c.id) ? 'on' : ''}" data-chip="${c.id}">${c.label}</button>`).join('')}</div>`).join('')}
    <div class="sticky-cta"><button class="btn primary" data-act="cook-results" id="cook-go"></button></div>`;
  updateCookCount();
}

function cookList() {
  const have = new Set(S.fridge);
  const list = mealRecipes().map(r => matchRecipe(r, have));
  if (!have.size) return list.sort((a, b) => a.r.title.localeCompare(b.r.title, 'cs'));
  return list.filter(m => m.missing.length <= 2 && m.have >= Math.min(2, m.r.req.length))
    .sort((a, b) => a.missing.length - b.missing.length || b.have - a.have);
}

function updateCookCount() {
  const btn = $('#cook-go');
  if (!btn) return;
  const n = cookList().length;
  btn.textContent = S.fridge.length ? (n ? `Ukáž recepty (${n})` : 'Nič nevychádza – pridaj surovinu') : `Ukáž všetky (${n})`;
  btn.disabled = S.fridge.length > 0 && !n;
}

function recipeCard(m, showMiss) {
  const r = m.r;
  return `<button class="rcard" data-recipe="${r.id}">
    <span class="photo"><img data-photo="${r.id}" alt=""></span>
    <span class="rinfo"><b>${esc(r.title)}</b>
      <span class="small muted">${[r.time && r.time + ' min', r.kcal && r0(r.kcal) + ' kcal', r.p && 'B ' + r0(r.p) + ' g'].filter(Boolean).join(' · ')}</span>
      ${showMiss ? (m.missing.length ? `<span class="miss">Chýba: ${m.missing.map(a => chipLabel(a[0])).join(', ')}</span>` : '<span class="ok">Máš všetko</span>') : ''}</span>
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

function openRecipe(id, back = null) {
  const r = BOOK.recipes.find(x => x.id === Number(id));
  if (!r) return;
  const have = new Set(S.fridge);
  if ($('#sheet-bg').hidden) openSheet('', '');
  wizHead(r.title, back);
  const meta = [r.time && r.time + ' min' + (r.extra ? ' ' + r.extra : ''), r.diff, r.prep && 'Meal prep', r.portions > 1 && `recept na ${r.portions} porcie`].filter(Boolean).join(' · ');
  const miss = have.size ? matchRecipe(r, have).missing : [];
  $('#sheet-body').innerHTML = `
    <div class="photo big"><img data-photo="${r.id}" alt="${esc(r.title)}"></div>
    ${meta ? `<p class="small muted" style="margin:10px 0 12px">${esc(meta)}</p>` : ''}
    ${r.kcal ? `<div class="ai-sum"><div class="grid3">
      <div><b>${r0(r.kcal)}</b><div class="lbl">kcal / porcia</div></div>
      <div><b>${r0(r.p)} g</b><div class="lbl">bielkoviny</div></div>
      <div><b>${r0(r.c)}/${r0(r.f)}</b><div class="lbl">sach./tuky g</div></div></div></div>` : ''}
    <h3 class="sub-h" style="margin-top:4px">Suroviny</h3>
    <div class="ing">${r.ing.map(l => /:$/.test(l) ? `<p class="ing-h">${esc(l.slice(0, -1))}</p>` : `<p>${esc(l)}</p>`).join('')}</div>
    ${miss.length ? `<p class="miss" style="margin-top:8px">Chýba ti: ${miss.map(a => chipLabel(a[0])).join(', ')}</p>` : ''}
    <h3 class="sub-h">Postup</h3>
    <ol class="steps">${r.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
    ${r.kcal ? `<button class="btn primary" data-eat="${r.id}" style="margin-top:16px">Zjedol som 1 porciu</button>` : ''}`;
  $('#sheet-body').scrollTop = 0;
  $('.sheet').scrollTop = 0;
  fillPhotos($('#sheet-body'));
}

function eatRecipe(id) {
  const r = BOOK.recipes.find(x => x.id === Number(id));
  if (!r?.kcal) return;
  addEntries([{ name: r.title, g: 0, kcal: r.kcal, p: r.p, c: r.c, f: r.f, fib: r.fib || 0, score: 8 }], 'kucharka');
}

function openAllRecipes() {
  openSheet('', '');
  wizHead('Všetky recepty', null);
  const cats = BOOK.cats.filter(c => BOOK.recipes.some(r => r.cat === c.id));
  $('#sheet-body').innerHTML = `
    <input class="input" id="recipe-q" type="search" placeholder="Hľadať (napr. kuře, kaše, losos)" autocomplete="off">
    <div id="recipe-results" style="margin-top:12px"></div>`;
  const draw = () => {
    const nq = norm($('#recipe-q').value.trim());
    const hit = r => !nq || norm(r.title + ' ' + r.ing.join(' ')).includes(nq);
    $('#recipe-results').innerHTML = cats.map(c => {
      const rs = BOOK.recipes.filter(r => r.cat === c.id && hit(r));
      return rs.length ? `<h3 class="sub-h" style="margin-top:10px">${c.label} <span class="muted small">${rs.length}</span></h3>
        <div class="rgrid">${rs.map(r => recipeCard({ r, missing: [] }, false)).join('')}</div>` : '';
    }).join('') || '<div class="empty">Nič sa nenašlo.</div>';
    fillPhotos($('#recipe-results'));
  };
  let t;
  $('#recipe-q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(draw, 200); });
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
  return 'Ideš dobre – drž to. 💪';
}

// ---------- Váha ----------
function weightTrend() {
  const ws = sortedWeights();
  if (ws.length < 2) return null;
  const last = parseDay(ws.at(-1).date);
  const recent = ws.filter(w => (last - parseDay(w.date)) / 864e5 <= 28);
  if (recent.length < 2 || (last - parseDay(recent[0].date)) / 864e5 < 7) return null;
  // Lineárna regresia kg vs. deň.
  const xs = recent.map(w => (parseDay(w.date) - last) / 864e5), ys = recent.map(w => w.kg);
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0) || 1;
  const perWeek = (num / den) * 7;
  return { perWeek, pct: (perWeek / my) * 100 };
}

function trendAdvice(tr) {
  if (tr.pct < 0.1) return { text: 'Váha stojí. Pridaj ~150 kcal denne.', delta: 150 };
  if (tr.pct < 0.25) return { text: 'Priberáš pomaly. Pridaj ~100 kcal.', delta: 100 };
  if (tr.pct <= 0.5) return { text: 'Ideálne tempo na svaly. ✓', delta: 0 };
  if (tr.pct <= 0.75) return { text: 'Trochu rýchlo. Uber ~100 kcal.', delta: -100 };
  return { text: 'Príliš rýchlo, pribúda tuk. Uber ~150 kcal.', delta: -150 };
}

function openWeight() {
  const ws = sortedWeights();
  const tr = weightTrend();
  const adv = tr && trendAdvice(tr);
  openSheet('Váha', `
    <div class="row"><input class="input" id="w-kg" type="number" step="0.1" inputmode="decimal" placeholder="kg" value="${ws.at(-1)?.kg ?? S.profile.weight ?? ''}" style="margin:0">
      <button class="btn primary sm" id="w-save">Uložiť</button></div>
    <p class="small muted" style="margin:8px 0 14px">Váž sa ráno po toalete, nalačno.</p>
    ${adv?.delta ? `<button class="btn" id="w-apply" style="margin-bottom:14px">Upraviť cieľ o ${adv.delta > 0 ? '+' : ''}${adv.delta} kcal</button>` : ''}
    ${ws.length ? `<div class="list">${[...ws].reverse().slice(0, 12).map(w => `<div class="list-item">
      <span>${parseDay(w.date).toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric' })}</span>
      <span class="row"><b>${w.kg.toLocaleString('sk-SK')} kg</b><button class="round sm" data-wdel="${w.date}" aria-label="Zmazať">${icon('close', 14, 2.4)}</button></span></div>`).join('')}</div>` : ''}
  `);
  $('#w-save').onclick = () => {
    const kg = Number(String($('#w-kg').value).replace(',', '.'));
    if (!(kg > 20 && kg < 400)) return toast('Zadaj platnú váhu.');
    const d = todayKey();
    S.weights = S.weights.filter(w => w.date !== d);
    S.weights.push({ date: d, kg: r1(kg) });
    S.profile.weight = r1(kg);
    save(); closeSheet(); render(); toast('Váha uložená');
  };
  const ap = $('#w-apply');
  if (ap) ap.onclick = () => {
    S.profile.surplus = Number(S.profile.surplus || 0) + adv.delta;
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
    ${water ? `<button class="btn" data-drink="-250">${icon('minus', 18, 2.4)} Odobrať 250 ml</button>` : ''}
  `);
}

function addWater(ml) {
  S.water[curDate] = Math.max(0, (S.water[curDate] || 0) + ml);
  save(); render(); closeSheet();
  toast(ml > 0 ? `+${ml} ml · spolu ${liters(S.water[curDate])} l` : `Spolu ${liters(S.water[curDate])} l`);
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
- Ak používateľ uvedie čo to je, gramáž, značku alebo spôsob prípravy, má to prednosť pred odhadom. Počítaj aj s olejom/maslom pri príprave.
- Názvy píš po slovensky, krátko (napr. "Ryža biela varená").
- health_score 1–10: 10 = nespracované, výživné potraviny; 5 = bežné; 1 = ultraspracované, veľa cukru, vyprážané.
- note: 1 krátka veta po slovensky – zhodnoť jedlo vzhľadom na cieľ používateľa.
- Ak na fotke nie je jedlo, vráť prázdne items a vysvetli to v note.`;

async function callClaude({ system, content, schema, effort = 'medium' }) {
  const key = getKey();
  if (!key) throw new Error('Chýba API kľúč. Zadaj ho v profile (vpravo hore).');
  const model = S.profile.model || MODELS[0][0];
  const body = {
    model,
    max_tokens: 8000,
    system,
    messages: [{ role: 'user', content }],
    output_config: { effort, format: { type: 'json_schema', schema } },
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
  if (data.stop_reason === 'refusal') throw new Error('AI odmietla odpovedať. Skús znova.');
  if (data.stop_reason === 'max_tokens') throw new Error('Odpoveď bola príliš dlhá. Skús znova.');
  const block = (data.content || []).find(b => b.type === 'text');
  if (!block) throw new Error('Prázdna odpoveď od AI.');
  return JSON.parse(block.text);
}

async function analyzeFood({ image, text }) {
  const t = targets(todayKey());
  const goal = Number(S.profile.surplus) > 0 ? 'priberať svalovú hmotu' : 'udržať váhu';
  const content = [];
  if (image) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } });
  content.push({
    type: 'text',
    text: `Cieľ používateľa: ${goal}${t ? ` (${t.kcal} kcal, ${t.p} g bielkovín denne)` : ''}.\n` +
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

// ---------- Panel (sheet) ----------
let pendingPhoto = null; // { dataUrl, base64, thumb }

function openSheet(title, html) {
  $('#sheet-title').textContent = title;
  $('#sheet-back').hidden = true;
  wiz.back = null;
  $('#sheet-body').innerHTML = html;
  $('#sheet-bg').hidden = false;
}
function closeSheet() {
  $('#sheet-bg').hidden = true;
  $('#sheet-body').innerHTML = '';
  pendingPhoto = null;
}

function recentFoods() {
  const seen = new Set(), out = [];
  for (const e of [...S.entries].sort((a, b) => b.ts - a.ts)) {
    const k = norm(e.name);
    if (seen.has(k) || !e.g) continue;
    seen.add(k);
    out.push(e);
    if (out.length >= 8) break;
  }
  return out;
}

// ---------- Pridať jedlo ----------
function openAdd() {
  const recent = recentFoods();
  openSheet('Pridať jedlo', `
    <button class="btn primary big" data-act="photo">${icon('camera', 26)}Odfotiť jedlo</button>
    <button class="btn" data-act="text" style="margin-top:10px">${icon('pen', 18)}Napísať, čo som jedol</button>
    ${recent.length ? `<h3 class="sub-h">Znova</h3><div class="list">${recent.map(e => `<button class="list-item" data-recent="${e.id}">
      <span>${esc(e.name)}</span><span class="muted small">${r0(e.g)} g · ${r0(e.kcal)} kcal</span></button>`).join('')}</div>` : ''}
  `);
}

function openTextAI() {
  openSheet('Čo si jedol?', `
    <textarea class="input" id="ai-text" placeholder="napr. 200 g kuracích pŕs, 250 g ryže, šalát s olivovým olejom"></textarea>
    <button class="btn primary" id="ai-go" style="margin-top:12px">Vypočítať</button>
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
    showAIResult(await analyzeFood({ image, text }));
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Skúsiť znova';
    toast(err.message || 'Niečo sa pokazilo.');
    if (!getKey()) { closeSheet(); openProfile(); }
  }
}

function showAIResult(res) {
  const items = (res.items || []).map(it => {
    const g = Math.max(1, Number(it.grams) || 1);
    return { name: it.name, g, base: g, kcal: it.kcal, p: it.protein, c: it.carbs, f: it.fat, fib: it.fiber,
      score: Math.min(10, Math.max(1, Math.round(it.health_score || 5))) };
  });
  const thumb = pendingPhoto?.thumb;
  const draw = () => {
    const tot = items.reduce((s, it) => {
      const k = it.g / it.base;
      s.kcal += it.kcal * k; s.p += it.p * k; s.c += it.c * k; s.f += it.f * k;
      return s;
    }, { kcal: 0, p: 0, c: 0, f: 0 });
    openSheet(res.meal_name || 'Výsledok', `
      <div class="ai-sum">
        <div class="grid3">
          <div><b>${r0(tot.kcal)}</b><div class="lbl">kcal</div></div>
          <div><b>${r0(tot.p)} g</b><div class="lbl">bielkoviny</div></div>
          <div><b>${r0(tot.c)}/${r0(tot.f)}</b><div class="lbl">sach./tuky g</div></div>
        </div>
        ${res.note ? `<p class="small" style="margin-top:10px">${esc(res.note)}</p>` : ''}
      </div>
      ${items.map((it, i) => {
        const k = it.g / it.base;
        return `<div class="ai-item"><div class="row">
          <input class="input" data-ai-name="${i}" value="${esc(it.name)}" style="flex:1">
          <input class="input grams" data-ai-g="${i}" type="number" inputmode="decimal" value="${r0(it.g)}" aria-label="gramy">
          <button class="round sm" data-ai-del="${i}" aria-label="Odstrániť">${icon('close', 14, 2.4)}</button></div>
          <div class="small muted" style="margin-top:6px">${r0(it.kcal * k)} kcal · B ${r0(it.p * k)} · S ${r0(it.c * k)} · T ${r0(it.f * k)}
          · <span class="score ${scoreClass(it.score)}">${it.score}</span></div></div>`;
      }).join('')}
      <p class="small muted" style="margin:4px 0 12px">Ak gramy nesedia, prepíš ich – hodnoty sa prepočítajú.</p>
      ${items.length ? '<button class="btn primary" id="ai-save">Uložiť</button>' : '<div class="empty">AI nenašla žiadne jedlo.</div>'}
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

function perGramFromEntry(e) {
  const g = e.g || 1;
  return { kcal: e.kcal / g, p: e.p / g, c: e.c / g, f: e.f / g, fib: (e.fib || 0) / g };
}

function addEntries(list, src) {
  const now = Date.now();
  for (const it of list) {
    const e = { id: uid(), ts: now, date: curDate, src, name: it.name, g: r1(it.g),
      kcal: r1(it.kcal), p: r1(it.p), c: r1(it.c), f: r1(it.f), fib: r1(it.fib), score: it.score };
    if (it.thumb) e.thumb = it.thumb;
    S.entries.push(e);
  }
  save();
  closeSheet();
  render();
  toast(`Pridané: ${list.length === 1 ? list[0].name : list.length + ' položky'}`);
}

// Úprava gramáže / zmazanie / zjesť znova.
function openEntry(id, again = false) {
  const e = S.entries.find(x => x.id === id);
  if (!e) return;
  if (!e.g) {
    openSheet(e.name, `<p class="small muted" style="margin-bottom:14px">1 porcia · ${r0(e.kcal)} kcal · B ${r0(e.p)} g · S ${r0(e.c)} g · T ${r0(e.f)} g</p>
      <button class="btn danger" id="e-del">Zmazať</button>`);
    $('#e-del').onclick = () => { S.entries = S.entries.filter(x => x.id !== id); save(); closeSheet(); render(); toast('Zmazané'); };
    return;
  }
  const per = perGramFromEntry(e);
  openSheet(e.name, `
    <label class="field">Množstvo (g)<input class="input" id="e-g" type="number" inputmode="decimal" value="${r0(e.g)}"></label>
    <p class="small muted" id="e-info" style="margin-bottom:14px"></p>
    ${again ? '<button class="btn primary" id="e-add">Pridať</button>'
      : '<div class="grid2"><button class="btn danger" id="e-del">Zmazať</button><button class="btn primary" id="e-save">Uložiť</button></div>'}
  `);
  const upd = () => {
    const g = Number($('#e-g').value) || 0;
    $('#e-info').textContent = `${r0(per.kcal * g)} kcal · B ${r0(per.p * g)} g · S ${r0(per.c * g)} g · T ${r0(per.f * g)} g · zdravosť ${e.score}/10`;
  };
  $('#e-g').addEventListener('input', upd);
  upd();
  const grams = () => {
    const g = Number($('#e-g').value) || 0;
    if (g <= 0) toast('Zadaj množstvo.');
    return g;
  };
  if (again) {
    $('#e-add').onclick = () => {
      const g = grams();
      if (g) addEntries([{ name: e.name, g, kcal: per.kcal * g, p: per.p * g, c: per.c * g, f: per.f * g, fib: per.fib * g, score: e.score }], 'znova');
    };
    return;
  }
  $('#e-del').onclick = () => {
    S.entries = S.entries.filter(x => x.id !== id);
    save(); closeSheet(); render(); toast('Zmazané');
  };
  $('#e-save').onclick = () => {
    const g = grams();
    if (!g) return;
    Object.assign(e, { g, kcal: r1(per.kcal * g), p: r1(per.p * g), c: r1(per.c * g), f: r1(per.f * g), fib: r1(per.fib * g) });
    save(); closeSheet(); render();
  };
}

// ---------- Profil (vpravo hore) ----------
function openProfile() {
  const p = S.profile;
  const t = targets(todayKey());
  const opt = (val, list) => list.map(([v, l]) => `<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${l}</option>`).join('');
  openSheet('Profil', `
    <form id="profile-form">
      <label class="field">Meno<input name="name" value="${esc(p.name)}" autocomplete="given-name"></label>
      <div class="grid2">
        <label class="field">Pohlavie<select name="sex">${opt(p.sex, [['m', 'Muž'], ['f', 'Žena']])}</select></label>
        <label class="field">Vek<input name="age" type="number" inputmode="numeric" value="${p.age ?? ''}"></label>
        <label class="field">Výška (cm)<input name="height" type="number" inputmode="numeric" value="${p.height ?? ''}"></label>
        <label class="field">Váha (kg)<input name="weight" type="number" step="0.1" inputmode="decimal" value="${currentWeight() ?? ''}"></label>
      </div>
      <label class="field">Pohyb počas týždňa<select name="activity">${opt(p.activity, [
        [1.55, 'Sedavá práca + tréning 3–5×'],
        [1.725, 'Fyzická práca 3–4 dni + tréning/futbal 7×'],
        [1.9, 'Fyzická práca 5 dní + tréning denne'],
      ])}</select></label>
      <label class="field">Cieľ<select name="goal">${opt([0, 250, 350, 500].includes(Number(p.surplus)) ? p.surplus : 'x', [
        [0, 'Udržať váhu'],
        [250, 'Pomalé priberanie (+250 kcal)'],
        [350, 'Priberanie svalov (+350 kcal)'],
        [500, 'Rýchle priberanie (+500 kcal)'],
        ['x', `Vlastné (+${p.surplus} kcal)`],
      ])}</select></label>
      <button class="btn primary">Uložiť</button>
    </form>
    ${t ? `<p class="small muted" style="margin:10px 0 0">Dnešný cieľ ${t.kcal} kcal · bielkoviny ${t.p} g · sacharidy ${t.c} g · tuky ${t.f} g.</p>` : ''}

    <h3 class="sub-h">AI na fotky</h3>
    <input class="input" id="api-key" type="password" autocomplete="off" placeholder="Anthropic API kľúč (sk-ant-…)" value="${esc(getKey())}">
    <select class="input" id="api-model" style="margin-top:8px">${opt(p.model, MODELS)}</select>
    <button class="btn" id="key-save" style="margin-top:8px">Uložiť kľúč</button>
    <p class="small muted" style="margin-top:6px">Kľúč ostáva len v tomto zariadení a posiela sa iba do Anthropic API.</p>

    <h3 class="sub-h">Športová kuchárka</h3>
    <p class="small muted" style="margin-bottom:8px">${BOOK ? `Odomknutá: ${BOOK.recipes.length} receptov.` : 'Zamknutá – odomkneš ju svojím súkromným odkazom.'}</p>
    ${BOOK ? '<button class="btn" data-act="book-lock">Zamknúť kuchárku v tomto zariadení</button>' : ''}

    <h3 class="sub-h">Záloha</h3>
    <div class="grid2"><button class="btn" id="exp">Export</button><button class="btn" id="imp">Import</button></div>
    <button class="btn danger" id="wipe" style="margin-top:10px">Zmazať všetky dáta</button>
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
    save(); closeSheet(); render(); toast('Profil uložený');
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
    S = defaultState(); save(); closeSheet(); render(); toast('Všetko zmazané');
  };
}

// ---------- Udalosti ----------
document.addEventListener('click', ev => {
  const t = ev.target.closest('button');
  if (!t) return;
  const d = t.dataset;
  if (d.act === 'add') openAdd();
  else if (d.act === 'photo') $('#photo-input').click();
  else if (d.act === 'text') openTextAI();
  else if (d.act === 'water') openWater();
  else if (d.act === 'weight') openWeight();
  else if (d.act === 'profile') openProfile();
  else if (d.drink) addWater(Number(d.drink));
  else if (d.entry) openEntry(d.entry);
  else if (d.recent) openEntry(d.recent, true);
  else if (d.act === 'all-recipes') openAllRecipes();
  else if (d.act === 'book-lock') {
    BOOK = null;
    try { localStorage.removeItem(BOOK_KEY); localStorage.removeItem(PASS_KEY); } catch { /* nič */ }
    closeSheet(); render(); toast('Kuchárka zamknutá');
  }
  else if (d.act === 'cook') cookStart();
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
    const from = $('#sheet-title').textContent === 'Všetky recepty' ? null : cookResults;
    openRecipe(d.recipe, from);
  }
  else if (d.eat) eatRecipe(d.eat);
  else if (d.wdel) {
    S.weights = S.weights.filter(w => w.date !== d.wdel);
    save(); render(); openWeight();
  }
});

$('#open-profile').onclick = openProfile;
$('#close-sheet').onclick = closeSheet;
$('#sheet-back').onclick = () => wiz.back?.();
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
    save(); closeSheet(); render(); toast('Záloha načítaná');
  } catch {
    toast('Neplatný súbor zálohy.');
  }
});

// Po polnoci prepni na nový deň, ak appka ostala otvorená.
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

render();
unlockFromUrl().then(refreshBook);
if (!S.profile.age) openProfile();
