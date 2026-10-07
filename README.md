# The Pod Times

The newspaper of our Magic: The Gathering Commander pod. It's a plain static site (HTML, CSS and JS, with no build step), set like an old broadsheet. All data comes from a BG Stats export.

Live: https://awesem90.github.io/pod-stats/

## Updating the data

1. In BG Stats, export your data (`BGStatsExport.json`).
2. Run the importer:
   ```
   powershell -ExecutionPolicy Bypass -File tools\import-bgstats.ps1 -Export "C:\Users\sem_m\Downloads\BGStatsExport.json"
   ```
3. Commit and push `data/pod.json`. GitHub Pages republishes in about a minute.

The importer:
- keeps only *Magic: The Gathering* plays that have commanders, so Draft games are skipped;
- reads each player's commander from the BG Stats "role" field, splitting partners on `&` and backgrounds on `with`;
- takes the winner(s), start player, rounds, duration and location;
- takes **Card of the Match** from a `Cotm: <card>` line in the play comments. Other comments are private notes and are **not** published;
- looks up every card once on Scryfall (art, colour identity, card image) and stores the results in `data/pod.json`. Earlier lookups are reused, so the site makes no API calls at runtime.

## Files

| File | What it does |
|---|---|
| `index.html` | Page shell (fonts, CSS, script) |
| `css/style.css` | All styling (newsprint colour tokens at the top) |
| `js/config.js` | **Settings**: paper name, motto, season, rank threshold, display toggles |
| `js/data.js` | Loads `data/pod.json` |
| `js/stats.js` | Every stat (winrate, streaks, start player, rounds, rivalries…) as pure functions |
| `js/render.js` | HTML for every page |
| `js/app.js` | Routing (`#/`, `#/speler/<naam>`, `#/commanders`, `#/potjes`, `#/potjes/<naam>`), editions, caching |
| `data/pod.json` | The pod's games and card info, made by the importer |
| `tools/import-bgstats.ps1` | BG Stats export → `data/pod.json` |
| `tools/serve.ps1` | Local preview at http://localhost:8765/ |

## Pages

- **Voorpagina**: the lead story (generated from the stats), the standings, form, key figures, the rivalry table, "deck or player?", and the commanders above the pod average.
- **Spelers**: a profile per player, with how often they started and won as starter, rounds per win, fastest win, decks, results against the pod, and recent games.
- **Commanders**: every commander played, sorted by winrate, with pilots, average rounds and fastest win.
- **Uitslagen**: every game, with rounds, duration, start player, winner, everyone's commander and the Card of the Match.

The edition switch in the masthead (*Laatste 10 · Seizoen · Alle potjes*) applies to every page. A player needs at least a quarter of the edition's games for a rank (`minGamesShare` in `js/config.js`); players below that are listed without one.

## Hosting

GitHub Pages serves the `main` branch from the repo root. Every push redeploys the site.
