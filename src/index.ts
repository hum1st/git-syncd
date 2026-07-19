import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

export interface GitSyncdOptions {
  /** 目标仓库的目录路径，默认为当前工作目录 */
  cwd?: string;
  /**
   * 远程仓库地址。当 `cwd` 尚不是 git 仓库时必填，将执行 `git clone`。
   * 若本地已是 git 仓库，则忽略（继续 pull）。
   */
  url?: string;
  /**
   * 分支名。clone 时使用；若显式传入，也会在已有仓库上先 checkout 再 pull。
   * 默认为 `main`。
   */
  branch?: string;
  /**
   * 若 git pull 因本地变更冲突而失败，是否强制丢弃所有本地更改后重新拉取。
   * 默认为 true。
   */
  force?: boolean;
}

type CmdOutcome = { ok: true; stdout: string } | { ok: false; message: string };

/** 底层：执行一次 git 命令 */
function runGit(cwd: string, args: string[]): Promise<CmdOutcome> {
  return new Promise((resolve) => {
    const child = spawn("git", args, {
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
        resolve({ ok: true, stdout: stdout.trim() });
        return;
      }
      resolve({
        ok: false,
        message: (stderr || stdout).trim() || `git ${args.join(" ")} failed`,
      });
    });

    /* istanbul ignore next -- spawn ENOENT 等环境错误，单测难以稳定触发 */
    child.on("error", (err: Error) => {
      resolve({ ok: false, message: err.message });
    });
  });
}

/** 获取当前 HEAD commit hash，失败时返回 null */
async function getHead(cwd: string): Promise<string | null> {
  const result = await runGit(cwd, ["rev-parse", "HEAD"]);
  return result.ok ? result.stdout : null;
}

/** 判断目录是否为 git 仓库 */
async function isGitRepo(cwd: string): Promise<boolean> {
  if (!fs.existsSync(cwd)) {
    return false;
  }
  const result = await runGit(cwd, ["rev-parse", "--git-dir"]);
  return result.ok;
}

/** 底层：执行一次 git pull */
function runPull(cwd: string): Promise<CmdOutcome> {
  return runGit(cwd, ["pull"]);
}

/** 底层：执行 git reset --hard HEAD 并 git clean -fd，丢弃所有本地变更（含未追踪文件） */
async function runResetHard(cwd: string): Promise<void> {
  await runGit(cwd, ["reset", "--hard", "HEAD"]);
  await runGit(cwd, ["clean", "-fd"]);
}

/** clone 远程仓库到 cwd（-b branch） */
async function runClone(url: string, cwd: string, branch: string): Promise<void> {
  const parent = path.dirname(cwd);
  fs.mkdirSync(parent, { recursive: true });

  const result = await runGit(parent, ["clone", "-b", branch, "--", url, cwd]);
  if (!result.ok) {
    throw new Error(result.message);
  }
}

/** 切换到指定分支（必要时 fetch） */
async function ensureBranch(cwd: string, branch: string, force: boolean): Promise<void> {
  const current = await runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (current.ok && current.stdout === branch) {
    return;
  }

  let checkout = await runGit(cwd, ["checkout", branch]);
  if (checkout.ok) {
    return;
  }

  await runGit(cwd, ["fetch", "origin", branch]);
  checkout = await runGit(cwd, ["checkout", branch]);
  if (checkout.ok) {
    return;
  }

  if (force) {
    await runResetHard(cwd);
    checkout = await runGit(cwd, ["checkout", "-B", branch, `origin/${branch}`]);
    if (checkout.ok) {
      return;
    }
  }

  throw new Error(checkout.message);
}

/**
 * 通过子进程同步指定目录的 git 仓库。
 *
 * - 若 `cwd` 尚不是 git 仓库且提供了 `url`，则 `git clone -b <branch>` 初始化；
 * - 否则执行 `git pull`；若 `force` 为 true（默认），拉取失败时会先
 *   `git reset --hard HEAD` 丢弃本地变更，再重试一次 `git pull`。
 *
 * @returns clone 成功时为 `true`；pull 时若 HEAD 变化则为 `true`，否则 `false`
 * @throws 同步失败时抛出 Error
 */
async function gitSyncd(options: GitSyncdOptions = {}): Promise<boolean> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const force = options.force !== false; // 默认 true
  const branch = options.branch ?? "main";
  const url = options.url;

  if (!(await isGitRepo(cwd))) {
    if (!url) {
      throw new Error(`not a git repository: ${cwd}. Pass options.url to clone and initialize.`);
    }
    await runClone(url, cwd, branch);
    return true;
  }

  const headBefore = await getHead(cwd);

  // 仅在调用方显式传入 branch 时切换，避免默认 main 破坏已有仓库的当前分支
  if (options.branch !== undefined) {
    await ensureBranch(cwd, branch, force);
  }

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
