# git-syncd

Keep your git repositories in sync via `git pull`.

**Available in:** [中文](docs/README.zh.md) | [Deutsch](docs/README.de.md) | [Español](docs/README.es.md) | [Français](docs/README.fr.md) | [日本語](docs/README.ja.md)

## Installation

```bash
npm install git-syncd
```

## Usage

### `gitSyncd` — One-time sync

```ts
import { gitSyncd } from "git-syncd";

// Sync the current working directory
const result = await gitSyncd();

// Sync a specific directory
const result = await gitSyncd({ cwd: "/path/to/repo" });

// When there are uncommitted local changes, force discard and pull (default behavior)
const result = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (result.success) {
  console.log(result.stdout);
  if (result.forceReset) {
    console.warn("Local changes were discarded and force-synced");
  }
} else {
  console.error(result.stderr);
}
```

### `gitSyncdJob` — Scheduled sync

```ts
import { gitSyncdJob } from "git-syncd";

// Start scheduled sync (runs once immediately, then every 30 seconds)
const job = gitSyncdJob({
  cwd: "/path/to/repo",
  interval: 30_000, // recommended value, default
  onSync: (result) => {
    if (result.success) {
      console.log("[sync] OK", result.stdout);
    } else {
      console.error("[sync] FAIL", result.stderr);
    }
  },
});

// Stop when needed
job.stop();
```

> **Recommended interval**: `30000` (30 seconds). Each `git pull` only transfers data when there are new commits. Idle polling consumes negligible network and CPU resources, and a 30-second interval keeps code in sync within half a minute with minimal system overhead.

## API

### `gitSyncd(options?)`

#### Options

| Option  | Type       | Default         | Description                                                                                                  |
| ------- | ---------- | --------------- | ------------------------------------------------------------------------------------------------------------ |
| `cwd`   | `string`   | `process.cwd()` | Target git repository path                                                                                   |
| `args`  | `string[]` | `[]`            | Additional arguments to pass to `git pull`                                                                   |
| `force` | `boolean`  | `true`          | If pull fails due to local changes, automatically run `git reset --hard HEAD` to discard changes and retry  |

#### Result

| Field        | Type      | Description                                                   |
| ------------ | --------- | ------------------------------------------------------------- |
| `success`    | `boolean` | `true` when exit code is `0`                                  |
| `stdout`     | `string`  | Standard output                                               |
| `stderr`     | `string`  | Standard error                                                |
| `exitCode`   | `number`  | Process exit code                                             |
| `forceReset` | `boolean` | `true` when a forced reset was triggered, otherwise `undefined` |

---

### `gitSyncdJob(options?)`

#### Options

Inherits all options from `gitSyncd`, plus:

| Option     | Type                               | Default | Description                                                    |
| ---------- | ---------------------------------- | ------- | -------------------------------------------------------------- |
| `interval` | `number`                           | `30000` | Sync interval in milliseconds, recommended `30000`             |
| `onSync`   | `(result: GitSyncdResult) => void` | —       | Callback invoked after each sync, useful for logging or alerts |

#### Returns: `GitSyncdJob`

| Method   | Description              |
| -------- | ------------------------ |
| `stop()` | Stop the scheduled sync  |

## License

MIT

