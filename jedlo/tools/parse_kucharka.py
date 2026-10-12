"""Parser Športovej kuchárky: text z PDF -> kucharka.json (recepty + značky surovín)."""
import re, json, sys

# Čipy surovín: id, slovenský názov, skupina, regex na české tvary.
CHIPS = [
  ('vajcia', 'Vajcia', 'Mliečne a vajcia', r'vejc|vejce|vajec|vajíč|vaječ|žloutk|bílk'),
  ('mlieko', 'Mlieko', 'Mliečne a vajcia', r'\bmlék|\bmléka|\bmlékem|kefír'),
  ('jogurt', 'Jogurt (biely/grécky)', 'Mliečne a vajcia', r'jogurt'),
  ('skyr', 'Skyr', 'Mliečne a vajcia', r'skyr'),
  ('tvaroh', 'Tvaroh', 'Mliečne a vajcia', r'tvaroh'),
  ('cottage', 'Cottage', 'Mliečne a vajcia', r'cottage'),
  ('syr', 'Syr', 'Mliečne a vajcia', r'sýr|eidam|parmazán|parmezán|gouda|čedar|cheddar|feta|fety|gorgonzol|ementál|grana'),
  ('mozzarella', 'Mozzarella', 'Mliečne a vajcia', r'mozzarel'),
  ('halloumi', 'Halloumi', 'Mliečne a vajcia', r'halloumi'),
  ('ricotta', 'Ricotta / krémový syr', 'Mliečne a vajcia', r'ricott|lučin|žervé|cream cheese|philadelph|mascarpon'),
  ('maslo', 'Maslo', 'Mliečne a vajcia', r'(?<!arašídové )(?<!kešu )(?<!mandlové )(?<!ořechové )(?<!arašídového )(?<!kešu )\bmásl'),
  ('kuracie', 'Kuracie mäso', 'Mäso a ryby', r'kuřec|kuřat|kuře\b|kuřete|kuřecí'),
  ('morcacie', 'Morčacie mäso', 'Mäso a ryby', r'krůt'),
  ('hovadzie', 'Hovädzie mäso', 'Mäso a ryby', r'hověz|steak|roštěn'),
  ('bravcove', 'Bravčové mäso', 'Mäso a ryby', r'vepř|panenk|krkovic'),
  ('sunka', 'Šunka / slanina', 'Mäso a ryby', r'šunk|prosciut|slanin|anglick'),
  ('losos', 'Losos', 'Mäso a ryby', r'losos'),
  ('tuniak', 'Tuniak', 'Mäso a ryby', r'tuňák'),
  ('ryba', 'Iná ryba', 'Mäso a ryby', r'treska|tresk|pstruh|candát|rybí filé|makrel|sardin'),
  ('krevety', 'Krevety', 'Mäso a ryby', r'krevet'),
  ('tofu', 'Tofu', 'Mäso a ryby', r'tofu|tempeh'),
  ('vlocky', 'Ovsené vločky', 'Prílohy a pečivo', r'vloč'),
  ('ryza', 'Ryža', 'Prílohy a pečivo', r'rýž(?!ov[éá] mouk)|rýže|rýži'),
  ('cestoviny', 'Cestoviny', 'Prílohy a pečivo', r'těstovin|špaget|penne|nudl|gnocchi|lasagn'),
  ('zemiaky', 'Zemiaky', 'Prílohy a pečivo', r'brambor'),
  ('bataty', 'Batáty', 'Prílohy a pečivo', r'batát'),
  ('pecivo', 'Chlieb / pečivo', 'Prílohy a pečivo', r'chléb|chleb|(?<!do )pečiv|toast|bagel|rohlík|bulk|housk|bageta|bagety|žeml'),
  ('tortilla', 'Tortilla', 'Prílohy a pečivo', r'tortil|wrap'),
  ('muka', 'Múka', 'Prílohy a pečivo', r'mouk'),
  ('obilniny', 'Bulgur / kuskus / quinoa', 'Prílohy a pečivo', r'bulgur|kuskus|quino|jáhl|pohank'),
  ('strukoviny', 'Strukoviny', 'Prílohy a pečivo', r'fazol|čočk|cizrn|hrách'),
  ('banan', 'Banán', 'Ovocie', r'banán'),
  ('jablko', 'Jablko / hruška', 'Ovocie', r'(?<!granátové )jabl|hrušk'),
  ('bobule', 'Bobuľové ovocie', 'Ovocie', r'borůvk|malin|jahod|ostružin|rybíz|lesní ovoc|lesního ovoc|lesním ovoc'),
  ('citrusy', 'Pomaranč / mandarínka', 'Ovocie', r'pomeranč|mandarink'),
  ('susene', 'Datle / hrozienka', 'Ovocie', r'datl|rozink|brusink|sušen[éáý]+\s+(ovoc|švest|meruň|jabl|fík|brusin|mang)'),
  ('ovocie', 'Iné ovocie', 'Ovocie', r'ovoc|mango|kiwi|ananas|broskv|meruňk|švestk|třešn|višn|hrozn|fík|meloun'),
  ('spenat', 'Špenát', 'Zelenina', r'špenát'),
  ('paradajky', 'Paradajky', 'Zelenina', r'rajč|cherry'),
  ('avokado', 'Avokádo', 'Zelenina', r'avokád'),
  ('paprika', 'Paprika', 'Zelenina', r'(?<!mletá )(?<!mleté )(?<!uzená )(?<!sladká )papri(?!ky mlet)'),
  ('uhorka', 'Uhorka', 'Zelenina', r'okurk'),
  ('cuketa', 'Cuketa', 'Zelenina', r'cuket'),
  ('mrkva', 'Mrkva', 'Zelenina', r'mrkev|mrkv'),
  ('huby', 'Huby / šampiňóny', 'Zelenina', r'žampion|houb'),
  ('dyna', 'Tekvica', 'Zelenina', r'dýn(?!ěn)(?!ov[áé] semín)'),
  ('brokolica', 'Brokolica / karfiol', 'Zelenina', r'brokolic|květák'),
  ('salat', 'Šalát / rukola', 'Zelenina', r'salát|rukol|polníč'),
  ('kukurica', 'Kukurica', 'Zelenina', r'kukuřic'),
  ('protein', 'Proteín', 'Ostatné', r'protein'),
  ('arasidove', 'Arašidové / orieškové maslo', 'Ostatné', r'arašídov|kešu másl|mandlov[éého]+ másl|ořechov[éého]+ másl|oříškov'),
  ('orechy', 'Orechy / semienka', 'Ostatné', r'ořech|ořeš|mandl|kešu|lískov|semín|chia|lněn|slunečnic|pistáci'),
  ('cokolada', 'Čokoláda / kakao', 'Ostatné', r'čokol|kakao|kakaa'),
  ('med', 'Med / sirup', 'Ostatné', r'\bmed\b|\bmedu\b|\bmedem\b|javorov|sirup'),
  ('kokos', 'Kokos', 'Ostatné', r'kokos'),
]
CATS = [('snidane', 'Raňajky'), ('svaciny', 'Desiata'), ('hlavni', 'Hlavné jedlo'), ('predzapas', 'Pred zápasom'), ('dezerty', 'Dezert')]

