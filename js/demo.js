// Invented sample data (open the site with ?demo) so the layout can be checked without the sheet.
const POD = [
  { name: 'Marieke', skill: 0.30, decks: [['Atraxa, Praetors’ Voice', 'WUBG', 'Counters · midrange', 3], ['Lathril, Blade of the Elves', 'BG', 'Elves · tokens', 1], ['Muldrotha, the Gravetide', 'UBG', 'Value · recursion', 1]] },
  { name: 'Joost', skill: 0.27, decks: [['Kinnan, Bonder Prodigy', 'UG', 'Ramp · combo', 3], ['Yuriko, the Tiger’s Shadow', 'UB', 'Ninjas · tempo', 2]] },
  { name: 'Sander', skill: 0.24, decks: [['Prosper, Tome-Bound', 'BR', 'Treasure · exile value', 2], ['Krenko, Mob Boss', 'R', 'Goblins · aggro', 1]] },
  { name: 'Bram', skill: 0.20, decks: [['Edgar Markov', 'WBR', 'Vampires · aggro', 2], ['Kaalia of the Vast', 'WBR', 'Reanimator · big stuff', 1]] },
  { name: 'Iris', skill: 0.18, decks: [['Yuriko, the Tiger’s Shadow', 'UB', 'Ninjas · tempo', 3], ['Lathril, Blade of the Elves', 'BG', 'Elves · tokens', 2]] },
];

function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }

export function demoGames() {
  const r = rng(7); const games = [];
  const start = new Date(Date.UTC(2026, 0, 8));
  for (let week = 0; week < 37; week++) {
    const d = new Date(start.getTime() + week * 7 * 864e5);
    const date = d.toISOString().slice(0, 10);
    const perNight = r() < 0.3 ? 2 : 1;
    for (let k = 0; k < perNight; k++) {
      const table = POD.filter(() => r() < 0.85);
      if (table.length < 3) continue;
      const seats = table.map(p => {
        const pool = p.decks.flatMap(d => Array(d[3]).fill(d));
        const [commander, colors, archetype] = pool[Math.floor(r() * pool.length)];
        return { player: p.name, commander, colors: colors.split(''), archetype, win: false, w: p.skill + r() * 0.5 };
      });
      seats.reduce((a, b) => (b.w > a.w ? b : a)).win = true;
      seats.forEach(s => delete s.w);
      games.push({ id: date + '#' + k, date, seats });
    }
  }
  return games;
}
