// Asse Raus – Spielregeln ohne Darstellung. Reine Funktionen auf einem Spielobjekt G.
// Wird vom Browser (asse-raus/index.html) und vom Online-Server
// (supabase/functions/asse-raus/core.js, gleiche Datei) benutzt. Beide Kopien gleich halten.
//
// Regeln:
// - 2 Rommé-Decks (2 × 52 Karten) plus Joker; ein Joker ersetzt jede Karte.
// - Jeder hat einen eigenen Stapel (Standard 11 Karten, nur die oberste ist offen), der leer werden muss.
// - In der Mitte werden Stapel von Ass bis König gebaut; mit dem König verschwindet der Stapel, der Platz wird frei.
// - 5 Handkarten: zu Beginn des eigenen Zuges und sobald man alle Handkarten in die Mitte gespielt hat, wird auf 5 aufgefüllt.
// - 4 eigene Ablagestapel; nur deren oberste Karte darf ausgespielt werden.
// - Ein Zug endet, sobald eine Handkarte auf einen eigenen Ablagestapel gelegt wird.
// - Gewonnen hat, wer keine Karten mehr im eigenen Stapel hat und seinen Zug ohne Handkarten beendet.

import { chooseMove } from './ai.js';

export const HAND = 5;
export const PILES = 4;
export const LEVELS = ['easy', 'normal', 'hard'];
export const SUITS = ['S', 'H', 'D', 'C'];
export const SLOT_CHOICES = [2, 3, 4, 5, 6, 8, 0]; // 0 = unbegrenzt
export const COMP_NAMES = ['Ass-Agathe', 'König Kurt', 'Joker-Jupp', 'Bube Bernd', 'Dame Dora', 'Stapel-Stefan', 'Robo Rommé'];
const DECK_SIZE = 104;

export const isJoker = c => !!c && c.r === 0;
export const top = a => (a && a.length ? a[a.length - 1] : null);

