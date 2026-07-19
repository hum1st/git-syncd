import { EventEmitter } from "events";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
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
  stdout?: string;
  stderr?: string;
}): ChildProcess {
  const child = new EventEmitter() as ChildProcess;
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  (child as unknown as { stdout: EventEmitter; stderr: EventEmitter }).stdout = stdout;
  (child as unknown as { stdout: EventEmitter; stderr: EventEmitter }).stderr = stderr;

  queueMicrotask(() => {
    if (opts.stdout) {
      stdout.emit("data", Buffer.from(opts.stdout));
    }
    if (opts.stderr) {
      stderr.emit("data", Buffer.from(opts.stderr));
    }
    child.emit("close", opts.exitCode ?? 1);
  });

  return child;
}

function argsOf(call: unknown): string[] {
  const args = (call as [string, string[]])[1];
  return args ?? [];
}

describe("gitSyncd 边界分支（mock spawn）", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-syncd-edges-"));
    mockedSpawn.mockReset();
  });

  afterEach(() => {
    mockedSpawn.mockImplementation(
      jest.requireActual<typeof import("child_process")>("child_process").spawn
    );
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("命令失败且无 stdout/stderr 时使用默认错误信息", async () => {
    mockedSpawn.mockImplementation((_cmd, args) => {
      const list = args as string[];
      if (list.includes("--git-dir")) {
        return createFakeChild({ exitCode: 0, stdout: ".git" });
      }
      if (list[0] === "rev-parse" && list.includes("refs/heads/main")) {
        return createFakeChild({ exitCode: 0, stdout: "abc123" });
      }
      if (list[0] === "fetch") {
        return createFakeChild({ exitCode: 1 });
      }
      return createFakeChild({ exitCode: 1 });
    });

    await expect(gitSyncd({ cwd: tmpDir })).rejects.toThrow("git fetch origin failed");
  });

  test("命令失败且仅有 stdout 时使用 stdout 作为错误信息", async () => {
    mockedSpawn.mockImplementation((_cmd, args) => {
      const list = args as string[];
      if (list.includes("--git-dir")) {
        return createFakeChild({ exitCode: 0, stdout: ".git" });
      }
      if (list[0] === "rev-parse" && list.includes("refs/heads/main")) {
        return createFakeChild({ exitCode: 0, stdout: "abc123" });
      }
      if (list[0] === "fetch") {
        return createFakeChild({ exitCode: 1, stdout: "fetch failed on stdout" });
      }
      return createFakeChild({ exitCode: 1 });
    });

    await expect(gitSyncd({ cwd: tmpDir })).rejects.toThrow("fetch failed on stdout");
  });

  test("无法解析 origin/<branch> 时抛出错误", async () => {
    mockedSpawn.mockImplementation((_cmd, args) => {
      const list = args as string[];
      if (list.includes("--git-dir")) {
        return createFakeChild({ exitCode: 0, stdout: ".git" });
      }
      if (list[0] === "rev-parse" && list.includes("refs/heads/main")) {
        return createFakeChild({ exitCode: 0, stdout: "abc123" });
      }
      if (list[0] === "fetch") {
        return createFakeChild({ exitCode: 0, stdout: "" });
      }
      if (list[0] === "rev-parse" && list.includes("origin/main")) {
        return createFakeChild({ exitCode: 1, stderr: "needed a single revision" });
      }
      return createFakeChild({ exitCode: 1 });
    });

    await expect(gitSyncd({ cwd: tmpDir })).rejects.toThrow("needed a single revision");
    expect(mockedSpawn.mock.calls.some((call) => argsOf(call).includes("origin/main"))).toBe(true);
  });

  test("origin/<branch> 解析失败且无 stderr 时使用默认信息", async () => {
    mockedSpawn.mockImplementation((_cmd, args) => {
      const list = args as string[];
      if (list.includes("--git-dir")) {
        return createFakeChild({ exitCode: 0, stdout: ".git" });
      }
      if (list[0] === "rev-parse" && list.includes("refs/heads/main")) {
        return createFakeChild({ exitCode: 0, stdout: "abc123" });
      }
      if (list[0] === "fetch") {
        return createFakeChild({ exitCode: 0, stdout: "" });
      }
      if (list[0] === "rev-parse" && list.includes("origin/main")) {
        return createFakeChild({ exitCode: 1 });
      }
      return createFakeChild({ exitCode: 1 });
    });

    await expect(gitSyncd({ cwd: tmpDir })).rejects.toThrow("git rev-parse origin/main failed");
  });
});
