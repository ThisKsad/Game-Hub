// Scopa rules shared by the online server. Pure functions on a game object G.
// Mirrors the rules of the local game in scopa/index.html.

export const SUITS = ['D', 'C', 'S', 'B'];
const SUIT_NAME = { D: 'Denari', C: 'Coppe', S: 'Spade', B: 'Bastoni' };
const RANK_NAME = { 1: 'Asso', 8: 'Fante', 9: 'Cavallo', 10: 'Re' };
const PV = { 7: 21, 6: 18, 1: 16, 5: 15, 4: 14, 3: 13, 2: 12, 8: 10, 9: 10, 10: 10 };
export const COMP_NAMES = ['Don Denari', 'Settebello-Sepp', 'Primiera-Paolo', 'Scopatron 3000', 'Nonna Bytes', 'Robo Ravioli', 'Cavallo Calcolo'];
export const MODES = {
  house: { name: 'Hausregeln', classic: false, ace: 'eleven', teams: false, free: true },
  classic: { name: 'Klassisch', classic: true, ace: 'one', teams: true, free: false },
  asso: { name: 'Asso piglia tutto', classic: true, ace: 'all', teams: true, free: false },
  custom: { name: 'Eigene Regeln' },
};
export const nm = c => `${RANK_NAME[c.v] || c.v} di ${SUIT_NAME[c.s]}`;

export function rulesOf(s) {
  const m = MODES[s.mode];
  const c = s.custom || {};
  if (s.mode === 'custom' || !m) {
    return { classic: !!c.classic, ace: ['one', 'eleven', 'all'].includes(c.ace) ? c.ace : 'one', teams: c.teams !== false, free: !!c.free };
  }
  return { classic: m.classic, ace: m.ace, teams: m.teams, free: m.free };
}

export function rand(n) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}
export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function newDeck() {
  const d = [];
  for (const s of SUITS) for (let v = 1; v <= 10; v++) d.push({ s, v, id: s + v });
  return shuffle(d);
}

/* ---------- capturing ---------- */
const takesAll = (G, card) => card.v === 1 && G.settings.ace === 'all';
const goalOf = (G, card) => (card.v === 1 && G.settings.ace === 'eleven' ? 11 : card.v);
function combos(goal, table) {
  const res = [], n = table.length;
  for (let m = 1; m < (1 << n); m++) {
    if ((m & (m - 1)) === 0) continue;
    let sum = 0; const set = [];
    for (let i = 0; i < n; i++) if (m & (1 << i)) { sum += table[i].v; set.push(table[i]); if (sum > goal) break; }
    if (sum === goal && set.length > 1) res.push(set);
  }
  return res;
}
export function options(G, card, table = G.table) {
  if (takesAll(G, card)) return table.length ? [[...table]] : [];
  const same = table.filter(t => t.v === card.v).map(t => [t]);
  if (same.length && !G.settings.free) return same;
  return [...same, ...combos(goalOf(G, card), table)];
}

/* ---------- game flow ---------- */
const N = G => G.players.length;
const handTotal = G => G.hands.reduce((s, h) => s + h.length, 0);

export function setupGame(G) {
  const n = N(G), R = rulesOf(G.settings);
  G.settings = { ...G.settings, ...R };
  G.teams = n === 4 && !!R.teams;
  G.sides = G.teams ? 2 : n;
  G.players.forEach((p, i) => { p.side = G.teams ? i % 2 : i; });
  G.scores = Array(G.sides).fill(0);
  G.dealer = rand(n);
  G.round = 0;
  startRound(G);
}
export function startRound(G) {
  const n = N(G);
  G.round++; G.dealer = (G.dealer + 1) % n;
  G.deck = newDeck();
  G.hands = Array.from({ length: n }, () => []);
  G.piles = Array.from({ length: G.sides }, () => []);
  G.scope = Array(G.sides).fill(0);
  G.table = G.deck.splice(0, 4);
  G.lastSide = null; G.summary = null; G.lastAction = null;
  G.log = []; G.lastMove = Array(n).fill(-1);
  deal(G);
  G.turn = (G.dealer + 1) % n;
  G.status = 'play';
  G.msg = `Runde ${G.round}: ${G.players[G.turn].name} beginnt.`;
}
function deal(G) {
  const n = N(G);
  for (let i = 0; i < 3; i++) for (let k = 0; k < n; k++) G.hands[(G.dealer + 1 + k) % n].push(G.deck.pop());
}

