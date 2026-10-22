// Asse Raus – Oberfläche: Startmenü, Tisch, Weitergeben am gleichen Gerät, Online-Räume.
import * as C from './core.js';
import { LANGS, I18N } from './i18n.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
/* the hub sits one folder up on GitHub Pages; elsewhere (preview) link to the published hub */
const HUB_URL = /github\.io$/.test(location.hostname) ? '../' : 'https://thisksad.github.io/Game-Hub/';
const SET_KEY = 'asse-settings', GAME_KEY = 'asse-game', ON_KEY = 'asse-online', LANG_KEY = 'scopa-settings';

const readJSON = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

/* ---------- language (shared with the hub and Scopa) ---------- */
function detectLang() {
  const s = readJSON(LANG_KEY) || {};
  if (LANGS[s.lang]) return s.lang;
  const n = (navigator.language || 'de').toLowerCase();
  return n.startsWith('pt') ? 'pt' : n.startsWith('en') ? 'en' : n.startsWith('de') ? 'de' : 'en';
}
let LANG = detectLang();
function setLang(l) { LANG = l; const s = readJSON(LANG_KEY) || {}; s.lang = l; writeJSON(LANG_KEY, s); }
function t(k, v) {
  let s = I18N[LANG] && I18N[LANG][k];
  if (s === undefined) s = I18N.de[k];
  if (s === undefined) return k;
  if (typeof s !== 'string') return s;
  return v ? s.replace(/\{(\w+)\}/g, (_, x) => (v[x] !== undefined ? v[x] : '')) : s;
}
const rankShort = r => t('rank')[r] || String(r);
const rankLong = r => t('rankName')[r] || String(r);
function cname(c, val) {
  if (!c) return '';
  if (C.isJoker(c)) return val ? t('jokerAs', { v: rankLong(val) }) : t('joker');
  return t('cardName', { r: rankLong(c.r), s: t('suit')[c.s] });
}
const errText = e => (e && e.code && I18N.de['e_' + e.code] ? t('e_' + e.code) : (e && e.message) || t('serverErr'));

/* ---------- card artwork ---------- */
const RED = '#b3261e', BLK = '#1f1a14';
const suitColor = s => (s === 'H' || s === 'D' ? RED : BLK);
function suitG(s, x, y, k) {
  const col = suitColor(s);
  let g;
  if (s === 'H') g = `<path d="M0,7.5 C-9,0.5 -8,-8.5 0,-3.8 C8,-8.5 9,0.5 0,7.5Z"/>`;
  else if (s === 'D') g = `<path d="M0,-8.5 L6.4,0 L0,8.5 L-6.4,0Z"/>`;
  else if (s === 'S') g = `<path d="M0,-8.2 C-9,-1 -7.5,6.2 -1.2,3.2 L-3,8.4 H3 L1.2,3.2 C7.5,6.2 9,-1 0,-8.2Z"/>`;
  else g = `<circle cx="0" cy="-4.2" r="3.6"/><circle cx="-4.1" cy="1.4" r="3.6"/><circle cx="4.1" cy="1.4" r="3.6"/><path d="M-1.1,0.5 L-3,8.4 H3 L1.1,0.5Z"/>`;
  return `<g transform="translate(${x},${y}) scale(${k})" fill="${col}">${g}</g>`;
}
function starG(x, y, k, fill = '#d6ac55') {
  const pts = [];
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 4.2 : 10, a = -Math.PI / 2 + i * Math.PI / 5; pts.push((Math.cos(a) * r).toFixed(2) + ',' + (Math.sin(a) * r).toFixed(2)); }
  return `<g transform="translate(${x},${y}) scale(${k})"><polygon points="${pts.join(' ')}" fill="${fill}" stroke="#8c2c2a" stroke-width="1.2" stroke-linejoin="round"/></g>`;
}
const RF = 'font-family="Alegreya Sans, system-ui, sans-serif" font-weight="700"';
function cardSVG(c, mini) {
  const frame = `<rect x=".6" y=".6" width="58.8" height="86.8" rx="5.5" fill="#fffdf7" stroke="#d8ccb0" stroke-width="1.2"/>`;
  if (C.isJoker(c)) {
    if (mini) return `<svg viewBox="0 0 60 88" aria-hidden="true">${frame}${starG(30, 44, 2.1)}</svg>`;
    return `<svg viewBox="0 0 60 88" aria-hidden="true">${frame}<rect x="5" y="5" width="50" height="78" rx="4" fill="#f7e9c7" opacity=".7"/>${starG(30, 40, 1.75)}
      <text x="30" y="72" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="700" font-size="9.5" letter-spacing="1" fill="#8c2c2a">JOKER</text>
      ${starG(9.5, 11, .55)}${starG(50.5, 77, .55)}</svg>`;
  }
  const col = suitColor(c.s), r = rankShort(c.r);
  if (mini) {
    return `<svg viewBox="0 0 60 88" aria-hidden="true">${frame}<text x="30" y="${r.length > 1 ? 50 : 52}" text-anchor="middle" ${RF} font-size="${r.length > 1 ? 34 : 40}" fill="${col}">${r}</text>${suitG(c.s, 30, 70, 1.25)}</svg>`;
  }
  const fs = r.length > 1 ? 15 : 17;
  const corner = `<text x="${r.length > 1 ? 4 : 5.5}" y="17" ${RF} font-size="${fs}" fill="${col}">${r}</text>${suitG(c.s, 10, 26, .62)}`;
  let body;
  if (c.r >= 11) {
    body = `<rect x="15" y="20" width="30" height="48" rx="3" fill="${col}" fill-opacity=".07" stroke="${col}" stroke-opacity=".55" stroke-width="1"/>
      <text x="30" y="49" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="700" font-size="22" fill="${col}">${r}</text>${suitG(c.s, 30, 59, .8)}`;
  } else {
    body = suitG(c.s, 31, 49, c.r === 1 ? 2.4 : 1.75);
  }
  return `<svg viewBox="0 0 60 88" aria-hidden="true">${frame}${corner}<g transform="rotate(180 30 44)">${corner}</g>${body}</svg>`;
}
/* a card as markup; opt: mini, anchor, cls, button {src}, label, style, jv (value a joker stands for) */
function cardHTML(c, opt = {}) {
  const attrs = `${opt.anchor ? `data-anchor="${opt.anchor}"` : ''} ${opt.style ? `style="${opt.style}"` : ''}`;
  const jv = opt.jv ? `<span class="jv">${esc(rankShort(opt.jv))}</span>` : '';
  const label = esc(opt.label || cname(c, opt.jv));
  if (opt.src) return `<button type="button" class="card ${opt.cls || ''}" data-src="${opt.src}" ${attrs} aria-label="${label}" ${opt.disabled ? 'disabled' : ''}>${cardSVG(c, opt.mini)}${jv}</button>`;
  return `<div class="card ${opt.cls || ''}" ${attrs} role="img" aria-label="${label}">${cardSVG(c, opt.mini)}${jv}</div>`;
}
const backHTML = (anchor, style) => `<div class="card back" ${anchor ? `data-anchor="${anchor}"` : ''} ${style ? `style="${style}"` : ''} aria-hidden="true"></div>`;

/* ---------- settings ---------- */
const DEFAULT_NAME_RE = /^(Spieler|Player|Jogador) \d$/;
const defaultName = i => t('player', { n: i + 1 });
const isCompName = n => !n || C.COMP_NAMES.includes(n);
function loadSettings() {
  const s = readJSON(SET_KEY) || {};
  const players = [2, 3, 4].includes(s.players) ? s.players : 2;
  const seats = [0, 1, 2, 3].map(i => {
    const o = s.seats && s.seats[i];
    const ai = o ? !!o.ai : i === 1;
    let name = (o && typeof o.name === 'string' && o.name.trim()) || (ai ? C.COMP_NAMES[i] : defaultName(i));
    if (!ai && DEFAULT_NAME_RE.test(name)) name = defaultName(i);
    return { name, ai, level: o && C.LEVELS.includes(o.level) ? o.level : 'normal' };
  });
  const r = s.rules || {};
  const rules = {
    stock: Number.isFinite(r.stock) ? r.stock : 11,
    slots: C.SLOT_CHOICES.includes(r.slots) ? r.slots : 5,
    jokers: Number.isFinite(r.jokers) ? Math.max(0, Math.min(8, r.jokers)) : 6,
  };
  return { players, seats, rules, anim: s.anim !== false, where: s.where === 'online' ? 'online' : 'local', oname: typeof s.oname === 'string' ? s.oname.slice(0, 16) : '' };
}
const saveSettings = s => writeJSON(SET_KEY, s);

