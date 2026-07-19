# git-syncd

通过 `git pull` 保持你的 git 仓库持续同步（本地不存在时可用 `git clone` 初始化）。

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

// 本地有未提交变更时，强制丢弃后拉取（默认行为）
const updated = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (updated) {
  console.log("已拉取新提交");
} else {
  console.log("已是最新");
}
```

首次 clone 或有新提交时返回 `true`，已是最新时返回 `false`。同步失败时抛出 `Error`。

## API

### `gitSyncd(options?)`

#### 选项

| 选项     | 类型      | 默认值          | 说明                                                                                          |
| -------- | --------- | --------------- | --------------------------------------------------------------------------------------------- |
| `cwd`    | `string`  | `process.cwd()` | 目标 git 仓库路径                                                                             |
| `url`    | `string`  | —               | 远程仓库地址。当 `cwd` 还不是 git 仓库时必填，将执行 `git clone -b <branch>`                  |
| `branch` | `string`  | `"main"`        | clone 时使用的分支；若在已有仓库上显式传入，会先 checkout 该分支再 `git pull`                 |
| `force`  | `boolean` | `true`          | 若因本地变更导致拉取失败，自动 `git reset --hard HEAD` + `git clean -fd` 后重试               |

#### 返回值

`Promise<boolean>` — 首次 clone，或 HEAD 发生变化（拉取到新提交）时为 `true`。

## 许可证

MIT
