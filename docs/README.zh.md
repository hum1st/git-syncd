# git-syncd

通过 `git fetch` + 快进，同步**目标分支**的 tip（本地不存在时可用 `git clone` 初始化）。**不会** checkout 或切换当前分支。

**其他语言：** [English](../README.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [日本語](README.ja.md)

## 安装

```bash
npm install git-syncd
```

## 使用

```ts
import gitSyncd from "git-syncd";

const updated = await gitSyncd();
const updated = await gitSyncd({ cwd: "/path/to/repo" });
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  url: "https://github.com/org/repo.git",
});
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  branch: "develop",
});
const updated = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (updated) {
  console.log("目标分支 tip 已更新");
} else {
  console.log("目标分支已是最新");
}
```

首次 clone、目标分支 tip 变化，或 Windows 下空工作区被补物化时返回 `true`，否则 `false`。失败时抛出 `Error`。

### 同步策略

1. 目标分支：`options.branch ?? "main"`
2. `git fetch origin`
3. 比较 `refs/heads/<target>` 与 `origin/<target>`
4. 已一致 → `false`（Windows 且在目标分支上但工作区为空时会补物化）
5. 否则快进；失败且 `force: true` 时硬对齐
6. **绝不**切换当前分支
7. **仅当** HEAD 已在目标分支上时才更新工作区

### Windows

在 `win32` 上，若树中含 Windows 非法路径字符（`* ? " < > | :`），普通 checkout 会失败。此时库会：

1. `git clone --no-checkout`
2. 用 `ls-tree` / `cat-file` 读 blob，写入工作区，并剥离路径段中的非法字符

无需额外参数，在 Windows 上自动启用。

## API

### `gitSyncd(options?)`

| 选项     | 类型      | 默认值          | 说明 |
| -------- | --------- | --------------- | ---- |
| `cwd`    | `string`  | `process.cwd()` | 仓库路径 |
| `url`    | `string`  | —               | 远程 URL；首次 clone 必填（Windows 为 `--no-checkout` + 安全物化） |
| `branch` | `string`  | `"main"`        | 目标分支 |
| `force`  | `boolean` | `true`          | 无法快进时硬对齐；在目标分支上时更新工作区 |

## 许可证

MIT
