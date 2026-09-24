// HTML for both screens. Everything is built from the stats object.
import { CONFIG } from './config.js';
import { cardInfo, splitCommander } from './data.js';
import { pct, nl1, fmtStreak, shortDate, monthYear, COLOR_NL } from './stats.js';

const MANA = { W: '#F4EBC8', U: '#4FB3FF', B: '#A58CFF', R: '#FF5A4E', G: '#3DDC84' };
const ACC = '#C8FF2E';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const playerHref = name => '#/speler/' + encodeURIComponent(name);
const two = n => String(n).padStart(2, '0');
const above = (v, avg) => v > avg;

function pips(colors, lg = false) {
  if (!CONFIG.showMana || !colors || !colors.length) return '';
  const size = lg ? 8 : 6;
  return `<span class="pips${lg ? ' lg' : ''}">${colors.map(c =>
    `<span class="pip" style="background:${MANA[c]};box-shadow:0 0 ${size}px ${MANA[c]}" title="${COLOR_NL[c]}"></span>`).join('')}</span>`;
}

function art(commander, idx = '') {
  if (!CONFIG.showArtwork) return '';
  const info = splitCommander(commander).map(cardInfo).find(i => i && i.art);
  const idxHtml = idx ? `<span class="art-idx">${esc(idx)}</span>` : '';
  if (!info) return `<div class="art">${idxHtml}<span class="art-label">[ ARTWORK ]</span></div>`;
  return `<div class="art">
    <span class="art-label">[ ARTWORK ]</span>
    <img src="${esc(info.art)}" alt="" loading="lazy" onload="this.classList.add('loaded');this.parentNode.classList.add('has-img')" onerror="this.remove()">
    ${idxHtml}
    ${info.artist ? `<a class="art-credit" href="${esc(info.uri)}" target="_blank" rel="noopener">ART: ${esc(info.artist.toUpperCase())}</a>` : ''}
  </div>`;
}

const streakTag = s => `<span class="streak-tag ${s > 0 ? 'pos' : s < 0 ? 'neg' : ''}">${fmtStreak(s)}</span>`;
const record = (w, g) => `${w}W–${g - w}L · ${g}`;

function segBar(v, avg) {
  const on = Math.min(20, Math.round(v / 40 * 20));
  return `<span class="seg${above(v, avg) ? ' hi' : ''}">${Array.from({ length: 20 }, (_, i) => `<span${i < on ? ' class="on"' : ''}></span>`).join('')}</span>`;
}

function barRow(name, v, { max, hi, wide = false }) {
  const w = Math.round(Math.min(100, v / max * 100));
  return `<span class="bar-row${wide ? ' wide' : ''}${hi ? ' hi' : ''}">
    <span class="bar-name" title="${esc(name)}">${esc(name)}</span>
    <span class="bar-track"><span class="bar-fill" style="width:${w}%"></span></span>
    <span class="bar-val">${v}%</span>
  </span>`;
}

// ---------- Header ----------
export function header(st, screen) {
  const status = st
    ? `S${String(st.season).slice(-2)} · ${st.games.length} POTJES · ${st.players.length} SPELERS`
    : 'LADEN…';
  return `
  <header class="topbar">
    <a class="logo" href="#/" aria-label="POD//STATS, naar overzicht">
      <span class="logo-bars">${Object.values(MANA).map(c => `<span style="background:${c}"></span>`).join('')}</span>
      <span class="logo-text">POD<span>//</span>STATS</span>
    </a>
    <nav class="nav">
      <a href="#/" class="${screen === 'overview' ? 'active' : ''}">Overzicht</a>
      <a href="#/speler" class="${screen === 'player' ? 'active' : ''}">Speler</a>
    </nav>
    <div class="status"><span class="status-dot"></span>${status}</div>
  </header>`;
}

