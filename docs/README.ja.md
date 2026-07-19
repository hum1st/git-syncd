# git-syncd

`git pull` で Git リポジトリを同期し続けます（必要なら `git clone` で初期化）。

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

// ローカルに無い場合は先に clone
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  url: "https://github.com/org/repo.git",
});

// ブランチ指定（デフォルト: main）
const updated = await gitSyncd({
  cwd: "/path/to/repo",
  url: "https://github.com/org/repo.git",
  branch: "develop",
});

// ローカルに未コミットの変更がある場合、強制的に破棄してプル（デフォルト動作）
const updated = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (updated) {
  console.log("新しいコミットを取得しました");
} else {
  console.log("すでに最新です");
}
```

初回 clone、または新しいコミットを取得した場合は `true`、すでに最新の場合は `false` を返します。同期に失敗した場合は `Error` をスローします。

## API

### `gitSyncd(options?)`

#### オプション

| オプション | 型        | デフォルト      | 説明                                                                                                 |
| ---------- | --------- | --------------- | ---------------------------------------------------------------------------------------------------- |
| `cwd`      | `string`  | `process.cwd()` | 対象 Git リポジトリのパス                                                                            |
| `url`      | `string`  | —               | リモート URL。`cwd` がまだ git リポジトリでない場合に必須。`git clone -b <branch>` を実行            |
| `branch`   | `string`  | `"main"`        | clone 時に使うブランチ。既存リポジトリで明示した場合は checkout してから `git pull`                  |
| `force`    | `boolean` | `true`          | ローカル変更でプル失敗時、`git reset --hard HEAD` + `git clean -fd` して再試行                       |

#### 戻り値

`Promise<boolean>` — 初回 clone、または HEAD が変化した場合 `true`。

## ライセンス

MIT
