// Fetch the pod spreadsheet (Google Form responses), parse it into games, and resolve commanders via Scryfall.
import { CONFIG } from './config.js';

const CACHE_KEY = 'podstats:games:v3';
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
  starter: ['begon', 'begint', 'startte', 'start', 'eerst', 'first'],
  photo: ['foto', 'afbeelding', 'image', 'photo', 'plaatje', 'upload'],
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
const MONTHS = { jan: 1, feb: 2, mrt: 3, mar: 3, maa: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dec: 12 };
const iso = (y, mo, d) => `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Also accepts "10 Sep" / "16 september 2026". Without a year: the latest such date that isn't in the future.
function parseDate(v, order) {
  const s = String(v || '').trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return iso(m[1], m[2], m[3]);
  if ((m = s.match(SLASH))) {
    let y = +m[3]; if (y < 100) y += 2000;
    return order === 'dmy' ? iso(y, m[2], m[1]) : iso(y, m[1], m[2]);
  }
  if ((m = s.match(/^(\d{1,2})\s+([a-z]{3})[a-z]*\.?(?:\s+(\d{4}))?/i))) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (!mo) return null;
    if (m[3]) return iso(m[3], mo, m[1]);
    const now = new Date(), y = now.getFullYear();
    const guess = iso(y, mo, m[1]);
    return guess <= iso(y, now.getMonth() + 1, now.getDate()) ? guess : iso(y - 1, mo, m[1]);
  }
  return null;
}

// "—", "-", "geen" and the like mean "nothing filled in".
const blank = v => !String(v || '').replace(/^\s*(?:[-–—.]+|n\/?a|geen|none)\s*$/i, '').trim();

// A form upload or pasted link -> { src, href }. Drive files must be shared "anyone with the link".
function parsePhoto(v) {
  const url = (String(v || '').match(/https?:\/\/[^\s,]+/) || [])[0];
  if (!url) return null;
  const id = (url.match(/[?&]id=([\w-]{10,})/) || url.match(/\/d\/([\w-]{10,})/) || [])[1];
  if (/drive\.google\.com|docs\.google\.com/.test(url) && id) {
    return { src: `https://drive.google.com/thumbnail?id=${id}&sz=w1600`, href: `https://drive.google.com/file/d/${id}/view` };
  }
  return { src: url, href: url };
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
// Only fix all-lowercase input ("aragorn hero"); names typed with care ("Ureni of the Unwritten") stay as they are.
const titleCase = s => s === s.toLowerCase() ? s.replace(/(^|[\s(/-])(\p{L})/gu, (m, a, c) => a + c.toUpperCase()) : s;
const displayName = raw => {
  const n = String(raw || '').trim().replace(/\s+/g, ' ');
  return CONFIG.nameMap[n] || CONFIG.nameMap[n.toLowerCase()] || titleCase(n);
};

// "Sem - aragorn hero, Toon - Imodane, Patrick Yshtola" -> [{player, commander}]
const SEP = /^(.+?)\s+[-–—:]\s*(.+)$|^(.+?)\s*[-–—:]\s+(.+)$/;
const splitEntry = e => { const m = e.match(SEP); return m ? [m[1] || m[3], m[2] || m[4]] : null; };

// "Mauro (Satoru Umezawa)" is a complete entry on its own.
const PAREN = /^(.+?)\s*\((.+)\)\s*$/;
const parenEntry = e => { const m = e.match(PAREN); return m ? [m[1], m[2]] : null; };

// Split on commas, semicolons and newlines, but never inside parentheses.
function fragments(text) {
  const out = []; let cur = '', depth = 0;
  for (const c of String(text || '')) {
    if (c === '(') depth++;
    if (c === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && /[,;\n]/.test(c)) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out.map(s => s.trim()).filter(Boolean);
}

function parsePlayed(text, known) {
  // Card names contain commas too ("Astarion, the Decadent"), so a comma only starts a new
  // entry when the next fragment has its own "Name - " / "Name (…)" or starts with a known player's name.
  const entries = [];
  for (const frag of fragments(text)) {
    const prevClosed = entries.length && parenEntry(entries[entries.length - 1]);
    const startsNew = prevClosed || parenEntry(frag) || splitEntry(frag) || known.has(norm(frag.split(/\s+/)[0]));
    if (!startsNew && entries.length) entries[entries.length - 1] += ', ' + frag;
    else entries.push(frag);
  }
  return entries.map(entry => {
    const m = parenEntry(entry) || splitEntry(entry) || (entry.match(/^(\S+)\s+(.+)$/) || []).slice(1);
    return m.length ? { player: displayName(m[0]), commander: m[1].trim() } : { player: displayName(entry), commander: null };
  });
}

// Player names seen anywhere: before a " - " or "(", or in the winner column.
function knownPlayers(played, winners) {
  const known = new Set(winners.map(norm).filter(Boolean));
  for (const text of played) for (const frag of fragments(text)) {
    const m = parenEntry(frag) || splitEntry(frag);
    if (m) known.add(norm(m[0]));
  }
  return known;
}

// Loose name match against a seat: "Sem", "sem", "Sem M." all hit "Sem".
const sameName = (a, b) => { a = norm(a); b = norm(b); return !!a && !!b && (a === b || a.startsWith(b) || b.startsWith(a)); };

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
  const known = knownPlayers(body.map(r => get(r, 'played')), body.map(r => get(r, 'winner')));

  const games = [];
  body.forEach((r, i) => {
    const date = parseDate(get(r, 'date'), order) || parseDate(get(r, 'timestamp'), order);
    if (!date) return;
    const winner = get(r, 'winner'), starter = get(r, 'starter');
    const seats = parsePlayed(get(r, 'played'), known).map(s => ({ ...s, win: sameName(s.player, winner), starter: sameName(s.player, starter) }));
    // Only one winner and one starter per game, even if a loose name match hit twice.
    for (const k of ['win', 'starter']) { let seen = false; seats.forEach(s => { if (s[k] && seen) s[k] = false; if (s[k]) seen = true; }); }
    if (seats.length < 2) return;
    const stamp = parseDate(get(r, 'timestamp'), order);
    games.push({
      id: 'r' + (i + 2),
      date,
      // Rows without a timestamp keep their sheet order within a day.
      sort: date + ' ' + (stamp || '') + ' ' + timeOf(get(r, 'timestamp')) + ' ' + String(i).padStart(5, '0'),
      seats,
      card: blank(get(r, 'card')) ? null : get(r, 'card'),
      minutes: parseDuration(get(r, 'duration')),
      photo: parsePhoto(get(r, 'photo')),
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
    image: face.image_uris?.normal || null,
    artist: face.artist || card.artist || '',
    uri: card.scryfall_uri || '',
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
// null only means "no such card". Rate limits (429) and server hiccups are retried with a growing delay.
async function scry(path) {
  for (let attempt = 0; attempt < 5; attempt++) {
    // A 429 reply carries no CORS header, so the browser reports it as a network error: retry that too.
    const res = await fetch('https://api.scryfall.com' + path, { headers: { Accept: 'application/json' } }).catch(() => null);
    if (res?.ok) return res.json();
    if (res && (res.status === 404 || res.status === 400)) return null;
    await sleep(1000 * 2 ** attempt);
  }
  throw new Error('Scryfall onbereikbaar');
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
  // A cached guess that disagrees with a pin in commanderMap is looked up again.
  const stale = n => { const pin = CONFIG.commanderMap[n]; return pin && scryCache[n] && norm(scryCache[n].name) !== norm(pin); };
  const wanted = [...new Set(rawNames.flatMap(splitCommander).map(norm))].filter(n => (!(n in scryCache) || stale(n)) && !missed.has(n));
  let changed = false;
  for (const n of wanted) {
    try {
      const info = await lookup(n);
      if (info) { scryCache[n] = info; scryCache[norm(info.name)] = info; changed = true; } else missed.add(n);
    } catch { /* offline or still rate-limited: try again on the next visit */ }
    await sleep(100); // Scryfall asks for at most ~10 requests per second
  }
  if (changed) save(SCRY_KEY, scryCache);
  return changed;
}

// Card of the Match: any card, not just commanders. Looked up once and cached, so the page
// can load the picture from Scryfall's image CDN instead of hitting the rate-limited API per view.
const cardKey = name => 'card:' + norm(name);
export function matchCard(name) { return name ? scryCache[cardKey(name)] || null : null; }

export async function enrichCards(names) {
  const wanted = [...new Set(names.filter(Boolean))].filter(n => !(cardKey(n) in scryCache) && !missed.has(cardKey(n)));
  let changed = false;
  for (const n of wanted) {
    try {
      const card = await scry('/cards/named?fuzzy=' + encodeURIComponent(n));
      // Stored under both the typed and the real name, since games show the real name once resolved.
      if (card) { const info = toInfo(card); scryCache[cardKey(n)] = scryCache[cardKey(info.name)] = info; changed = true; } else missed.add(cardKey(n));
    } catch { /* try again on the next visit */ }
    await sleep(150);
  }
  if (changed) save(SCRY_KEY, scryCache);
  return changed;
}

// Replace informal commander names with the real card name and colours, once Scryfall has resolved them.
export function resolveGames(games) {
  return games.map(g => ({
    ...g,
    card: g.card ? matchCard(g.card)?.name || g.card : null,
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
