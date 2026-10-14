'use strict';

// ---------- Úložisko ----------
const STORE_KEY = 'jedlo.v1';
const KEY_KEY = 'jedlo.apikey';
const BOOK_KEY = 'jedlo.kucharka';
const MODELS = [
  ['claude-opus-5-5', 'Claude Opus 5.5, presnejší (~1-2 centy / fotka)'],
  ['claude-haiku-5-5', 'Claude Haiku 5.5, lacnejší, rýchlejší'],
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

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    const d = defaultState();
    return { ...d, ...s, profile: { ...d.profile, ...s.profile }, lastBackup: s.lastBackup || Date.now() };
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
const esc = s => String(s ?? '').replace(/\s+[\u2013\u2014]\s+/g, ', ').replace(/[\u2013\u2014]/g, '-').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
  barcode: '<path d="M4 6v12M7 6v12M10 6v12M13 6v12M17 6v12M20 6v12"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
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
const DAY_TYPES = [
  ['volno', 'Voľno', 1.35],
  ['posilka', 'Posilňovňa', 1.6],
  ['futbal', 'Futbal', 1.75],
  ['praca', 'Fyzická práca', 1.75],
  ['praca_trening', 'Práca + tréning', 1.95],
];
function sortedWeights() { return [...S.weights].sort((a, b) => a.date.localeCompare(b.date)); }
function currentWeight() { return S.weights.length ? sortedWeights().at(-1).kg : S.profile.weight; }

function targets(date) {
  const p = S.profile;
  const w = currentWeight();
  if (!w || !p.height || !p.age) return null;
  const bmr = 10 * w + 6.25 * p.height - 5 * p.age + (p.sex === 'f' ? -161 : 5);
  // Typ dňa mení výdaj; kalórie z hodiniek majú prednosť (aktívne kcal + 10 % na trávenie).
  const day = S.days?.[date] || {};
  const type = DAY_TYPES.find(d => d[0] === day.type);
  const tdee = day.watch ? (bmr + day.watch) * 1.1 : bmr * (type ? type[2] : p.activity);
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
  return `<div><div class="bar-label"><span>${label}</span><span class="muted">${r0(value)} / ${target ? r0(target) : '-'} ${unit}</span></div>
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
      ? (left > 0 ? `Ešte zjedz <b>${left} kcal</b> a <b>${Math.max(0, t.p - r0(tot.p))} g</b> bielkovín.` : `Cieľ splnený ✓ <span class="muted">(+${-left} kcal)</span>`)
      : 'Pridaj, čo si zjedol.'}</span></div>
    ${t ? `<button class="day-pill" data-act="daytype">${dayTypeLabel(curDate)} ${icon('right', 14, 2.4)}</button>` : ''}
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

  html += suppsCard();

  // Váha
  const ws = sortedWeights();
  const tr = weightTrend();
  html += `<div class="card"><div class="tile">
    <span class="ico weight">${icon('scale')}</span>
    <div class="tile-main"><div class="tile-label">Váha</div>
      <div class="tile-val">${ws.length ? ws.at(-1).kg.toLocaleString('sk-SK') + ' kg' : '-'}
        ${tr ? `<small>${tr.perWeek >= 0 ? '+' : ''}${tr.perWeek.toFixed(2).replace('.', ',')} kg/týždeň</small>` : ''}</div>
      ${tr ? `<div class="small muted">${trendAdvice(tr).text}</div>` : `<div class="small muted">${ws.length ? 'Tempo uvidíš po 7 dňoch vážení.' : 'Zapíš ráno nalačno, 2-3× týždenne.'}</div>`}</div>
    <button class="round" data-act="weight" aria-label="Zapísať váhu">${icon('plus', 20, 2.4)}</button>
  </div></div>`;

  // Záznamy a štatistiky, len keď je čo ukázať
  const items = S.entries.filter(e => e.date === curDate).sort((a, b) => a.ts - b.ts);
  if (items.length) {
    html += `<div class="card"><h3>Záznamy <span class="muted small">${items.length}× · ${tot.score ? `zdravosť <span class="score ${scoreClass(tot.score)}">${r1(tot.score)}</span>` : ''}</span></h3>
      <div class="list">${items.map(e => `<button class="entry" data-entry="${e.id}">
        ${e.thumb ? `<img src="${e.thumb}" alt="">` : ''}
        <div class="info"><div class="name">${esc(e.name)}</div>
          <div class="small muted">${new Date(e.ts).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })} · ${e.g ? r0(e.g) + ' g' : '1 porcia'} · B ${r0(e.p)} g</div></div>
        ${S.profile.glutenFree && e.gluten && e.gluten !== 'nie' ? glutenTag(e.gluten) : ''}
        <span class="score ${scoreClass(e.score)}">${e.score ?? '-'}</span>
        <span class="kc">${r0(e.kcal)}</span></button>`).join('')}</div>
      ${curDate < todayKey() ? '<button class="btn" data-act="copy-day" style="margin-top:12px">Skopírovať tento deň do dneška</button>' : ''}</div>`;
  }
  html += weekStats();
  html += recipesCard();
  html += planCard();
  html += backupCard();

  $('#page').innerHTML = html;
}

// ---------- Typ dňa ----------
function dayTypeLabel(date) {
  const d = S.days?.[date] || {};
  const type = DAY_TYPES.find(x => x[0] === d.type);
  const parts = [type ? type[1] : 'Typ dňa'];
  if (d.watch) parts.push(`hodinky ${r0(d.watch)} kcal`);
  return parts.join(' · ');
}

function openDayType() {
  const d = S.days[curDate] || {};
  openSheet('Aký je deň?', `
    <div class="chips">${DAY_TYPES.map(([k, l]) => `<button class="chip-btn ${d.type === k ? 'on' : ''}" data-dtype="${k}">${l}</button>`).join('')}</div>
    <p class="small muted" style="margin:10px 0 18px">Podľa typu dňa sa zmení cieľ kalórií a sacharidov.</p>
    <label class="field">Aktívne kalórie z hodiniek (nepovinné)
      <input id="watch-kcal" type="number" inputmode="numeric" placeholder="napr. 950" value="${d.watch || ''}"></label>
    <p class="small muted" style="margin:-4px 0 16px">Nájdeš ich v appke Huawei Health. Keď ich zadáš, majú prednosť pred typom dňa.</p>
    <button class="btn primary" data-act="daytype-save">Uložiť</button>`);
}

// ---------- Suplementy ----------
function suppsCard() {
  const list = S.profile.suppList || [];
  if (!list.length) return '';
  const done = S.supps?.[curDate] || [];
  return `<div class="card supps"><div class="tile-label" style="margin-bottom:10px">Suplementy</div>
    <div class="chips">${list.map(n => `<button class="chip-btn ${done.includes(n) ? 'on' : ''}" data-supp="${esc(n)}">${done.includes(n) ? '✓ ' : ''}${esc(n)}</button>`).join('')}</div></div>`;
}

// ---------- Moje jedlá (obľúbené) ----------
function addFav(name, items) {
  S.favs = S.favs || [];
  S.favs.push({ id: uid(), name: name.trim() || 'Moje jedlo', items: items.map(({ thumb, ...it }) => it) });
  save();
  toast('Uložené medzi moje jedlá');
}

function eatFav(id) {
  const f = (S.favs || []).find(x => x.id === id);
  if (f) addEntries(f.items.map(it => ({ ...it })), 'oblubene');
}

// ---------- Kopírovanie dňa ----------
function copyDayToToday() {
  const items = S.entries.filter(e => e.date === curDate);
  const now = Date.now();
  const today = todayKey();
  items.forEach(e => { const { id, thumb, ...rest } = e; S.entries.push({ ...rest, id: uid(), date: today, ts: now }); });
  save();
  curDate = today;
  render();
  toast(`Skopírované: ${items.length} ${items.length === 1 ? 'položka' : items.length < 5 ? 'položky' : 'položiek'}`);
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
// Skóre 0-100: kvalita jedál 40 %, kalórie 25 %, bielkoviny 25 %, vláknina 10 %.
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
  return S.entries.filter(e => e.date === date).map(e => e.id + ':' + e.g).join('|');
}

function dayMeter(date, t, tot) {
  const calc = dayScore(date, t, tot);
  const ai = S.aiDay?.[date];
  const useAi = ai && ai.hash === dayHash(date);
  const score = useAi ? ai.score : calc?.score;
  const pos = score == null ? null : Math.min(97, Math.max(3, score));
  // Ťuknutie na pás = zhodnotenie dňa s AI (ak je čo hodnotiť).
  return `<button class="card meter-card" ${score != null ? 'data-act="ai-day"' : 'disabled'}
      aria-label="${score != null ? `Hodnotenie dňa ${score} zo 100: ${verdict(score)}. Ťukni pre zhodnotenie s AI.` : 'Zatiaľ bez hodnotenia'}">
    <span class="meter">${pos != null ? `<i style="left:${pos}%"><b>${score}</b></i>` : ''}</span>
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
score: celé číslo 0-100 (0 = veľmi nezdravo, 50 = priemer, 100 = výborne). Zohľadni kvalitu potravín, bielkoviny, kalórie vzhľadom na cieľ, vlákninu, zeleninu a rozloženie jedál.${isToday ? ' Deň ešte neskončil, nehodnoť prísne to, čo ešte stihne zjesť.' : ''}
text: jedna krátka veta po slovensky (max. 12 slov), čo je najlepšie alebo čo zlepšiť. Nepoužívaj dlhé pomlčky, namiesto nich píš čiarky.`,
    content: [{ type: 'text', text: `${isToday ? `Je ${new Date().toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}, deň ešte prebieha.` : 'Deň už skončil.'}
Cieľ: ${t ? `${t.kcal} kcal, ${t.p} g bielkovín, ${t.fib} g vlákniny` : 'neznámy'}.
Spolu: ${r0(tot.kcal)} kcal, B ${r0(tot.p)} g, S ${r0(tot.c)} g, T ${r0(tot.f)} g, vláknina ${r0(tot.fib)} g.
Jedlá:\n${list}` }],
    schema: DAY_SCHEMA,
    effort: 'low',
  });
}

async function runDayAI(btn) {
  if (btn.classList.contains('busy')) return;
  btn.classList.add('busy');
  toast('AI hodnotí tvoj deň…');
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
    return `<rect x="${i * bw + bw * 0.2}" y="${H - 16 - h}" width="${bw * 0.6}" height="${Math.max(h, 0)}" rx="5" fill="${ok ? 'var(--green)' : 'var(--orange)'}" opacity="${x.n ? 1 : 0.2}"/>` +
      (th !== null ? `<line x1="${i * bw + bw * 0.1}" x2="${i * bw + bw * 0.9}" y1="${th}" y2="${th}" stroke="var(--text)" stroke-opacity=".45" stroke-width="2" stroke-dasharray="3 3"/>` : '') +
      `<text x="${i * bw + bw / 2}" y="${H - 2}" font-size="11" font-weight="${x.d === curDate ? 600 : 400}" text-anchor="middle" fill="${x.d === curDate ? 'var(--text)' : 'var(--muted)'}">${parseDay(x.d).toLocaleDateString('sk-SK', { weekday: 'short' }).slice(0, 2)}</text>`;
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
  if (id >= 100000) return findRecipe(id)?.img || null;
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
      <p class="small muted" style="margin-bottom:12px">Recepty zo Športovej kuchárky. Odomkneš ich raz, ťukni na svoj súkromný odkaz, alebo ho skopíruj a ťukni sem.</p>
      <button class="btn primary" data-act="unlock-paste">Vložiť odkaz a odomknúť</button></div>`;
  }
  return `<button class="cook-hero" data-act="cook">
      <span><b>Čo si uvarím?</b><span>Raňajky, obed, večera alebo snack, z toho, čo máš doma.</span></span>
      ${icon('right', 22, 2.4)}</button>
    <button class="link-btn" data-act="all-recipes">Všetky recepty (${allRecipes().length}), hľadať alebo pridať z internetu</button>`;
}

