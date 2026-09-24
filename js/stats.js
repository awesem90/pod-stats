// Every stat is a pure function of (games, range, season).
import { CONFIG } from './config.js';
import { commanderColors } from './data.js';

export const pct = (w, g) => g ? Math.round(w / g * 100) : 0;
export const nl1 = v => v.toFixed(1).replace('.', ',');
const MONTHS_LONG = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const MONTHS_SHORT = ['JAN', 'FEB', 'MRT', 'APR', 'MEI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC'];
export const shortDate = iso => { const [, m, d] = iso.split('-'); return d + ' ' + MONTHS_SHORT[+m - 1]; };
export const monthYear = iso => { const [y, m] = iso.split('-'); return MONTHS_LONG[+m - 1] + ' ' + y; };
export const COLOR_NL = { W: 'Wit', U: 'Blauw', B: 'Zwart', R: 'Rood', G: 'Groen' };

export function seasons(games) { return [...new Set(games.map(g => +g.date.slice(0, 4)))].sort(); }

export function pickSeason(games) {
  if (CONFIG.season !== 'auto') return +CONFIG.season;
  const ys = seasons(games);
  return ys.length ? ys[ys.length - 1] : new Date().getFullYear();
}

const streakOf = results => {
  if (!results.length) return 0;
  const last = results[results.length - 1]; let n = 0;
  for (let i = results.length - 1; i >= 0 && results[i] === last; i--) n++;
  return last ? n : -n;
};
export const fmtStreak = s => s > 0 ? '+' + s : s < 0 ? '–' + (-s) : '0';

// Most-played value with ties broken by most recent use.
function mostPlayed(list) {
  const c = new Map();
  list.forEach((v, i) => { if (!v) return; const e = c.get(v) || { n: 0, last: 0 }; e.n++; e.last = i; c.set(v, e); });
  let best = null, be = null;
  for (const [v, e] of c) if (!be || e.n > be.n || (e.n === be.n && e.last > be.last)) { best = v; be = e; }
  return best;
}

