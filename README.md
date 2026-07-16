# git-syncd

Keep your git repositories in sync via `git pull`.

## Installation

```bash
npm install git-syncd
```

## Usage

```ts
// default import
import gitSyncd from "git-syncd";

// named import
import { gitSyncd } from "git-syncd";

// Sync in the current working directory
const result = await gitSyncd();

// Sync a specific directory
const result = await gitSyncd({ cwd: "/path/to/repo" });

if (result.success) {
  console.log(result.stdout);
} else {
  console.error(result.stderr);
}
```

### Options

| Option | Type       | Default         | Description                          |
| ------ | ---------- | --------------- | ------------------------------------ |
| `cwd`  | `string`   | `process.cwd()` | Path to the git repository           |
| `args` | `string[]` | `[]`            | Extra arguments passed to `git pull` |

### Result

| Field      | Type      | Description                |
| ---------- | --------- | -------------------------- |
| `success`  | `boolean` | `true` if exit code is `0` |
| `stdout`   | `string`  | Standard output            |
| `stderr`   | `string`  | Standard error             |
| `exitCode` | `number`  | Process exit code          |

## License

MIT
