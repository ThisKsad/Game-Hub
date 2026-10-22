// Asse Raus – Computergegner. Wählt immer genau einen Schritt; nach jedem Schritt wird neu geplant,
// weil die nächste Karte des eigenen Stapels erst danach sichtbar wird.
// Sieht nur, was ein Mensch an diesem Platz auch sieht: eigene Hand, alle offenen Karten.
// Gleiche Datei in asse-raus/ und supabase/functions/asse-raus/ – beide Kopien gleich halten.
//
// Stufen:
//  easy   – spielt den eigenen Stapel, wenn es direkt geht, sonst eher zufällig
//  normal – sucht kurze Ketten zum eigenen Stapel, spielt Handkarten aus, um neue zu ziehen
//  hard   – längere Ketten; zu zweit hält er Karten zurück, statt dem Gegner die Mitte aufzubauen

const isJoker = c => !!c && c.r === 0;
const topOf = a => (a && a.length ? a[a.length - 1] : null);
const COST = { hand: 1, discard: 0.6, joker: 5 };
const NODE_LIMIT = 40000;

function view(G, p) {
  return {
    hand: G.hands[p],
    stockTop: topOf(G.stocks[p]),
    stockLeft: G.stocks[p].length,
    discards: G.discards[p],
    center: G.center.map(pile => pile.length),
    unlimited: !G.settings.slots,
    opps: G.players.map((_, i) => i).filter(i => i !== p).map(i => ({ seat: i, stockTop: topOf(G.stocks[i]), dist: (i - p + G.players.length) % G.players.length })),
  };
}

const fitsVal = (card, v) => isJoker(card) || card.r === v + 1;

/* distinct places a card may go (places of equal height are the same choice) */
function placesFor(card, center) {
  const seen = new Set(), out = [];
  center.forEach((v, i) => { if (fitsVal(card, v) && !seen.has(v)) { seen.add(v); out.push(i); } });
  return out;
}
function placeOn(center, slot, unlimited) {
  const c = center.slice();
  c[slot]++;
  if (c[slot] === 13) c[slot] = 0;
  if (unlimited && !c.includes(0)) c.push(0);
  return c;
}

/*
 * Depth-first search over plays into the centre, using hand cards and the tops of the own discard piles.
 * goal(state) says whether a state is finished; returns the cheapest list of moves or null.
 */
function search(V, goal, maxDepth, opts = {}) {
  let best = null, bestCost = Infinity, nodes = 0;
  const hand = V.hand;
  const walk = (center, used, taken, path, cost) => {
    if (++nodes > NODE_LIMIT || cost >= bestCost) return;
    const g = goal(center, used, taken, path);
    if (g) {
      const total = cost + (g.cost || 0);
      if (total < bestCost) { bestCost = total; best = g.final ? [...path, g.final] : path.slice(); }
      return;
    }
    if (path.length >= maxDepth) return;
    // discard tops (can be played one after another)
    for (let k = 0; k < V.discards.length; k++) {
      const pile = V.discards[k], idx = pile.length - 1 - taken[k];
      if (idx < 0) continue;
      const card = pile[idx];
      if (isJoker(card) && opts.noJoker) continue;
      for (const slot of placesFor(card, center)) {
        const t2 = taken.slice(); t2[k]++;
        path.push({ src: { type: 'discard', pile: k }, dst: { type: 'center', slot }, card });
        walk(placeOn(center, slot, V.unlimited), used, t2, path, cost + (isJoker(card) ? COST.joker : COST.discard));
        path.pop();
      }
    }
    // hand cards (each value only once per step)
    const tried = new Set();
    for (let i = 0; i < hand.length; i++) {
      if (used & (1 << i)) continue;
      const card = hand[i];
      if (tried.has(card.r)) continue;
      tried.add(card.r);
      if (isJoker(card) && opts.noJoker) continue;
      for (const slot of placesFor(card, center)) {
        path.push({ src: { type: 'hand', id: card.id }, dst: { type: 'center', slot }, card });
        walk(placeOn(center, slot, V.unlimited), used | (1 << i), taken, path, cost + (isJoker(card) ? COST.joker : COST.hand));
        path.pop();
      }
    }
  };
  walk(V.center, 0, V.discards.map(() => 0), [], 0);
  return best;
}

