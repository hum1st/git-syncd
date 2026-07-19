# git-syncd

Gardez vos dépôts git synchronisés via `git pull`.

**Disponible en :** [English](../README.md) | [中文](README.zh.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [日本語](README.ja.md)

## Installation

```bash
npm install git-syncd
```

## Utilisation

```ts
import gitSyncd from "git-syncd";

// Synchroniser le répertoire de travail actuel
const updated = await gitSyncd();

// Synchroniser un répertoire spécifique
const updated = await gitSyncd({ cwd: "/path/to/repo" });

// En cas de modifications locales non validées, les supprimer et tirer (comportement par défaut)
const updated = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (updated) {
  console.log("Nouveaux commits récupérés");
} else {
  console.log("Déjà à jour");
}
```

Retourne `true` si de nouveaux commits ont été récupérés, `false` si déjà à jour. Lève une `Error` en cas d'échec.

## API

### `gitSyncd(options?)`

#### Options

| Option  | Type       | Défaut          | Description                                                                                                        |
| ------- | ---------- | --------------- | ------------------------------------------------------------------------------------------------------------------ |
| `cwd`   | `string`   | `process.cwd()` | Chemin vers le dépôt git cible                                                                                     |
| `force` | `boolean`  | `true`          | Si le pull échoue en raison de modifications locales, exécuter `git reset --hard HEAD` pour les supprimer et réessayer |

#### Résultat

`Promise<boolean>` — `true` lorsque HEAD a changé (nouveaux commits récupérés).

## Licence

MIT
