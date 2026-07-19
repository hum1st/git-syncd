# git-syncd

Halte deine Git-Repositories mit `git pull` stets synchron.

**Andere Sprachen:** [English](../README.md) | [中文](README.zh.md) | [Español](README.es.md) | [Français](README.fr.md) | [日本語](README.ja.md)

## Installation

```bash
npm install git-syncd
```

## Verwendung

```ts
import gitSyncd from "git-syncd";

// Aktuelles Arbeitsverzeichnis synchronisieren
const result = await gitSyncd();

// Bestimmtes Verzeichnis synchronisieren
const result = await gitSyncd({ cwd: "/path/to/repo" });

// Bei nicht übernommenen lokalen Änderungen: Verwerfen und trotzdem pullen (Standardverhalten)
const result = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (result.success) {
  if (result.updated) {
    console.log("Neue Commits abgerufen");
  } else {
    console.log("Bereits aktuell");
  }
  if (result.forceReset) {
    console.warn("Lokale Änderungen wurden verworfen und zwangsweise synchronisiert");
  }
} else {
  console.error(result.stderr);
}
```

## API

### `gitSyncd(options?)`

#### Optionen

| Option  | Typ        | Standard        | Beschreibung                                                                                                      |
| ------- | ---------- | --------------- | ----------------------------------------------------------------------------------------------------------------- |
| `cwd`   | `string`   | `process.cwd()` | Pfad zum Ziel-Git-Repository                                                                                      |
| `args`  | `string[]` | `[]`            | Zusätzliche Argumente für `git pull`                                                                              |
| `force` | `boolean`  | `true`          | Bei Pull-Fehler wegen lokaler Änderungen: `git reset --hard HEAD` ausführen, Änderungen verwerfen und neu versuchen |

#### Rückgabewert

| Feld         | Typ       | Beschreibung                                              |
| ------------ | --------- | --------------------------------------------------------- |
| `success`    | `boolean` | `true` wenn Exit-Code `0` ist                             |
| `updated`    | `boolean` | `true` wenn HEAD sich geändert hat (neue Commits)         |
| `stdout`     | `string`  | Standardausgabe                                           |
| `stderr`     | `string`  | Fehlerausgabe                                             |
| `exitCode`   | `number`  | Prozess-Exit-Code                                         |
| `forceReset` | `boolean` | `true` wenn ein erzwungenes Reset ausgelöst wurde, sonst `undefined` |

## Lizenz

MIT
