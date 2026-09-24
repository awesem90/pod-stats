# POD//STATS

Stats dashboard for our Magic: The Gathering Commander pod. It's a plain static site (HTML, CSS and JS, with no build step). The browser reads the Google Sheet live, so every visit shows the latest games.

## Files

| File | What it does |
|---|---|
| `index.html` | Page shell (fonts, CSS, script) |
| `css/style.css` | All styling (colour tokens at the top) |
| `js/config.js` | **Settings you're likely to change**: sheet ID, pod name, season, thresholds, name map |
| `js/data.js` | Fetches and parses the sheet; Scryfall art and colour identity |
| `js/stats.js` | Every stat (winrate, streaks, rivalries…) as pure functions |
| `js/render.js` | HTML for the overview and profile screens |
| `js/app.js` | Routing (`#/`, `#/speler/<naam>`), state, caching |
| `js/demo.js` | Invented sample data. Open the site with `?demo` to see it |

## The spreadsheet

The data comes from the Google Form's response sheet, which must be shared as **Anyone with the link → Viewer**. Each row is one game. Columns are matched by words in the form question:

| Question | Used for |
|---|---|
| *Wie speelde welke commanders?* | Players and commanders, e.g. `Sem - aragorn hero, Toon - Imodane, Patrick Yshtola` |
| *Wie won?* | The winner. It should match one of the player names |
| *Wanneer?* | The game date. If empty, the timestamp is used |
| *Hoe lang duurde de pot?* | Duration (`1:29`), shown in the game log |
| *Card of the match* | Stored; not shown yet |

Informal commander names are resolved on [Scryfall](https://scryfall.com): it picks the most popular legal commander matching the text, then falls back to a fuzzy name match. If it picks the wrong card, pin it in `commanderMap` in `js/config.js`. For partners, use `Thrasios + Tymna`.

## Hosting (GitHub Pages, free)

1. Create a public repo on GitHub, e.g. `pod-stats`.
2. Push this folder to it.
3. In the repo, go to **Settings → Pages → Build and deployment**, set Source to *Deploy from a branch*, then choose Branch `main` and folder `/ (root)`.
4. The site is live at `https://<your-username>.github.io/pod-stats/` within a minute or so.

Every push to `main` redeploys the site automatically.

## Running locally

Any static file server works. ES modules don't load from `file://`, so opening `index.html` directly won't work.