// ---------- Strava: bezlepková a alergie ----------
// Lepok: čo v recepte obsahuje lepok a čím to nahradiť. Riadok s „bezlepk…“ sa ignoruje.
const GLUTEN_RULES = [
  [/kypřic|prášk[a-zů]* do pečiva/i, 'bezlepkový prášok do pečiva'],
  [/(?<!rýžov[éáýou]+ |kukuřičn[éáýou]+ |pohankov[éáýou]+ |mandlov[éáýou]+ |kokosov[éáýou]+ |cizrnov[éáýou]+ |bramborov[éáýou]+ |tapiokov[éáýou]+ )mouk/i, 'bezlepková múka (napr. ryžová alebo mix)'],
  [/(?<!rýžov[éáýou]+ |jáhlov[éáýou]+ |pohankov[éáýou]+ |kukuřičn[éáýou]+ )vloč/i, 'certifikované bezlepkové ovsené vločky'],
  [/(?<!kukuřičn[éáýou]+ )tortil|wrap|lavash|\bpit[ay]\b/i, 'kukuričné alebo bezlepkové tortilly'],
  [/piškot|sušenk/i, 'bezlepkové piškoty / sušienky'],
  [/strouhank|krutón/i, 'bezlepková strúhanka'],
  [/chléb|chleb|(?<!do )pečiv|toast|bagel|rohlík|bulk|housk|baget|žeml/i, 'bezlepkový chlieb alebo pečivo'],
  [/těstovin|špaget|penne|(?<!rýžov[éáýou]+ )nudl|lasagn|gnocchi|noky|fleky/i, 'bezlepkové cestoviny / noky'],
  [/bulgur|kuskus|krupic|ječm|kroupy|seitan|špald|pšenič|žitn/i, 'quinoa, pohánka alebo ryža'],
  [/sójov[áé] omáčk|teriyaki|worcester/i, 'tamari (bezlepková sójová omáčka)'],
  [/granol|müsli|cereál/i, 'bezlepková granola'],
  [/\bpiv[oa]\b/i, 'bezlepkové pivo'],
];
const ALLERGENS = [
  ['mlieko', 'Mlieko / laktóza', /mlék|mléč|jogurt|skyr|tvaroh|sýr|cottage|smetan|(?<!arašídov[éého]+ |kešu |mandlov[éého]+ |ořechov[éého]+ )másl|ricott|mozzarel|parmaz|parmez|feta|halloumi|kefír|lučin|mascarpon|bryndz|burrat|ghí|čedar|eidam/i],
  ['vajcia', 'Vajcia', /vejc|vajíč|vajec|vaječ|žloutk|bílk/i],
  ['orechy', 'Orechy', /ořech|ořeš|mandl|kešu|lískov|pistáci|pekan|makadam/i],
  ['arasidy', 'Arašidy', /arašíd/i],
  ['ryby', 'Ryby', /losos|tuňák|tresk|ryb[íay]|sardin|makrel|ančov/i],
  ['korysy', 'Kôrovce (krevety)', /krevet/i],
  ['soja', 'Sója', /sój|tofu|tempeh|edamame/i],
  ['sezam', 'Sezam', /sezam|tahini/i],
  ['zeler', 'Zeler', /celer/i],
  ['horcica', 'Horčica', /hořčic/i],
];

