# git-syncd

`git pull` を使って Git リポジトリを常に同期し続けます。

**他の言語：** [English](../README.md) | [中文](README.zh.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md)

## インストール

```bash
npm install git-syncd
```

## 使い方

### `gitSyncd` — 単発同期

```ts
import { gitSyncd } from "git-syncd";

// カレントディレクトリを同期
const result = await gitSyncd();

// 特定のディレクトリを同期
const result = await gitSyncd({ cwd: "/path/to/repo" });

// ローカルに未コミットの変更がある場合、強制的に破棄してプル（デフォルト動作）
const result = await gitSyncd({ cwd: "/path/to/repo", force: true });

if (result.success) {
  console.log(result.stdout);
  if (result.forceReset) {
    console.warn("ローカルの変更が破棄され、強制的に同期されました");
  }
} else {
  console.error(result.stderr);
}
```

### `gitSyncdJob` — 定期同期

```ts
import { gitSyncdJob } from "git-syncd";

// 定期同期を開始（即時実行後、30秒ごとに同期）
const job = gitSyncdJob({
  cwd: "/path/to/repo",
  interval: 30_000, // 推奨値・デフォルト値
  onSync: (result) => {
    if (result.success) {
      console.log("[sync] OK", result.stdout);
    } else {
      console.error("[sync] FAIL", result.stderr);
    }
  },
});

// 停止する場合
job.stop();
```

> **推奨インターバル**：`30000`（30秒）。`git pull` は新しいコミットがある場合にのみデータを転送します。空のポーリングはネットワークや CPU をほとんど消費せず、30秒間隔であればシステムへの負荷を無視できるレベルに抑えながら、コードを半分以内に最新の状態に保てます。

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
| `stdout`     | `string`  | 標準出力                                              |
| `stderr`     | `string`  | 標準エラー出力                                        |
| `exitCode`   | `number`  | プロセス終了コード                                    |
| `forceReset` | `boolean` | 強制リセットが発生した場合 `true`、それ以外は `undefined` |

---

### `gitSyncdJob(options?)`

#### オプション

`gitSyncd` のすべてのオプションを継承し、以下を追加:

| オプション | 型                                 | デフォルト | 説明                                                         |
| ---------- | ---------------------------------- | ---------- | ------------------------------------------------------------ |
| `interval` | `number`                           | `30000`    | 同期間隔（ミリ秒）、推奨値 `30000`                           |
| `onSync`   | `(result: GitSyncdResult) => void` | —          | 同期完了後に呼び出されるコールバック、ログ記録やアラートに便利 |

#### 戻り値：`GitSyncdJob`

| メソッド | 説明               |
| -------- | ------------------ |
| `stop()` | 定期同期を停止する |

## ライセンス

MIT
