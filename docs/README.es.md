# git-syncd

Mantén tus repositorios git sincronizados con `git pull`.

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

// Si hay cambios locales sin confirmar, descartarlos y hacer pull (comportamiento predeterminado)
const updated = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (updated) {
  console.log("Se obtuvieron nuevos commits");
} else {
  console.log("Ya está actualizado");
}
```

Devuelve `true` si se obtuvieron nuevos commits, `false` si ya estaba actualizado. Lanza un `Error` si la sincronización falla.

## API

### `gitSyncd(options?)`

#### Opciones

| Opción  | Tipo       | Predeterminado  | Descripción                                                                                                       |
| ------- | ---------- | --------------- | ----------------------------------------------------------------------------------------------------------------- |
| `cwd`   | `string`   | `process.cwd()` | Ruta al repositorio git de destino                                                                                |
| `force` | `boolean`  | `true`          | Si el pull falla por cambios locales, ejecutar `git reset --hard HEAD` para descartarlos y volver a intentarlo   |

#### Resultado

`Promise<boolean>` — `true` cuando HEAD cambió (se obtuvieron nuevos commits).

## Licencia

MIT
