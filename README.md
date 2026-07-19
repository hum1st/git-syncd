# git-syncd

Keep a **target branch** in sync via `git fetch` + fast-forward (and `git clone` when needed). Never checks out or switches your current branch.

**Available in:** [中文](docs/README.zh.md) | [Deutsch](docs/README.de.md) | [Español](docs/README.es.md) | [Français](docs/README.fr.md) | [日本語](docs/README.ja.md)

## Installation

```bash
npm install git-syncd
```

## Usage

```ts
import gitSyncd from "git-syncd";

// Sync target branch `main` (default) in the current working directory
const updated = await gitSyncd();

// Sync a specific directory
const updated = await gitSyncd({ cwd: "/path/to/repo" });

// Clone if missing, then keep the target branch in sync
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  url: "https://github.com/org/repo.git",
});

// Target branch (default: main). Independent of the current checkout.
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  url: "https://github.com/org/repo.git",
  branch: "develop",
});

// Even if HEAD is on `dev`, this advances local `main` to origin/main
// without checking out `main`.
const updated = await gitSyncd({ cwd: "/path/to/repo" });

// When the target tip differs and fast-forward fails, force-align (default)
const updated = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (updated) {
  console.log("Target branch tip moved");
} else {
  console.log("Target branch already up to date");
}
```

Returns `true` when the repo was freshly cloned or the **target branch tip** moved, `false` when already up to date. Throws an `Error` if the sync fails.

### Sync strategy

1. Resolve target branch: `options.branch ?? "main"`
2. `git fetch origin`
3. Compare local `refs/heads/<target>` with `origin/<target>`
4. If already equal → return `false` **without touching the working tree** (on Windows, if HEAD is on the target and the worktree is empty, files are materialized)
5. Otherwise → fast-forward the target tip; on failure with `force: true`, hard-align to the remote tip
6. **Never** `checkout` / switch the current branch
7. Update the working tree **only if** HEAD is already on the target branch; otherwise only move `refs/heads/<target>`

This separates “pull the target line to latest” from “switch the working checkout” (left to the caller).

### Windows

On `win32`, clone uses `git clone --no-checkout`, then materializes the worktree by reading blobs and writing files with illegal path characters (`* ? " < > | :`) stripped from each path segment. Updates on the target branch use the same materialization instead of `git reset --hard`, so paths that are illegal on Windows do not abort sync.

## API

### `gitSyncd(options?)`

#### Options

| Option   | Type      | Default         | Description                                                                 |
| -------- | --------- | --------------- | --------------------------------------------------------------------------- |
| `cwd`    | `string`  | `process.cwd()` | Target git repository path                                                  |
| `url`    | `string`  | —               | Remote URL. Required when `cwd` is not a git repo yet; runs `git clone -b <branch>` (Windows: `--no-checkout` + safe materialize) |
| `branch` | `string`  | `"main"`        | Target branch to sync (not necessarily the current checkout)                |
| `force`  | `boolean` | `true`          | If the target tip cannot fast-forward, hard-align to remote. When HEAD is on the target, also update the worktree; otherwise only update the branch ref. No-op when already aligned |

#### Returns

`Promise<boolean>` — `true` when freshly cloned, the target branch tip changed, or a Windows empty worktree was materialized.

## License

MIT
