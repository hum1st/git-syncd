# git-syncd

Mantén tus repositorios git sincronizados mediante `git pull`.

**Otros idiomas:** [English](../README.md) | [中文](README.zh.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [日本語](README.ja.md)

## Instalación

```bash
npm install git-syncd
```

## Uso

### `gitSyncd` — Sincronización única

```ts
import { gitSyncd } from "git-syncd";

// Sincronizar el directorio de trabajo actual
const result = await gitSyncd();

// Sincronizar un directorio específico
const result = await gitSyncd({ cwd: "/path/to/repo" });

// Si hay cambios locales sin confirmar, descartarlos y hacer pull (comportamiento predeterminado)
const result = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (result.success) {
  console.log(result.stdout);
  if (result.forceReset) {
    console.warn("Los cambios locales fueron descartados y se forzó la sincronización");
  }
} else {
  console.error(result.stderr);
}
```

### `gitSyncdJob` — Sincronización programada

```ts
import { gitSyncdJob } from "git-syncd";

// Iniciar sincronización programada (se ejecuta de inmediato y luego cada 30 segundos)
const job = gitSyncdJob({
  cwd: "/path/to/repo",
  interval: 30_000, // valor recomendado, valor predeterminado
  onSync: (result) => {
    if (result.success) {
      console.log("[sync] OK", result.stdout);
    } else {
      console.error("[sync] FAIL", result.stderr);
    }
  },
});

// Detener cuando sea necesario
job.stop();
```

> **Intervalo recomendado**: `30000` (30 segundos). Cada `git pull` solo transfiere datos cuando hay nuevos commits. El sondeo inactivo consume recursos mínimos de red y CPU, y un intervalo de 30 segundos mantiene el código actualizado con una carga del sistema insignificante.

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
| `stdout`     | `string`  | Salida estándar                                                      |
| `stderr`     | `string`  | Salida de error                                                      |
| `exitCode`   | `number`  | Código de salida del proceso                                         |
| `forceReset` | `boolean` | `true` cuando se activó un reset forzado, de lo contrario `undefined` |

---

### `gitSyncdJob(options?)`

#### Opciones

Hereda todas las opciones de `gitSyncd`, además de:

| Opción     | Tipo                               | Predeterminado | Descripción                                                           |
| ---------- | ---------------------------------- | -------------- | --------------------------------------------------------------------- |
| `interval` | `number`                           | `30000`        | Intervalo de sincronización en milisegundos, recomendado `30000`      |
| `onSync`   | `(result: GitSyncdResult) => void` | —              | Callback invocado después de cada sincronización, útil para registros |

#### Retorna: `GitSyncdJob`

| Método   | Descripción                          |
| -------- | ------------------------------------ |
| `stop()` | Detener la sincronización programada |

## Licencia

MIT
