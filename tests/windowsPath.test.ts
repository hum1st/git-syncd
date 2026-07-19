import { createHash } from "crypto";
import { deflateSync } from "zlib";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execFileSync, execSync } from "child_process";
import gitSyncd, { sanitizeWindowsPath } from "../src/index";

/** 直接写入 git 对象库（绕过 Windows 对 docs/a:b.txt 等路径的校验） */
function writeGitObject(gitDir: string, type: string, content: Buffer): string {
  const header = Buffer.from(`${type} ${content.length}\0`);
  const store = Buffer.concat([header, content]);
  const oid = createHash("sha1").update(store).digest("hex");
  const dir = path.join(gitDir, "objects", oid.slice(0, 2));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, oid.slice(2)), deflateSync(store));
  return oid;
}

function treeEntry(mode: string, name: string, hashHex: string): Buffer {
  return Buffer.concat([Buffer.from(`${mode} ${name}\0`), Buffer.from(hashHex, "hex")]);
}

function buildTree(entries: Array<{ mode: string; name: string; hash: string }>): Buffer {
  return Buffer.concat(
    [...entries]
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      .map((e) => treeEntry(e.mode, e.name, e.hash))
  );
}

/** 在 tmp 下创建含 docs/a:b.txt 的 bare 远端仓库 */
function setupWeirdPathBareRepo(base: string, env: NodeJS.ProcessEnv): string {
  const bareDir = path.join(base, "remote.git");
  const seedDir = path.join(base, "seed");

  execFileSync("git", ["init", "--bare", bareDir], { env });
  execFileSync("git", ["symbolic-ref", "HEAD", "refs/heads/main"], { cwd: bareDir, env });
  execFileSync("git", ["clone", bareDir, seedDir], { env });

  const gitDir = path.join(seedDir, ".git");
  const weirdHash = writeGitObject(gitDir, "blob", Buffer.from("weird", "utf8"));
  const readmeHash = writeGitObject(gitDir, "blob", Buffer.from("hello\n", "utf8"));
  const docsTreeHash = writeGitObject(gitDir, "tree", treeEntry("100644", "a:b.txt", weirdHash));
  const rootTreeHash = writeGitObject(
    gitDir,
    "tree",
    buildTree([
      { mode: "40000", name: "docs", hash: docsTreeHash },
      { mode: "100644", name: "readme.txt", hash: readmeHash },
    ])
  );
  const commitHash = writeGitObject(
    gitDir,
    "commit",
    Buffer.from(
      `tree ${rootTreeHash}\n` +
        "author Test <test@test.com> 0 +0000\n" +
        "committer Test <test@test.com> 0 +0000\n\n" +
        "init\n",
      "utf8"
    )
  );

  execFileSync("git", ["update-ref", "refs/heads/main", commitHash], { cwd: seedDir, env });
  execFileSync("git", ["branch", "-M", "main"], { cwd: seedDir, env });
  execFileSync("git", ["push", "-u", "origin", "main"], { cwd: seedDir, env });
  return bareDir;
}

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
    const bareDir = setupWeirdPathBareRepo(base, { ...process.env, ...gitEnv });
    const targetDir = path.join(base, "local");

    try {
      const updated = await gitSyncd({
        cwd: targetDir,
        url: bareDir,
        branch: "main",
      });
      expect(updated).toBe(true);
      expect(fs.existsSync(path.join(targetDir, "readme.txt"))).toBe(true);
      expect(fs.readFileSync(path.join(targetDir, "readme.txt"), "utf8")).toBe("hello\n");
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
