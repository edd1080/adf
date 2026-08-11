import { execa } from "execa";

export type RunOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  interactive?: boolean;
};

export type RunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export interface ProcessRunner {
  run(command: string, args: readonly string[], options?: RunOptions): Promise<RunResult>;
}

export class SystemProcessRunner implements ProcessRunner {
  async run(
    command: string,
    args: readonly string[],
    options: RunOptions = {},
  ): Promise<RunResult> {
    const result = await execa(command, [...args], {
      reject: false,
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      ...(options.env === undefined ? {} : { env: options.env }),
      ...(options.interactive
        ? { stdin: "inherit", stdout: "inherit", stderr: "inherit" }
        : { stdin: "ignore" }),
    });

    return {
      exitCode: result.exitCode ?? 1,
      stdout: typeof result.stdout === "string" ? result.stdout : "",
      stderr: typeof result.stderr === "string" ? result.stderr : "",
    };
  }
}
