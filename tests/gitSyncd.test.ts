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

  test("传入 url 且目标已是仓库时执行 pull", async () => {
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

  test("显式传入 branch 时先 checkout 再 pull", async () => {
    // 远端创建 develop 分支并推送新文件
    const tmpCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-branch-"));
    try {
      execSync(`git clone "${bareDir}" "${tmpCloneDir}"`);
      const execOpts = { cwd: tmpCloneDir, env: { ...process.env, ...gitEnv } };
      execSync("git checkout -b develop", execOpts);
      fs.writeFileSync(path.join(tmpCloneDir, "develop.txt"), "on develop");
      execSync("git add .", execOpts);
      execSync('git commit -m "add develop.txt"', execOpts);
      execSync("git push -u origin develop", { cwd: tmpCloneDir });
    } finally {
      fs.rmSync(tmpCloneDir, { recursive: true, force: true });
    }

    const updated = await gitSyncd({ cwd: localDir, branch: "develop" });
    expect(updated).toBe(true);
    expect(fs.existsSync(path.join(localDir, "develop.txt"))).toBe(true);

    const current = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: localDir,
      encoding: "utf8",
    }).trim();
    expect(current).toBe("develop");
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

  test("已在目标 branch 上时直接 pull", async () => {
    const updated = await gitSyncd({ cwd: localDir, branch: "main" });
    expect(updated).toBe(false);
  });

  test("本地已 fetch 过目标分支时可以直接 checkout", async () => {
    const tmpCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-fetched-branch-"));
    try {
      execSync(`git clone "${bareDir}" "${tmpCloneDir}"`);
      const execOpts = { cwd: tmpCloneDir, env: { ...process.env, ...gitEnv } };
      execSync("git checkout -b topic", execOpts);
      fs.writeFileSync(path.join(tmpCloneDir, "topic.txt"), "topic");
      execSync("git add .", execOpts);
      execSync('git commit -m "add topic.txt"', execOpts);
      execSync("git push -u origin topic", { cwd: tmpCloneDir });
    } finally {
      fs.rmSync(tmpCloneDir, { recursive: true, force: true });
    }

    execSync("git fetch origin topic", { cwd: localDir });
    const updated = await gitSyncd({ cwd: localDir, branch: "topic" });
    expect(updated).toBe(true);
    expect(fs.existsSync(path.join(localDir, "topic.txt"))).toBe(true);
  });

  test("切换 branch 时本地脏文件 + force=true 仍可成功", async () => {
    const tmpCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-branch-force-"));
    try {
      execSync(`git clone "${bareDir}" "${tmpCloneDir}"`);
      const execOpts = { cwd: tmpCloneDir, env: { ...process.env, ...gitEnv } };
      execSync("git checkout -b side", execOpts);
      fs.writeFileSync(path.join(tmpCloneDir, "init.txt"), "side content");
      execSync("git add .", execOpts);
      execSync('git commit -m "change init on side"', execOpts);
      execSync("git push -u origin side", { cwd: tmpCloneDir });
    } finally {
      fs.rmSync(tmpCloneDir, { recursive: true, force: true });
    }

    // 本地修改会挡住 checkout
    fs.writeFileSync(path.join(localDir, "init.txt"), "local dirty");
    const updated = await gitSyncd({ cwd: localDir, branch: "side", force: true });
    expect(updated).toBe(true);
    expect(fs.readFileSync(path.join(localDir, "init.txt"), "utf8")).toBe("side content");
  });

  test("切换 branch 时本地脏文件 + force=false 抛出错误", async () => {
    const tmpCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-branch-noforce-"));
    try {
      execSync(`git clone "${bareDir}" "${tmpCloneDir}"`);
      const execOpts = { cwd: tmpCloneDir, env: { ...process.env, ...gitEnv } };
      execSync("git checkout -b other", execOpts);
      fs.writeFileSync(path.join(tmpCloneDir, "init.txt"), "other content");
      execSync("git add .", execOpts);
      execSync('git commit -m "change init on other"', execOpts);
      execSync("git push -u origin other", { cwd: tmpCloneDir });
    } finally {
      fs.rmSync(tmpCloneDir, { recursive: true, force: true });
    }

    fs.writeFileSync(path.join(localDir, "init.txt"), "local dirty");
    await expect(gitSyncd({ cwd: localDir, branch: "other", force: false })).rejects.toThrow();
  });
});
