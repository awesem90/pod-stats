// Fetch the pod spreadsheet, parse it into games, and enrich commanders via Scryfall.
import { CONFIG } from './config.js';

const CACHE_KEY = 'podstats:games:v1';
const SCRY_KEY = 'podstats:scryfall:v2';

// ---------- Tiny localStorage helpers (storage may be blocked) ----------
function load(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ } }

export function cachedGames() { return load(CACHE_KEY)?.games || null; }

// ---------- CSV ----------
export function parseCSV(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ''));
}

// ---------- Column mapping ----------
const ALIASES = {
  date: ['date', 'datum', 'dag'],
  game: ['game', 'potje', 'game id', 'gameid', 'id', 'spel', 'nr', 'game nr', 'game #', '#', 'ronde'],
  player: ['player', 'speler', 'naam', 'name', 'wie'],
  commander: ['commander', 'deck', 'cmdr', 'commander (deck)'],
  colors: ['colors', 'colours', 'color', 'colour', 'kleuren', 'kleur', 'color identity', 'identity'],
  archetype: ['archetype', 'type', 'stijl', 'strategie', 'strategy', 'thema'],
  win: ['win', 'winst', 'won', 'gewonnen', 'winnaar', 'winner', 'result', 'resultaat', 'uitslag', 'w'],
};
const straightQuotes = s => s.replace(/[‘’ʼ]/g, "'");
const norm = s => straightQuotes(String(s || '')).trim().toLowerCase().replace(/\s+/g, ' ');

function mapHeader(header) {
  const idx = {};
  header.forEach((h, i) => {
    const n = norm(h);
    for (const [key, names] of Object.entries(ALIASES)) {
      if (idx[key] === undefined && names.includes(n)) idx[key] = i;
    }
  });
  return idx;
}

const TRUTHY = new Set(['1', 'x', 'v', 'y', 'w', 'yes', 'ja', 'j', 'true', 'waar', 'win', 'winst', 'won', 'gewonnen', 'winner', 'winnaar', '✓', '✔', '🏆']);
const isWin = v => TRUTHY.has(norm(v));

