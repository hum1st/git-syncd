import { EventEmitter } from "events";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";
import type { ChildProcess } from "child_process";

jest.mock("child_process", () => {
  const actual = jest.requireActual<typeof import("child_process")>("child_process");
  return {
    ...actual,
    spawn: jest.fn(actual.spawn),
  };
});

import { spawn } from "child_process";
import gitSyncd from "../src/index";

const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;

function createFakeChild(opts: {
  exitCode?: number | null;
  stdout?: string | Buffer;
  stderr?: string;
}): ChildProcess {
  const child = new EventEmitter() as ChildProcess;
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  (child as unknown as { stdout: EventEmitter; stderr: EventEmitter }).stdout = stdout;
  (child as unknown as { stdout: EventEmitter; stderr: EventEmitter }).stderr = stderr;

  queueMicrotask(() => {
    if (opts.stdout) {
      stdout.emit("data", typeof opts.stdout === "string" ? Buffer.from(opts.stdout) : opts.stdout);
    }
    if (opts.stderr) {
      stderr.emit("data", Buffer.from(opts.stderr));
    }
    child.emit("close", opts.exitCode ?? 1);
  });

  return child;
}

describe("Windows sync 边界（platform=win32）", () => {
  const gitEnv = {
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@test.com",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@test.com",
  };

  let originalPlatform: PropertyDescriptor | undefined;
  let tmpDir: string;

  beforeEach(() => {
    originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-win-edge-"));
    mockedSpawn.mockReset();
    mockedSpawn.mockImplementation(
      jest.requireActual<typeof import("child_process")>("child_process").spawn
    );
  });

  afterEach(() => {
    mockedSpawn.mockImplementation(
      jest.requireActual<typeof import("child_process")>("child_process").spawn
    );
    if (originalPlatform) Object.defineProperty(process, "platform", originalPlatform);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("win32 上 tip 无法快进且 force=false 时抛错", async () => {
    const bareDir = path.join(tmpDir, "remote.git");
    const seedDir = path.join(tmpDir, "seed");
    const localDir = path.join(tmpDir, "local");
    execSync(`git init --bare "${bareDir}"`);
    execSync("git symbolic-ref HEAD refs/heads/main", { cwd: bareDir });
    execSync(`git clone "${bareDir}" "${seedDir}"`);
    fs.writeFileSync(path.join(seedDir, "a.txt"), "v1");
    const seedOpts = { cwd: seedDir, env: { ...process.env, ...gitEnv } };
    execSync("git add .", seedOpts);
    execSync('git commit -m "v1"', seedOpts);
    execSync("git branch -M main", seedOpts);
    execSync("git push -u origin main", { cwd: seedDir });

    await gitSyncd({ cwd: localDir, url: bareDir, branch: "main" });

    fs.writeFileSync(path.join(localDir, "local.txt"), "L");
    execSync("git add .", { cwd: localDir, env: { ...process.env, ...gitEnv } });
    execSync('git commit -m "local"', { cwd: localDir, env: { ...process.env, ...gitEnv } });

    const other = path.join(tmpDir, "other");
    execSync(`git clone "${bareDir}" "${other}"`);
    fs.writeFileSync(path.join(other, "a.txt"), "v2");
    const otherOpts = { cwd: other, env: { ...process.env, ...gitEnv } };
    execSync("git add .", otherOpts);
    execSync('git commit --amend -m "v2"', otherOpts);
    execSync("git push --force", { cwd: other });

    await expect(gitSyncd({ cwd: localDir, branch: "main", force: false })).rejects.toThrow(
      /fast-forward/
    );
  });

  test("win32 物化时 ls-tree 失败则抛错", async () => {
    const cwd = path.join(tmpDir, "repo");
    fs.mkdirSync(cwd);
    execSync("git init", { cwd });
    execSync("git checkout -b main", { cwd });

    mockedSpawn.mockImplementation((_cmd, args) => {
      const list = args as string[];
      if (list.includes("--git-dir")) {
        return createFakeChild({ exitCode: 0, stdout: ".git" });
      }
      if (list[0] === "rev-parse" && list.includes("refs/heads/main")) {
        return createFakeChild({ exitCode: 0, stdout: "aaa111" });
      }
      if (list[0] === "fetch") {
        return createFakeChild({ exitCode: 0, stdout: "" });
      }
      if (list[0] === "rev-parse" && list.includes("origin/main")) {
        return createFakeChild({ exitCode: 0, stdout: "bbb222" });
      }
      if (
        list.includes("symbolic-ref") ||
        (list.includes("--abbrev-ref") && list.includes("HEAD"))
      ) {
        return createFakeChild({ exitCode: 0, stdout: "main" });
      }
      if (list.includes("merge-base")) {
        return createFakeChild({ exitCode: 0, stdout: "aaa111" });
      }
      if (list[0] === "update-ref") {
        return createFakeChild({ exitCode: 0, stdout: "" });
      }
      if (list.includes("ls-tree")) {
        return createFakeChild({ exitCode: 1, stderr: "ls-tree boom" });
      }
      return createFakeChild({ exitCode: 1 });
    });

    await expect(gitSyncd({ cwd, branch: "main", force: true })).rejects.toThrow("ls-tree boom");
  });
});