/* validates and applies a move; throws a user-facing error when it is not allowed */
export function playMove(G, p, cardId, takeIds) {
  if (G.status !== 'play') throw err('Gerade läuft keine Runde.', 400, 'noRound');
  if (G.turn !== p) throw err('Du bist nicht dran.', 400, 'notTurn');
  const card = G.hands[p].find(c => c.id === cardId);
  if (!card) throw err('Diese Karte hast du nicht auf der Hand.', 400, 'noCard');
  const opts = options(G, card);
  let opt = null;
  if (takeIds && takeIds.length) {
    const want = [...takeIds].sort().join(',');
    opt = opts.find(o => o.map(c => c.id).sort().join(',') === want);
    if (!opt) throw err('Diese Karten darfst du mit dieser Karte nicht nehmen.', 400, 'badTake');
  } else if (opts.length) {
    throw err('Mit dieser Karte musst du etwas vom Tisch nehmen.', 400, 'mustTake');
  }
  applyMove(G, p, card, opt);
}

function applyMove(G, p, card, opt) {
  const side = G.players[p].side, who = G.players[p].name;
  G.hands[p] = G.hands[p].filter(c => c.id !== card.id);
  const lastPlay = G.deck.length === 0 && handTotal(G) === 0;
  let scopa = false, text, kind = 'place';
  if (opt) {
    const set = new Set(opt.map(c => c.id));
    G.table = G.table.filter(c => !set.has(c.id));
    G.piles[side].push(card, ...opt);
    G.lastSide = side;
    const all = takesAll(G, card);
    kind = all ? 'all' : 'take';
    if (G.table.length === 0 && !lastPlay && !all) { G.scope[side]++; scopa = true; }
    text = all
      ? `${who} spielt ${nm(card)} und nimmt den ganzen Tisch (${opt.length} Karten). Asso piglia tutto!`
      : `${who} spielt ${nm(card)} und nimmt ${opt.map(nm).join(' + ')}.`;
    if (scopa) text += ' Scopa!';
  } else {
    G.table.push(card);
    text = `${who} legt ${nm(card)} auf den Tisch.`;
  }
  // structured entry: every device writes it out in its own language
  G.log.push({ p, kind, card, taken: opt || [], scopa, text });
  if (G.log.length > 60) G.log = G.log.slice(-60);
  G.lastMove[p] = G.log.length - 1;
  G.moveNo = (G.moveNo || 0) + 1;
  G.lastAction = { seat: p, card, taken: opt || [], scopa, moveNo: G.moveNo };
  G.msg = text;
  G.turn = (p + 1) % N(G);
  if (handTotal(G) === 0) {
    if (G.deck.length) deal(G);
    else endRound(G);
  }
}