// Accepts 2026-09-24, 24-9-2026, 24/09/2026, 9/24/2026 and "24 sep 2026"-ish values.
const MONTHS = { jan: 1, feb: 2, mrt: 3, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dec: 12 };
export function parseDate(v) {
  const s = String(v || '').trim();
  let m;
  const iso = (y, mo, d) => `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return iso(m[1], m[2], m[3]);
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) {
    let a = +m[1], b = +m[2], y = +m[3];
    if (y < 100) y += 2000;
    // Dutch sheets are day-first; only flip when that is impossible.
    let d = a, mo = b;
    if (b > 12 && a <= 12) { d = b; mo = a; }
    return iso(y, mo, d);
  }
  if ((m = s.match(/^(\d{1,2})\s+([a-z]{3})[a-z]*\.?\s+(\d{4})/i))) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo) return iso(m[3], mo, m[1]);
  }
  if ((m = s.match(/^Date\((\d+),(\d+),(\d+)/))) return iso(m[1], +m[2] + 1, m[3]);
  return null;
}

const COLOR_WORDS = { wit: 'W', white: 'W', blauw: 'U', blue: 'U', zwart: 'B', black: 'B', rood: 'R', red: 'R', groen: 'G', green: 'G' };
function parseColors(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  const words = s.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  if (words.length && words.every(w => COLOR_WORDS[w])) return orderColors(words.map(w => COLOR_WORDS[w]));
  const letters = s.toUpperCase().replace(/[^WUBRGC]/g, '').replace(/C/g, '');
  return orderColors(letters.split(''));
}
const WUBRG = ['W', 'U', 'B', 'R', 'G'];
const orderColors = arr => WUBRG.filter(c => arr.includes(c));

const displayName = raw => {
  const n = String(raw || '').trim();
  return CONFIG.nameMap[n] || CONFIG.nameMap[n.toLowerCase()] || n;
};

// Turn the sheet (one row per player per game) into Game objects.
export function rowsToGames(rows) {
  if (!rows.length) return { games: [], problems: ['De spreadsheet is leeg.'] };
  const idx = mapHeader(rows[0]);
  const problems = [];
  for (const k of ['date', 'player']) if (idx[k] === undefined) problems.push(`Kolom "${k}" niet gevonden in de spreadsheet.`);
  if (problems.length) return { games: [], problems };

  const get = (r, k) => idx[k] === undefined ? '' : (r[idx[k]] ?? '').trim();
  const games = []; const byKey = new Map(); let current = null;

  rows.slice(1).forEach((r, i) => {
    const date = parseDate(get(r, 'date'));
    const player = displayName(get(r, 'player'));
    if (!date || !player) return;
    const seat = {
      player,
      commander: get(r, 'commander') || null,
      colors: parseColors(get(r, 'colors')),
      archetype: get(r, 'archetype') || '',
      win: isWin(get(r, 'win')),
    };
    let game;
    if (idx.game !== undefined && get(r, 'game')) {
      const key = date + '|' + get(r, 'game');
      game = byKey.get(key);
      if (!game) { game = { id: key, date, seats: [] }; byKey.set(key, game); games.push(game); }
    } else {
      // No game column: consecutive rows on the same date form one game until a player repeats.
      if (!current || current.date !== date || current.seats.some(s => s.player === seat.player)) {
        current = { id: date + '#' + i, date, seats: [] }; games.push(current);
      }
      game = current;
    }
    game.seats.push(seat);
  });

  const valid = games.filter(g => g.seats.length >= 2);
  valid.sort((a, b) => a.date.localeCompare(b.date)); // stable: keeps sheet order within a day
  return { games: valid, problems };
}

export function sheetUrl() {
  const base = `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/gviz/tq?tqx=out:csv`;
  return CONFIG.sheetTab ? `${base}&sheet=${encodeURIComponent(CONFIG.sheetTab)}` : base;
}

export async function fetchGames() {
  const res = await fetch(sheetUrl() + '&_=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error('Spreadsheet gaf HTTP ' + res.status);
  const text = await res.text();
  if (/^\s*</.test(text)) throw new Error('Spreadsheet is niet openbaar gedeeld.');
  const { games, problems } = rowsToGames(parseCSV(text));
  if (problems.length) throw new Error(problems.join(' '));
  save(CACHE_KEY, { at: Date.now(), games });
  return games;
}

// ---------- Scryfall (art + colour identity) ----------
export const splitCommander = name => String(name || '').split(/\s+(?:\/|\+|&)\s+/).map(s => s.trim()).filter(Boolean);
const scryCache = load(SCRY_KEY) || {};

export function cardInfo(name) { return scryCache[norm(name)] || null; }

export async function enrichCommanders(names) {
  const wanted = [...new Set(names.flatMap(splitCommander))].filter(n => !(norm(n) in scryCache));
  for (let i = 0; i < wanted.length; i += 75) {
    const batch = wanted.slice(i, i + 75);
    try {
      const res = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ identifiers: batch.map(name => ({ name: straightQuotes(name) })) }),
      });
      if (!res.ok) continue;
      const json = await res.json();
      const found = {};
      for (const card of json.data || []) {
        const face = card.image_uris ? card : (card.card_faces || [])[0] || {};
        const info = {
          name: card.name,
          colors: orderColors(card.color_identity || []),
          art: face.image_uris?.art_crop || null,
          artist: face.artist || card.artist || '',
          uri: card.scryfall_uri || '',
        };
        found[norm(card.name)] = info;
        found[norm(card.name.split(' // ')[0])] = info;
      }
      for (const n of batch) scryCache[norm(n)] = found[norm(n)] || null;
    } catch { /* offline or blocked: keep placeholders */ }
  }
  save(SCRY_KEY, scryCache);
}

// Colours for a commander: from the sheet if given, otherwise from Scryfall.
export function commanderColors(name, sheetColors) {
  if (sheetColors && sheetColors.length) return sheetColors;
  const cs = splitCommander(name).flatMap(n => cardInfo(n)?.colors || []);
  return orderColors(cs);
}
