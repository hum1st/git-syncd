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

const updated = await gitSyncd({ cwd: "/path/to/repo", branch: "main", force: true });
```

### Windows

Unter `win32` wird mit `--no-checkout` geklont und der Worktree über Blob-Extraktion materialisiert; ungültige Pfadzeichen werden entfernt. Keine Extra-Option nötig.

## Lizenz

MIT