function dietOf(form) {
  return { gf: !!form?.gf, allergens: form?.allergens || [] };
}
function profileDiet() { return dietOf({ gf: S.profile.glutenFree, allergens: S.profile.allergens }); }
function dietActive(d) { return d.gf || d.allergens.length > 0; }

// Analýza receptu pre danú stravu: zámeny pri lepku, nájdené alergény.
const dietCache = new Map();
function recipeDiet(r) {
  if (dietCache.has(r.id)) return dietCache.get(r.id);
  const lines = r.ing.filter(l => !/:$/.test(l));
  const swaps = new Map();
  for (const l of lines) {
    if (/bezlepk/i.test(l)) continue;
    for (const [rx, sw] of GLUTEN_RULES) if (rx.test(l)) { swaps.set(sw, l); break; }
  }
  const text = lines.join(' \n ');
  const allergens = ALLERGENS.filter(([, , rx]) => rx.test(text)).map(([k]) => k);
  const out = { swaps: [...swaps.entries()].map(([sw, l]) => ({ from: l, to: sw })), allergens };
  dietCache.set(r.id, out);
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
  return [d.gf && 'bez lepku', ...d.allergens.map(a => 'bez: ' + ALLERGENS.find(x => x[0] === a)?.[1].toLowerCase())].filter(Boolean).join(', ');
}

// ---------- Recepty: všetky zdroje, porcie, hodnotenie, varenie ----------
// Vlastné recepty (z internetu) sú uložené len v tomto zariadení, id od 100000.
function allRecipes() { return [...(BOOK?.recipes || []), ...(S.myRecipes || [])]; }
function findRecipe(id) { return allRecipes().find(x => x.id === Number(id)); }
function rmeta(id) { return S.recipeMeta?.[id] || {}; }

// Prepočet suroviny na 1 porciu: čísla na začiatku riadku, po „/“ a v zátvorke.
const FRAC = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
const QTY_RX = /(^|\/\s*|\()(\d+(?:[.,]\d+)?|\d+\/\d+|[½¼¾⅓⅔])(?:\s*[–-]\s*(\d+(?:[.,]\d+)?))?(\s*)(kg|g|ml|dl|l|ks|PL|KL|lžičk\w*|lžič\w*|lžíc\w*|lyžičk\w*|lyžic\w*|hrst\w*|plát\w*|stroužk\w*|strúčik\w*|špetk\w*|kous\w*|kus\w*|baleni\w*|balení|konzerv\w*|plechovk\w*)?(?=[\s,).]|$)/g;
function parseQ(x) {
  if (FRAC[x] != null) return FRAC[x];
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
    return `${pre}${fmtQ(x * factor, unit)}${y != null ? '-' + fmtQ(y * factor, unit) : ''}${sp}${unit}`;
  });
}
function recipeIng(r) {
  const f = r.portions > 1 ? 1 / r.portions : 1;
  return r.ing.map(l => scaleLine(l, f)).filter(l => !/^(Na|na) \d+ porc|^Recept na \d/.test(l));
}

function starsHtml(id, rating) {
  return `<span class="stars">${[1, 2, 3, 4, 5].map(n => `<button class="star ${n <= (rating || 0) ? 'on' : ''}" data-rate="${id}" data-n="${n}" aria-label="${n} z 5">${icon('star', 22, 1.8)}</button>`).join('')}</span>`;
}

// Režim varenia: veľké písmo, krok po kroku, obrazovka nezhasne.
let cookState = null;
async function startCooking(id) {
  const r = findRecipe(id);
  if (!r) return;
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
      ? `<div class="cm-step"><div class="cm-n">Suroviny na 1 porciu</div><div class="cm-ing">${recipeIng(r).map(l => /:$/.test(l) ? `<p class="ing-h">${esc(l.slice(0, -1))}</p>` : `<p>${esc(l)}</p>`).join('')}</div></div>`
      : `<div class="cm-step"><div class="cm-n">Krok ${i + 1} z ${n}</div><p class="cm-text">${esc(r.steps[i])}</p>
        ${r.portions > 1 ? `<p class="small muted">Postup je z receptu na ${r.portions} porcie, množstvá ber zo surovín.</p>` : ''}</div>`}
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
    steps: { type: 'array', items: { type: 'string' } },
    kcal: { type: 'number' }, p: { type: 'number' }, c: { type: 'number' }, f: { type: 'number' }, fib: { type: 'number' },
    tags: { type: 'array', items: { type: 'string' } },
    image_url: { type: 'string' },
  },
  required: ['title', 'cat', 'time', 'ing', 'steps', 'kcal', 'p', 'c', 'f', 'fib', 'tags', 'image_url'],
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
      system: `Z receptu sprav recept do appky. Všetko po slovensky. Suroviny a makrá prepočítaj na 1 porciu pre jedného športovca (jedno jedlo). ing: jedna surovina na riadok s množstvom. steps: kroky bez číslovania.
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
      kcal: r.kcal, p: r.p, c: r.c, f: r.f, fib: r.fib, ing: r.ing, steps: r.steps, req: (r.tags || []).map(t => [t]), img: r.image_url || '', photo: !!r.image_url });
    save();
    toast('Recept pridaný');
    openRecipe(id, openAllRecipes);
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
  return allRecipes().filter(r => cats.includes(r.cat));
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
  const d = profileDiet();
  const gfPenalty = m => (d.gf ? recipeDiet(m.r).swaps.length : 0) - (rmeta(m.r.id).fav ? 3 : 0) - ((rmeta(m.r.id).rating || 3) - 3);
  const list = mealRecipes().filter(r => fitsDiet(r, d) && !(rmeta(r.id).rating <= 1)).map(r => matchRecipe(r, have));
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

function recipeCard(m, showMiss) {
  const r = m.r;
  return `<button class="rcard" data-recipe="${r.id}">
    <span class="photo"><img data-photo="${r.id}" alt=""></span>
    <span class="rinfo"><b>${rmeta(r.id).fav ? '<span class="fav-dot">♥</span> ' : ''}${esc(r.title)}</b>
      ${rmeta(r.id).rating ? `<span class="rating">${'★'.repeat(rmeta(r.id).rating)}<span class="muted">${'★'.repeat(5 - rmeta(r.id).rating)}</span></span>` : ''}
      <span class="small muted">${[r.time && r.time + ' min', r.kcal && r0(r.kcal) + ' kcal', r.p && 'B ' + r0(r.p) + ' g'].filter(Boolean).join(' · ')}</span>
      ${showMiss ? (m.missing.length ? `<span class="miss">Chýba: ${m.missing.map(a => chipLabel(a[0])).join(', ')}</span>` : '<span class="ok">Máš všetko</span>') : ''}
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

