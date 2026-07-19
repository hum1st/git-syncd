# git-syncd

Halte deine Git-Repositories mit `git fetch` + Fast-Forward synchron (bei Bedarf per `git clone`).

**Verfügbar in:** [English](../README.md) | [中文](README.zh.md) | [Español](README.es.md) | [Français](README.fr.md) | [日本語](README.ja.md)

## Installation

```bash
npm install git-syncd
```

## Verwendung

```ts
import gitSyncd from "git-syncd";

const updated = await gitSyncd();
const updated = await gitSyncd({ cwd: "/path/to/repo" });
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  url: "https://github.com/org/repo.git",
});
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  url: "https://github.com/org/repo.git",
  branch: "develop",
});
const updated = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (updated) {
  console.log("Neue Commits abgerufen");
} else {
  console.log("Bereits aktuell");
}
```

Gibt `true` zurück bei frischem Clone oder wenn HEAD sich geändert hat, sonst `false`. Wirft bei Fehlschlag einen `Error`.

### Sync-Strategie

1. `git fetch origin`
2. Vergleich von `HEAD` mit Upstream-Tip (`@{u}` oder `origin/<branch>`)
3. `HEAD` bereits am Tip → `false`, **Working Tree bleibt unberührt**
4. Sonst → Fast-Forward; bei Fehler und `force: true` Reset/Clean und Angleichen an Remote (lokale Änderungen, umgeschriebene Historie, Rewind, divergente Branches)

## API

### `gitSyncd(options?)`

| Option   | Typ       | Standard        | Beschreibung                                                                                          |
| -------- | --------- | --------------- | ----------------------------------------------------------------------------------------------------- |
| `cwd`    | `string`  | `process.cwd()` | Pfad zum Ziel-Git-Repository                                                                          |
| `url`    | `string`  | —               | Remote-URL. Erforderlich, wenn `cwd` noch kein Git-Repo ist                                           |
| `branch` | `string`  | `"main"`        | Branch beim Klonen; bei expliziter Angabe zuerst checkout, dann sync                                  |
| `force`  | `boolean` | `true`          | Wenn HEAD vom Remote-Tip abweicht und Fast-Forward scheitert: Reset/Clean und Remote angleichen       |

## Lizenz

MIT
