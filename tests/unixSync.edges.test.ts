import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";
import gitSyncd from "../src/index";

/** Unix 分支在 Windows CI 上不会执行，需 mock platform 覆盖 */
describe("Unix sync 边界（platform=linux）", () => {
  const gitEnv = {
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@test.com",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@test.com",
  };

  const realPlatform = process.platform;
  let base: string;
  let bareDir: string;

  beforeEach(() => {
    Object.defineProperty(process, "platform", {
      configurable: true,
      enumerable: true,
      value: "linux",
    });
    base = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-unix-edge-"));
    bareDir = path.join(base, "remote.git");
    execSync(`git init --bare "${bareDir}"`);
    execSync("git symbolic-ref HEAD refs/heads/main", { cwd: bareDir });
    const seedDir = path.join(base, "seed");
    execSync(`git clone "${bareDir}" "${seedDir}"`);
    fs.writeFileSync(path.join(seedDir, "init.txt"), "init");
    const seedOpts = { cwd: seedDir, env: { ...process.env, ...gitEnv } };
    execSync("git add .", seedOpts);
    execSync('git commit -m "init"', seedOpts);
    execSync("git branch -M main", seedOpts);
    execSync("git push -u origin main", { cwd: seedDir });
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", {
      configurable: true,
      enumerable: true,
      value: realPlatform,
    });
    fs.rmSync(base, { recursive: true, force: true });
  });

  test("空仓库已在目标分支上时 reset --hard 对齐工作区", async () => {
    const emptyDir = path.join(base, "empty-on-main");
    fs.mkdirSync(emptyDir, { recursive: true });
    execSync("git init", { cwd: emptyDir });
    execSync("git checkout -b main", { cwd: emptyDir });
    execSync(`git remote add origin "${bareDir}"`, { cwd: emptyDir });

    const updated = await gitSyncd({ cwd: emptyDir, branch: "main", force: true });
    expect(updated).toBe(true);
    expect(fs.existsSync(path.join(emptyDir, "init.txt"))).toBe(true);
  });

  test("空仓库不在目标分支上时仅 update-ref", async () => {
    const emptyDir = path.join(base, "empty-on-dev");
    fs.mkdirSync(emptyDir, { recursive: true });
    execSync("git init", { cwd: emptyDir });
    execSync("git checkout -b dev", { cwd: emptyDir });
    execSync(`git remote add origin "${bareDir}"`, { cwd: emptyDir });

    const updated = await gitSyncd({ cwd: emptyDir, branch: "main" });
    expect(updated).toBe(true);
    expect(fs.existsSync(path.join(emptyDir, "init.txt"))).toBe(false);
    expect(
      execSync("git symbolic-ref --short HEAD", { cwd: emptyDir, encoding: "utf8" }).trim()
    ).toBe("dev");
  });

  test("merge --ff-only 失败且 force=true 时 reset 硬对齐", async () => {
    const localDir = path.join(base, "local");
    execSync(`git clone "${bareDir}" "${localDir}"`);

    const pushDir = path.join(base, "push");
    execSync(`git clone "${bareDir}" "${pushDir}"`);
    fs.writeFileSync(path.join(pushDir, "remote.txt"), "r");
    const pushOpts = { cwd: pushDir, env: { ...process.env, ...gitEnv } };
    execSync("git add .", pushOpts);
    execSync('git commit -m "remote"', pushOpts);
    execSync("git push", { cwd: pushDir });

    fs.writeFileSync(path.join(localDir, "dirty.txt"), "local");
    const updated = await gitSyncd({ cwd: localDir, force: true });
    expect(updated).toBe(true);
    expect(fs.existsSync(path.join(localDir, "remote.txt"))).toBe(true);
  });

  test("无法快进且 force=true 时在目标分支上硬对齐", async () => {
    const localDir = path.join(base, "local-rewrite");
    execSync(`git clone "${bareDir}" "${localDir}"`);

    const rewriteDir = path.join(base, "rewrite");
    execSync(`git clone "${bareDir}" "${rewriteDir}"`);
    fs.writeFileSync(path.join(rewriteDir, "rewritten.txt"), "v1");
    const rewriteOpts = { cwd: rewriteDir, env: { ...process.env, ...gitEnv } };
    execSync("git add .", rewriteOpts);
    execSync('git commit -m "v1"', rewriteOpts);
    execSync("git push", { cwd: rewriteDir });

    await gitSyncd({ cwd: localDir });
    fs.writeFileSync(path.join(rewriteDir, "rewritten.txt"), "v2");
    execSync("git add .", rewriteOpts);
    execSync('git commit --amend -m "v2"', rewriteOpts);
    execSync("git push --force", { cwd: rewriteDir });

    const updated = await gitSyncd({ cwd: localDir, force: true });
    expect(updated).toBe(true);
    expect(fs.readFileSync(path.join(localDir, "rewritten.txt"), "utf8")).toBe("v2");
  });
});
