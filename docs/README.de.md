# git-syncd

Hält einen **Ziel-Branch** per `git fetch` + Fast-Forward synchron (bei Bedarf per `git clone`). Wechselt niemals den aktuellen Checkout.

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
// Ziel-Branch (Standard: main), unabhängig vom aktuellen Checkout
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  branch: "develop",
});
const updated = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (updated) {
  console.log("Ziel-Branch-Tip wurde bewegt");
} else {
  console.log("Ziel-Branch ist bereits aktuell");
}
```

Gibt `true` zurück bei frischem Clone oder wenn sich der **Ziel-Branch-Tip** geändert hat, sonst `false`. Wirft bei Fehlern eine `Error`.

### Sync-Strategie

1. Ziel-Branch: `options.branch ?? "main"`
2. `git fetch origin`
3. Vergleiche `refs/heads/<target>` mit `origin/<target>`
4. Bereits gleich → `false`, Arbeitsbaum unberührt
5. Sonst Fast-Forward; bei Fehler und `force: true` hart angleichen
6. **Kein** `checkout` / Branch-Wechsel
7. Arbeitsbaum nur aktualisieren, wenn HEAD bereits auf dem Ziel-Branch liegt

## API

### `gitSyncd(options?)`

| Option   | Typ       | Standard        | Beschreibung |
| -------- | --------- | --------------- | ------------ |
| `cwd`    | `string`  | `process.cwd()` | Pfad zum Repository |
| `url`    | `string`  | —               | Remote-URL; erforderlich zum Clonen |
| `branch` | `string`  | `"main"`        | Zu synchronisierender Ziel-Branch |
| `force`  | `boolean` | `true`          | Bei Nicht-FF hart angleichen; Arbeitsbaum nur wenn HEAD auf dem Ziel-Branch |

## Lizenz

MIT
