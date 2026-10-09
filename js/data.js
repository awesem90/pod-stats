// Loads data/pod.json (made from a BG Stats export by tools/import-bgstats.ps1) and data/articles.json.
import { CONFIG } from './config.js';

const CACHE_KEY = 'podstats:pod:v2';
let cards = {};

export const norm = s => String(s || '').replace(/[‘’ʼ]/g, "'").trim().toLowerCase().replace(/\s+/g, ' ');
const WUBRG = ['W', 'U', 'B', 'R', 'G'];

// Scryfall info looked up by the importer: { name, colors, art, image, artist, uri }.
export function card(name) { return cards[norm(name)] || null; }

function toGames(pod) {
  cards = pod.cards || {};
  return (pod.plays || []).map(p => {
    const winners = p.seats.filter(s => s.win).map(s => s.player);
    return {
      ...p,
      location: CONFIG.locationNames[p.location] ?? p.location,
      card: p.card ? card(p.card)?.name || p.card : null,
      winners,
      seats: p.seats.map(s => {
        const infos = s.commanders.map(card);
        const names = s.commanders.map((n, i) => infos[i]?.name || n);
        return {
          ...s,
          commander: names.join(' & ') || null,
          parts: names,
          colors: WUBRG.filter(c => infos.some(i => i?.colors.includes(c))),
        };
      }),
    };
  });
}

// Newest first: by date and time; on a tie, the entry added later to the file wins.
const toArticles = a => (a?.articles || []).map((x, i) => ({ ...x, order: i }))
  .sort((x, y) => (y.date + (y.time || '')).localeCompare(x.date + (x.time || '')) || y.order - x.order);
const toPod = raw => ({ games: toGames(raw.pod), generated: raw.pod.generated, articles: toArticles(raw.articles) });

function load(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ } }

export function cachedPod() {
  const raw = load(CACHE_KEY);
  return raw?.pod ? toPod(raw) : null;
}

async function getJson(file, required) {
  const res = await fetch(file, { cache: 'no-cache' });
  if (res.ok) return res.json();
  if (required) throw new Error(`Could not load ${file} (HTTP ${res.status}).`);
  return null;
}

export async function fetchPod() {
  const [pod, articles] = await Promise.all([getJson(CONFIG.dataFile, true), getJson(CONFIG.articlesFile, false)]);
  const raw = { pod, articles };
  save(CACHE_KEY, raw);
  return toPod(raw);
}
