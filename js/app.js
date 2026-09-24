import { CONFIG } from './config.js';
import { fetchGames, cachedGames, enrichCommanders } from './data.js';
import { computeStats, pickSeason } from './stats.js';
import { header, overview, profile, skeleton, errorPanel } from './render.js';
import { demoGames } from './demo.js';

const app = document.getElementById('app');
const pref = {
  get(k, d) { try { return localStorage.getItem('podstats:' + k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('podstats:' + k, v); } catch { /* ignore */ } },
};

const state = {
  games: null,
  error: null,
  range: pref.get('range', 'season'),
  player: pref.get('player', ''),
};

let memo = { key: null, stats: null };
function stats() {
  const season = pickSeason(state.games);
  const key = state.games.length + '|' + state.range + '|' + season + '|' + enrichTick;
  if (memo.key !== key) memo = { key, stats: computeStats(state.games, { range: state.range, season }) };
  return memo.stats;
}

function route() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  if (h.startsWith('speler')) return { screen: 'player', name: h.slice('speler/'.length) || null };
  return { screen: 'overview' };
}

function render() {
  const r = route();
  if (!state.games) {
    app.innerHTML = header(null, r.screen) + `<main>${state.error ? errorPanel(state.error) : skeleton()}</main>`;
    return;
  }
  const st = stats();
  let body;
  if (r.screen === 'player') {
    const name = r.name || (st.players.some(p => p.name === state.player) ? state.player : st.players[0]?.name);
    if (name && name !== state.player) { state.player = name; pref.set('player', name); }
    body = profile(st, name);
    document.title = (name ? name + ' · ' : '') + 'POD//STATS';
  } else {
    body = overview(st, state.range);
    document.title = 'POD//STATS';
  }
  app.innerHTML = header(st, r.screen) + `<main>${body}</main>`;
}

app.addEventListener('click', e => {
  const b = e.target.closest('[data-range]');
  if (!b) return;
  state.range = b.dataset.range; pref.set('range', state.range);
  render();
});

let lastScreen = null;
window.addEventListener('hashchange', () => {
  render();
  const s = location.hash;
  if (s !== lastScreen) window.scrollTo({ top: 0 });
  lastScreen = s;
});

let enrichTick = 0;
async function enrich() {
  const names = state.games.flatMap(g => g.seats.map(s => s.commander).filter(Boolean));
  await enrichCommanders(names);
  enrichTick++;
  render();
}

async function start() {
  if (new URLSearchParams(location.search).has('demo')) {
    state.games = demoGames();
    render(); enrich();
    return;
  }
  state.games = cachedGames();
  render();
  if (state.games) enrich();
  try {
    state.games = await fetchGames();
    state.error = null;
    render(); enrich();
  } catch (err) {
    // Keep showing the last good data if we have any.
    if (!state.games) {
      // A private sheet redirects to Google sign-in, which the browser reports as a bare network error.
      state.error = err instanceof TypeError ? 'De spreadsheet is niet openbaar gedeeld (of je bent offline).' : err.message;
      render();
    }
    console.warn('POD//STATS: fetch failed', err);
  }
}

start();
