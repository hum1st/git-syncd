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
  stdout: string;
  stderr: string;
  exitCode: number;
  /** 是否触发了强制重置（force=true 且初次 pull 失败时） */
  forceReset?: boolean;
}

export interface GitSyncdJobOptions extends GitSyncdOptions {
  /**
   * 同步间隔，单位毫秒。
   * 推荐值：30000（30 秒）—— 对系统压力极低，同时保持足够高的同步频率。
   * 默认值：30000。
   */
  interval?: number;
  /** 每次同步完成后的回调，可用于日志记录或错误上报 */
  onSync?: (result: GitSyncdResult) => void;
}

export interface GitSyncdJob {
  /** 停止定时同步 */
  stop: () => void;
}

/** 底层：执行一次 git pull，返回结果 */
function runPull(cwd: string, args: string[]): Promise<GitSyncdResult> {
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
export async function gitSyncd(options: GitSyncdOptions = {}): Promise<GitSyncdResult> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const args = options.args ?? [];
  const force = options.force !== false; // 默认 true

  const result = await runPull(cwd, args);

  if (!result.success && force) {
    // 强制丢弃本地变更后重试
    await runResetHard(cwd);
    const retryResult = await runPull(cwd, args);
    return { ...retryResult, forceReset: true };
  }

  return result;
}

/**
 * 启动一个定时同步 Job，立即执行一次同步，之后每隔 `interval` 毫秒再次同步。
 *
 * 推荐间隔为 30000 ms（30 秒），在几乎不占用系统资源的前提下保持足够高的同步频率。
 *
 * @example
 * const job = gitSyncdJob({ cwd: '/path/to/repo', interval: 30000 });
 * // 需要停止时：
 * job.stop();
 */
export function gitSyncdJob(options: GitSyncdJobOptions = {}): GitSyncdJob {
  const { onSync, interval = 30_000, ...syncOptions } = options;

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function tick(): Promise<void> {
    if (stopped) return;
    const result = await gitSyncd(syncOptions);
    if (onSync) onSync(result);
    if (!stopped) {
      timer = setTimeout(tick, interval);
    }
  }

  // 立即执行第一次
  void tick();

  return {
    stop() {
      stopped = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
