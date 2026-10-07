// Every stat is a pure function of (games, range, season).
import { CONFIG } from './config.js';

export const pct = (w, g) => g ? Math.round(w / g * 100) : 0;
export const nl1 = v => v.toFixed(1).replace('.', ',');
const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const DAYS = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const dateOf = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export const shortDate = iso => { const d = dateOf(iso); return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3); };
export const longDate = iso => { const d = dateOf(iso); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
export const monthYear = iso => { const d = dateOf(iso); return MONTHS[d.getMonth()] + ' ' + d.getFullYear(); };
export const fmtMinutes = m => m >= 60 ? Math.floor(m / 60) + 'u' + String(m % 60).padStart(2, '0') : m + ' min';
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
const mean = list => list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;

// Most-played value with ties broken by most recent use.
function mostPlayed(list) {
  const c = new Map();
  list.forEach((v, i) => { if (!v) return; const e = c.get(v) || { n: 0, last: 0 }; e.n++; e.last = i; c.set(v, e); });
  let best = null, be = null;
  for (const [v, e] of c) if (!be || e.n > be.n || (e.n === be.n && e.last > be.last)) { best = v; be = e; }
  return best;
}

// The win that took the fewest rounds (ties: the shortest in minutes, then the oldest).
const fastest = wins => wins.filter(w => w.rounds).sort((a, b) => a.rounds - b.rounds || (a.minutes || 1e9) - (b.minutes || 1e9))[0] || null;

export function computeStats(allGames, { range, season }) {
  const seasonGames = allGames.filter(g => +g.date.slice(0, 4) === season);
  const games = range === 'all' ? allGames : range === 'last10' ? seasonGames.slice(-CONFIG.lastN) : seasonGames;

  const firstSeen = {};
  allGames.forEach(g => g.seats.forEach(s => { if (!firstSeen[s.player]) firstSeen[s.player] = g.date; }));

  const P = new Map(); // player -> stats
  const C = new Map(); // commander -> stats
  const player = name => {
    if (!P.has(name)) P.set(name, { name, games: 0, wins: 0, results: [], commanders: [], decks: new Map(), log: [], colorGames: {}, starts: 0, startWins: 0, winList: [] });
    return P.get(name);
  };
  let seats = 0, wins = 0;
  const allWins = [];

  for (const g of games) {
    for (const s of g.seats) {
      const p = player(s.player);
      p.games++; seats++;
      if (s.win) { p.wins++; wins++; }
      if (s.starter) { p.starts++; if (s.win) p.startWins++; }
      p.results.push(s.win);
      p.log.push({ game: g, seat: s });
      const win = { player: s.player, commander: s.commander, rounds: g.rounds, minutes: g.minutes, date: g.date };
      if (s.win) { p.winList.push(win); allWins.push(win); }
      if (!s.commander) continue;

      p.commanders.push(s.commander);
      const d = p.decks.get(s.commander) || { name: s.commander, parts: s.parts, colors: s.colors, games: 0, wins: 0 };
      d.games++; if (s.win) d.wins++;
      p.decks.set(s.commander, d);
      s.colors.forEach(c => { p.colorGames[c] = (p.colorGames[c] || 0) + 1; });

      const c = C.get(s.commander) || { name: s.commander, parts: s.parts, colors: s.colors, games: 0, wins: 0, pilots: new Map(), rounds: [], winList: [], last: '' };
      c.games++; if (s.win) { c.wins++; c.winList.push(win); }
      if (g.rounds) c.rounds.push(g.rounds);
      c.last = g.date;
      const pl = c.pilots.get(s.player) || { name: s.player, games: 0, wins: 0 };
      pl.games++; if (s.win) pl.wins++;
      c.pilots.set(s.player, pl);
      C.set(s.commander, c);
    }
  }

  const avg = seats ? wins / seats * 100 : 0;
  // A rank needs a fair share of the edition's games, so 3 wins in 8 games can't top 11 in 31.
  const minGames = Math.max(1, Math.ceil(games.length * CONFIG.minGamesShare));

  const players = [...P.values()].map(p => {
    const mainDeck = mostPlayed(p.commanders);
    return {
      ...p,
      rate: pct(p.wins, p.games),
      exact: p.games ? p.wins / p.games * 100 : 0,
      streak: streakOf(p.results),
      mainDeck,
      mainParts: mainDeck ? p.decks.get(mainDeck).parts : [],
      mainColors: mainDeck ? p.decks.get(mainDeck).colors : [],
      fastest: fastest(p.winList),
      winRounds: mean(p.winList.filter(w => w.rounds).map(w => w.rounds)),
    };
  }).map(p => ({ ...p, qualified: p.games >= minGames }))
    // Players below the threshold are listed after the ranked ones, without a rank.
    .sort((a, b) => b.qualified - a.qualified || b.exact - a.exact || b.wins - a.wins || b.games - a.games || a.name.localeCompare(b.name));
  players.forEach((p, i) => { p.rank = p.qualified ? i + 1 : null; });

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
    } else note = fw ? 'wisselend, ' + fw + ' uit ' + f.length : 'nog geen winst in de laatste ' + f.length;
    if (fw > 0 && fw === bestFormWins && players.filter(x => last5(x).filter(Boolean).length === fw).length === 1) note += ', beste vorm';
    p.formNote = note;
    p.form = f;
  });

  // ----- Commanders: all of them, best winrate first -----
  const commanders = [...C.values()].map(c => ({
    ...c,
    rate: pct(c.wins, c.games), exact: c.games ? c.wins / c.games * 100 : 0,
    avgRounds: mean(c.rounds),
    fastest: fastest(c.winList),
    pilotList: [...c.pilots.values()].sort((a, b) => b.games - a.games || a.name.localeCompare(b.name)),
  })).sort((a, b) => b.exact - a.exact || b.games - a.games || a.name.localeCompare(b.name));
  commanders.forEach((c, i) => { c.rank = i + 1; });
  const strong = commanders.filter(c => c.games >= CONFIG.minCommanderGames && c.exact > avg);
  const shared = commanders.filter(c => c.pilots.size >= 2).sort((a, b) => b.games - a.games);

  // ----- Rivalry matrix -----
  const names = players.map(p => p.name);
  const together = {};
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
    rivalries.push(`${gap.name} wint ${gap.lo.rate}% als ${gap.lo.vs} aan tafel zit, tegen ${gap.hi.rate}% met ${gap.hi.vs} erbij — de scherpste eenzijdige rivaliteit van de pod.`);
  }
  let pair = null;
  names.forEach((a, i) => names.slice(i + 1).forEach(b => {
    const t = together[a][b];
    if (!pair || t.games > pair.games) pair = { a, b, games: t.games, wins: t.wins + together[b][a].wins };
  }));
  if (pair && pair.games > 0) {
    rivalries.push(`${pair.a} en ${pair.b} zaten ${pair.games} keer samen aan tafel; samen pakten zij ${pair.wins} van die ${pair.games} potjes.`);
  }

  // ----- Start player and rounds -----
  const withStarter = games.filter(g => g.seats.some(s => s.starter));
  const starterWins = withStarter.filter(g => g.seats.some(s => s.starter && s.win)).length;
  // What a start player would win by pure chance: one in (players at the table).
  const starterChance = mean(withStarter.map(g => 100 / g.seats.length));
  const withRounds = games.filter(g => g.rounds);
  const timed = games.filter(g => g.minutes);
  const longestGame = timed.reduce((m, g) => (!m || g.minutes > m.minutes ? g : m), null);

  const longest = players.filter(p => p.streak > 0).sort((a, b) => b.streak - a.streak)[0] || null;

  return {
    season, range, games, seasonGames, allGames, avg, players, ranked: players.filter(p => p.qualified), minGames, names, commanders, strong, shared, matrix, rivalries, together,
    seats, wins, longest, firstSeen,
    uniqueCommanders: commanders.length,
    avgSeats: games.length ? seats / games.length : 0,
    avgWinsPerPlayer: players.length ? wins / players.length : 0,
    starterGames: withStarter.length, starterWins, starterRate: pct(starterWins, withStarter.length), starterChance,
    roundGames: withRounds.length, avgRounds: mean(withRounds.map(g => g.rounds)),
    timedGames: timed.length, avgMinutes: Math.round(mean(timed.map(g => g.minutes))), longestGame,
    fastestWin: fastest(allWins),
  };
}
