# git-syncd

Keep your git repositories in sync via `git pull`.

**Available in:** [中文](docs/README.zh.md) | [Deutsch](docs/README.de.md) | [Español](docs/README.es.md) | [Français](docs/README.fr.md) | [日本語](docs/README.ja.md)

## Installation

```bash
npm install git-syncd
```

## Usage

```ts
import gitSyncd from "git-syncd";

// Sync the current working directory
const result = await gitSyncd();

// Sync a specific directory
const result = await gitSyncd({ cwd: "/path/to/repo" });

// When there are uncommitted local changes, force discard and pull (default behavior)
const result = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (result.success) {
  if (result.updated) {
    console.log("Pulled new commits");
  } else {
    console.log("Already up to date");
  }
  if (result.forceReset) {
    console.warn("Local changes were discarded and force-synced");
  }
} else {
  console.error(result.stderr);
}
```

## API

### `gitSyncd(options?)`

#### Options

| Option  | Type       | Default         | Description                                                                                                  |
| ------- | ---------- | --------------- | ------------------------------------------------------------------------------------------------------------ |
| `cwd`   | `string`   | `process.cwd()` | Target git repository path                                                                                   |
| `args`  | `string[]` | `[]`            | Additional arguments to pass to `git pull`                                                                   |
| `force` | `boolean`  | `true`          | If pull fails due to local changes, automatically run `git reset --hard HEAD` to discard changes and retry  |

#### Result

| Field        | Type      | Description                                                              |
| ------------ | --------- | ------------------------------------------------------------------------ |
| `success`    | `boolean` | `true` when exit code is `0`                                             |
| `updated`    | `boolean` | `true` when HEAD changed (new commits were pulled)                       |
| `stdout`     | `string`  | Standard output                                                          |
| `stderr`     | `string`  | Standard error                                                           |
| `exitCode`   | `number`  | Process exit code                                                        |
| `forceReset` | `boolean` | `true` when a forced reset was triggered, otherwise `undefined`          |

## License

MIT
