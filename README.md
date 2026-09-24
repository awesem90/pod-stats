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

The sheet must be shared as **Anyone with the link → Viewer**. The site expects **one row per player per game**, with a header row. Column names are matched loosely, in Dutch or English:

| Column | Required | Examples |
|---|---|---|
| `Datum` / `Date` | yes | `24-9-2026`, `2026-09-24` |
| `Speler` / `Player` | yes | `Joost` |
| `Commander` / `Deck` | recommended | `Kinnan, Bonder Prodigy`. For partners, use `Thrasios / Tymna` |
| `Winst` / `Win` | yes | `1`, `x`, `ja`, `TRUE` (anything else counts as a loss) |
| `Potje` / `Game` | optional | a number. Needed when you play more than one game per night |
| `Kleuren` / `Colors` | optional | `WUBG`. If blank, it is looked up on Scryfall |
| `Archetype` | optional | `Ramp · combo` |

Commander artwork and colour identity come from [Scryfall](https://scryfall.com).

## Hosting (GitHub Pages, free)

1. Create a public repo on GitHub, e.g. `pod-stats`.
2. Push this folder to it.
3. In the repo, go to **Settings → Pages → Build and deployment**, set Source to *Deploy from a branch*, then choose Branch `main` and folder `/ (root)`.
4. The site is live at `https://<your-username>.github.io/pod-stats/` within a minute or so.

Every push to `main` redeploys the site automatically.

## Running locally

Any static file server works. ES modules don't load from `file://`, so opening `index.html` directly won't work.
