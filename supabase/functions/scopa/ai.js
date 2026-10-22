// Computer opponents for Scopa in four levels: easy, normal, hard, extreme.
// Used by the online server and, as a copy between the AI markers, by scopa/index.html.
// G: { players:[{side}], hands:[[card]], table:[card], deck:[card], piles:[[card]] per side, settings, lastSide }
// optionsFn(card, table) returns the legal captures for that card under the current rules.
export function chooseMove(G, p, level, optionsFn, rnd) {
  rnd = rnd || Math.random;
  const R = G.settings || {};
  const hand = G.hands[p], table = G.table, n = G.players.length;
  const mySide = G.players[p].side;
  const handTotal = G.hands.reduce((s, h) => s + h.length, 0);
  const deckLeft = G.deck.length;
  const lastPlay = deckLeft === 0 && handTotal === 1;
  const takesAll = c => c.v === 1 && R.ace === 'all';
  const sum = cs => cs.reduce((s, c) => s + c.v, 0);

  const moves = [];
  for (const c of hand) {
    const opts = optionsFn(c, table);
    if (opts.length) opts.forEach(o => moves.push({ card: c, opt: o }));
    else moves.push({ card: c, opt: null });
  }
  if (moves.length === 1) return moves[0];

  // easy: takes something whenever it can, otherwise anything; no preferences at all
  if (level === 'easy') {
    const caps = moves.filter(m => m.opt);
    const pool = caps.length ? caps : moves;
    return pool[Math.floor(rnd() * pool.length)];
  }

  const hard = level === 'hard', extreme = level === 'extreme';
  const piles = G.piles || [];
  const inPiles = f => piles.reduce((s, pl) => s + pl.filter(f).length, 0);
  // is a majority still open? (mine can still win or lose it)
  const contested = (f, total) => {
    const vals = piles.map(pl => pl.filter(f).length);
    const rem = total - vals.reduce((a, b) => a + b, 0);
    const mine = vals[mySide] || 0;
    const other = Math.max(0, ...vals.filter((_, i) => i !== mySide));
    return !(mine > other + rem || mine + rem < other);
  };
  const is7 = c => c.v === 7, isD = c => c.s === 'D', is6 = c => c.v === 6;
  // hard remembers sevens, the Settebello and Denari; extreme remembers everything
  const denariLive = (hard || extreme) ? contested(isD, 10) : true;
  const sevensLive = (hard || extreme) ? contested(is7, 4) : true;
  const sixesLive = extreme ? contested(is6, 4) : true;
  const cardsLive = extreme ? contested(() => true, 40) : true;
  const worth = c => {
    let w = cardsLive ? 1 : 0.3;
    if (c.s === 'D') w += denariLive ? 2 : 0.2;
    if (c.v === 7) w += sevensLive ? 3 : 0.5;
    else if (c.v === 6) w += sixesLive ? 1.5 : 0.3;
    else if (c.v === 1) w += 1;
    if (c.s === 'D' && c.v === 7) w += 10;
    return w;
  };
  const worthAll = cs => cs.reduce((s, c) => s + worth(c), 0);

  // cards I don't know the place of: extreme remembers every captured card,
  // hard only the sevens and Denari it saw being captured (plus what's on the table and in its hand)
  const remembered = extreme ? piles.flat() : hard ? piles.flat().filter(c => is7(c) || isD(c)) : [];
  const seen = new Set([...remembered, ...table, ...hand].map(c => c.id));
  const unseen = [];
  for (const s of ['D', 'C', 'S', 'B']) for (let v = 1; v <= 10; v++) if (!seen.has(s + v)) unseen.push({ s, v, id: s + v });

  // extreme, two players, last deal: the opponent's cards are exactly the unseen ones, so it plays the ending out
  if (extreme && n === 2 && deckLeft === 0) {
    const opHand = unseen;
    if (opHand.length === G.hands[1 - p].length) {
      const lastWho = G.lastSide === null || G.lastSide === undefined ? null : (G.lastSide === mySide ? 'me' : 'op');
      const solve = (myH, opH, tbl, meTurn, last) => {
        if (!myH.length && !opH.length) { const r = worthAll(tbl); return last === 'me' ? r : last === 'op' ? -r : 0; }
        const H = meTurn ? myH : opH;
        let best = meTurn ? -1e9 : 1e9;
        for (const c of H) {
          const opts = optionsFn(c, tbl), list = opts.length ? opts : [null];
          for (const o of list) {
            let gain = 0, nt, nl = last;
            if (o) {
              const ids = new Set(o.map(x => x.id));
              nt = tbl.filter(x => !ids.has(x.id));
              gain = worth(c) + worthAll(o);
              if (!nt.length && myH.length + opH.length > 1 && !takesAll(c)) gain += 14;
              nl = meTurn ? 'me' : 'op';
            } else nt = [...tbl, c];
            const v = (meTurn ? gain : -gain) + solve(meTurn ? myH.filter(x => x !== c) : myH, meTurn ? opH : opH.filter(x => x !== c), nt, !meTurn, nl);
            if (meTurn ? v > best : v < best) best = v;
          }
        }
        return best;
      };
      let bestMove = null, bestVal = -1e9;
      for (const m of moves) {
        let gain = 0, nt, nl = lastWho;
        if (m.opt) {
          const ids = new Set(m.opt.map(x => x.id));
          nt = table.filter(x => !ids.has(x.id));
          gain = worth(m.card) + worthAll(m.opt);
          if (!nt.length && hand.length + opHand.length > 1 && !takesAll(m.card)) gain += 14;
          nl = 'me';
        } else nt = [...table, m.card];
        const v = gain + solve(hand.filter(x => x !== m.card), opHand, nt, false, nl) + rnd() * 0.01;
        if (v > bestVal) { bestVal = v; bestMove = m; }
      }
      if (bestMove) return bestMove;
    }
  }

  // how much the next player can be expected to take from the table I leave behind
  const next = (p + 1) % n;
  const nextHand = G.hands[next].length;
  const pHolds = v => {
    const k = unseen.filter(c => c.v === v).length, U = unseen.length;
    if (!k || !nextHand || !U) return 0;
    let none = 1;
    for (let i = 0; i < nextHand; i++) none *= Math.max(0, (U - k - i)) / (U - i);
    return 1 - none;
  };
  const danger = rest => {
    if (!rest.length) return 0;
    if (!extreme && !hard) return sum(rest) <= 10 ? 7 : 0;
    const nextLast = deckLeft === 0 && handTotal - 1 === 1;
    const gains = [];
    for (let v = 1; v <= 10; v++) {
      const pv = pHolds(v);
      if (!pv) continue;
      const opts = optionsFn({ s: '?', v, id: '?' + v }, rest);
      if (!opts.length) continue;
      let g = 0;
      for (const o of opts) {
        let x = 1 + (v === 7 ? 3 : v === 6 ? 1.5 : v === 1 ? 1 : 0) + worthAll(o);
        if (o.length === rest.length && !nextLast && !(v === 1 && R.ace === 'all')) x += 14;
        g = Math.max(g, x);
      }
      gains.push({ g, pv });
    }
    gains.sort((a, b) => b.g - a.g);
    let e = 0, miss = 1;
    for (const { g, pv } of gains) { e += g * pv * miss; miss *= 1 - pv; }
    return e * (extreme ? 0.9 : 0.8);
  };

  const jitter = extreme ? 0.15 : hard ? 0.4 : 0.6;
  let best = null;
  for (const m of moves) {
    const c = m.card;
    let sc;
    if (!m.opt) {
      const rest = [...table, c];
      sc = -worth(c) * (extreme || hard ? 0.4 : 1.3) - danger(rest);
      if ((extreme || hard) && lastPlay && G.lastSide !== null && G.lastSide !== undefined) sc += (G.lastSide === mySide ? 1 : -1) * worthAll(rest);
    } else {
      const ids = new Set(m.opt.map(x => x.id)), rest = table.filter(x => !ids.has(x.id));
      sc = worth(c) + worthAll(m.opt);
      if (!rest.length && !lastPlay && !takesAll(c)) sc += 14;
      sc -= danger(rest);
      // the last one to take something also gets whatever is left on the table
      if ((extreme || hard) && lastPlay) sc += worthAll(rest);
    }
    sc += rnd() * jitter;
    if (!best || sc > best.sc) best = { card: c, opt: m.opt, sc };
  }
  return best;
}
