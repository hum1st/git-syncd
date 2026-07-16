import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";
import { gitSyncd, gitSyncdJob } from "../src/index";

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

  test("具名 export gitSyncd 是函数", () => {
    expect(typeof gitSyncd).toBe("function");
  });

  test("具名 export gitSyncdJob 是函数", () => {
    expect(typeof gitSyncdJob).toBe("function");
  });

  test("已是最新时返回 success=true", async () => {
    const result = await gitSyncd({ cwd: localDir });
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  test("有新提交时 pull 成功并同步文件", async () => {
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
    expect(fs.existsSync(path.join(localDir, "new.txt"))).toBe(true);
  });

  test("无效路径时返回 success=false", async () => {
    const result = await gitSyncd({ cwd: "/nonexistent/path/xyz" });
    expect(result.success).toBe(false);
  });

  test("非 git 仓库时返回 success=false", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "not-a-repo-"));
    try {
      const result = await gitSyncd({ cwd: tmpDir });
      expect(result.success).toBe(false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("force=true 时，本地有未提交变更冲突，仍能拉取成功", async () => {
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
    expect(result.forceReset).toBe(true);
    // 远端内容已被拉取
    expect(fs.readFileSync(path.join(localDir, "conflict.txt"), "utf8")).toBe("remote content");
  });

  test("force=false 时，本地有未提交变更冲突，pull 失败", async () => {
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
    expect(result.forceReset).toBeUndefined();
  });
});

describe("gitSyncdJob", () => {
  let bareDir: string;
  let localDir: string;
  let cleanUp: () => void;

  beforeEach(() => {
    ({ bareDir, localDir, cleanUp } = setupRepos());
    // suppress unused warning
    void bareDir;
  });

  afterEach(() => {
    cleanUp();
  });

  test("启动 job 立即触发一次同步，onSync 被调用", async () => {
    await new Promise<void>((resolve) => {
      const job = gitSyncdJob({
        cwd: localDir,
        interval: 60_000, // 设长间隔，只验证立即调用
        onSync: (result) => {
          expect(result.success).toBe(true);
          job.stop();
          resolve();
        },
      });
    });
  });

  test("stop() 后不再触发 onSync", async () => {
    let callCount = 0;
    await new Promise<void>((resolve) => {
      const job = gitSyncdJob({
        cwd: localDir,
        interval: 50, // 极短间隔
        onSync: () => {
          callCount++;
          if (callCount === 1) {
            job.stop();
            // 等待足够长的时间，确认没有第二次调用
            setTimeout(() => {
              expect(callCount).toBe(1);
              resolve();
            }, 200);
          }
        },
      });
    });
  });

  test("返回带有 stop 方法的 job 对象", () => {
    const job = gitSyncdJob({ cwd: localDir, interval: 60_000 });
    expect(typeof job.stop).toBe("function");
    job.stop();
  });
});
