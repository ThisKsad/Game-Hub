# Game-Hub

Unsere selbstgebauten Browser-Spiele. Jedes Spiel liegt in einem eigenen Ordner und läuft direkt im Browser (einfach die `index.html` öffnen).

## Spiele

| Spiel | Ordner | Stand |
|---|---|---|
| Scopa | [`scopa/`](scopa/) | 2–4 Spieler an einem Gerät oder online per Raum-Code (freie Plätze übernimmt der Computer), Modi: Hausregeln, Klassisch, Asso piglia tutto, eigene Regeln |

## Geplant

- Eigenes Kartenspiel mit eigenen Karten
- 2D-Spiel
- 3D-Spiel

## Online-Server

Das Online-Scopa nutzt Supabase (Projekt „Ultimate Hunt“, Tabellen mit Präfix `scopa_`).

- `supabase/functions/scopa/` – Edge Function mit der Spiellogik. Sie mischt, verteilt und prüft jeden Zug, damit niemand fremde Karten sehen kann.
- `supabase/migrations/scopa_online.sql` – Tabellen und Datenbankfunktionen.
- Räume, die drei Tage nicht benutzt wurden, werden beim Erstellen eines neuen Raums gelöscht.
- Kostenlose Supabase-Projekte pausieren nach einer Woche ohne Nutzung und müssen dann im Dashboard wieder aktiviert werden.
