// HTML for every page, set like an old broadsheet. Everything is built from the stats object.
import { CONFIG } from './config.js';
import { card, norm } from './data.js';
import { pct, nl1, fmtStreak, fmtMinutes, shortDate, longDate, monthYear, COLOR_NL } from './stats.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const playerHref = name => '#/speler/' + encodeURIComponent(name);
const two = n => String(n).padStart(2, '0');
const roman = n => [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']].reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, '');
// "Breeches, Brazen Plunderer & Malcolm, Keen-Eyed Navigator" -> "Breeches & Malcolm"
const shortName = parts => (parts || []).map(p => p.split(',')[0]).join(' & ');
const rounds = n => n + (n === 1 ? ' ronde' : ' ronden');
const scope = st => st.range === 'all' ? 'over alle potjes gemeten' : st.range === 'last10' ? `over de laatste ${st.games.length} potjes` : `in seizoen ${st.season}`;

function mana(colors) {
  if (!colors || !colors.length) return '';
  return `<span class="mana">${colors.map(c => `<abbr class="m m-${c}" title="${COLOR_NL[c]}">${c}</abbr>`).join('')}</span>`;
}

// A commander's art printed as a halftone newspaper photo, with its credit line.
function photo(parts, { caption = '', size = '' } = {}) {
  if (!CONFIG.showArtwork) return '';
  const info = (parts || []).map(card).find(i => i && i.art);
  if (!info) return '';
  return `<figure class="photo ${size}">
    <a class="halftone" href="${esc(info.uri)}" target="_blank" rel="noopener"><img src="${esc(info.art)}" alt="" loading="lazy" onerror="this.closest('figure').remove()"></a>
    <figcaption>${caption ? esc(caption) + ' ' : ''}<span class="credit">Illustratie: ${esc(info.artist)} / Scryfall</span></figcaption>
  </figure>`;
}

const sectionHead = (title, extra = '') => `<h2 class="section-head"><span>${title}</span>${extra}</h2>`;

// ---------- Masthead ----------
export function header(st, screen, generated) {
  const latest = st?.allGames.length ? st.allGames[st.allGames.length - 1].date : null;
  const firstYear = st?.allGames.length ? +st.allGames[0].date.slice(0, 4) : new Date().getFullYear();
  const vol = st ? roman(st.season - firstYear + 1) : 'I';
  const nav = [['overview', '#/', 'Voorpagina'], ['player', '#/speler', 'Spelers'], ['commanders', '#/commanders', 'Commanders'], ['plays', '#/potjes', 'Uitslagen']];
  const editions = [['last10', 'Laatste ' + CONFIG.lastN], ['season', 'Seizoen ' + (st?.season || '')], ['all', 'Alle potjes']];
  return `
  <header class="masthead">
    <div class="ears">
      <p class="ear ear-left">${esc(CONFIG.motto)}</p>
      <a class="nameplate" href="#/">${esc(CONFIG.paper)}</a>
      <p class="ear ear-right">${latest ? 'Laatste editie' : 'Ter perse'}<br><span>Weerbericht: kans op boardwipes</span></p>
    </div>
    <div class="dateline">
      <span>VOL. ${vol} … No. ${st ? st.allGames.length : '—'}</span>
      <span class="dateline-date">${esc(CONFIG.city)}, ${latest ? longDate(latest).toUpperCase() : 'LADEN…'}</span>
      <span>${esc(CONFIG.price)}</span>
    </div>
    <nav class="sections" aria-label="Rubrieken">${nav.map(([key, href, label]) => `<a href="${href}" class="${screen === key ? 'active' : ''}">${label}</a>`).join('')}</nav>
    ${st ? `<div class="edition" role="group" aria-label="Editie"><span>Editie:</span>${editions.map(([key, label]) =>
      `<button data-range="${key}" class="${st.range === key ? 'active' : ''}" aria-pressed="${st.range === key}">${esc(label)}</button>`).join('')}</div>` : ''}
  </header>`;
}

export function footer(generated) {
  return `<footer class="colophon">Gezet uit de BG Stats-export${generated ? ' van ' + esc(generated) : ''}. Kaartbeelden via Scryfall; Magic: The Gathering © Wizards of the Coast.</footer>`;
}

// ---------- Front page ----------
function headline(st) {
  const [L, second] = st.ranked;
  if (!L) return 'Nog geen potjes in deze editie';
  if (L.streak >= 3) return `${L.name} onstuitbaar: ${L.streak} zeges op rij`;
  if (second && L.rate - second.rate >= 10) return `${L.name} ruim aan kop in de pod`;
  if (second) return `${L.name} aan kop, ${second.name} op de hielen`;
  return `${L.name} voert de pod aan`;
}

function standingsTable(st) {
  return `<table class="agate standings">
    <thead><tr><th>#</th><th class="l">Speler</th><th title="Potjes">P</th><th title="Gewonnen">W</th><th>%</th><th>Reeks</th></tr></thead>
    <tbody>${st.players.map(p => `
      <tr class="${p.rank === 1 ? 'lead-row' : p.rank ? '' : 'unranked'}"><td>${p.rank || '—'}</td><td class="l"><a href="${playerHref(p.name)}">${esc(p.name)}</a></td>
      <td>${p.games}</td><td>${p.wins}</td><td class="b">${p.rate}</td><td>${fmtStreak(p.streak)}</td></tr>`).join('')}</tbody>
  </table>
  <p class="agate-note">Pod-gemiddelde: ${nl1(st.avg)}% winst per stoel.${st.ranked.length < st.players.length ? ` Een rang vraagt minstens ${st.minGames} potjes.` : ''}</p>`;
}

export function overview(st) {
  const L = st.ranked[0];
  const second = st.ranked[1];
  const fw = st.fastestWin;
  const verdict = st.starterRate > st.starterChance + 8 ? 'Een duidelijk voordeel voor wie mag beginnen.'
    : st.starterRate < st.starterChance - 8 ? 'Beginnen lijkt eerder een nadeel te zijn.' : 'Van een echt voordeel is nauwelijks sprake.';

  const story = L ? `
    <p><span class="city">${esc(CONFIG.city)}</span> — ${esc(L.name)} staat ${scope(st)} bovenaan de pod. In ${L.games} potjes boekte ${esc(L.name)} ${L.wins} overwinning${L.wins === 1 ? '' : 'en'}, goed voor een winrate van ${L.rate}%, tegen een pod-gemiddelde van ${nl1(st.avg)}%.${L.mainDeck ? ` De vaste commander: ${esc(L.mainDeck)}.` : ''}</p>
    ${second ? `<p>Op de tweede plaats volgt ${esc(second.name)} met ${second.rate}% uit ${second.games} potjes${second.streak >= 2 ? `, al ${second.streak} keer op rij winnend` : ''}.</p>` : ''}
    ${st.starterGames ? `<p>Wie begint, wint vaker? Van de ${st.starterGames} potjes waarin bekend is wie begon, won de beginnende speler er ${st.starterWins}: ${st.starterRate}%. Op puur toeval zou dat ${Math.round(st.starterChance)}% zijn. ${verdict}</p>` : ''}
    ${st.roundGames ? `<p>Een potje duurt gemiddeld ${nl1(st.avgRounds)} ronden${st.avgMinutes ? ` en ${fmtMinutes(st.avgMinutes)}` : ''}.${fw ? ` De snelste overwinning kwam van ${esc(fw.player)}${fw.commander ? ` met ${esc(fw.commander)}` : ''}: ${rounds(fw.rounds)}, op ${longDate(fw.date)}.` : ''}</p>` : ''}`
    : '<p>Er zijn in deze editie nog geen potjes gespeeld.</p>';

  const facts = [
    ['Potjes gespeeld', st.games.length],
    ['Spelers', st.players.length],
    ['Gemiddeld aan tafel', nl1(st.avgSeats)],
    ['Verschillende commanders', st.uniqueCommanders],
    ['Gemiddeld aantal ronden', st.roundGames ? nl1(st.avgRounds) : '—'],
    ['Gemiddelde duur', st.avgMinutes ? fmtMinutes(st.avgMinutes) : '—'],
    ['Beginner wint', st.starterGames ? `${st.starterRate}%` : '—'],
    ['Langste lopende reeks', st.longest ? `${st.longest.streak} (${esc(st.longest.name)})` : '—'],
    ['Snelste winst', fw ? `${rounds(fw.rounds)} (${esc(fw.player)})` : '—'],
    ['Langste potje', st.longestGame ? `${fmtMinutes(st.longestGame.minutes)} (${shortDate(st.longestGame.date)})` : '—'],
  ];

  const form = st.players.map(p => `
    <li><a href="${playerHref(p.name)}">${esc(p.name)}</a>
      <span class="form-letters">${p.form.map(w => w ? '<b>W</b>' : 'V').join(' ')}</span>
      <em>${esc(p.formNote)}</em></li>`).join('');

  const n = st.names.length;
  const matrix = !CONFIG.showRivalry ? '' : `
    <section class="col">
      ${sectionHead('Rivaliteiten')}
      <p class="small">Winrate van de speler in de rij als de speler in de kolom ook aan tafel zit.</p>
      ${n < 2 ? '<p class="small">Te weinig spelers voor een tabel.</p>' : `
      <div class="scroll"><table class="agate matrix">
        <thead><tr><th></th>${st.names.map(x => `<th title="${esc(x)}">${esc(x.slice(0, 3))}</th>`).join('')}</tr></thead>
        <tbody>${st.matrix.map(row => `<tr><th class="l">${esc(row.name)}</th>${row.cells.map(c => {
          if (!c) return '<td class="diag">—</td>';
          if (!c.games) return '<td class="diag" title="Nooit samen aan tafel">·</td>';
          const t = Math.min(1, Math.max(0, (c.rate - 8) / 40));
          return `<td title="${esc(row.name)} met ${esc(c.vs)}: ${c.rate}% in ${c.games} potjes" style="background:rgba(26,24,20,${(t * 0.85).toFixed(2)});color:${t > 0.55 ? '#F3EEE2' : 'inherit'}">${c.rate}</td>`;
        }).join('')}</tr>`).join('')}</tbody>
      </table></div>`}
    </section>`;

  const strong = st.strong.length ? `<div class="features">${st.strong.slice(0, 4).map(c => `
    <article class="feature">
      ${photo(c.parts, { size: 'small' })}
      <h3><a href="#/commanders">${esc(c.name)}</a></h3>
      <p class="byline">${esc(c.pilotList.map(p => p.name).join(', '))} ${mana(c.colors)}</p>
      <p class="feature-stat"><b>${c.rate}%</b> · ${c.wins}W–${c.games - c.wins}V in ${c.games} potjes</p>
    </article>`).join('')}</div>`
    : `<p class="small">Nog geen commander met minstens ${CONFIG.minCommanderGames} potjes boven het pod-gemiddelde.</p>`;

  const shared = st.shared.length ? st.shared.slice(0, 6).map(c => `
    <div class="duel">
      <h3>${esc(c.name)} <span class="small">· ${c.games} potjes</span></h3>
      ${c.pilotList.map(p => { const v = pct(p.wins, p.games); return `
        <div class="bar-row"><span class="bar-name">${esc(p.name)}</span><span class="bar"><span style="width:${Math.min(100, v)}%"></span></span><span class="bar-val">${v}% <span class="small">(${p.wins}/${p.games})</span></span></div>`; }).join('')}
    </div>`).join('')
    : '<p class="small">Nog geen commander die door twee spelers is gespeeld.</p>';

  return `
  <div class="page">
    <section class="front">
      <article class="lead-story">
        <p class="kicker">${st.range === 'all' ? 'Alle potjes' : st.range === 'last10' ? 'De laatste ' + st.games.length + ' potjes' : 'Seizoen ' + st.season}</p>
        <h1 class="headline">${esc(headline(st))}</h1>
        <p class="deck">${L ? `Winrate van ${L.rate}% na ${L.games} potjes; beginnende speler wint ${st.starterRate}%` : ''}</p>
        <p class="byline">Door onze statistiekredactie</p>
        ${L ? photo(L.mainParts, { caption: `${L.name} speelde het vaakst met ${L.mainDeck}.`, size: 'lead' }) : ''}
        <div class="story">${story}</div>
      </article>
      <aside class="col rule-left">
        ${sectionHead('De stand')}
        ${standingsTable(st)}
        ${sectionHead('In vorm', '<span class="small">laatste 5, oudste links</span>')}
        <ul class="form-list">${form}</ul>
      </aside>
    </section>

    <section class="three">
      <section class="col">
        ${sectionHead('Kerncijfers')}
        <dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      </section>
      ${matrix}
      <section class="col">
        ${sectionHead('Het deck of de speler?')}
        <p class="small">Dezelfde commander, een andere piloot. Waar de balken uiteenlopen, zit het verschil in de speler.</p>
        ${shared}
      </section>
    </section>

    ${st.rivalries.length ? `<section class="quotes">${st.rivalries.map(r => `<blockquote>${esc(r)}</blockquote>`).join('')}</section>` : ''}

    <section>
      ${sectionHead('Commanders boven het gemiddelde', `<a class="more" href="#/commanders">Alle commanders →</a>`)}
      ${strong}
    </section>
  </div>`;
}

// ---------- Player profile ----------
export function profile(st, name) {
  const p = st.players.find(x => norm(x.name) === norm(name));
  const switcher = `<nav class="switcher">${st.players.map(x => `<a href="${playerHref(x.name)}" class="${p && x.name === p.name ? 'active' : ''}">${esc(x.name)}</a>`).join('')}</nav>`;
  if (!p) return `<div class="page">${switcher}<p class="small">${esc(name || '')} speelde geen potjes in deze editie.</p></div>`;

  const decks = [...p.decks.values()].map(d => ({ ...d, rate: pct(d.wins, d.games), exact: d.wins / d.games }))
    .sort((a, b) => b.games - a.games || b.exact - a.exact);
  // One lucky game shouldn't make a "best deck": prefer decks played at least twice.
  const tried = decks.filter(d => d.games >= 2);
  const best = (tried.length ? tried : decks).slice().sort((a, b) => b.exact - a.exact || b.games - a.games)[0];
  const fav = Object.keys(p.colorGames).sort((a, b) => p.colorGames[b] - p.colorGames[a])[0];
  const since = st.firstSeen[p.name];

  const facts = [
    ['Potjes', p.games],
    ['Overwinningen', `${p.wins} (pod-gemiddelde ${nl1(st.avgWinsPerPlayer)})`],
    ['Begonnen', p.starts ? `${p.starts}×, waarvan ${p.startWins} gewonnen (${pct(p.startWins, p.starts)}%)` : '—'],
    ['Gemiddeld ronden per winst', p.winRounds ? nl1(p.winRounds) : '—'],
    ['Snelste winst', p.fastest ? `${rounds(p.fastest.rounds)}, ${shortDate(p.fastest.date)}` : '—'],
    ['Beste deck', best ? `${esc(best.name)} (${best.rate}%)` : '—'],
    ['Favoriete kleur', fav ? COLOR_NL[fav] : '—'],
  ];

  const vs = st.matrix.find(r => r.name === p.name).cells.filter(c => c && c.games).sort((a, b) => b.rate - a.rate);

  const log = p.log.slice(-8).reverse().map(({ game, seat }) => `
    <tr><td>${shortDate(game.date)}</td><td class="l">${esc(seat.commander || '—')}</td>
    <td>${game.rounds || '—'}</td><td>${seat.starter ? '◆' : ''}</td><td class="b">${seat.win ? 'W' : 'V'}</td></tr>`).join('');

  return `
  <div class="page">
    ${switcher}
    <section class="front">
      <article class="lead-story">
        <p class="kicker">Spelersprofiel · ${p.rank ? 'rang ' + two(p.rank) : `zonder rang (minder dan ${st.minGames} potjes)`}</p>
        <h1 class="headline">${esc(p.name)}</h1>
        <p class="deck">Winrate ${p.rate}% ${scope(st)}, huidige reeks ${fmtStreak(p.streak)}${since ? `. Speelt mee sinds ${monthYear(since)}` : ''}.</p>
        <dl class="facts wide">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
        ${sectionHead('Decks')}
        <table class="agate">
          <thead><tr><th class="l">Commander</th><th>P</th><th>W</th><th>%</th></tr></thead>
          <tbody>${decks.map(d => `<tr><td class="l">${esc(d.name)} ${mana(d.colors)}</td><td>${d.games}</td><td>${d.wins}</td><td class="b">${d.rate}</td></tr>`).join('')}</tbody>
        </table>
        ${sectionHead('Laatste potjes', `<a class="more" href="#/potjes/${encodeURIComponent(p.name)}">Alle uitslagen →</a>`)}
        <table class="agate">
          <thead><tr><th>Datum</th><th class="l">Commander</th><th>Rnd</th><th title="Begon">Start</th><th>Uitslag</th></tr></thead>
          <tbody>${log}</tbody>
        </table>
      </article>
      <aside class="col rule-left">
        ${photo(p.mainParts, { caption: p.mainDeck ? `Vaste commander: ${p.mainDeck}.` : '' })}
        ${sectionHead('Tegen de pod')}
        <p class="small">Winrate als deze speler ook aan tafel zit.</p>
        <table class="agate"><tbody>${vs.map(c => `<tr><td class="l"><a href="${playerHref(c.vs)}">${esc(c.vs)}</a></td><td class="b">${c.rate}%</td><td class="small">${c.games} potjes</td></tr>`).join('')}</tbody></table>
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
      <td class="opt">${c.rounds.length ? nl1(c.avgRounds) : '—'}</td>
      <td class="opt">${c.fastest ? c.fastest.rounds : '—'}</td>
    </tr>`;
  }).join('');
  return `
  <div class="page">
    <p class="kicker">Overzicht</p>
    <h1 class="headline">De commanders, van sterk naar zwak</h1>
    <p class="deck">Alle ${st.commanders.length} gespeelde commanders ${scope(st)}, gerangschikt op winrate. Bij gelijke stand gaat het meest gespeelde deck voor.</p>
    <table class="agate commanders-table">
      <thead><tr><th>#</th><th class="thumb-cell"></th><th class="l">Commander en piloten</th><th title="Potjes">P</th><th title="Gewonnen">W</th><th>%</th>
        <th class="opt" title="Gemiddeld aantal ronden">Rnd</th><th class="opt" title="Snelste winst in ronden">Snelst</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="8">Geen commanders in deze editie.</td></tr>'}</tbody>
    </table>
    <p class="agate-note">P = potjes, W = gewonnen, Rnd = gemiddeld aantal ronden, Snelst = snelste winst in ronden. Pod-gemiddelde: ${nl1(st.avg)}%.</p>
  </div>`;
}