def tags_of(text):
    t = text.lower()
    found = [cid for cid, _, _, rx in CHIPS if re.search(rx, t)]
    # Arašidové maslo nie je maslo, ovocné druhy nie sú „iné ovocie“.
    if 'arasidove' in found and 'maslo' in found and not re.search(r'(?<!arašídové )(?<!kešu )\bmásl[oaem]+\b(?! arašíd)', re.sub(r'(arašídov|kešu|mandlov|ořechov|oříškov)\S*\s+másl\S*', '', t)):
        found.remove('maslo')
    return found

QTY = re.compile(r'(?<=[a-zěščřžýáíéůúňťď\)]\s)(?=[A-ZŠČŘŽÝÁÍÉ][a-zěščřžýáíéůú])|(?<![(>\-–/\d,\.]\s)(?<![(>\-–/])(?=(?:\b\d+[\d,\.]*|[½¼¾])\s*(?:-\s*\d+\s*)?(?:g|kg|ml|l|ks|lžičk|lžíc|lžič|hrst|plát|stroužk|kous|balen|konzerv|špetk|plechovk|cm)?\b)')

def requirements(ing):
    """Zoznam požiadaviek; každá je zoznam alternatív (stačí mať jednu)."""
    reqs = []
    for line in ing.split('\n'):
        # Menovky typu „Zdobení:“ / „ovoce:“ nie sú suroviny.
        line = re.sub(r'(?<![\d\w])[^\W\d]+(?: [^\W\d]+){0,3}:\s*', '', line)
        items = [x.strip() for x in QTY.split(line) if x.strip()]
        groups, cur = [], []
        for it in items:
            cur.append(it)
            if not it.endswith('/'):
                groups.append(' '.join(cur)); cur = []
        if cur: groups.append(' '.join(cur))
        for g in groups:
            if re.search(r'dle chuti|volitelné|na ozdobu|na smažení', g, re.I) and len(tags_of(g)) <= 1 and not re.search(r'\d+\s*g', g):
                continue
            alts = set()
            for part in g.split('/'):
                alts.update(tags_of(part))
            # Lyžička papriky je korenie, nie zelenina.
            if re.match(r'^\s*[\d½¼¾/,\.\s]*(lžičk|lžič|lžíc|špetk|PL|KL)', g):
                alts -= {'paprika'}
            # Vývar nie je mäso.
            if re.search(r'vývar|bujón', g, re.I):
                alts -= {'kuracie', 'morcacie', 'hovadzie', 'bravcove'}
            if alts: reqs.append(sorted(alts))
    # Duplicitné požiadavky zlúč.
    out = []
    for r in reqs:
        if r not in out: out.append(r)
    return out

