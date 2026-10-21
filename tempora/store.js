/* Tempora – Speicherung der Decks in Supabase (Projekt „Ultimate Hunt“, Tabellen jahreskreis_*). */
(function (root) {
  'use strict';
  const SB_URL = 'https://dwsieddjvldzurosjdpp.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3c2llZGRqdmxkenVyb3NqZHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NDE3NjEsImV4cCI6MjEwNzExNzc2MX0.NyIPiH_MQBNrHQn6Ype0SF8KLMO47FwZhosdoAusYeI';
  const H = { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
  const C = root.TEMPORA_CARDS;

  function req(path, opts) {
    opts = opts || {};
    return fetch(SB_URL + '/rest/v1/' + path, {
      method: opts.method || 'GET',
      headers: Object.assign({}, H, opts.prefer ? { Prefer: opts.prefer } : {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      return r.text().then(function (t) {
        if (!r.ok) throw new Error(r.status + ' ' + t);
        return t ? JSON.parse(t) : null;
      });
    });
  }
  const enc = encodeURIComponent;

  function ensurePlayer(name) {
    return req('jahreskreis_players?on_conflict=name', { method: 'POST', prefer: 'resolution=ignore-duplicates,return=minimal', body: [{ name: name }] });
  }
  function listDecks(owner) {
    return req('jahreskreis_decks?owner=eq.' + enc(owner) + '&order=created_at.asc');
  }
  function createDeck(owner, name, cards, starterKey) {
    return req('jahreskreis_decks', { method: 'POST', prefer: 'return=representation', body: [{ owner: owner, name: name, cards: cards, starter_key: starterKey || null }] })
      .then(function (rows) { return rows[0]; });
  }
  function updateDeck(id, patch) {
    return req('jahreskreis_decks?id=eq.' + enc(id), { method: 'PATCH', prefer: 'return=representation', body: patch })
      .then(function (rows) { return rows[0]; });
  }
  function deleteDeck(id) { return req('jahreskreis_decks?id=eq.' + enc(id), { method: 'DELETE' }); }

  /* Legt fehlende Startdecks an. only: optionale Liste von Schlüsseln. */
  function seedStarters(owner, existing, only) {
    const have = {};
    (existing || []).forEach(function (d) { if (d.starter_key) have[d.starter_key] = true; });
    const keys = (only || C.SEASONS).filter(function (k) { return !have[k]; });
    return keys.reduce(function (pr, k) {
      return pr.then(function () { return createDeck(owner, C.STARTER_DECKS[k].name, C.STARTER_DECKS[k].cards, k); });
    }, Promise.resolve());
  }

  /* Lädt die Decks; beim allerersten Besuch werden die vier Startdecks angelegt. */
  function loadDecks(owner) {
    const flag = 'tempora-seeded-' + owner;
    return ensurePlayer(owner).then(function () { return listDecks(owner); }).then(function (decks) {
      let seeded = false;
      try { seeded = localStorage.getItem(flag) === '1'; } catch (e) {}
      if (!decks.length && !seeded) {
        return seedStarters(owner, []).then(function () {
          try { localStorage.setItem(flag, '1'); } catch (e) {}
          return listDecks(owner);
        });
      }
      try { localStorage.setItem(flag, '1'); } catch (e) {}
      return decks;
    });
  }
  /* Ersatz, falls der Server nicht erreichbar ist: nur die Startdecks, nicht speicherbar. */
  function offlineDecks() {
    return C.SEASONS.map(function (k) { return { id: 'local-' + k, name: C.STARTER_DECKS[k].name, cards: C.STARTER_DECKS[k].cards.slice(), starter_key: k, offline: true }; });
  }

  root.TEMPORA_STORE = { loadDecks: loadDecks, createDeck: createDeck, updateDeck: updateDeck, deleteDeck: deleteDeck, seedStarters: seedStarters, offlineDecks: offlineDecks };
})(this);
