// HTML for every page, set like an old broadsheet. Everything is built from the stats object.
import { CONFIG } from './config.js';
import { card, norm } from './data.js';
import { pct, dec1, fmtStreak, fmtMinutes, shortDate, longDate, monthYear, COLOR_NAME } from './stats.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const playerHref = name => '#/player/' + encodeURIComponent(name);
const gamesHref = name => '#/games' + (name ? '/' + encodeURIComponent(name) : '');
const two = n => String(n).padStart(2, '0');
const roman = n => [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']].reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, '');
const plural = (n, word, many = word + 's') => `${n} ${n === 1 ? word : many}`;
// "Breeches, Brazen Plunderer & Malcolm, Keen-Eyed Navigator" -> "Breeches & Malcolm"
const shortName = parts => (parts || []).map(p => p.split(',')[0]).join(' & ');
const rounds = n => plural(n, 'round');
const scope = st => st.range === 'all' ? 'across all games' : st.range === 'last10' ? `over the last ${st.games.length} games` : `in the ${st.season} season`;
// *text* in article copy becomes italics; everything else is escaped.
const inline = s => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');

// Commander name(s) linked to Scryfall; partners get one link each ("Frodo… & Sam…").
function cmdLinks(parts, fallback = '—') {
  if (!parts || !parts.length) return esc(fallback);
  return parts.map(p => {
    const uri = card(p)?.uri || 'https://scryfall.com/search?q=' + encodeURIComponent('!"' + p + '"');
    return `<a class="scry" href="${esc(uri)}" target="_blank" rel="noopener">${esc(p)}</a>`;
  }).join(' &amp; ');
}

function mana(colors) {
  if (!colors || !colors.length) return '';
  return `<span class="mana">${colors.map(c => `<abbr class="m m-${c}" title="${COLOR_NAME[c]}">${c}</abbr>`).join('')}</span>`;
}

// A commander's art printed as a halftone newspaper photo, with its credit line.
function photo(parts, { caption = '', size = '' } = {}) {
  if (!CONFIG.showArtwork) return '';
  const info = (parts || []).map(card).find(i => i && i.art);
  if (!info) return '';
  return `<figure class="photo ${size}">
    <a class="halftone" href="${esc(info.uri)}" target="_blank" rel="noopener"><img src="${esc(info.art)}" alt="" loading="lazy" onerror="this.closest('figure').remove()"></a>
    <figcaption>${caption ? esc(caption) + ' ' : ''}<span class="credit">Illustration: ${esc(info.artist)} / Scryfall</span></figcaption>
  </figure>`;
}

const sectionHead = (title, extra = '') => `<h2 class="section-head"><span>${title}</span>${extra}</h2>`;

// ---------- Masthead ----------
export function header(st, screen) {
  const latest = st?.allGames.length ? st.allGames[st.allGames.length - 1].date : null;
  const firstYear = st?.allGames.length ? +st.allGames[0].date.slice(0, 4) : new Date().getFullYear();
  const vol = st ? roman(st.season - firstYear + 1) : 'I';
  const nav = [['overview', '#/', 'Front Page'], ['player', '#/player', 'Players'], ['commanders', '#/commanders', 'Commanders'], ['plays', '#/games', 'Results']];
  const editions = [['last10', 'Last ' + CONFIG.lastN], ['season', 'Season ' + (st?.season || '')], ['all', 'All games']];
  return `
  <header class="masthead">
    <div class="ears">
      ${screen === 'overview'
        ? `<a class="seal" href="#/"><img src="assets/logo.webp" alt="Group logo: Commander? I hardly know her!" width="140" height="140"></a>`
        : `<p class="ear ear-left">${esc(CONFIG.motto)}</p>`}
      <a class="nameplate" href="#/">${esc(CONFIG.paper)}</a>
      <p class="ear ear-right">${latest ? 'Latest edition' : 'Going to press'}<br><span>Weather: chance of board wipes</span></p>
    </div>
    <div class="dateline">
      <span>VOL. ${vol} … No. ${st ? st.allGames.length : '—'}</span>
      <span class="dateline-date">${esc(CONFIG.city)}, ${latest ? longDate(latest).toUpperCase() : 'LOADING…'}</span>
      <span>${esc(CONFIG.price)}</span>
    </div>
    <nav class="sections" aria-label="Sections">${nav.map(([key, href, label]) => `<a href="${href}" class="${screen === key ? 'active' : ''}">${label}</a>`).join('')}</nav>
    ${st ? `<div class="edition" role="group" aria-label="Edition"><span>Edition:</span>${editions.map(([key, label]) =>
      `<button data-range="${key}" class="${st.range === key ? 'active' : ''}" aria-pressed="${st.range === key}">${esc(label)}</button>`).join('')}</div>` : ''}
  </header>`;
}

export function footer(generated) {
  return `<footer class="colophon">Set from the BG Stats export${generated ? ' of ' + esc(generated) : ''}. Card images via Scryfall; Magic: The Gathering © Wizards of the Coast.</footer>`;
}

// ---------- Front page ----------
function headline(st) {
  const [L, second] = st.ranked;
  if (!L) return 'No games in this edition yet';
  if (L.streak >= 3) return `${L.name} Unstoppable: ${L.streak} Straight Wins`;
  if (second && L.rate - second.rate >= 10) return `${L.name} Runs Away With the Pod`;
  if (second) return `${L.name} Leads, ${second.name} Close Behind`;
  return `${L.name} Tops the Pod`;
}

function standingsTable(st) {
  return `<table class="agate standings">
    <thead><tr><th>#</th><th class="l">Player</th><th title="Games">G</th><th title="Wins">W</th><th>%</th><th>Streak</th></tr></thead>
    <tbody>${st.players.map(p => `
      <tr class="${p.rank === 1 ? 'lead-row' : p.rank ? '' : 'unranked'}"><td>${p.rank || '—'}</td><td class="l"><a href="${playerHref(p.name)}">${esc(p.name)}</a></td>
      <td>${p.games}</td><td>${p.wins}</td><td class="b">${p.rate}</td><td>${fmtStreak(p.streak)}</td></tr>`).join('')}</tbody>
  </table>
  <p class="agate-note">Pod average: ${dec1(st.avg)}% wins per seat.${st.ranked.length < st.players.length ? ` A rank takes at least ${st.minGames} games.` : ''}</p>`;
}

// A written game report from data/articles.json.
function report(a, top = false) {
  const body = a.body.map(b => typeof b === 'string' ? `<p>${inline(b)}</p>` : `<p class="pull">${inline(b.quote)}</p>`).join('');
  return `
  <article class="report${top ? ' top' : ''}">
    <p class="kicker">${esc(a.kicker || 'Report')} · ${longDate(a.date)}</p>
    <h2 class="report-head">${esc(a.headline)}</h2>
    ${a.deck ? `<p class="deck">${inline(a.deck)}</p>` : ''}
    ${a.byline ? `<p class="byline">${esc(a.byline)}</p>` : ''}
    ${a.image ? `<figure class="photo"><span class="halftone"><img src="${esc(a.image)}" alt="" loading="lazy"></span>${a.caption ? `<figcaption>${inline(a.caption)}</figcaption>` : ''}</figure>` : ''}
    <div class="story">${body}</div>
    ${a.numbers?.length ? `<aside class="numbers"><h3>By the numbers</h3><dl>${a.numbers.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></aside>` : ''}
  </article>`;
}

export function overview(st, articles = []) {
  const L = st.ranked[0];
  const second = st.ranked[1];
  const fw = st.fastestWin;
  const verdict = st.starterRate > st.starterChance + 8 ? 'A clear edge for whoever goes first.'
    : st.starterRate < st.starterChance - 8 ? 'Going first looks more like a handicap.' : 'There is hardly an edge to speak of.';

  const story = L ? `
    <p><span class="city">${esc(CONFIG.city)}</span> — ${esc(L.name)} sits atop the pod ${scope(st)}. In ${plural(L.games, 'game')}, ${esc(L.name)} took ${plural(L.wins, 'win')}, a win rate of ${L.rate}% against a pod average of ${dec1(st.avg)}%.${L.mainDeck ? ` The commander of choice: ${esc(L.mainDeck)}.` : ''}</p>
    ${second ? `<p>In second place is ${esc(second.name)}, with ${second.rate}% from ${plural(second.games, 'game')}${second.streak >= 2 ? `, winning ${second.streak} in a row` : ''}.</p>` : ''}
    ${st.starterGames ? `<p>Does going first pay off? Of the ${st.starterGames} games with a recorded start player, the starter won ${st.starterWins}: ${st.starterRate}%. Pure chance would give ${Math.round(st.starterChance)}%. ${verdict}</p>` : ''}
    ${st.roundGames ? `<p>A game lasts ${dec1(st.avgRounds)} rounds on average${st.avgMinutes ? `, or ${fmtMinutes(st.avgMinutes)}` : ''}.${fw ? ` The fastest win belongs to ${esc(fw.player)}${fw.commander ? ` with ${esc(fw.commander)}` : ''}: ${rounds(fw.rounds)}, on ${longDate(fw.date)}.` : ''}</p>` : ''}`
    : '<p>No games have been played in this edition yet.</p>';

  const facts = [
    ['Games played', st.games.length],
    ['Players', st.players.length],
    ['Average at the table', dec1(st.avgSeats)],
    ['Different commanders', st.uniqueCommanders],
    ['Average rounds', st.roundGames ? dec1(st.avgRounds) : '—'],
    ['Average length', st.avgMinutes ? fmtMinutes(st.avgMinutes) : '—'],
    ['Start player wins', st.starterGames ? `${st.starterRate}%` : '—'],
    ['Longest running streak', st.longest ? `${st.longest.streak} (${esc(st.longest.name)})` : '—'],
    ['Fastest win', fw ? `${rounds(fw.rounds)} (${esc(fw.player)})` : '—'],
    ['Longest game', st.longestGame ? `${fmtMinutes(st.longestGame.minutes)} (${shortDate(st.longestGame.date)})` : '—'],
  ];

  const form = st.players.map(p => `
    <li><a href="${playerHref(p.name)}">${esc(p.name)}</a>
      <span class="form-letters">${p.form.map(w => w ? '<b>W</b>' : 'L').join(' ')}</span>
      <em>${esc(p.formNote)}</em></li>`).join('');

  const n = st.names.length;
  const matrix = !CONFIG.showRivalry ? '' : `
    <section class="col">
      ${sectionHead('Rivalries')}
      <p class="small">Win rate of the player in the row when the player in the column is also at the table.</p>
      ${n < 2 ? '<p class="small">Too few players for a table.</p>' : `
      <div class="scroll"><table class="agate matrix">
        <thead><tr><th></th>${st.names.map(x => `<th title="${esc(x)}">${esc(x.slice(0, 3))}</th>`).join('')}</tr></thead>
        <tbody>${st.matrix.map(row => `<tr><th class="l">${esc(row.name)}</th>${row.cells.map(c => {
          if (!c) return '<td class="diag">—</td>';
          if (!c.games) return '<td class="diag" title="Never at the same table">·</td>';
          const t = Math.min(1, Math.max(0, (c.rate - 8) / 40));
          return `<td title="${esc(row.name)} with ${esc(c.vs)}: ${c.rate}% in ${plural(c.games, 'game')}" style="background:rgba(26,24,20,${(t * 0.85).toFixed(2)});color:${t > 0.55 ? '#F3EEE2' : 'inherit'}">${c.rate}</td>`;
        }).join('')}</tr>`).join('')}</tbody>
      </table></div>`}
    </section>`;

  const strong = st.strong.length ? `<div class="features">${st.strong.slice(0, 4).map(c => `
    <article class="feature">
      ${photo(c.parts, { size: 'small' })}
      <h3><a href="#/commanders">${esc(c.name)}</a></h3>
      <p class="byline">${esc(c.pilotList.map(p => p.name).join(', '))} ${mana(c.colors)}</p>
      <p class="feature-stat"><b>${c.rate}%</b> · ${c.wins}W–${c.games - c.wins}L in ${plural(c.games, 'game')}</p>
    </article>`).join('')}</div>`
    : `<p class="small">No commander with at least ${CONFIG.minCommanderGames} games above the pod average yet.</p>`;

  const shared = st.shared.length ? st.shared.slice(0, 6).map(c => `
    <div class="duel">
      <h3>${esc(c.name)} <span class="small">· ${plural(c.games, 'game')}</span></h3>
      ${c.pilotList.map(p => { const v = pct(p.wins, p.games); return `
        <div class="bar-row"><span class="bar-name">${esc(p.name)}</span><span class="bar"><span style="width:${Math.min(100, v)}%"></span></span><span class="bar-val">${v}% <span class="small">(${p.wins}/${p.games})</span></span></div>`; }).join('')}
    </div>`).join('')
    : '<p class="small">No commander has been played by two players yet.</p>';

  // The newest report leads the page at full width; the next ones sit in columns below it.
  const [topStory, ...more] = articles.slice(0, CONFIG.frontPageArticles);

  return `
  <div class="page">
    ${topStory ? `<section class="top-story">${report(topStory, true)}</section>` : ''}
    ${more.length ? `<section class="reports">${more.map(a => report(a)).join('')}</section>` : ''}

    <section class="front">
      <article class="lead-story">
        <p class="kicker">${st.range === 'all' ? 'All games' : st.range === 'last10' ? 'The last ' + st.games.length + ' games' : 'Season ' + st.season}</p>
        <h1 class="headline">${esc(headline(st))}</h1>
        <p class="deck">${L ? `A ${L.rate}% win rate after ${plural(L.games, 'game')}; the start player wins ${st.starterRate}%` : ''}</p>
        <p class="byline">By our statistics desk</p>
        ${L ? photo(L.mainParts, { caption: `${L.name} played ${L.mainDeck} most often.`, size: 'lead' }) : ''}
        <div class="story">${story}</div>
      </article>
      <aside class="col rule-left">
        ${sectionHead('Standings')}
        ${standingsTable(st)}
        ${sectionHead('Form', '<span class="small">last 5, oldest first</span>')}
        <ul class="form-list">${form}</ul>
      </aside>
    </section>

    <section class="three">
      <section class="col">
        ${sectionHead('Key figures')}
        <dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      </section>
      ${matrix}
      <section class="col">
        ${sectionHead('The deck or the player?')}
        <p class="small">Same commander, different pilot. Where the bars diverge, the difference is the player.</p>
        ${shared}
      </section>
    </section>

    ${st.rivalries.length ? `<section class="quotes">${st.rivalries.map(r => `<blockquote>${esc(r)}</blockquote>`).join('')}</section>` : ''}

    <section>
      ${sectionHead('Commanders above average', `<a class="more" href="#/commanders">All commanders →</a>`)}
      ${strong}
    </section>
  </div>`;
}

// ---------- Player profile ----------
export function profile(st, name) {
  const p = st.players.find(x => norm(x.name) === norm(name));
  const switcher = `<nav class="switcher">${st.players.map(x => `<a href="${playerHref(x.name)}" class="${p && x.name === p.name ? 'active' : ''}">${esc(x.name)}</a>`).join('')}</nav>`;
  if (!p) return `<div class="page">${switcher}<p class="small">${esc(name || '')} played no games in this edition.</p></div>`;

  const decks = [...p.decks.values()].map(d => ({ ...d, rate: pct(d.wins, d.games), exact: d.wins / d.games }))
    .sort((a, b) => b.games - a.games || b.exact - a.exact);
  // One lucky game shouldn't make a "best deck": prefer decks played at least twice.
  const tried = decks.filter(d => d.games >= 2);
  const best = (tried.length ? tried : decks).slice().sort((a, b) => b.exact - a.exact || b.games - a.games)[0];
  const fav = Object.keys(p.colorGames).sort((a, b) => p.colorGames[b] - p.colorGames[a])[0];
  const since = st.firstSeen[p.name];

  const facts = [
    ['Games', p.games],
    ['Wins', `${p.wins} (pod average ${dec1(st.avgWinsPerPlayer)})`],
    ['Went first', p.starts ? `${p.starts}×, won ${p.startWins} of those (${pct(p.startWins, p.starts)}%)` : '—'],
    ['Average rounds per win', p.winRounds ? dec1(p.winRounds) : '—'],
    ['Fastest win', p.fastest ? `${rounds(p.fastest.rounds)}, ${shortDate(p.fastest.date)}` : '—'],
    ['Best deck', best ? `${esc(best.name)} (${best.rate}%)` : '—'],
    ['Favourite colour', fav ? COLOR_NAME[fav] : '—'],
  ];

  const vs = st.matrix.find(r => r.name === p.name).cells.filter(c => c && c.games).sort((a, b) => b.rate - a.rate);

  const log = p.log.slice(-8).reverse().map(({ game, seat }) => `
    <tr><td>${shortDate(game.date)}</td><td class="l">${cmdLinks(seat.parts)}</td>
    <td>${game.rounds || '—'}</td><td>${seat.starter ? '◆' : ''}</td><td class="b">${seat.win ? 'W' : 'L'}</td></tr>`).join('');

  return `
  <div class="page">
    ${switcher}
    <section class="front">
      <article class="lead-story">
        <p class="kicker">Player profile · ${p.rank ? 'rank ' + two(p.rank) : `unranked (fewer than ${st.minGames} games)`}</p>
        <h1 class="headline">${esc(p.name)}</h1>
        <p class="deck">A ${p.rate}% win rate ${scope(st)}, current streak ${fmtStreak(p.streak)}${since ? `. Playing since ${monthYear(since)}` : ''}.</p>
        <dl class="facts wide">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
        ${sectionHead('Decks')}
        <table class="agate">
          <thead><tr><th class="l">Commander</th><th title="Games">G</th><th title="Wins">W</th><th>%</th></tr></thead>
          <tbody>${decks.map(d => `<tr><td class="l">${cmdLinks(d.parts, d.name)} ${mana(d.colors)}</td><td>${d.games}</td><td>${d.wins}</td><td class="b">${d.rate}</td></tr>`).join('')}</tbody>
        </table>
        ${sectionHead('Recent games', `<a class="more" href="${gamesHref(p.name)}">All results →</a>`)}
        <table class="agate">
          <thead><tr><th>Date</th><th class="l">Commander</th><th title="Rounds">Rnd</th><th title="Went first">1st</th><th>Result</th></tr></thead>
          <tbody>${log}</tbody>
        </table>
      </article>
      <aside class="col rule-left">
        ${photo(p.mainParts, { caption: p.mainDeck ? `Commander of choice: ${p.mainDeck}.` : '' })}
        ${sectionHead('Against the pod')}
        <p class="small">Win rate when this player is also at the table.</p>
        <table class="agate"><tbody>${vs.map(c => `<tr><td class="l"><a href="${playerHref(c.vs)}">${esc(c.vs)}</a></td><td class="b">${c.rate}%</td><td class="small">${plural(c.games, 'game')}</td></tr>`).join('')}</tbody></table>
      </aside>
    </section>
  </div>`;
}

// ---------- All commanders ----------
export function commanders(st) {
  const rows = st.commanders.map(c => {
    const thumb = c.parts.map(card).find(i => i && i.art);
    return `
    <tr>
      <td>${c.rank}</td>
      <td class="thumb-cell">${thumb && CONFIG.showArtwork ? `<span class="halftone thumb"><img src="${esc(thumb.art)}" alt="" loading="lazy"></span>` : ''}</td>
      <td class="l"><a class="cmd-name" href="${esc(thumb?.uri || '#/commanders')}" target="_blank" rel="noopener">${esc(c.name)}</a> ${mana(c.colors)}
        <span class="pilots">${c.pilotList.map(p => `<a href="${playerHref(p.name)}">${esc(p.name)}</a>${c.pilotList.length > 1 ? ` (${p.wins}/${p.games})` : ''}`).join(', ')}</span></td>
      <td>${c.games}</td><td>${c.wins}</td><td class="b">${c.rate}</td>
      <td class="opt">${c.rounds.length ? dec1(c.avgRounds) : '—'}</td>
      <td class="opt">${c.fastest ? c.fastest.rounds : '—'}</td>
    </tr>`;
  }).join('');
  return `
  <div class="page">
    <p class="kicker">The rankings</p>
    <h1 class="headline">The Commanders, From Strongest to Weakest</h1>
    <p class="deck">All ${st.commanders.length} commanders played ${scope(st)}, ranked by win rate. Ties go to the deck played most.</p>
    <table class="agate commanders-table">
      <thead><tr><th>#</th><th class="thumb-cell"></th><th class="l">Commander and pilots</th><th title="Games">G</th><th title="Wins">W</th><th>%</th>
        <th class="opt" title="Average rounds">Rnd</th><th class="opt" title="Fastest win, in rounds">Fastest</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="8">No commanders in this edition.</td></tr>'}</tbody>
    </table>
    <p class="agate-note">G = games, W = wins, Rnd = average rounds, Fastest = fastest win in rounds. Pod average: ${dec1(st.avg)}%.</p>
  </div>`;
}

// ---------- All games ----------
export function plays(st, filter) {
  const names = [...new Set(st.games.flatMap(g => g.seats.map(s => s.player)))].sort((a, b) => a.localeCompare(b));
  const who = filter && names.find(n => norm(n) === norm(filter));
  const list = (who ? st.games.filter(g => g.seats.some(s => s.player === who)) : st.games).slice().reverse();
  const number = new Map(st.allGames.map((g, i) => [g.id, i + 1]));

  const chips = ['', ...names].map(n => `<a href="${gamesHref(n)}" class="${(who || '') === n ? 'active' : ''}">${n ? esc(n) : 'Everyone'}</a>`).join('');

  const item = g => {
    const winners = g.seats.filter(s => s.win);
    const starter = g.seats.find(s => s.starter);
    const head = winners.length === 1 ? `${winners[0].player} wins with ${shortName(winners[0].parts) || 'an unknown deck'}`
      : winners.length > 1 ? `${winners.map(w => w.player).join(' and ')} share the win` : 'No winner';
    const meta = [g.rounds ? rounds(g.rounds) : '', g.minutes ? fmtMinutes(g.minutes) : '', starter ? starter.player + ' went first' : ''].filter(Boolean).join(' · ');
    const cotm = g.card ? card(g.card) : null;
    return `
    <article class="result">
      <p class="kicker">No. ${number.get(g.id)} · ${longDate(g.date)}${g.location ? ' · ' + esc(g.location) : ''}</p>
      <h3>${esc(head)}</h3>
      ${meta ? `<p class="byline">${meta}</p>` : ''}
      <table class="agate">
        <tbody>${g.seats.map(s => `<tr${s.win ? ' class="won"' : ''}>
          <td class="l"><a href="${playerHref(s.player)}">${esc(s.player)}</a>${s.starter ? ' <span title="Went first">◆</span>' : ''}</td>
          <td class="l">${esc(s.commander || '—')}</td><td class="b">${s.win ? 'W' : ''}</td></tr>`).join('')}</tbody>
      </table>
      ${g.card ? `<p class="cotm">${cotm?.image ? `<a class="halftone card-img" href="${esc(cotm.uri)}" target="_blank" rel="noopener"><img src="${esc(cotm.image)}" alt="" loading="lazy"></a>` : ''}
        <span><span class="small-caps">Card of the match</span><br>${esc(g.card)}</span></p>` : ''}
    </article>`;
  };

  return `
  <div class="page">
    <p class="kicker">Results</p>
    <h1 class="headline">Every Game</h1>
    <p class="deck">${plural(list.length, 'game')} ${scope(st)}${st.roundGames ? `; ${dec1(st.avgRounds)} rounds on average` : ''}${st.starterGames ? `; the start player won ${st.starterRate}%` : ''}. ◆ = went first.</p>
    <nav class="switcher">${chips}</nav>
    <div class="results">${list.length ? list.map(item).join('') : '<p class="small">No games found.</p>'}</div>
  </div>`;
}

// ---------- Loading and errors ----------
export function skeleton() {
  return `<div class="page"><p class="kicker">Going to press</p><h1 class="headline">The paper is being printed…</h1><div class="sk"></div><div class="sk short"></div></div>`;
}

export function errorPanel(message) {
  return `<div class="page"><p class="kicker">Misprint</p><h1 class="headline">The paper could not be printed</h1><p class="deck">${esc(message)}</p></div>`;
}
