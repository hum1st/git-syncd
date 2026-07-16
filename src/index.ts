import { spawn } from "child_process";
import * as path from "path";

export interface GitSyncdOptions {
  /** 目标仓库的目录路径，默认为当前工作目录 */
  cwd?: string;
  /** 额外的 git pull 参数 */
  args?: string[];
}

export interface GitSyncdResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * 通过子进程执行 git pull，使指定目录的 git 仓库保持同步
 */
export function gitSyncd(options: GitSyncdOptions = {}): Promise<GitSyncdResult> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const args = ["pull", ...(options.args ?? [])];

  return new Promise((resolve) => {
    const child = spawn("git", args, { cwd });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (exitCode: number | null) => {
      const code = exitCode ?? 1;
      resolve({
        success: code === 0,
        stdout,
        stderr,
        exitCode: code,
      });
    });

    child.on("error", (err: Error) => {
      resolve({
        success: false,
        stdout,
        stderr: stderr + err.message,
        exitCode: 1,
      });
    });
  });
}

export default gitSyncd;
