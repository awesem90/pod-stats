import { fetchPod, cachedPod } from './data.js';
import { computeStats, pickSeason, seasons } from './stats.js';
import { header, footer, overview, tidbits, profile, commanders, plays, skeleton, errorPanel } from './render.js';

const app = document.getElementById('app');
const pref = {
  get(k, d) { try { return localStorage.getItem('podstats:' + k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('podstats:' + k, v); } catch { /* ignore */ } },
};

// Editions: 'all', 'last10', 'season-2025' etc., and 'season' meaning the current season.
const RANGES = ['last10', 'season', 'all'];
const validRange = r => RANGES.includes(r) || /^season-\d{4}$/.test(r || '');
// Each page has its own edition; everything but the results page defaults to all games.
const DEFAULT_RANGE = { overview: 'all', player: 'all', commanders: 'all', plays: 'season', tidbits: 'all' };
const rangeFor = screen => { const r = pref.get('range:' + screen); return validRange(r) ? r : DEFAULT_RANGE[screen]; };

const state = {
  pod: null, // { games, generated }
  error: null,
  player: pref.get('player', ''),
};

let memo = { key: null, stats: null };
function stats(edition) {
  // 'season-2025' picks that season; 'season', 'last10' and unknown years use the current one.
  const current = pickSeason(state.pod.games);
  const asked = edition.startsWith('season-') ? +edition.slice(7) : current;
  const season = seasons(state.pod.games).includes(asked) ? asked : current;
  const range = edition.startsWith('season') ? 'season' : edition;
  const key = state.pod.generated + '|' + state.pod.games.length + '|' + range + '|' + season;
  if (memo.key !== key) {
    memo = { key, stats: computeStats(state.pod.games, { range, season }) };
    // The edition the masthead marks as active, e.g. 'season-2026'.
    memo.stats.edition = range === 'season' ? 'season-' + season : range;
    memo.stats.seasons = seasons(state.pod.games);
  }
  return memo.stats;
}

function route() {
  const [page, arg] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  // The Dutch paths ('speler', 'potjes') are kept so old links still work.
  if (page === 'player' || page === 'speler') return { screen: 'player', name: arg || null };
  if (page === 'games' || page === 'potjes') return { screen: 'plays', name: arg || null };
  if (page === 'commanders') return { screen: 'commanders' };
  if (page === 'tidbits') return { screen: 'tidbits' };
  return { screen: 'overview' };
}

function render() {
  const r = route();
  if (!state.pod) {
    app.innerHTML = header(null, r.screen) + `<main>${state.error ? errorPanel(state.error) : skeleton()}</main>`;
    return;
  }
  // The front page has no edition switch, so its standings story always covers all games.
  const st = stats(r.screen === 'overview' ? 'all' : rangeFor(r.screen));
  let body, title = '';
  if (r.screen === 'player') {
    const name = r.name || (st.players.some(p => p.name === state.player) ? state.player : st.players[0]?.name);
    if (name && name !== state.player) { state.player = name; pref.set('player', name); }
    body = profile(st, name); title = name;
  } else if (r.screen === 'plays') {
    body = plays(st, r.name); title = 'Results';
  } else if (r.screen === 'commanders') {
    body = commanders(st); title = 'Commanders';
  } else if (r.screen === 'tidbits') {
    body = tidbits(st); title = 'Tidbits';
  } else {
    body = overview(state.pod.articles, st);
  }
  document.title = (title ? title + ' · ' : '') + 'The Pod Times';
  app.innerHTML = header(st, r.screen) + `<main>${body}</main>` + footer(state.pod.generated);
}

app.addEventListener('click', e => {
  const b = e.target.closest('[data-range]');
  if (!b) return;
  pref.set('range:' + route().screen, b.dataset.range);
  render();
});

window.addEventListener('hashchange', () => { render(); window.scrollTo({ top: 0 }); });

async function start() {
  state.pod = cachedPod();
  render();
  try {
    state.pod = await fetchPod();
    state.error = null;
  } catch (err) {
    // Keep showing the last good edition if there is one.
    if (!state.pod) state.error = err.message;
    console.warn('Pod Times: data load failed', err);
  }
  render();
}

start();
