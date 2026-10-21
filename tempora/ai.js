/* Tempora – Computergegner.
   Bewertet jeden erlaubten Zug, indem er ihn auf einer Kopie ausprobiert,
   und wählt den mit der besten Stellung. Stufen: easy, medium, hard. */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : root.TEMPORA_ENGINE;
  const C = isNode ? require('./cards.js') : root.TEMPORA_CARDS;
  const BY_ID = C.BY_ID;

  function unitValue(state, u, s, hard) {
    const st = E.stats(state, u, s);
    const d = BY_ID[u.id];
    let v = st.atk * 1.0 + st.def * 0.8 + 0.5;
    if (E.abilities(state, u, s)) {
      if (d.kw.indexOf('guard') >= 0) v += 1;
      if (d.kw.indexOf('ranged') >= 0) v += 1;
      if (d.kw.indexOf('tough') >= 0) v += 1;
      if (d.kw.indexOf('eternalWinter') >= 0) v += 3;
      if (d.kw.indexOf('harvestKing') >= 0) v += 1.5;
    }
    if (u.entombed) v *= hard ? 0.15 : 0.35;
    else if (E.isIced(state, u, s)) v *= 0.55;
    if (u.freezeTurn && u.freezeTurn > state.T) v *= 0.85;
    return v;
  }

  function evaluate(state, me, level) {
    if (state.winner === me) return 100000;
    if (state.winner === 'tie') return 0;
    if (state.winner !== null) return -100000;
    const hard = level === 'hard';
    const op = 1 - me;
    const P = state.players;
    let score = (P[me].life - P[op].life) * 2.2;
    if (P[op].life <= 6) score += (6 - P[op].life) * 1.5;
    if (P[me].life <= 6) score -= (6 - P[me].life) * 1.5;
    let nextSeason = null;
    if (hard) { const band = E.seasonBand(state); nextSeason = band.filter(function (b) { return b.pos === 'future'; })[0].season; }
    for (let p = 0; p < 2; p++) {
      const sign = p === me ? 1 : -1;
      P[p].field.forEach(function (sl, s) {
        if (!sl) return;
        if (sl.holder) { score += sign * 1.5; return; }
        let v = unitValue(state, sl.u, s, hard);
        if (hard && nextSeason === 'winter' && state.season !== 'winter' && E.isOuter(state, s) && BY_ID[sl.u.id].kw.indexOf('migrant') < 0) v *= 0.8;
        score += sign * v;
      });
      if (P[p].fieldSpell) score += sign * 2;
      score += sign * Math.min(P[p].hand.length, 7) * 1.1;
    }
    score += P[me].energy * 0.25;
    if (hard && nextSeason) {
      P[me].hand.forEach(function (c) { if (BY_ID[c.id].season === nextSeason) score += 0.4; });
    }
    return score;
  }

  function rnd() { return Math.random(); }

  /* Liefert die nächste Aktion für den Spieler am Zug. */
  function choose(state, level) {
    level = level || 'medium';
    const me = state.current;
    const acts = E.legalActions(state);
    if (acts.length === 1) return acts[0];
    if (level === 'easy' && rnd() < 0.3) {
      const nonEnd = acts.filter(function (a) { return a.t !== 'end'; });
      if (nonEnd.length && rnd() < 0.75) return nonEnd[Math.floor(rnd() * nonEnd.length)];
      return { t: 'end' };
    }
    const noise = level === 'easy' ? 3 : level === 'medium' ? 0.6 : 0;
    const base = evaluate(state, me, level);
    const scored = [];
    acts.forEach(function (a) {
      if (a.t === 'end') return;
      const s2 = E.clone(state);
      E.apply(s2, a);
      scored.push({ a: a, s: s2, sc: evaluate(s2, me, level) + (noise ? (rnd() - 0.5) * 2 * noise : 0) });
    });
    if (level !== 'hard') {
      let best = { t: 'end' }, bestScore = base + 0.2;
      scored.forEach(function (x) { if (x.sc > bestScore) { bestScore = x.sc; best = x.a; } });
      return best;
    }
    /* Schwer: die besten Kandidaten werden bis zum Zugende weitergespielt,
       damit Reihenfolgen wie „erst opfern, dann ausspielen“ erkannt werden. */
    scored.sort(function (x, y) { return y.sc - x.sc; });
    let best = { t: 'end' }, bestScore = base + 0.2;
    scored.slice(0, 8).forEach(function (x) {
      const fin = rollout(x.s, me, level);
      if (fin > bestScore) { bestScore = fin; best = x.a; }
    });
    return best;
  }
  function greedyStep(state, me, level) {
    const acts = E.legalActions(state);
    let best = null, bestScore = evaluate(state, me, level) + 0.2;
    acts.forEach(function (a) {
      if (a.t === 'end') return;
      const s2 = E.clone(state); E.apply(s2, a);
      const sc = evaluate(s2, me, level);
      if (sc > bestScore) { bestScore = sc; best = s2; }
    });
    return best;
  }
  function rollout(state, me, level) {
    let s = state, n = 0;
    while (s.current === me && s.winner === null && n < 12) {
      const nx = greedyStep(s, me, level);
      if (!nx) break;
      s = nx; n++;
    }
    return evaluate(s, me, level);
  }

  const API = { choose: choose, evaluate: evaluate };
  if (isNode) module.exports = API; else root.TEMPORA_AI = API;
})(this);
