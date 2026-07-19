# git-syncd

Maintient une **branche cible** à jour via `git fetch` + fast-forward (et `git clone` si besoin). Ne fait jamais de checkout ni de changement de branche courante.

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
// Branche cible (défaut : main), indépendante du checkout courant
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  branch: "develop",
});
const updated = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (updated) {
  console.log("Le tip de la branche cible a bougé");
} else {
  console.log("La branche cible est déjà à jour");
}
```

Retourne `true` en cas de clone ou si le **tip de la branche cible** a changé, sinon `false`. Lève une `Error` en cas d’échec.

### Stratégie

1. Branche cible : `options.branch ?? "main"`
2. `git fetch origin`
3. Comparer `refs/heads/<target>` et `origin/<target>`
4. Déjà égal → `false` sans toucher l’arbre de travail
5. Sinon → fast-forward ; avec `force: true`, alignement forcé
6. **Jamais** de `checkout` / changement de branche
7. Mettre à jour l’arbre de travail **uniquement si** HEAD est déjà sur la branche cible

## API

### `gitSyncd(options?)`

| Option   | Type      | Défaut          | Description |
| -------- | --------- | --------------- | ----------- |
| `cwd`    | `string`  | `process.cwd()` | Chemin du dépôt |
| `url`    | `string`  | —               | URL distante ; requise pour cloner |
| `branch` | `string`  | `"main"`        | Branche cible à synchroniser |
| `force`  | `boolean` | `true`          | Si pas de FF, aligner de force ; arbre de travail seulement si HEAD est sur la cible |

## Licence

MIT
