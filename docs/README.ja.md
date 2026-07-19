# git-syncd

`git fetch` + fast-forward で**対象ブランチ**の tip を同期します（必要なら `git clone`）。現在の checkout は切り替えません。

**他言語：** [English](../README.md) | [中文](README.zh.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md)

## インストール

```bash
npm install git-syncd
```

## 使い方

```ts
import gitSyncd from "git-syncd";

const updated = await gitSyncd({ cwd: "/path/to/repo", branch: "main", force: true });
```

### Windows

`win32` では `--no-checkout` で clone し、blob を取り出してワークツリーを構築します。パス中の不正文字は除去されます。追加オプションは不要です。

## ライセンス

MIT
