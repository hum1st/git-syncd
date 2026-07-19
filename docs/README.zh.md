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
const result = await gitSyncd();

// 同步指定目录
const result = await gitSyncd({ cwd: "/path/to/repo" });

// 本地有未提交变更时，强制丢弃后拉取（默认行为）
const result = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (result.success) {
  if (result.updated) {
    console.log("已拉取新提交");
  } else {
    console.log("已是最新");
  }
  if (result.forceReset) {
    console.warn("本地变更已被丢弃并强制同步");
  }
} else {
  console.error(result.stderr);
}
```

## API

### `gitSyncd(options?)`

#### 选项

| 选项    | 类型       | 默认值          | 说明                                                                                         |
| ------- | ---------- | --------------- | -------------------------------------------------------------------------------------------- |
| `cwd`   | `string`   | `process.cwd()` | 目标 git 仓库路径                                                                            |
| `args`  | `string[]` | `[]`            | 额外传递给 `git pull` 的参数                                                                 |
| `force` | `boolean`  | `true`          | 若因本地变更导致拉取失败，自动执行 `git reset --hard HEAD` 丢弃变更后重试，确保始终同步成功 |

#### 返回值

| 字段         | 类型      | 说明                                          |
| ------------ | --------- | --------------------------------------------- |
| `success`    | `boolean` | 退出码为 `0` 时为 `true`                      |
| `updated`    | `boolean` | HEAD 发生变化（拉取到新提交）时为 `true`      |
| `stdout`     | `string`  | 标准输出                                      |
| `stderr`     | `string`  | 标准错误                                      |
| `exitCode`   | `number`  | 进程退出码                                    |
| `forceReset` | `boolean` | 触发了强制重置时为 `true`，否则为 `undefined` |

## 许可证

MIT
