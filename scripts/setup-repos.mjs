#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// setup-repos.mjs
//
// 在项目根目录的 tmp/ 下创建两个 git 仓库：
//   tmp/source-repo   —— 源仓库（bare remote + local clone，模拟"上游"）
//   tmp/subscriber    —— 订阅仓库（clone 自 source-repo，用于测试同步）
//
// 如果 tmp/ 已存在，会先删除再重建。
// ─────────────────────────────────────────────────────────────────────────────

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const TMP_DIR = path.join(ROOT_DIR, "tmp");
const SOURCE_BARE = path.join(TMP_DIR, "source-repo.git");
const SOURCE_LOCAL = path.join(TMP_DIR, "source-repo");
const SUBSCRIBER_DIR = path.join(TMP_DIR, "subscriber");

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test User",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test User",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function git(args, cwd) {
  execSync(`git ${args}`, { cwd, env: GIT_ENV, stdio: "inherit" });
}

console.log(`🗂  项目根目录: ${ROOT_DIR}`);
console.log(`📁 临时目录:   ${TMP_DIR}`);
console.log("");

// ── 清理并重建 tmp/ ──────────────────────────────────────────────────────────
if (fs.existsSync(TMP_DIR)) {
  console.log("🧹 删除已有 tmp/ ...");
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
}
fs.mkdirSync(TMP_DIR, { recursive: true });

// ── 创建源仓库 ────────────────────────────────────────────────────────────────
console.log(`🔧 初始化源仓库 bare remote: ${SOURCE_BARE}`);
git(`init --bare "${SOURCE_BARE}"`);

console.log(`🔧 Clone 源仓库到本地工作副本: ${SOURCE_LOCAL}`);
git(`clone "${SOURCE_BARE}" "${SOURCE_LOCAL}"`);

fs.writeFileSync(
  path.join(SOURCE_LOCAL, "README.md"),
  `# Source Repo

这是源仓库，你可以在这里修改文件，然后运行 sync-repos.mjs 测试同步。

## 使用方法

1. 修改此目录中的文件
2. 运行 npm run dev:commit 自动提交
3. 运行 npm run dev:sync 验证订阅仓库同步结果
`
);

fs.writeFileSync(path.join(SOURCE_LOCAL, "hello.txt"), "Hello from source repo!\n");

git(`add .`, SOURCE_LOCAL);
git(`commit -m "chore: initial commit"`, SOURCE_LOCAL);
git(`push`, SOURCE_LOCAL);
console.log("✅ 源仓库就绪\n");

// ── 创建订阅仓库 ──────────────────────────────────────────────────────────────
console.log(`🔧 Clone 订阅仓库: ${SUBSCRIBER_DIR}`);
git(`clone "${SOURCE_BARE}" "${SUBSCRIBER_DIR}"`);
console.log("✅ 订阅仓库就绪\n");

// ── 完成提示 ──────────────────────────────────────────────────────────────────
console.log("═══════════════════════════════════════════════════════");
console.log("🎉 仓库初始化完成！");
console.log("");
console.log(`  源仓库（可手动修改）: ${SOURCE_LOCAL}`);
console.log(`  订阅仓库（同步目标）: ${SUBSCRIBER_DIR}`);
console.log("");
console.log("👉 下一步：");
console.log(`  1. 进入源仓库做修改：`);
console.log(`       cd ${SOURCE_LOCAL}`);
console.log(`       echo 'new change' >> hello.txt`);
console.log("");
console.log("  2. 提交变更：");
console.log("       npm run dev:commit");
console.log("");
console.log("  3. 同步到订阅仓库：");
console.log("       npm run dev:sync");
console.log("═══════════════════════════════════════════════════════");