/* a chain of plays that ends with the top card of the own stack going into the centre */
function chainToStock(V, depth) {
  const st = V.stockTop;
  if (!st) return null;
  return search(V, center => {
    const places = placesFor(st, center);
    if (!places.length) return null;
    return { final: { src: { type: 'stock' }, dst: { type: 'center', slot: bestPlaceForStock(st, center, V) } } };
  }, depth);
}
function bestPlaceForStock(card, center, V) {
  const places = placesFor(card, center);
  if (!isJoker(card) || places.length === 1) return places[0];
  // a joker from the stack: put it where it unlocks the most of our own cards
  let best = places[0], bestScore = -Infinity;
  for (const slot of places) {
    const nextV = center[slot] + 1 === 13 ? 0 : center[slot] + 1;
    let score = 0;
    V.hand.forEach(c => { if (!isJoker(c) && c.r === nextV + 1) score += 2; });
    V.discards.forEach(d => { const c = topOf(d); if (c && !isJoker(c) && c.r === nextV + 1) score += 3; });
    score += center[slot] / 20; // slightly prefer finishing high stacks
    if (score > bestScore) { bestScore = score; best = slot; }
  }
  return best;
}

/* play every hand card into the centre (then 5 new cards are drawn) */
function chainEmptyHand(V, depth) {
  const full = (1 << V.hand.length) - 1;
  if (!V.hand.length || V.hand.some(isJoker)) return null;
  return search(V, (center, used) => (used === full ? {} : null), depth);
}

/* would this centre height hand an opponent a play from their stack? */
function helpsOpponent(V, value) {
  const nextNeed = value === 13 ? 1 : value + 1;
  return V.opps.some(o => {
    if (o.dist !== 1) return false; // only the next player gets to use it right away
    const c = o.stockTop;
    return c && !isJoker(c) && c.r === nextNeed;
  });
}

/* ---------- discarding ---------- */
function discardScore(card, pileTop, V, emptyPiles) {
  if (isJoker(card)) return -100;
  let s;
  if (!pileTop) {
    s = 3 + (card.r >= 11 ? 4 : card.r >= 8 ? 1 : 0);
    if (emptyPiles === 1 && card.r < 11) s -= 2;
  } else if (isJoker(pileTop)) {
    s = 1;
  } else {
    const d = pileTop.r - card.r;
    if (d === 1) s = 10;
    else if (d === 0) s = 8;
    else if (d > 1) s = 6 - d * 0.4;
    else s = -3 + d;
  }
  // cards far from fitting anywhere are best to put away
  const dist = Math.min(...V.center.map(v => (card.r - v - 1 + 13) % 13));
  s += dist * 0.25;
  // keep the card the own stack waits for in hand? no – stack cards are played from the stack; but a card that
  // continues right after the stack top is worth keeping
  if (V.stockTop && !isJoker(V.stockTop) && card.r === V.stockTop.r + 1) s -= 2;
  return s;
}
function chooseDiscard(V, level) {
  const empty = V.discards.filter(d => !d.length).length;
  let best = null, bestScore = -Infinity;
  V.hand.forEach(card => {
    V.discards.forEach((pile, k) => {
      let s = discardScore(card, topOf(pile), V, empty);
      if (level === 'easy') s = Math.random() * 10 + (isJoker(card) ? -50 : 0);
      if (s > bestScore) { bestScore = s; best = { src: { type: 'hand', id: card.id }, dst: { type: 'discard', pile: k } }; }
    });
  });
  return best;
}