function openRecipe(id, back = null) {
  const r = findRecipe(id);
  if (!r) return;
  const have = new Set(S.fridge);
  if ($('#sheet-bg').hidden) openSheet('', '');
  wizHead(r.title, back);
  const meta = [r.time && r.time + ' min' + (r.extra ? ' ' + r.extra : ''), r.diff, r.prep && 'Meal prep', r.mine && 'môj recept'].filter(Boolean).join(' · ');
  const m = rmeta(r.id);
  const miss = have.size ? matchRecipe(r, have).missing : [];
  $('#sheet-body').innerHTML = `
    <div class="photo big"><img data-photo="${r.id}" alt="${esc(r.title)}"></div>
    <div class="rate-row"><button class="round fav-btn ${m.fav ? 'on' : ''}" data-rfav="${r.id}" aria-label="Obľúbený">${icon('heart', 20, 2)}</button>${starsHtml(r.id, m.rating)}</div>
    <input class="input" id="r-note" placeholder="Moja poznámka (napr. viac soli, menej ryže)" value="${esc(m.note || '')}" style="margin-bottom:10px">
    ${meta ? `<p class="small muted" style="margin:0 0 12px">${esc(meta)}</p>` : ''}
    ${r.kcal ? `<div class="ai-sum"><div class="grid3">
      <div><b>${r0(r.kcal)}</b><div class="lbl">kcal / porcia</div></div>
      <div><b>${r0(r.p)} g</b><div class="lbl">bielkoviny</div></div>
      <div><b>${r0(r.c)}/${r0(r.f)}</b><div class="lbl">sach./tuky g</div></div></div></div>` : ''}
    <h3 class="sub-h" style="margin-top:4px">Suroviny na 1 porciu${r.portions > 1 ? ` <span>(recept bol na ${r.portions})</span>` : ''}</h3>
    <div class="ing">${recipeIng(r).map(l => /:$/.test(l) ? `<p class="ing-h">${esc(l.slice(0, -1))}</p>` : `<p>${esc(l)}</p>`).join('')}</div>
    <button class="btn" data-cook-mode="${r.id}" style="margin-top:14px">Variť krok po kroku</button>
    ${miss.length ? `<p class="miss" style="margin-top:8px">Chýba ti: ${miss.map(a => chipLabel(a[0])).join(', ')}</p>` : ''}
    ${recipeDietBox(r, back === showPlan && S.mealPlan ? dietOf(S.mealPlan.form) : profileDiet())}
    <h3 class="sub-h">Postup</h3>
    <ol class="steps">${r.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
    ${r.kcal ? `<button class="btn primary" data-eat="${r.id}" style="margin-top:16px">Zjedol som 1 porciu</button>` : ''}`;
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
  ['sladke', 'Sladké', r => /čokol|banán|lívan|palačin|kaše|brownie|koláč|muffin|smoothie|overnight|dezert|tiramisu|perník|buchta|bábovk|vafle|mugcake/i.test(r.title)],
  ['kuracie', 'Kuracie', r => r.req.some(a => a.includes('kuracie'))],
  ['hovadzie', 'Hovädzie', r => r.req.some(a => a.includes('hovadzie'))],
  ['ryby', 'Ryby', r => r.req.some(a => a.some(x => ['losos', 'tuniak', 'ryba', 'krevety'].includes(x)))],
  ['cestoviny', 'Cestoviny', r => r.req.some(a => a.includes('cestoviny'))],
  ['ryza', 'Ryža', r => r.req.some(a => a.includes('ryza'))],
  ['bezmasa', 'Bez mäsa', r => !r.req.some(a => a.some(x => ['kuracie', 'morcacie', 'hovadzie', 'bravcove', 'sunka', 'losos', 'tuniak', 'ryba', 'krevety'].includes(x)))],
  ['rychle', 'Rýchle (do 20 min)', r => r.time && r.time <= 20],
  ['mealprep', 'Meal prep', r => r.prep],
];
const planForm = { days: 3, meals: ['ranajky', 'obed', 'vecera'], people: 1, budget: 30, prefs: [], wish: '', gf: null, allergens: null };

