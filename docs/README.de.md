# git-syncd

Halte deine Git-Repositories mit `git pull` synchron (bei Bedarf per `git clone`).

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

// Fehlt das Repo lokal, zuerst klonen
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  url: "https://github.com/org/repo.git",
});

// Branch angeben (Standard: main)
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  url: "https://github.com/org/repo.git",
  branch: "develop",
});

// Bei nicht übernommenen lokalen Änderungen: Verwerfen und trotzdem pullen (Standardverhalten)
const updated = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (updated) {
  console.log("Neue Commits abgerufen");
} else {
  console.log("Bereits aktuell");
}
```

Gibt `true` zurück bei frischem Clone oder neuen Commits, sonst `false`. Wirft bei Fehlschlag einen `Error`.

## API

### `gitSyncd(options?)`

#### Optionen

| Option   | Typ       | Standard        | Beschreibung                                                                                                        |
| -------- | --------- | --------------- | ------------------------------------------------------------------------------------------------------------------- |
| `cwd`    | `string`  | `process.cwd()` | Pfad zum Ziel-Git-Repository                                                                                        |
| `url`    | `string`  | —               | Remote-URL. Erforderlich, wenn `cwd` noch kein Git-Repo ist; führt `git clone -b <branch>` aus                      |
| `branch` | `string`  | `"main"`        | Branch beim Klonen. Bei expliziter Angabe in einem bestehenden Repo: zuerst checkout, dann `git pull`               |
| `force`  | `boolean` | `true`          | Bei Pull-Fehler wegen lokaler Änderungen: `git reset --hard HEAD` + `git clean -fd` und erneut versuchen            |

#### Rückgabewert

`Promise<boolean>` — `true` bei frischem Clone oder wenn HEAD sich geändert hat.

## Lizenz

MIT
