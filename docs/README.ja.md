# git-syncd

`git pull` で Git リポジトリを同期し続けます。

**他の言語：** [English](../README.md) | [中文](README.zh.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md)

## インストール

```bash
npm install git-syncd
```

## 使い方

```ts
import gitSyncd from "git-syncd";

// カレントディレクトリを同期
const updated = await gitSyncd();

// 特定のディレクトリを同期
const updated = await gitSyncd({ cwd: "/path/to/repo" });

// ローカルに未コミットの変更がある場合、強制的に破棄してプル（デフォルト動作）
const updated = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (updated) {
  console.log("新しいコミットを取得しました");
} else {
  console.log("すでに最新です");
}
```

新しいコミットを取得した場合は `true`、すでに最新の場合は `false` を返します。同期に失敗した場合は `Error` をスローします。

## API

### `gitSyncd(options?)`

#### オプション

| オプション | 型         | デフォルト      | 説明                                                                                                   |
| ---------- | ---------- | --------------- | ------------------------------------------------------------------------------------------------------ |
| `cwd`      | `string`   | `process.cwd()` | 対象 Git リポジトリのパス                                                                              |
| `force`    | `boolean`  | `true`          | ローカルの変更によりプルが失敗した場合、`git reset --hard HEAD` を実行して変更を破棄し再試行する       |

#### 戻り値

`Promise<boolean>` — HEAD が変化した場合（新しいコミットを取得）`true`。

## ライセンス

MIT
