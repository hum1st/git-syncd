# git-syncd

Mantén tus repositorios git sincronizados con `git pull` (y `git clone` si hace falta).

**Disponible en:** [English](../README.md) | [中文](README.zh.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [日本語](README.ja.md)

## Instalación

```bash
npm install git-syncd
```

## Uso

```ts
import gitSyncd from "git-syncd";

// Sincronizar el directorio de trabajo actual
const updated = await gitSyncd();

// Sincronizar un directorio específico
const updated = await gitSyncd({ cwd: "/path/to/repo" });

// Clonar si falta, luego mantener sincronizado
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  url: "https://github.com/org/repo.git",
});

// Rama concreta (por defecto: main)
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  url: "https://github.com/org/repo.git",
  branch: "develop",
});

// Si hay cambios locales sin confirmar, descartarlos y hacer pull (comportamiento predeterminado)
const updated = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (updated) {
  console.log("Se obtuvieron nuevos commits");
} else {
  console.log("Ya está actualizado");
}
```

Devuelve `true` si se clonó o se obtuvieron nuevos commits, `false` si ya estaba actualizado. Lanza un `Error` si la sincronización falla.

## API

### `gitSyncd(options?)`

#### Opciones

| Opción   | Tipo      | Predeterminado  | Descripción                                                                                                        |
| -------- | --------- | --------------- | ------------------------------------------------------------------------------------------------------------------ |
| `cwd`    | `string`  | `process.cwd()` | Ruta al repositorio git de destino                                                                                 |
| `url`    | `string`  | —               | URL remota. Obligatoria si `cwd` aún no es un repo; ejecuta `git clone -b <branch>`                                |
| `branch` | `string`  | `"main"`        | Rama al clonar. Si se pasa en un repo existente, hace checkout de esa rama antes de `git pull`                     |
| `force`  | `boolean` | `true`          | Si el pull falla por cambios locales, ejecutar `git reset --hard HEAD` + `git clean -fd` y reintentar              |

#### Resultado

`Promise<boolean>` — `true` al clonar por primera vez o cuando HEAD cambió.

## Licencia

MIT