export function computeStats(allGames, { range, season }) {
  const seasonGames = allGames.filter(g => +g.date.slice(0, 4) === season);
  const games = range === 'last10' ? seasonGames.slice(-CONFIG.lastN) : seasonGames;

  const firstSeen = {};
  allGames.forEach(g => g.seats.forEach(s => { if (!firstSeen[s.player]) firstSeen[s.player] = g.date; }));

  // ----- Per player -----
  const P = new Map();
  const player = name => {
    if (!P.has(name)) P.set(name, { name, games: 0, wins: 0, results: [], commanders: [], decks: new Map(), log: [], colorGames: {} });
    return P.get(name);
  };
  let seats = 0, wins = 0;
  const C = new Map(); // commander -> { name, games, wins, pilots: Map, archetypes: [], colors }

  for (const g of games) {
    for (const s of g.seats) {
      const p = player(s.player);
      p.games++; seats++;
      if (s.win) { p.wins++; wins++; }
      p.results.push(s.win);
      p.log.push({ game: g, seat: s });
      if (s.commander) {
        p.commanders.push(s.commander);
        const colors = commanderColors(s.commander, s.colors);
        const d = p.decks.get(s.commander) || { name: s.commander, games: 0, wins: 0, archetypes: [], colors };
        d.games++; if (s.win) d.wins++; if (s.archetype) d.archetypes.push(s.archetype);
        if (!d.colors.length) d.colors = colors;
        p.decks.set(s.commander, d);
        colors.forEach(c => { p.colorGames[c] = (p.colorGames[c] || 0) + 1; });

        const c = C.get(s.commander) || { name: s.commander, games: 0, wins: 0, pilots: new Map(), archetypes: [], colors };
        c.games++; if (s.win) c.wins++; if (s.archetype) c.archetypes.push(s.archetype);
        if (!c.colors.length) c.colors = colors;
        const pl = c.pilots.get(s.player) || { name: s.player, games: 0, wins: 0 };
        pl.games++; if (s.win) pl.wins++;
        c.pilots.set(s.player, pl);
        C.set(s.commander, c);
      }
    }
  }

  const avg = seats ? wins / seats * 100 : 0;

  const players = [...P.values()].map(p => {
    const mainDeck = mostPlayed(p.commanders);
    const deck = mainDeck ? p.decks.get(mainDeck) : null;
    return {
      ...p,
      rate: pct(p.wins, p.games),
      exact: p.games ? p.wins / p.games * 100 : 0,
      streak: streakOf(p.results),
      mainDeck,
      mainColors: deck ? deck.colors : [],
    };
  }).sort((a, b) => b.exact - a.exact || b.wins - a.wins || b.games - a.games || a.name.localeCompare(b.name));
  players.forEach((p, i) => { p.rank = i + 1; });

  // ----- Form notes -----
  const last5 = p => p.results.slice(-5);
  const bestFormWins = Math.max(0, ...players.map(p => last5(p).filter(Boolean).length));
  players.forEach(p => {
    const r = p.results, f = last5(p), fw = f.filter(Boolean).length;
    let note;
    if (!r.length) note = 'nog geen potjes';
    else if (p.streak >= 2) note = p.streak + ' op een rij';
    else if (p.streak <= -3) note = (-p.streak) + ' potjes zonder winst';
    else if (p.streak === 1) {
      let dry = 0; for (let i = r.length - 2; i >= 0 && !r[i]; i--) dry++;
      note = dry >= 3 ? 'eerste winst in ' + (dry + 1) + ' potjes' : fw + ' winst' + (fw === 1 ? '' : 'en') + ' in ' + f.length + ' potjes';
    } else note = fw ? 'wisselend · ' + fw + ' uit ' + f.length : 'nog geen winst in de laatste ' + f.length;
    if (fw > 0 && fw === bestFormWins && players.filter(x => last5(x).filter(Boolean).length === fw).length === 1) note += ' · beste vorm';
    p.formNote = note;
    p.form = f;
  });

  // ----- Commanders -----
  const commanders = [...C.values()].map(c => ({
    ...c,
    rate: pct(c.wins, c.games), exact: c.games ? c.wins / c.games * 100 : 0,
    archetype: mostPlayed(c.archetypes) || '',
    pilotList: [...c.pilots.values()].sort((a, b) => b.games - a.games),
  }));
  const strong = commanders
    .filter(c => c.games >= CONFIG.minCommanderGames && c.exact > avg)
    .sort((a, b) => b.exact - a.exact || b.games - a.games);
  const shared = commanders
    .filter(c => c.pilots.size >= 2)
    .sort((a, b) => b.games - a.games);

  // ----- Rivalry matrix -----
  const names = players.map(p => p.name);
  const together = {}; // together[a][b] = { games, winsA }
  names.forEach(a => { together[a] = {}; names.forEach(b => { together[a][b] = { games: 0, wins: 0 }; }); });
  for (const g of games) {
    for (const s of g.seats) for (const o of g.seats) {
      if (s.player === o.player) continue;
      const t = together[s.player][o.player];
      t.games++; if (s.win) t.wins++;
    }
  }
  const matrix = names.map(a => ({
    name: a,
    cells: names.map(b => a === b ? null : { vs: b, games: together[a][b].games, rate: pct(together[a][b].wins, together[a][b].games) }),
  }));

  // ----- Rivalry callouts -----
  const rivalries = [];
  let gap = null;
  matrix.forEach(row => {
    const cells = row.cells.filter(c => c && c.games >= 3);
    if (cells.length < 2) return;
    const lo = cells.reduce((m, c) => c.rate < m.rate ? c : m);
    const hi = cells.reduce((m, c) => c.rate > m.rate ? c : m);
    if (!gap || hi.rate - lo.rate > gap.hi.rate - gap.lo.rate) gap = { name: row.name, lo, hi };
  });
  if (gap && gap.hi.rate > gap.lo.rate) {
    rivalries.push(`${gap.name} wint ${gap.lo.rate}% als ${gap.lo.vs} aan tafel zit, tegen ${gap.hi.rate}% tegen ${gap.hi.vs} — de scherpste eenzijdige rivaliteit van de pod.`);
  }
  let pair = null;
  names.forEach((a, i) => names.slice(i + 1).forEach(b => {
    const t = together[a][b];
    if (!pair || t.games > pair.games) pair = { a, b, games: t.games, wins: t.wins + together[b][a].wins };
  }));
  if (pair && pair.games > 0) {
    rivalries.push(`${pair.a} en ${pair.b} zitten ${pair.games} keer samen aan tafel; samen pakken zij ${pair.wins} van die ${pair.games} potjes.`);
  }

  // ----- KPIs -----
  const longest = players.filter(p => p.streak > 0).sort((a, b) => b.streak - a.streak)[0] || null;
  const uniqueCommanders = new Set(games.flatMap(g => g.seats.map(s => s.commander).filter(Boolean))).size;

  return {
    season, range, games, seasonGames, avg, players, names, commanders, strong, shared, matrix, rivalries, together,
    seats, wins, longest, uniqueCommanders, firstSeen,
    avgSeats: games.length ? seats / games.length : 0,
    avgWinsPerPlayer: players.length ? wins / players.length : 0,
    commanderColors,
  };
}