def parse(text, cat_hint=None):
    text = text.replace('\\!', '!').replace('\\>', '>').replace('\\<', '<').replace('\\*', '*').replace('\\-', '-').replace('\\#', '#')
    lines = [l.strip() for l in text.split('\n')]
    MAC = re.compile(r'Kalorie:\s*([\d,\.]+)\s*kcal,?\s*Bílkoviny:\s*([\d,\.]+)\s*g,?\s*Sacharidy:\s*([\d,\.]+)\s*g,?\s*Tuky:\s*([\d,\.]+)\s*g,?\s*Vláknina:\s*([\d,\.]+)\s*g', re.I)
    META = re.compile(r'^(\d+ minut|Meal Prep|Easy|Medium|Hard)$')
    NOISE = re.compile(r'^(honzatobiska\.com( \d+)?|\d+|)$')
    SECTION = {'SNÍDANĚ': 'snidane', 'SVAČINY': 'svaciny', 'HLAVNÍ JÍDLA': 'hlavni', 'PŘEDZÁPASOVÉ SNÍDANĚ': 'predzapas', 'DEZERTY': 'dezerty'}
    START = re.compile(r'^(Na \d+ porc|Ingredience|Na \d+ kous|Na \d+ ks|Recept na \d)')
    HEADER = re.compile(r'^(Na |Recept na|Vrchní|Spodní|Těsto|Náplň|Krém|Omáčka|Dresink|Topping|Zdobení|Postup|Kalorie|Tip|K servírování|Ingredience)', re.I)
    cat = cat_hint
    # Rozdeľ na bloky receptov podľa riadkov s titulkom (riadok pred „Na X porce“ / „Ingredience“ alebo pred ingredienciami).
    recs, cur = [], None
    pending_meta = []
    def is_title(i, strict=False):
        l = lines[i]
        if HEADER.match(l): return False
        if not l or len(l) > 75 or l.endswith(':') or META.match(l) or NOISE.match(l) or MAC.search(l): return False
        if re.match(r'^\d', l) or l.startswith(('Postup', 'Kalorie', 'Zdobení', 'Na zdobení', 'K servírování', 'Tip')): return False
        if re.search(r'\d+\s*(g|ml)\b', l): return False
        # nasledujúci neprázdny ne-šumový riadok musí začínať ingredienciami
        for j in range(i + 1, min(i + 8, len(lines))):
            n = lines[j]
            if not n or NOISE.match(n) or META.match(n): continue
            if strict: return bool(START.match(n))
            return bool(START.match(n) or re.match(r'^(\d|[½¼¾])', n) or re.match(r'^[^:]{2,30}:$', n) and not n.startswith('Postup'))
        return False
    # Úvod knihy pred prvou sekciou preskoč.
    started = not any(l in SECTION for l in lines)
    for i, l in enumerate(lines):
        if l in SECTION: cat = SECTION[l]; started = True; continue
        if not started: continue
        if META.match(l):
            pending_meta.append(l); continue
        m = MAC.search(l)
        if m and cur:
            cur['mac'] = m; cur['closed'] = True
            continue
        open_ = cur is not None and not cur.get('closed')
        if is_title(i, strict=open_ and bool(cur['body'])) and not (open_ and not cur['body']):
            # meta pred titulkom patrí predošlému receptu (ak má makrá), inak novému
            if cur and cur.get('closed'):
                cur['meta'] += pending_meta; pending_meta = []
            cur = {'title': l, 'cat': cat, 'body': [], 'meta': pending_meta, 'mac': None}
            pending_meta = []
            recs.append(cur)
            continue
        if cur and not NOISE.match(l):
            if pending_meta and not cur.get('closed'):
                cur['meta'] += pending_meta; pending_meta = []
            if not cur.get('closed'):
                cur['body'].append(l)
    if cur and pending_meta: cur['meta'] += pending_meta
    out = []
    for n, r in enumerate(recs):
        body = '\n'.join(r['body'])
        pi = body.find('Postup:')
        ing, steps = (body[:pi], body[pi + 7:]) if pi >= 0 else (body, '')
        if not ing.strip() or not steps.strip(): continue
        steps = re.sub(r'\s+', ' ', steps).strip()
        steps_list = [s.strip() for s in re.split(r'\s*(?<![\d,])(?=\b\d{1,2}\.(?!\d))', steps) if s.strip()]
        steps_list = [re.sub(r'^\d{1,2}\.\s*', '', s) for s in steps_list]
        por = re.search(r'Na (\d+) porc', ing)
        meta = r['meta']
        time = next((int(x.split()[0]) for x in meta if x.endswith('minut')), None)
        diff = next((x for x in meta if x in ('Easy', 'Medium', 'Hard')), None)
        m = r['mac']
        f = lambda k: float(m.group(k).replace(',', '.')) if m else None
        ing_lines = []
        # Menovka v strede riadku („… ovoce: 200 g …“) ide na vlastný riadok.
        ing = re.sub(r'[ \t]+([^\W\d]+:)[ \t]+', r'\n\1\n', ing)
        for x in ing.split('\n'):
            x = re.sub(r'\s+', ' ', x).strip()
            if not x: continue
            if x.endswith(':'): ing_lines.append(x); continue
            # Jeden riadok na surovinu; alternatívy spojené „/“ ostanú spolu.
            items, cur = [], ''
            for it in [y.strip() for y in QTY.split(x) if y.strip()]:
                cur = (cur + ' ' + it).strip()
                if not it.endswith('/') and not re.fullmatch(r'[\d½¼¾,\.\-\s]+', it): items.append(cur); cur = ''
            if cur: items.append(cur)
            ing_lines += items
        out.append({
            'title': r['title'], 'cat': r['cat'], 'time': time, 'diff': diff, 'prep': 'Meal Prep' in meta,
            'portions': int(por.group(1)) if por else 1,
            'kcal': f(1), 'p': f(2), 'c': f(3), 'f': f(4), 'fib': f(5),
            'ing': ing_lines, 'steps': steps_list, 'req': requirements('\n'.join(ing_lines)),
        })
    return out

if __name__ == '__main__':
    recs = []
    for path in sys.argv[2:]:
        recs += parse(open(path).read(), 'snidane' if not recs else None)
    for i, r in enumerate(recs): r['id'] = i + 1
    data = {'name': 'Športová kuchárka 2.0', 'version': 1,
            'chips': [{'id': c[0], 'label': c[1], 'group': c[2]} for c in CHIPS],
            'cats': [{'id': c[0], 'label': c[1]} for c in CATS], 'recipes': recs}
    json.dump(data, open(sys.argv[1], 'w'), ensure_ascii=False, separators=(',', ':'))
    for r in recs:
        print(f"{r['id']:3} {r['cat']:9} {str(r['time']):4} {str(r['diff']):6} {str(r['kcal']):6} {r['title'][:45]:45} | {' + '.join('/'.join(x) for x in r['req'])}")
