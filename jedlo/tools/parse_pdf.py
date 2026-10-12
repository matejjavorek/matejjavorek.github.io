"""Športová kuchárka: PDF časti (pdftotext) -> kucharka.json. Spusti: python3 parse_pdf.py out.json casti*.pdf"""
import re, json, sys, subprocess, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_kucharka import CHIPS, CATS, requirements

SECTION = {'SNÍDANĚ': 'snidane', 'SVAČINY': 'svaciny', 'HLAVNÍ JÍDLA': 'hlavni', 'PŘEDZÁPASOVÉ SNÍDANĚ': 'predzapas',
           'PŘEDZÁPASOVÁ SNÍDANĚ': 'predzapas', 'DEZERTY': 'dezerty'}
META = re.compile(r'^(\d+ minut|Meal Prep|Easy|Medium|Hard|\+ .*(hodin|minut|chlazen|odpočin|kynut).*)$')
NOISE = re.compile(r'^(honzatobiska\.com|HONZA TOBIŠKA|\d{1,3}|)$')
MAC = re.compile(r'Kalorie:\s*([\d,\.]+)\s*kcal,?\s*Bílkoviny:\s*([\d,\.]+)\s*g,?\s*Sacharidy:\s*([\d,\.]+)\s*g,?\s*Tuky:\s*([\d,\.]+)\s*g,?\s*Vláknina:\s*([\d,\.]+)\s*g', re.I)
ING_START = re.compile(r'^(\d|[½¼¾]|Recept na|Na \d|Ingredience|Hrst|Špetk|Sůl|[^\d:]{2,40}:$)')

def pages_of(pdf):
    txt = subprocess.run(['pdftotext', pdf, '-'], capture_output=True, text=True).stdout
    out = []
    for idx, p in enumerate(txt.split('\f')):
        lines = [l.strip() for l in p.split('\n')]
        # Makrá rozdelené na viac riadkov spoj do jedného.
        for i, l in enumerate(lines):
            if l.startswith('Kalorie') and not MAC.search(l):
                j, acc = i + 1, l
                while j < len(lines) and j < i + 12 and not MAC.search(acc):
                    if lines[j]: acc += ' ' + lines[j]
                    lines[j] = '' if lines[j] and re.match(r'^(Bílkoviny|Sacharidy|Tuky|Vláknina)', lines[j]) else lines[j]
                    j += 1
                if MAC.search(acc): lines[i] = acc
        # Číslo strany je riadok tesne pred „honzatobiska.com“.
        clean = [l for l in lines if l]
        pno = None
        for i, l in enumerate(clean):
            if l == 'honzatobiska.com' and i and re.fullmatch(r'\d{1,3}', clean[i - 1]):
                pno = int(clean[i - 1])
        out.append((pno, lines, (pdf, idx + 1)))
    return out

def num(x): return float(x.replace(',', '.'))

