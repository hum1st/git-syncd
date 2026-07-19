# git-syncd

Mantiene sincronizada una **rama objetivo** con `git fetch` + fast-forward (y `git clone` si hace falta). Nunca hace checkout ni cambia la rama actual.

**Disponible en:** [English](../README.md) | [中文](README.zh.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [日本語](README.ja.md)

## Instalación

```bash
npm install git-syncd
```

## Uso

```ts
import gitSyncd from "git-syncd";

const updated = await gitSyncd();
const updated = await gitSyncd({ cwd: "/path/to/repo" });
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  url: "https://github.com/org/repo.git",
});
// Rama objetivo (por defecto: main), independiente del checkout actual
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  branch: "develop",
});
const updated = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (updated) {
  console.log("El tip de la rama objetivo se movió");
} else {
  console.log("La rama objetivo ya está al día");
}
```

Devuelve `true` si se clonó o cambió el **tip de la rama objetivo**, `false` si ya estaba al día. Lanza `Error` si falla.

### Estrategia

1. Rama objetivo: `options.branch ?? "main"`
2. `git fetch origin`
3. Comparar `refs/heads/<target>` con `origin/<target>`
4. Si ya coinciden → `false` sin tocar el working tree
5. Si no → fast-forward; con `force: true`, alinear a la fuerza
6. **Nunca** `checkout` / cambiar de rama
7. Actualizar el working tree **solo si** HEAD ya está en la rama objetivo

## API

### `gitSyncd(options?)`

| Opción   | Tipo      | Por defecto     | Descripción |
| -------- | --------- | --------------- | ----------- |
| `cwd`    | `string`  | `process.cwd()` | Ruta del repositorio |
| `url`    | `string`  | —               | URL remota; requerida para clonar |
| `branch` | `string`  | `"main"`        | Rama objetivo a sincronizar |
| `force`  | `boolean` | `true`          | Si no hay FF, alinear a la fuerza; working tree solo si HEAD está en la objetivo |

## Licencia

MIT