/* ---------- scoring ---------- */
const cnt = (p, v) => p.filter(c => c.v === v).length;
function primSum(p) {
  let sum = 0;
  for (const s of SUITS) { const cs = p.filter(c => c.s === s); if (!cs.length) return null; sum += Math.max(...cs.map(c => PV[c.v])); }
  return sum;
}
function uniqueMax(vals) {
  let best = null, idx = null, tie = false;
  vals.forEach((v, i) => { if (v === null) return; if (best === null || v > best) { best = v; idx = i; tie = false; } else if (v === best) tie = true; });
  return tie ? null : idx;
}
function bestVec(vecs) {
  const cmp = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
  let w = 0, tie = false;
  for (let i = 1; i < vecs.length; i++) { const c = cmp(vecs[i], vecs[w]); if (c > 0) { w = i; tie = false; } else if (c === 0) tie = true; }
  return tie ? null : w;
}
function scoreRound(G) {
  const P = G.piles, rows = [];
  const n = P.map(p => p.length);
  rows.push({ key: 'cards', label: 'Karten', vals: n, w: uniqueMax(n) });
  const d = P.map(p => p.filter(c => c.s === 'D').length);
  rows.push({ key: 'denari', label: 'Denari', vals: d, w: uniqueMax(d) });
  const sb = P.findIndex(p => p.some(c => c.s === 'D' && c.v === 7));
  rows.push({ key: 'settebello', label: 'Settebello', vals: P.map((_, i) => (i === sb ? '✓' : '–')), w: sb < 0 ? null : sb });
  if (G.settings.classic) {
    const x = P.map(primSum);
    rows.push({ key: 'primiera', label: 'Primiera', vals: x, w: uniqueMax(x) });
  } else {
    const vecs = P.map(p => [7, 6, 1, 5, 4, 3, 2].map(v => cnt(p, v)));
    rows.push({ key: 'primiera', label: 'Primiera', vals: P.map(p => `${cnt(p, 7)}× 7 · ${cnt(p, 6)}× 6`), w: bestVec(vecs) });
  }
  rows.forEach(r => { r.pts = P.map((_, i) => (r.w === i ? 1 : 0)); });
  rows.push({ key: 'scope', label: 'Scope', vals: [...G.scope], pts: [...G.scope] });
  return rows;
}
function endRound(G) {
  const rest = G.table.length, restTo = G.lastSide;
  if (rest && restTo !== null) G.piles[restTo].push(...G.table);
  G.table = [];
  const rows = scoreRound(G), gained = Array(G.sides).fill(0);
  rows.forEach(r => r.pts.forEach((v, i) => { gained[i] += v; }));
  gained.forEach((g, i) => { G.scores[i] += g; });
  const t = G.settings.target, reached = G.scores.some(x => x >= t), w = uniqueMax(G.scores);
  const over = reached && w !== null;
  G.summary = { rows, rest, restTo, gained, winner: over ? w : null };
  G.status = over ? 'gameEnd' : 'roundEnd';
  G.msg = 'Runde vorbei.';
}

/* ---------- computer ---------- */
function worth(c) { let w = 1; if (c.s === 'D') w += 2; if (c.v === 7) w += 3; else if (c.v === 6) w += 1.5; else if (c.v === 1) w += 1; if (c.s === 'D' && c.v === 7) w += 10; return w; }
function risk(t) { if (!t.length) return 0; const sum = t.reduce((s, c) => s + c.v, 0); return sum <= 10 ? 7 : 0; }
export function aiMove(G, p) {
  const lastPlay = G.deck.length === 0 && handTotal(G) === 1;
  let best = null;
  const consider = (card, opt, sc) => { if (!best || sc > best.sc) best = { card, opt, sc }; };
  for (const c of G.hands[p]) {
    const opts = options(G, c);
    if (!opts.length) { consider(c, null, -worth(c) * 1.3 - risk([...G.table, c]) + Math.random() * 0.6); continue; }
    for (const o of opts) {
      const ids = new Set(o.map(x => x.id)), rest = G.table.filter(x => !ids.has(x.id));
      let sc = worth(c) + o.reduce((s, x) => s + worth(x), 0);
      if (!rest.length && !lastPlay && !takesAll(G, c)) sc += 14;
      sc -= risk(rest); sc += Math.random() * 0.6;
      consider(c, o, sc);
    }
  }
  return best;
}
export function playAI(G) {
  if (G.status !== 'play') throw err('Gerade läuft keine Runde.', 400, 'noRound');
  const p = G.turn;
  if (!G.players[p].ai) throw err('Ein Mensch ist dran.', 400, 'notTurn');
  const m = aiMove(G, p);
  applyMove(G, p, m.card, m.opt);
}

/* ---------- public view (no hidden cards) ---------- */
export function publicState(G) {
  return {
    status: G.status, n: N(G), players: G.players, teams: !!G.teams, sides: G.sides || N(G), settings: G.settings,
    scores: G.scores || [], round: G.round || 0, dealer: G.dealer ?? 0, turn: G.turn ?? 0,
    table: G.table || [], deckCount: (G.deck || []).length,
    handCounts: (G.hands || []).map(h => h.length), pileCounts: (G.piles || []).map(p => p.length),
    scope: G.scope || [], log: G.log || [], lastMove: G.lastMove || [], summary: G.summary || null,
    lastAction: G.lastAction || null, moveNo: G.moveNo || 0, msg: G.msg || '',
  };
}

export function err(message, status = 400, code = '') { const e = new Error(message); e.status = status; e.code = code; return e; }
