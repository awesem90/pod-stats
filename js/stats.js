// Every stat is a pure function of (games, range, season).
import { CONFIG } from './config.js';

export const pct = (w, g) => g ? Math.round(w / g * 100) : 0;
export const dec1 = v => v.toFixed(1);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dateOf = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export const shortDate = iso => { const d = dateOf(iso); return MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate(); };
export const longDate = iso => { const d = dateOf(iso); return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };
export const monthYear = iso => { const d = dateOf(iso); return MONTHS[d.getMonth()] + ' ' + d.getFullYear(); };
export const fmtMinutes = m => m >= 60 ? Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm' : m + ' min';
export const COLOR_NAME = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };
// Every colour identity (letters in WUBRG order) with its usual Magic name.
export const COMBO_NAME = {
  '': 'Colourless',
  W: 'Mono-White', U: 'Mono-Blue', B: 'Mono-Black', R: 'Mono-Red', G: 'Mono-Green',
  WU: 'Azorius', WB: 'Orzhov', WR: 'Boros', WG: 'Selesnya', UB: 'Dimir', UR: 'Izzet', UG: 'Simic', BR: 'Rakdos', BG: 'Golgari', RG: 'Gruul',
  WUB: 'Esper', WUR: 'Jeskai', WUG: 'Bant', WBR: 'Mardu', WBG: 'Abzan', WRG: 'Naya', UBR: 'Grixis', UBG: 'Sultai', URG: 'Temur', BRG: 'Jund',
  WUBR: 'Yore-Tree', WUBG: 'Witch-Maw', WURG: 'Ink-Treader', WBRG: 'Dune-Brood', UBRG: 'Glint-Eye',
  WUBRG: 'Five-colour',
};

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
    if (!P.has(name)) P.set(name, { name, games: 0, wins: 0, results: [], commanders: [], decks: new Map(), log: [], starts: 0, startWins: 0, winList: [], ubGames: 0, minutes: [], rounds: [] });
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
      if (s.ub) p.ubGames++;
      if (g.minutes) p.minutes.push(g.minutes);
      if (g.rounds) p.rounds.push(g.rounds);
      p.results.push(s.win);
      p.log.push({ game: g, seat: s });
      const win = { player: s.player, commander: s.commander, rounds: g.rounds, minutes: g.minutes, date: g.date };
      if (s.win) { p.winList.push(win); allWins.push(win); }
      if (!s.commander) continue;

      p.commanders.push(s.commander);
      const d = p.decks.get(s.commander) || { name: s.commander, parts: s.parts, colors: s.colors, games: 0, wins: 0 };
      d.games++; if (s.win) d.wins++;
      p.decks.set(s.commander, d);

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

  // Colour habits always count every game a player ever played, whatever the edition:
  // each game adds one per colour in the deck's identity, and one for its exact colour
  // combination (an Abzan deck counts as Abzan only, never as Golgari).
  const palette = {};
  allGames.forEach((g, i) => g.seats.forEach(s => {
    if (!s.commander) return;
    const a = palette[s.player] ||= { games: 0, colors: {}, combos: {}, comboWins: {}, comboLast: {} };
    a.games++;
    s.colors.forEach(c => { a.colors[c] = (a.colors[c] || 0) + 1; });
    const k = s.colors.join('');
    a.combos[k] = (a.combos[k] || 0) + 1;
    a.comboWins[k] = (a.comboWins[k] || 0) + (s.win ? 1 : 0);
    a.comboLast[k] = i;
  }));
  // One favourite combination: most games, then most wins with it, then the most recently played.
  const topCombo = a => {
    const k = Object.keys(a.combos).sort((x, y) => a.combos[y] - a.combos[x] || a.comboWins[y] - a.comboWins[x] || a.comboLast[y] - a.comboLast[x])[0];
    return k === undefined ? null : { keys: [k], n: a.combos[k] };
  };
  // The most-played entries as { keys, n }; a tie returns all of them, in WUBRG order.
  const top = (counts, order) => {
    const n = Math.max(0, ...Object.values(counts));
    const keys = Object.keys(counts).filter(k => counts[k] === n).sort((x, y) => order.indexOf(x) - order.indexOf(y));
    return n ? { keys, n } : null;
  };

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
      avgMinutes: Math.round(mean(p.minutes)),
      avgRounds: mean(p.rounds),
      palette: {
        games: palette[p.name]?.games || 0,
        color: top(palette[p.name]?.colors || {}, 'WUBRG'),
        combo: palette[p.name] ? topCombo(palette[p.name]) : null,
      },
    };
  }).map(p => ({ ...p, qualified: p.games >= minGames }))
    // Players below the threshold are listed after the ranked ones, without a rank.
    .sort((a, b) => b.qualified - a.qualified || b.exact - a.exact || b.wins - a.wins || b.games - a.games || a.name.localeCompare(b.name));
  players.forEach((p, i) => { p.rank = p.qualified ? i + 1 : null; });


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
    rivalries.push(`${gap.name} wins ${gap.lo.rate}% with ${gap.lo.vs} at the table, against ${gap.hi.rate}% with ${gap.hi.vs} there — the sharpest one-sided rivalry in the pod.`);
  }
  let pair = null;
  names.forEach((a, i) => names.slice(i + 1).forEach(b => {
    const t = together[a][b];
    if (!pair || t.games > pair.games) pair = { a, b, games: t.games, wins: t.wins + together[b][a].wins };
  }));
  if (pair && pair.games > 0) {
    rivalries.push(`${pair.a} and ${pair.b} shared a table ${pair.games} times; between them they took ${pair.wins} of those ${pair.games} games.`);
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
    oddities: oddities(games, avg),
    colourStandings: colourStandings(games),
    ub: universesBeyond(games),
  };
}

