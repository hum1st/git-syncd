# git-syncd

Maintient une **branche cible** à jour via `git fetch` + fast-forward (et `git clone` si besoin). Ne change jamais le checkout courant.

**Disponible en :** [English](../README.md) | [中文](README.zh.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [日本語](README.ja.md)

## Installation

```bash
npm install git-syncd
```

## Utilisation

```ts
import gitSyncd from "git-syncd";

const updated = await gitSyncd({ cwd: "/path/to/repo", branch: "main", force: true });
```

### Windows

Sous `win32`, clone avec `--no-checkout` puis matérialise l’arbre via lecture de blobs ; les caractères illégaux dans les chemins sont retirés. Aucune option supplémentaire.

## Licence

MIT
