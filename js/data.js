// Fetch the pod spreadsheet (Google Form responses), parse it into games, and resolve commanders via Scryfall.
import { CONFIG } from './config.js';

const CACHE_KEY = 'podstats:games:v2';
const SCRY_KEY = 'podstats:scryfall:v3';

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

const straightQuotes = s => s.replace(/[‘’ʼ]/g, "'");
export const norm = s => straightQuotes(String(s || '')).trim().toLowerCase().replace(/\s+/g, ' ');

// ---------- Columns (matched on words in the form question) ----------
const COLUMNS = {
  timestamp: ['timestamp', 'tijdstempel'],
  played: ['speelde', 'commanders', 'spelers'],
  winner: ['won', 'winnaar', 'winner'],
  card: ['card of the match', 'kaart'],
  date: ['wanneer', 'datum', 'date'],
  duration: ['hoe lang', 'duur', 'duration'],
};
function mapHeader(header) {
  const idx = {};
  for (const [key, words] of Object.entries(COLUMNS)) {
    const i = header.findIndex((h, j) => !Object.values(idx).includes(j) && words.some(w => norm(h).includes(w)));
    if (i >= 0) idx[key] = i;
  }
  return idx;
}

// ---------- Dates ----------
// Form sheets use the sheet's locale (US here: 9/17/2026). Detect day- vs month-first from the data itself.
const SLASH = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/;
function detectOrder(values) {
  for (const v of values) {
    const m = String(v).trim().match(SLASH);
    if (!m) continue;
    if (+m[1] > 12) return 'dmy';
    if (+m[2] > 12) return 'mdy';
  }
  return 'mdy';
}
function parseDate(v, order) {
  const s = String(v || '').trim();
  const iso = (y, mo, d) => `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return iso(m[1], m[2], m[3]);
  if ((m = s.match(SLASH))) {
    let y = +m[3]; if (y < 100) y += 2000;
    return order === 'dmy' ? iso(y, m[2], m[1]) : iso(y, m[1], m[2]);
  }
  return null;
}
const timeOf = v => (String(v).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/) || []).slice(1).map(n => String(+n || 0).padStart(2, '0')).join(':');

// "1:29" -> 89 minutes, "45" -> 45
function parseDuration(v) {
  const s = String(v || '').trim();
  let m;
  if ((m = s.match(/^(\d+):(\d{2})/))) return +m[1] * 60 + +m[2];
  if ((m = s.match(/^(\d+)/))) return +m[1];
  return null;
}

// ---------- Names ----------
const titleCase = s => s.replace(/\b\p{L}/gu, c => c.toUpperCase());
const displayName = raw => {
  const n = String(raw || '').trim().replace(/\s+/g, ' ');
  return CONFIG.nameMap[n] || CONFIG.nameMap[n.toLowerCase()] || titleCase(n);
};

// "Sem - aragorn hero, Toon - Imodane, Patrick Yshtola" -> [{player, commander}]
function parsePlayed(text) {
  return String(text || '').split(/[,;\n]+/).map(s => s.trim()).filter(Boolean).map(entry => {
    let m = entry.match(/^(.+?)\s+[-–—:]\s*(.+)$/) || entry.match(/^(.+?)\s*[-–—:]\s+(.+)$/);
    if (!m) m = entry.match(/^(\S+)\s+(.+)$/);
    return m ? { player: displayName(m[1]), commander: m[2].trim() } : { player: displayName(entry), commander: null };
  });
}

// ---------- Rows -> games ----------
export function rowsToGames(rows) {
  if (!rows.length) return { games: [], problems: ['De spreadsheet is leeg.'] };
  const idx = mapHeader(rows[0]);
  const problems = [];
  if (idx.played === undefined) problems.push('Kolom "Wie speelde welke commanders?" niet gevonden.');
  if (idx.date === undefined && idx.timestamp === undefined) problems.push('Geen datumkolom gevonden.');
  if (problems.length) return { games: [], problems };

  const body = rows.slice(1);
  const get = (r, k) => idx[k] === undefined ? '' : (r[idx[k]] ?? '').trim();
  const order = detectOrder([...body.map(r => get(r, 'date')), ...body.map(r => get(r, 'timestamp'))]);

  const games = [];
  body.forEach((r, i) => {
    const date = parseDate(get(r, 'date'), order) || parseDate(get(r, 'timestamp'), order);
    if (!date) return;
    const winner = norm(get(r, 'winner'));
    const seats = parsePlayed(get(r, 'played')).map(s => ({
      ...s,
      win: !!winner && (norm(s.player) === winner || norm(s.player).startsWith(winner) || winner.startsWith(norm(s.player))),
    }));
    // Only one winner per game, even if a loose name match hit twice.
    let seen = false; seats.forEach(s => { if (s.win && seen) s.win = false; if (s.win) seen = true; });
    if (seats.length < 2) return;
    const stamp = parseDate(get(r, 'timestamp'), order);
    games.push({
      id: 'r' + (i + 2),
      date,
      sort: date + ' ' + (stamp || '') + ' ' + timeOf(get(r, 'timestamp')),
      seats,
      card: get(r, 'card') || null,
      minutes: parseDuration(get(r, 'duration')),
    });
  });
  games.sort((a, b) => a.sort.localeCompare(b.sort));
  return { games, problems };
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

// ---------- Scryfall: informal name -> real card (name, art, colour identity) ----------
export const splitCommander = name => String(name || '').split(/\s+(?:\/\/?|\+)\s+/).map(s => s.trim()).filter(Boolean);
const WUBRG = ['W', 'U', 'B', 'R', 'G'];
const orderColors = arr => WUBRG.filter(c => arr.includes(c));
const scryCache = load(SCRY_KEY) || {};
const missed = new Set(); // lookups that failed this visit; retried next visit

export function cardInfo(raw) { return scryCache[norm(raw)] || null; }

function toInfo(card) {
  const face = card.image_uris ? card : (card.card_faces || [])[0] || {};
  return {
    name: card.name.split(' // ')[0],
    colors: orderColors(card.color_identity || []),
    art: face.image_uris?.art_crop || null,
    artist: face.artist || card.artist || '',
    uri: card.scryfall_uri || '',
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function scry(path) {
  const res = await fetch('https://api.scryfall.com' + path, { headers: { Accept: 'application/json' } });
  return res.ok ? res.json() : null;
}

async function lookup(raw) {
  const pinned = CONFIG.commanderMap[norm(raw)] || CONFIG.commanderMap[raw];
  if (pinned) {
    const card = await scry('/cards/named?exact=' + encodeURIComponent(pinned));
    if (card) return toInfo(card);
  }
  // Best match among legal commanders (most played first), then a plain fuzzy name match.
  const q = straightQuotes(raw).replace(/'/g, '');
  const found = await scry('/cards/search?order=edhrec&q=' + encodeURIComponent(q + ' is:commander'));
  if (found?.data?.length) return toInfo(found.data[0]);
  await sleep(100);
  const fuzzy = await scry('/cards/named?fuzzy=' + encodeURIComponent(raw));
  return fuzzy ? toInfo(fuzzy) : null;
}

export async function enrichCommanders(rawNames) {
  const wanted = [...new Set(rawNames.flatMap(splitCommander).map(norm))].filter(n => !(n in scryCache) && !missed.has(n));
  let changed = false;
  for (const n of wanted) {
    try {
      const info = await lookup(n);
      if (info) { scryCache[n] = info; scryCache[norm(info.name)] = info; changed = true; } else missed.add(n);
    } catch { missed.add(n); }
    await sleep(100); // Scryfall asks for at most ~10 requests per second
  }
  if (changed) save(SCRY_KEY, scryCache);
  return changed;
}

// Replace informal commander names with the real card name and colours, once Scryfall has resolved them.
export function resolveGames(games) {
  return games.map(g => ({
    ...g,
    seats: g.seats.map(s => {
      if (!s.commander) return { ...s, colors: [] };
      const parts = splitCommander(s.commander);
      const infos = parts.map(cardInfo);
      return {
        ...s,
        commander: parts.map((p, i) => infos[i]?.name || titleCase(p)).join(' / '),
        colors: orderColors(infos.flatMap(i => i?.colors || [])),
      };
    }),
  }));
}

// Colours for a (resolved) commander name.
export function commanderColors(name, seatColors) {
  if (seatColors && seatColors.length) return seatColors;
  return orderColors(splitCommander(name).flatMap(n => cardInfo(n)?.colors || []));
}