// ----- Oddities: funny things in the numbers, each only shown when it's actually notable -----
const names = list => list.length > 1 ? list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1] : list[0];
const leaders = counts => {
  const n = Math.max(0, ...Object.values(counts));
  return { n, who: Object.keys(counts).filter(k => counts[k] === n).sort() };
};

function oddities(games, avg) {
  const out = [];
  const add = (title, text) => out.push({ title, text });
  const byPlayer = {};
  games.forEach(g => g.seats.forEach(s => (byPlayer[s.player] ||= []).push({ g, s })));

  // The longest losing run anyone has had.
  let dry = null;
  for (const [name, list] of Object.entries(byPlayer)) {
    let run = 0, best = 0;
    list.forEach(({ s }) => { run = s.win ? 0 : run + 1; best = Math.max(best, run); });
    if (!dry || best > dry.n) dry = { name, n: best };
  }
  if (dry && dry.n >= 6) add('The long drought', `${dry.name} once went ${dry.n} games in a row without a win — the longest dry spell in the pod.`);

  // Who swaps decks most, and who sticks to one.
  const habits = Object.entries(byPlayer).filter(([, l]) => l.length >= 8).map(([name, l]) => {
    const c = {};
    l.forEach(({ s }) => { if (s.commander) c[s.commander] = (c[s.commander] || 0) + 1; });
    const [fav, favN] = Object.entries(c).sort((a, b) => b[1] - a[1])[0] || [null, 0];
    return { name, games: l.length, distinct: Object.keys(c).length, fav, favN };
  });
  const hopper = habits.slice().sort((a, b) => b.distinct / b.games - a.distinct / a.games)[0];
  if (hopper && hopper.distinct / hopper.games >= 0.5) {
    add('The deck hopper', `${hopper.name} has brought ${hopper.distinct} different commanders to ${hopper.games} games — ${hopper.distinct / hopper.games >= 0.8 ? 'hardly ever the same deck twice' : 'a new deck almost every other game'}.`);
  }
  const loyal = habits.slice().sort((a, b) => b.favN / b.games - a.favN / a.games)[0];
  if (loyal && loyal.fav && loyal.favN / loyal.games >= 0.35 && loyal !== hopper) {
    add('The loyalist', `${loyal.name} played *${loyal.fav}* in ${loyal.favN} of ${loyal.games} games. If it ain’t broke…`);
  }

  // Someone who almost never leaves the licensed worlds of Universes Beyond.
  const beyond = Object.entries(byPlayer).filter(([, l]) => l.length >= 8)
    .map(([name, l]) => ({ name, games: l.length, ub: l.filter(x => x.s.ub).length }))
    .sort((a, b) => b.ub / b.games - a.ub / a.games)[0];
  if (beyond && beyond.ub / beyond.games >= 0.75) {
    add('Lost in the multiverse', `${beyond.name} brought a Universes Beyond commander to ${beyond.ub} of ${beyond.games} games (${pct(beyond.ub, beyond.games)}%). Regular Magic need not apply.`);
  }

  // The usual game night.
  const wd = {};
  games.forEach(g => { const d = DAYS[dateOf(g.date).getDay()]; wd[d] = (wd[d] || 0) + 1; });
  const night = leaders(wd);
  if (games.length >= 10 && night.who.length === 1 && night.n / games.length >= 0.4) {
    add(`${night.who[0]} is game night`, `${night.n} of ${games.length} games were played on a ${night.who[0]}.`);
  }

  // Who wins the first game of the night, and who wins the last one.
  const nights = {};
  games.forEach(g => (nights[g.date] ||= []).push(g));
  const multi = Object.values(nights).filter(n => n.length >= 2).map(n => n.slice().sort((a, b) => (a.time || '').localeCompare(b.time || '')));
  if (multi.length >= 4) {
    const firsts = {}, lasts = {};
    multi.forEach(n => {
      n[0].seats.filter(s => s.win).forEach(s => { firsts[s.player] = (firsts[s.player] || 0) + 1; });
      n[n.length - 1].seats.filter(s => s.win).forEach(s => { lasts[s.player] = (lasts[s.player] || 0) + 1; });
    });
    const f = leaders(firsts), l = leaders(lasts);
    if (f.n >= 3) add('The opening act', `${names(f.who)} won the first game of the night ${f.n} times, more than anyone else, across ${multi.length} nights with more than one game.`);
    if (l.n >= 3) add('The nightcap', `When it’s the last game of the night, bet on ${names(l.who)}: ${l.n} last-game wins${l.who.length > 1 ? ' each' : ''}.`);
  }

  // Two commanders against one.
  const seatsOf = pred => { let g = 0, w = 0; games.forEach(x => x.seats.forEach(s => { if (pred(s)) { g++; if (s.win) w++; } })); return { g, w, r: pct(w, g) }; };
  const duo = seatsOf(s => s.parts.length > 1), solo = seatsOf(s => s.parts.length === 1);
  if (duo.g >= 8 && solo.g >= 8 && Math.abs(duo.r - solo.r) >= 8) {
    add(duo.r > solo.r ? 'Two heads are better than one' : 'Too many cooks', `Decks with two commanders win ${duo.r}% of their games (${duo.w} of ${duo.g}); single commanders ${solo.r}%.`);
  }

  // The luckiest and unluckiest colour.
  const colours = 'WUBRG'.split('').map(c => ({ c, ...seatsOf(s => s.colors.includes(c)) })).filter(x => x.g >= 20).sort((a, b) => b.r - a.r);
  if (colours.length >= 2 && colours[0].r - colours[colours.length - 1].r >= 4) {
    const hi = colours[0], lo = colours[colours.length - 1];
    add('The colour of victory', `Decks with ${COLOR_NAME[hi.c].toLowerCase()} in them win ${hi.r}% of their games; decks with ${COLOR_NAME[lo.c].toLowerCase()} just ${lo.r}%.`);
  }

  // A player who shines in one particular kind of game night (BG Stats location).
  let venue = null;
  for (const [name, list] of Object.entries(byPlayer)) {
    const locs = [...new Set(list.map(({ g }) => g.location).filter(Boolean))];
    for (const loc of locs) {
      const here = list.filter(({ g }) => g.location === loc), there = list.filter(({ g }) => g.location !== loc);
      if (here.length < 4 || there.length < 4) continue;
      const r = pct(here.filter(x => x.s.win).length, here.length), o = pct(there.filter(x => x.s.win).length, there.length);
      if (r - o >= 25 && (!venue || r - o > venue.r - venue.o)) venue = { name, loc, w: here.filter(x => x.s.win).length, n: here.length, r, o };
    }
  }
  if (venue) add('Location, location, location', `${venue.name} wins ${venue.w} of ${venue.n} games logged as “${venue.loc}” (${venue.r}%), against ${venue.o}% everywhere else.`);

  // The most-played deck that has never won.
  const decks = {};
  games.forEach(g => g.seats.forEach(s => { if (!s.commander) return; const k = s.player + '\u0000' + s.commander; const d = decks[k] ||= { player: s.player, cmd: s.commander, g: 0, w: 0 }; d.g++; if (s.win) d.w++; }));
  const cursed = Object.values(decks).filter(d => d.w === 0 && d.g >= 4).sort((a, b) => b.g - a.g)[0];
  if (cursed) add('The cursed deck', `*${cursed.cmd}* has been to ${cursed.g} games with ${cursed.player} and has yet to win one.`);

  // How often a deck wins on its very first outing.
  const seen = new Set(); let debuts = 0, debutWins = 0;
  games.forEach(g => g.seats.forEach(s => { const k = s.player + '\u0000' + s.commander; if (s.commander && !seen.has(k)) { seen.add(k); debuts++; if (s.win) debutWins++; } }));
  if (debuts >= 10) {
    const r = pct(debutWins, debuts);
    add('Beginner’s luck?', `${debutWins} of ${debuts} decks won on their debut (${r}%), against a pod average of ${Math.round(avg)}%. ${r < avg - 3 ? 'New decks need a few games to find their feet.' : r > avg + 3 ? 'Fresh decks hit harder than you’d think.' : 'A debut is no better or worse than any other game.'}`);
  }

  // The clock.
  const both = games.filter(g => g.rounds && g.minutes);
  const quickest = games.filter(g => g.minutes).sort((a, b) => a.minutes - b.minutes)[0];
  if (both.length >= 5 && quickest) {
    const perRound = both.reduce((t, g) => t + g.minutes / g.rounds, 0) / both.length;
    const qWinner = quickest.seats.filter(s => s.win).map(s => s.player);
    add('Watch the clock', `A round takes ${perRound.toFixed(1)} minutes on average. The quickest game on record lasted ${quickest.minutes} minutes${qWinner.length ? `; ${names(qWinner)} won it` : ''}.`);
  }

  return out;
}