// ---------- All plays ----------
export function plays(st, filter) {
  const names = [...new Set(st.games.flatMap(g => g.seats.map(s => s.player)))].sort((a, b) => a.localeCompare(b));
  const who = filter && names.find(n => norm(n) === norm(filter));
  const list = (who ? st.games.filter(g => g.seats.some(s => s.player === who)) : st.games).slice().reverse();
  const number = new Map(st.allGames.map((g, i) => [g.id, i + 1]));

  const chips = ['', ...names].map(n => `<a href="#/potjes${n ? '/' + encodeURIComponent(n) : ''}" class="${(who || '') === n ? 'active' : ''}">${n ? esc(n) : 'Iedereen'}</a>`).join('');

  const item = g => {
    const winners = g.seats.filter(s => s.win);
    const starter = g.seats.find(s => s.starter);
    const head = winners.length === 1 ? `${winners[0].player} wint met ${shortName(winners[0].parts) || 'onbekend deck'}`
      : winners.length > 1 ? `${winners.map(w => w.player).join(' en ')} winnen samen` : 'Geen winnaar';
    const meta = [g.rounds ? rounds(g.rounds) : '', g.minutes ? fmtMinutes(g.minutes) : '', starter ? starter.player + ' begon' : ''].filter(Boolean).join(' · ');
    const cotm = g.card ? card(g.card) : null;
    return `
    <article class="result">
      <p class="kicker">No. ${number.get(g.id)} · ${longDate(g.date)}${g.location ? ' · ' + esc(g.location) : ''}</p>
      <h3>${esc(head)}</h3>
      ${meta ? `<p class="byline">${meta}</p>` : ''}
      <table class="agate">
        <tbody>${g.seats.map(s => `<tr${s.win ? ' class="won"' : ''}>
          <td class="l"><a href="${playerHref(s.player)}">${esc(s.player)}</a>${s.starter ? ' <span title="Begon">◆</span>' : ''}</td>
          <td class="l">${esc(s.commander || '—')}</td><td class="b">${s.win ? 'W' : ''}</td></tr>`).join('')}</tbody>
      </table>
      ${g.card ? `<p class="cotm">${cotm?.image ? `<a class="halftone card-img" href="${esc(cotm.uri)}" target="_blank" rel="noopener"><img src="${esc(cotm.image)}" alt="" loading="lazy"></a>` : ''}
        <span><span class="small-caps">Card of the match</span><br>${esc(g.card)}</span></p>` : ''}
    </article>`;
  };

  return `
  <div class="page">
    <p class="kicker">Uitslagen</p>
    <h1 class="headline">Alle potjes</h1>
    <p class="deck">${list.length} potjes ${scope(st)}${st.roundGames ? `; gemiddeld ${nl1(st.avgRounds)} ronden` : ''}${st.starterGames ? `; de beginner won ${st.starterRate}%` : ''}. ◆ = begon.</p>
    <nav class="switcher">${chips}</nav>
    <div class="results">${list.length ? list.map(item).join('') : '<p class="small">Geen potjes gevonden.</p>'}</div>
  </div>`;
}

// ---------- Loading and errors ----------
export function skeleton() {
  return `<div class="page"><p class="kicker">Ter perse</p><h1 class="headline">De krant wordt gedrukt…</h1><div class="sk"></div><div class="sk short"></div></div>`;
}

export function errorPanel(message) {
  return `<div class="page"><p class="kicker">Drukfout</p><h1 class="headline">De krant kon niet worden gedrukt</h1><p class="deck">${esc(message)}</p></div>`;
}