// ---------- Overview ----------
export function overview(st, range) {
  const { avg } = st;
  const L = st.players[0];
  const lopend = st.season === new Date().getFullYear();
  const rangeLabel = range === 'last10' ? `laatste ${st.games.length} · seizoen ${st.season}` : `seizoen ${st.season}`;

  const leader = L ? `
    <a class="leader featured" href="${playerHref(L.name)}">
      <span class="leader-top">
        <span>RANK 01 · POD-LEIDER</span>
        <span class="leader-streak"><span class="pulse-dot"></span>STREAK ${fmtStreak(L.streak)}</span>
      </span>
      <span class="leader-mid">
        <span class="leader-id">
          <span class="leader-name">${esc(L.name)}</span>
          <span class="leader-deck">${esc(L.mainDeck || '—')}</span>
        </span>
        <span class="leader-rate">${L.rate}%</span>
      </span>
      <span class="ticks" style="grid-template-columns:repeat(${L.results.length},minmax(0,1fr))">
        ${L.results.map(w => `<span${w ? ' class="on"' : ''}></span>`).join('')}
      </span>
      <span class="leader-foot">${L.wins} WINST / ${L.games} POTJES · POD-GEMIDDELDE ${nl1(avg)}%</span>
    </a>` : `<div class="leader featured"><span class="empty">NOG GEEN POTJES IN DIT SEIZOEN</span></div>`;

  const kpis = [
    { label: 'POTJES GELOGD', value: st.games.length, sub: rangeLabel + ' · via spreadsheet' },
    { label: 'SPELERS', value: st.players.length, sub: `gemiddeld ${nl1(st.avgSeats)} aan tafel` },
    { label: 'UNIEKE COMMANDERS', value: st.uniqueCommanders, sub: 'uit de pod-spreadsheet' },
    { label: 'LANGSTE STREAK', value: st.longest ? st.longest.streak : 0, sub: st.longest ? `${st.longest.name} · nog lopend` : 'geen lopende winstreeks' },
  ];

  const standings = st.players.map((p, i) => `
    <a class="standing" href="${playerHref(p.name)}">
      <span class="rank${i === 0 ? ' first' : ''}">${two(i + 1)}</span>
      <span class="who">
        <span class="who-line"><span class="who-name">${esc(p.name)}</span>${pips(p.mainColors)}</span>
        <span class="who-deck">${esc(p.mainDeck || '—')}</span>
      </span>
      <span class="seg-wrap">${segBar(p.rate, avg)}<span class="record">${p.wins}W / ${p.games - p.wins}L</span></span>
      <span class="rate-col"><span class="rate${above(p.rate, avg) ? ' hi' : ''}">${p.rate}%</span>${streakTag(p.streak)}</span>
    </a>`).join('');

  const form = st.players.map(p => `
    <div class="form-row">
      <span class="form-id"><span class="form-name">${esc(p.name)}</span><span class="form-note">${esc(p.formNote)}</span></span>
      <span class="marks">${Array.from({ length: 5 - p.form.length }, () => '<span class="none"></span>').join('')}${p.form.map(w => `<span${w ? ' class="w"' : ''}></span>`).join('')}</span>
    </div>`).join('');

  const commanders = st.strong.length ? `<div class="tiles tiles-240">${st.strong.map((c, i) => `
    <article class="tile${i === 0 ? ' top' : ''}">
      ${art(c.name, 'CMD_' + two(i + 1))}
      <div class="tile-body">
        <span class="tile-head"><span class="tile-name">${esc(c.name)}</span>${pips(c.colors, true)}</span>
        <span class="tile-sub">${esc(c.pilotList.map(p => p.name).join(', '))}${c.archetype ? ' · ' + esc(c.archetype) : ''}</span>
        <span class="tile-foot"><span class="tile-rate">${c.rate}%</span><span class="tile-rec">${record(c.wins, c.games)}</span></span>
      </div>
    </article>`).join('')}</div>`
    : `<p class="empty">NOG GEEN COMMANDER MET MIN. ${CONFIG.minCommanderGames} POTJES BOVEN HET POD-GEMIDDELDE</p>`;

  const shared = st.shared.length ? st.shared.map(c => `
    <div class="group">
      <span class="group-head"><span class="group-name">${esc(c.name)}</span><span class="caption">${c.games} POTJES</span></span>
      ${c.pilotList.map(p => { const v = pct(p.wins, p.games); return barRow(p.name, v, { max: 40, hi: above(v, avg) }); }).join('')}
    </div>`).join('')
    : `<p class="empty">NOG GEEN COMMANDER DIE DOOR 2+ SPELERS IS GESPEELD</p>`;

  const n = st.names.length;
  const cols = `grid-template-columns:60px repeat(${n},minmax(38px,1fr))`;
  const rivalry = !CONFIG.showRivalry ? '' : `
    <div class="panel panel-pad">
      <div class="stack" style="gap:8px">
        <h2 class="h2">Rivaliteiten</h2>
        <p class="helper">Winrate van de speler in de rij wanneer de speler in de kolom ook aan tafel zit.</p>
      </div>
      ${n < 2 ? '<p class="empty">TE WEINIG SPELERS VOOR EEN MATRIX</p>' : `
      <div class="matrix-wrap"><div class="matrix">
        <div class="m-row" style="${cols}"><span></span>${st.names.map(x => `<span class="m-head" title="${esc(x)}">${esc(x.slice(0, 3).toUpperCase())}</span>`).join('')}</div>
        ${st.matrix.map(row => `
        <div class="m-row" style="${cols}">
          <span class="m-name" title="${esc(row.name)}">${esc(row.name)}</span>
          ${row.cells.map(c => {
            if (!c) return '<span class="m-cell diag">—</span>';
            if (!c.games) return '<span class="m-cell diag" title="Nooit samen aan tafel">·</span>';
            const t = Math.min(1, Math.max(0, (c.rate - 8) / 32));
            return `<span class="m-cell" title="${esc(row.name)} vs ${esc(c.vs)}: ${c.rate}% in ${c.games} potjes" style="background:rgba(200,255,46,${(0.03 + t * 0.55).toFixed(2)});border-color:rgba(200,255,46,${(0.08 + t * 0.4).toFixed(2)});color:${t > 0.6 ? '#06070A' : '#C5CCD6'}">${c.rate}%</span>`;
          }).join('')}
        </div>`).join('')}
      </div></div>`}
      ${st.rivalries.length ? `<div class="callouts">${st.rivalries.map(r => `<p class="callout"><span class="prompt">&gt;</span><span>${esc(r)}</span></p>`).join('')}</div>` : ''}
    </div>`;

  return `
  <div class="stack">
    <section class="hero">
      <div class="hero-left">
        <div class="hero-copy">
          <span class="eyebrow">&gt; SEIZOEN ${st.season} / ${lopend ? 'LOPEND' : 'AFGESLOTEN'}</span>
          <h1>${CONFIG.podName.map(esc).join('<br>')}</h1>
          <p>${esc(CONFIG.tagline)}</p>
        </div>
        <div class="range" role="group" aria-label="Periode">
          <button data-range="last10" class="${range === 'last10' ? 'active' : ''}" aria-pressed="${range === 'last10'}">Laatste ${CONFIG.lastN}</button>
          <button data-range="season" class="${range === 'season' ? 'active' : ''}" aria-pressed="${range === 'season'}">Heel seizoen</button>
        </div>
      </div>
      ${leader}
    </section>

    <section class="kpis">${kpis.map(k => `
      <div class="kpi"><span class="kpi-label">${k.label}</span><span class="kpi-value">${k.value}</span><span class="kpi-sub">${esc(k.sub)}</span></div>`).join('')}
    </section>

    <section class="row row-340">
      <div class="panel span-2">
        <div class="panel-head"><h2 class="h2">Pod-standen</h2><span class="caption">WINRATE · KLIK VOOR PROFIEL</span></div>
        ${standings || '<p class="empty" style="padding:16px 22px">NOG GEEN POTJES</p>'}
      </div>
      <div class="panel form-panel">
        <h2 class="h2 panel-head">Vorm &amp; streaks</h2>
        ${form}
        <span class="foot-note">LAATSTE 5 · OUDSTE LINKS · GROEN = WINST</span>
      </div>
    </section>

    <section class="panel panel-pad" style="gap:16px">
      <div style="display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:10px">
        <h2 class="h2">Commanders boven pod-gemiddelde</h2>
        <span class="caption">MIN. ${CONFIG.minCommanderGames} POTJES · &gt; ${nl1(avg)}%</span>
      </div>
      ${commanders}
    </section>

    <section class="row row-340">
      <div class="panel panel-pad">
        <div class="stack" style="gap:8px">
          <h2 class="h2">Het deck of de speler?</h2>
          <p class="helper">Dezelfde commander, andere piloot. Waar de balken uiteenlopen, zit het verschil in de speler.</p>
        </div>
        ${shared}
      </div>
      ${rivalry}
    </section>

    <p class="source">${esc(CONFIG.source)}</p>
  </div>`;
}

