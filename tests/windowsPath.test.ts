import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";
import gitSyncd, { sanitizeWindowsPath } from "../src/index";

describe("sanitizeWindowsPath", () => {
  test("剥离非法字符并保留合法段", () => {
    expect(sanitizeWindowsPath("docs/a:b/c*d.txt")).toBe("docs/ab/cd.txt");
    expect(sanitizeWindowsPath('foo?"<>|bar')).toBe("foobar");
  });

  test("整段被清空时跳过空段", () => {
    expect(sanitizeWindowsPath("ok/::: /x")).toBe("ok/x");
  });
});

describe("Windows clone 路径（runtime platform=win32）", () => {
  const gitEnv = {
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@test.com",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@test.com",
  };

  const realPlatform = process.platform;

  beforeEach(() => {
    Object.defineProperty(process, "platform", {
      configurable: true,
      enumerable: true,
      value: "win32",
    });
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", {
      configurable: true,
      enumerable: true,
      value: realPlatform,
    });
  });

  test("win32 下 clone 使用 --no-checkout 并物化工作区", async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-win-"));
    const bareDir = path.join(base, "remote.git");
    const seedDir = path.join(base, "seed");
    const targetDir = path.join(base, "local");

    try {
      execSync(`git init --bare "${bareDir}"`);
      execSync("git symbolic-ref HEAD refs/heads/main", { cwd: bareDir });
      execSync(`git clone "${bareDir}" "${seedDir}"`);
      fs.writeFileSync(path.join(seedDir, "readme.txt"), "hello");
      // 含 Windows 非法字符的路径：物化时应被清洗
      const weirdDir = path.join(seedDir, "docs");
      fs.mkdirSync(weirdDir, { recursive: true });
      fs.writeFileSync(path.join(weirdDir, "a:b.txt"), "weird");
      const execOpts = { cwd: seedDir, env: { ...process.env, ...gitEnv } };
      execSync("git add .", execOpts);
      execSync('git commit -m "init"', execOpts);
      execSync("git branch -M main", execOpts);
      execSync("git push -u origin main", { cwd: seedDir });

      const updated = await gitSyncd({ cwd: targetDir, url: bareDir, branch: "main" });
      expect(updated).toBe(true);
      expect(fs.existsSync(path.join(targetDir, "readme.txt"))).toBe(true);
      // a:b.txt → ab.txt
      expect(fs.existsSync(path.join(targetDir, "docs", "ab.txt"))).toBe(true);
      expect(fs.readFileSync(path.join(targetDir, "docs", "ab.txt"), "utf8")).toBe("weird");
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });

  test("win32 下 tip 已对齐但工作区为空时补物化", async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-win-empty-"));
    const bareDir = path.join(base, "remote.git");
    const seedDir = path.join(base, "seed");
    const targetDir = path.join(base, "local");

    try {
      execSync(`git init --bare "${bareDir}"`);
      execSync("git symbolic-ref HEAD refs/heads/main", { cwd: bareDir });
      execSync(`git clone "${bareDir}" "${seedDir}"`);
      fs.writeFileSync(path.join(seedDir, "only.txt"), "x");
      const execOpts = { cwd: seedDir, env: { ...process.env, ...gitEnv } };
      execSync("git add .", execOpts);
      execSync('git commit -m "init"', execOpts);
      execSync("git branch -M main", execOpts);
      execSync("git push -u origin main", { cwd: seedDir });

      await gitSyncd({ cwd: targetDir, url: bareDir, branch: "main" });
      // 清空工作区，保留 .git
      for (const name of fs.readdirSync(targetDir)) {
        if (name === ".git") continue;
        fs.rmSync(path.join(targetDir, name), { recursive: true, force: true });
      }
      expect(fs.existsSync(path.join(targetDir, "only.txt"))).toBe(false);

      const updated = await gitSyncd({ cwd: targetDir, branch: "main" });
      expect(updated).toBe(true);
      expect(fs.readFileSync(path.join(targetDir, "only.txt"), "utf8")).toBe("x");
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });
});