def parse_pages(pages):
    recs, cur, cat = [], None, None
    for pno, lines, src in pages:
        body = [l for l in lines if not NOISE.match(l)]
        if not body: continue
        head = body[0] + (' ' + body[1] if len(body) > 1 else '')
        if head == 'SNÍDANĚ V DEN ZÁPASU':
            cat = 'predzapas'; cur = None; continue
        if body[0] in SECTION:
            cat = SECTION[body[0]]; cur = None; continue
        meta = [l for l in body if META.match(l)]
        body = [l for l in body if not META.match(l)]
        text = '\n'.join(body)
        has_recipe = 'Postup:' in text or MAC.search(text) or re.search(r'^(\d+\s*(g|ml|ks)\b|Recept na|Na \d+ porc)', text, re.M)
        if not has_recipe and not (cur and not cur.get('done')):
            continue  # úvodná strana kapitoly
        starts_new = not body[0].startswith('Postup') and not (cur and not cur.get('done') and ING_START.match(body[0]))
        if starts_new:
            title = []
            i = 0
            while i < len(body) and not ING_START.match(body[i]) and not body[i].startswith('Postup') and len(title) < 3:
                title.append(body[i]); i += 1
            cur = {'title': ' '.join(title), 'cat': cat, 'page': pno, 'meta': meta, 'ing': [], 'steps': [], 'mac': None, 'src': [src]}
            recs.append(cur)
            rest = body[i:]
        else:
            if cur is None or cur.get('done'): continue
            cur['meta'] += meta
            cur['src'].append(src)
            rest = body
        mode = 'steps' if cur['ing'] and not starts_new and rest and rest[0].startswith('Postup') else ('steps' if cur.get('in_steps') else 'ing')
        for l in rest:
            m = MAC.search(l)
            if m:
                cur['mac'] = m; cur['done'] = True; break
            if l.startswith('Postup'):
                cur['in_steps'] = True; mode = 'steps'; continue
            if l.startswith('Kalorie'):
                continue
            cur[mode].append(l)
    out = []
    for r in recs:
        if not r['steps'] or not r['ing']: continue
        steps = re.sub(r'\s+', ' ', ' '.join(r['steps'])).strip()
        steps = [re.sub(r'^\d{1,2}\.\s*', '', s).strip() for s in re.split(r'(?<![\d,])(?=\b\d{1,2}\.(?!\d))', steps) if s.strip()]
        steps = [s for s in steps if s]
        ing = [re.sub(r'\s+', ' ', l) for l in r['ing']]
        # Zalomené riadky surovín (pokračovanie bez čísla, malým písmenom) prilep k predošlému.
        merged = []
        for l in ing:
            if merged and (re.match(r'^[a-zěščřžýáíéůú(]', l) or merged[-1].endswith('/')) and not merged[-1].endswith(':'):
                merged[-1] += ' ' + l
            else:
                merged.append(l)
        # „… jogurtu ovoce: 200 g …“ -> zoznam ovocia na vlastný riadok.
        merged = [x for l in merged for x in re.sub(r'\s+(ovoce|Ovoce):\s*', r'\n\1: ', l).split('\n')]
        por = re.search(r'(?:Na|na) (\d+) porc', ' '.join(merged))
        m = r['mac']
        time = next((int(x.split()[0]) for x in r['meta'] if re.fullmatch(r'\d+ minut', x)), None)
        extra = next((x for x in r['meta'] if x.startswith('+')), None)
        diff = next((x for x in r['meta'] if x in ('Easy', 'Medium', 'Hard')), None)
        out.append({
            'title': r['title'], 'cat': r['cat'], 'page': r['page'], 'time': time, 'extra': extra, 'diff': diff, 'prep': 'Meal Prep' in r['meta'],
            'portions': int(por.group(1)) if por else 1,
            'kcal': num(m.group(1)) if m else None, 'p': num(m.group(2)) if m else None, 'c': num(m.group(3)) if m else None,
            'f': num(m.group(4)) if m else None, 'fib': num(m.group(5)) if m else None,
            'ing': merged, 'steps': steps, 'req': requirements('\n'.join(merged)), 'src': r['src'],
        })
    return out

# Prvé strany kapitol (pre časti, ktoré začínajú uprostred kapitoly).
def cat_for_page(p, starts):
    c = None
    for page, cid in sorted(starts):
        if p is not None and p >= page: c = cid
    return c

if __name__ == '__main__':
    allpages = []
    for pdf in sys.argv[2:]:
        allpages += pages_of(pdf)
    # Strany bez čísla dostanú číslo podľa predošlej strany.
    last = 0
    for i, (p, ls, src) in enumerate(allpages):
        if p is None: allpages[i] = (last + 1, ls, src)
        last = allpages[i][0]
    # zoradenie podľa čísla strany; strany bez čísla nechaj za predchádzajúcou
    recs = parse_pages(allpages)
    starts = [(p, SECTION[l[0]]) for p, ls, _ in allpages for l in [[x for x in ls if not NOISE.match(x)]] if l and l[0] in SECTION]
    seen, final = set(), []
    for r in recs:
        if r['cat'] is None: r['cat'] = cat_for_page(r['page'], starts) or 'snidane'
        key = r['title'].lower()
        if key in seen: continue
        seen.add(key); final.append(r)
    for i, r in enumerate(final): r['id'] = i + 1
    # Zdroj strán (na fotky) ide do samostatného súboru, nie do kuchárky.
    json.dump({r['id']: r.pop('src') for r in final}, open(sys.argv[1].replace('.json', '.src.json'), 'w'))
    data = {'name': 'Športová kuchárka 2.0', 'version': 2,
            'chips': [{'id': c[0], 'label': c[1], 'group': c[2]} for c in CHIPS],
            'cats': [{'id': c[0], 'label': c[1]} for c in CATS], 'recipes': final}
    json.dump(data, open(sys.argv[1], 'w'), ensure_ascii=False, separators=(',', ':'))
    for r in final:
        print(f"{r['id']:3} p{str(r['page']):4} {r['cat']:9} {str(r['time']):4} {str(r['diff']):6} {str(r['kcal']):6} {r['title'][:42]:42} | {len(r['ing'])} ing {len(r['steps'])} st | {' + '.join('/'.join(x) for x in r['req'])[:70]}")
