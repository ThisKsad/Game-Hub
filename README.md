# Game-Hub

Unsere selbstgebauten Browser-Spiele. Jedes Spiel liegt in einem eigenen Ordner und läuft direkt im Browser (einfach die `index.html` öffnen).

Die Startseite (`index.html` im Hauptordner) verlinkt alle Spiele und zeigt, was geplant ist. Neue Spiele bekommen dort eine eigene Kachel.

## Spiele

| Spiel | Ordner | Stand |
|---|---|---|
| Tempora (Testphase) | [`tempora/`](tempora/) | Eigenes Duell-Kartenspiel der vier Jahreszeiten gegen den Computer (3 Stufen), Deckverwaltung online; Zugang in der Testphase per Passwort |
| Scopa | [`scopa/`](scopa/) | 2–4 Spieler an einem Gerät oder online per Raum-Code (freie Plätze übernimmt der Computer), Modi: Hausregeln, Klassisch, Asso piglia tutto, eigene Regeln; Deutsch, Englisch, Portugiesisch (BR) |

## Geplant

- 2D-Spiel
- 3D-Spiel

## Online-Server

Das Online-Scopa nutzt Supabase (Projekt „Ultimate Hunt“, Tabellen mit Präfix `scopa_`).

- `supabase/functions/scopa/` – Edge Function mit der Spiellogik. Sie mischt, verteilt und prüft jeden Zug, damit niemand fremde Karten sehen kann.
- `supabase/migrations/scopa_online.sql` – Tabellen und Datenbankfunktionen.
- Räume, die drei Tage nicht benutzt wurden, werden beim Erstellen eines neuen Raums gelöscht.
- Kostenlose Supabase-Projekte pausieren nach einer Woche ohne Nutzung und müssen dann im Dashboard wieder aktiviert werden.

## Tempora

- `tempora/cards.js` – alle Karten und die vier Startdecks
- `tempora/engine.js` – Spielregeln ohne Darstellung (kann später für Online-Partien in eine Edge Function übernommen werden)
- `tempora/ai.js` – Computergegner (Leicht, Mittel, Schwer)
- `tempora/ui.js`, `tempora/decor.js`, `tempora/art.js` – Oberfläche, Jahreszeiten-Hintergründe und Kartenbilder
- `tempora/store.js` – Decks in Supabase (Tabellen `jahreskreis_players` und `jahreskreis_decks`, siehe `supabase/migrations/jahreskreis_decks.sql`)
