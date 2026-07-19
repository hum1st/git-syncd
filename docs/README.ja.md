# git-syncd

`git pull` を使って Git リポジトリを常に同期し続けます。

**他の言語：** [English](../README.md) | [中文](README.zh.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md)

## インストール

```bash
npm install git-syncd
```

## 使い方

```ts
import gitSyncd from "git-syncd";

// カレントディレクトリを同期
const result = await gitSyncd();

// 特定のディレクトリを同期
const result = await gitSyncd({ cwd: "/path/to/repo" });

// ローカルに未コミットの変更がある場合、強制的に破棄してプル（デフォルト動作）
const result = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (result.success) {
  if (result.updated) {
    console.log("新しいコミットを取得しました");
  } else {
    console.log("すでに最新です");
  }
  if (result.forceReset) {
    console.warn("ローカルの変更が破棄され、強制的に同期されました");
  }
} else {
  console.error(result.stderr);
}
```

## API

### `gitSyncd(options?)`

#### オプション

| オプション | 型         | デフォルト      | 説明                                                                                                   |
| ---------- | ---------- | --------------- | ------------------------------------------------------------------------------------------------------ |
| `cwd`      | `string`   | `process.cwd()` | 対象 Git リポジトリのパス                                                                              |
| `args`     | `string[]` | `[]`            | `git pull` に渡す追加引数                                                                              |
| `force`    | `boolean`  | `true`          | ローカルの変更によりプルが失敗した場合、`git reset --hard HEAD` を実行して変更を破棄し再試行する       |

#### 戻り値

| フィールド   | 型        | 説明                                                  |
| ------------ | --------- | ----------------------------------------------------- |
| `success`    | `boolean` | 終了コードが `0` の場合 `true`                        |
| `updated`    | `boolean` | HEAD が変化した場合（新しいコミットを取得）`true`     |
| `stdout`     | `string`  | 標準出力                                              |
| `stderr`     | `string`  | 標準エラー出力                                        |
| `exitCode`   | `number`  | プロセス終了コード                                    |
| `forceReset` | `boolean` | 強制リセットが発生した場合 `true`、それ以外は `undefined` |

## ライセンス

MIT