/* ---------- state ---------- */
let G = null;      // local game: the full rules state
let ON = null;     // online session
let V = null;      // what the table shows (public state + visible hands)
const ui = { menu: true, started: false, sel: null, revealed: null, seen: [], anim: loadSettings().anim, animUntil: 0, endReady: false, suppressClick: false };
let timers = [];
const later = (ms, fn) => timers.push(setTimeout(fn, ms));
const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

function viewFromLocal() { const st = C.publicState(G); st.hands = G.hands; st.online = false; return st; }
const N = () => V.players.length;
const humans = () => V.players.map((p, i) => (p.ai ? -1 : i)).filter(i => i >= 0);
const isMe = p => (V.online ? !!ON && p === ON.seat : humans().length === 1 && !V.players[p].ai);
const label = p => (isMe(p) ? t('you') : (V.players[p] && V.players[p].name) || t('freeSeat'));
function viewer() {
  if (!V) return null;
  if (V.online) return ON ? ON.seat : null;
  const h = humans();
  if (h.length === 1) return h[0];
  if (V.status !== 'play') return null;
  return ui.revealed === V.turn && !V.players[V.turn].ai ? V.turn : null;
}
const needsCover = () => !!V && !V.online && V.status === 'play' && !ui.menu && !V.players[V.turn].ai && humans().length > 1 && ui.revealed !== V.turn;
function canAct() {
  if (!V || V.status !== 'play' || ui.menu || needsCover()) return false;
  const v = viewer();
  return v !== null && v === V.turn && !V.players[V.turn].ai && !(ON && ON.busy) && Date.now() >= ui.animUntil;
}
const handOf = p => (V.hands && V.hands[p]) || [];
const animOn = () => ui.anim && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

/* ---------- sources and targets ---------- */
function srcOf(key) {
  if (!key) return null;
  const p = V.turn;
  if (key === 's') return { src: { type: 'stock' }, card: V.stockTops[p] };
  if (key.startsWith('d:')) { const k = +key.slice(2); return { src: { type: 'discard', pile: k }, card: C.top(V.discards[p][k]) }; }
  if (key.startsWith('h:')) { const id = key.slice(2); return { src: { type: 'hand', id }, card: handOf(p).find(c => c.id === id) }; }
  return null;
}
function targetsFor(key) {
  const s = srcOf(key);
  if (!s || !s.card) return [];
  const out = [];
  V.center.forEach((pile, i) => { if (C.fits(s.card, pile)) out.push('c:' + i); });
  if (s.src.type === 'hand') for (let k = 0; k < C.PILES; k++) out.push('d:' + k);
  return out;
}
function tapSource(key) {
  if (!canAct()) return;
  if (ui.sel && ui.sel.startsWith('h:') && key.startsWith('d:')) { dropOn(key); return; }
  ui.sel = ui.sel === key ? null : key;
  render();
}
function tapTarget(tk) {
  if (!canAct() || !ui.sel) return;
  if (!targetsFor(ui.sel).includes(tk)) return;
  dropOn(tk);
}
function dropOn(tk) {
  const s = srcOf(ui.sel);
  ui.sel = null;
  if (!s || !s.card) { render(); return; }
  const dst = tk.startsWith('c:') ? { type: 'center', slot: +tk.slice(2) } : { type: 'discard', pile: +tk.slice(2) };
  doMove({ src: s.src, dst });
}

/* ---------- moves ---------- */
const handSnapshot = () => (V && V.hands ? V.hands.map(h => new Set((h || []).map(c => c.id))) : []);
function doMove(mv) {
  if (V.online) { onlineMove(mv); return; }
  const p = G.turn, prev = handSnapshot();
  try { C.applyMove(G, p, mv); } catch (e) { toast(errText(e)); render(); return; }
  const la = G.lastAction, from = fromRect(la);
  if (G.turn !== p || G.status !== 'play') ui.seen[p] = G.moveNo;
  saveLocal();
  V = viewFromLocal();
  render();
  animateAction(la, from, prev);
  proceed();
}
function saveLocal() { if (G) writeJSON(GAME_KEY, { G, seen: ui.seen }); }

/* decides what happens next: the computer moves on its own, a human waits (behind the cover when several share the device) */
function proceed() {
  clearTimers();
  if (V && V.online) { onlineProceed(); return; }
  if (!G || ui.menu || G.status !== 'play') return;
  const p = G.turn;
  if (G.players[p].ai) {
    const fresh = !G.lastAction || G.lastAction.p !== p;
    later(Math.max(fresh ? 950 : 620, ui.animUntil - Date.now() + 160), () => {
      if (ui.menu || !G || G.status !== 'play' || G.turn !== p) return;
      doMove(C.aiMove(G));
    });
  }
}

function newLocalGame(s, again) {
  clearTimers();
  leaveOnline(true);
  let next;
  if (again && G) {
    next = { players: G.players, settings: G.settings, tally: G.tally, starter: G.starter, game: G.game };
  } else {
    const n = s.players;
    const players = s.seats.slice(0, n).map((x, i) => ({ name: x.name.trim() || defaultName(i), ai: !!x.ai, level: C.LEVELS.includes(x.level) ? x.level : 'normal' }));
    if (players.every(p => p.ai)) players[0].ai = false;
    const same = G && G.players.length === n && G.players.every((p, i) => p.name === players[i].name);
    next = { players, settings: { ...s.rules }, tally: same ? G.tally : undefined, starter: same ? G.starter : undefined, game: same ? G.game : 0 };
  }
  G = C.setupGame(next);
  ui.seen = Array(G.players.length).fill(0);
  ui.revealed = null; ui.sel = null; ui.endReady = false; ui.menu = false; ui.started = true;
  $('overlay').innerHTML = '';
  saveLocal();
  V = viewFromLocal();
  render();
  animateNewCards(null);
  proceed();
}

/* ---------- texts ---------- */
function logText(e) {
  const me = e.p != null && isMe(e.p), who = e.p != null ? label(e.p) : '';
  const y = me ? 'You' : '';
  switch (e.kind) {
    case 'center': return t((e.from === 'stock' ? 'mvStock' : e.from === 'discard' ? 'mvPile' : 'mvHand') + y, { who, card: cname(e.card, e.value) });
    case 'discard': return t('mvDiscard' + y, { who, card: cname(e.card) });
    case 'clear': return t('mvClear');
    case 'refill': return t('mvRefill' + y, { who, n: e.n });
    case 'reshuffle': return t('mvReshuffle');
    case 'end': return t('mvEnd' + y, { who });
    case 'win': return t('mvWin' + y, { who });
    case 'stuck': return t('mvStuck');
  }
  return '';
}
/* everything that happened in one step (a play, plus a finished stack or new cards) */
function groupedLog(entries) {
  const out = [];
  entries.forEach(e => {
    if (e.kind === 'refill' && out.length && out[out.length - 1].no === e.no && out[out.length - 1].p !== e.p) { out.push({ no: e.no, p: e.p, text: logText(e) }); return; }
    const last = out[out.length - 1];
    if (last && last.no === e.no) last.text += ' ' + logText(e);
    else out.push({ no: e.no, p: e.p, text: logText(e) });
  });
  return out;
}
function lastStep() {
  const log = V.log || [];
  if (!log.length) return '';
  const no = log[log.length - 1].no;
  return log.filter(e => e.no === no && !(e.kind === 'refill' && !isMe(e.p) && e.p === V.turn && false)).map(logText).join(' ');
}
function statusText() {
  if (V.status === 'end') return lastStep();
  const p = V.turn;
  if (canAct()) {
    if (ui.sel) {
      const s = srcOf(ui.sel);
      if (s && s.src.type === 'hand') return t('hintHandSel');
      return targetsFor(ui.sel).length ? t('hintSel') : t('hintNoFit');
    }
    const hand = handOf(p);
    if (!hand.length) return t('hintNoHand');
    if (!V.stockCounts[p]) return hand.length === 1 ? t('hintLastCard') : t('hintStockEmpty');
    const last = lastStep();
    if (!V.turnPlays) {
      const start = !V.log.length || V.log.every(e => e.kind === 'refill');
      const lead = start ? (isMe(p) && humans().length === 1 ? t('startsYou') : '') : last;
      return [lead, V.moveNo < 12 ? t('hintTurn') : t('yourTurn')].filter(Boolean).join(' ');
    }
    return last;
  }
  const last = lastStep();
  const tail = V.players[p].ai ? '' : t('turnOf', { who: V.players[p].name });
  const startNote = !V.log.length ? t('starts', { who: label(p) }) : '';
  return [startNote || last, tail].filter(Boolean).join(' ');
}

