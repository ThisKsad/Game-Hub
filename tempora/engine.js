/* Tempora – Spielregeln.
   Reine Logik ohne Darstellung: der Zustand ist ein schlichtes JSON-Objekt,
   damit er später unverändert in einer Supabase Edge Function laufen kann. */
(function (root) {
  'use strict';
  const C = (typeof module !== 'undefined' && module.exports) ? require('./cards.js') : root.TEMPORA_CARDS;
  const BY_ID = C.BY_ID;
  const CYCLE = ['spring', 'summer', 'autumn', 'winter'];
  const OPPOSITE = { spring: 'autumn', autumn: 'spring', summer: 'winter', winter: 'summer' };
  const SN = C.SEASON_NAMES;

  const DEFAULT_CFG = {
    life: 20, deckSize: 20, startHand: 4, handLimit: 8, maxEnergy: 8,
    fieldMode: 'grow', growAt: 'spring2', startSeason: 'spring',
    overwriteHolder: true, compensation: 'none', damageStays: true, weathering: true
  };

  /* ---------- Zufall (mit Startwert, damit Simulationen reproduzierbar sind) ---------- */
  function rand(state) {
    let t = (state.seed = (state.seed + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function shuffle(state, arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand(state) * (i + 1)); const x = arr[i]; arr[i] = arr[j]; arr[j] = x; }
    return arr;
  }

  /* ---------- Hilfen ---------- */
  function def(inst) { return BY_ID[inst.id]; }
  function other(p) { return 1 - p; }
  function log(state, text, kind) { state.log.push({ n: state.log.length, text: text, kind: kind || 'info', round: state.round }); }
  function fieldActive(state, id) { return state.players.some(function (pl) { return pl.fieldSpell && pl.fieldSpell.id === id; }); }
  function activeSlots(state) { return state.fieldSize === 7 ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]; }
  function isOuter(state, s) { const a = activeSlots(state); return s === a[0] || s === a[a.length - 1]; }
  function immune(state, inst) { return fieldActive(state, 'steinkreis') && def(inst).season === 'none'; }
  function sunBonus(state, s) {
    if (state.season !== 'summer') return 0;
    if (s === 3) return 2;
    if ((s === 2 || s === 4) && fieldActive(state, 'gleissend')) return 1;
    return 0;
  }
  function isIced(state, inst, s) {
    if (inst.entombed) return true;
    return state.season === 'winter' && isOuter(state, s) && !immune(state, inst);
  }
  function abilities(state, inst, s) {
    if (inst.noAbil) return false;
    if (isIced(state, inst, s) && !fieldActive(state, 'innerewaerme')) return false;
    return true;
  }
  function has(state, inst, s, kw) { return def(inst).kw.indexOf(kw) >= 0 && abilities(state, inst, s); }
  function hibernating(state, inst, s) { return state.season === 'winter' && has(state, inst, s, 'hibernate'); }

  function newInst(state, id, owner) { state.uid += 1; return { uid: state.uid, id: id, owner: owner }; }
  function resetInst(inst) { return { uid: inst.uid, id: inst.id, owner: inst.owner }; }

  function findUnit(state, uid) {
    for (let p = 0; p < 2; p++) {
      const f = state.players[p].field;
      for (let s = 0; s < 7; s++) { const sl = f[s]; if (sl && sl.u && sl.u.uid === uid) return { p: p, s: s, inst: sl.u }; }
    }
    return null;
  }
  function eachUnit(state, fn) {
    for (let p = 0; p < 2; p++) {
      const f = state.players[p].field;
      for (let s = 0; s < 7; s++) { const sl = f[s]; if (sl && sl.u) fn(sl.u, p, s); }
    }
  }

  /* ---------- Werte ---------- */
  function baseStats(inst) {
    const d = def(inst);
    if (inst.halfStats) return { atk: Math.ceil(d.atk / 2), def: Math.ceil(d.def / 2) };
    return { atk: d.atk, def: d.def };
  }
  function stats(state, inst, s) {
    const d = def(inst);
    const b = baseStats(inst);
    let atk = b.atk + (inst.pAtk || 0);
    let df = b.def + (inst.pDef || 0) + (inst.growth || 0);
    const mods = [];
    if (inst.halfStats) {
      if (b.atk !== d.atk) mods.push({ stat: 'atk', v: b.atk - d.atk, why: 'Vergänglichkeit (halbe Werte)' });
      if (b.def !== d.def) mods.push({ stat: 'def', v: b.def - d.def, why: 'Vergänglichkeit (halbe Werte)' });
    }
    if (inst.tmpDef && inst.tmpRound === state.round) { df += inst.tmpDef; mods.push({ stat: 'def', v: inst.tmpDef, why: 'Glutdrache' }); }
    if (inst.weather) { df -= inst.weather; mods.push({ stat: 'def', v: -inst.weather, why: 'Verwitterung' }); }
    if (inst.dmg && inst.dmgRound === state.round) { df -= inst.dmg; mods.push({ stat: 'def', v: -inst.dmg, why: 'Schaden in dieser Runde' }); }
    if (!immune(state, inst)) {
      const sun = sunBonus(state, s);
      if (sun) { atk += sun; mods.push({ stat: 'atk', v: sun, why: 'Sonnenplatz' }); }
      if (state.season === 'winter' && d.season !== 'winter' && !hibernating(state, inst, s)) {
        const f = fieldActive(state, 'dauerfrost') ? -2 : -1;
        df += f; mods.push({ stat: 'def', v: f, why: f === -2 ? 'Dauerfrost' : 'Frost' });
      }
    }
    if (sunBonus(state, s) && has(state, inst, s, 'sunbather')) { df += 1; mods.push({ stat: 'def', v: 1, why: 'Sonnenanbeter' }); }
    if (state.season === 'spring' && has(state, inst, s, 'springRage')) { atk += 2; mods.push({ stat: 'atk', v: 2, why: 'Erwachen' }); }
    return { atk: Math.max(0, atk), def: Math.max(0, df), mods: mods, baseAtk: d.atk, baseDef: d.def };
  }
  function isGuard(state, inst, s) {
    if (has(state, inst, s, 'guard')) return true;
    return has(state, inst, s, 'territory') && sunBonus(state, s) > 0;
  }
  function attackable(state, inst, s) { return !isIced(state, inst, s) && !hibernating(state, inst, s); }

  /* ---------- Kosten ---------- */
  function costOf(state, id) {
    const d = BY_ID[id];
    const base = d.cost;
    if (fieldActive(state, 'tagundnacht') || d.season === 'none') return { cost: base, delta: 0 };
    const cur = state.season;
    let delta = 0;
    if (cur === d.season) delta = -1;
    else if (cur === OPPOSITE[d.season]) delta = 1;
    if (d.season === 'summer' && cur === 'autumn' && fieldActive(state, 'spaetsommer')) delta = -1;
    if (d.season === 'spring' && delta > 0 && fieldActive(state, 'boden')) delta = 0;
    return { cost: Math.max(0, base + delta), delta: delta };
  }

  /* ---------- Jahreszeiten ---------- */
  function winterKingActive(state) {
    let on = false;
    eachUnit(state, function (u, p, s) { if (has(state, u, s, 'eternalWinter')) on = true; });
    return on;
  }
  function nextSeasonFrom(state, cur, streak, simulated) {
    if (cur === 'winter' && winterKingActive(state)) return 'winter';
    if (cur === 'spring' && fieldActive(state, 'ewigerfruehling') && streak < 2) return 'spring';
    return CYCLE[(CYCLE.indexOf(cur) + 1) % 4];
  }
  /* Band: 2 vergangene, aktuelle, 2 kommende (Vorhersage mit dem jetzigen Feld). */
  function seasonBand(state) {
    const past = state.history.slice(-2);
    const out = [];
    past.forEach(function (h) { out.push({ season: h.season, round: h.round, pos: 'past' }); });
    out.push({ season: state.season, round: state.round, pos: 'now' });
    let cur = state.season, streak = state.streak, r = state.round;
    while (out.length < 5) {
      const nx = nextSeasonFrom(state, cur, streak, true);
      streak = nx === cur ? streak + 1 : 1; cur = nx; r += 1;
      out.push({ season: cur, round: r, pos: 'future' });
    }
    return out;
  }

  /* ---------- Spielstart ---------- */
  function newGame(cfgIn, decks, opts) {
    opts = opts || {};
    const cfg = Object.assign({}, DEFAULT_CFG, cfgIn || {});
    const state = {
      v: 1, cfg: cfg, seed: (opts.seed >>> 0) || (Math.floor(Math.random() * 4294967295) >>> 0),
      uid: 0, round: 0, T: 0, current: 0, first: 0, season: 'spring', streak: 0, year: 1, springs: 0,
      fieldSize: cfg.fieldMode === '5' || cfg.fieldMode === 'grow' ? 5 : 7,
      history: [], log: [], winner: null,
      players: [0, 1].map(function (p) {
        return { name: (opts.names && opts.names[p]) || (p === 0 ? 'Du' : 'Computer'), life: cfg.life, energy: 0,
          deck: [], hand: [], field: [null, null, null, null, null, null, null], discard: [], fieldSpell: null, movedTurn: -1 };
      })
    };
    let first = opts.first;
    if (first !== 0 && first !== 1) first = rand(state) < 0.5 ? 0 : 1;
    state.first = first;
    for (let p = 0; p < 2; p++) {
      state.players[p].deck = shuffle(state, decks[p].map(function (id) { return newInst(state, id, p); }));
    }
    for (let p = 0; p < 2; p++) {
      let n = cfg.startHand;
      if (p !== first && cfg.compensation === 'card') n += 1;
      for (let i = 0; i < n; i++) draw(state, p, true);
    }
    let start = cfg.startSeason;
    if (start === 'random' || CYCLE.indexOf(start) < 0) start = CYCLE[Math.floor(rand(state) * 4)];
    state.season = start;
    state.streak = 1; state.round = 1;
    if (start === 'spring') state.springs = 1;
    log(state, (first === 0 ? state.players[0].name + ' beginnt' : state.players[1].name + ' beginnt') + '. Die Partie startet im ' + SN[start] + '.', 'round');
    startTurn(state, first);
    return state;
  }

  /* Neu mischen der Starthand (vor dem ersten Zug). idxs: Indizes der zurückgelegten Karten. */
  function mulligan(state, p, idxs) {
    const pl = state.players[p];
    const back = [];
    idxs.slice().sort(function (a, b) { return b - a; }).forEach(function (i) { back.push(pl.hand.splice(i, 1)[0]); });
    back.forEach(function (c) { pl.deck.push(c); });
    shuffle(state, pl.deck);
    for (let i = 0; i < back.length; i++) pl.hand.push(pl.deck.shift());
  }

  function draw(state, p, silent) {
    const pl = state.players[p];
    if (!pl.deck.length) {
      pl.life -= 2;
      log(state, pl.name + ' kann nicht ziehen (Deck leer) und verliert 2 Lebenskraft.', 'damage');
      checkWin(state);
      return null;
    }
    const c = pl.deck.shift();
    if (pl.hand.length >= state.cfg.handLimit) {
      pl.discard.push(c.id);
      if (!silent) log(state, pl.name + ' hat die Hand voll, ' + def(c).name + ' wird abgeworfen.', 'info');
      return null;
    }
    pl.hand.push(c);
    return c;
  }

  function startTurn(state, p) {
    if (state.winner !== null) return;
    state.T += 1;
    state.current = p;
    const pl = state.players[p];
    let e = Math.min(state.cfg.maxEnergy, state.round);
    if (state.round === 1 && p !== state.first && state.cfg.compensation === 'energy') e += 1;
    pl.energy = e;
    let n = 1;
    if (state.season === 'autumn') n += 1;
    for (let i = 0; i < n; i++) draw(state, p);
  }

  /* ---------- Rundenwechsel ---------- */
  function nextRound(state) {
    const prev = state.season;
    const nx = nextSeasonFrom(state, prev, state.streak);
    state.history.push({ season: prev, round: state.round });
    if (state.history.length > 12) state.history.shift();
    state.round += 1;
    state.streak = nx === prev ? state.streak + 1 : 1;
    state.season = nx;
    const changed = nx !== prev;
    if (changed && nx === 'spring') { state.springs += 1; state.year += 1; }
    log(state, 'Runde ' + state.round + ': ' + SN[nx] + (changed ? '' : ' (verlängert)') + '.', 'round');

    eachUnit(state, function (u, p, s) {
      delete u.tmpDef; delete u.tmpRound; delete u.dmg; delete u.dmgRound;
      if (state.cfg.weathering && u.playedRound != null) {
        const age = state.round - u.playedRound;
        if (age > 0 && age % 4 === 0) { u.weather = (u.weather || 0) + 1; log(state, def(u).name + ' verwittert: −1 Verteidigung.', 'info'); }
      }
      if (u.bloom && nx !== 'spring') { u.pDef = (u.pDef || 0) + 1; delete u.bloom; }
      if (changed && has(state, u, s, 'growth') && (u.growth || 0) < 4) u.growth = (u.growth || 0) + 1;
    });

    if (changed && nx === 'spring') {
      const melt = fieldActive(state, 'schneeschmelze');
      eachUnit(state, function (u) {
        if (u.entombed) { delete u.entombed; }
        if (melt && u.wasIced) { u.pAtk = (u.pAtk || 0) + 1; u.pDef = (u.pDef || 0) + 1; }
        delete u.wasIced;
      });
      const leaves = fieldActive(state, 'laubdecke');
      for (let p = 0; p < 2; p++) {
        const f = state.players[p].field;
        for (let s = 0; s < 7; s++) {
          const sl = f[s];
          if (sl && sl.holder) {
            const u = resetInst(sl.holder);
            u.noReturn = true; u.playedTurn = -1; u.playedRound = state.round;
            if (!sl.full) { u.noAbil = true; if (!leaves) u.halfStats = true; }
            if (!immune(state, u)) u.bloom = true;
            f[s] = { u: u };
            log(state, def(u).name + ' kehrt zurück' + (sl.full ? ' (vollständig)' : (leaves ? ' (volle Werte)' : ' (halbe Werte)')) + '.', 'info');
          }
        }
      }
      if (state.cfg.fieldMode === 'grow' && state.cfg.growAt === 'spring2' && state.fieldSize === 5 && state.springs >= 2) growField(state);
    } else if (changed) {
      eachUnit(state, function (u) { delete u.wasIced; });
    }
    if (state.cfg.fieldMode === 'grow' && state.cfg.growAt === 'round5' && state.fieldSize === 5 && state.round >= 5) growField(state);

    if (changed && nx === 'winter') {
      for (let p = 0; p < 2; p++) {
        const pl = state.players[p];
        for (let s = 0; s < 7; s++) {
          const sl = pl.field[s];
          if (sl && sl.u && def(sl.u).kw.indexOf('migrant') >= 0 && !sl.u.noAbil && pl.hand.length < state.cfg.handLimit) {
            pl.hand.push(resetInst(sl.u)); pl.field[s] = null;
            log(state, 'Die Schwalbe von ' + pl.name + ' zieht in den Süden und kehrt auf die Hand zurück.', 'info');
          }
        }
      }
    }
    if (nx === 'winter') eachUnit(state, function (u, p, s) { if (isIced(state, u, s) && !u.entombed) u.wasIced = true; });
    if (changed && nx === 'autumn') {
      for (let p = 0; p < 2; p++) {
        state.players[p].field.forEach(function (sl, s) {
          if (sl && sl.u && has(state, sl.u, s, 'harvestKing')) {
            draw(state, p); draw(state, p);
            log(state, 'Hirschkönig: ' + state.players[p].name + ' zieht 2 Karten.', 'info');
          }
        });
      }
    }
  }
  function growField(state) {
    state.fieldSize = 7;
    log(state, 'Das Feld wächst: zwei neue Plätze kommen hinzu.', 'round');
  }

  /* ---------- Zerstören ---------- */
  function destroy(state, p, s, why) {
    const pl = state.players[p];
    const sl = pl.field[s];
    if (!sl || !sl.u) return;
    const u = sl.u;
    const d = def(u);
    pl.field[s] = null;
    const fades = (state.season === 'autumn' || (state.season === 'winter' && fieldActive(state, 'spaetherbst')));
    if (fades && !u.noReturn && !immune(state, u)) {
      pl.field[s] = { holder: resetInst(u), full: false };
      log(state, d.name + ' wird zerstört und kehrt im Frühling zurück.', 'destroy');
    } else {
      pl.discard.push(u.id);
      log(state, d.name + ' wird zerstört' + (why ? ' (' + why + ')' : '') + '.', 'destroy');
    }
    pl.field.forEach(function (o, os) {
      if (o && o.u && has(state, o.u, os, 'scavenger') && (o.u.crow || 0) < 4) {
        o.u.crow = (o.u.crow || 0) + 1; o.u.pAtk = (o.u.pAtk || 0) + 1;
      }
    });
  }

  function checkWin(state) {
    if (state.winner !== null) return;
    const a = state.players[0].life <= 0, b = state.players[1].life <= 0;
    if (a && b) state.winner = 'tie';
    else if (a) state.winner = 1;
    else if (b) state.winner = 0;
    if (state.winner !== null) log(state, state.winner === 'tie' ? 'Unentschieden!' : state.players[state.winner].name + ' gewinnt!', 'end');
  }

  /* ---------- Angriff ---------- */
  function canAttack(state, u, p, s) {
    if (p !== state.current || state.winner !== null) return false;
    if (isIced(state, u, s) || hibernating(state, u, s)) return false;
    if (u.freezeTurn === state.T) return false;
    const st = stats(state, u, s);
    if (st.atk < 1) return false;
    const limit = u.doubleTurn === state.T ? 2 : 1;
    if ((u.attackTurn === state.T ? u.attacks : 0) >= limit) return false;
    const fresh = u.playedTurn === state.T;
    if (fresh && !u.haste && !has(state, u, s, 'haste')) return false;
    return true;
  }
  function attackTargets(state, u, p, s) {
    const e = other(p);
    const ef = state.players[e].field;
    const list = [];
    for (let i = 0; i < 7; i++) { const sl = ef[i]; if (sl && sl.u && attackable(state, sl.u, i)) list.push({ uid: sl.u.uid, s: i, inst: sl.u }); }
    if (!list.length) return ['player'];
    if (!has(state, u, s, 'ranged')) {
      const opp = list.filter(function (x) { return x.s === s; });
      if (opp.length) return [opp[0].uid];
    }
    const guards = list.filter(function (x) { return isGuard(state, x.inst, x.s); });
    if (guards.length) return guards.map(function (x) { return x.uid; });
    return list.map(function (x) { return x.uid; });
  }
  function doAttack(state, uid, target) {
    const a = findUnit(state, uid);
    const p = a.p, e = other(p);
    const u = a.inst;
    const sa = stats(state, u, a.s);
    if (u.attackTurn !== state.T) { u.attackTurn = state.T; u.attacks = 0; }
    u.attacks += 1;
    if (target === 'player') {
      state.players[e].life -= sa.atk;
      log(state, def(u).name + ' greift ' + state.players[e].name + ' direkt an: −' + sa.atk + ' Lebenskraft.', 'damage');
      checkWin(state);
      return;
    }
    const t = findUnit(state, target);
    const st = stats(state, t.inst, t.s);
    const tName = def(t.inst).name;
    const killed = sa.atk >= st.def;
    const over = st.atk - sa.def;
    log(state, def(u).name + ' (' + sa.atk + ') greift ' + tName + ' (' + st.def + ' Vert.) an' + (killed ? '.' : ' – hält stand' + (state.cfg.damageStays && sa.atk > 0 ? ' und nimmt ' + sa.atk + ' Schaden bis Rundenende' : '') + '.'), 'attack');
    if (killed) destroy(state, e, t.s);
    else if (state.cfg.damageStays && sa.atk > 0) {
      if (t.inst.dmgRound !== state.round) { t.inst.dmg = 0; t.inst.dmgRound = state.round; }
      t.inst.dmg += sa.atk;
    }
    if (over > 0 && !has(state, u, a.s, 'tough')) {
      state.players[p].life -= over;
      log(state, 'Gegenschlag: ' + state.players[p].name + ' verliert ' + over + ' Lebenskraft.', 'damage');
    }
    if (!killed && has(state, u, a.s, 'sting')) {
      state.players[e].life -= 1;
      log(state, 'Stachel: ' + state.players[e].name + ' verliert 1 Lebenskraft.', 'damage');
    }
    checkWin(state);
  }

  /* ---------- Karten spielen ---------- */
  function playableSlots(state, p) {
    const f = state.players[p].field;
    return activeSlots(state).filter(function (s) {
      if (state.season === 'winter' && isOuter(state, s)) return false;
      const sl = f[s];
      if (!sl) return true;
      return !!(sl.holder && state.cfg.overwriteHolder);
    });
  }
  function spellTargets(state, p, d) {
    const out = [];
    const e = other(p);
    if (d.target === 'ownReturn') {
      state.players[p].field.forEach(function (sl, s) {
        if (!sl) return;
        if (sl.holder && !sl.full) out.push('h' + s);
        if (sl.u && sl.u.noAbil) out.push(sl.u.uid);
      });
    } else if (d.target === 'ownUnit') {
      state.players[p].field.forEach(function (sl, s) { if (sl && sl.u && canAttack(state, sl.u, p, s)) out.push(sl.u.uid); });
    } else if (d.target === 'enemyUnit' || d.target === 'enemyUnitMax3') {
      state.players[e].field.forEach(function (sl) {
        if (sl && sl.u && !(d.target === 'enemyUnitMax3' && def(sl.u).cost > 3) && !(d.id === 'ewigeseis' && sl.u.entombed)) out.push(sl.u.uid);
      });
    }
    return out;
  }

  function legalActions(state) {
    const acts = [];
    if (state.winner !== null) return acts;
    const p = state.current, e = other(p);
    const pl = state.players[p];
    pl.hand.forEach(function (c, h) {
      const d = def(c);
      if (costOf(state, c.id).cost > pl.energy) return;
      if (d.type === 'unit') {
        const slots = playableSlots(state, p);
        let targets = [null];
        if (d.etb === 'freezeOne') {
          const t = []; state.players[e].field.forEach(function (sl) { if (sl && sl.u) t.push(sl.u.uid); });
          if (t.length) targets = t;
        } else if (d.etb === 'boar') {
          pl.field.forEach(function (sl) { if (sl && sl.u) targets.push(sl.u.uid); });
        }
        slots.forEach(function (s) { targets.forEach(function (t) { acts.push({ t: 'play', h: h, slot: s, target: t }); }); });
      } else if (d.type === 'spell') {
        spellTargets(state, p, d).forEach(function (t) { acts.push({ t: 'play', h: h, target: t }); });
      } else {
        acts.push({ t: 'play', h: h });
      }
    });
    pl.field.forEach(function (sl, s) {
      if (!sl || !sl.u) return;
      if (canAttack(state, sl.u, p, s)) attackTargets(state, sl.u, p, s).forEach(function (t) { acts.push({ t: 'attack', a: sl.u.uid, target: t }); });
      if (has(state, sl.u, s, 'sacrifice')) acts.push({ t: 'sacrifice', a: sl.u.uid });
    });
    if (state.season === 'spring' && pl.movedTurn !== state.T) {
      const free = activeSlots(state).filter(function (s) { return !pl.field[s]; });
      pl.field.forEach(function (sl) { if (sl && sl.u && !sl.u.entombed) free.forEach(function (s) { acts.push({ t: 'move', a: sl.u.uid, slot: s }); }); });
    }
    acts.push({ t: 'end' });
    return acts;
  }

  function apply(state, act) {
    if (state.winner !== null) return state;
    const p = state.current, e = other(p);
    const pl = state.players[p];
    if (act.t === 'end') {
      log(state, pl.name + ' beendet den Zug.', 'turn');
      if (p === state.first) startTurn(state, e);
      else { nextRound(state); startTurn(state, state.first); }
      return state;
    }
    if (act.t === 'move') {
      const a = findUnit(state, act.a);
      pl.field[act.slot] = pl.field[a.s]; pl.field[a.s] = null; pl.movedTurn = state.T;
      log(state, def(a.inst).name + ' wird verschoben.', 'info');
      return state;
    }
    if (act.t === 'sacrifice') {
      const a = findUnit(state, act.a);
      log(state, pl.name + ' opfert ' + def(a.inst).name + ' für +1 Energie.', 'info');
      destroy(state, p, a.s, 'geopfert');
      pl.energy += 1;
      return state;
    }
    if (act.t === 'attack') { doAttack(state, act.a, act.target); return state; }
    if (act.t === 'play') {
      const c = pl.hand[act.h];
      const d = def(c);
      pl.energy -= costOf(state, c.id).cost;
      pl.hand.splice(act.h, 1);
      if (d.type === 'unit') playUnit(state, p, c, act.slot, act.target);
      else if (d.type === 'spell') { castSpell(state, p, c, act.target); pl.discard.push(c.id); }
      else {
        if (pl.fieldSpell) { pl.discard.push(pl.fieldSpell.id); log(state, BY_ID[pl.fieldSpell.id].name + ' wird ersetzt.', 'info'); }
        pl.fieldSpell = c;
        log(state, pl.name + ' legt den Feldzauber ' + d.name + '.', 'play');
      }
      checkWin(state);
    }
    return state;
  }

  function playUnit(state, p, c, s, target) {
    const pl = state.players[p], e = other(p);
    const d = def(c);
    const old = pl.field[s];
    if (old && old.holder) { pl.discard.push(old.holder.id); log(state, 'Der Platzhalter von ' + BY_ID[old.holder.id].name + ' wird überbaut.', 'info'); }
    const u = resetInst(c);
    u.playedTurn = state.T; u.playedRound = state.round;
    if (!immune(state, u)) {
      if (state.season === 'spring') u.bloom = true;
      if (state.season === 'summer') u.haste = true;
    }
    pl.field[s] = { u: u };
    log(state, pl.name + ' spielt ' + d.name + '.', 'play');
    [s - 1, s + 1].forEach(function (n) {
      const sl = pl.field[n];
      if (n >= 0 && n < 7 && sl && sl.u && has(state, sl.u, n, 'pollinate')) { u.pDef = (u.pDef || 0) + 1; log(state, 'Hummel: ' + d.name + ' erhält +1 Verteidigung.', 'info'); }
    });
    etb(state, p, u, s, target);
  }
  function etb(state, p, u, s, target) {
    const d = def(u), e = other(p);
    if (d.etb === 'scorch') {
      let n = 0;
      state.players[e].field.forEach(function (sl) { if (sl && sl.u) { sl.u.tmpDef = -2; sl.u.tmpRound = state.round; n++; } });
      if (n) log(state, 'Glutdrache: gegnerische Einheiten −2 Verteidigung bis Rundenende.', 'info');
    } else if (d.etb === 'freezeOne' && target != null) {
      const t = findUnit(state, target);
      if (t) { t.inst.freezeTurn = state.T + 1; log(state, def(t.inst).name + ' wird eingefroren.', 'info'); }
    } else if (d.etb === 'boar' && target != null) {
      const t = findUnit(state, target);
      if (t && t.p === p && t.inst.uid !== u.uid) {
        destroy(state, p, t.s, 'geopfert');
        u.pAtk = (u.pAtk || 0) + 2; u.pDef = (u.pDef || 0) + 2;
        log(state, 'Wildschwein erhält +2/+2.', 'info');
      }
    }
  }
  function castSpell(state, p, c, target) {
    const d = def(c), e = other(p);
    log(state, state.players[p].name + ' wirkt ' + d.name + '.', 'play');
    if (d.id === 'austrieb') {
      if (typeof target === 'string' && target[0] === 'h') {
        const s = +target.slice(1); const sl = state.players[p].field[s];
        if (sl && sl.holder) { sl.full = true; log(state, BY_ID[sl.holder.id].name + ' wird im Frühling vollständig zurückkehren.', 'info'); }
      } else {
        const t = findUnit(state, target);
        if (t) {
          delete t.inst.noAbil; delete t.inst.halfStats;
          log(state, def(t.inst).name + ' ist vollständig wiederhergestellt.', 'info');
          etb(state, p, t.inst, t.s, null);
        }
      }
    } else if (d.id === 'lauffeuer') {
      const t = findUnit(state, target); if (t) t.inst.doubleTurn = state.T;
    } else if (d.id === 'wirbel') {
      const t = findUnit(state, target);
      if (t) {
        const owner = state.players[t.p];
        owner.field[t.s] = null;
        if (owner.hand.length < state.cfg.handLimit) owner.hand.push(resetInst(t.inst)); else owner.discard.push(t.inst.id);
        log(state, def(t.inst).name + ' wird auf die Hand zurückgeweht.', 'info');
      }
    } else if (d.id === 'ewigeseis') {
      const t = findUnit(state, target); if (t) { t.inst.entombed = true; log(state, def(t.inst).name + ' ist bis zum Frühling im Eis eingeschlossen.', 'info'); }
    } else if (d.id === 'steinlawine') {
      const t = findUnit(state, target); if (t) destroy(state, t.p, t.s, 'Steinlawine');
    }
  }

  function clone(state) { return JSON.parse(JSON.stringify(state)); }

  const API = {
    DEFAULT_CFG: DEFAULT_CFG, newGame: newGame, mulligan: mulligan, legalActions: legalActions, apply: apply, clone: clone,
    stats: stats, costOf: costOf, seasonBand: seasonBand, activeSlots: activeSlots, isIced: isIced, isOuter: isOuter,
    abilities: abilities, isGuard: isGuard, canAttack: canAttack, attackTargets: attackTargets, playableSlots: playableSlots,
    spellTargets: spellTargets, findUnit: findUnit, fieldActive: fieldActive, hibernating: hibernating, sunBonus: sunBonus,
    attackable: attackable, immune: immune, OPPOSITE: OPPOSITE
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.TEMPORA_ENGINE = API;
})(this);
