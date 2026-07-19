# git-syncd

Mantén tus repositorios git sincronizados con `git fetch` + fast-forward (y `git clone` si hace falta).

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
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  url: "https://github.com/org/repo.git",
  branch: "develop",
});
const updated = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (updated) {
  console.log("Se obtuvieron nuevos commits");
} else {
  console.log("Ya está actualizado");
}
```

Devuelve `true` en un clone nuevo o si HEAD cambió; `false` si ya está al día. Lanza `Error` si falla.

### Estrategia de sync

1. `git fetch origin`
2. Comparar `HEAD` con el tip de upstream (`@{u}` o `origin/<branch>`)
3. Si `HEAD` ya coincide con el tip → `false` **sin tocar el working tree**
4. Si no → fast-forward; si falla y `force: true`, reset/clean y alinear al remoto (archivos sucios, historial reescrito, rewind, ramas divergentes)

## API

### `gitSyncd(options?)`

| Opción   | Tipo      | Por defecto     | Descripción                                                                                   |
| -------- | --------- | --------------- | --------------------------------------------------------------------------------------------- |
| `cwd`    | `string`  | `process.cwd()` | Ruta del repositorio                                                                          |
| `url`    | `string`  | —               | URL remota. Obligatoria si `cwd` aún no es un repo git                                        |
| `branch` | `string`  | `"main"`        | Rama al clonar; si se pasa en un repo existente, checkout y luego sync                        |
| `force`  | `boolean` | `true`          | Si HEAD difiere del tip remoto y el fast-forward falla: reset/clean y alinear al remoto       |

## Licencia

MIT