export function err(message, status = 400, code = '') {
  const e = new Error(message);
  e.status = status; e.code = code;
  return e;
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
export function newDeck(jokers) {
  const d = [];
  for (let k = 0; k < 2; k++) for (const s of SUITS) for (let r = 1; r <= 13; r++) d.push({ id: `${k}${s}${r}`, s, r });
  for (let j = 0; j < jokers; j++) d.push({ id: 'J' + j, s: 'J', r: 0 });
  return shuffle(d);
}

/* ---------- settings ---------- */
// so many cards per stack that at least a few remain in the draw pile
export const maxStock = n => Math.max(5, Math.min(30, Math.floor((DECK_SIZE - 4 - n * HAND) / n)));
export function cleanSettings(s, n) {
  s = s || {};
  const stock = Math.round(Number(s.stock));
  const jokers = Math.round(Number(s.jokers));
  return {
    stock: Number.isFinite(stock) ? Math.max(3, Math.min(maxStock(n), stock)) : Math.min(11, maxStock(n)),
    slots: SLOT_CHOICES.includes(Number(s.slots)) ? Number(s.slots) : 5,
    jokers: Number.isFinite(jokers) ? Math.max(0, Math.min(8, jokers)) : 6,
  };
}

/* ---------- setup ---------- */
export function setupGame(G) {
  const n = G.players.length;
  G.settings = cleanSettings(G.settings, n);
  G.deck = newDeck(G.settings.jokers);
  G.done = [];
  G.stocks = Array.from({ length: n }, () => []);
  for (let i = 0; i < G.settings.stock; i++) for (let p = 0; p < n; p++) G.stocks[p].push(G.deck.pop());
  G.hands = Array.from({ length: n }, () => []);
  G.discards = Array.from({ length: n }, () => Array.from({ length: PILES }, () => []));
  G.center = G.settings.slots ? Array.from({ length: G.settings.slots }, () => []) : [[]];
  G.handRev = Array(n).fill(0);
  G.tally = Array.from({ length: n }, (_, i) => (G.tally && G.tally[i]) || 0);
  G.game = (G.game || 0) + 1;
  G.starter = G.starter == null ? rand(n) : (G.starter + 1) % n;
  G.turn = G.starter;
  G.status = 'play';
  G.winners = null;
  G.log = [];
  G.moveNo = 0;
  G.passes = 0;
  G.lastAction = null;
  beginTurn(G);
  return G;
}

/* ---------- drawing ---------- */
function drawOne(G) {
  if (!G.deck.length && G.done.length) {
    // finished centre stacks are shuffled into a new draw pile
    G.deck = shuffle(G.done);
    G.done = [];
    addLog(G, { kind: 'reshuffle', n: G.deck.length });
  }
  return G.deck.pop() || null;
}
function refill(G, p) {
  const hand = G.hands[p];
  let n = 0;
  while (hand.length < HAND) { const c = drawOne(G); if (!c) break; hand.push(c); n++; }
  if (n) G.handRev[p]++;
  return n;
}

function addLog(G, e) {
  G.log.push({ ...e, no: G.moveNo });
  if (G.log.length > 80) G.log.splice(0, G.log.length - 80);
}

function beginTurn(G) {
  G.turnPlays = 0;
  const drew = refill(G, G.turn);
  G.drew = drew;
}

/* ---------- centre ---------- */
export const need = pile => pile.length + 1; // value the next card must have
export const fits = (card, pile) => isJoker(card) || card.r === need(pile);
// a pile's visible value (a joker counts as the card it replaces)
export const pileValue = pile => pile.length;

function tidyCenter(G) {
  if (G.settings.slots) return;
  // unlimited: drop empty stacks, keep exactly one free place at the end
  G.center = G.center.filter(p => p.length);
  G.center.push([]);
}

/* the card a source points at, without removing it */
export function sourceCard(G, p, src) {
  if (!src) return null;
  if (src.type === 'hand') return G.hands[p].find(c => c.id === src.id) || null;
  if (src.type === 'stock') return top(G.stocks[p]);
  if (src.type === 'discard') return top(G.discards[p][src.pile]);
  return null;
}
function takeSource(G, p, src) {
  if (src.type === 'hand') {
    const i = G.hands[p].findIndex(c => c.id === src.id);
    G.handRev[p]++;
    return G.hands[p].splice(i, 1)[0];
  }
  if (src.type === 'stock') return G.stocks[p].pop();
  return G.discards[p][src.pile].pop();
}

/* every move into the centre the player could make right now */
export function centerMoves(G, p) {
  const out = [];
  const srcs = [];
  if (G.stocks[p].length) srcs.push({ type: 'stock' });
  G.discards[p].forEach((d, k) => { if (d.length) srcs.push({ type: 'discard', pile: k }); });
  G.hands[p].forEach(c => srcs.push({ type: 'hand', id: c.id }));
  for (const src of srcs) {
    const card = sourceCard(G, p, src);
    G.center.forEach((pile, slot) => { if (fits(card, pile)) out.push({ src, dst: { type: 'center', slot } }); });
  }
  return out;
}

/* ---------- moves ---------- */
// mv = { src:{type:'hand',id}|{type:'stock'}|{type:'discard',pile}, dst:{type:'center',slot}|{type:'discard',pile} }
// or { end:true } when the hand is empty and nothing is left to draw
export function applyMove(G, p, mv) {
  if (G.status !== 'play') throw err('Gerade läuft keine Partie.', 409, 'noGame');
  if (p !== G.turn) throw err('Du bist nicht dran.', 409, 'notTurn');
  if (!mv || typeof mv !== 'object') throw err('Ungültiger Zug.', 400, 'badMove');

  if (mv.end) {
    if (G.hands[p].length) throw err('Lege zum Beenden eine Handkarte ab.', 409, 'mustDiscard');
    if (G.turnPlays === 0) G.passes++; else G.passes = 0;
    G.moveNo++;
    addLog(G, { kind: 'end', p });
    G.lastAction = { moveNo: G.moveNo, p, kind: 'end' };
    finishTurn(G, p);
    return G;
  }

  const src = mv.src || {}, dst = mv.dst || {};
  if (!['hand', 'stock', 'discard'].includes(src.type)) throw err('Ungültiger Zug.', 400, 'badMove');
  if (src.type === 'discard' && !(src.pile >= 0 && src.pile < PILES)) throw err('Ungültiger Zug.', 400, 'badMove');
  const card = sourceCard(G, p, src);
  if (!card) throw err('Diese Karte hast du nicht.', 409, 'noCard');

  if (dst.type === 'discard') {
    if (src.type !== 'hand') throw err('Ablegen geht nur mit Handkarten.', 409, 'discardHand');
    if (!(dst.pile >= 0 && dst.pile < PILES)) throw err('Ungültiger Zug.', 400, 'badMove');
    takeSource(G, p, src);
    G.discards[p][dst.pile].push(card);
    G.moveNo++;
    G.passes = 0;
    addLog(G, { kind: 'discard', p, card, pile: dst.pile });
    G.lastAction = { moveNo: G.moveNo, p, kind: 'discard', card, pile: dst.pile };
    finishTurn(G, p);
    return G;
  }

  if (dst.type !== 'center') throw err('Ungültiger Zug.', 400, 'badMove');
  const slot = Number(dst.slot), pile = G.center[slot];
  if (!pile) throw err('Diesen Platz gibt es nicht.', 400, 'noSlot');
  if (!fits(card, pile)) throw err('Diese Karte passt dort nicht.', 409, 'noFit');
  takeSource(G, p, src);
  pile.push(card);
  const value = pile.length;
  G.moveNo++;
  G.turnPlays++;
  G.passes = 0;
  addLog(G, { kind: 'center', p, card, from: src.type, slot, value });
  const la = { moveNo: G.moveNo, p, kind: 'center', card, from: src.type, pile: src.pile, slot, value, cleared: false, drew: 0 };
  if (value === 13) {
    G.done.push(...pile);
    G.center[slot] = [];
    la.cleared = true;
    addLog(G, { kind: 'clear', slot });
  }
  tidyCenter(G);
  if (src.type === 'hand' && !G.hands[p].length) {
    la.drew = refill(G, p);
    if (la.drew) addLog(G, { kind: 'refill', p, n: la.drew });
  }
  G.lastAction = la;
  return G;
}

function finishTurn(G, p) {
  const n = G.players.length;
  if (!G.stocks[p].length && !G.hands[p].length) {
    G.status = 'end';
    G.winners = [p];
    G.tally[p] = (G.tally[p] || 0) + 1;
    addLog(G, { kind: 'win', p });
    return;
  }
  if (G.passes >= n * 2) {
    // nobody can move any more: fewest cards left in the own stack wins
    const least = Math.min(...G.stocks.map(s => s.length));
    G.winners = G.stocks.map((s, i) => (s.length === least ? i : -1)).filter(i => i >= 0);
    G.winners.forEach(i => { G.tally[i] = (G.tally[i] || 0) + 1; });
    G.status = 'end';
    addLog(G, { kind: 'stuck' });
    return;
  }
  G.turn = (p + 1) % n;
  beginTurn(G);
}

/* ---------- computer ---------- */
export function aiMove(G) {
  const p = G.turn;
  return chooseMove(G, p, G.players[p].level || 'normal');
}
export function playAI(G) {
  const mv = aiMove(G);
  return applyMove(G, G.turn, mv);
}

/* ---------- what everybody may see ---------- */
export function publicState(G) {
  const out = {
    status: G.status, players: G.players, settings: G.settings, turn: G.turn ?? 0, moveNo: G.moveNo || 0,
    game: G.game || 0, tally: G.tally || [], winners: G.winners || null, log: G.log || [], lastAction: G.lastAction || null,
    turnPlays: G.turnPlays || 0, msg: G.msg || '',
  };
  if (G.status === 'lobby') return out;
  out.center = G.center;
  out.discards = G.discards;
  out.stockTops = G.stocks.map(top);
  out.stockCounts = G.stocks.map(s => s.length);
  out.handCounts = G.hands.map(h => h.length);
  out.handRev = G.handRev;
  out.deckCount = G.deck.length;
  out.doneCount = G.done.length;
  if (G.status === 'end') out.hands = G.hands; // reveal at the end
  return out;
}
