# git-syncd

Gardez vos dépôts git synchronisés via `git pull` (et `git clone` si besoin).

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

// Cloner si absent, puis rester synchronisé
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  url: "https://github.com/org/repo.git",
});

// Branche spécifique (défaut : main)
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  url: "https://github.com/org/repo.git",
  branch: "develop",
});

// En cas de modifications locales non validées, les supprimer et tirer (comportement par défaut)
const updated = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (updated) {
  console.log("Nouveaux commits récupérés");
} else {
  console.log("Déjà à jour");
}
```

Retourne `true` en cas de clone initial ou de nouveaux commits, `false` si déjà à jour. Lève une `Error` en cas d'échec.

## API

### `gitSyncd(options?)`

#### Options

| Option   | Type      | Défaut          | Description                                                                                                         |
| -------- | --------- | --------------- | ------------------------------------------------------------------------------------------------------------------- |
| `cwd`    | `string`  | `process.cwd()` | Chemin vers le dépôt git cible                                                                                      |
| `url`    | `string`  | —               | URL distante. Requise si `cwd` n'est pas encore un dépôt ; exécute `git clone -b <branch>`                          |
| `branch` | `string`  | `"main"`        | Branche utilisée au clone. Si passée explicitement sur un dépôt existant : checkout puis `git pull`                 |
| `force`  | `boolean` | `true`          | Si le pull échoue à cause de modifications locales : `git reset --hard HEAD` + `git clean -fd` puis nouvel essai    |

#### Résultat

`Promise<boolean>` — `true` après un clone initial ou lorsque HEAD a changé.

## Licence

MIT
