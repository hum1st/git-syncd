import { spawn } from "child_process";
import * as path from "path";

export interface GitSyncdOptions {
  /** 目标仓库的目录路径，默认为当前工作目录 */
  cwd?: string;
  /** 额外的 git pull 参数 */
  args?: string[];
  /**
   * 若 git pull 因本地变更冲突而失败，是否强制丢弃所有本地更改后重新拉取。
   * 默认为 true。
   */
  force?: boolean;
}

export interface GitSyncdResult {
  success: boolean;
  /** 是否拉取到了新的提交（HEAD 发生变化） */
  updated: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  /** 是否触发了强制重置（force=true 且初次 pull 失败时） */
  forceReset?: boolean;
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

/** 底层：执行一次 git pull，返回结果（不含 updated） */
function runPull(cwd: string, args: string[]): Promise<Omit<GitSyncdResult, "updated">> {
  return new Promise((resolve) => {
    const child = spawn("git", ["pull", ...args], {
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
      const code = exitCode ?? 1;
      resolve({ success: code === 0, stdout, stderr, exitCode: code });
    });

    child.on("error", (err: Error) => {
      resolve({ success: false, stdout, stderr: stderr + err.message, exitCode: 1 });
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
 */
async function gitSyncd(options: GitSyncdOptions = {}): Promise<GitSyncdResult> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const args = options.args ?? [];
  const force = options.force !== false; // 默认 true

  const headBefore = await getHead(cwd);
  const result = await runPull(cwd, args);

  if (!result.success && force) {
    // 强制丢弃本地变更后重试
    await runResetHard(cwd);
    const retryResult = await runPull(cwd, args);
    const headAfter = retryResult.success ? await getHead(cwd) : null;
    const updated =
      retryResult.success && headBefore !== null && headAfter !== null && headBefore !== headAfter;
    return { ...retryResult, updated, forceReset: true };
  }

  const headAfter = result.success ? await getHead(cwd) : null;
  const updated =
    result.success && headBefore !== null && headAfter !== null && headBefore !== headAfter;

  return { ...result, updated };
}

export default gitSyncd;
