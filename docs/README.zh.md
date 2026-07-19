# git-syncd

通过 `git fetch` + 快进合并保持仓库同步（本地不存在时可用 `git clone` 初始化）。

**其他语言：** [English](../README.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [日本語](README.ja.md)

## 安装

```bash
npm install git-syncd
```

## 使用

```ts
import gitSyncd from "git-syncd";

// 同步当前工作目录
const updated = await gitSyncd();

// 同步指定目录
const updated = await gitSyncd({ cwd: "/path/to/repo" });

// 本地不存在时先 clone，再保持同步
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  url: "https://github.com/org/repo.git",
});

// 指定分支（默认 main）
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  url: "https://github.com/org/repo.git",
  branch: "develop",
});

// HEAD 与远端 tip 不一致且快进失败时，强制丢弃后对齐远端（默认行为）
const updated = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (updated) {
  console.log("已拉取新提交");
} else {
  console.log("已是最新");
}
```

首次 clone，或 HEAD 发生变化（新提交 / 切分支）时返回 `true`，已是最新时返回 `false`。同步失败时抛出 `Error`。

### 同步策略

1. `git fetch origin`
2. 比较本地 `HEAD` 与 upstream tip（`@{u}` 或 `origin/<branch>`）
3. HEAD 已与 tip 一致 → 返回 `false`，**不修改工作区**
4. 否则 → `merge --ff-only` 快进；若失败且 `force: true`，则 reset/clean 后对齐远端 tip（覆盖本地脏文件、历史改写、rewind、分支发散）

这样不会再走一遍 `git pull` 的二次 fetch，也不会在 HEAD 已对齐时因本地脏文件误清工作区。

## API

### `gitSyncd(options?)`

#### 选项

| 选项     | 类型      | 默认值          | 说明                                                                                          |
| -------- | --------- | --------------- | --------------------------------------------------------------------------------------------- |
| `cwd`    | `string`  | `process.cwd()` | 目标 git 仓库路径                                                                             |
| `url`    | `string`  | —               | 远程仓库地址。当 `cwd` 还不是 git 仓库时必填，将执行 `git clone -b <branch>`                  |
| `branch` | `string`  | `"main"`        | clone 时使用的分支；若在已有仓库上显式传入，会先 checkout 该分支再同步                        |
| `force`  | `boolean` | `true`          | HEAD 与远端 tip 不一致且快进失败时，自动 reset/clean 并对齐远端；已对齐时不会触碰工作区       |

#### 返回值

`Promise<boolean>` — 首次 clone，或 HEAD 发生变化时为 `true`。

## 许可证

MIT
