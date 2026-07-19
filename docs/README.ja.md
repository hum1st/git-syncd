# git-syncd

`git fetch` + fast-forward で**対象ブランチ**の tip を同期します（必要なら `git clone`）。現在の checkout を切り替えません。

**他言語：** [English](../README.md) | [中文](README.zh.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md)

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
// 対象ブランチ（既定: main）。現在の checkout とは独立
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  branch: "develop",
});
const updated = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (updated) {
  console.log("対象ブランチの tip が更新されました");
} else {
  console.log("対象ブランチは最新です");
}
```

新規 clone、または**対象ブランチ tip** が動いたとき `true`、既に最新なら `false`。失敗時は `Error` を投げます。

### 同期戦略

1. 対象ブランチ: `options.branch ?? "main"`
2. `git fetch origin`
3. `refs/heads/<target>` と `origin/<target>` を比較
4. 一致 → `false`（作業ツリーは触らない）
5. 不一致 → fast-forward；失敗かつ `force: true` なら強制整列
6. **決して** `checkout` / ブランチ切替をしない
7. HEAD が既に対象ブランチ上のときだけ作業ツリーを更新

## API

### `gitSyncd(options?)`

| オプション | 型        | 既定            | 説明 |
| ---------- | --------- | --------------- | ---- |
| `cwd`      | `string`  | `process.cwd()` | リポジトリパス |
| `url`      | `string`  | —               | リモート URL（clone 時必須） |
| `branch`   | `string`  | `"main"`        | 同期する対象ブランチ |
| `force`    | `boolean` | `true`          | FF 不可時に強制整列。作業ツリー更新は HEAD が対象上のときのみ |

## ライセンス

MIT
