# git-syncd

`git fetch` + fast-forward で Git リポジトリを同期し続けます（必要なら `git clone` で初期化）。

**他の言語：** [English](../README.md) | [中文](README.zh.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md)

## インストール

```bash
npm install git-syncd
```

## 使い方

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
  url: "https://github.com/org/repo.git",
  branch: "develop",
});
const updated = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (updated) {
  console.log("新しいコミットを取得しました");
} else {
  console.log("すでに最新です");
}
```

新規 clone、または HEAD が変わった場合は `true`、最新なら `false`。失敗時は `Error` を投げます。

### 同期戦略

1. `git fetch origin`
2. ローカル `HEAD` と upstream tip（`@{u}` または `origin/<branch>`）を比較
3. `HEAD` が tip と一致 → `false`（**作業ツリーは触らない**）
4. 不一致 → fast-forward。失敗かつ `force: true` なら reset/clean して remote tip に合わせる（ローカル変更・履歴改変・rewind・分岐を含む）

## API

### `gitSyncd(options?)`

| オプション | 型        | デフォルト      | 説明                                                                                          |
| ---------- | --------- | --------------- | --------------------------------------------------------------------------------------------- |
| `cwd`      | `string`  | `process.cwd()` | 対象リポジトリのパス                                                                          |
| `url`      | `string`  | —               | リモート URL。`cwd` がまだ git リポジトリでない場合は必須                                     |
| `branch`   | `string`  | `"main"`        | clone 時のブランチ。既存リポジトリで明示した場合は checkout してから同期                      |
| `force`    | `boolean` | `true`          | HEAD が remote tip と異なり fast-forward に失敗したとき reset/clean して合わせる。一致時は何もしない |

## ライセンス

MIT