// ---------- Player profile ----------
export function profile(st, name) {
  const { avg } = st;
  const p = st.players.find(x => x.name === name);
  const switcher = st.players.map(x => `<a href="${playerHref(x.name)}" class="${p && x.name === p.name ? 'active' : ''}">${esc(x.name)}</a>`).join('');
  const toolbar = `
    <div class="toolbar">
      <a class="back" href="#/">&lt; OVERZICHT</a>
      <div class="switcher">${switcher}</div>
    </div>`;
  if (!p) return `<div class="stack">${toolbar}<div class="panel panel-pad"><p class="empty">${esc((name || '').toUpperCase())} HEEFT GEEN POTJES IN DEZE SELECTIE</p></div></div>`;

  const decks = [...p.decks.values()].map(d => ({ ...d, rate: pct(d.wins, d.games), exact: d.wins / d.games, archetype: mostCommon(d.archetypes) }))
    .sort((a, b) => b.games - a.games || b.exact - a.exact);
  const best = decks.slice().sort((a, b) => b.exact - a.exact || b.games - a.games)[0];
  const fav = Object.keys(p.colorGames).sort((a, b) => p.colorGames[b] - p.colorGames[a])[0];
  const since = st.firstSeen[p.name];
  const periodWord = st.range === 'last10' ? 'in de laatste ' + st.games.length : 'dit seizoen';

  const stats = [
    { label: 'POTJES', value: p.games, sub: periodWord + ' gelogd' },
    { label: 'OVERWINNINGEN', value: p.wins, sub: 'pod-gemiddelde is ' + nl1(st.avgWinsPerPlayer) },
    { label: 'BESTE DECK', value: best ? best.rate + '%' : '—', sub: best ? best.name : 'geen commander ingevuld' },
    { label: 'FAVORIETE KLEUR', value: fav ? COLOR_NL[fav] : '—', sub: decks.length + (decks.length === 1 ? ' deck' : ' decks') + ' in rotatie' },
  ];

  const vs = st.matrix.find(r => r.name === p.name).cells.filter(c => c && c.games)
    .map(c => barRow(c.vs, c.rate, { max: 45, hi: c.rate >= 30, wide: true })).join('');

  const log = p.log.slice(-6).reverse().map(({ game, seat }) => {
    const others = game.seats.filter(s => s.player !== p.name).map(s => s.player);
    return `
    <div class="log-row">
      <span class="log-date">${shortDate(game.date)}</span>
      <span class="log-mid">
        <span class="log-deck">${esc(seat.commander || '—')}</span>
        <span class="log-table">met ${esc(others.join(' · '))}${game.minutes ? ' · ' + fmtMinutes(game.minutes) : ''}</span>
      </span>
      <span class="result${seat.win ? ' w' : ''}">${seat.win ? 'WINST' : 'VERLIES'}</span>
    </div>`;
  }).join('');

  return `
  <div class="stack">
    ${toolbar}
    <section class="profile-head featured">
      <div class="profile-id">
        <span class="eyebrow">&gt; SPELERPROFIEL / RANK ${two(p.rank)}</span>
        <h1>${esc(p.name)}</h1>
        <span class="profile-sub">${since ? 'Vaste speler sinds ' + monthYear(since) + ' · ' : ''}${p.games} potjes ${periodWord}</span>
      </div>
      <div class="readouts">
        <span class="readout"><span class="kpi-label">WINRATE</span><span class="readout-val acc">${p.rate}%</span></span>
        <span class="readout"><span class="kpi-label">STREAK</span><span class="readout-val">${fmtStreak(p.streak)}</span></span>
      </div>
    </section>

    <section class="kpis small">${stats.map(s => `
      <div class="kpi"><span class="kpi-label">${s.label}</span><span class="kpi-value">${esc(s.value)}</span><span class="kpi-sub" title="${esc(s.sub)}">${esc(s.sub)}</span></div>`).join('')}
    </section>

    <section class="panel panel-pad" style="gap:16px">
      <h2 class="h2">Decks</h2>
      ${decks.length ? `<div class="tiles tiles-230">${decks.map(d => `
        <article class="tile">
          ${art(d.name)}
          <div class="tile-body">
            <span class="tile-head"><span class="tile-name">${esc(d.name)}</span>${pips(d.colors, true)}</span>
            <span class="tile-sub">${esc(d.archetype || ' ')}</span>
            <span class="tile-foot"><span class="tile-rate${above(d.rate, avg) ? ' hi' : ''}">${d.rate}%</span><span class="tile-rec">${record(d.wins, d.games)}</span></span>
          </div>
        </article>`).join('')}</div>` : '<p class="empty">GEEN COMMANDERS INGEVULD</p>'}
    </section>

    <section class="row row-320">
      <div class="panel panel-pad" style="gap:16px">
        <h2 class="h2">Tegen de pod</h2>
        ${vs || '<p class="empty">NOG NIET SAMEN MET ANDEREN GESPEELD</p>'}
        <span class="foot-note">WINRATE WANNEER DEZE SPELER OOK AAN TAFEL ZIT</span>
      </div>
      <div class="panel log-panel">
        <h2 class="h2 panel-head">Laatste potjes</h2>
        ${log}
      </div>
    </section>

    <p class="source">${esc(CONFIG.source)}</p>
  </div>`;
}

