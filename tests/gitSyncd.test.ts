import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";
import gitSyncd, { gitSyncd as gitSyncdNamed } from "../src/index";

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

  test("default import 与具名 import 是同一个函数", () => {
    expect(gitSyncd).toBe(gitSyncdNamed);
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
});
