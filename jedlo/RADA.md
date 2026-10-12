# Rada piatich – návrh appky „Jedlo“

Cieľ: priberať (svaly), sledovať čo jem, kalórie, makrá, zdravosť a návyky. Fotka → AI rozpozná jedlo a hodnoty. Musí ísť do mobilu.

## Členovia a ich požiadavky

| # | Člen | Požiadavka | Hlas |
|---|------|------------|------|
| 1 | Výživový poradca | Cieľ kalórií z BMR (Mifflin-St Jeor) × aktivita + prebytok 350 kcal (lean bulk). Bielkoviny 2 g/kg, tuky 25 % kcal, zvyšok sacharidy, vláknina 14 g / 1000 kcal. Každé jedlo má skóre zdravosti 1–10. | ✅ |
| 2 | Tréner | Sledovať váhu. Zdravé tempo priberania 0,25–0,5 % hmotnosti týždenne. Appka sama povie, či pridať / ubrať ~150 kcal. | ✅ |
| 3 | UX dizajnér | Mobil first. Zapísať jedlo max. 2 ťuknutiami. Veľké tlačidlo „+“, fotka ako prvá voľba. Spodná navigácia. Tmavý aj svetlý režim. | ✅ |
| 4 | Vývojár | PWA na GitHub Pages (`/jedlo/`), žiadny server, žiadny build. Dáta v `localStorage`, funguje offline (okrem AI). „Pridať na plochu“ = appka v mobile. | ✅ |
| 5 | Súkromie a náklady | Žiadny backend → dáta len v mobile. AI cez vlastný Anthropic API kľúč uložený len v zariadení. Fotku zmenšiť na 1024 px (lacnejšie). Export/import zálohy. | ✅ |

## Spory a dohoda

- **Server vs. bez servera** – Vývojár chcel server na skrytie kľúča. Súkromie: osobná appka, kľúč len v tvojom mobile stačí. **Dohoda: bez servera.**
- **Model** – Poradca chce presnosť, Náklady lacnosť. **Dohoda: predvolene Claude Opus 5.5 (presnejší, ~1–2 centy za fotku), v nastaveniach prepínač na Haiku 5.5 (lacnejší).**
- **Fotka vs. ručné zadanie** – UX chcel len fotku. Poradca: AI sa mýli v gramážach. **Dohoda: AI navrhne, ty upravíš gramy pred uložením. K tomu databáza bežných potravín a „naposledy jedené“.**

## Funkcie (schválené všetkými 5)

1. **Dnes** – kalórie, bielkoviny, sacharidy, tuky, vláknina vs. cieľ, voda, jedlá podľa raňajky/obed/večera/desiata.
2. **Pridať** – 📷 fotka (AI), ✍️ popis textom (AI), 🔎 databáza potravín, ⏱ naposledy jedené, vlastná položka.
3. **Štatistiky** – 7/30 dní: graf kalórií, priemery, dni so splnenými bielkovinami, priemerné skóre zdravosti, rozloženie jedál, jedenie po 21:00, séria dní, top jedlá, automatické tipy na návyky.
4. **Váha** – záznam, graf, týždenné tempo, odporúčanie úpravy kalórií.
5. **Profil** – údaje, cieľ, API kľúč, model, záloha.

Verdikt: **5/5 schválené.**
