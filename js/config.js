// Everything you are likely to tweak lives here.
export const CONFIG = {
  // Generated from a BG Stats export by tools/import-bgstats.ps1
  dataFile: 'data/pod.json',

  // Masthead
  paper: 'The Pod Times',
  motto: '“Alle stats die het drukken waard zijn.”',
  city: 'AMSTERDAM',
  price: 'PRIJS: ÉÉN MANA',

  // Stats
  season: 'auto',           // a year like 2026, or 'auto' = the latest year with games
  minGamesShare: 0.25,      // a rank needs at least this share of the edition's games
  minCommanderGames: 3,     // "Commanders boven pod-gemiddelde" threshold
  lastN: 10,                // the "Laatste N" edition

  // Display
  showArtwork: true,
  showRivalry: true,
};
