import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";
import gitSyncd from "../src/index";

// 在临时目录创建一个 bare 仓库作为"远端"，再 clone 为本地工作仓库
function setupRepos(): { bareDir: string; localDir: string; cleanUp: () => void } {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-test-"));
  const bareDir = path.join(base, "remote.git");
  const localDir = path.join(base, "local");

  // 初始化裸仓库，默认分支设为 main
  execSync(`git init --bare "${bareDir}"`);
  execSync("git symbolic-ref HEAD refs/heads/main", { cwd: bareDir });

  // clone 到本地目录
  execSync(`git clone "${bareDir}" "${localDir}"`);

  // 在本地提交初始文件并推送
  const gitEnv = {
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@test.com",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@test.com",
  };
  fs.writeFileSync(path.join(localDir, "init.txt"), "init");
  execSync("git add . && git commit -m 'init'", {
    cwd: localDir,
    env: { ...process.env, ...gitEnv },
  });
  execSync("git branch -M main", { cwd: localDir });
  execSync("git push -u origin main", { cwd: localDir });

  return {
    bareDir,
    localDir,
    cleanUp: () => fs.rmSync(base, { recursive: true, force: true }),
  };
}

describe("gitSyncd", () => {
  let bareDir: string;
  let localDir: string;
  let cleanUp: () => void;

  const gitEnv = {
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@test.com",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@test.com",
  };

  beforeEach(() => {
    ({ bareDir, localDir, cleanUp } = setupRepos());
  });

  afterEach(() => {
    cleanUp();
  });

  test("default export gitSyncd 是函数", () => {
    expect(typeof gitSyncd).toBe("function");
  });

  test("已是最新时返回 false", async () => {
    const updated = await gitSyncd({ cwd: localDir });
    expect(updated).toBe(false);
  });

  test("已是最新时，即使 force=true 也不清掉本地脏文件", async () => {
    fs.writeFileSync(path.join(localDir, "dirty.txt"), "keep me");
    const updated = await gitSyncd({ cwd: localDir, force: true });
    expect(updated).toBe(false);
    expect(fs.existsSync(path.join(localDir, "dirty.txt"))).toBe(true);
    expect(fs.readFileSync(path.join(localDir, "dirty.txt"), "utf8")).toBe("keep me");
  });

  test("有新提交时 pull 成功并同步文件，返回 true", async () => {
    // 在裸仓库侧通过第二个 clone 推送新内容
    const tmpCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-push-"));
    try {
      execSync(`git clone "${bareDir}" "${tmpCloneDir}"`);
      fs.writeFileSync(path.join(tmpCloneDir, "new.txt"), "hello");
      const execOpts = { cwd: tmpCloneDir, env: { ...process.env, ...gitEnv } };
      execSync("git add .", execOpts);
      execSync('git commit -m "add new.txt"', execOpts);
      execSync("git push", { cwd: tmpCloneDir });
    } finally {
      fs.rmSync(tmpCloneDir, { recursive: true, force: true });
    }

    const updated = await gitSyncd({ cwd: localDir });
    expect(updated).toBe(true);
    expect(fs.existsSync(path.join(localDir, "new.txt"))).toBe(true);
  });

  test("无效路径时抛出错误", async () => {
    await expect(gitSyncd({ cwd: "/nonexistent/path/xyz" })).rejects.toThrow();
  });

  test("非 git 仓库时抛出错误", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "not-a-repo-"));
    try {
      await expect(gitSyncd({ cwd: tmpDir })).rejects.toThrow();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("force=true 时，本地有未提交变更冲突，仍能拉取成功并返回 true", async () => {
    // 1. 远端推送新文件 conflict.txt
    const tmpCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-force-"));
    try {
      execSync(`git clone "${bareDir}" "${tmpCloneDir}"`);
      fs.writeFileSync(path.join(tmpCloneDir, "conflict.txt"), "remote content");
      const execOpts = { cwd: tmpCloneDir, env: { ...process.env, ...gitEnv } };
      execSync("git add .", execOpts);
      execSync('git commit -m "add conflict.txt"', execOpts);
      execSync("git push", { cwd: tmpCloneDir });
    } finally {
      fs.rmSync(tmpCloneDir, { recursive: true, force: true });
    }

    // 2. 本地也写一个同名文件（未追踪，会导致 pull 失败）
    fs.writeFileSync(path.join(localDir, "conflict.txt"), "local content");

    // 3. force=true（默认）应能成功
    const updated = await gitSyncd({ cwd: localDir, force: true });
    expect(updated).toBe(true);
    // 远端内容已被拉取
    expect(fs.readFileSync(path.join(localDir, "conflict.txt"), "utf8")).toBe("remote content");
  });

  test("force=false 时，本地有未提交变更冲突，pull 失败并抛出错误", async () => {
    // 1. 远端推送新文件 conflict2.txt
    const tmpCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-noforce-"));
    try {
      execSync(`git clone "${bareDir}" "${tmpCloneDir}"`);
      fs.writeFileSync(path.join(tmpCloneDir, "conflict2.txt"), "remote content");
      const execOpts = { cwd: tmpCloneDir, env: { ...process.env, ...gitEnv } };
      execSync("git add .", execOpts);
      execSync('git commit -m "add conflict2.txt"', execOpts);
      execSync("git push", { cwd: tmpCloneDir });
    } finally {
      fs.rmSync(tmpCloneDir, { recursive: true, force: true });
    }

    // 2. 本地也写同名文件
    fs.writeFileSync(path.join(localDir, "conflict2.txt"), "local content");

    // 3. force=false 不应重置，应抛出错误
    await expect(gitSyncd({ cwd: localDir, force: false })).rejects.toThrow();
  });

  test("未指定 cwd 时使用 process.cwd()", async () => {
    const prevCwd = process.cwd();
    try {
      process.chdir(localDir);
      const updated = await gitSyncd();
      expect(updated).toBe(false);
    } finally {
      process.chdir(prevCwd);
    }
  });

  test("force 默认开启：未传 force 时冲突仍可强制同步", async () => {
    const tmpCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-default-force-"));
    try {
      execSync(`git clone "${bareDir}" "${tmpCloneDir}"`);
      fs.writeFileSync(path.join(tmpCloneDir, "default-force.txt"), "remote");
      const execOpts = { cwd: tmpCloneDir, env: { ...process.env, ...gitEnv } };
      execSync("git add .", execOpts);
      execSync('git commit -m "add default-force.txt"', execOpts);
      execSync("git push", { cwd: tmpCloneDir });
    } finally {
      fs.rmSync(tmpCloneDir, { recursive: true, force: true });
    }

    fs.writeFileSync(path.join(localDir, "default-force.txt"), "local");
    const updated = await gitSyncd({ cwd: localDir });
    expect(updated).toBe(true);
  });

  test("传入 url 且目标不存在时 clone 初始化，返回 true", async () => {
    const targetDir = path.join(path.dirname(localDir), "fresh-clone");
    const updated = await gitSyncd({ cwd: targetDir, url: bareDir });
    expect(updated).toBe(true);
    expect(fs.existsSync(path.join(targetDir, "init.txt"))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, ".git"))).toBe(true);
  });

  test("传入 url 且目标已是仓库时执行同步", async () => {
    const tmpCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-url-pull-"));
    try {
      execSync(`git clone "${bareDir}" "${tmpCloneDir}"`);
      fs.writeFileSync(path.join(tmpCloneDir, "via-url.txt"), "hello");
      const execOpts = { cwd: tmpCloneDir, env: { ...process.env, ...gitEnv } };
      execSync("git add .", execOpts);
      execSync('git commit -m "add via-url.txt"', execOpts);
      execSync("git push", { cwd: tmpCloneDir });
    } finally {
      fs.rmSync(tmpCloneDir, { recursive: true, force: true });
    }

    const updated = await gitSyncd({ cwd: localDir, url: bareDir });
    expect(updated).toBe(true);
    expect(fs.existsSync(path.join(localDir, "via-url.txt"))).toBe(true);
  });

  test("非 git 仓库且未传 url 时抛出含提示的错误", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "not-a-repo-url-"));
    try {
      await expect(gitSyncd({ cwd: tmpDir })).rejects.toThrow(/options\.url/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("显式传入 branch 时只推进目标分支 tip，不 checkout", async () => {
    // 远端创建 develop 分支并推送新文件
    const tmpCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-branch-"));
    let developTip!: string;
    try {
      execSync(`git clone "${bareDir}" "${tmpCloneDir}"`);
      const execOpts = { cwd: tmpCloneDir, env: { ...process.env, ...gitEnv } };
      execSync("git checkout -b develop", execOpts);
      fs.writeFileSync(path.join(tmpCloneDir, "develop.txt"), "on develop");
      execSync("git add .", execOpts);
      execSync('git commit -m "add develop.txt"', execOpts);
      execSync("git push -u origin develop", { cwd: tmpCloneDir });
      developTip = execSync("git rev-parse HEAD", {
        cwd: tmpCloneDir,
        encoding: "utf8",
      }).trim();
    } finally {
      fs.rmSync(tmpCloneDir, { recursive: true, force: true });
    }

    const updated = await gitSyncd({ cwd: localDir, branch: "develop" });
    expect(updated).toBe(true);
    // 工作区仍在 main，不会出现 develop 文件
    expect(fs.existsSync(path.join(localDir, "develop.txt"))).toBe(false);

    const current = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: localDir,
      encoding: "utf8",
    }).trim();
    expect(current).toBe("main");

    const localDevelop = execSync("git rev-parse refs/heads/develop", {
      cwd: localDir,
      encoding: "utf8",
    }).trim();
    expect(localDevelop).toBe(developTip);
  });

  test("clone 时 branch 默认为 main", async () => {
    const targetDir = path.join(path.dirname(localDir), "clone-default-main");
    await gitSyncd({ cwd: targetDir, url: bareDir });
    const current = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: targetDir,
      encoding: "utf8",
    }).trim();
    expect(current).toBe("main");
  });

  test("clone 时可指定非默认 branch", async () => {
    const tmpCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-clone-branch-"));
    try {
      execSync(`git clone "${bareDir}" "${tmpCloneDir}"`);
      const execOpts = { cwd: tmpCloneDir, env: { ...process.env, ...gitEnv } };
      execSync("git checkout -b feature", execOpts);
      fs.writeFileSync(path.join(tmpCloneDir, "feature.txt"), "feature");
      execSync("git add .", execOpts);
      execSync('git commit -m "add feature.txt"', execOpts);
      execSync("git push -u origin feature", { cwd: tmpCloneDir });
    } finally {
      fs.rmSync(tmpCloneDir, { recursive: true, force: true });
    }

    const targetDir = path.join(path.dirname(localDir), "clone-feature");
    const updated = await gitSyncd({
      cwd: targetDir,
      url: bareDir,
      branch: "feature",
    });
    expect(updated).toBe(true);
    expect(fs.existsSync(path.join(targetDir, "feature.txt"))).toBe(true);
    const current = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: targetDir,
      encoding: "utf8",
    }).trim();
    expect(current).toBe("feature");
  });

  test("clone 失败时抛出错误", async () => {
    const targetDir = path.join(path.dirname(localDir), "clone-fail");
    await expect(
      gitSyncd({
        cwd: targetDir,
        url: path.join(path.dirname(bareDir), "does-not-exist.git"),
      })
    ).rejects.toThrow();
  });

  test("已在目标 branch 上时直接同步", async () => {
    const updated = await gitSyncd({ cwd: localDir, branch: "main" });
    expect(updated).toBe(false);
  });

  test("本地已 fetch 过目标分支时仍只更新 ref、不 checkout", async () => {
    const tmpCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-fetched-branch-"));
    let topicTip!: string;
    try {
      execSync(`git clone "${bareDir}" "${tmpCloneDir}"`);
      const execOpts = { cwd: tmpCloneDir, env: { ...process.env, ...gitEnv } };
      execSync("git checkout -b topic", execOpts);
      fs.writeFileSync(path.join(tmpCloneDir, "topic.txt"), "topic");
      execSync("git add .", execOpts);
      execSync('git commit -m "add topic.txt"', execOpts);
      execSync("git push -u origin topic", { cwd: tmpCloneDir });
      topicTip = execSync("git rev-parse HEAD", {
        cwd: tmpCloneDir,
        encoding: "utf8",
      }).trim();
    } finally {
      fs.rmSync(tmpCloneDir, { recursive: true, force: true });
    }

    execSync("git fetch origin topic", { cwd: localDir });
    const updated = await gitSyncd({ cwd: localDir, branch: "topic" });
    expect(updated).toBe(true);
    expect(fs.existsSync(path.join(localDir, "topic.txt"))).toBe(false);
    expect(
      execSync("git rev-parse --abbrev-ref HEAD", { cwd: localDir, encoding: "utf8" }).trim()
    ).toBe("main");
    expect(
      execSync("git rev-parse refs/heads/topic", { cwd: localDir, encoding: "utf8" }).trim()
    ).toBe(topicTip);
  });

  test("当前不在目标分支时，脏工作区不阻碍推进目标分支 tip", async () => {
    const tmpCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-branch-force-"));
    let sideTip!: string;
    try {
      execSync(`git clone "${bareDir}" "${tmpCloneDir}"`);
      const execOpts = { cwd: tmpCloneDir, env: { ...process.env, ...gitEnv } };
      execSync("git checkout -b side", execOpts);
      fs.writeFileSync(path.join(tmpCloneDir, "init.txt"), "side content");
      execSync("git add .", execOpts);
      execSync('git commit -m "change init on side"', execOpts);
      execSync("git push -u origin side", { cwd: tmpCloneDir });
      sideTip = execSync("git rev-parse HEAD", {
        cwd: tmpCloneDir,
        encoding: "utf8",
      }).trim();
    } finally {
      fs.rmSync(tmpCloneDir, { recursive: true, force: true });
    }

    fs.writeFileSync(path.join(localDir, "init.txt"), "local dirty");
    const updated = await gitSyncd({ cwd: localDir, branch: "side", force: true });
    expect(updated).toBe(true);
    // 仍在 main，脏文件保留
    expect(fs.readFileSync(path.join(localDir, "init.txt"), "utf8")).toBe("local dirty");
    expect(
      execSync("git rev-parse --abbrev-ref HEAD", { cwd: localDir, encoding: "utf8" }).trim()
    ).toBe("main");
    expect(
      execSync("git rev-parse refs/heads/side", { cwd: localDir, encoding: "utf8" }).trim()
    ).toBe(sideTip);
  });

  test("当前不在目标分支且无法快进时，force=false 抛出错误", async () => {
    // 先让本地存在 side 分支
    const tmpCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-branch-noforce-"));
    try {
      execSync(`git clone "${bareDir}" "${tmpCloneDir}"`);
      const execOpts = { cwd: tmpCloneDir, env: { ...process.env, ...gitEnv } };
      execSync("git checkout -b other", execOpts);
      fs.writeFileSync(path.join(tmpCloneDir, "init.txt"), "other v1");
      execSync("git add .", execOpts);
      execSync('git commit -m "other v1"', execOpts);
      execSync("git push -u origin other", { cwd: tmpCloneDir });
    } finally {
      fs.rmSync(tmpCloneDir, { recursive: true, force: true });
    }

    await gitSyncd({ cwd: localDir, branch: "other" });

    // 远端改写 other（非快进）
    const rewriteDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-branch-noforce-rw-"));
    try {
      execSync(`git clone "${bareDir}" "${rewriteDir}"`);
      const execOpts = { cwd: rewriteDir, env: { ...process.env, ...gitEnv } };
      execSync("git checkout other", execOpts);
      fs.writeFileSync(path.join(rewriteDir, "init.txt"), "other v2");
      execSync("git add .", execOpts);
      execSync('git commit --amend -m "other v2"', execOpts);
      execSync("git push --force", { cwd: rewriteDir });
    } finally {
      fs.rmSync(rewriteDir, { recursive: true, force: true });
    }

    const before = execSync("git rev-parse refs/heads/other", {
      cwd: localDir,
      encoding: "utf8",
    }).trim();
    await expect(gitSyncd({ cwd: localDir, branch: "other", force: false })).rejects.toThrow(
      /fast-forward/
    );
    expect(
      execSync("git rev-parse refs/heads/other", { cwd: localDir, encoding: "utf8" }).trim()
    ).toBe(before);
  });

  test("当前在 dev 时默认仍同步 main，且不切换分支", async () => {
    execSync("git checkout -b dev", { cwd: localDir });

    const tmpCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-dev-main-"));
    try {
      execSync(`git clone "${bareDir}" "${tmpCloneDir}"`);
      fs.writeFileSync(path.join(tmpCloneDir, "on-main.txt"), "hello");
      const execOpts = { cwd: tmpCloneDir, env: { ...process.env, ...gitEnv } };
      execSync("git add .", execOpts);
      execSync('git commit -m "add on-main.txt"', execOpts);
      execSync("git push origin main", { cwd: tmpCloneDir });
    } finally {
      fs.rmSync(tmpCloneDir, { recursive: true, force: true });
    }

    const mainBefore = execSync("git rev-parse refs/heads/main", {
      cwd: localDir,
      encoding: "utf8",
    }).trim();
    const updated = await gitSyncd({ cwd: localDir });
    expect(updated).toBe(true);
    expect(
      execSync("git rev-parse --abbrev-ref HEAD", { cwd: localDir, encoding: "utf8" }).trim()
    ).toBe("dev");
    expect(fs.existsSync(path.join(localDir, "on-main.txt"))).toBe(false);
    const mainAfter = execSync("git rev-parse refs/heads/main", {
      cwd: localDir,
      encoding: "utf8",
    }).trim();
    expect(mainAfter).not.toBe(mainBefore);
  });

  test("无 upstream 跟踪时回退到 origin/<branch> 仍可同步", async () => {
    const tmpCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-no-upstream-"));
    try {
      execSync(`git clone "${bareDir}" "${tmpCloneDir}"`);
      fs.writeFileSync(path.join(tmpCloneDir, "no-up.txt"), "hello");
      const execOpts = { cwd: tmpCloneDir, env: { ...process.env, ...gitEnv } };
      execSync("git add .", execOpts);
      execSync('git commit -m "add no-up.txt"', execOpts);
      execSync("git push", { cwd: tmpCloneDir });
    } finally {
      fs.rmSync(tmpCloneDir, { recursive: true, force: true });
    }

    execSync("git branch --unset-upstream", { cwd: localDir });
    const updated = await gitSyncd({ cwd: localDir });
    expect(updated).toBe(true);
    expect(fs.existsSync(path.join(localDir, "no-up.txt"))).toBe(true);
  });

  test("无 upstream 且已是最新时返回 false", async () => {
    execSync("git branch --unset-upstream", { cwd: localDir });
    const updated = await gitSyncd({ cwd: localDir });
    expect(updated).toBe(false);
  });

  test("fetch 失败时抛出错误", async () => {
    execSync("git remote set-url origin /nonexistent/remote.git", { cwd: localDir });
    await expect(gitSyncd({ cwd: localDir })).rejects.toThrow();
  });

  test("detached HEAD 时仍按默认目标 main 同步，不改变 HEAD", async () => {
    const detachedBefore = execSync("git rev-parse HEAD", {
      cwd: localDir,
      encoding: "utf8",
    }).trim();
    execSync("git checkout --detach HEAD", { cwd: localDir });

    const tmpCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-detach-"));
    try {
      execSync(`git clone "${bareDir}" "${tmpCloneDir}"`);
      fs.writeFileSync(path.join(tmpCloneDir, "detach-main.txt"), "hello");
      const execOpts = { cwd: tmpCloneDir, env: { ...process.env, ...gitEnv } };
      execSync("git add .", execOpts);
      execSync('git commit -m "add detach-main.txt"', execOpts);
      execSync("git push origin main", { cwd: tmpCloneDir });
    } finally {
      fs.rmSync(tmpCloneDir, { recursive: true, force: true });
    }

    const updated = await gitSyncd({ cwd: localDir });
    expect(updated).toBe(true);
    expect(
      execSync("git rev-parse --abbrev-ref HEAD", { cwd: localDir, encoding: "utf8" }).trim()
    ).toBe("HEAD");
    expect(execSync("git rev-parse HEAD", { cwd: localDir, encoding: "utf8" }).trim()).toBe(
      detachedBefore
    );
    expect(fs.existsSync(path.join(localDir, "detach-main.txt"))).toBe(false);
  });

  test("空仓库无提交时，若已在目标分支名上则对齐工作区", async () => {
    const emptyDir = path.join(path.dirname(localDir), "empty-repo");
    fs.mkdirSync(emptyDir, { recursive: true });
    execSync("git init", { cwd: emptyDir });
    execSync("git checkout -b main", { cwd: emptyDir });
    execSync(`git remote add origin "${bareDir}"`, { cwd: emptyDir });

    const updated = await gitSyncd({ cwd: emptyDir, branch: "main", force: true });
    expect(updated).toBe(true);
    expect(fs.existsSync(path.join(emptyDir, "init.txt"))).toBe(true);
  });

  test("当前在仅本地分支时，默认仍同步 main 且不切换", async () => {
    execSync("git checkout -b local-only", { cwd: localDir });
    const updated = await gitSyncd({ cwd: localDir });
    expect(updated).toBe(false);
    expect(
      execSync("git rev-parse --abbrev-ref HEAD", { cwd: localDir, encoding: "utf8" }).trim()
    ).toBe("local-only");
  });

  test("目标分支在远端不存在时抛出错误", async () => {
    await expect(gitSyncd({ cwd: localDir, branch: "no-such-branch" })).rejects.toThrow();
  });

  test("远端 force-push 改写历史（非祖先 tip）时，force=true 可硬对齐", async () => {
    const tmpCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-rewrite-"));
    const execOpts = { cwd: tmpCloneDir, env: { ...process.env, ...gitEnv } };
    try {
      execSync(`git clone "${bareDir}" "${tmpCloneDir}"`);
      fs.writeFileSync(path.join(tmpCloneDir, "rewritten.txt"), "v1");
      execSync("git add .", execOpts);
      execSync('git commit -m "add rewritten.txt v1"', execOpts);
      execSync("git push", { cwd: tmpCloneDir });

      expect(await gitSyncd({ cwd: localDir })).toBe(true);
      expect(fs.readFileSync(path.join(localDir, "rewritten.txt"), "utf8")).toBe("v1");
      const localBefore = execSync("git rev-parse HEAD", {
        cwd: localDir,
        encoding: "utf8",
      }).trim();

      // amend 后 force-push：新 tip 与本地无祖先关系
      fs.writeFileSync(path.join(tmpCloneDir, "rewritten.txt"), "v2-amended");
      execSync("git add .", execOpts);
      execSync('git commit --amend -m "add rewritten.txt v2-amended"', execOpts);
      execSync("git push --force", { cwd: tmpCloneDir });

      const remoteTip = execSync("git ls-remote origin refs/heads/main", {
        cwd: localDir,
        encoding: "utf8",
      })
        .trim()
        .split(/\s+/)[0];
      expect(remoteTip).not.toBe(localBefore);

      const updated = await gitSyncd({ cwd: localDir, force: true });
      expect(updated).toBe(true);
      expect(fs.readFileSync(path.join(localDir, "rewritten.txt"), "utf8")).toBe("v2-amended");
      const localAfter = execSync("git rev-parse HEAD", {
        cwd: localDir,
        encoding: "utf8",
      }).trim();
      expect(localAfter).toBe(remoteTip);
    } finally {
      fs.rmSync(tmpCloneDir, { recursive: true, force: true });
    }
  });

  test("远端 force-push 改写历史时，force=false 因无法快进而抛错", async () => {
    const tmpCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-rewrite-noforce-"));
    const execOpts = { cwd: tmpCloneDir, env: { ...process.env, ...gitEnv } };
    try {
      execSync(`git clone "${bareDir}" "${tmpCloneDir}"`);
      fs.writeFileSync(path.join(tmpCloneDir, "noforce-rewrite.txt"), "v1");
      execSync("git add .", execOpts);
      execSync('git commit -m "add noforce-rewrite.txt v1"', execOpts);
      execSync("git push", { cwd: tmpCloneDir });

      await gitSyncd({ cwd: localDir });
      const localBefore = execSync("git rev-parse HEAD", {
        cwd: localDir,
        encoding: "utf8",
      }).trim();

      fs.writeFileSync(path.join(tmpCloneDir, "noforce-rewrite.txt"), "v2");
      execSync("git add .", execOpts);
      execSync('git commit --amend -m "add noforce-rewrite.txt v2"', execOpts);
      execSync("git push --force", { cwd: tmpCloneDir });

      await expect(gitSyncd({ cwd: localDir, force: false })).rejects.toThrow();
      const localAfter = execSync("git rev-parse HEAD", {
        cwd: localDir,
        encoding: "utf8",
      }).trim();
      expect(localAfter).toBe(localBefore);
    } finally {
      fs.rmSync(tmpCloneDir, { recursive: true, force: true });
    }
  });

  test("本地与远端真正发散时，force=true 丢弃本地独有提交并对齐远端", async () => {
    fs.writeFileSync(path.join(localDir, "local-only.txt"), "local");
    execSync("git add . && git commit -m 'local only'", {
      cwd: localDir,
      env: { ...process.env, ...gitEnv },
    });

    const tmpCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-diverge-"));
    try {
      execSync(`git clone "${bareDir}" "${tmpCloneDir}"`);
      fs.writeFileSync(path.join(tmpCloneDir, "remote-only.txt"), "remote");
      const execOpts = { cwd: tmpCloneDir, env: { ...process.env, ...gitEnv } };
      execSync("git add .", execOpts);
      execSync('git commit -m "remote only"', execOpts);
      execSync("git push", { cwd: tmpCloneDir });
    } finally {
      fs.rmSync(tmpCloneDir, { recursive: true, force: true });
    }

    const updated = await gitSyncd({ cwd: localDir, force: true });
    expect(updated).toBe(true);
    expect(fs.existsSync(path.join(localDir, "remote-only.txt"))).toBe(true);
    expect(fs.existsSync(path.join(localDir, "local-only.txt"))).toBe(false);
  });

  test("远端 rewind 到祖先 tip 时，force=true 可回退对齐", async () => {
    const tmpCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-rewind-"));
    const execOpts = { cwd: tmpCloneDir, env: { ...process.env, ...gitEnv } };
    try {
      execSync(`git clone "${bareDir}" "${tmpCloneDir}"`);
      const ancestorSha = execSync("git rev-parse HEAD", {
        cwd: tmpCloneDir,
        encoding: "utf8",
      }).trim();
      fs.writeFileSync(path.join(tmpCloneDir, "later.txt"), "later");
      execSync("git add .", execOpts);
      execSync('git commit -m "add later.txt"', execOpts);
      execSync("git push", { cwd: tmpCloneDir });

      expect(await gitSyncd({ cwd: localDir })).toBe(true);
      expect(fs.existsSync(path.join(localDir, "later.txt"))).toBe(true);

      execSync(`git reset --hard ${ancestorSha}`, execOpts);
      execSync("git push --force", { cwd: tmpCloneDir });

      const updated = await gitSyncd({ cwd: localDir, force: true });
      expect(updated).toBe(true);
      expect(fs.existsSync(path.join(localDir, "later.txt"))).toBe(false);
      const localAfter = execSync("git rev-parse HEAD", {
        cwd: localDir,
        encoding: "utf8",
      }).trim();
      expect(localAfter).toBe(ancestorSha);
    } finally {
      fs.rmSync(tmpCloneDir, { recursive: true, force: true });
    }
  });

  test("仅本地领先且远端未变时，force=true 会丢弃本地独有提交以对齐远端", async () => {
    fs.writeFileSync(path.join(localDir, "ahead.txt"), "ahead");
    execSync("git add . && git commit -m 'local ahead'", {
      cwd: localDir,
      env: { ...process.env, ...gitEnv },
    });
    const remoteTip = execSync("git rev-parse origin/main", {
      cwd: localDir,
      encoding: "utf8",
    }).trim();

    const updated = await gitSyncd({ cwd: localDir, force: true });
    expect(updated).toBe(true);
    expect(fs.existsSync(path.join(localDir, "ahead.txt"))).toBe(false);
    const localAfter = execSync("git rev-parse HEAD", {
      cwd: localDir,
      encoding: "utf8",
    }).trim();
    expect(localAfter).toBe(remoteTip);
  });

  test("远端 rewind 到祖先 tip 时，force=false 因无法快进而抛错", async () => {
    const tmpCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-rewind-noforce-"));
    const execOpts = { cwd: tmpCloneDir, env: { ...process.env, ...gitEnv } };
    try {
      execSync(`git clone "${bareDir}" "${tmpCloneDir}"`);
      const ancestorSha = execSync("git rev-parse HEAD", {
        cwd: tmpCloneDir,
        encoding: "utf8",
      }).trim();
      fs.writeFileSync(path.join(tmpCloneDir, "later2.txt"), "later");
      execSync("git add .", execOpts);
      execSync('git commit -m "add later2.txt"', execOpts);
      execSync("git push", { cwd: tmpCloneDir });

      await gitSyncd({ cwd: localDir });
      const localBefore = execSync("git rev-parse HEAD", {
        cwd: localDir,
        encoding: "utf8",
      }).trim();

      execSync(`git reset --hard ${ancestorSha}`, execOpts);
      execSync("git push --force", { cwd: tmpCloneDir });

      await expect(gitSyncd({ cwd: localDir, force: false })).rejects.toThrow(/fast-forward/);
      const localAfter = execSync("git rev-parse HEAD", {
        cwd: localDir,
        encoding: "utf8",
      }).trim();
      expect(localAfter).toBe(localBefore);
    } finally {
      fs.rmSync(tmpCloneDir, { recursive: true, force: true });
    }
  });
});