function planCard() {
  const p = S.mealPlan;
  const sub = p
    ? `${p.form.days} ${p.form.days < 5 ? 'dni' : 'dní'} · ${p.form.people} ${p.form.people === 1 ? 'osoba' : p.form.people < 5 ? 'osoby' : 'osôb'} · odhad ${eur(p.result.total_best)} z ${eur(p.form.budget)}`
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
    <div class="chips"><button class="chip-btn ${planForm.gf ? 'on' : ''}" data-pdiet="gf">Bezlepkové</button>${ALLERGENS.map(([k, l]) =>
      `<button class="chip-btn ${planForm.allergens.includes(k) ? 'on' : ''}" data-pall="${k}">Bez: ${l.toLowerCase()}</button>`).join('')}</div>
    <h3 class="sub-h">Rozpočet na celý nákup</h3>
    <div class="row"><input class="input" id="plan-budget" type="number" inputmode="decimal" min="1" value="${planForm.budget}" style="flex:1"><span class="muted">€</span></div>
    <h3 class="sub-h">Na čo máš chuť</h3>
    <div class="chips">${PLAN_PREFS.map(([k, l]) => `<button class="chip-btn ${planForm.prefs.includes(k) ? 'on' : ''}" data-pp="${k}">${l}</button>`).join('')}</div>
    <input class="input" id="plan-wish" placeholder="Niečo navyše? napr. bez húb, veľa ovocia" value="${esc(planForm.wish)}" style="margin-top:10px">
    <button class="btn" data-act="receipt" style="margin-top:14px">${icon('receipt', 18)}Odfotiť bloček (skutočné ceny)</button>
    <div class="sticky-cta"><button class="btn primary" data-act="plan-go">Poskladať plán a nákup</button></div>`;
  $('#plan-budget').addEventListener('input', e => { planForm.budget = Number(e.target.value) || 0; });
  $('#plan-wish').addEventListener('input', e => { planForm.wish = e.target.value; });
}

function planCandidates() {
  const picked = new Map();
  const prefs = PLAN_PREFS.filter(([k]) => planForm.prefs.includes(k));
  for (const [k, , cats] of PLAN_MEALS) {
    if (!planForm.meals.includes(k)) continue;
    const d = dietOf(planForm);
    const pool = allRecipes().filter(r => cats.includes(r.cat) && r.kcal && fitsDiet(r, d) && !(rmeta(r.id).rating <= 2))
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
        note: { type: 'string' },
      }, required: ['meal', 'recipe_id', 'note'], additionalProperties: false } },
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
  const res = await callClaude({
    system: `Si plánovač jedál a nákupov pre športovca na Slovensku, ktorý chce nabrať svaly. Recepty sú z českej Športovej kuchárky.
Pravidlá plánu:
- Použi IBA recepty zo zoznamu (recipe_id). Každý deň naplánuj presne zvolené jedlá.
- To isté jedlo smie byť najviac 2 dni po sebe (uvarí sa raz, zje sa 2×), nikdy 3×. Obed a večera v ten istý deň nech sú rôzne.
- Recepty [obľúbené] a s vysokým hodnotením zaraď častejšie. Množstvá v receptoch sú pôvodne na viac porcií, v nákupe počítaj 1 porciu na osobu a jedlo.
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
${t ? `Denný cieľ používateľa: ${t.kcal} kcal, ${t.p} g bielkovín.` : ''}
Strava: ${dietActive(d) ? dietSummary(d) : 'bez obmedzení'}.
Preferencie: ${prefs || 'žiadne'}${f.wish ? `. Navyše: ${f.wish}` : ''}.
Doma už má: ${S.fridge.length ? S.fridge.map(chipLabel).join(', ') : 'nič nezadané'}.${knownPrices()}

Recepty na výber:
${cands.map(line).join('\n')}` }],
    schema: PLAN_SCHEMA,
    effort: 'medium',
    maxTokens: 20000,
  });
  const ids = new Set(allRecipes().map(r => r.id));
  res.days = (res.days || []).map(d => ({ ...d, meals: d.meals.filter(m => ids.has(m.recipe_id)) }));
  res.shopping = (res.shopping || []).map(it => ({ ...it, done: false }));
  const sum = k => res.shopping.reduce((s, it) => s + (Number(it[k]) || 0), 0);
  res.total_kaufland = sum('kaufland');
  res.total_jednota = sum('jednota');
  res.total_best = res.shopping.reduce((s, it) => s + Math.min(Number(it.kaufland) || 0, Number(it.jednota) || 0), 0);
  return { form: f, result: res, ts: Date.now() };
}

async function runPlan(btn) {
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Skladám plán… (do minúty)';
  try {
    S.mealPlan = await generatePlan();
    save();
    render();
    showPlan();
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
    wizHead('Bloček uložený', S.mealPlan ? showPlan : null);
    const storeName = { kaufland: 'Kaufland', jednota: 'Jednota', ine: 'Iný obchod' }[r.store];
    $('#sheet-body').innerHTML = `<p class="small muted" style="margin-bottom:10px">${storeName} · ${parseDay(date).toLocaleDateString('sk-SK')} · ${fresh.length} položiek. Plán nákupu ich použije namiesto odhadu.</p>
      <div class="list">${fresh.map(x => `<div class="list-item"><span>${esc(x.name)} <span class="muted small">${esc(x.amount)}</span></span><b>${eur(x.price)}</b></div>`).join('')}</div>`;
  } catch (err) {
    toast(err.message);
    closeSheet();
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
  const over = r.total_best > f.budget;
  const dsum = dietActive(dietOf(f)) ? `<p class="small muted" style="margin:-4px 0 12px">Strava: ${dietSummary(dietOf(f))}</p>` : '';
  const mealLabel = k => PLAN_MEALS.find(m => m[0] === k)?.[1] || k;
  const title = id => findRecipe(id)?.title || 'Recept';
  const cheaper = it => (Number(it.kaufland) || 0) <= (Number(it.jednota) || 0) ? 'kaufland' : 'jednota';
  const tabs = `<div class="seg"><button data-ptab="plan" class="${planTab === 'plan' ? 'on' : ''}">Jedlá</button><button data-ptab="shop" class="${planTab === 'shop' ? 'on' : ''}">Nákup</button></div>`;
  const head = `<div class="ai-sum"><div class="grid3">
      <div><b>${eur(r.total_best)}</b><div class="lbl">najlacnejšie</div></div>
      <div><b>${eur(f.budget)}</b><div class="lbl">rozpočet</div></div>
      <div><b class="${over ? 'bad' : 'good'}">${over ? '−' + eur(r.total_best - f.budget) : eur(f.budget - r.total_best)}</b><div class="lbl">${over ? 'nad rozpočet' : 'ostáva'}</div></div></div>
      ${r.summary ? `<p class="small" style="margin-top:10px">${esc(r.summary)}</p>` : ''}</div>`;
  let body;
  if (planTab === 'plan') {
    body = r.days.map(d => `<h3 class="sub-h">Deň ${d.day}</h3><div class="list">${d.meals.map(m => `
      <button class="entry" data-plan-recipe="${m.recipe_id}"><div class="info"><div class="small muted">${mealLabel(m.meal)}</div>
        <div class="name">${esc(title(m.recipe_id))}</div>${m.note ? `<div class="small muted">${esc(m.note)}</div>` : ''}</div>${icon('right', 16, 2.2)}</button>`).join('')}</div>`).join('');
  } else {
    const items = r.shopping.map((it, i) => ({ it, i, best: cheaper(it) }));
    const group = store => items.filter(x => x.best === store);
    const row = ({ it, i, best }) => `<button class="shop-item ${it.done ? 'done' : ''}" data-shop="${i}">
        <span class="check">${it.done ? icon('check', 14, 3) : ''}</span>
        <span class="info"><span class="name">${esc(it.item)}</span><span class="small muted">${esc(it.amount)}</span></span>
        <span class="prices"><b>${eur(it[best])}</b><span class="small muted">${best === 'kaufland' ? 'Jednota' : 'Kaufland'} ${eur(it[best === 'kaufland' ? 'jednota' : 'kaufland'])}</span></span></button>`;
    body = [['kaufland', 'Kaufland'], ['jednota', 'Jednota']].map(([k, l]) => group(k).length
      ? `<h3 class="sub-h">${l} <span>· ${eur(group(k).reduce((s, x) => s + (Number(x.it[k]) || 0), 0))}</span></h3><div class="list">${group(k).map(row).join('')}</div>` : '').join('')
      + `<p class="small muted" style="margin-top:14px">Všetko v Kauflande: ${eur(r.total_kaufland)} · všetko v Jednote: ${eur(r.total_jednota)}.<br>Ceny sú odhad podľa bežných cien, nie z aktuálneho letáku.</p>`
      + (r.pantry?.length ? `<h3 class="sub-h">Asi máš doma</h3><p class="small muted">${r.pantry.map(esc).join(', ')}</p>` : '');
  }
  $('#sheet-body').innerHTML = dsum + head + tabs + body + `<button class="btn" data-act="plan-new" style="margin-top:20px">Nový plán</button>
    <button class="btn" data-act="receipt" style="margin-top:10px">${icon('receipt', 18)}Odfotiť bloček (skutočné ceny)</button>
    ${S.prices?.length ? `<p class="small muted" style="margin-top:8px;text-align:center">Uložené ceny z bločkov: ${S.prices.length}</p>` : ''}`;
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

function eatRecipe(id) {
  const r = findRecipe(id);
  if (!r?.kcal) return;
  addEntries([{ name: r.title, g: 0, kcal: r.kcal, p: r.p, c: r.c, f: r.f, fib: r.fib || 0, score: 8 }], 'kucharka');
}

let onlyFav = false;
function openAllRecipes() {
  openSheet('', '');
  wizHead('Všetky recepty', null);
  const cats = BOOK.cats.filter(c => allRecipes().some(r => r.cat === c.id));
  $('#sheet-body').innerHTML = `
    <button class="btn" data-act="add-recipe" style="margin-bottom:10px">${icon('link', 18)}Pridať recept z internetu</button>
    <input class="input" id="recipe-q" type="search" placeholder="Hľadať (napr. kuracie, kaša, losos)" autocomplete="off">
    <div class="chips" style="margin-top:10px"><button class="chip-btn ${onlyFav ? 'on' : ''}" data-act="only-fav">♥ Len obľúbené</button></div>
    <div id="recipe-results" style="margin-top:6px"></div>`;
  const draw = () => {
    const nq = norm($('#recipe-q').value.trim());
    const hit = r => (!nq || norm(r.title + ' ' + r.ing.join(' ')).includes(nq)) && (!onlyFav || rmeta(r.id).fav);
    $('#recipe-results').innerHTML = cats.map(c => {
      const rs = allRecipes().filter(r => r.cat === c.id && hit(r) && fitsDiet(r, profileDiet()));
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
  return 'Ideš dobre, drž to. 💪';
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
  if (data.stop_reason === 'pause_turn') throw new Error('AI to nestihla, skús znova.');
  const block = (data.content || []).filter(b => b.type === 'text').at(-1);
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
  openSheet('Skenovať obal', `
    <div class="scan-view"><video id="scan-video" playsinline muted></video><span class="scan-frame"></span></div>
    <p class="small muted" style="margin:8px 0 12px">Namier kameru na čiarový kód na obale.</p>
    <div class="row"><input class="input" id="scan-code" inputmode="numeric" placeholder="alebo zadaj číslo kódu" style="flex:1">
      <button class="btn sm primary" data-act="scan-code">Hľadať</button></div>
    <button class="btn" data-act="scan-photo" style="margin-top:10px">${icon('camera', 18)}Odfotiť čiarový kód</button>
    ${recent.length ? `<h3 class="sub-h">Naposledy</h3><div class="list">${recent.map(x => `<button class="list-item" data-scan="${x.code}">
      <span>${esc(x.name)}</span><span class="score ${x.score >= 65 ? 's-good' : x.score >= 40 ? 's-mid' : 's-bad'}">${x.score}</span></button>`).join('')}</div>` : ''}`);
  try {
    await loadZxing();
    if ($('#sheet-bg').hidden || !$('#scan-video')) return;
    zxingReader = new ZXing.BrowserMultiFormatReader(zxHints());
    await zxingReader.decodeFromConstraints({ video: { facingMode: 'environment' } }, $('#scan-video'), result => {
      if (!result) return;
      const code = result.getText();
      stopScanner();
      navigator.vibrate?.(40);
      lookupProduct(code);
    });
  } catch (err) {
    const v = $('.scan-view');
    if (v) v.innerHTML = '<div class="empty">Kamera nie je dostupná. Odfoť kód alebo zadaj číslo.</div>';
  }
}

async function scanFromPhoto(file) {
  try {
    await loadZxing();
    const url = URL.createObjectURL(file);
    const reader = new ZXing.BrowserMultiFormatReader(zxHints());
    const res = await reader.decodeFromImageUrl(url);
    URL.revokeObjectURL(url);
    lookupProduct(res.getText());
  } catch {
    toast('Kód sa nepodarilo prečítať. Skús ostrejšiu fotku alebo zadaj číslo.');
  }
}

async function lookupProduct(code) {
  stopScanner();
  code = String(code).replace(/\D/g, '');
  if (code.length < 8) return toast('Neplatný čiarový kód.');
  openSheet('Hľadám…', '<div class="empty">Hľadám výrobok v databáze…</div>');
  try {
    const fields = 'product_name,product_name_sk,product_name_cs,brands,ingredients_text_sk,ingredients_text_cs,ingredients_text,additives_tags,nutriscore_grade,nova_group,allergens_tags,traces_tags,nutriments,image_front_small_url,quantity';
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields}`);
    const data = await res.json();
    if (data.status !== 1 || !data.product) return productNotFound(code);
    showProduct(code, data.product);
  } catch {
    toast('Databáza nie je dostupná. Skús to neskôr.');
    closeSheet();
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
  const allergens = [...new Set((p.allergens_tags || []).map(t => OFF_ALLERGENS[t]).filter(Boolean))];
  const traces = [...new Set((p.traces_tags || []).map(t => OFF_ALLERGENS[t] || (t === 'en:gluten' ? 'lepok' : null)).filter(Boolean))];
  const gluten = (p.allergens_tags || []).includes('en:gluten');
  return { ingr, adds, flags, allergens, traces, gluten, score: Math.max(0, Math.min(100, Math.round(score))) };
}

