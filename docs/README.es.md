# git-syncd

Mantén tus repositorios git sincronizados mediante `git pull`.

**Otros idiomas:** [English](../README.md) | [中文](README.zh.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [日本語](README.ja.md)

## Instalación

```bash
npm install git-syncd
```

## Uso

```ts
import gitSyncd from "git-syncd";

// Sincronizar el directorio de trabajo actual
const result = await gitSyncd();

// Sincronizar un directorio específico
const result = await gitSyncd({ cwd: "/path/to/repo" });

// Si hay cambios locales sin confirmar, descartarlos y hacer pull (comportamiento predeterminado)
const result = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (result.success) {
  if (result.updated) {
    console.log("Se obtuvieron nuevos commits");
  } else {
    console.log("Ya está actualizado");
  }
  if (result.forceReset) {
    console.warn("Los cambios locales fueron descartados y se forzó la sincronización");
  }
} else {
  console.error(result.stderr);
}
```

## API

### `gitSyncd(options?)`

#### Opciones

| Opción  | Tipo       | Predeterminado  | Descripción                                                                                                       |
| ------- | ---------- | --------------- | ----------------------------------------------------------------------------------------------------------------- |
| `cwd`   | `string`   | `process.cwd()` | Ruta al repositorio git de destino                                                                                |
| `args`  | `string[]` | `[]`            | Argumentos adicionales para `git pull`                                                                            |
| `force` | `boolean`  | `true`          | Si el pull falla por cambios locales, ejecutar `git reset --hard HEAD` para descartarlos y volver a intentarlo   |

#### Resultado

| Campo        | Tipo      | Descripción                                                          |
| ------------ | --------- | -------------------------------------------------------------------- |
| `success`    | `boolean` | `true` cuando el código de salida es `0`                             |
| `updated`    | `boolean` | `true` cuando HEAD cambió (se obtuvieron nuevos commits)             |
| `stdout`     | `string`  | Salida estándar                                                      |
| `stderr`     | `string`  | Salida de error                                                      |
| `exitCode`   | `number`  | Código de salida del proceso                                         |
| `forceReset` | `boolean` | `true` cuando se activó un reset forzado, de lo contrario `undefined` |

## Licencia

MIT
