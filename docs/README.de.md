# git-syncd

Halte deine Git-Repositories mit `git pull` synchron.

**Verfügbar in:** [English](../README.md) | [中文](README.zh.md) | [Español](README.es.md) | [Français](README.fr.md) | [日本語](README.ja.md)

## Installation

```bash
npm install git-syncd
```

## Verwendung

```ts
import gitSyncd from "git-syncd";

// Aktuelles Arbeitsverzeichnis synchronisieren
const updated = await gitSyncd();

// Bestimmtes Verzeichnis synchronisieren
const updated = await gitSyncd({ cwd: "/path/to/repo" });

// Bei nicht übernommenen lokalen Änderungen: Verwerfen und trotzdem pullen (Standardverhalten)
const updated = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (updated) {
  console.log("Neue Commits abgerufen");
} else {
  console.log("Bereits aktuell");
}
```

Gibt `true` zurück, wenn neue Commits geholt wurden, sonst `false`. Wirft bei Fehlschlag einen `Error`.

## API

### `gitSyncd(options?)`

#### Optionen

| Option  | Typ        | Standard        | Beschreibung                                                                                                      |
| ------- | ---------- | --------------- | ----------------------------------------------------------------------------------------------------------------- |
| `cwd`   | `string`   | `process.cwd()` | Pfad zum Ziel-Git-Repository                                                                                      |
| `force` | `boolean`  | `true`          | Bei Pull-Fehler wegen lokaler Änderungen: `git reset --hard HEAD` ausführen, Änderungen verwerfen und neu versuchen |

#### Rückgabewert

`Promise<boolean>` — `true`, wenn HEAD sich geändert hat (neue Commits).

## Lizenz

MIT
