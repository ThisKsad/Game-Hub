/* Tempora – Kartendaten und Startdecks.
   Läuft im Browser (window.TEMPORA_CARDS) und in Node/Deno (module.exports). */
(function (root) {
  'use strict';

  // season: spring | summer | autumn | winter | none   type: unit | spell | field
  // kw: Schlüsselwörter, die die Regeln direkt auswerten
  const CARDS = [
    // Ankerkarten (neutral, ohne Fähigkeit)
    { id: 'kiesel', name: 'Kiesel', season: 'none', type: 'unit', cost: 1, atk: 1, def: 2, anchor: true },
    { id: 'feldstein', name: 'Feldstein', season: 'none', type: 'unit', cost: 2, atk: 2, def: 3, anchor: true },
    { id: 'steinmaennchen', name: 'Steinmännchen', season: 'none', type: 'unit', cost: 3, atk: 3, def: 4, anchor: true },
    { id: 'findling', name: 'Findling', season: 'none', type: 'unit', cost: 4, atk: 4, def: 5, anchor: true },
    { id: 'felswaechter', name: 'Felswächter', season: 'none', type: 'unit', cost: 5, atk: 5, def: 6, anchor: true },
    { id: 'steingolem', name: 'Steingolem', season: 'none', type: 'unit', cost: 6, atk: 6, def: 7, anchor: true },
    { id: 'bergriese', name: 'Bergriese', season: 'none', type: 'unit', cost: 7, atk: 7, def: 8, anchor: true },
    { id: 'urgestein', name: 'Urgestein', season: 'none', type: 'unit', cost: 8, atk: 8, def: 9, anchor: true },

    // Frühling
    { id: 'keimling', name: 'Keimling', season: 'spring', type: 'unit', cost: 1, atk: 1, def: 1, kw: ['growth'],
      short: ['Wachstum:', 'Bei jedem Jahreszeitenwechsel +1 Verteidigung (max. 5).'],
      text: 'Bei jedem Jahreszeitenwechsel dauerhaft +1 Verteidigung (durch Wachstum höchstens 5; andere Boni zusätzlich). Wächst nicht im Eis.' },
    { id: 'schwalbe', name: 'Schwalbe', season: 'spring', type: 'unit', cost: 2, atk: 2, def: 1, kw: ['ranged', 'migrant'],
      short: ['Fernkampf. Zugvogel:', 'Kehrt zu Beginn des Winters auf die Hand zurück.'],
      text: 'Fernkampf. Zugvogel: Zu Beginn des Winters kehrt sie auf die Hand zurück; bei voller Hand bleibt sie auf dem Feld.' },
    { id: 'hummel', name: 'Hummel', season: 'spring', type: 'unit', cost: 3, atk: 3, def: 3, kw: ['pollinate'],
      short: ['', 'Einheiten, die du neben ihr ausspielst, erhalten +1 Verteidigung.'],
      text: 'Einheiten, die du direkt neben ihr ausspielst, erhalten dauerhaft +1 Verteidigung.' },
    { id: 'baer', name: 'Erwachender Bär', season: 'spring', type: 'unit', cost: 5, atk: 5, def: 5, kw: ['hibernate', 'springRage'],
      short: ['Winterschlaf.', 'In der Frühlingsrunde +2 Angriff.'],
      text: 'Winterschlaf: Im Winter kann er weder angreifen noch angegriffen werden und erhält keinen Frost. In der Frühlingsrunde +2 Angriff.' },
    { id: 'austrieb', name: 'Neuer Austrieb', season: 'spring', type: 'spell', cost: 2, target: 'ownReturn',
      short: ['', 'Stellt eine eigene zurückgekehrte Karte voll wieder her. Platzhalter kehren voll zurück.'],
      text: 'Ziel: eine eigene Karte aus der Vergänglichkeit. Bereits mit halben Werten zurück: wird vollständig wiederhergestellt, Effekte beim Ausspielen lösen erneut aus. Noch Platzhalter: kehrt im Frühling in voller Form zurück. Die Karte kann danach nicht erneut zurückkehren.' },
    { id: 'boden', name: 'Fruchtbarer Boden', season: 'spring', type: 'field', cost: 3,
      short: ['', 'Frühlingskarten kosten nie mehr als ihre Grundkosten.'],
      text: 'Karten mit Frühlings-Heimat kosten nie mehr als ihre Grundkosten (kein Aufschlag im Herbst).' },
    { id: 'ewigerfruehling', name: 'Ewiger Frühling', season: 'spring', type: 'field', cost: 4,
      short: ['', 'Jeder Frühling dauert zwei Runden.'],
      text: 'Jeder Frühling dauert zwei Runden (wirkt ab dem nächsten Rundenwechsel).' },

    // Sommer
    { id: 'eidechse', name: 'Sonneneidechse', season: 'summer', type: 'unit', cost: 1, atk: 1, def: 1, kw: ['sunbather'],
      short: ['Sonnenanbeter:', 'Auf dem Sonnenplatz +1 Verteidigung.'],
      text: 'Sonnenanbeter: Auf einem Sonnenplatz zusätzlich +1 Verteidigung.' },
    { id: 'wespe', name: 'Feuerwespe', season: 'summer', type: 'unit', cost: 2, atk: 2, def: 2, kw: ['sting'],
      short: ['Stachel:', 'Zerstört ihr Angriff nicht, verliert der Gegner 1 Lebenskraft.'],
      text: 'Stachel: Greift sie eine Einheit an und zerstört sie nicht, verliert der Gegner trotzdem 1 Lebenskraft.' },
    { id: 'loewe', name: 'Steppenlöwe', season: 'summer', type: 'unit', cost: 3, atk: 4, def: 3, kw: ['territory'],
      short: ['Revier:', 'Auf dem Sonnenplatz gilt er als Wächter.'],
      text: 'Revier: Auf einem Sonnenplatz gilt er als Wächter.' },
    { id: 'drache', name: 'Glutdrache', season: 'summer', type: 'unit', cost: 5, atk: 5, def: 4, etb: 'scorch',
      short: ['', 'Beim Ausspielen: Gegnerische Einheiten −2 Verteidigung bis Rundenende.'],
      text: 'Beim Ausspielen: Alle gegnerischen Einheiten haben bis Rundenende −2 Verteidigung.' },
    { id: 'lauffeuer', name: 'Lauffeuer', season: 'summer', type: 'spell', cost: 2, target: 'ownUnit',
      short: ['', 'Eine eigene Einheit darf in diesem Zug zweimal angreifen.'],
      text: 'Eine eigene Einheit darf in diesem Zug zweimal angreifen.' },
    { id: 'spaetsommer', name: 'Spätsommer', season: 'summer', type: 'field', cost: 3,
      short: ['', 'Der Rabatt von Sommerkarten gilt auch im Herbst.'],
      text: 'Der Kostenrabatt von Karten mit Sommer-Heimat gilt auch im Herbst.' },
    { id: 'gleissend', name: 'Gleißende Sonne', season: 'summer', type: 'field', cost: 3,
      short: ['', 'Die Plätze neben der Mitte sind Sonnenplätze (+1 Angriff).'],
      text: 'Auch die beiden Plätze neben der Mitte sind Sonnenplätze, mit +1 statt +2 Angriff.' },

    // Herbst
    { id: 'fallobst', name: 'Fallobst', season: 'autumn', type: 'unit', cost: 1, atk: 0, def: 2, kw: ['sacrifice'],
      short: ['Opfern:', 'Zerstöre ihn in deinem Zug für +1 Energie.'],
      text: 'Opfern: Du darfst ihn in deinem Zug zerstören, um 1 Energie zu erhalten.' },
    { id: 'kraehe', name: 'Krähe', season: 'autumn', type: 'unit', cost: 2, atk: 2, def: 2, kw: ['scavenger'],
      short: ['Aasfresser:', 'Stirbt eine andere eigene Einheit, +1 Angriff (max. +4).'],
      text: 'Aasfresser: Immer wenn eine andere eigene Einheit zerstört wird, erhält sie dauerhaft +1 Angriff (höchstens +4).' },
    { id: 'wildschwein', name: 'Wildschwein', season: 'autumn', type: 'unit', cost: 3, atk: 3, def: 3, etb: 'boar',
      short: ['', 'Beim Ausspielen: Opfere eine eigene Einheit für +2/+2.'],
      text: 'Beim Ausspielen darfst du eine eigene Einheit opfern; tust du es, erhält es dauerhaft +2/+2.' },
    { id: 'hirsch', name: 'Hirschkönig', season: 'autumn', type: 'unit', cost: 5, atk: 5, def: 5, kw: ['harvestKing'],
      short: ['', 'Zu Beginn jedes Herbstes: Ziehe 2 Karten.'],
      text: 'Zu Beginn jedes Herbstes: Ziehe 2 Karten (Handlimit gilt).' },
    { id: 'wirbel', name: 'Blätterwirbel', season: 'autumn', type: 'spell', cost: 2, target: 'enemyUnitMax3',
      short: ['', 'Eine gegnerische Einheit mit Grundkosten bis 3 kehrt auf die Hand zurück.'],
      text: 'Schicke eine gegnerische Einheit mit Grundkosten bis 3 auf die Hand ihres Besitzers zurück.' },
    { id: 'laubdecke', name: 'Laubdecke', season: 'autumn', type: 'field', cost: 4,
      short: ['', 'Im Herbst zerstörte Einheiten kehren mit vollen Werten zurück.'],
      text: 'Im Herbst zerstörte Einheiten kehren im Frühling mit vollen statt halben Grundwerten zurück (weiterhin ohne Fähigkeiten).' },
    { id: 'spaetherbst', name: 'Spätherbst', season: 'autumn', type: 'field', cost: 3,
      short: ['', 'Vergänglichkeit gilt auch im Winter.'],
      text: 'Vergänglichkeit gilt auch im Winter: Dort zerstörte Einheiten werden ebenfalls Platzhalter und kehren im nächsten Frühling zurück.' },

    // Winter
    { id: 'eiskristall', name: 'Eiskristall', season: 'winter', type: 'unit', cost: 1, atk: 0, def: 2, etb: 'freezeOne',
      short: ['', 'Beim Ausspielen: Friere eine gegnerische Einheit ein.'],
      text: 'Beim Ausspielen: Friere eine gegnerische Einheit ein (sie kann im nächsten eigenen Zug nicht angreifen).' },
    { id: 'eismauer', name: 'Eismauer', season: 'winter', type: 'unit', cost: 2, atk: 0, def: 5, kw: ['guard'],
      short: ['Wächter.', ''], text: 'Wächter.' },
    { id: 'mammut', name: 'Mammut', season: 'winter', type: 'unit', cost: 5, atk: 4, def: 7, kw: ['tough', 'guard'],
      short: ['Zäh. Wächter.', ''], text: 'Zäh. Wächter.' },
    { id: 'winterkoenig', name: 'Winterkönig', season: 'winter', type: 'unit', cost: 9, atk: 8, def: 10, kw: ['eternalWinter'],
      short: ['Ewiger Winter:', 'Solange er liegt, bleibt es Winter.'],
      text: 'Ewiger Winter: Solange er auf dem Feld ist, wechselt die Jahreszeit nicht mehr, es bleibt Winter. Wird er zerstört, geht es beim nächsten Rundenwechsel mit dem Frühling weiter.' },
    { id: 'ewigeseis', name: 'Ewiges Eis', season: 'winter', type: 'spell', cost: 3, target: 'enemyUnit',
      short: ['', 'Eine gegnerische Einheit ist bis zum nächsten Frühling im Eis eingeschlossen.'],
      text: 'Eine gegnerische Einheit wird eingeschlossen: Bis zum nächsten Frühling kann sie weder angreifen noch angegriffen werden, ihre Effekte ruhen.' },
    { id: 'dauerfrost', name: 'Dauerfrost', season: 'winter', type: 'field', cost: 3,
      short: ['', 'Frost wirkt doppelt: −2 statt −1 Verteidigung.'],
      text: 'Im Winter haben Einheiten ohne Winter-Heimat −2 statt −1 Verteidigung.' },
    { id: 'schneeschmelze', name: 'Schneeschmelze', season: 'winter', type: 'field', cost: 3,
      short: ['', 'Wer im Eis überwintert, erhält im Frühling +1/+1.'],
      text: 'Einheiten, die den Winter auf einem eingefrorenen Platz verbracht haben, erhalten zu Beginn des Frühlings dauerhaft +1/+1 (beide Seiten).' },

    // Neutral
    { id: 'steinlawine', name: 'Steinlawine', season: 'none', type: 'spell', cost: 8, target: 'enemyUnit',
      short: ['', 'Zerstöre eine gegnerische Einheit.'], text: 'Zerstöre eine gegnerische Einheit.' },
    { id: 'steinkreis', name: 'Steinkreis', season: 'none', type: 'field', cost: 1,
      short: ['', 'Einheiten ohne Heimat sind von Jahreszeiteneffekten unberührt.'],
      text: 'Einheiten ohne Heimat sind von allen Jahreszeiteneffekten unberührt (kein Frost, kein Aufblühen, keine Lange Tage, kein Sonnenplatz-Bonus, kein Eis).' },
    { id: 'tagundnacht', name: 'Tagundnachtgleiche', season: 'none', type: 'field', cost: 4,
      short: ['', 'Alle Karten kosten ihre Grundkosten.'],
      text: 'Alle Karten kosten immer ihre Grundkosten; Rabatte und Aufschläge durch Jahreszeiten entfallen.' },
    { id: 'innerewaerme', name: 'Innere Wärme', season: 'none', type: 'field', cost: 2,
      short: ['', 'Effekte eingefrorener Karten wirken weiter.'],
      text: 'Fähigkeiten und dauerhafte Effekte eingefrorener Karten wirken weiter.' }
  ];

  const BY_ID = {};
  CARDS.forEach(function (c) { c.kw = c.kw || []; BY_ID[c.id] = c; });

  const ANCHORS6 = ['kiesel', 'feldstein', 'steinmaennchen', 'findling', 'felswaechter', 'steingolem'];
  const STARTER_DECKS = {
    spring: { name: 'Frühlings-Startdeck', cards: ['keimling', 'schwalbe', 'hummel', 'baer', 'austrieb', 'boden', 'ewigerfruehling']
      .concat(ANCHORS6, ['eidechse', 'wespe', 'lauffeuer', 'eismauer', 'eiskristall', 'steinkreis', 'steinlawine']) },
    summer: { name: 'Sommer-Startdeck', cards: ['eidechse', 'wespe', 'loewe', 'drache', 'lauffeuer', 'spaetsommer', 'gleissend']
      .concat(['kiesel', 'feldstein', 'steinmaennchen', 'findling', 'felswaechter', 'bergriese'], ['keimling', 'schwalbe', 'hummel', 'kraehe', 'wirbel', 'tagundnacht', 'steinlawine']) },
    autumn: { name: 'Herbst-Startdeck', cards: ['fallobst', 'kraehe', 'wildschwein', 'hirsch', 'wirbel', 'laubdecke', 'spaetherbst']
      .concat(['kiesel', 'feldstein', 'steinmaennchen', 'findling', 'steingolem', 'bergriese'], ['eidechse', 'loewe', 'lauffeuer', 'eismauer', 'ewigeseis', 'steinlawine', 'steinkreis']) },
    winter: { name: 'Winter-Startdeck', cards: ['eiskristall', 'eismauer', 'mammut', 'winterkoenig', 'ewigeseis', 'dauerfrost', 'schneeschmelze']
      .concat(['kiesel', 'feldstein', 'steinmaennchen', 'findling', 'felswaechter', 'urgestein'], ['fallobst', 'kraehe', 'wirbel', 'keimling', 'hummel', 'innerewaerme', 'steinlawine']) }
  };

  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  const SEASON_NAMES = { spring: 'Frühling', summer: 'Sommer', autumn: 'Herbst', winter: 'Winter', none: 'Neutral' };
  const KW_NAMES = { ranged: 'Fernkampf', guard: 'Wächter', tough: 'Zäh', haste: 'Eile', migrant: 'Zugvogel', hibernate: 'Winterschlaf', sacrifice: 'Opfern' };

  const API = { CARDS: CARDS, BY_ID: BY_ID, STARTER_DECKS: STARTER_DECKS, SEASONS: SEASONS, SEASON_NAMES: SEASON_NAMES, KW_NAMES: KW_NAMES };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.TEMPORA_CARDS = API;
})(this);
