# git-syncd

Gardez vos dépôts git synchronisés via `git pull`.

**Autres langues :** [English](../README.md) | [中文](README.zh.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [日本語](README.ja.md)

## Installation

```bash
npm install git-syncd
```

## Utilisation

### `gitSyncd` — Synchronisation unique

```ts
import { gitSyncd } from "git-syncd";

// Synchroniser le répertoire de travail actuel
const result = await gitSyncd();

// Synchroniser un répertoire spécifique
const result = await gitSyncd({ cwd: "/path/to/repo" });

// En cas de modifications locales non validées, les supprimer et tirer (comportement par défaut)
const result = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (result.success) {
  console.log(result.stdout);
  if (result.forceReset) {
    console.warn("Les modifications locales ont été supprimées et la synchronisation forcée");
  }
} else {
  console.error(result.stderr);
}
```

### `gitSyncdJob` — Synchronisation planifiée

```ts
import { gitSyncdJob } from "git-syncd";

// Démarrer la synchronisation planifiée (s'exécute immédiatement, puis toutes les 30 secondes)
const job = gitSyncdJob({
  cwd: "/path/to/repo",
  interval: 30_000, // valeur recommandée, valeur par défaut
  onSync: (result) => {
    if (result.success) {
      console.log("[sync] OK", result.stdout);
    } else {
      console.error("[sync] FAIL", result.stderr);
    }
  },
});

// Arrêter si nécessaire
job.stop();
```

> **Intervalle recommandé** : `30000` (30 secondes). Chaque `git pull` ne transfère des données que lorsqu'il y a de nouveaux commits. Les sondages à vide consomment peu de réseau et de CPU, et un intervalle de 30 secondes maintient le code à jour avec une charge système négligeable.

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
| `stdout`     | `string`  | Sortie standard                                                         |
| `stderr`     | `string`  | Sortie d'erreur                                                         |
| `exitCode`   | `number`  | Code de sortie du processus                                             |
| `forceReset` | `boolean` | `true` lorsqu'une réinitialisation forcée a été déclenchée, sinon `undefined` |

---

### `gitSyncdJob(options?)`

#### Options

Hérite de toutes les options de `gitSyncd`, en plus de :

| Option     | Type                               | Défaut  | Description                                                              |
| ---------- | ---------------------------------- | ------- | ------------------------------------------------------------------------ |
| `interval` | `number`                           | `30000` | Intervalle de synchronisation en millisecondes, recommandé `30000`       |
| `onSync`   | `(result: GitSyncdResult) => void` | —       | Rappel invoqué après chaque synchronisation, utile pour les journaux     |

#### Retourne : `GitSyncdJob`

| Méthode  | Description                           |
| -------- | ------------------------------------- |
| `stop()` | Arrêter la synchronisation planifiée  |

## Licence

MIT
