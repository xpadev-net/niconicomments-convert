import * as child_process from "node:child_process";

import type { SpawnResult } from "@/@types/spawn";

export type ProcessOptions = child_process.SpawnOptions & {
  /** Maximum retained bytes per stream. Callbacks still receive all output. */
  maxOutputBytes?: number;
  successCodes?: readonly number[];
  /** Grace period after SIGINT before escalating to SIGKILL. */
  killTimeoutMs?: number;
};

export class ProcessError extends Error implements SpawnResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly cancelled: boolean;
  readonly stdoutTruncated: boolean;
  readonly stderrTruncated: boolean;

  constructor(message: string, result: SpawnResult, cause?: unknown) {
    super(message, { cause });
    this.name = result.cancelled ? "AbortError" : "ProcessError";
    this.stdout = result.stdout;
    this.stderr = result.stderr;
    this.code = result.code;
    this.signal = result.signal;
    this.cancelled = result.cancelled;
    this.stdoutTruncated = result.stdoutTruncated;
    this.stderrTruncated = result.stderrTruncated;
  }
}

class OutputTail {
  private data = Buffer.alloc(0);
  truncated = false;

  constructor(private readonly limit: number) {}

  append(data: string): void {
    const chunk = Buffer.from(data);
    this.truncated ||= this.data.length + chunk.length > this.limit;
    this.data =
      chunk.length >= this.limit
        ? Buffer.from(chunk.subarray(chunk.length - this.limit))
        : Buffer.concat([
            this.data.subarray(
              Math.max(0, this.data.length + chunk.length - this.limit),
            ),
            chunk,
          ]);
  }

  toString(): string {
    // A byte limit may cut through a UTF-8 character at the start of the tail.
    let start = 0;
    while (start < this.data.length && (this.data[start] & 0xc0) === 0x80)
      start++;
    return this.data.toString("utf8", start);
  }
}

function spawn(
  cmd: string,
  args?: string[],
  options: ProcessOptions = {},
  onData?: (data: string) => unknown,
  onError?: (data: string) => unknown,
): {
  process?: child_process.ChildProcess;
  promise: Promise<SpawnResult>;
  stop: () => void;
} {
  const {
    maxOutputBytes = 1024 * 1024,
    successCodes = [0],
    killTimeoutMs = 5000,
    signal,
    ...spawnOptions
  } = options;
  let process: child_process.ChildProcess | undefined;
  let settled = false;
  let closed = false;
  let cancelled = false;
  let killTimer: ReturnType<typeof setTimeout> | undefined;
  const stdout = new OutputTail(maxOutputBytes);
  const stderr = new OutputTail(maxOutputBytes);
  const result = (
    code: number | null = null,
    signal: NodeJS.Signals | null = null,
  ): SpawnResult => ({
    stdout: stdout.toString(),
    stderr: stderr.toString(),
    code,
    signal,
    cancelled,
    stdoutTruncated: stdout.truncated,
    stderrTruncated: stderr.truncated,
  });
  const stop = (): void => {
    if (settled || closed || cancelled) return;
    cancelled = true;
    if (!process || process.exitCode !== null || process.signalCode !== null)
      return;
    process.kill("SIGINT");
    killTimer = setTimeout(() => {
      if (
        !closed &&
        process?.exitCode === null &&
        process.signalCode === null
      ) {
        process.kill("SIGKILL");
      }
    }, killTimeoutMs);
    killTimer.unref();
  };
  const promise = new Promise<SpawnResult>((resolve, reject) => {
    const cleanup = (): void => {
      clearTimeout(killTimer);
      signal?.removeEventListener("abort", stop);
    };
    const fail = (error: unknown): void => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", stop);
      reject(
        new ProcessError(
          error instanceof Error ? error.message : String(error),
          result(),
          error,
        ),
      );
    };
    if (
      !Number.isSafeInteger(maxOutputBytes) ||
      maxOutputBytes < 0 ||
      !Number.isSafeInteger(killTimeoutMs) ||
      killTimeoutMs < 0
    ) {
      fail(
        new RangeError(
          "Output limit and kill timeout must be non-negative safe integers",
        ),
      );
      return;
    }
    if (signal?.aborted) {
      cancelled = true;
      fail(new Error("Process cancelled before starting"));
      return;
    }
    try {
      process = child_process.spawn(cmd, args ?? [], spawnOptions);
    } catch (error) {
      fail(error);
      return;
    }
    process.on("error", fail);
    process.once("close", (code, exitSignal) => {
      closed = true;
      cleanup();
      if (settled) return;
      settled = true;
      const output = result(code, exitSignal);
      if (!cancelled && code !== null && successCodes.includes(code)) {
        resolve(output);
      } else {
        reject(
          new ProcessError(
            cancelled
              ? "Process cancelled"
              : `Process failed: ${cmd} (code=${code}, signal=${exitSignal})`,
            output,
          ),
        );
      }
    });
    const readOutput = (
      stream: NodeJS.ReadableStream | null,
      tail: OutputTail,
      callback?: (data: string) => unknown,
    ): void => {
      if (!stream) return;
      // Decode both streams incrementally, including split multibyte characters.
      if ("setEncoding" in stream) stream.setEncoding("utf8");
      stream.on("data", (data: string) => {
        tail.append(data);
        if (settled) return;
        try {
          callback?.(data);
        } catch (error) {
          stop();
          fail(error);
        }
      });
      stream.on("error", (error) => {
        stop();
        fail(error);
      });
    };
    readOutput(process.stdout, stdout, onData);
    readOutput(process.stderr, stderr, onError);
    signal?.addEventListener("abort", stop, { once: true });
  });
  return { process, promise, stop };
}

export { spawn };
