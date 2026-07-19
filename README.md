# git-syncd

Keep your git repositories in sync via `git pull` (and `git clone` when needed).

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

// Clone if missing, then keep in sync
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  url: "https://github.com/org/repo.git",
});

// Clone / sync a specific branch (default: main)
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  url: "https://github.com/org/repo.git",
  branch: "develop",
});

// When there are uncommitted local changes, force discard and pull (default behavior)
const updated = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (updated) {
  console.log("Pulled new commits");
} else {
  console.log("Already up to date");
}
```

Returns `true` when the repo was freshly cloned or new commits were pulled, `false` when already up to date. Throws an `Error` if the sync fails.

## API

### `gitSyncd(options?)`

#### Options

| Option   | Type      | Default         | Description                                                                                                 |
| -------- | --------- | --------------- | ----------------------------------------------------------------------------------------------------------- |
| `cwd`    | `string`  | `process.cwd()` | Target git repository path                                                                                  |
| `url`    | `string`  | —               | Remote URL. Required when `cwd` is not a git repo yet; runs `git clone -b <branch>`                         |
| `branch` | `string`  | `"main"`        | Branch used when cloning. If passed explicitly on an existing repo, checkout that branch before `git pull` |
| `force`  | `boolean` | `true`          | If pull fails due to local changes, run `git reset --hard HEAD` + `git clean -fd` and retry                 |

#### Returns

`Promise<boolean>` — `true` when freshly cloned or HEAD changed (new commits were pulled).

## License

MIT
