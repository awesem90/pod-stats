// Everything you are likely to tweak lives here.
export const CONFIG = {
  // The Google Sheet. It must be shared as "Anyone with the link can view".
  sheetId: '1aPBhP5bHYOHX0Ga5YbpJovJDKwzNPBffUYn-vhhJUUs',
  // Tab name inside the sheet. Leave empty to use the first tab.
  sheetTab: '',

  // Hero copy
  podName: ['Donderdag', 'pod'],
  tagline: 'Wie wint er echt — en trekt het deck of de speler?',
  source: 'BRON: POD-SPREADSHEET (POTJES, DECKS & COMMANDERS)',

  // Stats
  season: 'auto',           // a year like 2026, or 'auto' = the latest year with games
  minCommanderGames: 5,     // "Commanders boven pod-gemiddelde" threshold
  lastN: 10,                // the "Laatste N" range toggle

  // Display
  showMana: true,
  showArtwork: true,
  showRivalry: true,

  // Map spelling variants in the sheet to one display name, e.g. { 'sem m': 'Sem' }
  nameMap: {},

  // Pin a nickname from the form to one exact card when the automatic Scryfall match is wrong.
  // Keys are lowercase, e.g. { 'yshtola': "Y'shtola, Night's Blessed", 'ashling': 'Ashling, Flame Dancer' }
  commanderMap: {
    'yshtola': "Y'shtola, Night's Blessed",
    'ashling': 'Ashling, the Limitless',
  },
};
