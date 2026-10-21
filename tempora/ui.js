/* Tempora – Oberfläche: Passwort, Startmenü, Deckverwaltung, Spielfeld. */
(function () {
  'use strict';
  const C = window.TEMPORA_CARDS, E = window.TEMPORA_ENGINE, AI = window.TEMPORA_AI;
  const ART = window.TEMPORA_ART, DECOR = window.TEMPORA_DECOR, STORE = window.TEMPORA_STORE;
  const BY_ID = C.BY_ID, SN = C.SEASON_NAMES;
  const GAME_NAME = 'Tempora';
  const ACCESS_KEY = 'tempora-access', SETTINGS_KEY = 'tempora-settings';
  const PASSWORD = 'test'; // einfacher Schutz für die Testphase, nicht sicher

  const SC = {
    spring: { b: '#4E7A3C', bg: '#DCEBD3', ab: '#A9C79A' },
    summer: { b: '#9A6A0E', bg: '#F6E3B8', ab: '#D9BE7E' },
    autumn: { b: '#A34A22', bg: '#F2D3C2', ab: '#D7A88F' },
    winter: { b: '#3E6A92', bg: '#D5E3F0', ab: '#A2BCD6' },
    none: { b: '#77736C', bg: '#CFCBC3', ab: '#A8A39A' }
  };
  const COSTBG = { spring: '#4E7A3C', summer: '#8A5F0C', autumn: '#A34A22', winter: '#3E6A92' };
  const TYPE = { unit: 'Einheit', spell: 'Zauber', field: 'Feldzauber' };
  const ICON = {
    sword: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    heart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="#E07A6E" aria-hidden="true"><path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z"/></svg>',
    bolt: '<svg width="16" height="16" viewBox="0 0 24 24" fill="#F2C94C" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
    door: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4H6v16h8"/><path d="M14 4l5 2v12l-5 2z"/><circle cx="16" cy="12" r=".8" fill="currentColor"/></svg>',
    list: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    book: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/></svg>',
    wheel: '<svg viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="10.6" fill="none" stroke="#CFCBC3" stroke-width="0.5"/><path d="M11 11 L11 1.5 A9.5 9.5 0 0 1 20.5 11 Z" fill="#9A6A0E"/><path d="M11 11 L20.5 11 A9.5 9.5 0 0 1 11 20.5 Z" fill="#A34A22"/><path d="M11 11 L11 20.5 A9.5 9.5 0 0 1 1.5 11 Z" fill="#3E6A92"/><path d="M11 11 L1.5 11 A9.5 9.5 0 0 1 11 1.5 Z" fill="#4E7A3C"/><circle cx="11" cy="11" r="2.2" fill="#2A2926" stroke="#CFCBC3" stroke-width="0.4"/></svg>'
  };
  const $ = function (sel, el) { return (el || document).querySelector(sel); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }

  /* ---------- Einstellungen ---------- */
  const DEFAULTS = {
    player: 'lukas', difficulty: 'medium', aiDeck: 'random', first: 'random', myDeck: null,
    startSeason: 'spring', turnMode: 'alternate', fieldMode: 'grow', growAt: 'spring2',
    life: 20, deckSize: 20, startHand: 4, handLimit: 8, copies: 1,
    mulligan: false, overwriteHolder: true, compensation: 'none', allowIncomplete: false, cardBack: 'jahreskreis'
  };
  let S = loadSettings();
  function loadSettings() { try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}); } catch (e) { return Object.assign({}, DEFAULTS); } }
  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(S)); } catch (e) {} }

  /* ---------- Karten-HTML ---------- */
  function backHTML() { return '<div class="back"><div style="width:96px;height:96px">' + ICON.wheel + '</div></div>'; }
  function costHTML(type, n, mode, curSeason) {
    const sh = 'shape-' + type;
    let bg = '#3F3D39';
    if (mode === 'season' && COSTBG[curSeason]) bg = COSTBG[curSeason];
    const i = '<i class="' + sh + '" style="background:' + bg + '">' + n + '</i>';
    if (mode === 'cheaper') return '<span class="cost ' + sh + ' cheaper"><span class="' + sh + '">' + i + '</span></span>';
    if (mode === 'pricier') return '<span class="cost ' + sh + ' pricier">' + i + '</span>';
    return '<span class="cost ' + sh + '">' + i + '</span>';
  }
  /* o: { cost, costMode, season (aktuelle Jahreszeit), atk, def, atkMode, defMode, noAbil, iced, flags[] } */
  function cardHTML(id, o) {
    o = o || {};
    const d = BY_ID[id];
    const s = SC[d.season];
    const tl = d.anchor ? 'Einheit · Anker' : TYPE[d.type] + ' · ' + SN[d.season];
    let tx;
    if (o.noAbil && !d.anchor) tx = '<em>Zurückgekehrt: Fähigkeiten ruhen.</em>';
    else if (d.anchor) tx = '<em>Keine Fähigkeit</em>';
    else tx = (d.short[0] ? '<b>' + esc(d.short[0]) + '</b> ' : '') + esc(d.short[1]);
    let ft = '';
    if (d.type === 'unit') {
      const atk = o.atk != null ? o.atk : d.atk, df = o.def != null ? o.def : d.def;
      ft = '<div class="ft"><span class="badge atk ' + (o.atkMode || '') + '">' + ICON.sword + '<span>' + atk + '</span>' + (o.atkMode === 'up' ? '<small>▲</small>' : o.atkMode === 'down' ? '<small>▼</small>' : '') + '</span>' +
        '<span class="badge def ' + (o.defMode || '') + '">' + ICON.shield + '<span>' + df + '</span>' + (o.defMode === 'up' ? '<small>▲</small>' : o.defMode === 'down' ? '<small>▼</small>' : '') + '</span></div>';
    }
    const flags = (o.flags || []).map(function (f) { return '<span>' + esc(f) + '</span>'; }).join('');
    return '<div class="card ' + d.type + (o.iced ? ' iced' : '') + '" style="--sb:' + s.b + ';--sbg:' + s.bg + ';--sab:' + s.ab + '">' +
      '<div class="hd">' + costHTML(d.type, o.cost != null ? o.cost : d.cost, o.costMode, o.season) + '<div class="nm">' + esc(d.name) + '</div></div>' +
      '<div class="art"><div>' + (ART[id] || '') + '</div></div>' +
      '<div class="tl">' + tl + '</div><div class="tx">' + tx + '</div>' + ft +
      (flags ? '<div class="flag">' + flags + '</div>' : '') + '</div>';
  }
  function mini(html, w, scale) { return '<div class="mini" style="width:' + w + 'px;height:' + Math.round(204 * scale) + 'px"><div style="transform:scale(' + scale + ')">' + html + '</div></div>'; }

  /* ---------- Dialoge ---------- */
  const modal = $('#modal');
  function openModal(html, bind) {
    modal.innerHTML = '<div class="box" role="dialog" aria-modal="true">' + html + '</div>';
    modal.hidden = false;
    if (bind) bind(modal);
    const f = modal.querySelector('button, input, select'); if (f) f.focus();
  }
  function closeModal() { modal.hidden = true; modal.innerHTML = ''; }
  modal.addEventListener('click', function (e) { if (e.target === modal && !modal.dataset.locked) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden && !modal.dataset.locked) closeModal(); });
  function confirmBox(title, text, buttons) {
    return new Promise(function (res) {
      openModal('<h2>' + esc(title) + '</h2><p>' + esc(text) + '</p><div class="modal-actions">' +
        buttons.map(function (b, i) { return '<button type="button" class="btn ' + (b.cls || '') + '" data-i="' + i + '">' + esc(b.label) + '</button>'; }).join('') + '</div>',
      function (m) { m.querySelectorAll('[data-i]').forEach(function (b) { b.onclick = function () { closeModal(); res(buttons[+b.dataset.i].value); }; }); });
    });
  }
  function promptBox(title, value) {
    return new Promise(function (res) {
      openModal('<h2>' + esc(title) + '</h2><input class="field-input" id="pIn" maxlength="60" value="' + esc(value || '') + '"><div class="modal-actions"><button class="btn" data-a="no">Abbrechen</button><button class="btn primary" data-a="ok">OK</button></div>',
        function (m) {
          const inp = $('#pIn', m);
          m.querySelector('[data-a=no]').onclick = function () { closeModal(); res(null); };
          m.querySelector('[data-a=ok]').onclick = function () { const v = inp.value.trim(); closeModal(); res(v || null); };
          inp.onkeydown = function (e) { if (e.key === 'Enter') m.querySelector('[data-a=ok]').click(); };
        });
    });
  }

  /* ---------- Bildschirme ---------- */
  function show(id) {
    ['gate', 'menu', 'decks', 'game'].forEach(function (x) { $('#' + x).hidden = x !== id; });
    document.body.style.overflow = id === 'game' ? 'hidden' : '';
  }

  /* ---------- Passwort ---------- */
  function hasAccess() { try { return localStorage.getItem(ACCESS_KEY) === 'ok'; } catch (e) { return false; } }
  $('#gateForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if ($('#gatePw').value.trim().toLowerCase() === PASSWORD) {
      try { localStorage.setItem(ACCESS_KEY, 'ok'); } catch (er) {}
      openMenu();
    } else { $('#gateErr').textContent = 'Das Passwort stimmt nicht.'; }
  });

  /* ---------- Decks laden ---------- */
  let DECKS = null, OFFLINE = false;
  function loadDecks() {
    return STORE.loadDecks(S.player).then(function (d) { DECKS = d; OFFLINE = false; })
      .catch(function (err) { console.warn(err); DECKS = STORE.offlineDecks(); OFFLINE = true; });
  }
  function deckById(id) { return (DECKS || []).filter(function (d) { return d.id === id; })[0]; }

  /* ---------- Startmenü ---------- */
  function opt(key, label, choices) {
    return '<div class="opt"><label for="o-' + key + '">' + label + '</label><select id="o-' + key + '" data-k="' + key + '">' +
      choices.map(function (c) { return '<option value="' + esc(c[0]) + '"' + (String(S[key]) === String(c[0]) ? ' selected' : '') + (c[2] ? ' disabled' : '') + '>' + esc(c[1]) + '</option>'; }).join('') + '</select></div>';
  }
  function num(key, label, min, max) { return '<div class="opt"><label for="o-' + key + '">' + label + '</label><input type="number" id="o-' + key + '" data-k="' + key + '" data-num="1" min="' + min + '" max="' + max + '" value="' + S[key] + '"></div>'; }
  function chk(key, label) { return '<div class="opt"><span class="lbl">&nbsp;</span><label class="check"><input type="checkbox" data-k="' + key + '"' + (S[key] ? ' checked' : '') + '> ' + label + '</label></div>'; }

  function openMenu() {
    show('menu');
    const root = $('#menu');
    const deckOpts = (DECKS || []).map(function (d) { return [d.id, d.name + ' (' + d.cards.length + ')']; });
    if (DECKS && !deckById(S.myDeck) && DECKS.length) { S.myDeck = DECKS[0].id; saveSettings(); }
    root.innerHTML = '<div class="page">' +
      '<div class="topbar"><a class="iconbtn" href="../" aria-label="Zurück zum Game Hub">' + ICON.door + '</a><h1>' + GAME_NAME + '</h1></div>' +
      '<div class="hero"><div style="width:84px;height:84px;flex:none">' + ICON.wheel + '</div><div><h2 style="font-size:24px">Das Duell der Jahreszeiten</h2><p>Testphase: Spiele gegen den Computer und probiere Regeln aus.</p></div></div>' +
      (OFFLINE ? '<div class="banner">Der Server ist gerade nicht erreichbar. Du kannst mit den Startdecks spielen, Änderungen an Decks werden aber nicht gespeichert.</div>' : '') +
      '<div class="menu-actions"><button class="btn primary" id="mPlay" style="min-width:160px">Spielen</button><button class="btn" id="mDecks">Decks</button><button class="btn" id="mRules">Regeln</button></div>' +
      '<div class="panel" style="margin-bottom:16px"><div class="opts" style="margin-top:0">' +
      (DECKS ? opt('myDeck', 'Dein Deck', deckOpts) : '<div class="opt"><span class="lbl">Dein Deck</span><span class="note">Decks werden geladen …</span></div>') +
      opt('difficulty', 'Schwierigkeit', [['easy', 'Leicht'], ['medium', 'Mittel'], ['hard', 'Schwer']]) +
      '</div><p class="note" id="mWarn" style="margin:10px 0 0"></p></div>' +
      '<details class="panel" id="mOpts"><summary>Testoptionen</summary><div class="opts">' +
      '<div class="group-title">Gegner</div>' +
      opt('aiDeck', 'Deck des Computers', [['random', 'Zufällig'], ['spring', 'Frühlings-Startdeck'], ['summer', 'Sommer-Startdeck'], ['autumn', 'Herbst-Startdeck'], ['winter', 'Winter-Startdeck']]) +
      opt('first', 'Wer beginnt', [['random', 'Zufällig'], ['me', 'Du'], ['ai', 'Computer']]) +
      '<div class="group-title">Zeit</div>' +
      opt('startSeason', 'Startjahreszeit', [['spring', 'Frühling'], ['summer', 'Sommer'], ['autumn', 'Herbst'], ['winter', 'Winter'], ['random', 'Zufällig']]) +
      opt('turnMode', 'Zugmodus', [['alternate', 'Abwechselnd'], ['simultaneous', 'Gleichzeitig (kommt später)', true]]) +
      '<div class="group-title">Feld</div>' +
      opt('fieldMode', 'Feldgröße', [['grow', 'Wachsend 5 → 7'], ['7', 'Immer 7'], ['5', 'Immer 5']]) +
      opt('growAt', 'Wachstum', [['spring2', 'Im zweiten Frühling'], ['round5', 'Fest in Runde 5']]) +
      '<div class="group-title">Werte</div>' +
      num('life', 'Lebenskraft', 1, 99) + num('deckSize', 'Deckgröße', 5, 60) + num('startHand', 'Starthand', 0, 10) + num('handLimit', 'Handlimit', 1, 20) +
      opt('copies', 'Kopien pro Karte', [[1, '1'], [2, '2'], [3, '3']]) +
      '<div class="group-title">Regeln</div>' +
      chk('mulligan', 'Starthand neu mischen erlauben') + chk('overwriteHolder', 'Platzhalter darf belegt werden') +
      opt('compensation', 'Ausgleich zweiter Spieler', [['none', 'Keiner'], ['card', '+1 Karte'], ['energy', '+1 Energie in Runde 1']]) +
      chk('allowIncomplete', 'Unvollständige Decks erlauben') +
      '<div class="group-title">Ansicht und Spieler</div>' +
      opt('cardBack', 'Kartenrückseite', [['jahreskreis', 'Jahreskreis'], ['more', 'Weitere Designs folgen', true]]) +
      '<div class="opt"><label for="o-player">Spielername (für deine Decks)</label><input class="field-input" id="o-player" value="' + esc(S.player) + '" maxlength="40"></div>' +
      '</div><div style="margin-top:16px"><button class="btn small" id="mReset">Standard wiederherstellen</button></div></details>' +
      '</div>';
    root.querySelectorAll('[data-k]').forEach(function (el) {
      el.addEventListener('change', function () {
        const k = el.dataset.k;
        if (el.type === 'checkbox') S[k] = el.checked;
        else if (el.dataset.num) S[k] = Math.max(+el.min, Math.min(+el.max, parseInt(el.value, 10) || DEFAULTS[k]));
        else S[k] = k === 'copies' ? +el.value : el.value;
        saveSettings(); updateWarn();
      });
    });
    $('#o-player').addEventListener('change', function () {
      const v = $('#o-player').value.trim().toLowerCase();
      if (!v || v === S.player) return;
      S.player = v; S.myDeck = null; saveSettings(); DECKS = null; openMenu(); loadDecks().then(openMenu);
    });
    $('#mReset').onclick = function () { const p = S.player, d = S.myDeck; S = Object.assign({}, DEFAULTS, { player: p, myDeck: d }); saveSettings(); openMenu(); $('#mOpts').open = true; };
    $('#mPlay').onclick = startGame;
    $('#mDecks').onclick = function () { openDecks(); };
    $('#mRules').onclick = showRules;
    updateWarn();
  }
  function deckProblem(deck) {
    if (!deck) return 'Bitte wähle ein Deck.';
    if (deck.cards.length !== S.deckSize && !S.allowIncomplete) return 'Dein Deck hat ' + deck.cards.length + ' statt ' + S.deckSize + ' Karten. Ergänze es in der Deckverwaltung oder erlaube unvollständige Decks in den Testoptionen.';
    if (!deck.cards.length) return 'Dein Deck ist leer.';
    return '';
  }
  function updateWarn() {
    const w = $('#mWarn'); if (!w) return;
    if (!DECKS) { w.textContent = ''; return; }
    w.textContent = deckProblem(deckById(S.myDeck));
    w.className = w.textContent ? 'warn' : 'note';
  }

  function showRules() {
    openModal('<h2>Kurzregeln</h2><div style="display:flex;flex-direction:column;gap:8px">' +
      '<p><b>Ziel:</b> Bring die Lebenskraft deines Gegners auf 0.</p>' +
      '<p><b>Runden:</b> Jede Runde ist eine Jahreszeit (Frühling, Sommer, Herbst, Winter). Beide Spieler sind einmal am Zug. Die Energie wächst jede Runde um 1, bis 8.</p>' +
      '<p><b>Kosten:</b> In ihrer Heimat-Jahreszeit kostet eine Karte 1 weniger, in der gegenüberliegenden 1 mehr.</p>' +
      '<p><b>Kampf:</b> Werte sind fest. Ist der Angriff mindestens so hoch wie die Verteidigung, wird das Ziel zerstört. Der Verteidiger schlägt zurück, zerstört aber nie: Sein Überschuss geht von deiner Lebenskraft ab. Steht dir gegenüber eine Karte, musst du sie angreifen. Sonst zuerst Wächter. Den Spieler direkt angreifen geht nur, wenn er keine angreifbaren Einheiten hat. Neue Einheiten greifen erst im nächsten Zug an.</p>' +
      '<p><b>Frühling:</b> Eine Karte darf verschoben werden. Im Frühling gespielte Karten erhalten ab dem Sommer +1 Verteidigung.</p>' +
      '<p><b>Sommer:</b> Im Sommer gespielte Einheiten haben Eile. Der mittlere Platz ist der Sonnenplatz (+2 Angriff).</p>' +
      '<p><b>Herbst:</b> Du ziehst eine Karte mehr. Im Herbst zerstörte Einheiten werden Platzhalter und kehren im Frühling mit halben Werten und ohne Fähigkeiten zurück.</p>' +
      '<p><b>Winter:</b> Die äußeren Plätze frieren ein (nicht spielbar, Karten dort können weder angreifen noch angegriffen werden). Einheiten ohne Winter-Heimat haben −1 Verteidigung.</p>' +
      '<p><b>Bedienung:</b> Karte antippen, dann Ziel antippen. Rechtsklick oder langes Drücken zeigt die Großansicht.</p>' +
      '</div><div class="modal-actions"><button class="btn primary" id="rOk">Verstanden</button></div>', function (m) { $('#rOk', m).onclick = closeModal; });
  }

  /* ---------- Deckverwaltung ---------- */
  function seasonDist(cards) {
    const n = { spring: 0, summer: 0, autumn: 0, winter: 0, none: 0 };
    cards.forEach(function (id) { if (BY_ID[id]) n[BY_ID[id].season]++; });
    return n;
  }
  function openDecks() {
    show('decks');
    const root = $('#decks');
    if (!DECKS) { root.innerHTML = '<div class="page"><p>Decks werden geladen …</p></div>'; loadDecks().then(openDecks); return; }
    root.innerHTML = '<div class="page"><div class="topbar"><button class="iconbtn" id="dBack" aria-label="Zurück zum Menü">' + ICON.door + '</button><h1>Decks</h1></div>' +
      (OFFLINE ? '<div class="banner">Der Server ist nicht erreichbar, Änderungen sind gerade nicht möglich.</div>' : '') +
      '<div class="menu-actions"><button class="btn primary" id="dNew"' + (OFFLINE ? ' disabled' : '') + '>Neues Deck</button><button class="btn" id="dRestore"' + (OFFLINE ? ' disabled' : '') + '>Startdecks wiederherstellen</button></div>' +
      '<div class="decklist">' + DECKS.map(function (d) {
        const n = seasonDist(d.cards); const tot = d.cards.length || 1;
        return '<div class="deck"><h3>' + esc(d.name) + '</h3><div class="meta">' + d.cards.length + ' / ' + S.deckSize + ' Karten' + (d.starter_key ? ' · Startdeck' : '') + (S.myDeck === d.id ? ' · gewählt' : '') + '</div>' +
          '<div class="dist">' + ['spring', 'summer', 'autumn', 'winter', 'none'].map(function (k) { return '<span style="width:' + (n[k] / tot * 100) + '%;background:' + SC[k].b + '"></span>'; }).join('') + '</div>' +
          '<div class="acts"><button class="btn small" data-a="edit" data-id="' + d.id + '"' + (OFFLINE ? ' disabled' : '') + '>Bearbeiten</button><button class="btn small" data-a="pick" data-id="' + d.id + '">Wählen</button><button class="btn small" data-a="dup" data-id="' + d.id + '"' + (OFFLINE ? ' disabled' : '') + '>Duplizieren</button><button class="btn small" data-a="ren" data-id="' + d.id + '"' + (OFFLINE ? ' disabled' : '') + '>Umbenennen</button><button class="btn small danger" data-a="del" data-id="' + d.id + '"' + (OFFLINE ? ' disabled' : '') + '>Löschen</button></div></div>';
      }).join('') + '</div></div>';
    $('#dBack').onclick = openMenu;
    $('#dNew').onclick = function () { editDeck({ id: null, name: 'Neues Deck', cards: [], starter_key: null }); };
    $('#dRestore').onclick = function () {
      STORE.seedStarters(S.player, DECKS).then(loadDecks).then(openDecks).catch(fail);
    };
    root.querySelectorAll('[data-a]').forEach(function (b) {
      b.onclick = function () {
        const d = deckById(b.dataset.id);
        if (b.dataset.a === 'edit') editDeck(JSON.parse(JSON.stringify(d)));
        else if (b.dataset.a === 'pick') { S.myDeck = d.id; saveSettings(); openDecks(); }
        else if (b.dataset.a === 'dup') STORE.createDeck(S.player, d.name + ' (Kopie)', d.cards, null).then(loadDecks).then(openDecks).catch(fail);
        else if (b.dataset.a === 'ren') promptBox('Deck umbenennen', d.name).then(function (v) { if (v) STORE.updateDeck(d.id, { name: v }).then(loadDecks).then(openDecks).catch(fail); });
        else if (b.dataset.a === 'del') confirmBox('Deck löschen?', '„' + d.name + '“ wird endgültig gelöscht.', [{ label: 'Abbrechen', value: false }, { label: 'Löschen', value: true, cls: 'danger' }])
          .then(function (ok) { if (ok) STORE.deleteDeck(d.id).then(function () { if (S.myDeck === d.id) { S.myDeck = null; saveSettings(); } }).then(loadDecks).then(openDecks).catch(fail); });
      };
    });
  }
  function fail(err) { console.error(err); confirmBox('Das hat nicht geklappt', 'Der Server hat die Änderung nicht angenommen. Bitte versuche es noch einmal.', [{ label: 'OK', value: true, cls: 'primary' }]); }

  function editDeck(deck) {
    const F = { season: 'all', type: 'all', cost: 'all', q: '' };
    const root = $('#decks');
    function count(id) { return deck.cards.filter(function (x) { return x === id; }).length; }
    function draw() {
      const pool = C.CARDS.filter(function (c) {
        return (F.season === 'all' || c.season === F.season) && (F.type === 'all' || c.type === F.type) && (F.cost === 'all' || String(c.cost) === F.cost) &&
          (!F.q || c.name.toLowerCase().indexOf(F.q) >= 0);
      });
      const sorted = deck.cards.slice().sort(function (a, b) { return BY_ID[a].cost - BY_ID[b].cost || BY_ID[a].name.localeCompare(BY_ID[b].name); });
      const curve = []; for (let i = 0; i <= 9; i++) curve.push(0);
      deck.cards.forEach(function (id) { curve[Math.min(9, BY_ID[id].cost)]++; });
      const maxC = Math.max.apply(null, curve.concat([1]));
      const full = deck.cards.length >= S.deckSize;
      const chips = function (key, list) { return list.map(function (x) { return '<button class="fchip' + (F[key] === x[0] ? ' on' : '') + '" data-f="' + key + '" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join(''); };
      root.innerHTML = '<div class="page"><div class="topbar"><button class="iconbtn" id="eBack" aria-label="Zurück zu den Decks">' + ICON.door + '</button><h1 style="font-size:26px">Deck bearbeiten</h1></div>' +
        '<div class="editor"><div>' +
        '<div class="filters">' + chips('season', [['all', 'Alle'], ['spring', 'Frühling'], ['summer', 'Sommer'], ['autumn', 'Herbst'], ['winter', 'Winter'], ['none', 'Neutral']]) + '</div>' +
        '<div class="filters">' + chips('type', [['all', 'Alle Typen'], ['unit', 'Einheiten'], ['spell', 'Zauber'], ['field', 'Feldzauber']]) +
        '<select class="field-input" id="fCost" style="width:auto;min-height:36px"><option value="all">Alle Kosten</option>' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (i) { return '<option value="' + i + '"' + (F.cost === String(i) ? ' selected' : '') + '>Kosten ' + i + '</option>'; }).join('') + '</select>' +
        '<input class="field-input" id="fQ" placeholder="Suche" style="width:160px;min-height:36px" value="' + esc(F.q) + '" aria-label="Karten suchen"></div>' +
        '<div class="pool">' + pool.map(function (c) {
          const n = count(c.id); const maxed = n >= S.copies;
          return '<button class="pc' + (maxed ? ' maxed' : '') + '" data-add="' + c.id + '" aria-label="' + esc(c.name) + ' hinzufügen">' + (n ? '<span class="cnt">' + n + '</span>' : '') + '<div class="sc">' + cardHTML(c.id) + '</div></button>';
        }).join('') + '</div><p class="note">Antippen fügt eine Karte hinzu, Rechtsklick oder langes Drücken zeigt die Großansicht.</p></div>' +
        '<div class="panel decklist-side"><div class="opt"><label for="eName">Name</label><input class="field-input" id="eName" maxlength="60" value="' + esc(deck.name) + '"></div>' +
        '<div style="margin-top:10px;font-weight:700">' + deck.cards.length + ' / ' + S.deckSize + ' Karten</div>' +
        (deck.cards.length !== S.deckSize ? '<div class="warn">' + (deck.cards.length < S.deckSize ? 'Es fehlen ' + (S.deckSize - deck.cards.length) + ' Karten.' : 'Zu viele Karten.') + ' Du kannst trotzdem speichern.</div>' : '') +
        '<div class="curve" aria-label="Kostenkurve">' + curve.map(function (v, i) { return '<div><span>' + (v || '') + '</span><i style="height:' + (v / maxC * 46) + 'px"></i><span>' + i + '</span></div>'; }).join('') + '</div>' +
        '<div class="dl">' + sorted.map(function (id) { const d = BY_ID[id]; return '<button data-rm="' + id + '"><span class="c" style="background:' + SC[d.season].b + '">' + d.cost + '</span>' + esc(d.name) + '<span class="x" aria-hidden="true">✕</span></button>'; }).join('') + '</div>' +
        '<div class="modal-actions" style="justify-content:stretch"><button class="btn" id="eCancel">Abbrechen</button><button class="btn primary" id="eSave">Speichern</button></div></div></div></div>';
      root.querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { F[b.dataset.f] = b.dataset.v; draw(); }; });
      $('#fCost').onchange = function () { F.cost = $('#fCost').value; draw(); };
      $('#fQ').oninput = function () { F.q = $('#fQ').value.trim().toLowerCase(); const pos = $('#fQ').selectionStart; draw(); const q = $('#fQ'); q.focus(); q.setSelectionRange(pos, pos); };
      $('#eName').oninput = function () { deck.name = $('#eName').value; };
      root.querySelectorAll('[data-add]').forEach(function (b) {
        b.onclick = function () {
          const id = b.dataset.add;
          if (count(id) >= S.copies) return;
          if (deck.cards.length >= S.deckSize) { confirmBox('Deck ist voll', 'Entferne zuerst eine Karte (rechts antippen).', [{ label: 'OK', value: 1, cls: 'primary' }]); return; }
          deck.cards.push(id); draw();
        };
        longPress(b, function () { showDetail({ id: b.dataset.add }); });
      });
      root.querySelectorAll('[data-rm]').forEach(function (b) { b.onclick = function () { deck.cards.splice(deck.cards.indexOf(b.dataset.rm), 1); draw(); }; });
      $('#eBack').onclick = openDecks; $('#eCancel').onclick = openDecks;
      $('#eSave').onclick = save;
    }
    function save() {
      const name = (deck.name || '').trim() || 'Unbenanntes Deck';
      let p;
      if (!deck.id) p = STORE.createDeck(S.player, name, deck.cards, null);
      else if (deck.starter_key) {
        p = confirmBox('Startdeck bearbeiten', 'Möchtest du das Startdeck selbst ändern oder deine Änderungen als Kopie speichern?', [{ label: 'Abbrechen', value: 'no' }, { label: 'Als Kopie', value: 'copy' }, { label: 'Original ändern', value: 'orig', cls: 'primary' }])
          .then(function (v) {
            if (v === 'copy') return STORE.createDeck(S.player, name === deck.origName ? name + ' (bearbeitet)' : name, deck.cards, null);
            if (v === 'orig') return STORE.updateDeck(deck.id, { name: name, cards: deck.cards });
            return 'cancel';
          });
      } else p = STORE.updateDeck(deck.id, { name: name, cards: deck.cards });
      p.then(function (r) { if (r === 'cancel') return; return loadDecks().then(openDecks); }).catch(fail);
    }
    deck.origName = deck.name;
    draw();
  }

  function longPress(el, fn) {
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); fn(); });
    let t = null;
    el.addEventListener('touchstart', function () { t = setTimeout(function () { t = 'done'; fn(); }, 550); }, { passive: true });
    el.addEventListener('touchend', function (e) { if (t === 'done') e.preventDefault(); else clearTimeout(t); t = null; });
    el.addEventListener('touchmove', function () { clearTimeout(t); t = null; }, { passive: true });
  }

  /* =================== Spiel =================== */
  let G = null;
  const stage = $('#stage');
  function fit() {
    const w = window.innerWidth, h = window.innerHeight;
    const s = Math.min(w / 1280, h / 720);
    stage.style.transform = 'scale(' + s + ')';
    stage.style.left = ((w - 1280 * s) / 2) + 'px';
    stage.style.top = ((h - 720 * s) / 2) + 'px';
  }
  window.addEventListener('resize', fit);

  function shuffleArr(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  function aiDeckCards() {
    let k = S.aiDeck;
    if (C.SEASONS.indexOf(k) < 0) k = C.SEASONS[Math.floor(Math.random() * 4)];
    let cards = C.STARTER_DECKS[k].cards.slice();
    if (S.deckSize < cards.length) cards = shuffleArr(cards).slice(0, S.deckSize);
    while (cards.length < S.deckSize) cards.push(cards[cards.length % C.STARTER_DECKS[k].cards.length]);
    return { key: k, cards: cards };
  }
  function startGame() {
    const deck = deckById(S.myDeck);
    const prob = deckProblem(deck);
    if (!DECKS) return;
    if (prob) { updateWarn(); confirmBox('Deck nicht spielbereit', prob, [{ label: 'OK', value: 1, cls: 'primary' }]); return; }
    const ai = aiDeckCards();
    const cfg = { life: S.life, deckSize: S.deckSize, startHand: S.startHand, handLimit: S.handLimit, fieldMode: S.fieldMode, growAt: S.growAt,
      startSeason: S.startSeason, overwriteHolder: S.overwriteHolder, compensation: S.compensation };
    const first = S.first === 'me' ? 0 : S.first === 'ai' ? 1 : undefined;
    const state = E.newGame(cfg, [deck.cards, ai.cards], { first: first, names: ['Du', 'Computer'] });
    G = { state: state, sel: null, pending: null, busy: false, seen: 0, aiDeck: ai.key, toast: '' };
    show('game'); fit();
    G.seen = state.log.length;
    toast(state.log.map(function (l) { return l.text; }).join(' · '));
    if (S.mulligan) mulliganDialog(); else afterStart();
  }
  function afterStart() { render(); if (G.state.current === 1) aiTurn(); else toast('Du bist am Zug.'); }
  function mulliganDialog() {
    const pl = G.state.players[0];
    const off = {};
    function draw() {
      openModal('<h2>Starthand</h2><p>Tippe Karten an, die du zurücklegen und neu ziehen möchtest (einmalig).</p><div class="mull">' +
        pl.hand.map(function (c, i) { return '<button class="hc' + (off[i] ? ' off' : '') + '" data-i="' + i + '"><div class="sc">' + cardHTML(c.id) + '</div></button>'; }).join('') +
        '</div><div class="modal-actions"><button class="btn" id="mKeep">Behalten</button><button class="btn primary" id="mSwap">Ausgewählte tauschen</button></div>',
      function (m) {
        m.querySelectorAll('[data-i]').forEach(function (b) { b.onclick = function () { off[b.dataset.i] = !off[b.dataset.i]; draw(); }; });
        $('#mKeep', m).onclick = function () { modal.dataset.locked = ''; closeModal(); afterStart(); };
        $('#mSwap', m).onclick = function () {
          const idx = Object.keys(off).filter(function (k) { return off[k]; }).map(Number);
          E.mulligan(G.state, 0, idx); delete modal.dataset.locked; closeModal(); afterStart();
        };
      });
      modal.dataset.locked = '1';
    }
    render(); draw();
  }

  /* ---------- Darstellung ---------- */
  function unitView(st, u, s) {
    const d = BY_ID[u.id];
    const v = E.stats(st, u, s);
    const bAtk = d.atk, bDef = d.def; // Vergleich mit den aufgedruckten Werten, damit halbierte Rückkehrer sichtbar sind
    const flags = [];
    if (u.entombed) flags.push('Im Eis');
    else if (E.isIced(st, u, s)) flags.push('Eis');
    if (E.hibernating(st, u, s)) flags.push('Winterschlaf');
    if (u.freezeTurn && u.freezeTurn >= st.T) flags.push('Eingefroren');
    if (E.isGuard(st, u, s) && d.kw.indexOf('guard') < 0) flags.push('Wächter');
    if (u.noAbil) flags.push(u.halfStats ? 'Rückkehrer ½' : 'Rückkehrer');
    return { atk: v.atk, def: v.def, atkMode: v.atk > bAtk ? 'up' : v.atk < bAtk ? 'down' : '', defMode: v.def > bDef ? 'up' : v.def < bDef ? 'down' : '',
      noAbil: u.noAbil, iced: E.isIced(st, u, s), flags: flags, cost: d.cost };
  }
  function legal() { return G && G.state.current === 0 && !G.busy && G.state.winner === null ? E.legalActions(G.state) : []; }
  function candidates() {
    const acts = legal();
    if (!G.sel) return [];
    if (G.sel.hand != null) return acts.filter(function (a) { return a.t === 'play' && a.h === G.sel.hand; });
    if (G.sel.unit != null) return acts.filter(function (a) { return a.a === G.sel.unit; });
    return [];
  }
  /* Ziele, die jetzt angeklickt werden können: Schlüssel 'slot:p:s', 'player:p', 'fz:0' */
  function targetKeys() {
    const keys = {};
    const st = G.state;
    if (G.pending) {
      G.pending.acts.forEach(function (a) { if (a.target != null) { const f = E.findUnit(st, a.target); if (f) keys['slot:' + f.p + ':' + f.s] = a; } });
      return keys;
    }
    candidates().forEach(function (a) {
      if (a.t === 'play') {
        const d = BY_ID[st.players[0].hand[a.h].id];
        if (d.type === 'unit') { if (!keys['slot:0:' + a.slot]) keys['slot:0:' + a.slot] = a; }
        else if (d.type === 'field') keys['fz:0'] = a;
        else if (typeof a.target === 'string') keys['slot:0:' + a.target.slice(1)] = a;
        else { const f = E.findUnit(st, a.target); if (f) keys['slot:' + f.p + ':' + f.s] = a; }
      } else if (a.t === 'attack') {
        if (a.target === 'player') keys['player:1'] = a;
        else { const f = E.findUnit(st, a.target); if (f) keys['slot:' + f.p + ':' + f.s] = a; }
      } else if (a.t === 'move') keys['slot:0:' + a.slot] = a;
    });
    return keys;
  }

  function render() {
    if (!G) return;
    const st = G.state;
    const band = E.seasonBand(st);
    const nowI = band.findIndex(function (b) { return b.pos === 'now'; });
    const CY = C.SEASONS;
    const prev = nowI > 0 ? band[nowI - 1].season : CY[(CY.indexOf(st.season) + 3) % 4];
    const next = band[nowI + 1] ? band[nowI + 1].season : CY[(CY.indexOf(st.season) + 1) % 4];
    const tk = targetKeys();
    const legalNow = legal();
    const canUids = {};
    legalNow.forEach(function (a) { if ((a.t === 'attack' || a.t === 'sacrifice' || a.t === 'move') && a.a != null) canUids[a.a] = true; });
    const affordable = {};
    legalNow.forEach(function (a) { if (a.t === 'play') affordable[a.h] = true; });
    const me = st.players[0], op = st.players[1];

    function statsBox(p) {
      const pl = st.players[p];
      const key = 'player:' + p;
      return '<button class="stats' + (st.current === p && st.winner === null ? ' turn' : '') + (tk[key] ? ' tgt' : '') + '" data-k="' + key + '" aria-label="' + esc(pl.name) + ': ' + pl.life + ' Lebenskraft">' +
        '<span class="who">' + (p === 0 ? 'Du' : 'Computer') + (st.current === p && st.winner === null ? ' · am Zug' : '') + '</span>' +
        '<span class="life">' + ICON.heart + Math.max(0, pl.life) + '</span><span class="en">' + ICON.bolt + 'Energie ' + pl.energy + ' / ' + Math.min(st.cfg.maxEnergy, st.round) + '</span></button>';
    }
    function slots(p) {
      const pl = st.players[p];
      const act = E.activeSlots(st);
      let h = '<div class="slots">';
      for (let s = 0; s < 7; s++) {
        const key = 'slot:' + p + ':' + s;
        if (act.indexOf(s) < 0) { h += '<div class="slot inactive"></div>'; continue; }
        const sl = pl.field[s];
        const frozen = st.season === 'winter' && E.isOuter(st, s);
        const sun = E.sunBonus(st, s) > 0;
        let cls = 'slot' + (sun ? ' sun' : '') + (tk[key] ? ' tgt' : '');
        let inner = '';
        if (sl && sl.u) {
          if (G.sel && G.sel.unit === sl.u.uid) cls += ' sel';
          else if (p === 0 && canUids[sl.u.uid] && !tk[key]) cls += ' can';
          inner = '<div class="sc">' + cardHTML(sl.u.id, unitView(st, sl.u, s)) + '</div>';
        } else if (sl && sl.holder) {
          inner = '<div class="holder"><svg width="34" height="22" viewBox="0 0 24 12" aria-hidden="true"><path d="M1 6 Q12 -4 23 6 Q12 16 1 6 Z" fill="#E2A13A"/><path d="M1 6 L23 6" stroke="#7A3F22" stroke-width="1"/></svg><b>' + esc(BY_ID[sl.holder.id].name) + '</b><span>' + (sl.full ? 'kehrt voll zurück' : 'kehrt im Frühling zurück') + '</span></div>';
        } else cls += frozen ? ' frozen' : ' empty';
        const tag = frozen ? 'Eis' : sun ? 'Sonnenplatz' + (E.sunBonus(st, s) === 1 ? ' +1' : '') : '';
        h += '<button class="' + cls + '" data-k="' + key + '">' + inner + (tag && p === 0 ? '<span class="tag">' + tag + '</span>' : '') + '</button>';
      }
      return h + '</div>';
    }
    function piles(p) {
      const pl = st.players[p];
      const top = pl.discard[pl.discard.length - 1];
      return '<div class="piles"><div class="pile"><div class="stack">' + (pl.deck.length ? mini(backHTML(), 50, 0.357) : '') + '</div>Deck ' + pl.deck.length + '</div>' +
        '<button class="pile" data-k="discard:' + p + '">' + (top ? '<div class="stack">' + mini(cardHTML(top), 50, 0.357) + '</div>' : '<div class="emptypile"></div>') + 'Ablage ' + pl.discard.length + '</button></div>';
    }
    function fz(p) {
      const f = st.players[p].fieldSpell;
      const key = 'fz:' + p;
      const box = '<div class="slotfz' + (f ? '' : ' emptyfz') + (tk[key] ? ' tgt' : '') + '">' + (f ? mini(cardHTML(f.id), 63, 0.45) : '') + '</div>';
      const lbl = '<span style="width:76px' + (p === 0 ? ';text-align:right' : '') + '">' + (p === 0 ? 'Dein Feldzauber' : 'Feldzauber Gegner') + '</span>';
      return '<button class="fz" data-k="' + key + '">' + (p === 1 ? box + lbl : lbl + box) + '</button>';
    }
    const chips = band.map(function (b, i) {
      const far = Math.abs(i - nowI) >= 2;
      return '<div class="chip ' + b.pos + (far ? ' far' : '') + '" style="background:' + COSTBG[b.season] + '">' + SN[b.season] + '<small>' + (b.pos === 'now' ? 'jetzt · ' : '') + 'Runde ' + b.round + '</small></div>';
    });
    const info = { spring: 'Verschieben: 1 Karte · Aufblühen', summer: 'Lange Tage: Eile · Sonnenplatz +2', autumn: 'Ernte: +1 Karte · Vergänglichkeit', winter: 'Eis auf den Außenplätzen · Frost −1' }[st.season];

    const hand = me.hand.map(function (c, h) {
      const cst = E.costOf(st, c.id);
      const sel = G.sel && G.sel.hand === h;
      return '<button class="hc' + (sel ? ' sel' : '') + (affordable[h] || st.current !== 0 ? '' : ' unaff') + '" data-k="hand:' + h + '" aria-label="' + esc(BY_ID[c.id].name) + ', kostet ' + cst.cost + '"><div class="sc">' +
        cardHTML(c.id, { cost: cst.cost, costMode: cst.delta ? 'season' : '', season: st.season }) + '</div></button>';
    }).join('');

    const ctl = controls();
    stage.style.background = DECOR.background(prev, st.season, next);
    stage.innerHTML = DECOR.svg(prev, st.season, next) +
      '<div class="watermark">' + SN[st.season] + '</div>' +
      '<div class="topbtns"><button class="iconbtn" data-k="btn:menu" aria-label="Zum Menü">' + ICON.door + '</button><button class="iconbtn" data-k="btn:log" aria-label="Verlauf">' + ICON.list + '</button><button class="iconbtn" data-k="btn:rules" aria-label="Regeln">' + ICON.book + '</button></div>' +
      '<div class="layer">' +
      '<div class="opp-hand">' + op.hand.map(function () { return mini(backHTML(), 36, 0.2572); }).join('') + '<span style="margin-left:8px">Gegner: ' + op.hand.length + ' Handkarten</span></div>' +
      '<div class="row">' + statsBox(1) + slots(1) + piles(1) + '</div>' +
      '<div class="strip">' + fz(1) + '<div class="band"><div class="chips">' + chips.join('') + '</div><div class="bandinfo">Jahr ' + st.year + ' · ' + info + '</div></div>' + fz(0) + '</div>' +
      '<div class="row">' + statsBox(0) + slots(0) + piles(0) + '</div>' +
      '<div class="handrow"><div class="hint">' + ctl.hint + '</div>' + hand + '<div class="side-actions">' + ctl.buttons + '</div></div>' +
      '</div>' +
      '<div class="toast" id="toast" style="opacity:' + (G.toast ? 1 : 0) + '">' + esc(G.toast) + '</div>';
  }

  function controls() {
    const st = G.state;
    const b = [];
    let hint = '';
    if (st.winner !== null) hint = 'Die Partie ist beendet.';
    else if (st.current !== 0 || G.busy) hint = 'Der Computer ist am Zug …';
    else if (G.pending) {
      hint = G.pending.kind === 'boar' ? 'Wähle eine eigene Einheit, die das Wildschwein opfert, oder verzichte.' : 'Wähle die gegnerische Einheit, die eingefroren wird.';
      if (G.pending.kind === 'boar') b.push('<button class="btn small" data-k="btn:noboar">Nicht opfern</button>');
      b.push('<button class="btn small" data-k="btn:cancel">Abbrechen</button>');
    } else if (G.sel) {
      const cand = candidates();
      if (G.sel.hand != null) {
        const c = st.players[0].hand[G.sel.hand]; const d = BY_ID[c.id];
        if (!cand.length) hint = E.costOf(st, c.id).cost > st.players[0].energy ? 'Dafür reicht deine Energie nicht.' : 'Gerade kein gültiges Ziel.';
        else if (d.type === 'unit') hint = 'Wähle einen freien Platz in deiner Reihe.';
        else if (d.type === 'field') { hint = 'Lege den Feldzauber auf deinen Feldzauberplatz.'; b.push('<button class="btn small primary" data-k="btn:field">Feldzauber legen</button>'); }
        else hint = 'Wähle ein Ziel für ' + d.name + '.';
      } else {
        const f = E.findUnit(st, G.sel.unit);
        const atk = cand.filter(function (a) { return a.t === 'attack'; });
        const mv = cand.filter(function (a) { return a.t === 'move'; });
        hint = atk.length ? (atk.some(function (a) { return a.target === 'player'; }) ? 'Greif den Gegner direkt an.' : 'Wähle ein Angriffsziel.') : '';
        if (mv.length) hint += (hint ? ' ' : '') + 'Oder verschiebe die Karte auf einen freien Platz.';
        if (!hint) hint = f && f.inst.playedTurn === st.T ? 'Neue Einheiten greifen erst im nächsten Zug an.' : 'Diese Einheit kann gerade nicht angreifen.';
        if (cand.some(function (a) { return a.t === 'sacrifice'; })) b.push('<button class="btn small" data-k="btn:sacrifice">Opfern (+1 Energie)</button>');
      }
      b.push('<button class="btn small" data-k="btn:detail">Großansicht</button>');
      b.push('<button class="btn small" data-k="btn:cancel">Abbrechen</button>');
    } else hint = 'Tippe eine Handkarte oder eine deiner Einheiten an.';
    if (st.winner === null) b.push('<button class="btn primary" data-k="btn:end"' + (st.current !== 0 || G.busy ? ' disabled' : '') + '>Zug beenden</button>');
    else b.push('<button class="btn primary" data-k="btn:over">Ergebnis</button>');
    return { hint: hint, buttons: b.join('') };
  }

  function toast(text) {
    if (!G) return;
    G.toast = text;
    const t = $('#toast'); if (t) { t.textContent = text; t.style.opacity = text ? 1 : 0; }
    clearTimeout(G.toastTimer);
    G.toastTimer = setTimeout(function () { if (G) { G.toast = ''; const t2 = $('#toast'); if (t2) t2.style.opacity = 0; } }, 3200);
  }
  function newLogText() {
    const st = G.state;
    const items = st.log.slice(G.seen).filter(function (l) { return l.kind !== 'turn'; }).map(function (l) { return l.text; });
    G.seen = st.log.length;
    return items.slice(-3).join(' · ');
  }

  function doAct(a) {
    E.apply(G.state, a);
    G.sel = null; G.pending = null;
    const t = newLogText();
    render(); if (t) toast(t);
    if (G.state.winner !== null) { setTimeout(gameOver, 700); return; }
    if (G.state.current === 1) aiTurn();
  }
  function aiTurn() {
    G.busy = true; render();
    const step = function () {
      if (!G) return;
      const st = G.state;
      if (st.winner !== null) { G.busy = false; render(); setTimeout(gameOver, 700); return; }
      if (st.current !== 1) { G.busy = false; render(); const t = newLogText(); toast((t ? t + ' · ' : '') + 'Du bist am Zug.'); return; }
      const a = AI.choose(st, S.difficulty);
      E.apply(st, a);
      const t = newLogText();
      render(); if (t) toast(t);
      setTimeout(step, a.t === 'end' ? 400 : 900);
    };
    setTimeout(step, 700);
  }
  function gameOver() {
    if (!G) return;
    const st = G.state;
    const t = st.winner === 0 ? 'Gewonnen!' : st.winner === 1 ? 'Verloren' : 'Unentschieden';
    openModal('<h2>' + t + '</h2><p>Die Partie endete in Runde ' + st.round + ' (' + SN[st.season] + ', Jahr ' + st.year + '). Lebenskraft: Du ' + st.players[0].life + ', Computer ' + st.players[1].life + '. Der Computer spielte das ' + C.STARTER_DECKS[G.aiDeck].name + '.</p>' +
      '<div class="modal-actions"><button class="btn" id="goBoard">Spielfeld ansehen</button><button class="btn" id="goMenu">Menü</button><button class="btn primary" id="goAgain">Nochmal</button></div>',
      function (m) { $('#goBoard', m).onclick = closeModal; $('#goMenu', m).onclick = function () { closeModal(); G = null; openMenu(); }; $('#goAgain', m).onclick = function () { closeModal(); startGame(); }; });
  }

  /* ---------- Großansicht ---------- */
  function showDetail(ref) {
    const st = G ? G.state : null;
    let id = ref.id, view = null, statusList = [], stats = null;
    if (ref.uid != null && st) {
      const f = E.findUnit(st, ref.uid);
      if (f) {
        id = f.inst.id; view = unitView(st, f.inst, f.s); stats = E.stats(st, f.inst, f.s);
        statusList = view.flags.slice();
        if (f.inst.pAtk || f.inst.pDef || f.inst.growth) statusList.push('Dauerhafte Boni: ' + (f.inst.pAtk ? '+' + f.inst.pAtk + ' Angriff ' : '') + ((f.inst.pDef || 0) + (f.inst.growth || 0) ? '+' + ((f.inst.pDef || 0) + (f.inst.growth || 0)) + ' Verteidigung' : ''));
        if (f.inst.bloom) statusList.push('Blüht im Sommer auf (+1 Verteidigung)');
      }
    }
    const d = BY_ID[id];
    const curSeason = st ? st.season : null;
    let costView = { cost: d.cost };
    if (st && ref.hand) { const cc = E.costOf(st, id); costView = { cost: cc.cost, costMode: cc.delta ? 'season' : '', season: st.season }; }
    const costs = C.SEASONS.map(function (s) {
      const fake = st ? Object.assign({}, st, { season: s }) : { season: s, players: [] };
      const cc = E.costOf(fake, id).cost;
      return '<span class="' + (s === curSeason ? 'cur' : '') + '" style="background:' + SC[s].bg + ';color:#2A2926">' + SN[s] + ' ' + cc + '</span>';
    }).join('');
    let werte = '';
    if (d.type === 'unit') {
      werte = '<dt>Werte</dt><dd>Angriff ' + (stats ? stats.atk : d.atk) + ' · Verteidigung ' + (stats ? stats.def : d.def) + (stats && stats.mods.length ? '<br><span class="note">' + stats.mods.map(function (m) { return m.why + ' ' + (m.v > 0 ? '+' : '') + m.v + (m.stat === 'atk' ? ' Angriff' : ' Verteidigung'); }).join(', ') + '</span>' : '') + '</dd>';
    }
    openModal('<h2>' + esc(d.name) + '</h2><div class="detail"><div class="big"><div>' + cardHTML(id, Object.assign({}, view || {}, costView)) + '</div></div><dl>' +
      '<dt>Typ</dt><dd>' + TYPE[d.type] + (d.anchor ? ' (Anker)' : '') + '</dd><dt>Heimat</dt><dd>' + (d.season === 'none' ? 'Keine (neutral)' : SN[d.season]) + '</dd>' +
      '<dt>Grundkosten</dt><dd>' + d.cost + '</dd><dt>Kosten</dt><dd><div class="costrow">' + costs + '</div></dd>' + werte +
      '<dt>Kartentext</dt><dd>' + esc(d.text || 'Keine Fähigkeit.') + '</dd>' +
      (statusList.length ? '<dt>Status</dt><dd>' + statusList.map(esc).join('<br>') + '</dd>' : '') +
      '</dl></div><div class="modal-actions"><button class="btn primary" id="dOk">Schließen</button></div>', function (m) { $('#dOk', m).onclick = closeModal; });
  }
  function showLog() {
    const st = G.state;
    openModal('<h2>Verlauf</h2><div class="loglist">' + st.log.slice().reverse().map(function (l) { return '<div class="' + l.kind + '">' + esc(l.text) + '</div>'; }).join('') + '</div><div class="modal-actions"><button class="btn primary" id="lOk">Schließen</button></div>', function (m) { $('#lOk', m).onclick = closeModal; });
  }
  function showDiscard(p) {
    const pl = G.state.players[p];
    openModal('<h2>Ablage ' + (p === 0 ? '(du)' : '(Computer)') + '</h2>' + (pl.discard.length ? '<div class="mull">' + pl.discard.slice().reverse().map(function (id) { return mini(cardHTML(id), 98, 0.7); }).join('') + '</div>' : '<p>Noch leer.</p>') +
      '<div class="modal-actions"><button class="btn primary" id="aOk">Schließen</button></div>', function (m) { $('#aOk', m).onclick = closeModal; });
  }

  /* ---------- Eingaben auf dem Spielfeld ---------- */
  function detailFor(key) {
    const st = G.state;
    const p = key.split(':');
    if (p[0] === 'hand') return showDetail({ id: st.players[0].hand[+p[1]].id, hand: true });
    if (p[0] === 'slot') { const sl = st.players[+p[1]].field[+p[2]]; if (sl && sl.u) return showDetail({ uid: sl.u.uid }); if (sl && sl.holder) return showDetail({ id: sl.holder.id }); }
    if (p[0] === 'fz') { const f = st.players[+p[1]].fieldSpell; if (f) return showDetail({ id: f.id }); }
    if (p[0] === 'discard') return showDiscard(+p[1]);
  }
  function onClick(key) {
    if (!G) return;
    const st = G.state;
    const parts = key.split(':');
    if (parts[0] === 'btn') {
      const n = parts[1];
      if (n === 'menu') return confirmBox('Partie verlassen?', 'Die laufende Partie geht verloren.', [{ label: 'Weiterspielen', value: false }, { label: 'Zum Menü', value: true, cls: 'primary' }]).then(function (ok) { if (ok) { G = null; openMenu(); } });
      if (n === 'log') return showLog();
      if (n === 'rules') return showRules();
      if (n === 'over') return gameOver();
      if (n === 'end') { if (st.current === 0 && !G.busy) doAct({ t: 'end' }); return; }
      if (n === 'cancel') { G.sel = null; G.pending = null; return render(); }
      if (n === 'detail' && G.sel) { if (G.sel.hand != null) return showDetail({ id: st.players[0].hand[G.sel.hand].id, hand: true }); return showDetail({ uid: G.sel.unit }); }
      if (n === 'sacrifice') { const a = candidates().filter(function (x) { return x.t === 'sacrifice'; })[0]; if (a) doAct(a); return; }
      if (n === 'field') { const a = candidates().filter(function (x) { return x.t === 'play'; })[0]; if (a) doAct(a); return; }
      if (n === 'noboar' && G.pending) { const a = G.pending.acts.filter(function (x) { return x.target == null; })[0]; if (a) doAct(a); return; }
      return;
    }
    if (parts[0] === 'discard') return showDiscard(+parts[1]);
    const myTurn = st.current === 0 && !G.busy && st.winner === null;
    if (myTurn) {
      const tk = targetKeys();
      if (tk[key]) {
        if (G.pending) return doAct(tk[key]);
        const a = tk[key];
        if (a.t === 'play' && BY_ID[st.players[0].hand[a.h].id].type === 'unit') {
          const opts = legal().filter(function (x) { return x.t === 'play' && x.h === a.h && x.slot === a.slot; });
          if (opts.length > 1) { G.pending = { acts: opts, kind: BY_ID[st.players[0].hand[a.h].id].etb === 'boar' ? 'boar' : 'freeze' }; return render(); }
        }
        return doAct(a);
      }
      if (G.pending) { G.pending = null; G.sel = null; return render(); }
      if (parts[0] === 'hand') {
        const h = +parts[1];
        if (G.sel && G.sel.hand === h) { G.sel = null; return render(); }
        G.sel = { hand: h }; return render();
      }
      if (parts[0] === 'slot' && +parts[1] === 0) {
        const sl = st.players[0].field[+parts[2]];
        if (sl && sl.u) { if (G.sel && G.sel.unit === sl.u.uid) { G.sel = null; return render(); } G.sel = { unit: sl.u.uid }; return render(); }
      }
    }
    if (parts[0] === 'hand' && !myTurn) return detailFor(key);
    if ((parts[0] === 'slot' || parts[0] === 'fz')) {
      const has = parts[0] === 'fz' ? st.players[+parts[1]].fieldSpell : st.players[+parts[1]].field[+parts[2]];
      if (has) return detailFor(key);
    }
    if (G.sel) { G.sel = null; render(); }
  }
  stage.addEventListener('click', function (e) { const el = e.target.closest('[data-k]'); if (el && !el.disabled) onClick(el.dataset.k); });
  stage.addEventListener('contextmenu', function (e) { const el = e.target.closest('[data-k]'); if (el) { e.preventDefault(); detailFor(el.dataset.k); } });
  let pressT = null, pressed = false;
  stage.addEventListener('touchstart', function (e) {
    const el = e.target.closest('[data-k]'); if (!el) return;
    pressed = false;
    pressT = setTimeout(function () { pressed = true; detailFor(el.dataset.k); }, 550);
  }, { passive: true });
  stage.addEventListener('touchend', function (e) { clearTimeout(pressT); if (pressed) { e.preventDefault(); pressed = false; } });
  stage.addEventListener('touchmove', function () { clearTimeout(pressT); }, { passive: true });

  /* ---------- Start ---------- */
  /* Menü öffnen und Decks im Hintergrund nachladen */
  const drawMenu = openMenu;
  openMenu = function () { drawMenu(); if (!DECKS) loadDecks().then(function () { if (!$('#menu').hidden) drawMenu(); }); };
  if (hasAccess()) openMenu(); else { show('gate'); $('#gatePw').focus(); }
})();
