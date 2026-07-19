#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// sync-repos.mjs
//
// 调用 git-syncd 核心库，将 tmp/subscriber 仓库同步到最新状态。
//
// 运行前请确保已执行过 setup-repos.mjs，且 dist/ 已编译。
// 如尚未编译，脚本会自动尝试执行 npm run build。
// ─────────────────────────────────────────────────────────────────────────────

import { execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_ENTRY = path.join(ROOT_DIR, "dist", "esm", "index.js");
const SUBSCRIBER_DIR = path.join(ROOT_DIR, "tmp", "subscriber");
const SOURCE_LOCAL = path.join(ROOT_DIR, "tmp", "source-repo");

// ── 检查 tmp/ 是否存在 ────────────────────────────────────────────────────────
if (!fs.existsSync(SUBSCRIBER_DIR)) {
  console.error("❌ 订阅仓库不存在，请先运行：npm run dev:setup");
  process.exit(1);
}

// ── 确保 dist/ 已编译 ─────────────────────────────────────────────────────────
if (!fs.existsSync(DIST_ENTRY)) {
  console.log("📦 dist/ 不存在，先执行 npm run build ...");
  try {
    execSync("npm run build", { cwd: ROOT_DIR, stdio: "inherit" });
  } catch {
    console.error("❌ 编译失败，请检查 TypeScript 错误");
    process.exit(1);
  }
}

// ── 加载编译后的库（ESM 动态 import）─────────────────────────────────────────
const { default: gitSyncd } = await import(pathToFileURL(DIST_ENTRY).href);

// ── 展示仓库最近提交 ──────────────────────────────────────────────────────────
function logRepoStatus(label, dir) {
  const result = spawnSync("git", ["log", "--oneline", "-5"], { cwd: dir, encoding: "utf8" });
  if (result.status === 0 && result.stdout.trim()) {
    console.log(`\n📋 ${label} (${dir}) 最近提交：`);
    result.stdout
      .trim()
      .split("\n")
      .forEach((l) => console.log(`   ${l}`));
  } else {
    console.log(`\n⚠️  无法读取 ${label} 的提交记录`);
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("🔄 git-syncd — 同步测试脚本");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  订阅仓库: ${SUBSCRIBER_DIR}`);
  console.log(`  源仓库:   ${SOURCE_LOCAL}`);

  logRepoStatus("同步前 — 订阅仓库", SUBSCRIBER_DIR);
  logRepoStatus("同步前 — 源仓库  ", SOURCE_LOCAL);

  // ── 执行同步 ────────────────────────────────────────────────────────────────
  console.log("\n⏳ 正在执行 gitSyncd ...");
  const updated = await gitSyncd({ cwd: SUBSCRIBER_DIR });

  console.log("\n─── 同步结果 ───────────────────────────────────────────");
  console.log(`  updated  : ${updated}`);

  logRepoStatus("同步后 — 订阅仓库", SUBSCRIBER_DIR);

  // ── 列出订阅仓库文件 ────────────────────────────────────────────────────────
  const files = fs.readdirSync(SUBSCRIBER_DIR).filter((f) => f !== ".git");
  console.log(`\n📁 订阅仓库当前文件: ${files.join(", ") || "(空)"}`);

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("✅ 同步成功！");
}

main().catch((err) => {
  console.error("❌ 同步失败:", err instanceof Error ? err.message : err);
  process.exit(1);
});
