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
   * 要同步的目标分支（与当前 checkout 无关）。
   * clone 时作为初始分支；已有仓库时只推进该分支的 tip，不会 checkout。
   * 默认为 `main`。
   */
  branch?: string;
  /**
   * 目标分支 tip 与远端不一致且无法快进时，是否强制将对齐到远端 tip。
   * 若当前正检出于目标分支，还会 `reset --hard` / `clean` 工作区；
   * 若当前不在目标分支，仅更新 `refs/heads/<branch>`，不改 HEAD/工作区。
   * 目标 tip 已与远端一致时不会触碰工作区。默认为 true。
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

/** 解析 ref 的 commit SHA，失败时返回 null */
async function resolveRef(cwd: string, ref: string): Promise<string | null> {
  const result = await runGit(cwd, ["rev-parse", ref]);
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

/**
 * 当前分支名。
 * 优先 `symbolic-ref`（覆盖尚未产生提交的 unborn 分支）；
 * detached HEAD 时回退 `rev-parse`（得到 `"HEAD"`）。
 */
async function getCurrentBranch(cwd: string): Promise<string | null> {
  const symbolic = await runGit(cwd, ["symbolic-ref", "--short", "HEAD"]);
  if (symbolic.ok) {
    return symbolic.stdout;
  }
  const result = await runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  return result.ok ? result.stdout : null;
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

/**
 * 仅更新目标分支 ref 到 tipSha（不 checkout）。
 * 本地尚无该分支时等价于创建。
 */
async function updateTargetRef(cwd: string, branch: string, tipSha: string): Promise<CmdOutcome> {
  return runGit(cwd, ["update-ref", `refs/heads/${branch}`, tipSha]);
}

/**
 * 当前正检出于目标分支时：快进或强制对齐工作区到远端 tip。
 */
async function syncCheckedOutTarget(
  cwd: string,
  upstreamRef: string,
  canFastForward: boolean,
  force: boolean
): Promise<CmdOutcome> {
  if (canFastForward) {
    const update = await runGit(cwd, ["merge", "--ff-only", upstreamRef]);
    if (update.ok || !force) {
      return update;
    }
    await runResetHard(cwd);
    return runGit(cwd, ["reset", "--hard", upstreamRef]);
  }

  if (!force) {
    return { ok: false, message: "Not possible to fast-forward to upstream tip" };
  }

  await runResetHard(cwd);
  return runGit(cwd, ["reset", "--hard", upstreamRef]);
}

/**
 * 通过子进程同步指定目录的 git 仓库。
 *
 * - 目标分支为 `branch`（默认 `main`），与当前 checkout 无关；
 * - 若 `cwd` 尚不是 git 仓库且提供了 `url`，则 `git clone -b <branch>` 初始化；
 * - 否则 `git fetch` 后推进目标分支 tip 至 `origin/<branch>`（快进；`force` 时允许硬对齐）；
 * - **不会** `checkout` / 切换当前分支；
 * - 仅当当前正检出于目标分支时，才会更新工作区；否则只更新 `refs/heads/<branch>`。
 * - 目标 tip 已与远端一致时不会修改工作区（即使存在本地未提交变更）。
 *
 * @returns clone 成功，或目标分支 tip 发生变化时为 `true`，否则 `false`
 * @throws 同步失败时抛出 Error
 */
async function gitSyncd(options: GitSyncdOptions = {}): Promise<boolean> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const force = options.force !== false; // 默认 true
  const branch = options.branch ?? "main";
  const url = options.url;
  const upstreamRef = `origin/${branch}`;
  const localRef = `refs/heads/${branch}`;

  if (!(await isGitRepo(cwd))) {
    if (!url) {
      throw new Error(`not a git repository: ${cwd}. Pass options.url to clone and initialize.`);
    }
    await runClone(url, cwd, branch);
    return true;
  }

  const tipBefore = await resolveRef(cwd, localRef);

  const fetch = await runGit(cwd, ["fetch", "origin"]);
  if (!fetch.ok) {
    throw new Error(fetch.message);
  }

  const remoteTip = await resolveRef(cwd, upstreamRef);
  if (!remoteTip) {
    const probe = await runGit(cwd, ["rev-parse", upstreamRef]);
    throw new Error((!probe.ok && probe.message) || `Cannot resolve ${upstreamRef}`);
  }

  if (tipBefore !== null && tipBefore === remoteTip) {
    // 目标分支已与远端 tip 一致：不触碰工作区（含本地脏文件）
    return false;
  }

  const currentBranch = await getCurrentBranch(cwd);
  const onTarget = currentBranch === branch;

  // 本地尚无目标分支：创建 ref；若碰巧已在该分支名上（空仓库），则硬对齐工作区
  if (tipBefore === null) {
    if (onTarget) {
      await runResetHard(cwd);
      const reset = await runGit(cwd, ["reset", "--hard", upstreamRef]);
      if (!reset.ok) {
        throw new Error(reset.message);
      }
    } else {
      const created = await updateTargetRef(cwd, branch, remoteTip);
      if (!created.ok) {
        throw new Error(created.message);
      }
    }
    return true;
  }

  const mergeBase = await runGit(cwd, ["merge-base", localRef, upstreamRef]);
  const canFastForward = mergeBase.ok && mergeBase.stdout === tipBefore;

  let update: CmdOutcome;
  if (onTarget) {
    update = await syncCheckedOutTarget(cwd, upstreamRef, canFastForward, force);
  } else if (canFastForward || force) {
    update = await updateTargetRef(cwd, branch, remoteTip);
  } else {
    throw new Error(
      mergeBase.ok ? "Not possible to fast-forward to upstream tip" : mergeBase.message
    );
  }

  if (!update.ok) {
    throw new Error(update.message);
  }

  const tipAfter = await resolveRef(cwd, localRef);
  return tipAfter !== null && tipBefore !== tipAfter;
}

export default gitSyncd;
