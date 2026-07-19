# git-syncd

Gardez vos dépôts git synchronisés via `git fetch` + fast-forward (et `git clone` si besoin).

**Disponible en :** [English](../README.md) | [中文](README.zh.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [日本語](README.ja.md)

## Installation

```bash
npm install git-syncd
```

## Utilisation

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
  console.log("Nouveaux commits récupérés");
} else {
  console.log("Déjà à jour");
}
```

Retourne `true` pour un clone frais ou si HEAD a changé, sinon `false`. Lance une `Error` en cas d'échec.

### Stratégie de sync

1. `git fetch origin`
2. Comparer `HEAD` avec le tip upstream (`@{u}` ou `origin/<branch>`)
3. Si `HEAD` correspond déjà au tip → `false` **sans toucher le working tree**
4. Sinon → fast-forward ; en cas d'échec et `force: true`, reset/clean puis alignement sur le remote (fichiers locaux, historique réécrit, rewind, branches divergentes)

## API

### `gitSyncd(options?)`

| Option   | Type      | Défaut          | Description                                                                                   |
| -------- | --------- | --------------- | --------------------------------------------------------------------------------------------- |
| `cwd`    | `string`  | `process.cwd()` | Chemin du dépôt                                                                               |
| `url`    | `string`  | —               | URL distante. Requis si `cwd` n'est pas encore un dépôt git                                   |
| `branch` | `string`  | `"main"`        | Branche au clone ; si fournie sur un dépôt existant, checkout puis sync                       |
| `force`  | `boolean` | `true`          | Si HEAD diffère du tip distant et que le fast-forward échoue : reset/clean et alignement remote |

## Licence

MIT
