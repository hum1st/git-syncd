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

// 同步当前目录的目标分支 main（默认）
const updated = await gitSyncd();

// 同步指定目录
const updated = await gitSyncd({ cwd: "/path/to/repo" });

// 本地不存在时先 clone，再保持目标分支同步
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  url: "https://github.com/org/repo.git",
});

// 指定目标分支（默认 main）。与当前 checkout 无关。
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  url: "https://github.com/org/repo.git",
  branch: "develop",
});

// 即使 HEAD 在 dev，也会把本地 main 推进到 origin/main，且不会 checkout main
const updated = await gitSyncd({ cwd: "/path/to/repo" });

// 目标 tip 与远端不一致且快进失败时，强制对齐（默认行为）
const updated = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (updated) {
  console.log("目标分支 tip 已更新");
} else {
  console.log("目标分支已是最新");
}
```

首次 clone，或**目标分支 tip** 发生变化时返回 `true`，已是最新时返回 `false`。同步失败时抛出 `Error`。

### 同步策略

1. 解析目标分支：`options.branch ?? "main"`
2. `git fetch origin`
3. 比较本地 `refs/heads/<target>` 与 `origin/<target>`
4. 已一致 → 返回 `false`，**不修改工作区**
5. 否则 → 快进目标 tip；失败且 `force: true` 时硬对齐远端 tip
6. **绝不** `checkout` / 切换当前分支
7. **仅当**当前已检出于目标分支时才更新工作区；否则只移动 `refs/heads/<target>`

这样把「把目标线拉到最新」和「切换工作区分支」分开，后者交给调用方。

## API

### `gitSyncd(options?)`

#### 选项

| 选项     | 类型      | 默认值          | 说明 |
| -------- | --------- | --------------- | ---- |
| `cwd`    | `string`  | `process.cwd()` | 目标 git 仓库路径 |
| `url`    | `string`  | —               | 远程仓库地址。当 `cwd` 还不是 git 仓库时必填，将执行 `git clone -b <branch>` |
| `branch` | `string`  | `"main"`        | 要同步的目标分支（不必是当前 checkout） |
| `force`  | `boolean` | `true`          | 目标 tip 无法快进时硬对齐远端。当前在目标分支上时还会 reset/clean 工作区；否则只更新分支 ref。已对齐时不触碰工作区 |

#### 返回值

`Promise<boolean>` — 首次 clone，或目标分支 tip 发生变化时为 `true`。

## 许可证

MIT
