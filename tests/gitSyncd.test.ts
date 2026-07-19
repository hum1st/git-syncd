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

  // 初始化裸仓库
  execSync(`git init --bare "${bareDir}"`);

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
  execSync("git push", { cwd: localDir });

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

  test("已是最新时返回 success=true 且 updated=false", async () => {
    const result = await gitSyncd({ cwd: localDir });
    expect(result.success).toBe(true);
    expect(result.updated).toBe(false);
    expect(result.exitCode).toBe(0);
  });

  test("有新提交时 pull 成功并同步文件，updated=true", async () => {
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

    const result = await gitSyncd({ cwd: localDir });
    expect(result.success).toBe(true);
    expect(result.updated).toBe(true);
    expect(fs.existsSync(path.join(localDir, "new.txt"))).toBe(true);
  });

  test("无效路径时返回 success=false 且 updated=false", async () => {
    const result = await gitSyncd({ cwd: "/nonexistent/path/xyz" });
    expect(result.success).toBe(false);
    expect(result.updated).toBe(false);
  });

  test("非 git 仓库时返回 success=false 且 updated=false", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "not-a-repo-"));
    try {
      const result = await gitSyncd({ cwd: tmpDir });
      expect(result.success).toBe(false);
      expect(result.updated).toBe(false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("force=true 时，本地有未提交变更冲突，仍能拉取成功且 updated=true", async () => {
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
    const result = await gitSyncd({ cwd: localDir, force: true });
    expect(result.success).toBe(true);
    expect(result.updated).toBe(true);
    expect(result.forceReset).toBe(true);
    // 远端内容已被拉取
    expect(fs.readFileSync(path.join(localDir, "conflict.txt"), "utf8")).toBe("remote content");
  });

  test("force=false 时，本地有未提交变更冲突，pull 失败且 updated=false", async () => {
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

    // 3. force=false 不应重置，pull 应失败
    const result = await gitSyncd({ cwd: localDir, force: false });
    expect(result.success).toBe(false);
    expect(result.updated).toBe(false);
    expect(result.forceReset).toBeUndefined();
  });

  test("未指定 cwd 时使用 process.cwd()", async () => {
    const prevCwd = process.cwd();
    try {
      process.chdir(localDir);
      const result = await gitSyncd();
      expect(result.success).toBe(true);
      expect(result.updated).toBe(false);
    } finally {
      process.chdir(prevCwd);
    }
  });

  test("可传入额外 git pull 参数", async () => {
    const result = await gitSyncd({ cwd: localDir, args: ["--ff-only"] });
    expect(result.success).toBe(true);
    expect(result.updated).toBe(false);
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
    const result = await gitSyncd({ cwd: localDir });
    expect(result.success).toBe(true);
    expect(result.updated).toBe(true);
    expect(result.forceReset).toBe(true);
  });
});
