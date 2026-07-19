# git-syncd

Mantiene sincronizada una **rama objetivo** con `git fetch` + fast-forward (y `git clone` si hace falta). Nunca cambia el checkout actual.

**Disponible en:** [English](../README.md) | [中文](README.zh.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [日本語](README.ja.md)

## Instalación

```bash
npm install git-syncd
```

## Uso

```ts
import gitSyncd from "git-syncd";

const updated = await gitSyncd({ cwd: "/path/to/repo", branch: "main", force: true });
```

### Windows

En `win32` clona con `--no-checkout` y materializa el worktree leyendo blobs; elimina caracteres ilegales de la ruta. Sin opciones extra.

## Licencia

MIT