/* ---------- rendering ---------- */
function tagsHTML(p) {
  const pl = V.players[p], bits = [];
  if (pl.ai) bits.push(`<span class="tag ai">${esc(t('compLevel', { l: t('lvl_' + (pl.level || 'normal')) }))}</span>`);
  const w = (V.tally || [])[p];
  if (w) bits.push(`<span class="tag win" title="${esc(t('winsChip', { n: w }))}">★ ${w}</span>`);
  return bits.join('');
}
function replaceBtn(p) {
  if (!V.online || !ON || ON.seat !== 0 || V.status !== 'play' || V.turn !== p || V.players[p].ai || p === ON.seat) return '';
  if (Date.now() - ON.turnSince < 30000) return '';
  return `<button class="btn mini" type="button" data-replace="${p}">${t('replace')}</button>`;
}
function render() {
  if (!V) { $('opps').innerHTML = ''; $('board').innerHTML = ''; $('me').innerHTML = ''; $('hand').innerHTML = ''; $('msg').textContent = ''; renderOverlay(); return; }
  if (V.status === 'lobby') { $('opps').innerHTML = ''; $('board').innerHTML = ''; $('me').innerHTML = ''; $('hand').innerHTML = ''; $('msg').textContent = ''; renderOverlay(); return; }
  const v = viewer(), bottom = v !== null ? v : V.turn, act = canAct();
  if (ui.sel && (!act || !srcOf(ui.sel) || !srcOf(ui.sel).card)) ui.sel = null;
  const tg = act && ui.sel ? targetsFor(ui.sel) : [];
  const n = N();

  $('deckinfo').innerHTML = '';

  // other players, in turn order after the bottom seat
  const others = [];
  for (let k = 1; k < n; k++) others.push((bottom + k) % n);
  $('opps').className = 'opps n' + others.length;
  $('opps').setAttribute('aria-label', t('oppsAria'));
  $('opps').innerHTML = others.map(p => {
    const st = V.stockTops[p], sc = V.stockCounts[p], hc = V.handCounts[p];
    const stock = `<div class="ostock mini" title="${esc(t('cardsLeft', { n: sc }))}">${st ? cardHTML(st, { mini: true, anchor: `s-${p}`, label: t('stockAria', { n: sc, c: cname(st) }) }) : `<div class="ph" data-anchor="s-${p}" aria-label="${esc(t('stockEmpty'))}">★</div>`}<span class="count">${sc}</span></div>`;
    const piles = V.discards[p].map((d, k) => `<div class="slotwrap mini">${d.length ? cardHTML(C.top(d), { mini: true, anchor: `d-${p}-${k}`, label: t('pileAria', { k: k + 1, n: d.length }) + ': ' + cname(C.top(d)) }) : `<div class="ph" data-anchor="d-${p}-${k}" aria-label="${esc(t('pileEmpty', { k: k + 1 }))}"></div>`}${d.length > 1 ? `<span class="count">${d.length}</span>` : ''}</div>`).join('');
    const shown = Math.min(hc, 5);
    const hand = `<div class="ohand" ${hc ? '' : `data-anchor="h-${p}"`} title="${esc(t('handCount', { n: hc }))}">${Array.from({ length: shown }, (_, i) => backHTML(i === 0 ? `h-${p}` : '')).join('')}<em><span class="hlong">${esc(t('handCount', { n: hc }))}</span><span class="hshort">✋ ${hc}</span></em></div>`;
    return `<div class="opp ${V.turn === p && V.status === 'play' ? 'active' : ''}" data-seat="${p}">
      <div class="top"><span class="name">${esc(label(p))}</span><span class="tags">${tagsHTML(p)}</span>${replaceBtn(p)}</div>
      <div class="obody">${stock}<div class="opiles">${piles}</div>${hand}</div></div>`;
  }).join('');

  // centre
  const dc = V.deckCount, layers = dc > 40 ? 3 : dc > 10 ? 2 : dc ? 1 : 0;
  const deck = `<div class="deck"><div class="deckstack" data-anchor="deck" role="img" aria-label="${esc(t('deckAria', { n: dc }))}">${Array.from({ length: layers }, (_, i) => backHTML('', `--i:${i}`)).join('')}${layers ? '' : '<div class="ph" style="position:absolute;left:0;top:6px"></div>'}<span class="count">${dc}</span></div>${V.doneCount ? `<span class="lbl">${V.doneCount} ${esc(t('doneLbl'))}</span>` : `<span class="lbl">${esc(t('drawLbl'))}</span>`}</div>`;
  const slots = V.center.map((pile, i) => {
    const top = C.top(pile), v = pile.length, isT = tg.includes('c:' + i);
    const inner = top ? cardHTML(top, { anchor: `c-${i}`, jv: C.isJoker(top) ? v : null }) : `<div class="ph" data-anchor="c-${i}">${esc(rankShort(1))}</div>`;
    const aria = top ? t('slotAria', { k: i + 1, v: rankLong(v + 1) }) + ' – ' + cname(top, v) : t('slotEmptyAria', { k: i + 1 });
    return `<button type="button" class="slot ${isT ? 'tgt' : ''}" data-target="c:${i}" data-slot="${i}" ${isT ? '' : 'tabindex="-1"'} aria-label="${esc(aria)}">${inner}<span class="need">${top ? esc(t('needs', { v: rankShort(v + 1) })) : '&nbsp;'}</span></button>`;
  }).join('');
  $('board').className = 'board' + (V.center.length > 5 ? ' many' : '');
  $('board').setAttribute('aria-label', t('center'));
  $('board').innerHTML = deck + `<div class="slots">${slots}</div>`;

  // message line
  let msg = esc(statusText());
  if (act && !handOf(V.turn).length) msg += ` <button class="btn primary" type="button" id="endTurn">${t('endTurn')}</button>`;
  $('msg').innerHTML = msg;
  const et = $('endTurn'); if (et) et.addEventListener('click', () => doMove({ end: true }));

  // bottom seat
  const p = bottom, face = v === p || V.status === 'end';
  const st = V.stockTops[p], sc = V.stockCounts[p];
  const handSel = ui.sel && ui.sel.startsWith('h:');
  const stockEl = st
    ? cardHTML(st, act ? { src: 's', anchor: `s-${p}`, cls: (ui.sel === 's' ? 'sel ' : '') + (handSel ? '' : 'src'), label: t('stockAria', { n: sc, c: cname(st) }) } : { anchor: `s-${p}`, label: t('stockAria', { n: sc, c: cname(st) }) })
    : `<div class="ph" data-anchor="s-${p}" role="img" aria-label="${esc(t('stockEmpty'))}">★</div>`;
  const piles = V.discards[p].map((d, k) => {
    const show = d.slice(-4), isT = tg.includes('d:' + k), key = 'd:' + k;
    let cards = show.map((c, i) => {
      const style = `--k:${i}`;
      if (i === show.length - 1) {
        if (act) return cardHTML(c, { src: key, anchor: `d-${p}-${k}`, style, cls: (ui.sel === key ? 'sel ' : '') + (handSel ? '' : 'src') });
        return cardHTML(c, { anchor: `d-${p}-${k}`, style });
      }
      return cardHTML(c, { style });
    }).join('');
    if (!d.length) cards = `<div class="ph" style="--k:0" data-anchor="d-${p}-${k}"></div>`;
    const aria = d.length ? t('pileAria', { k: k + 1, n: d.length }) : t('pileEmpty', { k: k + 1 });
    return `<div class="pile ${isT ? 'tgt' : ''}" data-target="d:${k}" role="group" aria-label="${esc(aria)}">${cards}${d.length > 4 ? `<span class="count">${d.length}</span>` : ''}</div>`;
  }).join('');
  $('me').innerHTML = `<div class="mehead"><span class="who" style="${V.turn === p && V.status === 'play' ? 'color:var(--brass)' : ''}">${esc(label(p))}</span><span class="tags">${tagsHTML(p)}</span></div>
    <div class="merow"><div class="mystock"><div style="position:relative">${stockEl}<span class="count">${sc}</span></div><span class="lbl">${esc(t('stock'))}</span></div><div class="piles">${piles}</div></div>`;

  const hand = [...handOf(p)].sort((a, b) => (a.r || 99) - (b.r || 99) || a.s.localeCompare(b.s));
  $('hand').className = 'hand' + (act ? '' : ' wait');
  $('hand').setAttribute('aria-label', t('handAria'));
  if (face && (hand.length || !V.handCounts[p])) {
    $('hand').innerHTML = hand.map(c => act
      ? cardHTML(c, { src: 'h:' + c.id, anchor: `h-${p}-${c.id}`, cls: 'src' + (ui.sel === 'h:' + c.id ? ' sel' : '') })
      : cardHTML(c, { anchor: `h-${p}-${c.id}` })).join('');
  } else {
    $('hand').innerHTML = Array.from({ length: V.handCounts[p] || 0 }, (_, i) => backHTML(i === 0 ? `h-${p}` : '')).join('');
  }

  $('opps').querySelectorAll('[data-replace]').forEach(b => b.addEventListener('click', () => { b.disabled = true; onlineAction('replace', { seat: +b.dataset.replace }); }));
  renderOverlay();
}