// ----- Colour standings: the five colours, and every exact colour combination, by win rate -----
const COMBO_KIND = ['Colourless', 'Mono-colour', 'Two-colour', 'Three-colour', 'Four-colour', 'Five-colour'];
const byRate = (a, b) => b.exact - a.exact || b.games - a.games;

function colourStandings(games) {
  const colour = {}, combo = {};
  const tally = (map, key) => (map[key] ||= { key, games: 0, wins: 0 });
  games.forEach(g => g.seats.forEach(s => {
    if (!s.commander) return;
    // A deck counts for each colour in its identity, and for its one exact combination.
    s.colors.forEach(c => { const t = tally(colour, c); t.games++; if (s.win) t.wins++; });
    const t = tally(combo, s.colors.join('')); t.games++; if (s.win) t.wins++;
  }));
  const finish = t => ({ ...t, rate: pct(t.wins, t.games), exact: t.games ? t.wins / t.games : 0, kind: COMBO_KIND[t.key.length] });
  return {
    colours: 'WUBRG'.split('').map(c => finish(colour[c] || { key: c, games: 0, wins: 0 })).sort(byRate),
    combos: Object.values(combo).map(finish).sort(byRate),
    unplayed: Object.keys(COMBO_NAME).filter(k => !combo[k]),
  };
}

// ----- Universes Beyond: how often a licensed-world commander (Lord of the Rings, Final Fantasy, ...) sits at the table -----
function universesBeyond(games) {
  let seats = 0, ub = 0, ubWins = 0, restWins = 0;
  const cmd = {};
  games.forEach(g => g.seats.forEach(s => {
    if (!s.commander) return;
    seats++;
    if (s.ub) {
      ub++; if (s.win) ubWins++;
      cmd[s.commander] = (cmd[s.commander] || 0) + 1;
    } else if (s.win) restWins++;
  }));
  const [topName, topGames] = Object.entries(cmd).sort((a, b) => b[1] - a[1])[0] || [null, 0];
  return { seats, ub, share: pct(ub, seats), ubWins, rate: pct(ubWins, ub), restRate: pct(restWins, seats - ub), topName, topGames };
}