function productVerdict(score) {
  if (score >= 75) return 'Dobrá voľba';
  if (score >= 55) return 'V poriadku';
  if (score >= 35) return 'Radšej občas';
  return 'Nevhodné';
}

let lastProduct = null;
function showProduct(code, p) {
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
    <div class="card meter-card" style="padding:30px 0 4px;background:none">
      <span class="meter"><i style="left:${Math.min(97, Math.max(3, a.score))}%"><b>${a.score}</b></i></span>
      <span class="meter-ends"><span>Nezdravé</span><span>Zdravé</span></span></div>
    <p style="margin:6px 0 14px"><b>${productVerdict(a.score)}</b> · Nutri-Score ${p.nutriscore_grade ? p.nutriscore_grade.toUpperCase() : '-'} · ${p.nova_group ? `spracovanie ${p.nova_group}/4${p.nova_group === 4 ? ' (ultraspracované)' : ''}` : 'spracovanie neznáme'}</p>
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
score: 0-100 (0 = veľmi nezdravé, 100 = výborné). verdict: 1-2 vety po slovensky. good a bad: krátke body po slovensky (max. 4 každé), pri prídavných látkach uveď možný účinok.
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
    if (image) {
      wizHead(r.product_name || 'Výrobok', null);
      $('#sheet-body').innerHTML = `<div class="card meter-card" style="padding:30px 0 4px;background:none">
        <span class="meter"><i style="left:${Math.min(97, Math.max(3, r.score))}%"><b>${r.score}</b></i></span>
        <span class="meter-ends"><span>Nezdravé</span><span>Zdravé</span></span></div><div id="product-ai"></div>
        ${r.ingredients ? `<h3 class="sub-h">Zloženie</h3><p class="small">${esc(r.ingredients)}</p>` : ''}`;
    } else btn.remove();
    $('#product-ai').innerHTML = `<div class="diet-box ${r.score >= 55 ? 'ok' : r.score >= 35 ? '' : 'bad'}"><b>AI: ${productVerdict(r.score)} (${r.score})</b><p>${esc(r.verdict)}</p>
      ${r.good.length ? `<p><b>Dobré:</b> ${r.good.map(esc).join(', ')}</p>` : ''}
      ${r.bad.length ? `<p><b>Zlé:</b> ${r.bad.map(esc).join(', ')}</p>` : ''}
      ${d.gf && r.gluten !== 'nie' ? `<p><b>Lepok:</b> ${r.gluten === 'ano' ? 'obsahuje' : 'možno obsahuje'}</p>` : ''}</div>`;
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Skúsiť znova';
    toast(err.message);
  }
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
  stopScanner();
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
let favEdit = false;
function openAdd() {
  const recent = recentFoods();
  const favs = S.favs || [];
  openSheet('Pridať jedlo', `
    <button class="btn primary big" data-act="photo">${icon('camera', 26)}Odfotiť jedlo</button>
    <div class="grid2" style="margin-top:10px">
      <button class="btn" data-act="text">${icon('mic', 18)}Nadiktovať</button>
      <button class="btn" data-act="scan">${icon('barcode', 18)}Skenovať obal</button>
    </div>
    ${favs.length ? `<h3 class="sub-h" style="display:flex;justify-content:space-between">Moje jedlá <button class="link-btn small" data-act="fav-edit">${favEdit ? 'Hotovo' : 'Upraviť'}</button></h3>
      <div class="chips">${favs.map(f => favEdit
        ? `<button class="chip-btn del" data-fav-del="${f.id}">${icon('close', 12, 2.6)} ${esc(f.name)}</button>`
        : `<button class="chip-btn" data-fav="${f.id}">${esc(f.name)} <span class="muted">${r0(f.items.reduce((s, i) => s + i.kcal, 0))}</span></button>`).join('')}</div>` : ''}
    ${recent.length ? `<h3 class="sub-h">Znova</h3><div class="list">${recent.map(e => `<button class="list-item" data-recent="${e.id}">
      <span>${esc(e.name)}</span><span class="muted small">${r0(e.g)} g · ${r0(e.kcal)} kcal</span></button>`).join('')}</div>` : ''}
  `);
}

