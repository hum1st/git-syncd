# git-syncd

Keep your git repositories in sync via `git fetch` + fast-forward (and `git clone` when needed).

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

// When HEAD differs from remote tip and fast-forward fails, force discard (default)
const updated = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (updated) {
  console.log("Pulled new commits");
} else {
  console.log("Already up to date");
}
```

Returns `true` when the repo was freshly cloned or HEAD moved (new commits / branch switch), `false` when already up to date. Throws an `Error` if the sync fails.

### Sync strategy

1. `git fetch origin`
2. Compare local `HEAD` with upstream tip (`@{u}` or `origin/<branch>`)
3. If `HEAD` already matches the tip → return `false` **without touching the working tree**
4. Otherwise → fast-forward (`merge --ff-only`); on failure with `force: true`, reset/clean and align to the remote tip (covers dirty files, rewritten history, rewinds, and diverged branches)

This avoids a second network round-trip from `git pull`, and avoids discarding local changes when HEAD is already aligned.

## API

### `gitSyncd(options?)`

#### Options

| Option   | Type      | Default         | Description                                                                                                              |
| -------- | --------- | --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `cwd`    | `string`  | `process.cwd()` | Target git repository path                                                                                               |
| `url`    | `string`  | —               | Remote URL. Required when `cwd` is not a git repo yet; runs `git clone -b <branch>`                                      |
| `branch` | `string`  | `"main"`        | Branch used when cloning. If passed explicitly on an existing repo, checkout that branch before syncing                  |
| `force`  | `boolean` | `true`          | If HEAD differs from the remote tip and fast-forward fails, run `git reset --hard` + `git clean -fd` and align to remote. No-op when already aligned |

#### Returns

`Promise<boolean>` — `true` when freshly cloned or HEAD changed.

## License

MIT
