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
   * 若当前正检出于目标分支，还会更新工作区；
   * 若当前不在目标分支，仅更新 `refs/heads/<branch>`，不改 HEAD/工作区。
   * 目标 tip 已与远端一致时不会触碰工作区（Windows 下工作区为空时除外）。
   * 默认为 true。
   */
  force?: boolean;
}

type CmdOutcome = { ok: true; stdout: string } | { ok: false; message: string };

/** Windows 文件名非法字符（路径段内） */
const WIN_ILLEGAL = /[*?"<>|:]/g;

function isWindows(): boolean {
  return process.platform === "win32";
}

const GIT_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
};

/** 底层：执行一次 git 命令 */
function runGit(cwd: string, args: string[]): Promise<CmdOutcome> {
  return new Promise((resolve) => {
    const child = spawn("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      windowsHide: true,
      env: GIT_ENV,
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

/** 工作区是否除 `.git` 外还有内容 */
function hasWorktreeFiles(cwd: string): boolean {
  try {
    return fs.readdirSync(cwd).some((name) => name !== ".git");
  } catch {
    return false;
  }
}

/** 清空工作区（保留 `.git`） */
function clearWorktree(cwd: string): void {
  for (const name of fs.readdirSync(cwd)) {
    if (name === ".git") continue;
    fs.rmSync(path.join(cwd, name), { recursive: true, force: true });
  }
}

/** 清洗 Windows 非法路径段；若整段被清空则跳过 */
export function sanitizeWindowsPath(repoPath: string): string {
  return repoPath
    .split("/")
    .map((seg) => seg.replace(WIN_ILLEGAL, "").trim())
    .filter(Boolean)
    .join("/");
}

/**
 * Windows：不经 checkout，按 blob 将 ref 树物化到工作区。
 * 路径中的非法字符会被剥离（与常见 docs 镜像策略一致）。
 */
async function materializeWorktreeWindows(cwd: string, ref: string): Promise<void> {
  const list = await runGit(cwd, [
    "-c",
    "core.quotePath=false",
    "ls-tree",
    "-r",
    "--name-only",
    ref,
  ]);
  if (!list.ok) {
    throw new Error(list.message);
  }

  clearWorktree(cwd);

  const files = list.stdout.split("\n").filter(Boolean);
  for (const file of files) {
    const safe = sanitizeWindowsPath(file);
    if (!safe) continue;

    const outPath = path.join(cwd, ...safe.split("/"));
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    const blob = await new Promise<Buffer>((resolve, reject) => {
      const child = spawn(
        "git",
        ["-c", "core.quotePath=false", "cat-file", "blob", `${ref}:${file}`],
        {
          cwd,
          stdio: ["ignore", "pipe", "pipe"],
          shell: false,
          windowsHide: true,
          env: GIT_ENV,
        }
      );
      const chunks: Buffer[] = [];
      let stderr = "";
      child.stdout.on("data", (d: Buffer) => chunks.push(d));
      child.stderr.on("data", (d: Buffer) => {
        stderr += d.toString();
      });
      child.on("close", (code) => {
        if (code === 0) resolve(Buffer.concat(chunks));
        else reject(new Error(stderr.trim() || `git cat-file blob failed for ${file}`));
      });
      /* istanbul ignore next */
      child.on("error", reject);
    });

    fs.writeFileSync(outPath, blob);
  }
}

/** clone 远程仓库到 cwd（-b branch）；Windows 使用 --no-checkout 再物化 */
async function runClone(url: string, cwd: string, branch: string): Promise<void> {
  const parent = path.dirname(cwd);
  fs.mkdirSync(parent, { recursive: true });

  const args = isWindows()
    ? ["clone", "--no-checkout", "-b", branch, "--", url, cwd]
    : ["clone", "-b", branch, "--", url, cwd];

  const result = await runGit(parent, args);
  if (!result.ok) {
    throw new Error(result.message);
  }

  if (isWindows()) {
    await materializeWorktreeWindows(cwd, "HEAD");
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
 * Windows 避免 `reset --hard`（非法路径会失败），改为 update-ref + 物化。
 */
async function syncCheckedOutTarget(
  cwd: string,
  branch: string,
  upstreamRef: string,
  tipSha: string,
  canFastForward: boolean,
  force: boolean
): Promise<CmdOutcome> {
  if (isWindows()) {
    if (!canFastForward && !force) {
      return { ok: false, message: "Not possible to fast-forward to upstream tip" };
    }
    const updated = await updateTargetRef(cwd, branch, tipSha);
    if (!updated.ok) return updated;
    try {
      await materializeWorktreeWindows(cwd, tipSha);
      return { ok: true, stdout: "" };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

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
 * - 若 `cwd` 尚不是 git 仓库且提供了 `url`，则 `git clone -b <branch>` 初始化
 *   （Windows 为 `--no-checkout` + 安全物化工作区）；
 * - 否则 `git fetch` 后推进目标分支 tip 至 `origin/<branch>`（快进；`force` 时允许硬对齐）；
 * - **不会** `checkout` / 切换当前分支；
 * - 仅当当前正检出于目标分支时，才会更新工作区；否则只更新 `refs/heads/<branch>`。
 * - 目标 tip 已与远端一致时不会修改工作区（Windows 下工作区为空时会补物化）。
 *
 * @returns clone 成功，或目标分支 tip 发生变化（或 Windows 补物化）时为 `true`，否则 `false`
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

  const currentBranch = await getCurrentBranch(cwd);
  const onTarget = currentBranch === branch;

  if (tipBefore !== null && tipBefore === remoteTip) {
    // tip 已对齐：通常不触碰工作区；Windows 且在目标分支上但工作区为空时补物化
    if (isWindows() && onTarget && !hasWorktreeFiles(cwd)) {
      await materializeWorktreeWindows(cwd, remoteTip);
      return true;
    }
    return false;
  }

  // 本地尚无目标分支：创建 ref；若碰巧已在该分支名上，则对齐工作区
  if (tipBefore === null) {
    if (onTarget) {
      if (isWindows()) {
        const created = await updateTargetRef(cwd, branch, remoteTip);
        if (!created.ok) throw new Error(created.message);
        await materializeWorktreeWindows(cwd, remoteTip);
      } else {
        await runResetHard(cwd);
        const reset = await runGit(cwd, ["reset", "--hard", upstreamRef]);
        if (!reset.ok) {
          throw new Error(reset.message);
        }
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
    update = await syncCheckedOutTarget(cwd, branch, upstreamRef, remoteTip, canFastForward, force);
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