const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
function openTextAI() {
  openSheet('Čo si jedol?', `
    <textarea class="input" id="ai-text" placeholder="napr. dal som si 3 vajcia, 2 krajce chleba a pohár mlieka"></textarea>
    ${SpeechRec ? `<button class="btn" id="mic" style="margin-top:10px">${icon('mic', 18)}Hovor</button>`
      : '<p class="small muted" style="margin-top:8px">Ťukni na mikrofón na klávesnici a nadiktuj.</p>'}
    <button class="btn primary" id="ai-go" style="margin-top:10px">Vypočítať</button>
  `);
  $('#ai-text').focus();
  if (SpeechRec) $('#mic').onclick = () => {
    const rec = new SpeechRec();
    rec.lang = 'sk-SK';
    rec.interimResults = true;
    const base = $('#ai-text').value ? $('#ai-text').value + ' ' : '';
    rec.onresult = ev => { $('#ai-text').value = base + [...ev.results].map(r => r[0].transcript).join(' '); };
    rec.onend = () => { $('#mic').classList.remove('rec'); $('#mic').lastChild.textContent = 'Hovor'; };
    rec.onerror = () => toast('Diktovanie nefunguje, použi mikrofón na klávesnici.');
    $('#mic').classList.add('rec');
    $('#mic').lastChild.textContent = 'Počúvam…';
    rec.start();
  };
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

let saveAsFav = false;
function showAIResult(res) {
  saveAsFav = false;
  const items = (res.items || []).map(it => {
    const g = Math.max(1, Number(it.grams) || 1);
    return { name: it.name, g, base: g, kcal: it.kcal, p: it.protein, c: it.carbs, f: it.fat, fib: it.fiber,
      score: Math.min(10, Math.max(1, Math.round(it.health_score || 5))), gluten: it.gluten || 'mozno', allergens: it.allergens || [] };
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
        ${res.description ? `<p class="small muted" style="margin-top:6px">${esc(res.description)}</p>` : ''}
      </div>
      ${photoDietBox(items)}
      ${items.map((it, i) => {
        const k = it.g / it.base;
        return `<div class="ai-item"><div class="row">
          <input class="input" data-ai-name="${i}" value="${esc(it.name)}" style="flex:1">
          <input class="input grams" data-ai-g="${i}" type="number" inputmode="decimal" value="${r0(it.g)}" aria-label="gramy">
          <button class="round sm" data-ai-del="${i}" aria-label="Odstrániť">${icon('close', 14, 2.4)}</button></div>
          <div class="small muted" style="margin-top:6px">${r0(it.kcal * k)} kcal · B ${r0(it.p * k)} · S ${r0(it.c * k)} · T ${r0(it.f * k)}
          · <span class="score ${scoreClass(it.score)}">${it.score}</span> ${glutenTag(it.gluten)}</div></div>`;
      }).join('')}
      <p class="small muted" style="margin:4px 0 12px">Ak gramy nesedia, prepíš ich, hodnoty sa prepočítajú.</p>
      ${items.length ? `<button class="chip-btn ${saveAsFav ? 'on' : ''}" id="ai-fav" style="margin-bottom:12px">${saveAsFav ? '✓ ' : ''}Pridať aj medzi moje jedlá</button>
        <button class="btn primary" id="ai-save">Uložiť</button>` : '<div class="empty">AI nenašla žiadne jedlo.</div>'}
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
    const favBtn = $('#ai-fav');
    if (favBtn) favBtn.onclick = () => { saveAsFav = !saveAsFav; draw(); };
    const saveBtn = $('#ai-save');
    if (saveBtn) saveBtn.onclick = () => {
      const out = items.filter(it => it.g > 0).map((it, i) => {
        const k = it.g / it.base;
        return { name: it.name.trim() || 'Jedlo', g: it.g, kcal: it.kcal * k, p: it.p * k, c: it.c * k, f: it.f * k,
          fib: it.fib * k, score: it.score, gluten: it.gluten, allergens: it.allergens, thumb: i === 0 ? thumb : undefined };
      });
      if (saveAsFav) addFav(res.meal_name || out[0]?.name || 'Moje jedlo', out);
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
    if (it.gluten) e.gluten = it.gluten;
    if (it.allergens?.length) e.allergens = it.allergens;
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
      : `<div class="grid2"><button class="btn danger" id="e-del">Zmazať</button><button class="btn primary" id="e-save">Uložiť</button></div>
        <button class="btn" id="e-fav" style="margin-top:10px">Pridať medzi moje jedlá</button>`}
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
  $('#e-fav').onclick = () => { const { id: _, ts, date, thumb, ...it } = e; addFav(e.name, [it]); closeSheet(); };
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
        [1.55, 'Sedavá práca + tréning 3-5×'],
        [1.725, 'Fyzická práca 3-4 dni + tréning/futbal 7×'],
        [1.9, 'Fyzická práca 5 dní + tréning denne'],
      ])}</select></label>
      <label class="field">Cieľ<select name="goal">${opt([0, 250, 350, 500].includes(Number(p.surplus)) ? p.surplus : 'x', [
        [0, 'Udržať váhu'],
        [250, 'Pomalé priberanie (+250 kcal)'],
        [350, 'Priberanie svalov (+350 kcal)'],
        [500, 'Rýchle priberanie (+500 kcal)'],
        ['x', `Vlastné (+${p.surplus} kcal)`],
      ])}</select></label>
      <label class="field">Suplementy (oddeľ čiarkou)<input name="supps" value="${esc((p.suppList || []).join(', '))}" placeholder="Omega-3, Magnézium, Kreatín"></label>
      <h3 class="sub-h">Strava</h3>
      <div class="chips"><button type="button" class="chip-btn ${p.glutenFree ? 'on' : ''}" data-pgf="1">Bezlepková (celiakia)</button>${ALLERGENS.map(([k, l]) =>
        `<button type="button" class="chip-btn ${(p.allergens || []).includes(k) ? 'on' : ''}" data-pal="${k}">Alergia: ${l.toLowerCase()}</button>`).join('')}</div>
      <p class="small muted" style="margin:8px 0 14px">Recepty s alergénom sa nezobrazia. Pri lepku ukážem bezlepkovú úpravu receptu.</p>
      <button class="btn primary">Uložiť</button>
    </form>
    ${t ? `<p class="small muted" style="margin:10px 0 0">Dnešný cieľ ${t.kcal} kcal · bielkoviny ${t.p} g · sacharidy ${t.c} g · tuky ${t.f} g.</p>` : ''}

    <h3 class="sub-h">AI na fotky</h3>
    <input class="input" id="api-key" type="password" autocomplete="off" placeholder="Anthropic API kľúč (sk-ant-…)" value="${esc(getKey())}">
    <select class="input" id="api-model" style="margin-top:8px">${opt(p.model, MODELS)}</select>
    <button class="btn" id="key-save" style="margin-top:8px">Uložiť kľúč</button>
    <p class="small muted" style="margin-top:6px">Kľúč ostáva len v tomto zariadení a posiela sa iba do Anthropic API.</p>

    <h3 class="sub-h">Športová kuchárka</h3>
    <p class="small muted" style="margin-bottom:8px">${BOOK ? `Odomknutá: ${BOOK.recipes.length} receptov.` : 'Zamknutá, odomkneš ju svojím súkromným odkazom.'}</p>
    ${BOOK ? '<button class="btn" data-act="book-lock">Zamknúť kuchárku v tomto zariadení</button>' : ''}

    <h3 class="sub-h">Ceny z bločkov</h3>
    <p class="small muted" style="margin-bottom:8px">${S.prices?.length ? `Uložené: ${S.prices.length} položiek. Používajú sa pri pláne nákupu.` : 'Zatiaľ žiadne. Bloček odfotíš v Pláne a nákupe.'}</p>
    ${S.prices?.length ? '<button class="btn" data-act="prices-clear">Vymazať ceny</button>' : ''}

    <h3 class="sub-h">Záloha</h3>
    <div class="grid2"><button class="btn" id="exp">Zálohovať</button><button id="exp-old" hidden></button><button class="btn" id="imp">Import</button></div>
    <button class="btn danger" id="wipe" style="margin-top:10px">Zmazať všetky dáta</button>
  `);

  $('#profile-form').onsubmit = ev => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const num = k => { const v = Number(String(fd.get(k)).replace(',', '.')); return v > 0 ? v : null; };
    p.name = String(fd.get('name') || '').trim();
    p.suppList = String(fd.get('supps') || '').split(',').map(x => x.trim()).filter(Boolean);
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
  $('#exp').onclick = () => backupNow();
  $('#exp-old').onclick = () => {
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
  else if (d.act === 'photo') { photoMode = 'food'; $('#photo-input').click(); }
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
  else if (d.rfav) { S.recipeMeta[d.rfav] = { ...rmeta(d.rfav), fav: !rmeta(d.rfav).fav }; save(); t.classList.toggle('on'); }
  else if (d.rate) {
    const n = Number(d.n);
    S.recipeMeta[d.rate] = { ...rmeta(d.rate), rating: rmeta(d.rate).rating === n ? 0 : n };
    save();
    t.parentElement.querySelectorAll('.star').forEach(b => b.classList.toggle('on', Number(b.dataset.n) <= S.recipeMeta[d.rate].rating));
  }
  else if (d.cookMode) startCooking(d.cookMode);
  else if (d.act === 'cook-close') stopCooking();
  else if (d.act === 'cook-next') { if (cookState.i >= cookState.r.steps.length - 1) stopCooking(); else { cookState.i++; drawCooking(); } }
  else if (d.act === 'cook-prev') { cookState.i = Math.max(-1, cookState.i - 1); drawCooking(); }
  else if (d.act === 'add-recipe') openAddRecipe();
  else if (d.act === 'only-fav') { onlyFav = !onlyFav; openAllRecipes(); }
  else if (d.act === 'scan') openScan();
  else if (d.act === 'receipt') { photoMode = 'receipt'; $('#photo-input').click(); }
  else if (d.act === 'prices-clear') { if (confirm('Vymazať uložené ceny z bločkov?')) { S.prices = []; save(); openProfile(); } }
  else if (d.act === 'scan-code') lookupProduct($('#scan-code').value);
  else if (d.scan) lookupProduct(d.scan);
  else if (d.act === 'scan-photo') { stopScanner(); photoMode = 'barcode'; $('#photo-input').click(); }
  else if (d.act === 'label-photo') { photoMode = 'label'; $('#photo-input').click(); }
  else if (d.act === 'product-ai') productAI(t);
  else if (d.act === 'daytype') openDayType();
  else if (d.dtype) {
    S.days[curDate] = { ...(S.days[curDate] || {}), type: (S.days[curDate] || {}).type === d.dtype ? null : d.dtype };
    t.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.dtype === S.days[curDate].type));
  }
  else if (d.act === 'daytype-save') {
    const w = Number($('#watch-kcal').value) || 0;
    S.days[curDate] = { ...(S.days[curDate] || {}), watch: w > 0 ? w : null };
    save(); closeSheet(); render();
  }
  else if (d.supp) {
    const list = S.supps[curDate] || [];
    S.supps[curDate] = list.includes(d.supp) ? list.filter(x => x !== d.supp) : [...list, d.supp];
    save(); render();
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
  else if (d.act === 'plan') openPlan();
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
  else if (d.shop) { const it = S.mealPlan.result.shopping[Number(d.shop)]; it.done = !it.done; save(); showPlan(); }
  else if (d.planRecipe) openRecipe(d.planRecipe, showPlan);
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
    const from = $('#sheet-title').textContent === 'Všetky recepty' ? openAllRecipes : cookResults;
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

// Jeden fotoaparát pre všetko: jedlo, čiarový kód, zloženie na obale, bloček.
let photoMode = 'food';
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
