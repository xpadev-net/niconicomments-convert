export type SpawnResult = {
  stdout: string;
  stderr: string;
  code: number | null;
  signal: NodeJS.Signals | null;
  cancelled: boolean;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
};
