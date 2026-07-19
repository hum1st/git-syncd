# git-syncd

Gardez vos dépôts git synchronisés via `git pull`.

**Autres langues :** [English](../README.md) | [中文](README.zh.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [日本語](README.ja.md)

## Installation

```bash
npm install git-syncd
```

## Utilisation

```ts
import gitSyncd from "git-syncd";

// Synchroniser le répertoire de travail actuel
const result = await gitSyncd();

// Synchroniser un répertoire spécifique
const result = await gitSyncd({ cwd: "/path/to/repo" });

// En cas de modifications locales non validées, les supprimer et tirer (comportement par défaut)
const result = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (result.success) {
  if (result.updated) {
    console.log("Nouveaux commits récupérés");
  } else {
    console.log("Déjà à jour");
  }
  if (result.forceReset) {
    console.warn("Les modifications locales ont été supprimées et la synchronisation forcée");
  }
} else {
  console.error(result.stderr);
}
```

## API

### `gitSyncd(options?)`

#### Options

| Option  | Type       | Défaut          | Description                                                                                                        |
| ------- | ---------- | --------------- | ------------------------------------------------------------------------------------------------------------------ |
| `cwd`   | `string`   | `process.cwd()` | Chemin vers le dépôt git cible                                                                                     |
| `args`  | `string[]` | `[]`            | Arguments supplémentaires à passer à `git pull`                                                                    |
| `force` | `boolean`  | `true`          | Si le pull échoue en raison de modifications locales, exécuter `git reset --hard HEAD` pour les supprimer et réessayer |

#### Résultat

| Champ        | Type      | Description                                                             |
| ------------ | --------- | ----------------------------------------------------------------------- |
| `success`    | `boolean` | `true` lorsque le code de sortie est `0`                                |
| `updated`    | `boolean` | `true` lorsque HEAD a changé (nouveaux commits récupérés)               |
| `stdout`     | `string`  | Sortie standard                                                         |
| `stderr`     | `string`  | Sortie d'erreur                                                         |
| `exitCode`   | `number`  | Code de sortie du processus                                             |
| `forceReset` | `boolean` | `true` lorsqu'une réinitialisation forcée a été déclenchée, sinon `undefined` |

## Licence

MIT
