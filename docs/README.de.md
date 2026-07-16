# git-syncd

Halte deine Git-Repositories mit `git pull` stets synchron.

**Andere Sprachen:** [English](../README.md) | [中文](README.zh.md) | [Español](README.es.md) | [Français](README.fr.md) | [日本語](README.ja.md)

## Installation

```bash
npm install git-syncd
```

## Verwendung

### `gitSyncd` — Einmalige Synchronisierung

```ts
import { gitSyncd } from "git-syncd";

// Aktuelles Arbeitsverzeichnis synchronisieren
const result = await gitSyncd();

// Bestimmtes Verzeichnis synchronisieren
const result = await gitSyncd({ cwd: "/path/to/repo" });

// Bei nicht übernommenen lokalen Änderungen: Verwerfen und trotzdem pullen (Standardverhalten)
const result = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (result.success) {
  console.log(result.stdout);
  if (result.forceReset) {
    console.warn("Lokale Änderungen wurden verworfen und zwangsweise synchronisiert");
  }
} else {
  console.error(result.stderr);
}
```

### `gitSyncdJob` — Geplante Synchronisierung

```ts
import { gitSyncdJob } from "git-syncd";

// Geplante Synchronisierung starten (sofort ausführen, danach alle 30 Sekunden)
const job = gitSyncdJob({
  cwd: "/path/to/repo",
  interval: 30_000, // empfohlener Wert, Standard
  onSync: (result) => {
    if (result.success) {
      console.log("[sync] OK", result.stdout);
    } else {
      console.error("[sync] FAIL", result.stderr);
    }
  },
});

// Bei Bedarf stoppen
job.stop();
```

> **Empfohlenes Intervall**: `30000` (30 Sekunden). Jedes `git pull` überträgt Daten nur bei neuen Commits. Leere Abfragen verbrauchen kaum Netzwerk oder CPU. Ein 30-Sekunden-Intervall hält den Code aktuell und belastet das System kaum.

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
| `stdout`     | `string`  | Standardausgabe                                           |
| `stderr`     | `string`  | Fehlerausgabe                                             |
| `exitCode`   | `number`  | Prozess-Exit-Code                                         |
| `forceReset` | `boolean` | `true` wenn ein erzwungenes Reset ausgelöst wurde, sonst `undefined` |

---

### `gitSyncdJob(options?)`

#### Optionen

Erbt alle Optionen von `gitSyncd`, zusätzlich:

| Option     | Typ                                | Standard | Beschreibung                                                      |
| ---------- | ---------------------------------- | -------- | ----------------------------------------------------------------- |
| `interval` | `number`                           | `30000`  | Synchronisierungsintervall in Millisekunden, empfohlen `30000`    |
| `onSync`   | `(result: GitSyncdResult) => void` | —        | Callback nach jeder Synchronisierung, nützlich für Logs oder Alerts |

#### Rückgabe: `GitSyncdJob`

| Methode  | Beschreibung                        |
| -------- | ----------------------------------- |
| `stop()` | Geplante Synchronisierung anhalten  |

## Lizenz

MIT
