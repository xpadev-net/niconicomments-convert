import * as child_process from "child_process";

import type { SpawnResult } from "@/@types/spawn";

function spawn(
  cmd: string,
  args?: string[],
  options?: child_process.SpawnOptionsWithoutStdio,
  onData?: (data: string) => unknown,
  onError?: (data: string) => unknown,
): { promise: Promise<SpawnResult>; stop: () => void } {
  let stdout = "",
    stderr = "";
  const p = child_process.spawn(cmd, args, options);
  p.stdout.setEncoding("utf-8");
  p.stdout.on("data", (data: string) => {
    stdout += data;
    onData && onData(data.toString().trim());
  });
  p.stderr.on("data", (data: string) => {
    stderr += data;
    onError && onError(data.toString().trim());
  });
  return {
    promise: new Promise<SpawnResult>((resolve, reject) => {
      p.on("exit", (code) => {
        if (code === 0) {
          resolve({
            stderr,
            stdout,
            code,
          });
        } else {
          reject({
            stderr,
            stdout,
            code,
          });
        }
      });
    }),
    stop: () => p.kill("SIGINT"),
  };
}
export { spawn };
