# Triedne komunity (Ranné kruhy)

Responzívna aplikácia pre učiteľov. Aktivity vychádzajú z Príručky pre ranné kruhy, ktorú vydalo Ministerstvo školstva, výskumu, vývoja a mládeže Slovenskej republiky. Pôvodné aktivity boli nahradené dodanou databázou. `activities.json` obsahuje 101 aktivít: 52 pre 1. stupeň a 49 pre 2. stupeň. Všetkých sedem filtrov je naplnených pre oba stupne. Aplikácia podporuje aj prázdnu databázu `[]`. Všetkých 101 aktivít prešlo obsahovou revíziou: krátke kroky vysvetľujú základný priebeh, podrobný návod dopĺňa organizáciu a príklady. Pomôcky a reflexia zodpovedajú konkrétnej činnosti. Ide o redakčne upravené verzie pre použitie na hodine, nie o doslovnú kópiu pôvodného dokumentu. Rozsah a významnejšie adaptácie uvádza [CONTENT_REVIEW.md](CONTENT_REVIEW.md).

## Spustenie a kontrola

Vyžaduje Node.js, bez inštalácie balíkov alebo buildu:

```sh
npm start
npm test
```

Otvorte http://localhost:5173. Súbor neotvárajte cez `file://`.

## Import nových aktivít

Nahraďte obsah `activities.json` poľom objektov podľa nasledujúceho formátu. Príklad je len dokumentácia, aplikácia ho nenačítava:

```json
[
  {
    "id": "001",
    "title": "Názov aktivity",
    "gradeLevel": 1,
    "filter": "posilnenie-vztahov",
    "types": ["Dvojice", "Spoznávanie sa"],
    "materials": "Bez pomôcok",
    "steps": [
      "Prvý krátky krok.",
      "Druhý krátky krok.",
      "Tretí krátky krok."
    ],
    "reflection": ["Ako ste sa cítili?"],
    "details": "Rozšírený návod.\nĎalší odsek."
  }
]
```

- `id`: jedinečný neprázdny text, zobrazuje sa ako číslo aktivity. Zachovajte ho pri úprave aktivity, aby zostala v obľúbených.
- `gradeLevel`: číslo `1` alebo `2`. Pre oba stupne vytvorte dva záznamy s odlišnými ID.
- `filter`: jedna hodnota z tabuľky nižšie.
- `types`: neprázdne pole voľných textových označení; slúži iba na informáciu v detaile, nie na filtrovanie.
- `materials`: neprázdny text, napríklad „Bez pomôcok“.
- `steps`: 3–4 neprázdne krátke kroky, najviac 160 znakov na krok. Pre mobil odporúčame jednu krátku vetu na krok. Pri dlhšom texte alebo zväčšenom písme ostáva povolené rolovanie.
- `reflection`: neprázdne pole otázok.
- `details`: neprázdny podrobný návod. Zlomy riadkov sa zachovajú.

| Filter | Hodnota v JSON |
| --- | --- |
| 🌱 Úvod školského roka | `uvod-skolskeho-roka` |
| 😌 Upokojenie | `upokojenie` |
| ⚡ Zvýšenie energie | `zvysenie-energie` |
| 💪 Zvládanie výziev | `zvladanie-vyziev` |
| ❤️ Posilnenie vzťahov | `posilnenie-vztahov` |
| 😊 Práca s emóciami | `praca-s-emociami` |
| 💬 Komunikácia | `komunikacia` |

Pred nahratím overte nový súbor:

```sh
node --input-type=module -e "import fs from 'node:fs'; import {validateActivities} from './js/core.js'; validateActivities(JSON.parse(fs.readFileSync('activities.json','utf8'))); console.log('Dáta sú platné.');"
```

## Výber a lokálne údaje

Úvodná obrazovka ponúka výber stupňa a odkaz na **Moje obľúbené** (obľúbené aktivity z oboch stupňov). Po výbere stupňa sú dve možnosti:

- **Vybrať náhodnú aktivitu** vyberie z celého zvoleného stupňa. Počas výberu sa zobrazí animácia listovania v knihe.
- **Vybrať podľa typu aktivity** zobrazí zoznam všetkých aktivít zvoleného typu a stupňa. V zozname je číslo, názov a pomôcky (alebo „Bez pomôcok“). Po kliknutí sa otvorí celá aktivita a tlačidlo „Späť na zoznam“ vráti do zoznamu. Tu sa nevyberá náhodne.

Pri náhodnom výbere zostáva zachované uprednostnenie ešte nevidených aktivít, potom najdávnejšie zobrazených; pri rovnakej priorite je výber náhodný. Tlačidlo „Iná aktivita“ zachová stupeň a typ a neopakuje aktuálnu aktivitu, ak existuje iná možnosť.

Obľúbené sa ukladajú do `rk-favorites-v2`, história do `rk-activity-history-v2`. Staré kľúče sa pri otvorení odstránia; pôvodné ID sa neprenesú do novej databázy. Úložisko je lokálne pre zariadenie a prehliadač. Pri jeho zablokovaní funguje aplikácia počas otvorenej relácie. Reflexia a podrobný návod sú pri otvorení aktivity zatvorené.

## Hosting a offline režim

Nahrajte `index.html`, `styles.css`, `activities.json`, `manifest.webmanifest`, `sw.js` a priečinky `js/` a `icons/` na statický HTTPS hosting. Podadresár je podporovaný. Testovacie súbory sa do aplikácie nenačítavajú.

Cache má verziu `ranne-kruhy-v33`. Po stiahnutí novej verzie sa aktualizácia aktivuje aj pri otvorených kartách, odstráni staré cache a obnoví karty aplikácie. Pri prvom nainštalovaní offline podpory sa stránka automaticky neobnovuje. Dáta sa načítavajú najprv zo siete, s limitom 3 sekundy; pri chybe sa použije uložená verzia novej databázy. Prázdne pole je platná databáza a nahrádza aj predtým uložené aktivity. Zmeny samotných dát nevyžadujú zmenu verzie cache; zmeny kódu áno.