/* ---------- animation ---------- */
const anchorEl = key => document.querySelector(`[data-anchor="${key}"]`);
function fromRect(la) {
  if (!la || la.kind === 'end') return null;
  let el;
  if (la.kind === 'discard' || la.from === 'hand') el = anchorEl(`h-${la.p}-${la.card.id}`) || anchorEl(`h-${la.p}`);
  else if (la.from === 'stock') el = anchorEl(`s-${la.p}`);
  else el = anchorEl(`d-${la.p}-${la.pile}`);
  return el ? el.getBoundingClientRect() : null;
}
function flip(el, from, delay = 0, dur = 380) {
  if (!el || !from || !el.animate) return 0;
  const to = el.getBoundingClientRect();
  if (!to.width || !from.width) return 0;
  const dx = from.left - to.left, dy = from.top - to.top, s = from.width / to.width;
  el.style.transformOrigin = '0 0';
  const a = el.animate([{ transform: `translate(${dx}px,${dy}px) scale(${s})` }, { transform: 'none' }], { duration: dur, delay, easing: 'cubic-bezier(.2,.75,.3,1)', fill: 'backwards' });
  a.onfinish = () => { el.style.transformOrigin = ''; };
  return dur + delay;
}
/* a card that no longer exists in the new layout (a finished stack) flies on its own */
function flyGhost(card, from, toEl) {
  if (!from || !toEl || !document.body.animate) return 0;
  const to = toEl.getBoundingClientRect();
  if (!to.width) return 0;
  const el = document.createElement('div');
  el.innerHTML = cardHTML(card);
  const c = el.firstElementChild;
  c.classList.add('flyer');
  Object.assign(c.style, { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px' });
  document.body.appendChild(c);
  const dx = from.left - to.left, dy = from.top - to.top, s = from.width / to.width;
  c.style.transformOrigin = '0 0';
  const a = c.animate([{ transform: `translate(${dx}px,${dy}px) scale(${s})`, opacity: 1 }, { transform: 'none', opacity: 1, offset: .65 }, { transform: 'scale(1.05)', opacity: 0 }], { duration: 700, easing: 'ease-out', fill: 'forwards' });
  a.onfinish = () => c.remove();
  setTimeout(() => c.remove(), 1200);
  return 700;
}
function animateAction(la, from, prevHands) {
  if (!animOn() || !la) { animateNewCards(prevHands); return; }
  let dur = 0;
  if (la.kind === 'center') {
    if (la.cleared) {
      const slotEl = document.querySelector(`.slot[data-slot="${la.slot}"]`) || document.querySelector('.slot');
      dur = flyGhost(la.card, from, slotEl ? slotEl.querySelector('.ph, .card') : null);
      if (slotEl) setTimeout(() => { const ph = slotEl.querySelector('.ph, .card'); if (ph) ph.classList.add('cleared'); }, 450);
    } else dur = flip(anchorEl(`c-${la.slot}`), from);
  } else if (la.kind === 'discard') {
    dur = flip(anchorEl(`d-${la.p}-${la.pile}`), from);
  }
  dur = Math.max(dur, animateNewCards(prevHands, dur ? 200 : 0));
  if (dur) ui.animUntil = Date.now() + Math.min(dur, 900);
  if (dur) setTimeout(() => { if (Date.now() >= ui.animUntil) render(); }, Math.min(dur, 900) + 30);
}
/* new hand cards come from the draw pile */
function animateNewCards(prevHands, delay = 0) {
  if (!animOn() || !V || !V.hands) return 0;
  const deck = anchorEl('deck');
  if (!deck) return 0;
  const from = deck.getBoundingClientRect();
  let end = 0;
  const v = viewer(), bottom = v !== null ? v : V.turn;
  const before = prevHands && prevHands[bottom];
  const els = [...$('hand').querySelectorAll('.card')].filter(el => {
    const id = (el.dataset.anchor || '').split('-').slice(2).join('-');
    return !before || (id && !before.has(id));
  });
  if (prevHands && els.length === $('hand').querySelectorAll('.card').length && before && before.size) return 0;
  els.forEach((el, i) => { end = Math.max(end, flip(el, from, delay + i * 70, 360)); });
  return end;
}

/* ---------- dragging cards ---------- */
let drag = null;
document.addEventListener('pointerdown', e => {
  const el = e.target.closest && e.target.closest('[data-src]');
  if (!el || e.button > 0 || !canAct() || el.closest('#overlay')) return;
  drag = { key: el.dataset.src, x: e.clientX, y: e.clientY, id: e.pointerId, on: false };
});
document.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.on) { if (dx * dx + dy * dy < 81) return; if (!startDrag(e)) { drag = null; return; } }
  e.preventDefault();
  moveDrag(e);
}, { passive: false });
document.addEventListener('pointerup', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  if (d.on) endDrag(d, e);
});
document.addEventListener('pointercancel', () => { if (drag && drag.on) cancelDrag(drag); drag = null; });
function startDrag(e) {
  if (!canAct()) return false;
  ui.sel = drag.key;
  render();
  const el = document.querySelector(`[data-src="${drag.key}"]`);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const g = el.cloneNode(true);
  g.classList.remove('sel', 'src'); g.classList.add('ghost');
  Object.assign(g.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', margin: 0 });
  document.body.appendChild(g);
  el.classList.add('dragging');
  drag.on = true; drag.ghost = g; drag.ox = drag.x - r.left; drag.oy = drag.y - r.top;
  return true;
}
function dropTargetAt(x, y) {
  const el = document.elementFromPoint(x, y);
  const tEl = el && el.closest && el.closest('[data-target]');
  if (!tEl || !ui.sel) return null;
  return targetsFor(ui.sel).includes(tEl.dataset.target) ? tEl : null;
}
function moveDrag(e) {
  drag.ghost.style.left = (e.clientX - drag.ox) + 'px';
  drag.ghost.style.top = (e.clientY - drag.oy) + 'px';
  const tEl = dropTargetAt(e.clientX, e.clientY);
  document.querySelectorAll('.over').forEach(x => { if (x !== tEl) x.classList.remove('over'); });
  if (tEl) tEl.classList.add('over');
}
function endDrag(d, e) {
  const tEl = dropTargetAt(e.clientX, e.clientY);
  d.ghost.remove();
  ui.suppressClick = true; setTimeout(() => { ui.suppressClick = false; }, 0);
  if (tEl) dropOn(tEl.dataset.target);
  else { ui.sel = null; render(); }
}
function cancelDrag(d) { if (d.ghost) d.ghost.remove(); ui.sel = null; render(); }

document.addEventListener('click', e => {
  if (ui.suppressClick) { ui.suppressClick = false; return; }
  if (e.target.closest('#overlay')) return;
  const s = e.target.closest('[data-src]');
  if (s) { tapSource(s.dataset.src); return; }
  const tEl = e.target.closest('[data-target]');
  if (tEl) { tapTarget(tEl.dataset.target); return; }
  if (ui.sel && e.target.closest('.app') && !e.target.closest('button, a')) { ui.sel = null; render(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && ui.sel && !ui.menu) { ui.sel = null; render(); } });

/* ---------- overlays ---------- */
function toast(text) {
  const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = text;
  document.body.appendChild(el); setTimeout(() => el.remove(), 4200);
}
function renderOverlay() {
  const ov = $('overlay');
  if (ui.menu) { if (!$('menuForm')) { ov.innerHTML = menuHTML(); bindMenu(); } return; }
  if (!V) { ov.innerHTML = ''; return; }
  if (V.online && V.status === 'lobby') {
    const a = document.activeElement, keep = a && a.classList && a.classList.contains('pname-edit') ? { id: a.id, v: a.value } : null;
    ov.innerHTML = lobbyHTML(); bindLobby();
    if (keep && $(keep.id)) { const el = $(keep.id); el.value = keep.v; el.focus(); }
    return;
  }
  if (V.status === 'end') {
    if (!ui.endReady) { ov.innerHTML = ''; setTimeout(() => { ui.endReady = true; if (V && V.status === 'end' && !ui.menu) renderOverlay(); }, 1400); return; }
    if (!$('endSheet')) { ov.innerHTML = endHTML(); bindEnd(); }
    return;
  }
  if (needsCover()) {
    if (!$('reveal')) { ov.innerHTML = coverHTML(); $('reveal').addEventListener('click', () => { ui.revealed = V.turn; $('overlay').innerHTML = ''; render(); animateNewCards(null); }); $('reveal').focus(); }
    return;
  }
  ov.innerHTML = '';
}
function coverHTML() {
  const p = V.turn, who = V.players[p].name, seen = ui.seen[p] || 0;
  const steps = groupedLog((V.log || []).filter(e => e.no > seen && e.kind !== 'refill'));
  const shown = steps.slice(-12), more = steps.length - shown.length;
  const list = shown.length ? `<div class="field"><span>${t(seen ? 'sinceLast' : 'sinceStart')}</span><ul class="log">${more ? `<li>${esc(t('moreBefore', { n: more }))}</li>` : ''}${shown.map(s => `<li>${esc(s.text)}</li>`).join('')}</ul></div>` : '';
  return `<div class="overlay"><div class="sheet" role="dialog" aria-label="${esc(t('coverTitle', { who }))}">
    <h2>${esc(t('coverTitle', { who }))}</h2><p>${esc(t('coverText', { who }))}</p>${list}
    <div class="actions"><button class="btn primary" type="button" id="reveal">${t('reveal')}</button></div></div></div>`;
}
function endHTML() {
  const w = V.winners || [];
  const head = w.length > 1 ? t('endTitleTie') : isMe(w[0]) ? t('endTitleYou') : t('endTitle', { who: V.players[w[0]].name });
  const stuck = (V.log || []).some(e => e.kind === 'stuck');
  const order = V.players.map((_, i) => i).sort((a, b) => V.stockCounts[a] - V.stockCounts[b]);
  const rows = order.map(i => `<tr class="${w.includes(i) ? 'win' : ''}"><th>${w.includes(i) ? '★ ' : ''}${esc(V.players[i].name)}</th><td>${V.stockCounts[i]}</td><td>${(V.tally || [])[i] || 0}</td></tr>`).join('');
  const host = V.online && ON && ON.seat === 0;
  return `<div class="overlay"><div class="sheet" id="endSheet" role="dialog" aria-label="${esc(head)}">
    <h2>${esc(head)}</h2>${stuck ? `<p class="hint">${t('endStuck')}</p>` : ''}
    <table class="sum"><thead><tr><th></th><th>${t('endLeft')}</th><th>${t('endWins')}</th></tr></thead><tbody>${rows}</tbody></table>
    ${V.online && !host ? `<p class="hint">${esc(t('canRestart', { who: V.players[0].name }))}</p>` : ''}
    <div class="actions">${V.online
      ? `<button class="btn" type="button" id="toMenu">${t('leaveRoom')}</button>${host ? `<button class="btn primary" type="button" id="again">${t('playAgain')}</button>` : ''}`
      : `<button class="btn" type="button" id="toMenu">${t('menu')}</button><button class="btn primary" type="button" id="again">${t('playAgain')}</button>`}</div>
  </div></div>`;
}
function bindEnd() {
  const a = $('again');
  if (a) a.addEventListener('click', () => { if (V.online) { a.disabled = true; onlineAction('again'); } else newLocalGame(loadSettings(), true); });
  $('toMenu').addEventListener('click', () => { if (V.online) { leaveOnline(); return; } ui.menu = true; $('overlay').innerHTML = ''; render(); });
}

/* ---------- menu ---------- */
const EXIT_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4H5v16h8"/><path d="M5 4l6 2.2v15.6L5 20" fill="currentColor" fill-opacity=".22"/><circle cx="9.3" cy="13" r=".9" fill="currentColor" stroke="none"/><path d="M14 12h7"/><path d="M18.5 9.2L21.3 12l-2.8 2.8"/></svg>';
const slotLabel = k => (k === 0 ? '∞' : String(k));
function menuHTML() {
  const s = loadSettings(), r = s.rules;
  const resumable = (ON && V && V.online) || (G && G.status === 'play' && ui.started);
  const seatRows = s.seats.map((seat, i) => `<div class="seat" id="seat${i}" ${i >= s.players ? 'hidden' : ''}>
      <span class="num">${i + 1}</span>
      <input type="text" id="name${i}" value="${esc(seat.name)}" maxlength="16" aria-label="${esc(t('seatName', { n: i + 1 }))}">
      <select id="ai${i}" aria-label="${esc(t('seatBy', { n: i + 1 }))}"><option value="human" ${seat.ai ? '' : 'selected'}>${t('human')}</option><optgroup label="${t('computer')}">${C.LEVELS.map(l => `<option value="${l}" ${seat.ai && seat.level === l ? 'selected' : ''}>${t('lvl_' + l)}</option>`).join('')}</optgroup></select>
      <button type="button" class="reroll ${seat.ai ? '' : 'off'}" id="re${i}" title="${esc(t('reroll'))}" aria-label="${esc(t('reroll'))}" ${seat.ai ? '' : 'tabindex="-1" aria-hidden="true"'}>↻</button>
    </div>`).join('');
  const oname = s.oname && !DEFAULT_NAME_RE.test(s.oname) ? s.oname : (s.seats[0].ai || DEFAULT_NAME_RE.test(s.seats[0].name) ? '' : s.seats[0].name);
  return `<div class="overlay"><form class="sheet menu" id="menuForm" autocomplete="off">
    <div class="menuhead"><div class="hdr-left"><a class="iconbtn light exitlink" href="${HUB_URL}" title="${esc(t('exit'))}" aria-label="${esc(t('exit'))}">${EXIT_SVG}</a><h2>${t('title')}</h2></div>
      <div class="langs" role="group" aria-label="${esc(t('language'))}">${Object.keys(LANGS).map(k => `<button type="button" class="lang ${k === LANG ? 'on' : ''}" data-lang="${k}" aria-pressed="${k === LANG}" title="${LANGS[k]}">${k === 'pt' ? 'PT-BR' : k.toUpperCase()}</button>`).join('')}</div></div>
    <p>${t('intro')}</p>
    <div class="seg"><label><input type="radio" name="where" id="w-local" ${s.where !== 'online' ? 'checked' : ''}><span>${t('oneDevice')}</span></label>
      <label><input type="radio" name="where" id="w-online" ${s.where === 'online' ? 'checked' : ''}><span>${t('online')}</span></label></div>
    <div class="cols"><div class="col">
      <div class="field"><span>${t('players')}</span>
        <div class="seg">${[2, 3, 4].map(k => `<label><input type="radio" name="players" id="p${k}" value="${k}" ${s.players === k ? 'checked' : ''}><span>${k}</span></label>`).join('')}</div></div>
      <div class="field seats" id="seats"><span>${t('seatsOrder')}</span>${seatRows}<p class="hint">${t('passHint')}</p></div>
      <div class="field online" id="onlineBox" ${s.where === 'online' ? '' : 'hidden'}><span>${t('playOnline')}</span>
        <label class="olbl" for="oname">${t('yourName')}</label>
        <input type="text" id="oname" maxlength="16" value="${esc(oname)}" autocomplete="nickname">
        <p class="hint">${t('onlineHint')}</p>
        <div class="join"><input type="text" id="ocode" maxlength="4" placeholder="${esc(t('code'))}" value="${esc(ui.joinCode || '')}" autocapitalize="characters" autocomplete="off" aria-label="${esc(t('roomCode'))}"><button class="btn" type="button" id="ojoin">${t('join')}</button></div>
        <p class="err" id="oerr" role="alert"></p></div>
    </div><div class="col">
      <div class="field"><span>${t('stockSize')}</span>
        <div class="stepper"><button type="button" id="stDown" aria-label="${esc(t('less'))}">−</button><b id="stVal">${r.stock}</b><button type="button" id="stUp" aria-label="${esc(t('more'))}">+</button></div>
        <p class="hint" id="stHint"></p></div>
      <div class="field"><span>${t('slots')}</span>
        <div class="seg slotsel">${C.SLOT_CHOICES.map(k => `<label title="${k === 0 ? esc(t('unlimited')) : k}"><input type="radio" name="slots" id="sl${k}" value="${k}" ${r.slots === k ? 'checked' : ''} aria-label="${k === 0 ? esc(t('unlimited')) : k}"><span>${slotLabel(k)}</span></label>`).join('')}</div>
        <p class="hint">${t('slotsHint')}</p></div>
      <div class="field"><span>${t('jokers')}</span>
        <div class="stepper"><button type="button" id="jkDown" aria-label="${esc(t('less'))}">−</button><b id="jkVal">${r.jokers}</b><button type="button" id="jkUp" aria-label="${esc(t('more'))}">+</button></div>
        <p class="hint">${t('jokersHint')}</p></div>
    </div></div>
    <div class="below">
      <label class="check"><input type="checkbox" id="anim" ${ui.anim ? 'checked' : ''}><span><b>${t('animLbl')}</b><small>${t('animHint')}</small></span></label>
      <div class="actions">
        ${ON ? `<button class="btn" type="button" id="leaveOn">${t('leaveRoom')}</button>` : ''}
        ${resumable ? `<button class="btn" type="button" id="resume">${t('resume')}</button>` : ''}
        <button class="btn primary" type="submit" id="mainSubmit"></button>
      </div>
      <details><summary>${t('rulesShort')}</summary><ul>${[1, 2, 3, 4, 5, 6].map(i => `<li>${t('rule' + i)}</li>`).join('')}</ul></details>
    </div>
  </form></div>`;
}
function bindMenu() {
  const count = () => [2, 3, 4].find(k => $('p' + k).checked);
  const online = () => $('w-online').checked;
  let stock = +$('stVal').textContent, jokers = +$('jkVal').textContent;
  const resumable = !!$('resume');
  const sync = () => {
    const k = count(), max = C.maxStock(k);
    stock = Math.max(3, Math.min(max, stock));
    $('stVal').textContent = stock; $('stDown').disabled = stock <= 3; $('stUp').disabled = stock >= max;
    $('stHint').textContent = t('stockHint', { n: max });
    $('jkVal').textContent = jokers; $('jkDown').disabled = jokers <= 0; $('jkUp').disabled = jokers >= 8;
    $('seats').hidden = online(); $('onlineBox').hidden = !online();
    $('mainSubmit').textContent = online() ? t('createRoom') : (resumable ? t('newGame') : t('startGame'));
    for (let i = 0; i < 4; i++) $('seat' + i).hidden = i >= k;
  };
  [2, 3, 4].forEach(k => $('p' + k).addEventListener('change', sync));
  ['w-local', 'w-online'].forEach(id => $(id).addEventListener('change', () => { sync(); saveSettings({ ...loadSettings(), where: online() ? 'online' : 'local' }); }));
  $('stDown').addEventListener('click', () => { stock--; sync(); });
  $('stUp').addEventListener('click', () => { stock++; sync(); });
  $('jkDown').addEventListener('click', () => { jokers--; sync(); });
  $('jkUp').addEventListener('click', () => { jokers++; sync(); });
  const pickName = i => {
    const used = [0, 1, 2, 3].map(j => $('name' + j).value.trim());
    const free = C.COMP_NAMES.filter(n => !used.includes(n));
    return free[Math.floor(Math.random() * free.length)] || C.COMP_NAMES[0];
  };
  for (let i = 0; i < 4; i++) {
    $('ai' + i).addEventListener('change', () => {
      const ai = $('ai' + i).value !== 'human', inp = $('name' + i), cur = inp.value.trim();
      if (ai && (!cur || DEFAULT_NAME_RE.test(cur))) inp.value = pickName(i);
      if (!ai && isCompName(cur)) inp.value = defaultName(i);
      const re = $('re' + i); re.classList.toggle('off', !ai);
      if (ai) { re.removeAttribute('tabindex'); re.removeAttribute('aria-hidden'); } else { re.tabIndex = -1; re.setAttribute('aria-hidden', 'true'); }
    });
    $('re' + i).addEventListener('click', () => { $('name' + i).value = pickName(i); });
  }
  const collect = () => {
    const players = count();
    const seats = [0, 1, 2, 3].map(i => { const v = $('ai' + i).value, ai = v !== 'human'; return { name: $('name' + i).value.trim() || (ai ? C.COMP_NAMES[i] : defaultName(i)), ai, level: ai ? v : 'normal' }; });
    if (seats.slice(0, players).every(x => x.ai)) seats[0].ai = false;
    const slots = C.SLOT_CHOICES.find(k => $('sl' + k).checked);
    return { players, seats, rules: { stock, slots: slots ?? 5, jokers }, anim: $('anim').checked, where: online() ? 'online' : 'local', oname: $('oname').value.trim().slice(0, 16) };
  };
  const onlineName = () => { const n = $('oname').value.trim(); if (!n) { $('oerr').textContent = t('nameFirst'); $('oname').focus(); return null; } return n; };
  const busy = on => ['mainSubmit', 'ojoin'].forEach(id => { if ($(id)) $(id).disabled = on; });
  $('menuForm').addEventListener('submit', async e => {
    e.preventDefault();
    const s = collect(); saveSettings(s); ui.anim = s.anim;
    if (s.where === 'online') {
      const name = onlineName(); if (!name) return;
      $('oerr').textContent = ''; busy(true);
      try {
        const r = await api('create', { name, players: s.players, settings: s.rules });
        await enterOnline({ code: r.code, roomId: r.roomId, seat: r.seat, token: r.token }, { id: r.roomId, version: r.version, state: r.state });
      } catch (err) { if ($('oerr')) $('oerr').textContent = err.message; busy(false); }
      return;
    }
    newLocalGame(s);
  });
  $('ojoin').addEventListener('click', async () => {
    const s = collect(); saveSettings(s);
    const name = onlineName(); if (!name) return;
    const code = $('ocode').value.toUpperCase().replace(/[^A-Z]/g, '');
    if (code.length !== 4) { $('oerr').textContent = t('codeFour'); $('ocode').focus(); return; }
    $('oerr').textContent = ''; busy(true);
    try {
      const r = await api('join', { code, name });
      ui.joinCode = '';
      await enterOnline({ code: r.code, roomId: r.roomId, seat: r.seat, token: r.token }, { id: r.roomId, version: r.version, state: r.state });
    } catch (err) { if ($('oerr')) $('oerr').textContent = err.message; busy(false); }
  });
  $('ocode').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('ojoin').click(); } });
  const lo = $('leaveOn'); if (lo) lo.addEventListener('click', () => leaveOnline());
  /* switching language keeps everything entered so far */
  document.querySelectorAll('.lang').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.lang === LANG) return;
    const keep = collect(), code = $('ocode').value;
    setLang(b.dataset.lang);
    saveSettings({ ...keep, oname: DEFAULT_NAME_RE.test(keep.oname) ? '' : keep.oname, seats: keep.seats.map((x, i) => (!x.ai && DEFAULT_NAME_RE.test(x.name) ? { ...x, name: defaultName(i) } : x)) });
    ui.joinCode = code;
    applyLang();
    $('overlay').innerHTML = '';
    render();
  }));
  $('anim').addEventListener('change', e => { ui.anim = e.target.checked; saveSettings({ ...loadSettings(), anim: ui.anim }); });
  const r = $('resume'); if (r) r.addEventListener('click', () => { ui.menu = false; $('overlay').innerHTML = ''; render(); proceed(); });
  sync();
}
function applyLang() {
  document.documentElement.lang = LANG === 'pt' ? 'pt-BR' : LANG;
  $('menuBtn').textContent = t('menu');
  const ex = $('exitBtn'); ex.href = HUB_URL; ex.title = t('exit'); ex.setAttribute('aria-label', t('exit'));
}
$('menuBtn').addEventListener('click', () => { ui.menu = true; ui.sel = null; clearTimers(); $('overlay').innerHTML = ''; render(); });