const fmtMinutes = m => m >= 60 ? Math.floor(m / 60) + 'u' + String(m % 60).padStart(2, '0') : m + ' min';

function mostCommon(list) {
  const c = {}; list.forEach(v => { c[v] = (c[v] || 0) + 1; });
  return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || '';
}

// ---------- Loading + error ----------
export function skeleton() {
  const block = (h, extra = '') => `<div class="sk" style="height:${h}px;${extra}"></div>`;
  return `
  <div class="stack" aria-busy="true" aria-label="Laden">
    <section class="hero">
      <div class="hero-left"><div class="hero-copy">${block(12, 'width:200px')}${block(150, 'width:80%')}${block(16, 'width:70%')}</div>${block(40, 'width:240px')}</div>
      ${block(240)}
    </section>
    ${block(112)}
    <section class="row row-340"><div class="span-2">${block(360)}</div>${block(360)}</section>
  </div>`;
}

export function errorPanel(message) {
  return `
  <div class="stack">
    <section class="panel panel-pad featured" style="border-color:rgba(200,255,46,0.3)">
      <span class="eyebrow">&gt; GEEN DATA</span>
      <h2 class="h2">De spreadsheet kon niet worden geladen</h2>
      <p class="helper">${esc(message)}</p>
      <p class="helper">Controleer in Google Sheets: <b>Delen → Algemene toegang → Iedereen met de link → Viewer</b>.</p>
    </section>
  </div>`;
}
