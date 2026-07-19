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
const updated = await gitSyncd();

// Sync a specific directory
const updated = await gitSyncd({ cwd: "/path/to/repo" });

// When there are uncommitted local changes, force discard and pull (default behavior)
const updated = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (updated) {
  console.log("Pulled new commits");
} else {
  console.log("Already up to date");
}
```

Returns `true` when new commits were pulled, `false` when already up to date. Throws an `Error` if the sync fails.

## API

### `gitSyncd(options?)`

#### Options

| Option  | Type       | Default         | Description                                                                                                  |
| ------- | ---------- | --------------- | ------------------------------------------------------------------------------------------------------------ |
| `cwd`   | `string`   | `process.cwd()` | Target git repository path                                                                                   |
| `force` | `boolean`  | `true`          | If pull fails due to local changes, automatically run `git reset --hard HEAD` to discard changes and retry  |

#### Returns

`Promise<boolean>` — `true` when HEAD changed (new commits were pulled).

## License

MIT
