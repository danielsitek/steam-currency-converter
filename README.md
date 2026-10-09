# Steam Currency Converter

Lehké rozšíření pro Chrome (Manifest V3), které na stránkách her ve Steam Store zobrazí samostatně uvedené ceny v nastavené měně. Výchozí měna je CZK. Kurz získává z [Frankfurter API](https://frankfurter.dev/) a uchovává jej 12 hodin v lokální cache. Při výpadku služby použije poslední dostupný kurz. Původní cena zůstává v titulku po najetí myší.

## Vývoj

Požadavky: [Bun](https://bun.sh/).

```sh
bun install
bun run check
```

Build vytvoří složku `dist/` s čistým JavaScriptem, HTML, CSS a manifestem. V Chrome otevřete `chrome://extensions`, zapněte režim vývojáře a přes **Načíst rozbalené** vyberte `dist/`. Měnu změníte kliknutím na ikonu rozšíření nebo na jeho stránce nastavení.

Rozšíření hledá samostatné cenové texty a cenové částky v popiscích `aria-label` na detailu hry (`store.steampowered.com/app/*`); nespoléhá na CSS třídy Steamu. Zachovává okolní HTML, takže funguje i v kartách doporučených her a u slev. Nepřevádí částky v košíku ani platbě. Zdrojové měny rozpoznává pro EUR, USD, GBP, CZK, PLN a CHF; samotný symbol `$` interpretuje jako USD. Přepočet je orientační, není to cena účtovaná Steamem nebo bankou.