/* ---------- leaving towards the Game Hub ---------- */
function askExit() {
  const text = ON.st && ON.st.status === 'lobby' ? t('exitLobbyText') : t('exitOnlineText');
  const el = document.createElement('div');
  el.className = 'overlay confirm';
  el.innerHTML = `<div class="sheet" role="alertdialog" aria-modal="true" aria-labelledby="exitTitle" aria-describedby="exitText">
    <h2 id="exitTitle">${t('exitTitle')}</h2><p id="exitText">${esc(text)}</p>
    <div class="actions"><button class="btn" type="button" id="exitStay">${t('resume')}</button><a class="btn primary" id="exitGo" href="${HUB_URL}">${t('exitGo')}</a></div></div>`;
  const close = () => { el.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  el.addEventListener('click', e => { if (e.target === el) close(); });
  document.body.appendChild(el);
  $('exitStay').addEventListener('click', close);
  $('exitGo').addEventListener('click', () => {
    const o = ON;
    if (o && o.st && o.st.status === 'lobby' && o.seat !== 0) { try { fetch(SB_URL + '/functions/v1/asse-raus', { method: 'POST', headers: sbHeaders, keepalive: true, body: JSON.stringify({ action: 'leave', code: o.code, token: o.token }) }); } catch (e) {} }
    leaveOnline(true); close();
  });
  document.addEventListener('keydown', onKey);
  $('exitStay').focus();
}
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a.exitlink');
  if (!a || !ON) return; // local games are saved and simply resume later
  e.preventDefault(); askExit();
}, true);

