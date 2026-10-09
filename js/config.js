// Everything you are likely to tweak lives here.
export const CONFIG = {
  // Generated from a BG Stats export by tools/import-bgstats.ps1
  dataFile: 'data/pod.json',
  // Front-page articles, newest first. Add an entry to publish one.
  articlesFile: 'data/articles.json',

  // Masthead
  paper: 'The Pod Times',
  motto: '“All the Stats That Are Fit to Print.”',
  city: 'AMSTERDAM',
  price: 'PRICE: ONE MANA',

  // BG Stats location names, as shown on the site
  locationNames: { Elders: 'Away', Thuis: 'Home', 'Zonder mij': 'Without Sem' },

  // Stats
  season: 'auto',           // a year like 2026, or 'auto' = the latest year with games
  minGamesShare: 0.25,      // a rank needs at least this share of the edition's games
  minCommanderGames: 3,     // "Commanders above average" threshold
  lastN: 10,                // the "Last N" edition
  frontPageArticles: 2,     // how many of the newest articles the front page shows

  // Display
  showArtwork: true,
  showRivalry: true,
};
