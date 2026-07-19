import { spawn } from "child_process";
import * as path from "path";

export interface GitSyncdOptions {
  /** 目标仓库的目录路径，默认为当前工作目录 */
  cwd?: string;
  /**
   * 若 git pull 因本地变更冲突而失败，是否强制丢弃所有本地更改后重新拉取。
   * 默认为 true。
   */
  force?: boolean;
}

/** 底层：执行一次 git 命令，返回 stdout（失败时返回 null） */
function runGit(cwd: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      windowsHide: true,
    });

    let stdout = "";

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.on("close", (exitCode: number | null) => {
      resolve(exitCode === 0 ? stdout.trim() : null);
    });

    child.on("error", () => {
      resolve(null);
    });
  });
}

/** 获取当前 HEAD commit hash，失败时返回 null */
function getHead(cwd: string): Promise<string | null> {
  return runGit(cwd, ["rev-parse", "HEAD"]);
}

type PullOutcome = { ok: true } | { ok: false; message: string };

/** 底层：执行一次 git pull */
function runPull(cwd: string): Promise<PullOutcome> {
  return new Promise((resolve) => {
    const child = spawn("git", ["pull"], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (exitCode: number | null) => {
      if (exitCode === 0) {
        resolve({ ok: true });
        return;
      }
      resolve({ ok: false, message: (stderr || stdout).trim() || "git pull failed" });
    });

    child.on("error", (err: Error) => {
      resolve({ ok: false, message: err.message });
    });
  });
}

/** 底层：执行 git reset --hard HEAD 并 git clean -fd，丢弃所有本地变更（含未追踪文件） */
function runResetHard(cwd: string): Promise<void> {
  const spawnOpts = {
    cwd,
    stdio: ["ignore", "pipe", "pipe"] as ["ignore", "pipe", "pipe"],
    shell: false,
    windowsHide: true,
  };
  return new Promise((resolve) => {
    const reset = spawn("git", ["reset", "--hard", "HEAD"], spawnOpts);

    function runClean() {
      const clean = spawn("git", ["clean", "-fd"], spawnOpts);
      clean.on("close", () => resolve());
      clean.on("error", () => resolve());
    }

    reset.on("close", () => runClean());
    // error 事件不一定触发 close，需单独处理
    reset.on("error", () => runClean());
  });
}

/**
 * 通过子进程执行 git pull，使指定目录的 git 仓库保持同步。
 *
 * 若 `force` 为 true（默认），拉取失败时会先 `git reset --hard HEAD` 丢弃本地变更，
 * 再重试一次 `git pull`，确保远端代码始终能被同步下来。
 *
 * @returns 是否拉取到了新的提交（HEAD 发生变化）
 * @throws 同步失败时抛出 Error
 */
async function gitSyncd(options: GitSyncdOptions = {}): Promise<boolean> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const force = options.force !== false; // 默认 true

  const headBefore = await getHead(cwd);
  let pull = await runPull(cwd);

  if (!pull.ok && force) {
    // 强制丢弃本地变更后重试
    await runResetHard(cwd);
    pull = await runPull(cwd);
  }

  if (!pull.ok) {
    throw new Error(pull.message);
  }

  const headAfter = await getHead(cwd);
  return headBefore !== null && headAfter !== null && headBefore !== headAfter;
}

export default gitSyncd;
