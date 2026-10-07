// Loads data/pod.json (made from a BG Stats export by tools/import-bgstats.ps1).
import { CONFIG } from './config.js';

const CACHE_KEY = 'podstats:pod:v1';
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

function load(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ } }

export function cachedPod() {
  const pod = load(CACHE_KEY);
  return pod ? { games: toGames(pod), generated: pod.generated } : null;
}

export async function fetchPod() {
  const res = await fetch(CONFIG.dataFile, { cache: 'no-cache' });
  if (!res.ok) throw new Error('Kon ' + CONFIG.dataFile + ' niet laden (HTTP ' + res.status + ').');
  const pod = await res.json();
  save(CACHE_KEY, pod);
  return { games: toGames(pod), generated: pod.generated };
}