/* ---------- main ---------- */
export function chooseMove(G, p, level = 'normal') {
  const V = view(G, p);
  if (!V.hand.length) {
    // nothing left to draw: play what is possible, then end the turn
    const st = V.stockTop;
    if (st) { const pl = placesFor(st, V.center); if (pl.length) return { src: { type: 'stock' }, dst: { type: 'center', slot: bestPlaceForStock(st, V.center, V) } }; }
    for (let k = 0; k < V.discards.length; k++) {
      const c = topOf(V.discards[k]);
      if (c) { const pl = placesFor(c, V.center); if (pl.length) return { src: { type: 'discard', pile: k }, dst: { type: 'center', slot: pl[0] } }; }
    }
    return { end: true };
  }

  // the own stack is empty: get down to one hand card and put it away to win
  if (!V.stockLeft) {
    if (V.hand.length === 1) return { src: { type: 'hand', id: V.hand[0].id }, dst: { type: 'discard', pile: bestPileFor(V.hand[0], V) } };
    const plays = [];
    V.hand.forEach(c => placesFor(c, V.center).forEach(slot => plays.push({ src: { type: 'hand', id: c.id }, dst: { type: 'center', slot }, c })));
    if (plays.length) {
      plays.sort((a, b) => (isJoker(a.c) ? 1 : 0) - (isJoker(b.c) ? 1 : 0));
      const m = plays[0]; return { src: m.src, dst: m.dst };
    }
    // a discard top may open the way for hand cards
    if (level !== 'easy') {
      const chain = search(V, (center, used) => {
        const n = V.hand.length - popcount(used);
        return n === 1 ? {} : null;
      }, 8);
      if (chain && chain.length) return strip(chain[0]);
    }
    return chooseDiscard(V, level);
  }

  const st = V.stockTop;
  // 1) the stack card fits right away
  const direct = placesFor(st, V.center);
  if (direct.length) return { src: { type: 'stock' }, dst: { type: 'center', slot: bestPlaceForStock(st, V.center, V) } };

  if (level === 'easy') {
    if (Math.random() < 0.5) {
      const moves = [];
      V.hand.forEach(c => { if (!isJoker(c)) placesFor(c, V.center).forEach(slot => moves.push({ src: { type: 'hand', id: c.id }, dst: { type: 'center', slot } })); });
      V.discards.forEach((d, k) => { const c = topOf(d); if (c && !isJoker(c)) placesFor(c, V.center).forEach(slot => moves.push({ src: { type: 'discard', pile: k }, dst: { type: 'center', slot } })); });
      if (moves.length) return moves[Math.floor(Math.random() * moves.length)];
    }
    return chooseDiscard(V, level);
  }

  // 2) a chain that ends on the stack card
  const chain = chainToStock(V, level === 'hard' ? 9 : 5);
  if (chain && chain.length) return strip(chain[0]);

  // 3) play out the whole hand to draw five fresh cards
  const empty = chainEmptyHand(V, level === 'hard' ? 9 : 6);
  if (empty && empty.length) return strip(empty[0]);

  // 4) single plays that free a discard pile or make room in the hand (jokers stay in hand).
  //    Hard in a duel keeps these cards back – in tests that wins clearly more often, because every card
  //    in the centre also brings the opponent closer to their stack. With 3–4 players holding back does not pay.
  if (level === 'hard' && V.opps.length === 1) return chooseDiscard(V, level);
  const safe = [];
  V.discards.forEach((d, k) => {
    const c = topOf(d);
    if (!c || isJoker(c)) return;
    placesFor(c, V.center).forEach(slot => safe.push({ m: { src: { type: 'discard', pile: k }, dst: { type: 'center', slot } }, v: V.center[slot] + 1, w: 2 }));
  });
  V.hand.forEach(c => {
    if (isJoker(c)) return;
    placesFor(c, V.center).forEach(slot => safe.push({ m: { src: { type: 'hand', id: c.id }, dst: { type: 'center', slot } }, v: V.center[slot] + 1, w: 1 }));
  });
  const ok = safe.filter(s => !helpsOpponent(V, s.v));
  if (ok.length) { ok.sort((a, b) => b.w - a.w); return ok[0].m; }

  // 5) end the turn
  return chooseDiscard(V, level);
}

function bestPileFor(card, V) {
  const empty = V.discards.filter(d => !d.length).length;
  let best = 0, bs = -Infinity;
  V.discards.forEach((d, k) => { const s = discardScore(card, topOf(d), V, empty); if (s > bs) { bs = s; best = k; } });
  return best;
}
function popcount(x) { let n = 0; while (x) { n += x & 1; x >>= 1; } return n; }
const strip = m => ({ src: m.src, dst: m.dst });