/* ---------- online (Supabase: the server holds the deck and all hands, every move is checked there) ---------- */
const SB_URL = 'https://dwsieddjvldzurosjdpp.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3c2llZGRqdmxkenVyb3NqZHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NDE3NjEsImV4cCI6MjEwNzExNzc2MX0.NyIPiH_MQBNrHQn6Ype0SF8KLMO47FwZhosdoAusYeI';
const sbHeaders = { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY };
const saveSession = () => writeJSON(ON_KEY, ON ? { code: ON.code, roomId: ON.roomId, seat: ON.seat, token: ON.token } : null);
async function api(action, body = {}) {
  let r;
  try { r = await fetch(SB_URL + '/functions/v1/asse-raus', { method: 'POST', headers: sbHeaders, body: JSON.stringify({ action, ...body }) }); }
  catch (e) { throw new Error(t('netErr')); }
  const j = await r.json().catch(() => ({ error: t('badResponse') }));
  if (!r.ok || j.error) throw new Error(j.code && I18N.de['e_' + j.code] ? t('e_' + j.code) : (j.code === 'server' || !j.error ? t('serverErr') : j.error));
  return j;
}
async function rest(path, opts = {}) {
  let r;
  try { r = await fetch(SB_URL + '/rest/v1/' + path, { ...opts, headers: sbHeaders }); }
  catch (e) { throw new Error(t('netErr')); }
  if (!r.ok) throw new Error(t('loadErr'));
  return r.json();
}
async function fetchRoom(code) { const rows = await rest(`asse_rooms?code=eq.${encodeURIComponent(code)}&select=id,version,state`); return rows[0] || null; }
async function fetchHand() {
  const rows = await rest('rpc/asse_my_hand', { method: 'POST', body: JSON.stringify({ p_room: ON.roomId, p_token: ON.token }) });
  return rows && rows[0] ? rows[0].cards : null;
}
let sbLib = null;
function loadSupabase() {
  if (window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase);
  if (!sbLib) sbLib = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'; s.onload = () => res(window.supabase); s.onerror = rej; document.head.appendChild(s); });
  return sbLib;
}
async function enterOnline(sess, row) {
  leaveOnline(true);
  clearTimers();
  ON = { code: sess.code, roomId: sess.roomId || row.id, seat: sess.seat, token: sess.token, version: -1, st: null, hand: [], handRev: -1, queue: [], busy: false, turnSince: Date.now() };
  saveSession();
  ui.menu = false; ui.started = true; ui.sel = null; $('overlay').innerHTML = '';
  try { history.replaceState(null, '', '#' + sess.code); } catch (e) {}
  await applyRow(row, false);
  if (!ON) return;
  ON.poll = setInterval(async () => {
    if (!ON) return;
    try { const r = await fetchRoom(ON.code); if (!ON) return; if (!r) { roomGone(); return; } onRow(r); } catch (e) {}
  }, 3000);
  loadSupabase().then(lib => {
    if (!ON || !lib || !lib.createClient) return;
    const client = lib.createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
    ON.client = client;
    ON.chan = client.channel('asse-' + ON.code)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'asse_rooms', filter: 'code=eq.' + ON.code }, p => onRow(p.new))
      .subscribe();
  }).catch(() => {});
}
function leaveOnline(silent) {
  if (!ON) return;
  const o = ON; ON = null;
  clearInterval(o.poll); clearTimeout(o.aiTimer); clearTimeout(o.waitTimer);
  try { if (o.client && o.chan) o.client.removeChannel(o.chan); } catch (e) {}
  if (!silent && o.st && o.st.status === 'lobby') api('leave', { code: o.code, token: o.token }).catch(() => {});
  saveSession();
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  if (V && V.online) V = G ? viewFromLocal() : null;
  if (!silent) { ui.menu = true; $('overlay').innerHTML = ''; render(); }
}
function roomGone() { toast(t('roomGone')); leaveOnline(); }
function seatLost() { toast(t('seatLost')); leaveOnline(); }
function onRow(row) {
  if (!ON || !row || !row.state) return;
  if (row.version <= ON.version || ON.queue.some(q => q.version === row.version)) return;
  ON.queue.push(row); ON.queue.sort((a, b) => a.version - b.version);
  pump();
}
async function pump() {
  if (!ON || ON.pumping) return;
  ON.pumping = true;
  try {
    while (ON && ON.queue.length) {
      const row = ON.queue.shift();
      if (row.version <= ON.version) continue;
      await applyRow(row, true);
      if (ON && ON.queue.length) await new Promise(r => setTimeout(r, Math.max(120, ui.animUntil - Date.now())));
    }
  } finally { if (ON) ON.pumping = false; }
}
function buildV(st) {
  const hands = st.hands || st.players.map(() => null);
  if (st.status !== 'lobby' && !st.hands) hands[ON.seat] = ON.hand;
  return { ...st, hands, online: true, players: st.players.map(p => ({ ...p, name: p.name || t('freeSeat') })) };
}
async function applyRow(row, animate) {
  const prev = ON.st, st = row.state, la = st.lastAction;
  const from = animate && prev && prev.status === 'play' && la && la.moveNo === (prev.moveNo || 0) + 1 ? fromRect(la) : null;
  const prevHands = handSnapshot();
  if (row.id) ON.roomId = row.id;
  if (!prev || prev.turn !== st.turn) ON.turnSince = Date.now();
  ON.st = st; ON.version = row.version;
  if (ON.nextHand && ON.nextHand.version === row.version) { ON.hand = ON.nextHand.hand; ON.handRev = (st.handRev || [])[ON.seat]; ON.nextHand = null; }
  if (st.status === 'lobby') { ON.hand = []; ON.handRev = -1; }
  else if (st.status === 'play' && (st.handRev || [])[ON.seat] !== ON.handRev) {
    try { const h = await fetchHand(); if (!ON) return; if (h === null) { seatLost(); return; } ON.hand = h; ON.handRev = st.handRev[ON.seat]; } catch (e) {}
  }
  if (prev && prev.status !== 'end' && st.status === 'end') ui.endReady = false;
  if (prev && prev.game !== st.game) { ui.endReady = false; ui.sel = null; }
  V = buildV(st);
  render();
  if (from) animateAction(la, from, prevHands);
  else if (prev && prev.status !== 'play' && st.status === 'play') animateNewCards(null);
  else if (animate) animateNewCards(prevHands);
  onlineProceed();
}
async function onlineMove(mv) {
  if (!ON || ON.busy) return;
  ON.busy = true; render();
  try {
    const res = await api('move', { code: ON.code, token: ON.token, mv });
    if (!ON) return;
    ON.nextHand = { version: res.version, hand: res.hand };
    ON.busy = false;
    onRow({ id: ON.roomId, version: res.version, state: res.state });
  } catch (e) { toast(e.message); if (ON) { ON.busy = false; render(); } }
}
async function onlineAction(action, extra = {}) {
  if (!ON) return;
  try { const r = await api(action, { code: ON.code, token: ON.token, ...extra }); if (ON && r.state) onRow({ id: ON.roomId, version: r.version, state: r.state }); }
  catch (e) { toast(e.message); }
}
/* the first human at the table asks the server for computer moves; the others step in if that device went quiet */
function onlineProceed() {
  if (!ON || !ON.st) return;
  const st = ON.st;
  clearTimeout(ON.aiTimer); clearTimeout(ON.waitTimer);
  if (st.status === 'play' && st.players[st.turn].ai) {
    const mv = st.moveNo, first = st.players.findIndex(p => !p.ai);
    const fresh = !st.lastAction || st.lastAction.p !== st.turn;
    ON.aiTimer = setTimeout(() => {
      if (!ON || ON.st.moveNo !== mv || ON.st.status !== 'play') return;
      api('ai', { code: ON.code, moveNo: mv }).then(r => { if (ON && r.state) onRow({ id: ON.roomId, version: r.version, state: r.state }); }).catch(() => {});
    }, (ON.seat === first ? (fresh ? 900 : 550) : 6000) + Math.max(0, ui.animUntil - Date.now()));
  }
  if (st.status === 'play' && ON.seat === 0 && !st.players[st.turn].ai && st.turn !== ON.seat) {
    ON.waitTimer = setTimeout(() => render(), Math.max(0, 30500 - (Date.now() - ON.turnSince)));
  }
}
function lobbyHTML() {
  const st = ON.st, host = ON.seat === 0, link = location.origin + location.pathname + '#' + ON.code;
  const rows = st.players.map((p, i) => {
    const tags = [];
    if (i === 0) tags.push(`<span class="tag dark">${t('host')}</span>`);
    if (i === ON.seat) tags.push(`<span class="tag dark">${t('you')}</span>`);
    let ctrl = '';
    if (host && i > 0 && (p.open || p.ai)) ctrl = `<select class="lvl" data-seat="${i}" aria-label="${esc(t('seatBy', { n: i + 1 }))}"><option value="open" ${p.open ? 'selected' : ''}>${t('freeSeat')}</option><optgroup label="${t('computer')}">${C.LEVELS.map(l => `<option value="${l}" ${!p.open && (p.level || 'normal') === l ? 'selected' : ''}>${t('lvl_' + l)}</option>`).join('')}</optgroup></select>`;
    else if (p.ai) tags.push(`<span class="tag dark">${esc(t('compLevel', { l: t('lvl_' + (p.level || 'normal')) }))}</span>`);
    const name = host && !p.open
      ? `<span class="pname"><input class="pname-edit" id="pn${i}" data-seat="${i}" type="text" maxlength="16" value="${esc(p.name)}" data-orig="${esc(p.name)}" aria-label="${esc(t('editName', { n: i + 1 }))}" autocomplete="off"></span>`
      : `<span class="pname">${p.open ? t('freeSeat') : esc(p.name)}</span>`;
    return `<li class="${p.open ? 'open' : ''}"><span class="num">${i + 1}</span>${name}<span class="ptags">${tags.join('')}</span>${ctrl}</li>`;
  }).join('');
  const open = st.players.filter(p => p.open).length, s = st.settings || {};
  return `<div class="overlay"><div class="sheet" role="dialog" aria-label="${t('waitingRoom')}">
    <h2>${t('waitingRoom')}</h2><p>${t('lobbyIntro')}</p>
    <div class="codebox"><b>${ON.code}</b><div class="actions"><button class="btn" type="button" id="copyCode">${t('copyCode')}</button><button class="btn" type="button" id="copyLink">${t('copyLink')}</button></div></div>
    <p class="hint linktext" id="linkText">${esc(link)}</p>
    <div class="field"><span>${esc(t('seatsHead', { s: s.stock, m: s.slots ? s.slots : t('unlimited') }))}</span><ul class="lobby">${rows}</ul></div>
    ${host ? `<p class="hint">${open ? (open === 1 ? t('openSeats1') : t('openSeatsN', { n: open })) : t('allSeated')} ${t('renameHint')}</p>` : `<p class="hint">${esc(t('waitHost', { who: st.players[0].name }))}</p>`}
    <div class="actions"><button class="btn" type="button" id="leaveRoom">${t('leaveRoom')}</button>${host ? `<button class="btn primary" type="button" id="startRoom">${t('startGame')}</button>` : ''}</div>
  </div></div>`;
}
function bindLobby() {
  document.querySelectorAll('input.pname-edit').forEach(inp => {
    const commit = () => {
      const name = inp.value.trim().slice(0, 16);
      if (!name) { inp.value = inp.dataset.orig; return; }
      if (name === inp.dataset.orig) return;
      inp.dataset.orig = name;
      onlineAction('rename', { seat: +inp.dataset.seat, name });
    };
    inp.addEventListener('change', commit);
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); inp.value = inp.dataset.orig; inp.blur(); }
    });
  });
  const selectText = () => { const el = $('linkText'); const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast(t('linkSelected')); };
  const copy = (text, msg) => { try { navigator.clipboard.writeText(text).then(() => toast(msg), selectText); } catch (e) { selectText(); } };
  $('copyCode').addEventListener('click', () => copy(ON.code, t('copiedCode')));
  $('copyLink').addEventListener('click', () => copy(location.origin + location.pathname + '#' + ON.code, t('copiedLink')));
  $('leaveRoom').addEventListener('click', () => leaveOnline());
  const s = $('startRoom'); if (s) s.addEventListener('click', () => { s.disabled = true; onlineAction('start').finally(() => { if ($('startRoom')) $('startRoom').disabled = false; }); });
  document.querySelectorAll('select.lvl[data-seat]').forEach(b => b.addEventListener('change', () => { b.disabled = true; onlineAction('seat', { seat: +b.dataset.seat, ai: b.value !== 'open', level: b.value }); }));
}
async function tryResume() {
  const sess = readJSON(ON_KEY);
  if (!sess || !sess.code || !sess.token) return false;
  try {
    const row = await fetchRoom(sess.code);
    if (!row || row.id !== sess.roomId) { writeJSON(ON_KEY, null); return false; }
    await enterOnline(sess, row);
    return !!ON;
  } catch (e) { return false; }
}

/* ---------- boot (a running local game survives reloads) ---------- */
function boot() {
  applyLang();
  const hash = (location.hash || '').replace('#', '').toUpperCase();
  if (/^[A-Z]{4}$/.test(hash)) { ui.joinCode = hash; saveSettings({ ...loadSettings(), where: 'online' }); }
  const saved = readJSON(GAME_KEY);
  if (saved && saved.G && saved.G.players && saved.G.center) {
    G = saved.G; ui.seen = saved.seen || [];
    V = viewFromLocal();
    if (G.status === 'play' && !ui.joinCode) { ui.started = true; ui.menu = false; ui.endReady = true; }
  }
  render();
  proceed();
  tryResume();
}
boot();
