# git-syncd

通过 `git pull` 保持你的 git 仓库持续同步。

**其他语言：** [English](../README.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [日本語](README.ja.md)

## 安装

```bash
npm install git-syncd
```

## 使用

### `gitSyncd` — 单次同步

```ts
import { gitSyncd } from "git-syncd";

// 同步当前工作目录
const result = await gitSyncd();

// 同步指定目录
const result = await gitSyncd({ cwd: "/path/to/repo" });

// 本地有未提交变更时，强制丢弃后拉取（默认行为）
const result = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (result.success) {
  console.log(result.stdout);
  if (result.forceReset) {
    console.warn("本地变更已被丢弃并强制同步");
  }
} else {
  console.error(result.stderr);
}
```

### `gitSyncdJob` — 定时同步

```ts
import { gitSyncdJob } from "git-syncd";

// 启动定时同步（立即执行一次，之后每 30 秒同步一次）
const job = gitSyncdJob({
  cwd: "/path/to/repo",
  interval: 30_000, // 推荐值，默认值
  onSync: (result) => {
    if (result.success) {
      console.log("[sync] OK", result.stdout);
    } else {
      console.error("[sync] FAIL", result.stderr);
    }
  },
});

// 需要停止时
job.stop();
```

> **推荐间隔**：`30000`（30 秒）。每次 `git pull` 仅在有新提交时才传输数据，空轮询几乎不消耗网络和 CPU，30 秒的间隔在绝大多数场景下对系统压力可忽略不计，同时能保证代码在半分钟内同步到最新。

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
| `stdout`     | `string`  | 标准输出                                      |
| `stderr`     | `string`  | 标准错误                                      |
| `exitCode`   | `number`  | 进程退出码                                    |
| `forceReset` | `boolean` | 触发了强制重置时为 `true`，否则为 `undefined` |

---

### `gitSyncdJob(options?)`

#### 选项

继承 `gitSyncd` 的所有选项，额外支持：

| 选项       | 类型                               | 默认值  | 说明                                           |
| ---------- | ---------------------------------- | ------- | ---------------------------------------------- |
| `interval` | `number`                           | `30000` | 同步间隔（毫秒），推荐 `30000`                 |
| `onSync`   | `(result: GitSyncdResult) => void` | —       | 每次同步完成后的回调，可用于日志记录或错误上报 |

#### 返回：`GitSyncdJob`

| 方法     | 说明             |
| -------- | ---------------- |
| `stop()` | 停止定时同步任务 |

## 许可证

MIT
