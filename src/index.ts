import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

export interface GitSyncdOptions {
  /** 目标仓库的目录路径，默认为当前工作目录 */
  cwd?: string;
  /**
   * 远程仓库地址。当 `cwd` 尚不是 git 仓库时必填，将执行 `git clone`。
   * 若本地已是 git 仓库，则忽略（继续同步）。
   */
  url?: string;
  /**
   * 分支名。clone 时使用；若显式传入，也会在已有仓库上先 checkout 再同步。
   * 默认为 `main`。
   */
  branch?: string;
  /**
   * 确认本地落后远端后，若快进更新因本地变更失败，是否强制丢弃本地更改并对齐远端。
   * 默认为 true。已是最新时不会触碰工作区。
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

/** 底层：执行 git reset --hard HEAD 并 git clean -fd，丢弃所有本地变更（含未追踪文件） */
async function runResetHard(cwd: string): Promise<void> {
  await runGit(cwd, ["reset", "--hard", "HEAD"]);
  await runGit(cwd, ["clean", "-fd"]);
}

/** 当前分支名 */
async function getCurrentBranch(cwd: string): Promise<string | null> {
  const result = await runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  return result.ok ? result.stdout : null;
}

/** 解析用于对齐的远端 tip（@{u} 或 origin/<branch>） */
async function resolveUpstreamRef(cwd: string): Promise<{ ref: string } | { error: string }> {
  const upstream = await runGit(cwd, ["rev-parse", "--abbrev-ref", "@{u}"]);
  if (upstream.ok) {
    return { ref: "@{u}" };
  }

  const branch = await getCurrentBranch(cwd);
  if (!branch || branch === "HEAD") {
    return { error: upstream.message };
  }

  const originTip = await runGit(cwd, ["rev-parse", `origin/${branch}`]);
  if (originTip.ok) {
    return { ref: `origin/${branch}` };
  }

  return { error: originTip.message };
}

/** 本地相对 upstream 落后的 commit 数，并带回已解析的 tip ref */
async function getBehindCount(
  cwd: string
): Promise<{ count: number; ref: string } | { error: string }> {
  const upstream = await resolveUpstreamRef(cwd);
  if ("error" in upstream) {
    return { error: upstream.error };
  }

  const result = await runGit(cwd, ["rev-list", "--count", `HEAD..${upstream.ref}`]);
  /* istanbul ignore next -- resolve 成功后 rev-list 仍失败的窗口极窄 */
  if (!result.ok) {
    return { error: result.message || "Cannot compare with upstream" };
  }

  return { count: parseInt(result.stdout, 10) || 0, ref: upstream.ref };
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

/** 切换到指定分支（必要时依赖已 fetch 的 origin/<branch>） */
async function ensureBranch(cwd: string, branch: string, force: boolean): Promise<void> {
  const current = await runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (current.ok && current.stdout === branch) {
    return;
  }

  let checkout = await runGit(cwd, ["checkout", branch]);
  if (checkout.ok) {
    return;
  }

  if (force) {
    await runResetHard(cwd);
  }

  checkout = await runGit(cwd, ["checkout", "-B", branch, `origin/${branch}`]);
  if (checkout.ok) {
    return;
  }

  throw new Error(checkout.message);
}

/**
 * 通过子进程同步指定目录的 git 仓库。
 *
 * - 若 `cwd` 尚不是 git 仓库且提供了 `url`，则 `git clone -b <branch>` 初始化；
 * - 否则先 `git fetch`，比较是否落后远端；仅在落后时快进更新。
 * - 若 `force` 为 true（默认），更新因本地变更失败时会先
 *   `git reset --hard HEAD` + `git clean -fd`，再对齐远端 tip。
 * - 已是最新时不会修改工作区（即使存在本地未提交变更）。
 *
 * @returns clone 成功时为 `true`；同步后 HEAD 变化则为 `true`，否则 `false`
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

  // 先 fetch，再用远端引用判断是否落后（避免无更新时仍 pull / 误 force）
  const fetch = await runGit(cwd, ["fetch", "origin"]);
  if (!fetch.ok) {
    throw new Error(fetch.message);
  }

  // 仅在调用方显式传入 branch 时切换，避免默认 main 破坏已有仓库的当前分支
  if (options.branch !== undefined) {
    await ensureBranch(cwd, branch, force);
  }

  const behind = await getBehindCount(cwd);
  if ("error" in behind) {
    throw new Error(behind.error);
  }

  if (behind.count === 0) {
    const headAfter = await getHead(cwd);
    return headBefore !== null && headAfter !== null && headBefore !== headAfter;
  }

  // 已确认落后：用已 fetch 的 tip 快进，不再二次 pull/fetch
  let update = await runGit(cwd, ["merge", "--ff-only", behind.ref]);
  if (!update.ok && force) {
    await runResetHard(cwd);
    update = await runGit(cwd, ["reset", "--hard", behind.ref]);
  }

  if (!update.ok) {
    throw new Error(update.message);
  }

  const headAfter = await getHead(cwd);
  return headBefore !== null && headAfter !== null && headBefore !== headAfter;
}

export default gitSyncd;
