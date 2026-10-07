import { fetchPod, cachedPod } from './data.js';
import { computeStats, pickSeason } from './stats.js';
import { header, footer, overview, profile, commanders, plays, skeleton, errorPanel } from './render.js';

const app = document.getElementById('app');
const pref = {
  get(k, d) { try { return localStorage.getItem('podstats:' + k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('podstats:' + k, v); } catch { /* ignore */ } },
};

const RANGES = ['last10', 'season', 'all'];
// Each page has its own edition; the profiles and the commander list default to all games.
const DEFAULT_RANGE = { overview: 'season', player: 'all', commanders: 'all', plays: 'season' };
const rangeFor = screen => { const r = pref.get('range:' + screen); return RANGES.includes(r) ? r : DEFAULT_RANGE[screen]; };

const state = {
  pod: null, // { games, generated }
  error: null,
  player: pref.get('player', ''),
};

let memo = { key: null, stats: null };
function stats(range) {
  const season = pickSeason(state.pod.games);
  const key = state.pod.generated + '|' + state.pod.games.length + '|' + range + '|' + season;
  if (memo.key !== key) memo = { key, stats: computeStats(state.pod.games, { range, season }) };
  return memo.stats;
}

function route() {
  const [page, arg] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  if (page === 'speler') return { screen: 'player', name: arg || null };
  if (page === 'potjes') return { screen: 'plays', name: arg || null };
  if (page === 'commanders') return { screen: 'commanders' };
  return { screen: 'overview' };
}

function render() {
  const r = route();
  if (!state.pod) {
    app.innerHTML = header(null, r.screen) + `<main>${state.error ? errorPanel(state.error) : skeleton()}</main>`;
    return;
  }
  const st = stats(rangeFor(r.screen));
  let body, title = '';
  if (r.screen === 'player') {
    const name = r.name || (st.players.some(p => p.name === state.player) ? state.player : st.players[0]?.name);
    if (name && name !== state.player) { state.player = name; pref.set('player', name); }
    body = profile(st, name); title = name;
  } else if (r.screen === 'plays') {
    body = plays(st, r.name); title = 'Uitslagen';
  } else if (r.screen === 'commanders') {
    body = commanders(st); title = 'Commanders';
  } else {
    body = overview(st);
  }
  document.title = (title ? title + ' · ' : '') + 'The Pod Times';
  app.innerHTML = header(st, r.screen, state.pod.generated) + `<main>${body}</main>` + footer(state.pod.generated);
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
