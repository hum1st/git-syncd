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
   * 确认需要更新（HEAD 与远端 tip 不一致）后，若快进失败，是否强制丢弃本地更改并对齐远端。
   * 覆盖本地脏文件、历史改写/发散等情况。默认为 true。
   * HEAD 已与远端 tip 一致时不会触碰工作区。
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

/** 解析 upstream tip 的 SHA 与用于对齐的 ref */
async function resolveUpstreamTip(
  cwd: string
): Promise<{ sha: string; ref: string } | { error: string }> {
  const upstream = await resolveUpstreamRef(cwd);
  if ("error" in upstream) {
    return { error: upstream.error };
  }

  const tip = await runGit(cwd, ["rev-parse", upstream.ref]);
  /* istanbul ignore next -- resolve 成功后 tip 仍失败的窗口极窄 */
  if (!tip.ok) {
    return { error: tip.message || "Cannot resolve upstream tip" };
  }

  return { sha: tip.stdout, ref: upstream.ref };
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
 * - 否则先 `git fetch`，比较 HEAD 与远端 tip；不一致时快进更新。
 * - 若 `force` 为 true（默认），快进失败（本地脏文件、历史改写/发散等）时会先
 *   `git reset --hard HEAD` + `git clean -fd`，再对齐远端 tip。
 * - HEAD 已与远端 tip 一致时不会修改工作区（即使存在本地未提交变更）。
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

  // 先 fetch，再用远端 tip 判断是否需要对齐（避免已一致时仍 pull / 误 force）
  const fetch = await runGit(cwd, ["fetch", "origin"]);
  if (!fetch.ok) {
    throw new Error(fetch.message);
  }

  // 仅在调用方显式传入 branch 时切换，避免默认 main 破坏已有仓库的当前分支
  if (options.branch !== undefined) {
    await ensureBranch(cwd, branch, force);
  }

  const upstream = await resolveUpstreamTip(cwd);
  if ("error" in upstream) {
    throw new Error(upstream.error);
  }

  const headNow = await getHead(cwd);
  if (headNow !== null && headNow === upstream.sha) {
    // 已与远端 tip 一致：不触碰工作区（含本地脏文件）
    return headBefore !== null && headBefore !== headNow;
  }

  // tip 为 HEAD 后代时可快进；否则（改写 / rewind / 发散）merge --ff-only 可能
  // 「Already up to date」却不移动 HEAD，需显式判断后再硬对齐
  const mergeBase =
    headNow !== null
      ? await runGit(cwd, ["merge-base", "HEAD", upstream.ref])
      : ({ ok: false, message: "no HEAD" } as const);
  const canFastForward = mergeBase.ok && headNow !== null && mergeBase.stdout === headNow;

  let update: CmdOutcome;
  if (canFastForward) {
    update = await runGit(cwd, ["merge", "--ff-only", upstream.ref]);
    if (!update.ok && force) {
      await runResetHard(cwd);
      update = await runGit(cwd, ["reset", "--hard", upstream.ref]);
    }
  } else if (force) {
    await runResetHard(cwd);
    update = await runGit(cwd, ["reset", "--hard", upstream.ref]);
  } else {
    throw new Error(
      mergeBase.ok ? "Not possible to fast-forward to upstream tip" : mergeBase.message
    );
  }

  if (!update.ok) {
    throw new Error(update.message);
  }

  const headAfter = await getHead(cwd);
  return headBefore !== null && headAfter !== null && headBefore !== headAfter;
}

export default gitSyncd;
