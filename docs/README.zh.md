# git-syncd

通过 `git pull` 保持你的 git 仓库持续同步。

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

// 本地有未提交变更时，强制丢弃后拉取（默认行为）
const updated = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (updated) {
  console.log("已拉取新提交");
} else {
  console.log("已是最新");
}
```

有新提交时返回 `true`，已是最新时返回 `false`。同步失败时抛出 `Error`。

## API

### `gitSyncd(options?)`

#### 选项

| 选项    | 类型       | 默认值          | 说明                                                                                         |
| ------- | ---------- | --------------- | -------------------------------------------------------------------------------------------- |
| `cwd`   | `string`   | `process.cwd()` | 目标 git 仓库路径                                                                            |
| `force` | `boolean`  | `true`          | 若因本地变更导致拉取失败，自动执行 `git reset --hard HEAD` 丢弃变更后重试，确保始终同步成功 |

#### 返回值

`Promise<boolean>` — HEAD 发生变化（拉取到新提交）时为 `true`。

## 许可证

MIT
